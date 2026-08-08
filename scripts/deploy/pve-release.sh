#!/usr/bin/env bash
# pve-release.sh — 실제 서빙 경로(VM100 docker + bind mount)로 landing 을 배포한다.
#
#   CF → cloudflared → traefik → svc infra/landing-astro-subpages-pve
#      → 192.168.0.24:18080 → docker landing-astro-subpages-canary (nginx)
#      → bind mount /opt/metahumotonic/canary/landing-astro-subpages/current/html
#
# 설계 원칙 (2026-07-23)
#   - Mac mini 를 경유하지 않는다. 컨테이너를 이미 돌리는 VM100 안에서 끝낸다.
#   - 폴링 비용 최소화: GitHub API 로 deploy 브랜치 sha 만 확인(수백 B).
#     sha 가 지난 실행과 같으면 즉시 종료 — 다운로드도 tar 도 restart 도 없다.
#   - 릴리스는 append-only: releases/<tarball-sha256>/html + current 심링크.
#     롤백 = 심링크를 옛 sha 로 되돌리고 컨테이너 restart.
#   - ⚠️ bind mount 는 마운트 시점 경로에 고정된다. 심링크만 바꾸면 컨테이너는
#     옛 디렉터리를 계속 본다. nginx -s reload 로도 안 바뀐다. restart 가 필수다.
#     (lesson-green-ci-does-not-mean-deployed-bindmount-symlink-2026-07-23)
#
# 설치 (VM100, root):
#   install -m 0755 pve-release.sh /usr/local/bin/landing-astro-release
#   systemctl enable --now landing-astro-release.timer
set -euo pipefail

REPO="${REPO:-gj3447/metahumotonic-web}"
BRANCH="${BRANCH:-deploy}"
ROOT="${ROOT:-/opt/metahumotonic/canary/landing-astro-subpages}"
CONTAINER="${CONTAINER:-landing-astro-subpages-canary}"
PROBE_URL="${PROBE_URL:-http://192.168.0.24:18080/}"
VERIFY_LIVE="${VERIFY_LIVE:-/usr/local/bin/landing-astro-verify-live}"
VERIFY_ATTEMPTS="${VERIFY_ATTEMPTS:-10}"
VERIFY_DELAY_SECONDS="${VERIFY_DELAY_SECONDS:-1}"
STATE="${STATE:-/var/lib/landing-astro-release/last_commit}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*"; }

if [[ ! "$VERIFY_ATTEMPTS" =~ ^[1-9][0-9]*$ ]] || (( VERIFY_ATTEMPTS > 60 )); then
  log "FATAL: VERIFY_ATTEMPTS must be an integer from 1 to 60"
  exit 64
fi
if [[ ! "$VERIFY_DELAY_SECONDS" =~ ^[0-9]+$ ]] || (( VERIFY_DELAY_SECONDS > 30 )); then
  log "FATAL: VERIFY_DELAY_SECONDS must be an integer from 0 to 30"
  exit 64
fi

if [[ ! -x "$VERIFY_LIVE" ]]; then
  adjacent_verifier="$(dirname "$0")/verify-live.sh"
  if [[ -x "$adjacent_verifier" ]]; then
    VERIFY_LIVE="$adjacent_verifier"
  else
    log "FATAL: live verifier is not executable: ${VERIFY_LIVE}"
    exit 1
  fi
fi

verify_surface() {
  local attempt
  for ((attempt = 1; attempt <= VERIFY_ATTEMPTS; attempt++)); do
    if PROBE_URL="$PROBE_URL" "$VERIFY_LIVE"; then
      return 0
    fi
    log "direct-origin verification attempt ${attempt}/${VERIFY_ATTEMPTS} failed"
    if (( attempt < VERIFY_ATTEMPTS )); then
      sleep "$VERIFY_DELAY_SECONDS"
    fi
  done
  return 1
}

write_state() {
  local pending_state="${STATE}.new.$$"
  printf '%s\n' "$head_sha" > "$pending_state"
  mv -f "$pending_state" "$STATE"
}

mkdir -p "$(dirname "$STATE")"

# 1. 커밋 sha 만 확인한다 (가벼움). 변화 없으면 아무 일도 하지 않는다.
head_sha="$(curl -fsSL --max-time 20 \
  "https://api.github.com/repos/${REPO}/commits/${BRANCH}" \
  -H 'Accept: application/vnd.github.sha')" || { log "sha probe failed"; exit 0; }

if [[ -f "$STATE" && "$(cat "$STATE")" == "$head_sha" ]]; then
  if verify_surface; then
    exit 0
  fi
  log "recorded deployment is unhealthy; replaying commit ${head_sha}"
fi
log "deploy branch moved -> ${head_sha}"

# 2. 바뀐 경우에만 아티팩트를 받는다.
curl -fsSL --max-time 120 \
  "https://raw.githubusercontent.com/${REPO}/${head_sha}/dist.tar.gz" \
  -o "$WORK/dist.tar.gz"

artifact_sha="$(sha256sum "$WORK/dist.tar.gz" | cut -d' ' -f1)"
release="${ROOT}/releases/${artifact_sha}"

if [[ -d "$release/html" ]]; then
  [[ -f "$release/ARTIFACT_SHA256" ]] || {
    log "FATAL: existing release has no artifact receipt: ${release}"
    exit 1
  }
  [[ "$(cat "$release/ARTIFACT_SHA256")" == "$artifact_sha" ]] || {
    log "FATAL: existing release artifact receipt mismatch: ${release}"
    exit 1
  }
  log "release ${artifact_sha} already unpacked, reusing"
else
  mkdir -p "$release/html"
  tar xzf "$WORK/dist.tar.gz" -C "$release/html"
  printf '%s\n' "$artifact_sha" > "$release/ARTIFACT_SHA256"
fi

# 3. 배포 표면 무결성 게이트 — 깨진 아티팩트로 current 를 덮지 않는다.
required_files=(
  index.html
  wiki/index.html
  wiki/data.json
  SURFACE_MANIFEST.json
)
for required_file in "${required_files[@]}"; do
  [[ -s "$release/html/$required_file" ]] || {
    log "FATAL: required artifact missing or empty: ${required_file}"
    exit 1
  }
done

grep -q '<title>' "$release/html/index.html" || { log "FATAL: index.html has no <title>"; exit 1; }

python3 - "$release/html/wiki/data.json" <<'PY' || {
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as stream:
    document = json.load(stream)

expected = "metahumotonic-public-wiki/v1"
actual = document.get("schemaVersion") if isinstance(document, dict) else None
if actual != expected:
    raise SystemExit(f"expected schemaVersion={expected!r}, got {actual!r}")
PY
  log "FATAL: wiki/data.json is invalid or has the wrong schemaVersion"
  exit 1
}

previous="$(readlink -f "$ROOT/current" || true)"
if [[ "$previous" == "$release" ]]; then
  log "current already points at ${artifact_sha}; restarting to rebind and verify"
else
  # 4. 원자적 심링크 교체. bind mount 재해석은 아래 restart 가 수행한다.
  ln -sfn "$release" "$ROOT/current.new"
  mv -Tf "$ROOT/current.new" "$ROOT/current"
  log "current: ${previous:-none} -> ${release}"
fi
docker restart "$CONTAINER" >/dev/null

# 5. direct origin 서빙 표면에서 검증한다. 실패하면 즉시 롤백.
if ! verify_surface; then
  log "FATAL: direct-origin verification failed after restart — rolling back"
  if [[ -n "$previous" && "$previous" != "$release" ]]; then
    ln -sfn "$previous" "$ROOT/current.new"
    mv -Tf "$ROOT/current.new" "$ROOT/current"
    docker restart "$CONTAINER" >/dev/null
    if verify_surface; then
      log "rollback verified at ${previous}"
    else
      log "CRITICAL: rollback target is also unhealthy: ${previous}"
    fi
  else
    log "rollback unavailable: no distinct previous release"
  fi
  exit 1
fi

write_state
log "deployed ${artifact_sha} (commit ${head_sha}) OK"

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
STATE="${STATE:-/var/lib/landing-astro-release/last_commit}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log() { printf '[%(%Y-%m-%dT%H:%M:%S%z)T] %s\n' -1 "$*"; }

mkdir -p "$(dirname "$STATE")"

# 1. 커밋 sha 만 확인한다 (가벼움). 변화 없으면 아무 일도 하지 않는다.
head_sha="$(curl -fsSL --max-time 20 \
  "https://api.github.com/repos/${REPO}/commits/${BRANCH}" \
  -H 'Accept: application/vnd.github.sha')" || { log "sha probe failed"; exit 0; }

if [[ -f "$STATE" && "$(cat "$STATE")" == "$head_sha" ]]; then
  exit 0
fi
log "deploy branch moved -> ${head_sha}"

# 2. 바뀐 경우에만 아티팩트를 받는다.
curl -fsSL --max-time 120 \
  "https://raw.githubusercontent.com/${REPO}/${head_sha}/dist.tar.gz" \
  -o "$WORK/dist.tar.gz"

artifact_sha="$(sha256sum "$WORK/dist.tar.gz" | cut -d' ' -f1)"
release="${ROOT}/releases/${artifact_sha}"

if [[ -d "$release/html" ]]; then
  log "release ${artifact_sha} already unpacked, reusing"
else
  mkdir -p "$release/html"
  tar xzf "$WORK/dist.tar.gz" -C "$release/html"
  printf '%s\n' "$artifact_sha" > "$release/ARTIFACT_SHA256"
fi

# 3. 최소 무결성 게이트 — 깨진 아티팩트로 current 를 덮지 않는다.
[[ -s "$release/html/index.html" ]] || { log "FATAL: index.html missing"; exit 1; }
grep -q '<title>' "$release/html/index.html" || { log "FATAL: no <title>"; exit 1; }

previous="$(readlink -f "$ROOT/current" || true)"
if [[ "$previous" == "$release" ]]; then
  log "current already points at ${artifact_sha}"
  printf '%s\n' "$head_sha" > "$STATE"
  exit 0
fi

# 4. 원자적 심링크 교체 + 컨테이너 재시작(bind mount 재해석).
ln -sfn "$release" "$ROOT/current.new"
mv -Tf "$ROOT/current.new" "$ROOT/current"
log "current: ${previous:-none} -> ${release}"
docker restart "$CONTAINER" >/dev/null

# 5. 서빙 표면에서 검증한다. 실패하면 즉시 롤백.
ok=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if curl -fsS --max-time 5 "$PROBE_URL" | grep -q '<title>'; then ok=1; break; fi
done

if [[ "$ok" != 1 ]]; then
  log "FATAL: probe failed after restart — rolling back"
  if [[ -n "$previous" ]]; then
    ln -sfn "$previous" "$ROOT/current.new"
    mv -Tf "$ROOT/current.new" "$ROOT/current"
    docker restart "$CONTAINER" >/dev/null
    log "rolled back to ${previous}"
  fi
  exit 1
fi

printf '%s\n' "$head_sha" > "$STATE"
log "deployed ${artifact_sha} (commit ${head_sha}) OK"

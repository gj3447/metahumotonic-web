#!/usr/bin/env bash
# Verify the directly served public surface. PROBE_URL remains the deployment
# compatibility variable; an explicit first argument takes precedence.
set -euo pipefail

base_url="${1:-${PROBE_URL:-http://192.168.0.24:18080/}}"
base_url="${base_url%/}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

log() { printf '[verify-live] %s\n' "$*"; }

verify_response() {
  local path="$1"
  local expected_status="$2"
  local expected_content_type="$3"
  local body_file="$4"
  local expected_marker="${5:-}"
  local header_file="$work/headers"
  local status
  local content_type
  local normalized_content_type
  local normalized_expected_content_type

  : > "$header_file"
  status="$(curl -sS --max-time 5 -D "$header_file" -o "$body_file" -w '%{http_code}' "${base_url}${path}")" || {
    log "FAIL ${path}: request failed (expected status=${expected_status}, content-type=${expected_content_type})"
    return 1
  }

  content_type="$(awk '
    tolower($0) ~ /^content-type:[[:space:]]*/ {
      sub(/^[^:]*:[[:space:]]*/, "")
      sub(/\r$/, "")
      value = $0
    }
    END { print value }
  ' "$header_file")"
  normalized_content_type="$(printf '%s' "$content_type" | tr '[:upper:]' '[:lower:]')"
  normalized_expected_content_type="$(printf '%s' "$expected_content_type" | tr '[:upper:]' '[:lower:]')"

  if [[ "$status" != "$expected_status" ]]; then
    log "FAIL ${path}: status=${status} (expected ${expected_status})"
    return 1
  fi
  if [[ "$normalized_content_type" != "$normalized_expected_content_type" && "$normalized_content_type" != "$normalized_expected_content_type;"* ]]; then
    log "FAIL ${path}: content-type=${content_type:-missing} (expected ${expected_content_type})"
    return 1
  fi
  if [[ ! -s "$body_file" ]]; then
    log "FAIL ${path}: empty response body"
    return 1
  fi
  if [[ -n "$expected_marker" ]] && ! grep -Fq "$expected_marker" "$body_file"; then
    log "FAIL ${path}: expected marker is missing: ${expected_marker}"
    return 1
  fi

  log "PASS ${path}: status=${status}, content-type=${content_type}"
}

verify_response "/" "200" "text/html" "$work/root.html" "MetaHumotonic —"
verify_response "/wiki/" "200" "text/html" "$work/wiki.html" "MetaHumotonic Wiki"
verify_response "/wiki/data.json" "200" "application/json" "$work/wiki-data.json"

python3 - "$work/wiki-data.json" <<'PY'
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

log "PASS /wiki/data.json: schemaVersion=metahumotonic-public-wiki/v1"

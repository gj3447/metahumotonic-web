#!/usr/bin/env bash
# server-pull.sh — fetch deploy branch + kubectl apply if changed.
# Install on Mac Multipass VM (or wherever kubectl can reach the k8s API).
# Cron: * * * * * /path/to/server-pull.sh >> /var/log/landing-astro-pull.log 2>&1

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/gj3447/metahumotonic-web.git}"
LOCAL_DIR="${LOCAL_DIR:-$HOME/landing-astro-deploy}"
NAMESPACE="${NAMESPACE:-infra}"
DEPLOYMENT="${DEPLOYMENT:-landing-astro-subpages}"
BRANCH="deploy"

log() { printf '[%(%Y-%m-%dT%H:%M:%S%z)T] %s\n' -1 "$*"; }

if [[ ! -d "$LOCAL_DIR/.git" ]]; then
  log "first clone $REPO_URL ($BRANCH) -> $LOCAL_DIR"
  git clone --depth=1 --branch="$BRANCH" "$REPO_URL" "$LOCAL_DIR"
  cd "$LOCAL_DIR"
  log "initial apply"
  kubectl apply -n "$NAMESPACE" -f cm.yaml
  kubectl rollout restart -n "$NAMESPACE" "deployment/$DEPLOYMENT"
  exit 0
fi

cd "$LOCAL_DIR"
LOCAL_SHA="$(git rev-parse HEAD)"
git fetch --depth=1 origin "$BRANCH" --quiet
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
  exit 0
fi

log "update $LOCAL_SHA -> $REMOTE_SHA"
git reset --hard "origin/$BRANCH"
kubectl apply -n "$NAMESPACE" -f cm.yaml
kubectl rollout restart -n "$NAMESPACE" "deployment/$DEPLOYMENT"
log "rolled out $REMOTE_SHA"

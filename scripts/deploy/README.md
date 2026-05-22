# Deploy pipeline (Pattern A — GHA → deploy branch → server pull)

```
push main ──► GHA build-and-deploy ──► force-push `deploy` branch (cm.yaml + dist.tar.gz)
                                              │
                                              ▼
                              cron @ Mac Multipass VM
                              (server-pull.sh, 1분 주기)
                                              │
                                              ▼
                              kubectl apply + rollout restart
                              (namespace: infra, deployment: landing-astro-subpages)
```

## 서버 설치 (Mac Multipass VM 또는 kubectl 닿는 호스트)

```bash
# 1. 스크립트 배치
sudo curl -fsSL https://raw.githubusercontent.com/gj3447/metahumotonic-web/main/scripts/deploy/server-pull.sh \
  -o /usr/local/bin/landing-astro-pull
sudo chmod +x /usr/local/bin/landing-astro-pull

# 2. private repo 인 경우 PAT 가 필요 — 환경 변수로 주입하거나 git credential 설정
# (REPO_URL 을 https://<token>@github.com/... 형태로 덮어쓰기)
# echo 'REPO_URL=https://gj3447:<PAT>@github.com/gj3447/metahumotonic-web.git' > /etc/landing-astro.env

# 3. 첫 실행 (수동, 초기 clone + apply)
sudo /usr/local/bin/landing-astro-pull

# 4. cron 등록 (분당)
( crontab -l 2>/dev/null; echo '* * * * * /usr/local/bin/landing-astro-pull >> /var/log/landing-astro-pull.log 2>&1' ) | crontab -
```

## 동작 확인

```bash
# GHA 빌드 로그
gh run list -R gj3447/metahumotonic-web -L 5

# deploy 브랜치 head
git ls-remote https://github.com/gj3447/metahumotonic-web.git deploy

# 서버 측 로그
tail -f /var/log/landing-astro-pull.log

# k8s 측 rollout
kubectl rollout status -n infra deployment/landing-astro-subpages
```

## 비고

- ConfigMap 갱신만으론 init container 가 재실행 안 되므로 `kubectl rollout restart` 필수.
- private repo 라서 `server-pull.sh` 가 fetch 할 때 인증 필요. PAT 를 REPO_URL 에 박는 게 가장 간단 (root 만 읽기).
- public 으로 전환하면 인증 불필요.

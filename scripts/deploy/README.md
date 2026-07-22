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

# 2. 공개 저장소는 인증이 필요 없다.
# private fork를 배포할 때는 Git credential helper나 read-only deploy key를 사용한다.
# 자격 증명을 REPO_URL에 포함하지 않는다.

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
- 이 저장소의 공개 URL은 인증 없이 fetch할 수 있다.
- private fork의 자격 증명은 Git credential helper나 read-only deploy key로 관리한다.
  PAT 또는 비밀번호를 URL, 환경 파일, 셸 기록에 직접 넣지 않는다.
- 운영 환경의 cron과 Kubernetes 대상은 별도로 관리된다. 새 서버에서는 대상과
  권한을 확인한 뒤에만 pull 스크립트와 cron을 설치한다.

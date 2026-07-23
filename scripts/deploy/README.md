# Deploy pipeline

## 현재 운영 경로 (Pattern B — GHA → deploy branch → VM100 systemd timer) ✅

2026-07-23 실측 기준. **Mac mini 는 경유하지 않는다.**

```
push main ──► GHA build-and-deploy ──► force-push `deploy` 브랜치 (cm.yaml + dist.tar.gz)
                                              │
                                              ▼
                        VM100 (cpu-edge-01, 192.168.0.24) systemd timer 5분
                        landing-astro-release (scripts/deploy/pve-release.sh)
                        ├─ GitHub API 로 deploy 브랜치 sha 만 확인 (40 B, ~50 ms)
                        ├─ sha 가 그대로면 즉시 종료 (다운로드·tar·restart 없음)
                        └─ 바뀌었을 때만: dist.tar.gz → releases/<sha256>/html
                                          → current 심링크 원자 교체
                                          → docker restart landing-astro-subpages-canary
                                          → :18080 프로브, 실패 시 자동 롤백
                                              │
                                              ▼
        CF → cloudflared → traefik → svc infra/landing-astro-subpages-pve
           → 192.168.0.24:18080 → docker landing-astro-subpages-canary (nginx)
           → bind mount /opt/metahumotonic/canary/landing-astro-subpages/current/html
```

### 설치 (VM100)

```bash
sudo install -m 0755 scripts/deploy/pve-release.sh /usr/local/bin/landing-astro-release
sudo install -m 0644 landing-astro-release.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now landing-astro-release.timer
```

### 동작 확인

```bash
gh run list -R gj3447/metahumotonic-web -L 5                    # GHA 빌드
git ls-remote https://github.com/gj3447/metahumotonic-web.git deploy   # deploy head
systemctl list-timers landing-astro-release.timer               # 다음 실행
journalctl -u landing-astro-release.service -n 30               # 배포 로그
ls -l /opt/metahumotonic/canary/landing-astro-subpages/current  # 현재 릴리스
```

### 롤백

```bash
ROOT=/opt/metahumotonic/canary/landing-astro-subpages
ln -sfn $ROOT/releases/<옛-sha256> $ROOT/current.new && mv -Tf $ROOT/current.new $ROOT/current
docker restart landing-astro-subpages-canary
```

### 함정 (실제로 겪음, 2026-07-23)

- **bind mount 는 마운트 시점 경로에 고정된다.** `current` 심링크만 바꾸면 컨테이너
  내부는 옛 디렉터리를 계속 본다. `nginx -s reload` 로도 안 바뀐다. `docker restart` 필수.
- **GHA 초록불은 배포의 증거가 아니다.** 빌드 성공과 `deploy` 브랜치 갱신은 아티팩트
  생성까지만 증명한다. 검증은 항상 공개 URL 의 실제 바이트로 한다.
  KG: `lesson-green-ci-does-not-mean-deployed-bindmount-symlink-2026-07-23`

## 폐기된 경로 (Pattern A — Mac Multipass VM cron → kubectl) ⛔ DEAD

`server-pull.sh` + cron 으로 `cm.yaml` 을 `kubectl apply` 하고
`deployment/landing-astro-subpages` 를 rollout restart 하던 경로.

2026-07-23 실측 결과 **양쪽 끝이 모두 부재**한다.

- 클러스터에 `deployment/landing-astro-subpages` 가 없다 (ns `infra` 전수 확인).
  `svc/landing-astro-subpages-pve` 는 파드가 아니라 EndpointSlice 로
  `192.168.0.24:18080`(docker 컨테이너)을 가리킨다.
- Mac Multipass VM 의 cron 도 돌지 않는다.

그 사이에도 GHA 는 계속 success 였기 때문에 배포된 것처럼 보였고, 실제로는 커밋 3개분
(자유·경제·합의 / Ultra Safety AI 랜딩 / 순수 검정 통일)이 라이브에 반영되지 않았다.

`server-pull.sh` 는 이력 보존용으로 남겨둔다. **되살리지 말 것** — Mac mini 에 부하를
주지 않는다는 운영 방침(2026-07-23)에 따라 배포는 VM100 안에서 끝낸다.

## 비고

- 공개 저장소이므로 fetch 에 인증이 필요 없다. private fork 는 read-only deploy key 로
  관리하고 PAT/비밀번호를 URL·환경 파일·셸 기록에 넣지 않는다.
- 릴리스는 append-only 라 이전 빌드가 `releases/` 에 남는다. 디스크가 문제되면
  오래된 릴리스만 정리한다 (`current` 가 가리키는 것은 제외).

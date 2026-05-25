# Longinus drift monitoring

KG↔code 참조 바인딩(`:ReferenceSite`, `binding_state=LIVE`)이 가리키는 소스 파일이 KG에 기록된
sha256 baseline에서 벗어났는지 감시한다. PROM16 `prom16-mhweb-longinus-followup-2026-05-26`
Track 4 산출물 (D1–D4 consensus 기반).

## 3-tier (PROM16 D2 consensus)

| tier | 위치 | 명령 |
|---|---|---|
| 1. local | pre-commit hook | `node scripts/longinus/drift-check.mjs` |
| 2. CI | GitHub Actions | `.github/workflows/longinus-drift.yml` (push/PR 자동) |
| 3. scheduled | (선택) cron | 같은 스크립트를 주기 실행 + 리포트 |

## 의도적 변경 시 (intent-tagged update, D4 consensus)

파일을 **의도적으로** 바꿨으면 같은 커밋에서 baseline을 갱신한다 (auto-creep 금지):

```sh
node scripts/longinus/drift-check.mjs --update
git add scripts/longinus/baselines.json
```

갱신 안 하면 CI가 "unexpected drift"로 실패 → 의도적 변경과 우발적 drift를 강제 구분.

## 설계 노트

- **granularity**: file-level sha256 (v1). per-AST-block(tree-sitter) 해시가 향후 업그레이드
  — whitespace/comment noise 제외 (D3 함정: coarse granularity / alert fatigue).
- **Goodhart 안전장치 (D1)**: 해시 일치 = 필요조건이지 충분조건 아님. 주기적 수동 spot-check 병행.
- **missing 파일**: 절대 조용히 버리지 않음 → Longinus orphan disposition으로 분류
  (DEAD_CONFIRMED / RELOCATED / REVIVABLE). KG Hygiene + Eilu va-Eilu.
- **KG 분리**: CI 호스트는 Neo4j 접근 불가 → 커밋된 manifest가 source of truth.
  바인딩 변경 시 라이브 KG에서 manifest를 별도 refresh.

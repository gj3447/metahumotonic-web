# 개발 스택 — PI 3층 규율 (조율 · 측정 · 판정)

> 이 정적 사이트와 백엔드 [`metahumotonic_web_back`](https://github.com/gj3447/metahumotonic-web-back)은
> 사용자 자작 3층 개발기술 위에서 개발한다. 상위 정본:
> `SYMPOSIUM/GIT/delltower_import/CLAUDE.md`. 백엔드 상세: 그 repo의 `docs/DEV_STACK.md`.

| 층 | 도구 | web(Astro)에서의 상태 |
|---|---|---|
| **조율** | **OMD** (`mcp__omd__*`) | 병렬 세션 write-set lease — 아래 규율 (라이브) |
| **측정** | **ooptdd / LTDD** | ooptdd는 pytest-native(Python) → 측정층은 백엔드 `web_back`에 착지 ✅. web은 **build-trace 측정**(빌드 산출물이 의도한 KG를 실제 담았는지 read-back)이 다음 단계 (OPEN) |
| **판정** | **LakatoTree** | airo KG 트리 `LakatosTree_MetahumotonicWebStack_20260713` — MCP 경유 진보/퇴행 판정 |

이미 배선된 자매 게이트: `.github/workflows/longinus-drift.yml` (롱기누스 sha256 baseline drift, PROM16).
3층은 그 위에 얹힌다.

## 측정 (build-trace) — OPEN

web은 정적 Astro라 런타임이 없다. ooptdd의 web-side 유사물은 **빌드/배포 트레이스 검증**:
`scripts/prebuild/dump-kg.mjs`가 구운 `src/data/*.json`이 의도한 노드/스킬/도메인을
*실제로* 담았는지 빌드 후 read-back으로 positive-assert(자기보고 "빌드 성공"을 믿지 않음).
frontier: 트리 노드 `web-build-trace-measurement` (미폐쇄).

## 판정 (LakatoTree)

백엔드와 동일 트리. web 관련 변경도 예측 사전등록 → 측정 제출 → 자동 판결.
CI(GitHub)는 airo KG(ZeroTier)에 못 닿으므로 판정층은 로컬/에이전트 tier(MCP)로 돈다.

## 조율 (OMD)

병렬 편집 전 write-set lease (`declare`→`next`→`start`→`claim` HELD 확인 후 편집→
`commit`→`finish`→`connect`). 커밋은 pathspec, 커밋 후 즉시 push. 단일 세션이면 no-op.

<!-- KG: project_metahumotonic_web_integrate_core_dev_tech_2026_07_13, LakatosTree_MetahumotonicWebStack_20260713 -->

# 개발 스택 — PI 3층 규율 (조율 · 측정 · 판정)

> 이 정적 사이트와 백엔드 [`metahumotonic_web_back`](https://github.com/gj3447/metahumotonic-web-back)은
> 사용자 자작 3층 개발기술 위에서 개발한다. 상위 정본:
> `SYMPOSIUM/GIT/delltower_import/CLAUDE.md`. 백엔드 상세: 그 repo의 `docs/DEV_STACK.md`.

| 층 | 도구 | web(Astro)에서의 상태 |
|---|---|---|
| **조율** | **OMD** (`mcp__omd__*`) | 병렬 세션 write-set lease — 아래 규율 (라이브) |
| **측정** | **ooptdd / LTDD** | 백엔드 `web_back` 측정층 ✅ + **web build-trace 측정 배선됨 ✅**: 빌드 산출물(dist/)을 읽어back 해 KG 실물 착지를 positive-assert |
| **판정** | **LakatoTree** | airo KG 트리 `LakatosTree_MetahumotonicWebStack_20260713` — MCP 경유 진보/퇴행 판정 |

이미 배선된 자매 게이트: `.github/workflows/longinus-drift.yml` (롱기누스 sha256 baseline drift, PROM16).
3층은 그 위에 얹힌다.

## 측정 (build-trace) — 배선됨 ✅

web은 정적 Astro라 런타임이 없다. ooptdd의 web-side 유사물 = **빌드 산출물 read-back**:
`astro build` exit 0(자기보고)을 믿지 않고 `dist/`를 읽어 KG 실물 착지를 positive-assert.
generator≠verifier(교차언어):

- **GENERATOR** `scripts/ooptdd/emit-build-trace.mjs` (Node): 빌드 후 `dist/`+`kg-snapshot.json`을
  읽어 `kg_snapshot_loaded`(nodes/rels) + `apostle_page_built`×12(페이지 존재 + 이름 실제 렌더)
  이벤트를 `build-trace.jsonl`(ooptdd JSONL store)에 ship.
- **VERIFIER** `scripts/ooptdd/verify-build-trace.py` (Python ooptdd, vendored `_vendor/ooptdd`):
  store를 읽어back → `gates/build_kg_landed.yaml` 평가. GREEN=exit 0 / silent gap=RED exit 1 /
  store 도달불가=inconclusive exit 2(never-flaky).

```sh
npm run build && npm run verify:build-trace     # 실측: 사도 1명 미렌더 시 RED
```

CI(`build-and-deploy.yml`)에서 build 직후 emit+verify → **RED면 배포 안 함**.
frontier 트리 노드 `web-build-trace-measurement` — 판정 트리에서 닫힘.

## 판정 (LakatoTree)

백엔드와 동일 트리. web 관련 변경도 예측 사전등록 → 측정 제출 → 자동 판결.
CI(GitHub)는 airo KG(ZeroTier)에 못 닿으므로 판정층은 로컬/에이전트 tier(MCP)로 돈다.

## 조율 (OMD)

병렬 편집 전 write-set lease (`declare`→`next`→`start`→`claim` HELD 확인 후 편집→
`commit`→`finish`→`connect`). 커밋은 pathspec, 커밋 후 즉시 push. 단일 세션이면 no-op.

<!-- KG: project_metahumotonic_web_integrate_core_dev_tech_2026_07_13, LakatosTree_MetahumotonicWebStack_20260713 -->

# APT Progress: MetaHumotonic_Landing_v2
<!-- KG: MetaHumotonic_Landing_v2, SPAN_MetaHumotonic_Landing_ROOT, plan-infra-full-migration-2026-04-10 -->

## Anchor: MetaHumotonic_Landing_v2
## Domain: semantic_web_platform
## Status: active
## Created: 2026-04-05
## Last Updated: 2026-04-10T17:20
## Context Budget: total=100K, per_span=8K

---

### Target: HIGH Lesson 4건 동시 해결

| Lesson | Severity | L1 Span | 핵심 문제 |
|--------|----------|---------|----------|
| lesson-024 | HIGH | SPAN_Landing_L1_SemanticWeb | 시멘틱 웹 기술 미적용 (RDFa, Turtle, SPARQL, VOID) |
| lesson-025 | HIGH | SPAN_Landing_L1_InteractiveUX | 인터랙티브 알고리즘 비주얼 부족 |
| lesson-cheap-cosmic-aesthetic | HIGH | SPAN_Landing_L1_Quality | cosmos.css 과잉 효과, 싼티 |
| lesson-landing-text-heavy-low-emotional | HIGH | SPAN_Landing_L1_Content | 글 위주, 감성/시각/내러티브 부족 |

### Source 현황

| 소스 | 경로 | 역할 |
|------|------|------|
| Astro (next-gen) | `07_PROJECTS/metahumotonic-web/` | 개발 소스 (Astro 6.1.3 + Tailwind 4.2.2) |
| Production | `01_SERVICES/applications/server-info/site/` | ConfigMap → k8s landing Pod |
| K8s | namespace `infra`, IngressRoute `landing-site` | Traefik 라우팅 |

### L1 Span 구조 (KG) — Taliban R1 수정 반영

```
SPAN_MetaHumotonic_Landing_ROOT (depth 0)
├── SPAN_Landing_L1_Content (depth 1) ← lesson-text-heavy
│   objective: 감성적 내러티브 + 시각적 계층으로 콘텐츠 재설계
├── SPAN_Landing_L1_InteractiveUX (depth 1) ← lesson-025
│   objective: CSS-first 인터랙티브 비주얼 (light trails, counters, KG preview)
│   ├── ATOM_Landing_Starfield (depth 2)
│   ├── ATOM_Landing_Counters_Scroll (depth 2)
│   └── ATOM_Landing_KGPreview (depth 2)
├── SPAN_Landing_L1_SemanticWeb (depth 1) ← lesson-024
│   objective: KG를 RDFa, Turtle, VOID, JSON-LD로 노출
└── SPAN_Landing_L1_Quality (depth 1) ← lesson-cheap-cosmic
    objective: cosmos.css Apple-class quiet luxury 리팩토링
```

**Removed (archived by Taliban L1-Structure):**
- ~~SPAN_Landing_L1_Infrastructure~~ → WebPlatform 앵커에 위임
- ~~SPAN_Landing_L1_StaticAssets~~ → 각 L1 내부로 흡수

### INFORMED_BY

- Schema.org JSON-LD — 기존 JSON-LD 확장 (FOAF, DOAP, Dataset)
- Progressive Enhancement — JS 실패 시 HTML/CSS 폴백
- Semantic Web Standards — RDFa, Turtle, VOID, DCAT, SPARQL, Linked Data 5성
- **CSS Animations + Canvas 2D** — CSS-first 전략 (Three.js 168KB 기각 반영)
- **Vanilla JS + Astro Islands** — partial hydration, Sigma.js 대신 Canvas 2D

### 경계 정의 (Taliban L8-Consistency 수정)

- **Landing_v2**: metahumotonic.com `/` 단일 페이지 (index.html+css+js)
- **WebPlatform**: 전체 웹사이트 (`/explore/*`, `/domains/*`, `/skills/*`, `/api/*`, `/sparql/*`)
- Landing은 WebPlatform의 entry point이지만 독립 배포 가능
- DIFFERS_FROM 관계 KG 기록됨

### v21 Reflection (약점) + Taliban R1 교훈

- Astro 빌드 → ConfigMap 배포 파이프라인 확립 필요 (이중 소스 해소)
- Three.js/Sigma.js 의존성 제거, CSS-first 전략 채택
- 설명문을 문제(problem)가 아닌 목표(objective)로 작성해야 함

### Completed Spans
(none)

### In Progress
- ST 완료, SCW 대기

### Blocked
(none)

### AtomicSpan 목록 (8개, Crystallization Frontier 도달) — SP R2 현실 기반 재설계

**핵심: 12공리/12사도/개념/프로그램 구조 유지하면서 4 HIGH lesson 해결**

| # | Atom | L1 | LOC | 소스 | 설명 |
|---|------|----|-----|------|------|
| 1 | ATOM_Landing_AxiomVisual | Content | 250 | index.astro:188-301 | 12공리 심볼+카드 시각화 |
| 2 | ATOM_Landing_ApostleVisual | Content | 300 | index.astro:329-450 | 12사도 캐릭터 아이콘+액자 CSS아트 |
| 3 | ATOM_Landing_ConceptProgram | Content | 350 | index.astro:460-579 | 개념 다이어그램+프로그램 KG통계 |
| 4 | ATOM_Landing_Starfield | InteractiveUX | 400 | cosmos.ts (전체) | light trails+stars+counters 통합 |
| 5 | ATOM_Landing_KGPreview | InteractiveUX | 225 | chu-hypergraph.ts | 하이퍼그래프 시각화 |
| 6 | ATOM_Landing_SemanticMarkup | SemanticWeb | 350 | index.astro head | JSON-LD 8+엔티티, RDFa, DefinedTerm |
| 7 | ATOM_Landing_LinkedDataFiles | SemanticWeb | 300 | public/*.ttl | ontology(공리+사도), VOID, llms.txt |
| 8 | ATOM_Landing_CosmosRefactor | Quality | 400 | index.astro inline style | 인라인 style → 외부 CSS 추출 (크림 테마) |
| 9 | ATOM_Landing_CosmicAccent | Quality | 200 | cosmos.css | 다크 액센트 정제 (액자 섹션 전용) |

**Total: ~2,775 LOC** | 각 atom 200~400줄 (C(S) ν✓ δ✓)

**Archived:** HeroCopy, DomainCards, EmotionalAssets (현실 불일치), Counters_Scroll (δ합병→Starfield)

### Next Steps
1. Taliban Gate: SP 검증
2. ST Phase: 9개 AtomicSpan → Contract 정의
3. SCW Phase: TDD 구현 + 배포

### Session Log
- [2026-04-05] SA Phase: anchor MetaHumotonic_Landing_v2 created
- [2026-04-05] L1 Spans 6개 + L2 Atoms 3개 생성
- [2026-04-10T17:09] SA Phase: anchor reused for HIGH lesson 4건 해결
- [2026-04-10T17:10] Taliban Gate R1: 9/9 REJECTED
- [2026-04-10T17:20] SA 수정 5건 → Taliban R2: APPROVED
- [2026-04-10T17:30] SP Phase: 4 L1 → 9 AtomicSpans (테크 랜딩 가정, 잘못됨)
- [2026-04-10T17:35] SP Taliban R1: 3/9 APPROVED, 6/9 REJECTED (KG 기록)
- [2026-04-10T17:40] 거증: 실제 코드 읽기 → 두 소스(크림 매니페스토 vs 다크 테크) 발견
- [2026-04-10T17:50] SP R2 재설계: 12공리/12사도 구조 유지, 현실 기반 8→9 atoms, δ위반 해소
- [2026-04-10T17:55] 롱기누스 양방향 바인딩 완료 (Code→KG 4파일, KG→Code 9 atoms)
- [2026-04-10T18:00] ST Phase: 9 Contract(7대필드 전완), 2 SharedType, 9 SemanticTask, 실행순서 SEQUENCED_WITH
- [2026-04-10T18:05] ST APPROVED (VR_Landing_v2_ST_2026-04-10)

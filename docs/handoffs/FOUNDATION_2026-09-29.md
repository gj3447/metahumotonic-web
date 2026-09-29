# Foundation 웹·그래프 인수인계 — 2026-09-29

이 문서는 **이번 웹·Foundation 문서 작업의 종료 기록**이다. 운영 후속 작업은 아래의 열린 항목으로 남는다. 작성 주체는 Codex이며 내용은 `SECONDARY_AI` 인수인계다. 사용자 원문·법적 지위의 독립 판정·KG 정전을 새로 만드는 문서가 아니다.

- 기계용 관계와 작업: [인수인계 JSON-LD](foundation-2026-09-29.jsonld)
- 시각·해시·HTTP·CI 근거: [검증 관측 JSON](../evidence/foundation-handoff-2026-09-29.json)
- 재개 순서: 적용 대상의 instruction-routing → 해당 소유자 규칙 → 이 문서의 열린 작업과 완료 조건
- 관측 기준: **2026-09-29 05:46–05:50 UTC**. 아래 상태는 그때의 관측이며 상시 가용성 보장이 아니다.

## 1. 완료한 범위와 공개 결과

| 대상 | 결과 | 상태와 근거 |
|---|---|---|
| 홈·공통 탐색 | Foundation 소개, 데스크톱·모바일 메뉴와 푸터 진입점 | 배포 완료 |
| [Foundation 페이지](https://metahumotonic.com/foundation/) | 공통 검정·흰색·시안·옐로·마젠타 계열, 역할·헌장·연구 근거 안내 | 공개 HTTP 200 |
| [Foundation JSON-LD](https://metahumotonic.com/foundation/graph.jsonld) | initiative / charter / about-page / research-report 4개 개체 | 본문 배포 완료, **HTTP MIME 미완료** |
| [Foundation USL](https://metahumotonic.com/foundation/usl.json) | 같은 4개 ID, Schema.org 방향 관계 8개 | 공개 200, application/json |
| Foundation 저장소 | 현재 용어, 라이선스 확인 상태, 제안 검토 기간 정합성 수정 | `7d8564e` main 반영 |
| 기존 학습 허브 | 51개 항목·79개 관계의 기존 공개 계약 유지 | 운영 설치 검증기와 호환 |

현재 공개 원문이 선언하는 재단의 상태는 `PUBLIC_OPEN_SOURCE_INITIATIVE` / `NOT_YET_LEGALLY_INCORPORATED`다. Foundation은 공개 프로토콜·거버넌스·적합성·공개 영수증, 회사는 상용 서비스·운영, MetaHumo는 선택·거부·이탈 등 참여자의 역할로 구분돼 있다. 공개 원문은 안전 인증, 실시간 지급, 동의 없는 컴퓨팅을 주장하지 않는다. 이 인수인계가 법인 등기나 안전성을 독립 검증한 것은 아니다.

헌장의 현재 명칭은 **Ultra Safety AI**이고 이전 “Safty AI”는 역사적 출처로 보존했다. LakatoTree의 공개 AGPL 상태를 단정하던 표기는 프로젝트 원장에 맞춰 Candidate·source/license 미확정으로 고쳤다. 일반 제안 7일, 규범 RFC 14일, 불변 경계 RULE 30일은 기존 절차를 문서 간 일치시킨 것이다. 법인 설립·프로젝트 채택·새 규범 승인으로 해석하지 않는다.

## 2. 변경과 소유자

| 소유 저장소 | 고정 리비전 | 의미 |
|---|---|---|
| metahumotonic-web | [f8aba96](https://github.com/gj3447/metahumotonic-web/commit/f8aba962eefcb263adbf30d5e98d566382e6c7a8) | Foundation 탐색·페이지·테마 정리 |
| metahumotonic-web | [e35609a](https://github.com/gj3447/metahumotonic-web/commit/e35609a0e02722c68020d0f5d418e2e22aa961c3) | 운영 검증기 호환 유지, 독립 Foundation JSON-LD/USL |
| metahumotonic-web | [6bc8aa2](https://github.com/gj3447/metahumotonic-web/commit/6bc8aa2672731655453be8cb1bb2c4accc8a0c65) | 저장소 Nginx MIME 경로와 회귀 검사 |
| metahumotonic-foundation | [7d8564e](https://github.com/gj3447/metahumotonic-foundation/commit/7d8564e867e0d0c4170d7eb5c3a95005b4683d7c) | CHARTER / README / GOVERNANCE / PROPOSALS 정합성 |

웹 운영 서버가 처리한 deploy 브랜치 커밋은 `66dd1666df6b2cf8d82a96cf6cd8c5a489ae053e`다. 위 소스 커밋과 deploy 산출물 커밋은 다른 식별자다. [배포 CI](https://github.com/gj3447/metahumotonic-web/actions/runs/36518998050)와 [드리프트 CI](https://github.com/gj3447/metahumotonic-web/actions/runs/36518997997)는 해당 웹 소스 리비전에서 성공했다.

주요 구현 파일:

- [공개 원문 데이터](../../src/data/foundation.json), [연구 근거 데이터](../../src/data/academic-foundations.json)
- [Foundation 화면](../../src/pages/foundation/index.astro), [JSON-LD](../../src/pages/foundation/graph.jsonld.ts), [USL](../../src/pages/foundation/usl.json.ts)
- [Nginx 소스 설정](../../nginx.conf), [배포 지침](../../scripts/deploy/README.md), [그래프 검사](../../tests/foundation-graph.test.mjs)

Foundation 저장소의 다른 작성자가 사용하는 브랜치·미커밋 자료를 보존한다. 문서 수정은 별도 main worktree에서 반영했으므로 다른 브랜치의 같은 변경을 새 작업으로 오인해 덮거나 일괄 복구하지 않는다. 웹의 `.playwright-cli/`, `output/`, `qa-results/`도 기존 로컬 산출물이다.

## 3. 공개 그래프를 분리한 이유와 권한

최초 확장안은 학습 카탈로그에 추가 타입·상태·출처와 관계를 넣었다. 하지만 VM100에 설치된 학습 공개 검증기는 그 확장을 수용하지 않았다. 최종 구현은 학습 원본·검증기를 기존 계약으로 되돌리고 Foundation을 별도 주소로 공개한다. **처음 확장했던 학습 형식으로 되돌리지 않는다.** 확장이 필요하면 원본·검증기·운영 설치를 함께 변경하는 별도 호환성 작업으로 처리한다.

운영 검증기 SHA-256: `6d02f9c12c7a9592f29017b1a2cf3256b62522606dac09dadf16b4ad280a71d4`.

공개 개체 ID는 `https://metahumotonic.com/foundation/#initiative`, `#charter`, `#about-page`, `#research-report`다. USL은 이 ID들을 그대로 사용한다. source·status·authority와 방향은 원본에서 유지하며, URL 연결은 소유권·법인격·실행 권한을 뜻하지 않는다.

이번 재조회에서 KG 검색 `MetaHumotonic Foundation`(preliminary 포함)은 결과를 돌려주지 않았다. 부재 증명이 아니다. 랜딩 용어는 정확한 UID `sym:AbstractNode:user-canon-ultra-safety-ai-landing-headline-2026-07-23`의 `utterance_verbatim`을 확인했다. 반환 메타데이터의 authority는 `SOURCE_DECLARED`, canonical scope는 `LEGACY_CANONICAL_UNSCOPED`였으며 이를 임의 승격하지 않았다. 원문 해시는 검증 관측 JSON에 있다.

**native KG 쓰기는 수행하지 않았다.** 공개 graph/USL과 이 인수인계는 저장소 소유 범위의 projection이다. KG 적재가 후속으로 요구되면 기존 소유자 publisher와 스키마를 사용하고, 원문·AI 요약·운영 관측·미완료 작업을 별개로 유지한다.

사용자의 “제단”은 문맥에 따라 Foundation/재단으로 임시 해석했다. 별도의 상징적 제단이 있다는 정전은 확정하지 않았다.

## 4. 열린 운영 작업

### A. Foundation JSON-LD의 HTTP Content-Type

- 담당 역할: **VM100 운영자, 인수인계 시 미배정**.
- 상태: `OPEN_MISSING_MANAGEMENT_TRANSPORT`. 기존 사용자 승인이 취소된 것이 아니라, 현재 세션에 쓸 수 있는 VM100 관리 접속 경로가 없었다.
- 관측: 원본·공개 주소 모두 본문 200과 같은 해시를 반환하지만 타입이 `application/octet-stream`이다.
- 원인 근거: 별도 운영 Nginx 설정에 Foundation exact location이 없다. 실제 설정 해시는 `12fe4583ad9957b349a29244445e1e01b3404f731120482b659570cdc9a0c032`.
- 저장소에는 수정이 준비돼 있다. 정적 아티팩트 CI는 별도 운영 Nginx 파일을 배포하지 않는다.

다음 운영자는 [배포 지침](../../scripts/deploy/README.md)의 현재 VM 경로와 관리 접속을 확인하고 운영 설정을 백업한 뒤 다음 location만 합친다. **저장소 nginx.conf 전체를 운영 파일에 덮어쓰면 안 된다.** 운영 `root`와 파일 마운트가 다르다.

```nginx
location = /foundation/graph.jsonld {
    types { }
    default_type application/ld+json;
    try_files $uri =404;
}
```

운영 compose override는 `nginx.conf`를 `/etc/nginx/conf.d/default.conf`에 단일 파일로 bind mount한다. 파일 교체 후에는 컨테이너가 새 내용을 실제로 읽는지 확인한다. 백업을 보존하고 같은 설정 대상으로 `nginx -t` 성공 후 reload한다. 검사 실패 시 reload하지 않고 원본을 복구한다. 공개 검사 실패 시 저장한 운영 설정으로 복구·검사·reload한다.

완료 조건은 원본·공개 URL의 200 + `application/ld+json`, 올바른 4개 개체와 USL 8개 관계, 본문 해시 유지, 기존 홈·wiki·learn 검증 통과다. CI 초록불이나 Git push만으로 이 항목을 닫지 않는다.

### B. 공개 기계 클라이언트 접근

- 담당 역할: **공개 엣지 운영자, 미배정**. 상태 `OPEN_INVESTIGATION`.
- 같은 Python urllib 전송에서 User-Agent만 달리했을 때 `Python-urllib/3.13`은 403, `curl/8.0.1`은 200이었다. 403 응답의 server 헤더는 Cloudflare다.
- 구체적인 WAF 규칙 원인은 아직 조회하지 않았다. 다음 운영자는 해당 요청의 엣지 이벤트와 의도한 공개 기계 접근 정책을 확인한다.
- 완료 조건: 의도한 정책과 근거를 기록하고 동일 요청을 재검증한다. 사용자 에이전트 위장으로 정책 문제가 해결됐다고 기록하지 않는다.

### C. 별도 후속 범위

TypeScript/Effect 웹백 운영 전환, PostgreSQL·MCP 운영 통합은 이번 정적 웹·Foundation 작업으로 수행되지 않았다. [기존 서비스 허브 인수인계](../SERVICE_HUB_2026-09-28.md)의 범위를 먼저 읽고 실제 백엔드 상태를 새로 확인한다. 이전 Python 운영 경로나 DB를 은퇴시킬 근거로 이 문서를 사용하지 않는다.

## 5. 재검증과 그래프 계약

앞선 03:45 UTC 로컬 Chromium 검사는 1440·768·390·320px, axe 28회 위반 0건,
콘솔 오류 0건이었다. 이는 보존된 이전 실행 요약이며 이번 인수인계에서 브라우저 검사를
다시 실행한 것으로 기록하지 않는다. 현재 HTTP 관측과 CI 조회는 별도 시각으로 기록했다.

공개 응답을 확인하는 최소 명령:

```sh
curl -sS -D - -o /dev/null https://metahumotonic.com/foundation/
curl -sS -D - -o /dev/null https://metahumotonic.com/foundation/graph.jsonld
curl -sS -D - -o /dev/null https://metahumotonic.com/foundation/usl.json
```

운영자가 원본 URL을 지정한 환경에서 기존 검증기를 사용한다. 소스 변경 후 전체 재검증은 저장소의 Node 지침에 따라 `npm run verify`와 `npm run verify:build-trace`를 사용한다.

```sh
bash scripts/deploy/verify-live.sh "$ORIGIN_URL"
python3 scripts/verify/learning_publication.py --base-url "$ORIGIN_URL" --expected-publication dist/learn/publication.json
```

두 번째 명령은 검사하려는 릴리스의 `dist/learn/publication.json`이 준비돼 있을 때 실행한다. 임의의 로컬 산출물과 다른 운영 릴리스를 비교하지 않는다.

인수인계 그래프의 식별자는 `urn:metahumotonic:handoff:foundation:2026-09-29`다. 파일 경로나 배포 위치가 바뀌어도 이 ID와 공개 개체 ID를 유지한다. 체크섬은 관측 JSON에 보관한다. 새 KG label/관계는 등록하지 않았다.

| 관계 | 이 문서의 domain → range / 개수 | 의미 |
|---|---|---|
| schema:about | CreativeWork → 대상 Thing / 1..n | 문서가 설명하는 대상 |
| schema:hasPart | 인수인계 문서 → 주장·열린 해석 문서 / 1..n | 문서 구성 관계 |
| schema:potentialAction | 운영 설정 → Action / 0..n | 아직 수행되지 않은 후속 작업 |
| schema:object | Action → 대상 설정·공개 자원 / 1..n | 작업 대상, 접근 권한 아님 |
| schema:subjectOf | Action → 근거 문서 / 1..n | 작업이 기술된 관측 근거 |
| prov:wasDerivedFrom | Entity → 출처 Entity / 1..n | 파생 근거, 동일성 아님 |
| prov:used | 관측 Activity → 사용한 Entity / 1..n | 관측 입력 |
| prov:wasGeneratedBy | 관측 근거 Entity → Activity / 1 | 관측 산출 관계 |
| prov:wasAttributedTo / wasAssociatedWith | Entity 또는 Activity → Agent / 1 | 작성·관측 주체 |
| schema:actionStatus | Action → PotentialActionStatus / 1 | 미완료 작업 상태 |

표의 개수는 해당 관계를 가진 노드에 적용하는 로컬 계약이며 모든 클래스 인스턴스에
속성 존재를 강제하지 않는다.

`mh:authority`와 `mh:status`는 기존 공개 projection의 메타데이터 이름을 재사용한다. 이 문서의 업무 상태 문자열은 로컬 상태이며 KG의 ACTIVE 관계 판정이나 정전 승인이 아니다. 닫힌 작업과 열린 작업을 같은 성공 상태로 합치지 않는다.

검증 질문은 “무엇이 배포됐는가”, “어떤 원문·리비전에 근거하는가”, “MIME 수정 대상과 완료 조건은 무엇인가”, “무엇이 아직 해석·후속 작업인가”, “KG/백엔드 전환까지 완료됐는가”다. JSON 구문, RDF 파싱, ID 고유성, 참조 무결성, 열린 작업의 대상·근거·상태를 확인한다. RDF 파싱 성공만으로 SHACL·OWL 또는 전체 표준 적합성 인증을 주장하지 않는다.

이번 인수인계 검증은 PASS다. 25개 개체 ID, 41개 참조, 2개 열린 작업의 대상·근거·상태,
위 다섯 확인 질문과 문서의 로컬 링크를 검사했다. RDFLib는 142개 quad를 읽었고,
그중 명명 그래프 내부는 139개 triple이다. 코드 변경이 없는 기록 작업이므로 제품 전체
테스트를 재실행한 것으로 주장하지 않는다.

- 인수인계 JSON-LD SHA-256: `215d67aeb2f811426cb652e8a97eab684c94eb5c0fed3f311a39da5a77d785c6`
- 검증 관측 JSON SHA-256: `2769c0d2c64410e4a477d68931f6f77edd1507be21a8ae015c22a3633751419f`

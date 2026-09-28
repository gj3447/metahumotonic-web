# 프로젝트 · 사도 · 선의 공리로 이어지는 회사 웹

2026-09-27 사용자 요청에 따라 세 항목을 대표 메뉴와 홈의 주요 진입점으로 구성했다.
밝은 회사 웹 디자인, 기존 CMYW 네 고리 심볼, 제품·연구 소개를 유지하고 사도와
철학을 같은 시각 체계에 연결했다. 이번 문서는 앞선 회사 홈 구현 이후의 확장이다.

## 공개 구성

| 경로 | 내용 |
|---|---|
| `/` | Ultra Safety AI 사명, 세 가지 주요 입구, 제품·연구, 철학·사도·공리, GitHub·영상 |
| `/projects/` | 9개 공개 프로젝트의 소개와 검색, 상태, 관련 자료 |
| `/apostles/` 및 각 상세 | 12사도의 편집 소개, 기존 공개 본문, 위키의 본질·역할·출처 |
| `/axioms/` | 12개 정의의 원문, 영문 미러, 각 정의의 고정 앵커와 출처 |
| `/philosophy/` | 선의 공리 → 사도와 세계관 → 회사 사명 |
| `/agents/` | Ultra Safety AI 사명과 Agent의 실행 방향, 자유·경제·합의, 관련 연구 |
| `/learn/` | 개념·사도·프로젝트·코드·영상의 공개 읽기 지도 |

Ultra Safety AI를 기존 공식 명칭으로 유지했다. Ultra Safety Agent는 공개 헌장의
에이전트 관점을 정리한 설명이다. 공식 명칭 변경, 제품 출시, 권리 체계의 구현 완료나
안전 인증을 주장하지 않는다. 9번은 기존 공개판의 예수 항목이며 아텐과 합치지 않는다.
사도는 세계관 속 존재로 모델링하고 직원이나 SoftwareApplication으로 바꾸지 않는다.

`axioms.json` 원문은 수정하지 않았다. 사도 소개는 `apostle-introductions.json`에
EDITORIAL_SUMMARY로 분리했다. 과거 데이터시트의 내부 경로·외부 기술 비유·미검토
제안 배열을 새 소개의 사실 주장으로 승격하지 않는다. 기존 상세 URL과 Wiki 원문
경로를 유지하며 별도 소유의 `ontology.ttl`을 덮어쓰지 않았다.

## 의미 연결

백엔드 `ts/config/learning-hub.json`을 검증·투영해 고정한 공개 그래프:
**51개 항목, 79개 방향 관계, 6개 읽기 경로**. 홈·학습 UI·JSON-LD·USL은 같은
sourceDigest를 사용한다. 개별 페이지의 mainEntity도 동일한 HTTPS IRI를 가리킨다.

- JSON-LD 1.1: 문맥을 인라인 고정해 외부 문맥 조회 없이 해석한다.
- Schema.org: WebSite/Organization/WebPage, 원문·프로젝트·영상·코드 타입과 about 관계.
- SKOS: 개념의 한국어 prefLabel, PRIMARY_SOURCE 정의의 정확한 definition.
- PROV: 소개와 관계의 출처. 읽기 추천을 동일성·인과·구현 의존성으로 해석하지 않는다.
- USL property-graph/v2: 같은 노드 ID와 방향·상태·출처·관계 설명을 보존한다.
- SHACL 및 독립 Python 검사: 누락된 출처와 관계 상태, 뒤집힌 방향, 원문 변조,
  문맥 재정의, 사라진 HTML 앵커를 거부한다.

INTRODUCES는 소개 페이지에서 항목으로 향하는 안내 관계다. 공개 페이지의 `about`으로
투영한다. 사도와 같은 이름의 프로그램을 `sameAs`로 합치지 않는다. 표준 형식으로
연결 가능한 공개 읽기 그래프이며 GEIP 인증이나 자동 추론 시스템 완성 주장은 아니다.

기준 문서: [W3C JSON-LD 1.1](https://www.w3.org/TR/json-ld11/),
[SKOS](https://www.w3.org/TR/skos-reference/), [SHACL](https://www.w3.org/TR/shacl/),
[PROV-O](https://www.w3.org/TR/prov-o/), [Schema.org about](https://schema.org/about).

## 검증과 실제 배포

- 프런트엔드 Node 테스트 81개, Python 공개본/배포/복구 테스트 21개 통과.
- 백엔드 learning-hub 및 platform HTTP/MCP 테스트 37개 통과.
- TypeScript·빌드·45개 기존 source binding의 drift·독립 build-trace 게이트 통과.
- 1440/768/390/320px, 키보드·터치·JS 없는 읽기, 200% 글자 확대 확인.
- 홈·목록·사도·공리·철학·Agent·사도 상세·읽기 지도 axe 검사 16회에서 위반 0건.
  실제 스크린리더 전체 검사나 WCAG 인증을 뜻하지 않는다.
- RDF named graph 1,275 triples + SHACL 반례 2개, 실제 USL 어댑터 51/79 항목 통과.
- 실제 브라우저로 공개 HTTPS 홈을 열고 주요 메뉴를 확인했다.

운영 VM100의 원래 서빙 경로에 2026-09-27 13:47 UTC 배포했다. 검토된 로컬 작업
트리의 정적 산출물을 SHA-256으로 고정해 활성화했다. GitHub main/deploy 브랜치에
작업 트리를 밀어 넣은 배포는 아니며, 작업 트리는 아직 커밋되지 않았다.

아티팩트: `01de03b23cff30dd0dbeaa9ba437798cba36f969a6bf90dc3e30827d5c6c80ef`.
의미 원본: `sha256:5933313125cc604c8ba3d4a017c17e6a1b6690878369b1282d0f38d8655a71e1`.

이전 릴리스와 Nginx/배포 도구를 운영 경로의 `operations/company-semantic-20260927-<artifact>`에
보관했다. Nginx는 기존 프록시 설정을 유지하고 공개 JSON-LD 경로의 MIME만 추가했다.
기존 배포 도구에는 독립 해시가 필요한 로컬 아티팩트 모드와 동시 실행 잠금을 추가했다.
활성화 전 의미 검사, 활성화 후 실제 응답 해시 검사, 실패 시 이전 버전 복구는 공통이다.
타이머를 복원했으며 같은 deploy commit을 재검사해 새 릴리스가 유지됨을 확인했다.
로컬 모드는 `last_commit`(마지막 처리한 GitHub deploy commit)을 바꾸지 않고 별도의
`manual-artifact`를 기록한다. 다음 새로운 GitHub deploy commit은 정상 배포 흐름을 따른다.

공개 HTTPS에서 45개 HTML·JSON·JSON-LD·CSS·JS 파일을 다시 읽어 보관한 산출물의
바이트 해시와 대조했다. `public-company-semantic-2026-09-27.json`의 모든 파일이
HTTP 200 및 동일 해시이며 JSON-LD MIME도 확인했다. Python 기본 User-Agent 요청은
공개 경계에서 403이었으므로 공개 readback에는 일반 curl 클라이언트를 사용했다.
실제 Chromium에서도 새 사이트를 확인했다.

이번 운영 배포는 정적 웹만 대상으로 한다. 백엔드 API 서버·DB 마이그레이션·서비스
트래픽 전환은 실행하지 않았다.

증거:
- `docs/evidence/semantic-company-browser-2026-09-27.json`
- `docs/evidence/public-company-semantic-2026-09-27.json`
- `docs/evidence/company-semantic-activation-2026-09-27.log`
- 백엔드 `docs/evidence/learning-rdf-2026-09-27-r2.json`, `learning-usl-2026-09-27-r2.json`

스크린샷: `/tmp/mh-semantic-browser-final/`, 공개 홈 `/tmp/mh-semantic-live-home.png`.

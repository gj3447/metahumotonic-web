# 서비스 허브 · 2026-09-28

`https://metahumotonic.com/services/`는 공개 제품·연구·철학·코드·도구 자료의 사람용 입구다. 기존 회사 웹의 밝은 Workbench 디자인을 재사용하고, 홈·상단 메뉴·모바일 메뉴·하단 메뉴에서 한 번에 열 수 있다. `/developers/`는 공개 API·JSON-LD·USL의 시각적 안내, `/mcp/`는 등록 상태를 단정하지 않는 MCP 발견 안내다. 공개 `/api/`는 `/developers/`로 302 안내하며 개별 `/api/*`의 기계 응답은 유지한다.

## 공개 범위와 상태

- 공개 링크 14개는 확인된 URL만 싣는다. 수풀림은 프로젝트 사이트, 333은 알파 범위 페이지로 연결한다. 프로젝트 9개의 소개는 모두 열 수 있지만, 버엑시·메이플리니지 등 공개 실행 URL이 검증되지 않은 작업에는 실행 버튼을 만들지 않았다.
- KG·USL, Web Back, PostgreSQL, MCP·서버 운영은 역할만 소개한다. 공개 디렉터리는 사내 관리 주소나 권한을 제공하지 않는다. 운영 Python API와 Wiki·ontology 위임 경로는 현재 사용 중이므로 유지한다. TypeScript Web Back은 전환 후보이며 이 정적 웹 배포로 운영 백엔드가 바뀌지 않는다.
- MCP 공개 discovery/manifest/status API는 유지한다. 배포 확인 시 실운영 레지스트리 등록 수는 0이었다. 화면은 서버 가용성을 추측하지 않고 응답으로 확인하도록 안내한다.

## 의미 그래프

`src/lib/service-directory.ts` 한 소스에서 화면, `/services/data.json`, `/services/graph.jsonld`, `/services/usl.json`을 만든다. 공개 진입점 14개·프로젝트 소개 9개·내부 역할 설명 4개와 허브를 합쳐 USL 노드 28개, 방향 관계 27개다. 내부 역할 노드에는 접속 locator가 없다. JSON-LD는 Schema.org와 PROV 식별자를 사용하고, RDF 파서는 238개 트리플을 읽었다. 관계 `DISCOVERS`는 공개 이동, `INTRODUCES`는 프로젝트 소개, `DESCRIBES_INTERNAL`은 역할 설명이며 어느 것도 실시간 건강 상태나 실행 권한을 뜻하지 않는다. 기존 `/learn/`의 51개 항목·79개 관계 학습 그래프는 별도 정전·자료 경계로 유지한다.

## 은퇴 처리

- 참조가 없는 `index.astro.bak-cheap-20260408`와 `cosmos.css.bak-cheap-20260408`, 빌드에서 이미 막던 `333-legacy.astro` 소스를 제거했다. 실제 `/compute/`, `/333/`, `/book/333/`는 유지한다.
- 2026-04 정적 인프라 지도 `/api/services.json`은 후속 `/services/data.json`을 가리키는 퇴역 응답으로 바꿨다. 오래된 호스트·포트·관리 화면 목록을 더 이상 내보내지 않는다.
- 운영 MCP에는 등록 서버가 없는데 15개 서버를 제시하던 `/mcp/manifest.json` 정적 스냅샷을 퇴역 표지로 교체했다. `/mcp/llms.txt`의 공용 비밀번호·vault 접속 절차도 제거했다. 백엔드의 live discovery/manifest/status는 그대로다.
- 공개 `/llms.txt`는 이 정적 웹이 아닌 별도 기존 라우트가 응답한다. 저장소의 정적 원본에서 오래된 MCP 지침을 정리했지만 공개 `/llms.txt`의 바이트 변경으로 주장하지 않는다. 새 MCP 화면은 해당 경로 대신 검토된 `/services/data.json`을 안내한다.
- DGX·OMD 퇴역 기록은 운영 증거로 남기고, Python 레거시 도메인은 현재 의존성이 있어 삭제하지 않았다.

## 검증과 배포

Astro 빌드, TypeScript 검사, 전체 릴리스 테스트, 학습 그래프 독립 검증, Longinus 45개 소스 해시 검사, 실제 Chromium 1440/768/390/320px 확인을 통과했다. 24회 axe 검사에서 위반 0건, 가로 넘침·콘솔 오류 0건이었다. 새 릴리스 도구는 서비스 허브 파일과 MCP 정적 퇴역 표지가 없으면 활성화를 거부한다.

VM100의 기존 정적 웹 릴리스 경로에 해시 고정 산출물 `d790bb5f96f474f580fc64e28ef51c0470c1fdaafd1115d492829bd71a40f20e`를 2026-09-28 01:22 UTC 활성화했다. 운영 타이머는 활성 상태다. 공개 HTTPS에서 10개 핵심 HTML·JSON·JSON-LD·텍스트 파일을 로컬 산출물과 바이트 단위로 비교했고 `/services/graph.jsonld`는 `application/ld+json`으로 응답했다. 이전 릴리스와 Nginx 설정은 운영 `operations/`에 보관했다. 이 배포는 정적 웹과 그 Nginx 라우팅만 대상으로 하며 백엔드·DB 트래픽 전환은 수행하지 않았다.

검증 영수증: [`evidence/service-hub-2026-09-28.json`](evidence/service-hub-2026-09-28.json).

## UI·UX 후속 검토 · 02:07 UTC

외부 기준으로 [WCAG 2.2의 reflow·키보드 초점·포인터 대상](https://www.w3.org/TR/wcag/), [USWDS의 카드 사용 지침](https://designsystem.digital.gov/components/card/), [헤더 탐색 지침](https://designsystem.digital.gov/components/header/)과 [현재 위치·짧은 메뉴 지침](https://designsystem.digital.gov/components/side-navigation/)을 확인했다. 이는 설계 검토 기준이며 실제 사용자 조사를 했다는 뜻은 아니다.

배포 화면을 다시 살펴 모바일의 7~10px 그래프 레이블과 긴 페이지의 분야 이동, 프로젝트의 공개 실행 경로 구분이 약한 점을 발견했다. 모바일 그래프를 읽을 수 있는 2×2 표제로 바꾸고 12px 레이블을 유지했다. 50px 높이의 분야 메뉴는 모바일에서 따라오며, 목적지 제목을 가리지 않도록 간격을 뒀다. 프로젝트 카드에는 `공개 사이트`·`알파 체험`·`소개 페이지`를 글자로 표시하고 본문 크기를 올렸다. 데스크톱·모바일 상단에 철학 링크를 추가하고, 푸터의 YouTube는 실제 채널로 연결하며 영상 읽기 지도는 별도 링크로 구분했다.

최종 정적 아티팩트 `beccfbc31f851a895915cd7ff759b7d562ba79daf95f0ea06cf06b9cc7782063`을 VM100에 2026-09-28 02:07 UTC 활성화했다. 전체 릴리스 테스트와 1440·768·390·320px Chromium 검사를 통과했다. 24회 axe 검사에서 위반 0건, 가로 넘침·콘솔 오류 0건이며, 모바일 분야 이동이 고정 메뉴에 가려지지 않는 것도 확인했다. 공개 HTTPS의 핵심 HTML·그래프·스타일시트 11개를 산출물과 바이트 단위로 비교했다. 자동 접근성 검사와 내부 화면 검토만으로 실제 사용자 과업 성공률을 단정하지 않는다.

후속 검증 영수증: [`evidence/service-ux-2026-09-28.json`](evidence/service-ux-2026-09-28.json).

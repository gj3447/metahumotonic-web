# 홈 의미 그래프 시뮬레이션 · 2026-09-28

후속 04:49 UTC 배포에서 수풀림 경로를 추가해 현재 홈 그래프는 9개 노드·8개 방향 관계·4개 경로가 되었다. 수풀림의 수학 체험은 [후속 기록](SOOPOOLIM_MATH_EXPERIENCE_2026-09-28.md)을 참조한다. 아래는 04:01 UTC 첫 릴리스의 기록이다.

공개 홈페이지의 [`/#semantic-simulation`](https://metahumotonic.com/#semantic-simulation)은 메타휴모토닉의 철학이 세계관, 제품, AI 연구로 이어지는 관계를 선택해서 읽는 시뮬레이션이다. 화면의 8개 노드와 7개 방향 관계는 `src/data/learning-hub.json`의 공개 노드와 `ACTIVE` 관계에서만 구성한다. 표시된 관계는 원문을 따라가는 편집된 읽기 경로이며 실시간 운영 상태, 인과 증명, 실행 권한을 뜻하지 않는다. KG 전체를 직접 조회하는 운영 그래프 UI가 아니다.

세 경로는 철학 → 선의 공리 → 12사도, 철학 → 프로젝트 → 버엑시, 철학 → Ultra Safety AI → USL → HSWM이다. `src/lib/meaning-simulation.ts`가 공개·같은 출처 URL과 활성 방향 관계를 검증하고, Astro가 기본 경로를 서버에서 렌더링한다. 자바스크립트가 없으면 선택 링크는 `/learn/`의 해당 항목으로 이동한다. 모바일에서는 그래프 대신 경로의 순서를 읽을 수 있는 작은 트랙을 보여준다. 서비스 허브에서도 이 체험으로 연결한다.

그래픽은 선택할 때만 선과 항목에 한 번 움직임을 준다. 자동 재생은 없고 Escape, 탭 숨김, `prefers-reduced-motion`에서 움직임을 중지한다. 외부 요청과 워커를 만들지 않는다. 이 방식은 [W3C의 움직이는 콘텐츠 제어 기준](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide), [동작 줄이기 기법](https://www.w3.org/WAI/WCAG22/Techniques/css/C39), [브라우저 애니메이션 성능 지침](https://web.dev/articles/animations-guide)을 검토해 정했다.

Astro 빌드, 전체 릴리스 테스트, TypeScript 검사, 45개 Longinus 소스 해시 검사와 Chromium 1440·768·390·320px 검증을 통과했다. 24회 axe 검사에서 위반 0건이며 가로 넘침, 페이지 오류, 워커, 외부 요청이 없었다. 자동 검사 결과가 모든 사용자 경험을 보증하는 것은 아니다.

해시 고정 정적 산출물 `63e707abefe8f96713ddc323670a046c2ec4c77432a1d67f63b16f070ed1a22f`를 2026-09-28 04:01 UTC 운영 VM100에 활성화했다. 공개 HTTPS에서 홈·서비스·학습 HTML, 학습 JSON-LD와 홈의 5개 CSS/JS 파일이 산출물과 바이트 단위로 일치했다. 공개 Chromium에서 AI 경로의 4단계 선택 및 페이지 오류 0건을 확인했다. 이 배포는 정적 웹 릴리스이며 `metahumotonic_web_back`의 API, PostgreSQL 또는 MCP 런타임 전환은 포함하지 않는다.

검증 영수증: [`evidence/meaning-simulation-2026-09-28.json`](evidence/meaning-simulation-2026-09-28.json).

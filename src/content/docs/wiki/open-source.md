---
title: 오픈소스 기반
description: MetaHumotonic Wiki의 오픈소스 구성, 편집 원장, 라이선스 경계
---

MetaHumotonic Wiki는 닫힌 SaaS 위키가 아닙니다. 읽기 UI는
[Astro Starlight](https://starlight.astro.build/)를 사용하고, 커뮤니티 편집 원장과
Web·REST·CLI·MCP 어댑터는
[metahumotonic_web_back](https://github.com/gj3447/metahumotonic_web_back)에 공개합니다.

## 무엇을 재사용하고 무엇을 직접 만들었나

- Starlight: 문서 레이아웃, 접근성, 반응형 탐색, 정적 검색
- FastAPI·PostgreSQL: 공개 API와 원자적 event/revision 저장
- 공식 MCP Python SDK: 에이전트용 stdio 도구 서버
- MetaHumotonic 함수형 엔진: `command → decide → event → evolve → effect`와 검증 가능한 FSM

MediaWiki나 Wiki.js 전체를 포크하지 않은 이유는 편집 권한과 KG 정전 승인을 같은 것으로
취급할 수 없기 때문입니다. 대신 검증된 오픈소스 부품을 사용하면서, revision 충돌·권위·KG
검토 경계는 작은 함수형 커널로 공개하고 Web·CLI·MCP가 그 한 원장을 공유하게 했습니다.

## 두 원장은 섞이지 않습니다

- [/wiki/](/wiki/)는 사용자 원문과 KG allowlist를 빌드한 읽기 전용 정전 투영입니다.
- [/wiki/community/](/wiki/community/)는 누구나 revision을 제안하는 COMMUNITY 원장입니다.
- `KG 검토 요청`은 정확한 revision을 대기열에 넣을 뿐, KG 정전을 자동으로 바꾸지 않습니다.

엔진 계약과 FSM은
[`docs/wiki-engine`](https://github.com/gj3447/metahumotonic-web/tree/main/docs/wiki-engine),
API·CLI·MCP 운영 계약은
[`docs/WIKI.md`](https://github.com/gj3447/metahumotonic_web_back/blob/main/docs/WIKI.md)에서 볼 수 있습니다.

## 라이선스

- 위키 UI와 정적 사이트 코드는 [MIT](https://github.com/gj3447/metahumotonic-web/blob/main/LICENSE)
- 네트워크 백엔드·함수형 커널·CLI·MCP는
  [GNU AGPL-3.0-only](https://github.com/gj3447/metahumotonic_web_back/blob/main/LICENSE)
- MetaHumotonic 원문·시각물·온톨로지·KG 데이터는 저작권이 성립하는 범위에서
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Starlight 0.41.7의 MIT 고지는 저장소의
  [`LICENSES/STARLIGHT-0.41.7-MIT.txt`](https://github.com/gj3447/metahumotonic-web/blob/main/LICENSES/STARLIGHT-0.41.7-MIT.txt)에 보존됩니다.

[Community Wiki 참여하기](/wiki/community/)

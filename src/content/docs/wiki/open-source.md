---
title: 오픈소스 기반
description: MetaHumotonic Wiki가 사용하는 오픈소스 위키 UI와 라이선스 경계
---

MetaHumotonic Wiki의 탐색, 문서 레이아웃, 반응형 사이드바, 접근성, 정적 검색은
[Astro Starlight](https://starlight.astro.build/) 0.41.7을 기반으로 합니다.
Starlight는 MIT 라이선스 오픈소스이며 이 사이트의 Astro 7 빌드에 통합됩니다.

## 왜 별도 편집형 CMS가 아닌가

이 프로젝트에서 콘텐츠의 정본은 Neo4j Knowledge Graph와 사용자 원문입니다. 별도 위키
DB에서 같은 내용을 다시 편집하면 어느 쪽이 최신인지 판별할 수 없는 이중 정본이 생깁니다.
따라서 Starlight는 **읽기·검색·탐색 표면**을 맡고, 공개 데이터는 KG allowlist가 공급합니다.

## 라이선스

- 위키 UI 코드와 운영 코드는 [MIT](https://github.com/gj3447/metahumotonic-web/blob/main/LICENSE)
- MetaHumotonic 원문·시각물·온톨로지·KG 데이터는 저작권이 성립하는 범위에서
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Starlight 0.41.7의 MIT 고지는 저장소의
  [`LICENSES/STARLIGHT-0.41.7-MIT.txt`](https://github.com/gj3447/metahumotonic-web/blob/main/LICENSES/STARLIGHT-0.41.7-MIT.txt)에 보존됩니다.

[위키 홈으로 돌아가기](/wiki/)

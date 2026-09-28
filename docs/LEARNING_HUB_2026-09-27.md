# 처음 방문하는 사람을 위한 학습 허브

> 초기 19개 항목의 로컬 구현 기록이다. 현재 51개 항목·79개 관계의 공개 그래프와
> 실제 운영 배포는 [후속 기록](SEMANTIC_COMPANY_WEBSITE_2026-09-27.md)을 따른다.

홈의 `처음이라면 여기부터`에서 네 질문을 고르고, `/learn/`에서 개념·원문·프로그램·
GitHub·YouTube를 이어 읽는다. 기존 숯빛·연두색 작업실 디자인에 책의 목차 같은
행 구성을 더했다. 그림으로 표현한 기존 프로젝트 개념도와 출처 있는 읽기 관계는 구분한다.

`src/data/learning-hub.json`은 회사 백엔드의 검증된 공개 원본에서 생성한 산출물이다.
직접 편집하지 않고 백엔드 `ts/config/learning-hub.json`을 수정한 뒤
`ts/scripts/export-learning-hub.mjs`로 갱신한다. 동반 백엔드 문서는
`metahumotonic_web_back/docs/LEARNING_HUB.md`에 있다.

화면, `/learn/data.json`, `/learn/graph.jsonld`, `/learn/usl.json`은 동일한
`sourceDigest`를 공유한다. 빌드는 운영 API·비공개 KG·MCP 토큰에 의존하지 않는다.
영상은 사용자가 링크를 누를 때 YouTube로 이동하며 방문 시 외부 플레이어나 추적
요청을 만들지 않는다. 실제 채널의 게시 목록에서 제목·영상 ID를 확인했다.

관계마다 방향과 읽기 이유가 있다. `EXPLORE_NEXT`는 편집 추천, `SOURCE_CODE`는
원본 저장소 연결, `PUBLISHES`는 채널 게시 관계다. JSON-LD 문맥·어휘 설명·RDF 진술과
USL 의미 설명에 상태와 출처가 남는다. 기존 철학 원문을 다시 정의하지 않는다.

```sh
bash scripts/with-node.sh npm run build
bash scripts/with-node.sh npm run test:release
MH_QA_OUTPUT=/tmp/metahumotonic-hub-qa bash scripts/with-node.sh npm run test:workbench:browser
bash scripts/with-node.sh npm run verify:drift
bash scripts/with-node.sh npm run verify:build-trace
```

QA는 1440/768/390/320px, JS 없는 읽기, 키보드 disclosure와 관계 이동, 검색·필터·
빈 결과·초기화, 200% 글자 확대, reduced motion, 외부 요청/worker 부재를 확인한다.
JSON-LD MIME은 Nginx에서도 `application/ld+json`으로 설정했다.
홈·필수 배포 경로·Nginx의 의도된 변경 세 곳만 Longinus 파일 해시를 갱신했다.
로컬 변경이며 운영 홈페이지에 게시했다는 의미는 아니다.

## 공개본을 독립적으로 검증하는 게이트

빌드 마지막 단계가 `dist/learn/publication.json`을 생성한다. 원본 digest와 홈·학습
화면·catalog·JSON-LD·USL의 바이트 SHA-256 다섯 개를 고정한다. manifest는 서명이나
PASS 판정이 아니며, `scripts/verify/learning_publication.py`가 별도로 실제 파일을
읽어 관계 의미·방향·출처·상태·HTML 앵커와 검토한 생성 원본까지 대조한다.

`npm run test:release`에는 이 검증과 Python 반례/복구 테스트가 포함된다. 따라서
기존 CI의 tar 포장 전에 실행된다. 테스트는 뒤집힌 USL, 사라진 RDF 주장, JSON-LD
문맥 재정의, 누락된 앵커, HTTP 200의 오래된 응답, 잘못된 MIME을 거부해야 한다.
배포 테스트는 임시 파일·loopback HTTP·가짜 Docker로 실제 shell 스크립트를 실행한다.
재시작 실패, 잘못된 readback, 활성화 전 거부, 이전 공개본으로 복구, 성공 후 상태
기록을 확인한다. 실제 VM100/Docker 동작을 측정했다는 주장은 아니다.

```sh
# 이미 빌드된 공개본과 반례를 검증한다. Python 3.10+ 표준 라이브러리만 필요하다.
bash scripts/with-node.sh npm run verify:learning-publication
# 운영/stage 읽기 검증에는 별도로 확보한 예상 manifest를 반드시 전달한다.
python3 scripts/verify/learning_publication.py \
  --base-url http://STAGE_ORIGIN:PORT \
  --expected-publication /path/to/reviewed-release/learn/publication.json
```

origin에서 받은 manifest를 그 origin의 검증 기준으로 다시 신뢰하지 않는다. GET은
홈과 `/learn/`의 실제 방문 경로 및 세 데이터 경로를 읽으며 redirect, 잘못된 MIME,
예상 해시 불일치를 실패로 처리한다. 바이트 변환이 있는 CDN의 동일성은 별도 범위다.

VM100에 적용할 때는 **아직 실행하지 않은 다음 준비**가 필요하다:

1. 검증기를 `install -D -m 0644 scripts/verify/learning_publication.py /usr/local/lib/metahumotonic/learning_publication.py`로 설치한다.
2. origin Nginx에 이 저장소의 `application/ld+json` 매핑을 반영한다. 정적 tar를 교체해도 컨테이너 설정은 바뀌지 않는다.
3. 갱신한 `scripts/deploy/pve-release.sh`를 기존 release 서비스 위치에 설치하고 stage readback부터 확인한다.

배포기는 unpack된 공개본을 먼저 검증한 뒤 current를 바꾸고 재시작한다. 이후 HTTP
readback이 실패하면 이전 공개본의 manifest로 복구를 확인한다. 허브 도입 이전 릴리스는
기존 home/wiki 복구 검사를 사용하지만, 허브가 있는 릴리스의 manifest 누락은 실패다.
재시작 또는 검증이 실패하면 마지막 성공 커밋 기록을 갱신하지 않는다.

# 12사도 공개 그래프

`/apostles/graph.jsonld`는 기존 공개 사도 설명과 문서들의 연결 데이터다.
`src/lib/apostle-graph.ts`가 명시적으로 허용한 공개 필드만 출력한다.
Neo4j UID, 내부 ontology snapshot, 비공개 원문은 입력으로 사용하지 않는다.

- 12개 공개 개념은 기존 `/learn/#entity-apostle-N` IRI를 재사용한다.
- 각 개념은 `skos:Concept`이며, `skos:OrderedCollection`에 순서대로 속한다.
- 사도·위키 페이지는 별도 `schema:WebPage`이고 `schema:about`으로 개념을 가리킨다.
- 공개 출처는 `prov:wasDerivedFrom`으로 연결한다. 소개의 권위는 `EDITORIAL_SUMMARY`다.
- 9번은 기존 공개판의 예수 항목이다. 범위 설명을 유지하며 아텐이나 내부 미결
  자리와 `sameAs`/`exactMatch`를 만들지 않는다.
- `schema:version`의 digest는 공개 행의 `JSON.stringify` UTF-8 바이트 기준이다.
  파일 전체 또는 RDF canonicalization digest가 아니다.

내부 탐색기는 별도 키로 백엔드 `/api/v1/ontology/apostles`를 읽고 release
digest·자리 식별자·연결 범위를 검사한다. 선택된 노드와 미결 후보 모두에서
공개 문서를 참고할 수 있지만 미결 후보를 선택하거나 키를 문서 링크에 넣지 않는다.
새 endpoint가 먼저 배포되어야 새 탐색기가 연결된다. snapshot의 발행 범위는
`INTERNAL_ONLY` 그대로다.

전체 KG → manifest → API → 웹 계약은 `metahumotonic_web_back` 저장소의
`docs/APOSTLE_WEB_GRAPH.md`에 있다. 원본 KG 쓰기와 공개 배포는 별도 작업이다.

## 검증

```sh
./scripts/with-node.sh npm run build
./scripts/with-node.sh npm run test:apostle-graph
```

두 번째 명령은 빌드된 페이지의 식별자·링크, 내부 탐색기의 release 검사,
RDFLib JSON-LD 파싱, 실제 [SHACL shape](apostles.shacl.ttl)를 검증한다.
12개 개념에서 올바른 두 문서와 출처를 찾고, 잘못된 endpoint·중복·권위 승격·
동일성 선언을 넣은 네 가지 변형이 실패하는지도 확인한다.
Python 의존성은 검증 스크립트에 고정되어 있으며 `uv`가 필요하다.
이 검사는 `test:release`와 CI에 포함된다.

사용 어휘: [SKOS](https://www.w3.org/TR/skos-reference/),
[PROV-O](https://www.w3.org/TR/prov-o/), [SHACL](https://www.w3.org/TR/shacl/).
검증 결과는 이 공개 RDF 산출물과 shape 범위에 한정된다.

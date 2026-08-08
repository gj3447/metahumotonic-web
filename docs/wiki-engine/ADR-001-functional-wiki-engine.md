# ADR-001: 함수형 revision/event 위키 엔진

- 상태: **DRAFT REFERENCE KERNEL — NOT DEPLOYED**
- 작성일: 2026-08-08
- 적용 대상: `metahumotonic.com/wiki`
- 정전 영향: 없음. 이 문서와 코드는 커뮤니티 위키 메커니즘 초안이며 KG 정전을 변경하지 않는다.

## 결론

위키는 충분히 동적으로 만들 수 있다. 현재 `/wiki`가 정적인 이유는 위키 엔진이어서가 아니라, Astro가 빌드 때 만든 **read-only KG publication projection**이기 때문이다. 현재 코드에는 사용자 신원, 편집 API, revision 저장소, 충돌 처리, diff, 최근 변경이 없다.

새 쓰기 경로는 TypeScript의 함수형 코어로 만든다.

```text
decide(state, command) -> events | typed rejection
evolve(state, event)   -> next immutable state | throw on an invalid stored event
effects(event)         -> data-only effect intents
```

실제 event 처리 경계는 `step(state, event)`다. 유효 event면 다음 state와 effect intent를 함께 돌려주고, 불가능 event면 state를 그대로 보존하면서 `AuditInvalidTransition` intent를 돌려준다. 상태만 필요한 `evolve`와 stream `replay`는 불가능 event를 예외로 중단해 손상된 history를 조용히 통과시키지 않는다.

HTTP, 세션, CSRF, DB transaction, 검색, 렌더링, KG 적용은 코어 밖 port다. 콘텐츠 SHA-256 검산은 결정적 계산이므로 코어가 직접 수행한다. 함수형이라는 말은 특정 함수형 언어를 강제한다는 뜻이 아니라, 상태 전이와 부수효과의 경계를 코드로 강제한다는 뜻이다.

## 왜 엔진인가

단순 CRUD module로 두기에는 다음 의미론을 여러 소비자가 공유해야 한다.

- 편집 API는 동시 편집 충돌을 같은 방식으로 거부해야 한다.
- history, recent changes, backlinks, search는 같은 event stream에서 재구축돼야 한다.
- 중복 command와 중복 effect는 재시도 뒤에도 결과가 같아야 한다.
- 웹 편집, 독립 reviewer, USER_PRIMARY 승인, 격리된 KG publisher가 자격증명을 공유하지 않고 같은 revision/hash를 가리켜야 한다.

반대로 위키가 계속 read-only라면 이 엔진은 과설계다. 그 경우 현재 정적 projection module로 되돌리는 것이 이 ADR의 명시적 falsifier다.

## 선행 엔진에서 가져온 의미론

MediaWiki는 매 편집을 revision으로 보존하고, revision에 작성자·시각·편집 요약·부모 revision·content hash를 둔다. `recentchanges`는 영구 history와 별개인 투영이다. 이 구분을 그대로 채택한다. [MediaWiki revision table](https://www.mediawiki.org/wiki/Manual:Revision_table)

MediaWiki 편집 API도 `baserevid` 또는 base timestamp로 충돌을 탐지한다. 이 커널에서는 더 직접적으로 `expectedHeadRevisionId`가 현재 head와 같을 때만 `RevisionCommitted`를 만든다. [MediaWiki Edit API](https://www.mediawiki.org/wiki/API:Edit)

Event sourcing의 append-only stream, optimistic concurrency, replay projection, idempotent handler 원칙을 저장 계약에 채택한다. Snapshot은 가속기일 뿐 정본을 대체하지 않는다. [Microsoft Event Sourcing pattern](https://learn.microsoft.com/azure/architecture/patterns/event-sourcing)

Reducer는 입력 state와 event만으로 새 값을 만들고 기존 값을 mutate하거나 HTTP·시간·난수를 호출하지 않는다. [Redux reducer rules](https://redux.js.org/tutorials/fundamentals/part-3-state-actions-reducers)

경로 측면에서 MediaWiki는 script를 `/w`에 두고 문서를 `/wiki/Page_title`로 노출할 수 있다. 완제품 채택 시 유효한 후보지만, KG 권한 경계는 별도 adapter가 여전히 필요하다. [MediaWiki short URL](https://www.mediawiki.org/wiki/Manual:Short_URL/wiki/Page_title_--_no_root_access)

Wiki.js는 공식 요구사항상 dedicated domain/subdomain을 전제하며 `/wiki` subfolder mapping을 지원하지 않는다. 현재 정확한 경로 요구에는 맞지 않는다. [Wiki.js requirements](https://beta.js.wiki/docs/requirements)

따라서 지금의 결정은 “오픈소스 엔진을 영구 배제”가 아니다. 먼저 프로젝트 고유의 revision·KG authority 계약을 고정하고, 이후 MediaWiki를 UI/runtime으로 채택할지 이 커널 위에 얇은 앱을 만들지 같은 conformance test로 비교한다.

## 경계

엔진이 소유하는 것:

- 커뮤니티 page별 단일 append stream
- immutable revision과 parent chain
- command/event/state schema version
- page lifecycle과 KG proposal lifecycle
- optimistic head check와 typed rejection
- deterministic effect intent

엔진 밖에 두는 것:

- 로그인 공급자, session, CSRF
- 누가 어떤 capability를 받는지에 대한 운영 정책
- Markdown/wikitext renderer와 HTML sanitization
- 욕설·스팸·문서 namespace 정책
- USER_PRIMARY의 실제 의미 판단
- KG 쓰기와 exact readback
- 익명 공개 snapshot의 별도 승인

웹 프로세스는 raw Cypher와 KG canon publisher credential을 절대 갖지 않는다.

## 두 개의 직교 FSM

한 개의 거대한 “wiki state” FSM은 삭제 상태와 심사 상태를 섞어 조합 폭발을 만든다. 그래서 page lifecycle과 proposal workflow를 직교 상태로 둔다. 여기에 `lastAppliedCanon`을 별도 projection으로 보존해 community head가 바뀌어도 마지막 USER_PRIMARY canon binding이 사라지지 않게 한다.

### 1. Page lifecycle

| 현재 | event | 다음 | guard |
|---|---|---|---|
| `absent` | `PAGE_CREATED` | `active` | 유효한 최초 revision |
| `active` | `REVISION_COMMITTED` | `active` | parent가 현재 head와 일치 |
| `active` | `PAGE_DELETED` | `deleted` | expected head 일치 |
| `deleted` | `PAGE_RESTORED` | `active` | 보존된 head 일치 |

삭제는 history 삭제가 아니라 tombstone이다. 복구는 과거 revision을 덮어쓰지 않는다.

### 2. KG canon workflow

```text
unsubmitted
  -> in_review
  -> review_approved       독립 reviewer의 기술·내용 검토
  -> canon_authorized      exact USER_PRIMARY approval receipt
  -> canon_applied         격리 publisher의 exact KG readback receipt
```

`in_review`는 `rejected`로 갈 수 있다. 새 revision이나 community page 삭제는 `in_review`, `review_approved`, `rejected` proposal만 `superseded`로 만든다. 아직 USER_PRIMARY가 승인하지 않은 후보가 낡았다는 뜻이다.

`canon_authorized`와 `canon_applied`는 일반 `wiki:edit` 권한으로 supersede할 수 없다. USER_PRIMARY 승인은 exact revision/hash에 계속 결박되고, 늦게 도착한 publisher readback도 기록된다. 새 community head는 마지막 적용 canon과 병존한다. `canon_applied` 상태에서 새 head를 제출하면 새 proposal workflow가 시작되지만 `lastAppliedCanon` receipt는 그대로 남는다. USER_PRIMARY 승인을 취소하려면 별도 revoke command와 receipt가 필요하며, 이 reference slice에는 아직 없다.

Reviewer 승인과 정전 승인은 다른 사건이다. `review_approved`는 여전히 non-canon이다. `canon_authorized`도 실제 적용 전에는 non-canon이다. 오직 정확한 적용 후 readback receipt가 기록돼야 `canon_applied`다. community head, 마지막 적용 canon, 익명 공개 snapshot도 서로 다른 값이며 익명 공개 승인은 이 FSM 밖의 독립 gate다.

두 machine은 terminal state가 없다. 위키는 계속 편집되며 삭제·거절·supersede도 복구 가능한 운영 상태이기 때문이다.

기계 정본은 [fsm-spec.json](./fsm-spec.json), trace는 [fsm-traces.json](./fsm-traces.json), 생성 diagram은 [fsm-diagram.mmd](./fsm-diagram.mmd)다.

## command, event, effect

현재 reference slice의 command:

- `CreatePage`
- `CommitRevision`
- `DeletePage`, `RestorePage`
- `SubmitForKgReview`
- `ApproveKgProposal`, `RejectKgProposal`
- `AuthorizeKgCanonApplication`
- `RecordKgCanonApplication`

ID와 시각은 코어가 만들지 않는다. application shell이 command에 넣는다. 코어는 body의 SHA-256을 다시 계산해 command의 선언값과 다르면 event를 만들지 않는다.

Event append 자체는 effect가 아니다. 다음 세 항목을 한 transaction으로 commit하는 것이 command의 완료 경계다.

1. 새 domain events
2. command id/fingerprint와 원래 decision receipt
3. event에서 파생된 outbox intents

검색·backlink·render·recent changes·KG publisher는 outbox를 처리한다. effect id는 `eventId + index`로 결정돼 중복 전달을 흡수한다.

## 저장 계약

Production adapter는 최소 다음 원자성을 제공해야 한다.

```text
load stream at version N
  -> decide
  -> append only if version is still N
  -> store command receipt
  -> store effect outbox
COMMIT
```

2026-08-08 read-only audit 시 기존 FastAPI backend는 wiki route, 사용자 session/RBAC, CSRF, migration이 없고 production MongoDB는 standalone이었다. Standalone Mongo에서 별도 event·receipt·outbox collection을 다중 문서 transaction으로 묶을 수 없으므로 현재 상태로는 production write adapter가 될 수 없다.

선택지는 두 가지다.

- MongoDB를 replica set으로 바꾸고 transaction + compare-and-set stream version을 사용한다.
- 별도 transactional PostgreSQL event store를 두고 FastAPI가 typed port로 접근한다.

어느 쪽이든 backup/restore와 replay receipt가 통과하기 전에는 편집 버튼을 공개하지 않는다. 현재 reference용 immutable memory store는 transaction 의미론을 보여주는 모델이지 durable DB가 아니다.

Reference memory adapter의 command fingerprint는 canonical JSON의 SHA-256이다. Production adapter도 원문 payload 대신 이 cryptographic fingerprint와 원래 decision receipt를 저장해야 한다.

## 외부 KG 적용 경쟁 조건

`canon_authorized` outbox가 실행되는 동안 새 wiki revision이 commit될 수 있다. 이것은 취소 경쟁이 아니다. USER_PRIMARY가 승인한 exact revision/hash는 community head와 독립적이므로 publisher는 그 승인본을 적용하고 `lastAppliedCanon`에 readback을 기록할 수 있다.

아직 닫히지 않은 경쟁은 **향후 USER_PRIMARY revoke와 이미 실행 중인 publisher** 사이에 있다. 서로 다른 저장소인 wiki event store와 Neo4j를 한 transaction으로 묶을 수 없으므로, revoke를 추가할 때는 다음 중 하나의 검증된 protocol이 필요하다.

- 짧고 bounded한 page별 publication lease 동안 append를 직렬화하고, lease token·stream version·revision/hash를 KG receipt에 함께 결박한다.
- KG 적용 뒤 authorization/revocation stream을 다시 확인하고 revoke와 엇갈렸으면 반드시 보상 proposal을 내는 reconciliation protocol을 둔다. 이 경우 중간 상태가 public release로 나가지 않도록 별도 gate가 막아야 한다.

lease 만료, worker crash, revoke, 늦게 도착한 성공 응답까지 fault injection으로 통과해야 한다. 현재는 revoke 자체가 미구현이므로 `ApplyKgCanonRevision` intent를 실제 Neo4j adapter에 연결하지 않는다.

## 현재 구현

- [core.ts](../../src/lib/wiki-engine/core.ts): `decide`, `evolve`, `replay`, `effects`
- [types.ts](../../src/lib/wiki-engine/types.ts): readonly tagged unions와 versioned protocol
- [memory-store.ts](../../src/lib/wiki-engine/memory-store.ts): immutable command receipt/idempotency/outbox model
- [projections.ts](../../src/lib/wiki-engine/projections.ts): history, recent changes, wiki-link/backlink projection
- [wiki-engine.test.ts](../../tests/wiki-engine.test.ts): 충돌·replay·권한 분리·supersede 검증
- [engine-spec.json](./engine-spec.json): machine-readable engine contract

구현됐다는 뜻:

- 순수 커널과 reference memory transaction이 실행된다.
- revision history, recent changes, backlinks는 event replay로 재구축된다.
- stale edit, duplicate command, self-review, 승인 단계 건너뛰기가 typed rejection으로 막힌다.
- revision ID 재사용과 불가능 event replay가 fail-closed로 막힌다.
- revision author/time과 reviewer/authorizer/publisher provenance가 event envelope와 다르면 replay가 중단된다.
- community head와 `lastAppliedCanon`이 독립적으로 보존된다.

아직 구현되지 않았다는 뜻:

- 로그인·편집 UI·diff UI·discussion·watchlist
- durable DB/API/outbox worker
- global slug unique reservation과 실제 stream-version compare-and-set
- 실제 KG proposal/publisher adapter
- USER_PRIMARY revoke command와 cross-store publisher lease·late-success reconciliation protocol
- `/api/wiki` ingress와 배포

## 정적 사이트를 프로그램으로 바꾸는 기능군

다음 화면은 모두 같은 event core 위에 만들 수 있다.

1. **문서 편집·미리보기**: base revision을 들고 저장하며 충돌 시 두 revision을 비교한다.
2. **역사·diff·rollback**: rollback은 과거 row를 덮는 동작이 아니라 과거 content를 새 head revision으로 commit한다.
3. **최근 변경·watchlist**: 영구 revision과 별도 projection으로 빠르게 읽는다.
4. **역링크·고립 문서·관계 그래프**: `[[link]]` projection과 KG 관계를 나란히 보여준다.
5. **토론 문서**: 본문과 별도 stream으로 주장, 반론, 해결 상태를 보존한다.
6. **권위 배지**: `COMMUNITY`, `KG_PROPOSAL`, `REVIEW_APPROVED`, `CANON_APPLIED`, `PUBLIC_RELEASED`를 같은 색으로 뭉개지 않는다.
7. **KG 영향 반경**: 수정하려는 entity가 어떤 사도·공리·논문·코드 binding에 영향을 주는지 제출 전에 보여준다.
8. **근거 묶음 편집기**: 문장마다 source ref와 content hash를 붙여 proposal에 함께 제출한다.
9. **AI 초안 보조**: AI 결과는 별도 `SECONDARY_AI` draft로만 들어오며 사람이 revision으로 채택하기 전에는 본문이 아니다.
10. **두 판 비교**: community head, last reviewed revision, canon-applied revision을 한 화면에서 비교한다.

이 기능들은 랜딩 페이지 장식이 아니라 저장된 state와 event를 바꾸는 프로그램 동작이다.

## 최소 배포 순서

1. transactional datastore와 schema migration을 고른다.
2. `EventStore.commit(expectedVersion, events, receipt, outbox)` contract test를 먼저 통과시킨다.
3. FastAPI에 session/RBAC/CSRF가 적용된 typed `/api/wiki/commands`와 read projections를 추가한다.
4. 기존 canonical projection 경로와 충돌하지 않는 `/wiki/community/:slug`, `/edit`, `/history`, `/diff`, `/wiki/recent-changes`를 progressive hydration으로 붙인다. Astro global base는 바꾸지 않는다.
5. 공개 editor를 열기 전 concurrent edit, duplicate request, XSS, CSRF, backup/restore, replay를 검증한다.
6. KG adapter는 별도 작업으로 preview/submit/readback까지만 먼저 연결한다. 정전 적용은 USER_PRIMARY 승인과 격리 publisher가 준비된 뒤 활성화한다.

## 채택 기준

이 ADR은 reference kernel에 대한 설계 결정이다. Production 채택은 다음이 모두 참일 때만 가능하다.

- event/receipt/outbox atomic commit 검증
- replay 결과와 live projection hash 일치
- 사용자 auth/RBAC/CSRF와 renderer sanitization 검증
- 동일 command의 중복 효과 0건
- 웹 배포물에서 canon credential 부재 확인
- exact USER_PRIMARY approval과 KG readback을 건너뛸 경로 0건
- authorization/revoke·lease 만료·publisher late success 경쟁에서 잘못된 canon 적용 0건

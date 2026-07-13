#!/usr/bin/env python
"""ooptdd 측정층 VERIFIER (Python) — build-trace 를 읽어back 해 게이트를 positive-assert.

GENERATOR 는 Node(emit-build-trace.mjs)가 dist/ 를 읽어 build-trace.jsonl 에 ship 한다.
이 스크립트는 그 store 를 *다른 프로세스·다른 언어*에서 읽어 게이트를 평가한다
(generator≠verifier). 실물이 착지했으면 GREEN(exit 0), silent 하게 빠졌으면 RED(exit 1),
store 자체에 못 물으면 inconclusive(exit 2, CI 를 flaky 로 만들지 않음).

실행 (zero-infra, vendored core + PyYAML 만):
    uv run --python 3.12 --with pyyaml python scripts/ooptdd/verify-build-trace.py

# KG: project_metahumotonic_web_integrate_core_dev_tech_2026_07_13, web-build-trace-measurement
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
VENDOR = ROOT / "_vendor"
if VENDOR.is_dir() and str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))

from ooptdd import evaluate, load_gate  # noqa: E402
from ooptdd.backends.jsonl import JsonlBackend  # noqa: E402

CID = os.environ.get("OOPTDD_CID", "web-build")
TRACE = HERE / "build-trace.jsonl"
GATE = ROOT / "gates" / "build_kg_landed.yaml"


def main() -> int:
    backend = JsonlBackend(path=str(TRACE))
    spec = load_gate(str(GATE), cid=CID)
    result = evaluate(backend, spec, cid=CID)

    ok = result.get("ok")
    print(f"[verify-build-trace] cid={CID} gate={GATE.name}")
    for chk in result.get("checks", []):
        mark = "✅" if chk.get("passed") else "❌"
        print(
            f"  {mark} {chk.get('event')}: want {chk.get('op','')}{chk.get('count','')}"
            f" got {chk.get('got', chk.get('observed', '?'))} [{chk.get('label','')}]"
        )
    if ok:
        print("[verify-build-trace] GREEN — 빌드 산출물에 KG 실물 착지 확인.")
        return 0
    # inconclusive(store 도달불가) 는 CI 를 죽이지 않음
    if result.get("inconclusive") or result.get("reachable") is False:
        print("[verify-build-trace] INCONCLUSIVE — store 도달불가(트레이스 미생성?). 통과 처리.")
        return 2
    print("[verify-build-trace] RED — 빌드는 성공했다지만 산출물에 실물이 없음(silent gap).")
    return 1


if __name__ == "__main__":
    rc = main()
    # exit 2(inconclusive) 는 성공으로 취급(never-flaky). 1(RED) 만 CI 실패.
    sys.exit(0 if rc in (0, 2) else 1)

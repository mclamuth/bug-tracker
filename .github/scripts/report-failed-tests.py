"""Turns failed tests in .trx files into GitHub annotations, so failures show on the PR without opening the log."""

import pathlib
import sys
import xml.etree.ElementTree as ET

NS = {"t": "http://microsoft.com/schemas/VisualStudio/TeamTest/2010"}


def escape(text: str) -> str:
    # Workflow-command escaping: %, CR and LF must be encoded.
    return text.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


failures = 0
for trx in sorted(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "TestResults").rglob("*.trx")):
    root = ET.parse(trx).getroot()
    for result in root.iterfind(".//t:UnitTestResult", NS):
        if result.get("outcome") != "Failed":
            continue
        failures += 1
        message = result.findtext(".//t:ErrorInfo/t:Message", default="", namespaces=NS).strip()
        stack = result.findtext(".//t:ErrorInfo/t:StackTrace", default="", namespaces=NS).strip()
        body = f"{message}\n\n{stack}"[:4000]
        print(f"::error title={escape(result.get('testName', 'test'))}::{escape(body)}")

    # Errors outside any one test (a fixture that fails to start or clean up, a crashed test host).
    counters = root.find(".//t:ResultSummary/t:Counters", NS)
    outcome = root.find(".//t:ResultSummary", NS)
    summary = f"{trx.parent.name}: {outcome.get('outcome') if outcome is not None else '?'}"
    if counters is not None:
        summary += ", " + ", ".join(f"{k} {counters.get(k)}" for k in ("total", "passed", "failed", "error"))
    print(f"::notice title=Test run summary::{escape(summary)}")
    for info in root.iterfind(".//t:ResultSummary/t:RunInfos/t:RunInfo", NS):
        text = (info.findtext("t:Text", default="", namespaces=NS) or "").strip()
        if text:
            failures += 1
            print(f"::error title=Test run ({info.get('outcome', '')})::{escape(text[:4000])}")

print(f"{failures} problem(s) found.")

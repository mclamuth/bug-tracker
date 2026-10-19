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

print(f"{failures} failed test(s).")

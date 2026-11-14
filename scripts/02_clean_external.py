"""Validate the hand-entered non-PSI tests (data/manual/external_tests.csv) against
their primary sources, convert units, and write data/processed/external_tests.json.

Checks (any failure aborts; hand-entered numbers are never silently accepted):
- every ' | '-separated part of `quote` is an exact substring of the source text
  (whitespace-normalised: PDF extraction breaks lines inside table cells);
- Saffire rows: O2, pressure and flow equal the values parsed from Table 1 in the
  sample's own column.
"""
from __future__ import annotations

import csv
import json
import re
import sys

from pypdf import PdfReader

from _common import PSI_TO_KPA, ROOT, write_json

TO_KPA = {"kPa": 1.0, "atm": 101.325, "psi": PSI_TO_KPA}
MOON_O2_MIN, MOON_P_MAX_KPA = 30.0, 10.2 * PSI_TO_KPA

norm = lambda s: re.sub(r"\s+", " ", s).strip()
sources = json.loads((ROOT / "data/manual/sources.json").read_text())
errors: list[str] = []


def source_text(sid: str, page: str) -> str:
    s = sources[sid]
    path = ROOT / s["file"]
    if not path.exists():
        sys.exit(f"{s['file']} missing: run scripts/01_fetch_refs.py")
    if path.suffix == ".pdf":
        return norm(PdfReader(path).pages[int(page) - 1].extract_text())
    return norm(json.loads(path.read_text())["abstract"])


def saffire_table1() -> dict[str, dict[str, str]]:
    t = source_text("saffire_ices2024", "3")
    cols = re.search(r"Flight/Sample ((?:[IVX]+-\d ?){5})", t).group(1).split()
    row = lambda label: re.search(re.escape(label) + r" ((?:[\d.]+ ?){5})", t).group(1).split()
    vals = {"p": row("Ambient Pressure (kPa)"), "o2": row("Oxygen Concentration (mol %)"),
            "flow": row("Air Flow Rate (cm/s)")}
    return {c: {k: v[i] for k, v in vals.items()} for i, c in enumerate(cols)}


def kpa(value: str, unit: str) -> tuple[float, str]:
    f = TO_KPA[unit]
    k = round(float(value) * f, 2)
    return k, (f"{value} kPa" if unit == "kPa" else f"{value} {unit} x {f} = {k} kPa")


table1 = saffire_table1()
out = []
for r in csv.DictReader(open(ROOT / "data/manual/external_tests.csv", newline="")):
    text = source_text(r["source_id"], r["page"] or "0")
    for part in r["quote"].split(" | "):
        if norm(part) not in text:
            errors.append(f"{r['id']}: quote not found in source: {part!r}")
    if r["program"] == "Saffire":
        t = table1.get(r["sample"])
        if not t or float(t["o2"]) != float(r["o2_pct"]) or float(t["p"]) != float(r["pressure_as_stated"]) \
                or float(t["flow"]) != float(r["flow_cm_s"]):
            errors.append(f"{r['id']}: values differ from Table 1 column {r['sample']}: {t}")

    o2s = [float(x) for x in r["o2_pct"].split(";")]
    ps = [kpa(x, r["pressure_unit"]) for x in r["pressure_as_stated"].split(";")]
    src = sources[r["source_id"]]
    rec = {
        "id": r["id"], "program": r["program"], "mission": r["mission"], "sample": r["sample"] or None,
        "material": r["material"], "kind": r["kind"],
        "o2_pct": o2s, "o2_as_stated": r["o2_pct"].split(";"), "o2_basis": r["o2_basis"],
        "pressure_kpa": [p for p, _ in ps], "pressure_conversion": [c for _, c in ps],
        "flow_cm_s": float(r["flow_cm_s"]) if r["flow_cm_s"] else None, "flow_direction": r["flow_direction"],
        "in_moon_zone": any(o >= MOON_O2_MIN and p <= MOON_P_MAX_KPA for o in o2s for p, _ in ps),
        "notes": r["notes"] or None,
        "source": {"doc": src["citation"], "short": src["short"], "locator": r["locator"],
                   "printed_page": int(r["page"]) if r["page"] else None, "quote": r["quote"],
                   "file": "data/manual/external_tests.csv", "url": src["url"]},
    }
    if r["kind"] == "point":
        assert len(o2s) == 1 and len(ps) == 1, r["id"]
        rec["po2_kpa"] = round(o2s[0] / 100 * ps[0][0], 2)
    out.append(rec)

if errors:
    print("\n".join(errors))
    sys.exit(1)

write_json("external_tests.json", {
    "schema": 1,
    "tests": out,
    "sources": {k: {kk: v[kk] for kk in ("citation", "short", "gives", "does_not_give")} for k, v in sources.items()},
    "unit_notes": [
        "1 atm = 101.325 kPa; 1 psi = 6.894757 kPa.",
        "O2 mol % equals vol % for ideal-gas mixtures, so Saffire (mol %) and BASS-II (% by vol) share one axis. SSCE does not state its basis.",
    ],
})

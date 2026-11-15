"""ACME CFI-G (PSI-159) normal flames -> data/processed/cfig_tests.json, plus the O2 atmosphere sweep
(data/manual/o2_atmosphere_sweep.csv) -> data/processed/o2_sweep.json. Pure rules, no LLM.

Question answered here: is a table's O2 the atmosphere AROUND the flame, or the oxidizer flowing out of a burner?
- CFI-G Normal Flames: "XO2 before test" is the chamber atmosphere. Evidence, all checked below (build fails otherwise):
  1. it is logged before AND after each test ("XO2  after test"),
  2. each test's after-value equals the next test's before-value on the same day (O2 consumed run by run),
  3. the burner carries fuel ("Xf"); the Inverse table instead logs the CHAMBER fuel before/after and one fixed XO2,
  4. the inverse XO2 maximum is 0.85, matching the brief's "up to 85% oxygen flowed from the spherical burner".
- Gas flames, not solids: drawn as their own Panel 1 layer, never counted in the solid-material headline.
"""
from __future__ import annotations

import csv
import glob
import re
import sys
from pathlib import Path

from _common import PSI_TO_KPA, ROOT, write_json

RAW = ROOT / "data/raw"
NORMAL = RAW / "PSI-159/PSI-159_Experimental table_CFI-G_Normal Flames.csv"
INVERSE = RAW / "PSI-159/PSI-159_Experimental table_CFI-G_Inverse Flames.csv"
SWEEP = ROOT / "data/manual/o2_atmosphere_sweep.csv"
BRIEF = ROOT / "docs/ref/challenge_brief.md"
ZONE_O2, ZONE_P = 30.0, round(10.2 * PSI_TO_KPA, 2)
BAR_TO_KPA = 100.0
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
rel = lambda p: str(p.relative_to(ROOT))
problems: list[str] = []


def num(s):
    try:
        return float((s or "").strip())
    except ValueError:
        return None


def read(path):
    rows = list(csv.reader(path.read_bytes().decode("utf-8-sig").splitlines()))
    return rows[0], rows[1:]


def chain(rows, col_before, col_after, col_day):
    """Count consecutive same-day pairs where after(n) == before(n+1), as written in the file."""
    pairs = same = 0
    for a, b in zip(rows, rows[1:]):
        if a[col_day] != b[col_day]:
            continue
        pairs += 1
        same += a[col_after].strip() == b[col_before].strip()
    return pairs, same


def normal_flames():
    head, rows = read(NORMAL)
    col = {h: i for i, h in enumerate(head)}
    need = [" XO2 before test", "XO2  after test", "approx p (bar)", "Xf", "Day", "Fuel", "Test", "Hot ignition", "Cool flame?", "burn time (sec)", "Comments"]
    if missing := [h for h in need if h not in col]:
        problems.append(f"Normal Flames: columns missing {missing}")
        return None
    pairs, same = chain(rows, col[" XO2 before test"], col["XO2  after test"], col["Day"])
    if same < 0.8 * pairs:
        problems.append(f"Normal Flames: XO2 after->before chain holds for only {same}/{pairs} pairs; ambient reading not supported")
    tests, skipped = [], []
    for line, r in enumerate(rows, start=2):
        g = lambda h: r[col[h]].strip()
        o2, p = num(g(" XO2 before test")), num(g("approx p (bar)"))
        if o2 is None or p is None:
            skipped.append({"test": g("Test"), "line": line, "issue": "missing XO2 or pressure"})
            continue
        o2p, pk = round(o2 * 100, 2), round(p * BAR_TO_KPA, 2)
        tests.append({
            "id": g("Test"), "o2_raw": g(" XO2 before test"), "day": g("Day"), "fuel": g("Fuel"), "o2_pct": o2p, "o2_after_pct": num(g("XO2  after test")) and round(num(g("XO2  after test")) * 100, 2),
            "p_bar": p, "pressure_kpa": pk, "po2_kpa": round(pk * o2p / 100, 2), "burner_fuel_frac": num(g("Xf")),
            "hot_ignition": g("Hot ignition"), "cool_flame": g("Cool flame?"), "burn_time_s": num(g("burn time (sec)")), "comment": g("Comments"),
            "in_moon_zone": o2p >= ZONE_O2 and pk <= ZONE_P,
            "source": {"file": rel(NORMAL), "line": line},
        })
    return tests, skipped, {"pairs": pairs, "chained": same}


def inverse_check():
    head, rows = read(INVERSE)
    col = {h: i for i, h in enumerate(head)}
    for h in ("Xf  before test", "Xf  after test", "XO2"):
        if h not in col:
            problems.append(f"Inverse Flames: column {h!r} missing")
            return None
    xo2 = [v for r in rows if (v := num(r[col["XO2"]])) is not None]
    pairs, same = chain(rows, col["Xf  before test"], col["Xf  after test"], col["Day"])
    if max(xo2) != 0.85:
        problems.append(f"Inverse Flames: max XO2 {max(xo2)} != 0.85 (brief says 'up to 85%')")
    return {"file": rel(INVERSE), "tests": len(rows), "xo2_max_pct": round(max(xo2) * 100, 1), "chamber_fuel_chain": {"pairs": pairs, "chained": same}}


def sweep():
    brief = ws(BRIEF.read_text(encoding="utf-8"))
    out = []
    for r in csv.DictReader(open(SWEEP, encoding="utf-8")):
        pid = r["psi_id"]
        table = RAW / r["file"]
        if not table.exists():
            problems.append(f"sweep {pid}: table {r['file']} not on disk")
            continue
        if r["evidence_where"] == "table":
            raw = table.read_bytes()
            try:
                text = ws(raw.decode("utf-8-sig"))
            except UnicodeDecodeError:
                text = ws(raw.decode("cp1252"))
            where = [rel(table)]
        elif r["evidence_where"] == "metadata":
            files = [Path(f) for f in glob.glob(str(RAW / pid / "*" / "i_Investigation.txt"))]
            text = " ".join(ws(f.read_text(encoding="utf-8-sig")) for f in files)
            where = [rel(f) for f in files]
        else:
            text, where = brief, [rel(BRIEF)]
        if not where or ws(r["evidence_quote"]) not in text:
            problems.append(f"sweep {pid} {r['table']}: quote not found in {r['evidence_where']} ({where})")
        out.append({**r, "file": rel(table), "evidence_file": where[0] if where else None})
    return out


def main():
    res = normal_flames()
    inv = inverse_check()
    sw = sweep()
    if problems or res is None:
        print("\n".join("FAIL " + p for p in problems))
        sys.exit(1)
    tests, skipped, ch = res
    zone = [t for t in tests if t["in_moon_zone"]]
    write_json("cfig_tests.json", {
        "schema": 1, "psi_id": "PSI-159", "count": len(tests), "tests": tests, "skipped": skipped,
        "material_class": "gas flames (spherical porous burner, fuel flowing out), not solid materials",
        "o2_kind": "ambient (chamber atmosphere before the test)",
        "evidence": {
            "columns": "\"XO2 before test\" and \"XO2  after test\" are logged per test; the burner carries fuel (\"Xf\").",
            "chain": ch, "inverse": inv,
            "brief_quote": "the combustion chamber was filled with a mixture of nitrogen and a flammable gas (e.g., propane), while an oxygen-nitrogen mixture of up to 85% oxygen flowed from the spherical burner creating an inside-out flame",
            "brief_reading": "That sentence describes the INVERSE flames. In normal flames the roles swap: fuel flows from the burner into an O2/N2 chamber.",
        },
        "moon_zone": {"count": len(zone), "ids": [t["id"] for t in zone], "o2_min_pct": ZONE_O2, "p_max_kpa": ZONE_P,
                      "days": sorted({t["day"] for t in zone}, key=int), "fuels": sorted({t["fuel"] for t in zone}),
                      "hot_ignition": {v: sum(t["hot_ignition"] == v for t in zone) for v in sorted({t["hot_ignition"] for t in zone})},
                      "o2_range_pct": [min(t["o2_pct"] for t in zone), max(t["o2_pct"] for t in zone)] if zone else None,
                      "pressure_kpa": sorted({t["pressure_kpa"] for t in zone})},
        "units": {"pressure": "approx p (bar) in source; kPa = bar x 100", "o2": "mole fraction in source; % = x100"},
    })
    write_json("o2_sweep.json", {"schema": 1, "question": "Is this O2 the atmosphere around the flame, or the oxidizer flowing out of a burner?",
                                 "rows": sw, "source": rel(SWEEP)})
    print(f"cfig       {len(tests)} normal-flame tests, {len(zone)} in Moon-base zone; chain {ch['chained']}/{ch['pairs']}; inverse max XO2 {inv['xo2_max_pct']}%")


if __name__ == "__main__":
    main()

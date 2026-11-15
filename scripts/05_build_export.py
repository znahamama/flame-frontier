"""Evidence export -> data/processed/export/ (served at /data/export/). No LLM, no new values.

Challenge objective 2: "Extract data that supports predictive modeling of flammability and fire scenarios".
This packs the tests the Evidence Map places into plain CSV, one row per test, each row keeping its provenance:
- tests.csv                 every test drawn on Panel 1 (Saffire per-test points, BASS-II, FLEX, CFI-G normal flames)
- ssce_ranges.csv           SSCE O2/pressure SETS (NASA does not pair them, so they never become test rows)
- bass2_boundary_points.csv the Panel 2 points (BASS-II eq. 6.1 comparison) with stretch rate and post-burn O2
- README.md                 generated data dictionary: columns, counts, caveats, citations
Values are copied from the processed JSON the charts read; nothing is recomputed except the pass-through
Moon-base flag for BASS-II (all at 1 atm, so outside the zone by the same rule as Panel 1).
"""
from __future__ import annotations

import csv
import io
import json

from _common import PROCESSED, ROOT

P = PROCESSED
OUT = P / "export"
load = lambda n: json.loads((P / n).read_text(encoding="utf-8"))

DATE_FLAG = {"gmt_mismatch": "date and GMT day-of-year disagree (flagged, not fixed)", "year_suspect": "date year looks wrong (flagged, not fixed)"}

TEST_COLS = [
    ("row", "Row number in this file"),
    ("program", "Investigation or flight series"),
    ("psi_id", "NASA PSI investigation ID (empty: values from a cited paper, not PSI)"),
    ("psi_doi", "DOI of the PSI data set, from its ISA-Tab metadata"),
    ("test_id", "Test identifier as written in the source"),
    ("fuel_state", "solid / liquid / gas"),
    ("material_or_fuel", "Sample material, or fuel for droplets and gas flames"),
    ("gravity", "Gravity level of the test"),
    ("o2_pct", "Oxygen, % (mole % = volume % for an ideal gas)"),
    ("o2_reading", "Which O2 reading this is (initial, chamber before test, as stated in a paper)"),
    ("o2_basis", "Basis or calibration note from the source"),
    ("pressure_kpa", "Total pressure, kPa"),
    ("pressure_basis", "Measured per test, or stated once for the whole investigation"),
    ("flows_cm_s", "Airflow speeds recorded for the test, cm/s, separated by ';' (empty: none recorded)"),
    ("flow_basis", "Where the flow comes from"),
    ("outcome", "Outcome field as recorded (empty: not stated)"),
    ("in_moon_base_window", "yes if O2 >= 30% and pressure <= 70.33 kPa (challenge page: 30% or greater, 10.2 psi or less)"),
    ("notes", "Notes from the source or our cleaning (empty: none)"),
    ("source", "File and line (PSI table) or document, table and page (paper)"),
]


def csv_text(cols, rows):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(cols)
    for r in rows:
        w.writerow(["" if r.get(c) is None else r.get(c) for c in cols])
    return buf.getvalue()


def write(name, text):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    if path.exists() and path.read_text(encoding="utf-8") == text:
        print(f"unchanged  {path.relative_to(ROOT)}")
    else:
        path.write_text(text, encoding="utf-8")
        print(f"wrote      {path.relative_to(ROOT)}")


def fnum(x):
    return "" if x is None else (f"{x:.4f}".rstrip("0").rstrip("."))


def main():
    ext, bass2, flex, cfig, cat, ref = (load(n) for n in ("external_tests.json", "bass2_tests.json", "flex_tests.json", "cfig_tests.json", "catalog.json", "reference.json"))
    doi = {i["psi_id"]: (i["fields"].get("doi") or {}).get("value") for i in cat["investigations"]}
    zone = ref["panel1"]["moon_base_zone"]
    inz = lambda o2, p: "yes" if (o2 is not None and p is not None and o2 >= zone["o2_min_pct"] and p <= zone["p_max_kpa"]) else "no"
    rows = []

    for t in ext["tests"]:
        if t["kind"] != "point":
            continue
        s = t["source"]
        rows.append({"program": t["mission"], "psi_id": "", "psi_doi": "", "test_id": t["sample"], "fuel_state": "solid", "material_or_fuel": t["material"],
                     "gravity": "microgravity", "o2_pct": fnum(t["o2_pct"][0]), "o2_reading": "as stated in the paper", "o2_basis": t["o2_basis"],
                     "pressure_kpa": fnum(t["pressure_kpa"][0]), "pressure_basis": f"as stated in the paper ({t['pressure_conversion'][0]})",
                     "flows_cm_s": fnum(t["flow_cm_s"]), "flow_basis": f"paper, {t['flow_direction'].lower()} flow", "outcome": "", "notes": t.get("notes") or "",
                     "in_moon_base_window": "yes" if t["in_moon_zone"] else "no",
                     "source": f"{s['short']}, {s['locator']}, p.{s['printed_page']} ({s['file']})"})

    for t in bass2["tests"]:
        if t["o2_initial_pct"] is None:
            continue
        clean = t["air_display"]["status"].startswith("clean")
        flows = [s["cm_s"] for s in t["air_display"]["steps"] if s.get("cm_s") is not None] if clean else []
        rows.append({"program": "BASS-II", "psi_id": "PSI-25", "psi_doi": doi.get("PSI-25"), "test_id": t["id"], "fuel_state": "solid",
                     "material_or_fuel": f"{t['geometry']['label']} ({t['geometry']['material_raw'].strip()})", "gravity": "microgravity",
                     "o2_pct": fnum(t["o2_initial_pct"]), "o2_reading": "initial", "o2_basis": t["o2_basis"],
                     "pressure_kpa": fnum(t["pressure_kpa"]), "pressure_basis": t["pressure_basis"],
                     "flows_cm_s": ";".join(fnum(f) for f in flows),
                     "flow_basis": "Air display, duct flow cm/s (BASS-II FAQ); crew-noted steps in order" if flows else f"not parsed (Air display: \"{t['air_display']['raw']}\")",
                     "outcome": t["outcome"]["value"].replace("_", " "), "notes": "; ".join(DATE_FLAG.get(f, f) for f in t.get("date_flags") or []), "in_moon_base_window": inz(t["o2_initial_pct"], t["pressure_kpa"]),
                     "source": f"{t['source']['file']}, line {t['source']['line']}"})

    for t in flex["tests"]:
        rows.append({"program": "FLEX", "psi_id": "PSI-69", "psi_doi": doi.get("PSI-69"), "test_id": t["id"], "fuel_state": "liquid",
                     "material_or_fuel": f"{t['fuel']} droplet", "gravity": "microgravity", "o2_pct": fnum(t["o2_pct"]), "o2_reading": "initial ambient",
                     "o2_basis": t["o2_basis"], "pressure_kpa": fnum(t["pressure_kpa"]), "pressure_basis": f"measured per test ({fnum(t['pressure_mmhg'])} mmHg)",
                     "flows_cm_s": "", "flow_basis": "not recorded", "outcome": t["test_end"], "in_moon_base_window": "yes" if t["in_moon_zone"] else "no",
                     "source": f"{t['source']['file']}, line {t['source']['line']}"})

    for t in cfig["tests"]:
        rows.append({"program": "ACME CFI-G (normal flames)", "psi_id": "PSI-159", "psi_doi": doi.get("PSI-159"), "test_id": t["id"], "fuel_state": "gas",
                     "material_or_fuel": f"{t['fuel']} (spherical burner)", "gravity": "microgravity", "o2_pct": fnum(t["o2_pct"]),
                     "o2_reading": "chamber atmosphere before test (XO2 before test)", "o2_basis": f"mole fraction {t['o2_raw']} x 100",
                     "pressure_kpa": fnum(t["pressure_kpa"]), "pressure_basis": f"approx {fnum(t['p_bar'])} bar, per test", "flows_cm_s": "",
                     "flow_basis": "not recorded", "outcome": f"hot ignition: {t['hot_ignition']}" if t.get("hot_ignition") else "", "notes": t.get("comment") or "",
                     "in_moon_base_window": "yes" if t["in_moon_zone"] else "no",
                     "source": f"{t['source']['file']}, line {t['source']['line']}"})

    for i, r in enumerate(rows, 1):
        r["row"] = i
    cols = [c for c, _ in TEST_COLS]
    write("tests.csv", csv_text(cols, rows))

    ssce = [{"program": "SSCE", "mission": t["mission"], "material": t["material"], "o2_levels_pct": ";".join(fnum(o) for o in t["o2_pct"]),
             "pressures_kpa": ";".join(fnum(p) for p in t["pressure_kpa"]), "pairing": "not given: which O2 went with which pressure on which flight is not stated",
             "flow": "not stated", "source": f"{t['source']['short']}: \"{t['source']['quote']}\""} for t in ext["tests"] if t["kind"] != "point"]
    write("ssce_ranges.csv", csv_text(["program", "mission", "material", "o2_levels_pct", "pressures_kpa", "pairing", "flow", "source"], ssce))

    by = {t["id"]: t for t in bass2["tests"]}
    pts = [{"test_id": q["test"], "kind": q["kind"], "air_display_cm_s": fnum(q["air_cm_s"]), "u_cm_s": fnum(q["u_cm_s"]), "rod_radius_cm": fnum(q["r_cm"]),
            "stretch_rate_a_per_s": fnum(q["a_per_s"]), "a_relation": "equal" if q["kind"] == "stable_observed" else "upper bound (true a <= value)",
            "o2_post_burn_pct": fnum(q["o2_final_pct"]), "o2_initial_pct": fnum(by[q["test"]]["o2_initial_pct"]), "method": q["method"],
            "source": f"{q['source']['file']}, line {q['source']['line']}" + (f"; {q['source_calibration']['file']} ({q['source_calibration']['date']}, restrictor {q['source_calibration']['restrictor']})" if q.get("source_calibration") else "")}
           for q in bass2["panel2_points"]]
    write("bass2_boundary_points.csv", csv_text(list(pts[0].keys()), pts))

    p2 = ref["panel2"]
    n = lambda k, v: sum(1 for r in rows if r[k] == v)
    readme = f"""# Flame Frontier evidence export

Generated by `scripts/05_build_export.py` from the same processed data the site's charts read. Do not edit by hand.

## Files
- `tests.csv`: {len(rows)} tests placed on the Evidence Map (Panel 1), one row each: {n('fuel_state', 'solid')} solid, {n('fuel_state', 'liquid')} liquid droplet, {n('fuel_state', 'gas')} gas flame. {n('in_moon_base_window', 'yes')} rows are inside the Moon-base window ({sum(1 for r in rows if r['in_moon_base_window'] == 'yes' and r['fuel_state'] == 'solid')} of them solid).
- `ssce_ranges.csv`: {len(ssce)} SSCE fuel groups. NASA lists O2 levels and pressures as sets without pairing them, so they are not test rows.
- `bass2_boundary_points.csv`: {len(pts)} BASS-II PMMA rod points compared with NASA's boundary, {p2['equation']} ({p2['source']['doc']}, sec. {p2['source']['section']}, eq. {p2['source']['equation_no']}, p.{p2['source']['printed_page']}); a = (3/2)(U/r)(r/r0)^0.5, r0 = {p2['r0_cm']} cm. O2 here is post-burn (final) O2, as in NASA's Fig. 6.9.

## tests.csv columns
| Column | Meaning |
|---|---|
""" + "\n".join(f"| `{c}` | {d} |" for c, d in TEST_COLS) + f"""

## Read before modelling
- O2 readings differ by source (column `o2_reading`): BASS-II initial O2; FLEX initial ambient; CFI-G chamber O2 before each test (normal flames only; the inverse flames' burner oxidizer is not an atmosphere and is excluded); Saffire as stated in its paper (mol %).
- BASS-II pressure is the report's stated 1 atm ({fnum(bass2['constants']['pressure_kpa'])} kPa), not a per-test measurement.
- BASS-II flows are the crew-noted Air display steps (cm/s, about +/-0.5, ~1 min response; report p.66). Rows whose Air display mixes in pot or fan settings are left empty, never guessed.
- Every test is microgravity. No partial-gravity combustion data exist in PSI (challenge page).
- FLEX and CFI-G are not solid materials; keep them out of solid-material flammability fits.
- PSI data: see each investigation's DOI for licence and citation. BASS-II (PSI-25) is CC0-1.0. Saffire values are cited facts from the paper named in `source`.
- More limits: the site's Known Limits tab (https://flame-frontier.vercel.app/#limits).
"""
    write("README.md", readme)
    write("manifest.json", json.dumps({"files": [
        {"file": "tests.csv", "rows": len(rows), "what": "every test on the Evidence Map, with its source"},
        {"file": "bass2_boundary_points.csv", "rows": len(pts), "what": "BASS-II points vs NASA's boundary (Panel 2)"},
        {"file": "ssce_ranges.csv", "rows": len(ssce), "what": "SSCE O2/pressure sets (unpaired)"},
        {"file": "README.md", "rows": None, "what": "data dictionary and caveats"}]}, indent=2) + "\n")
    print(f"export     {len(rows)} tests, {len(ssce)} SSCE ranges, {len(pts)} boundary points")


if __name__ == "__main__":
    main()

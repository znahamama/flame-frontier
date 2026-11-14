"""BASS-II (PSI-25) test table -> data/processed/bass2_tests.json + data/review/bass2_review.csv.

Pure rules, no LLM. Column meanings come from NASA's "BASS-II data FAQ.docx" (it outranks CLAUDE.md).

Sources (all in data/raw/PSI-25/, as downloaded from PSI):
- PSI-25_Experimental table_BASS-II.csv: primary citation (file + line number).
- BASS-II Test Matrix by PI Final.xlsx: same values, one tab per PI. Its multi-value cells keep their
  commas ("5, 2.5, 2") where the CSV export turned them into runs of spaces, so flow/fan TEXT is parsed
  from the xlsx when both files agree. Every disagreement is reported.
- Fan calibration data.xlsx: used ONLY to turn an exactly-calibrated blowoff pot setting into a flow
  (same day, same restrictor). Never interpolated or extrapolated.

Anything ambiguous goes to the review file with severity "needs_decision" and stays off every chart until
data/manual/bass2_review_decisions.csv accepts it.
"""
from __future__ import annotations

import csv
import datetime as dt
import math
import re
from pathlib import Path

import openpyxl

from _common import ROOT, write_json

RAW = ROOT / "data/raw/PSI-25"
CSV_FILE = RAW / "PSI-25_Experimental table_BASS-II.csv"
XLSX_FILE = RAW / "BASS-II Test Matrix by PI Final.xlsx"
CAL_FILE = RAW / "Fan calibration data.xlsx"
DECISIONS = ROOT / "data/manual/bass2_review_decisions.csv"
REVIEW = ROOT / "data/review/bass2_review.csv"
rel = lambda p: str(p.relative_to(ROOT))

R0_CM = 0.318            # report sec 6.1.4.4, p.75
U_PER_AIR = 1.0066       # Fan calibration data.xlsx A33: "*U =1.0066(AIR)"
INCH_CM = 2.54
P_KPA = 101.325          # report: "pressure P = 1 atm" (printed p.11); not measured per test
MAX_AIR = 60             # report p.66: ~55 cm/s max with no restrictor. Larger numbers are not airflow.

COLS = ["PI", "Test #", "Date", "GMT", "Sample #", "Fuel Sample Material", "Flow restrictor", "Fan display",
        "Air display", "Radiometer gain", "Total Frames Shot", "O2 initial", "O2 final", "CO2 initial",
        "CO2 final", "CO initial", "CO final"]
XLSX_COLS = COLS[2:3] + COLS[3:4] + COLS[1:2] + COLS[4:]   # tab layout: Date, GMT, Test, Sample, Material, ...

review: list[dict] = []


def flag(test, field, raw, issue, severity, detail):
    review.append({"test": test, "field": field, "raw": raw, "issue": issue, "severity": severity,
                   "detail": detail, "csv_file": rel(CSV_FILE)})


def load_decisions():
    out = {}
    if DECISIONS.exists():
        for r in csv.DictReader(open(DECISIONS, newline="")):
            out[(r["test"], r["issue"])] = r
    return out


DEC = load_decisions()


def accepted(test, issue):
    d = DEC.get((test, issue))
    return d if d and d["decision"].strip().lower() == "accept" else None


# ---------- readers ----------
def read_csv():
    with open(CSV_FILE, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    assert len(rows[0]) == 17, rows[0]
    return [(i, dict(zip(COLS, r))) for i, r in enumerate(rows[1:], start=2)]   # i = line number in file


def read_xlsx():
    wb = openpyxl.load_workbook(XLSX_FILE, data_only=True)
    out = {}
    for ws in wb.worksheets:
        for row in ws.iter_rows(min_row=2):
            vals = [c.value for c in row[:16]]
            if vals[2] in (None, ""):
                continue
            rec = dict(zip(XLSX_COLS, vals))
            out[str(rec["Test #"]).strip()] = (ws.title, row[0].row, rec)
    return out


def read_calibration():
    """{(date, restrictor): {pot: air}}. A block = 4 columns (Pot, Fan Display, Air Display, spare).
    Sections are accepted only when they sit inside the row band the sheet's own labels give for
    0/1/2 restrictors (rows 5-13, 14-22, 23-34); other layouts are skipped, never guessed."""
    ws = openpyxl.load_workbook(CAL_FILE, data_only=True).worksheets[0]
    bands = {0: range(5, 14), 1: range(14, 23), 2: range(23, 35)}
    table = {}
    for c in range(8, ws.max_column + 1, 4):        # c = date/Fan column (H, L, P, ...); A-E is the worked example
        if ws.cell(3, c - 1).value != "DATE":        # label sits in the Pot column, date beside it
            continue
        d = ws.cell(3, c).value
        if not isinstance(d, dt.datetime):
            continue                                 # e.g. "7/31/2014 a.m.": not a clean date, skip
        # contiguous runs of numeric (pot, air) rows; a run is used only if it lies inside one band
        runs, cur = [], []
        for r in range(5, 35):
            pot, air = ws.cell(r, c - 1).value, ws.cell(r, c + 1).value
            if isinstance(pot, (int, float)):
                cur.append((r, float(pot), air if isinstance(air, (int, float)) else None))
            elif cur:
                runs.append(cur); cur = []
        if cur:
            runs.append(cur)
        for run in runs:
            rows = {r for r, _, _ in run}
            nres = next((k for k, b in bands.items() if rows <= set(b)), None)
            if nres is None:
                continue
            key = (d.date(), nres)
            pts = {pot: float(air) for _, pot, air in run if air is not None}
            if key in table:                         # two calibrations for one day/restrictor: use neither
                table[key] = None
            elif pts:
                table[key] = pts
    # A section copied cell-for-cell into another restrictor band on the same day (2014-07-29: "no restrictor"
    # equals "2 restrictors", max 20 cm/s vs ~55 in the report p.66) cannot be both. Trust neither.
    for d in {k[0] for k in table}:
        secs = [(k, v) for k, v in table.items() if k[0] == d and v and len(v) >= 3]
        for i, (k1, v1) in enumerate(secs):
            for k2, v2 in secs[i + 1:]:
                if v1 == v2:
                    table[k1] = table[k2] = None
    return table


# ---------- value helpers ----------
def num(s):
    """-> (value|None, status). Status: ok | missing | over_range | text."""
    t = str(s).strip() if s is not None else ""
    if t == "" or t.lower() == "none":
        return None, "missing"
    if t.upper() == "OR" or t.lower() == "over" or t.startswith(">"):
        return None, "over_range"          # FAQ: "OR = over range (> 1000 ppm)"
    try:
        return float(t), "ok"
    except ValueError:
        return None, "text"


def norm_text(v):
    if isinstance(v, dt.datetime):
        return f"{v.month}/{v.day}/{v.year}"
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return re.sub(r"\s+", " ", str(v if v is not None else "").lower().replace(",", " ")).strip()


def same(a, b):
    x, y = norm_text(a), norm_text(b)
    if x == y:
        return True
    try:
        return math.isclose(float(x), float(y))
    except ValueError:
        return False


# ---------- geometry (FAQ: which PI burned which geometry) ----------
def geometry(test, pi, material):
    m = material.lower()
    g = {"material_raw": material}
    if pi == "Olson" or pi == "Fernandez-Pello":
        dm = re.search(r'(1/4|3/8|1/2|0\.5)\s*"?', m)
        d_in = {"1/4": 0.25, "3/8": 0.375, "1/2": 0.5, "0.5": 0.5}[dm.group(1)] if dm else None
        g.update(cls="rod_stagnation_upstream_ign" if pi == "Olson" else "rod_opposed_downstream_ign",
                 label="PMMA rod, upstream ignition (stagnation / concurrent)" if pi == "Olson"
                 else "PMMA rod, downstream ignition (opposed flow)",
                 rod_diameter_in=d_in, rod_radius_cm=round(d_in * INCH_CM / 2, 5) if d_in else None,
                 color="black" if "blac" in m else "clear" if "clear" in m else None)
        if d_in is None:
            flag(test, "Fuel Sample Material", material, "rod_size_unreadable", "needs_decision", "No 1/4, 3/8 or 1/2 inch size found.")
    elif pi == "Bhattacharjee":
        g.update(cls="thin_film", label="Thin PMMA film")
    elif pi == "Miller":
        sides = 1 if re.search(r"\b1 sided\b", m) else 2 if re.search(r"\b2 sided\b", m) else None
        g.update(cls="thick_slab", label=f"Thick PMMA slab, {sides}-sided" if sides else "Thick PMMA slab, sides not stated",
                 sides=sides)
        if "2ide" in m:
            flag(test, "Fuel Sample Material", material, "typo_sides_or_wide", "fyi",
                 "'2ide' could be '2-sided' or 'wide'. Left as sides not stated.")
        if re.search(r"2 sided.*2 cm thick", m):
            flag(test, "Fuel Sample Material", material, "thickness_conflict", "fyi",
                 "Says 3 mm thick and '2 cm thick'; probably '2 cm wide'. Geometry unaffected.")
    elif pi == "Ferkul":
        g.update(cls="fabric", label="Nomex III fabric") if "nomex" in m else g.update(cls="other", label="Japan wax candle")
    elif pi == "T'ien":
        g.update(cls="other", label="PMMA spherical section (4 cm)") if "spherical" in m else g.update(cls="fabric", label="SIBAL fabric (75/25 cotton/fiberglass)")
    else:
        g.update(cls="other", label="unknown")
        flag(test, "PI", pi, "unknown_pi", "needs_decision", "PI not in the FAQ list.")
    return g


# ---------- Air display grammar ----------
NUM = r"(\d+(?:\.\d+)?)"
RED_FLAGS = re.compile(r"[()?;/>]|pot|see|etc|ibid|brief|cm/s")


def parse_air(test, text):
    """Air display = flow speed in cm/s (FAQ). Returns dict with steps and events, or status=flagged."""
    raw = "" if text is None else str(text)
    out = {"raw": raw, "status": "clean", "steps": [], "events": []}
    if not raw.strip():
        out["status"] = "empty"
        return out
    dec = accepted(test, "air_ambiguous")
    if dec and dec.get("value", "").strip():
        out = parse_air(test + "#reviewed", dec["value"])
        out.update(raw=raw, reviewed_as=dec["value"], review_note=dec.get("note", ""))
        if out["status"] == "clean":
            out["status"] = "clean_after_review"
        return out
    if RED_FLAGS.search(raw.lower()):
        out["status"] = "flagged"
        flag(test, "Air display", raw, "air_ambiguous", "needs_decision",
             "Contains brackets, pot settings, '?', 'see', 'etc' or similar; flows not parsed.")
        return out
    for tok in [t.strip().lower() for t in raw.split(",") if t.strip()]:
        m = None
        if (m := re.fullmatch(NUM, tok)):
            out["steps"].append({"cm_s": float(m[1])})
        elif (m := re.fullmatch(NUM + r"\s*ext", tok)):
            out["steps"].append({"cm_s": float(m[1])}); out["events"].append("extinguished")
        elif tok in ("ext",):
            out["events"].append("extinguished")
        elif (m := re.fullmatch(r"(?:" + NUM + r"\s+)?(?:slow decr|down) to ext", tok)):
            if m[1]:
                out["steps"].append({"cm_s": float(m[1])})
            out["steps"].append({"cm_s": None, "qualifier": "decreased"}); out["events"].append("extinguished")
        elif tok == "blowoff":
            out["events"].append("blowoff")
        elif tok == "down then blowoff":
            out["steps"].append({"cm_s": None, "qualifier": "decreased"}); out["events"].append("blowoff")
        elif tok == "<1":
            out["steps"].append({"cm_s": None, "qualifier": "<1"})
        elif (m := re.fullmatch(r"(?:~|approaching )" + NUM, tok)):
            out["steps"].append({"cm_s": float(m[1]), "approx": True})
        elif tok in ("max", "low", "lower", "very low", "decr"):
            out["steps"].append({"cm_s": None, "qualifier": tok})
        elif (m := re.fullmatch(r"(?:" + NUM + r"\s+)?incr to (?:max )?" + NUM, tok)):
            if m[1]:
                out["steps"].append({"cm_s": float(m[1])})
            out["steps"].append({"cm_s": float(m[2]), "qualifier": "increased to"})
        elif (m := re.fullmatch(NUM + r"\s+ign", tok)):
            out["steps"].append({"cm_s": float(m[1]), "qualifier": "ignition"})
        elif tok == "no ign at any flow":
            out["events"].append("no_ignition")
        else:
            out["status"] = "flagged"
            flag(test, "Air display", raw, "air_unparsed_token", "needs_decision", f"Token not understood: {tok!r}")
            out["steps"], out["events"] = [], []
            return out
    big = [s["cm_s"] for s in out["steps"] if s["cm_s"] is not None and s["cm_s"] > MAX_AIR]
    if big:
        out["status"] = "flagged"
        flag(test, "Air display", raw, "air_value_too_high", "needs_decision",
             f"{big} exceed the duct's ~55 cm/s maximum (report p.66); probably fan voltage x10.")
        out["steps"], out["events"] = [], []
    return out


# ---------- outcome (explicit words only, from Air or Fan text) ----------
OUTCOME_WORDS = [("no_ignition", r"no ign"), ("not_sustained", r"would not stay lit"),
                 ("blowoff", r"blowoff"), ("extinguished", r"\bext\b|\d+ext\b|extinguished|\bout\b")]


def outcome(test, fan, air):
    found = {}
    for field, text in (("Fan display", fan), ("Air display", air)):
        t = "" if text is None else str(text)
        for name, pat in OUTCOME_WORDS:
            if (m := re.search(pat, t, re.I)):
                found.setdefault(name, {"field": field, "quote": m.group(0)})
    dec = accepted(test, "outcome_conflict")
    if dec and dec.get("value", "").strip():
        return {"value": dec["value"].strip(), "evidence": list(found.values()), "reviewed": dec.get("note", "")}
    if "blowoff" in found and "extinguished" in found:
        flag(test, "Fan/Air display", f"{fan} | {air}", "outcome_conflict", "needs_decision",
             "Text mentions both blowoff and extinction.")
        return {"value": "unclear", "evidence": list(found.values())}
    if len(found) > 1:
        flag(test, "Fan/Air display", f"{fan} | {air}", "outcome_conflict", "needs_decision", f"Several outcomes: {sorted(found)}")
        return {"value": "unclear", "evidence": list(found.values())}
    if found:
        (name, ev), = found.items()
        return {"value": name, "evidence": [ev]}
    return {"value": "not_stated", "evidence": []}


def fan_parse(text):
    """FAQ: fan voltage x10 (max 122), sometimes pot settings (max 10). Only an all-voltage cell is parsed."""
    raw = "" if text is None else str(text)
    toks = [t.strip() for t in raw.split(",") if t.strip()]
    vals = []
    for t in toks:
        if not re.fullmatch(NUM, t) or not 38 <= float(t) <= 122:
            return {"raw": raw, "volts": None, "note": "mixed voltage/pot/notes; kept as raw text"}
        vals.append(round(float(t) / 10, 2))
    return {"raw": raw, "volts": vals or None}


def stretch(u_cm_s, r_cm):
    return 1.5 * u_cm_s / r_cm * math.sqrt(r_cm / R0_CM)       # report p.75


# ---------- main ----------
def main():
    xl = read_xlsx()
    cal = read_calibration()
    tests, disagreements, panel2 = [], [], []
    seen = set()
    for line, c in read_csv():
        tid = c["Test #"].strip()
        pi = c["PI"].strip()
        seen.add(tid)
        tab, xrow, x = xl.get(tid, (None, None, None))
        if x is None:
            flag(tid, "Test #", tid, "missing_in_xlsx", "fyi", "Row exists in CSV only.")
        else:
            if tab.replace("’", "'") != pi:
                disagreements.append({"test": tid, "field": "PI/tab", "csv": pi, "xlsx": tab})
            for col in XLSX_COLS:
                if not same(c[col], x[col]):
                    disagreements.append({"test": tid, "field": col, "csv": c[col], "xlsx": str(x[col])})
        src = {"file": rel(CSV_FILE), "line": line}
        xsrc = {"file": rel(XLSX_FILE), "tab": tab, "row": xrow} if x else None
        text = lambda col: (str(x[col]) if x and x[col] is not None else "") if x and same(c[col], x[col]) else c[col]

        # dates (FAQ: Date = actual; video display shows one day later; GMT = day of year)
        d = dt.datetime.strptime(c["Date"].strip(), "%m/%d/%Y").date()
        gmt = int(c["GMT"])
        date_flags = []
        if d.year != 2014 and not (pi == "Olson" and d.year == 2016):
            date_flags.append("year_suspect")
            flag(tid, "Date", c["Date"], "date_year_suspect", "fyi",
                 f"Year {d.year}; GMT day {gmt} and same-day tests point to 2014. Not corrected.")
        if d.timetuple().tm_yday != gmt:
            date_flags.append("gmt_mismatch")
            flag(tid, "Date/GMT", f"{c['Date']} / {gmt}", "date_gmt_mismatch", "fyi",
                 f"Date is day {d.timetuple().tm_yday} of the year but GMT says {gmt}. Not corrected.")

        o2i, si = num(c["O2 initial"])
        o2f, sf = num(c["O2 final"])
        o2f_flag = None
        if o2f is None:
            o2f_flag = "missing"
        elif o2f < 10 or (o2i is not None and o2f > o2i + 1.0):
            o2f_flag = "sensor_error_suspected"
            flag(tid, "Calibrated final O2", c["O2 final"], "o2_final_implausible", "fyi",
                 f"Final {o2f}% vs initial {o2i}%: O2 cannot drop below 10% or rise >1 point in a closed volume. Kept, marked, never plotted.")

        geo = geometry(tid, pi, c["Fuel Sample Material"])
        air = parse_air(tid, text("Air display"))
        fan = fan_parse(text("Fan display"))
        out = outcome(tid, text("Fan display"), text("Air display"))
        restr, _ = num(c["Flow restrictor"])

        rec = {
            "id": tid, "pi": pi, "date_actual": d.isoformat(), "date_video": (d + dt.timedelta(days=1)).isoformat(),
            "gmt_day": gmt, "date_flags": date_flags, "sample": c["Sample #"].strip(),
            "geometry": geo, "flow_restrictor": int(restr) if restr is not None else None,
            "fan_display": fan, "air_display": air, "outcome": out,
            "radiometer_gain_raw": c["Radiometer gain"], "frames_raw": c["Total Frames Shot"],
            "o2_initial_pct": o2i, "o2_final_pct": o2f, "o2_final_flag": o2f_flag, "o2_basis": "% by vol, calibrated (FAQ: constant offset from MCA reading)",
            "co2_initial_pct": num(c["CO2 initial"])[0], "co2_final_pct": num(c["CO2 final"])[0],
            "co_initial_ppm": num(c["CO initial"])[0], "co_final_ppm": num(c["CO final"])[0],
            "co_flags": [f"{k}:{s}" for k, (v, s) in (("initial", num(c["CO initial"])), ("final", num(c["CO final"]))) if s != "ok"],
            "pressure_kpa": P_KPA, "pressure_basis": "1 atm stated in report (printed p.11, p.94); not measured per test",
            "source": src, "source_xlsx": xsrc,
        }
        tests.append(rec)

        # ---- Panel 2 (Olson upstream-ignited rods only) ----
        r = geo.get("rod_radius_cm")
        if geo.get("cls") != "rod_stagnation_upstream_ign" or not r or o2f_flag:
            continue
        rec["panel2"] = None
        if out["value"] == "extinguished" and air["status"] in ("clean", "clean_after_review"):
            nums = [s["cm_s"] for s in air["steps"] if s["cm_s"] not in (None, 0.0)]
            if nums:
                u = U_PER_AIR * nums[-1]
                panel2.append({"test": tid, "kind": "stable_observed", "air_cm_s": nums[-1], "u_cm_s": round(u, 3), "r_cm": r,
                               "a_per_s": round(stretch(u, r), 3), "o2_final_pct": o2f,
                               "method": "Flame burning at this Air display reading (cm/s). The flow was then lowered with pot settings below the fan calibration until extinction, so this is NOT the extinction flow",
                               "evidence": air["raw"], "source": src, "source_xlsx": xsrc})
        if out["value"] == "blowoff":
            ftxt = text("Fan display")
            m = re.search(r"blowoff (?:fan )?(?:pot |max )" + NUM, ftxt, re.I)
            pot = float(m[1]) if m else None
            if pot is None:
                d_ = accepted(tid, "blowoff_pot_unclear")
                if d_ and d_.get("value"):
                    pot = float(d_["value"])
                else:
                    flag(tid, "Fan display", ftxt, "blowoff_pot_unclear", "needs_decision",
                         "Blowoff setting not written as 'pot N' or 'max N'. Accept with the pot value in bass2_review_decisions.csv to plot it.")
            if pot is not None:
                calt = cal.get((d, rec["flow_restrictor"])) or None
                air_cal = calt.get(pot) if calt else None
                if air_cal is None:
                    flag(tid, "Fan display", ftxt, "blowoff_no_calibration", "fyi",
                         f"No fan calibration for {d} / restrictor {rec['flow_restrictor']} / pot {pot}. Not plotted (no interpolation).")
                else:
                    u = U_PER_AIR * air_cal
                    panel2.append({"test": tid, "kind": "blowoff_upper_bound", "air_cm_s": air_cal, "u_cm_s": round(u, 3), "r_cm": r,
                                   "a_per_s": round(stretch(u, r), 3), "o2_final_pct": o2f, "pot": pot,
                                   "method": f"Blowoff after the fan was stepped up to pot {pot}. Same-day fan calibration gives steady Air {air_cal} cm/s at that pot (restrictor {rec['flow_restrictor']}); the probe takes ~1 min to settle (report p.66), so the flow at blowoff was at most this: an upper bound",
                                   "evidence": ftxt, "source": src, "source_xlsx": xsrc,
                                   "source_calibration": {"file": rel(CAL_FILE), "date": d.isoformat(), "restrictor": rec["flow_restrictor"]}})

    for tid in sorted(set(xl) - seen):
        flag(tid, "Test #", tid, "missing_in_csv", "fyi", "Row exists in the xlsx only.")
    for dd in disagreements:
        dd["kind"] = "word_order_only" if sorted(norm_text(dd["csv"]).split()) == sorted(norm_text(dd["xlsx"]).split()) else "value"
        sev = "fyi" if dd["kind"] == "word_order_only" else "needs_decision"
        flag(dd["test"], dd["field"], f"CSV={dd['csv']!r} | xlsx={dd['xlsx']!r}", f"csv_xlsx_disagree_{dd['kind']}", sev,
             "Same words in a different order; CSV text used." if sev == "fyi" else "Values differ after normalising commas/spaces/case.")

    # Tested stretch range for the Panel 2 curve: every Olson flow recorded in cm/s (clean Air display steps > 0,
    # plus calibrated blowoff flows), whatever the outcome. Readings of 0 are below the sensor's resolution.
    a_vals = [p["a_per_s"] for p in panel2 if p["kind"] != "blowoff_upper_bound"]   # bounds don't define the tested range
    for t in tests:
        if t["geometry"].get("cls") == "rod_stagnation_upstream_ign" and t["air_display"]["status"] in ("clean", "clean_after_review") and t["geometry"].get("rod_radius_cm"):
            a_vals += [stretch(U_PER_AIR * s["cm_s"], t["geometry"]["rod_radius_cm"]) for s in t["air_display"]["steps"] if s["cm_s"]]
    tested = [round(min(a_vals), 2), round(max(a_vals), 2)] if a_vals else None

    REVIEW.parent.mkdir(parents=True, exist_ok=True)
    review.sort(key=lambda r: (r["severity"] != "needs_decision", r["test"], r["issue"]))
    with open(REVIEW, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["severity", "test", "issue", "field", "raw", "detail", "csv_file"])
        w.writeheader(); w.writerows(review)
    print(f"review     {rel(REVIEW)}: {sum(r['severity']=='needs_decision' for r in review)} needs_decision, "
          f"{sum(r['severity']=='fyi' for r in review)} fyi")

    write_json("bass2_tests.json", {
        "schema": 1, "count": len(tests), "tests": tests, "panel2_points": panel2,
        "panel2_tested_a_range": tested,
        "panel2_tested_a_note": "Min/max stretch rate over every Olson flow recorded in cm/s (Air display steps > 0 in cleanly parsed rows). Calibrated blowoff flows are upper bounds and excluded.",
        "csv_xlsx_disagreements": disagreements,
        "constants": {"r0_cm": R0_CM, "u_per_air": U_PER_AIR, "u_per_air_source": f"{rel(CAL_FILE)} cell A33-A34",
                      "pressure_kpa": P_KPA},
        "notes": [
            "Report says 'A total of 126 tests were conducted' (printed p.3); the PSI table has 129 rows.",
            "Fan calibration is used only for blowoff pots it calibrated exactly. Extinction pots (0.27-0.36) are below its lowest calibrated pot (0.5), so those flows are not reconstructed.",
        ],
    })


if __name__ == "__main__":
    main()

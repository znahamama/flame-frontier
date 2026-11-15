"""Fire safety controls (challenge objective 3) -> data/processed/controls.json. Pure checks, counts and templates; no LLM.

The challenge page: "NASA's spacecraft fire safety work is focused on prevention, detection, and suppression."
For each role:
- investigations: linked only by an exact quote, either from the challenge page (sec. 1 of docs/ref/challenge_brief.md)
  or from a named field of that investigation's PSI metadata (data/manual/safety_roles.csv). A quote that is not found
  fails the build.
- data: what the PSI tables hold for that role, counted from processed or raw files (never typed), each with its source.
- moon: one template sentence placing the role's tests against the Moon-base window from gaps.json, or saying they
  cannot be placed and why.
"""
from __future__ import annotations

import csv
import importlib.util
import json
import re
from collections import Counter

from _common import ROOT, write_json

P = ROOT / "data/processed"
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
f1 = lambda x: f"{x:.1f}".rstrip("0").rstrip(".")

_spec = importlib.util.spec_from_file_location("gaps", ROOT / "scripts/05_build_gaps.py")
gaps_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gaps_mod)

ROLES = [("prevention", "Prevention", "Prevention is achieved by controlling ignition sources and through material selection, which depends on understanding flammability limits."),
         ("detection", "Detection", "Fire detection was tested in microgravity through the Smoke and Aerosol Measurement Experiment studies (SAME and SAME-R)."),
         ("suppression", "Suppression", "Suppression was studied in the Flame Extinguishment Experiment (FLEX) through dilution of the chamber atmosphere with carbon dioxide and helium, both of which suppress fire.")]
INTRO = "NASA’s spacecraft fire safety work is focused on prevention, detection, and suppression."
EARTH = {"detection": "fire_detector", "suppression": "water_mist"}   # On Earth tab cards for the same role (theme in earth_apps.json)
SAME_R = "data/raw/PSI-101/PSI-101_Experimental table_SAME-R.csv"
SAME = "data/raw/PSI-102/PSI-102_Experimental table_SAME.csv"
FLEX_RAW = "data/raw/PSI-69/PSI-69_Experimental table_FLEX.csv"
CO2_PUB = "Methanol Droplet Extinction in Oxygen/Carbon-dioxide/Nitrogen Mixtures in Microgravity"
ATM = re.compile(r"oxygen|\bO2\b|pressure", re.I)


def read_table(rel, enc="utf-8-sig"):
    rows = list(csv.reader(open(ROOT / rel, encoding=enc, newline="")))
    head = [ws(h) for h in rows[0]]
    body = [(i + 2, dict(zip(head, [ws(c) for c in r]))) for i, r in enumerate(rows[1:]) if any(c.strip() for c in r)]
    return head, body


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def rng(vals, unit=""):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    lo, hi = min(vals), max(vals)
    return f"{f1(lo)}{unit}" if lo == hi else f"{f1(lo)}–{f1(hi)}{unit}"


def counts_text(c):
    return ", ".join(f"{k} {v}" for k, v in c.most_common())


def main():
    brief = (ROOT / "docs/ref/challenge_brief.md").read_text(encoding="utf-8")
    s1 = ws(brief.split("## 1. Challenge page text (verbatim)")[1].split("\n---")[0])
    cat = {i["psi_id"]: i for i in json.loads((P / "catalog.json").read_text())["investigations"]}
    tables = {r["file"].split("/")[0]: r for r in csv.DictReader(open(ROOT / "data/manual/psi_tables.csv", encoding="utf-8"))}
    names = {}
    for r in csv.DictReader(open(ROOT / "data/manual/brief_investigations.csv", encoding="utf-8")):
        if r["psi_id"].startswith("PSI-"):
            names.setdefault(r["psi_id"], []).append(r["name"])
    gaps = {h["habitat"]["id"]: h for h in json.loads((P / "gaps.json").read_text())["habitats"]}
    moon = gaps["moon_base"]
    win = moon["habitat"]
    wtext = gaps_mod.window_text(win)
    earth = {a["id"]: a for a in json.loads((P / "earth_apps.json").read_text())["applications"]}
    errors = []

    for q in [INTRO] + [r[2] for r in ROLES]:
        if ws(q) not in s1:
            errors.append(f"role quote not on the challenge page: {q[:60]!r}")

    # Investigation links, each backed by an exact quote.
    links = {r[0]: {} for r in ROLES}
    for row in csv.DictReader(open(ROOT / "data/manual/safety_roles.csv", encoding="utf-8")):
        pid = row["psi_id"]
        if pid not in cat:
            errors.append(f"{row['role']}: unknown {pid}")
            continue
        if row["basis"] == "brief":
            if ws(row["quote"]) not in s1:
                errors.append(f"{row['role']} {pid}: quote not on the challenge page: {row['quote'][:60]!r}")
            src = {"doc": "Space Apps 2026 challenge page", "file": "docs/ref/challenge_brief.md", "section": "1"}
        else:
            fld = cat[pid]["fields"].get(row["field"]) or {}
            if ws(row["quote"]) not in ws(fld.get("value")):
                errors.append(f"{row['role']} {pid}: quote not in metadata {row['field']}: {row['quote'][:60]!r}")
            s = fld.get("source") or {}
            src = {"file": s.get("file"), "line": s.get("line"), "key": s.get("key")}
        f = cat[pid]["fields"]
        t = tables.get(pid)
        inv = links[row["role"]].setdefault(pid, {
            "psi_id": pid, "short": " / ".join(names.get(pid, [])) or None, "title": f["title"]["value"], "doi": f["doi"].get("value"),
            "platform": (f.get("platform") or {}).get("value"),
            "table": {"kind": t["kind"], "what": t["reason"]} if t else {"kind": "none", "what": "No experimental table in the PSI download."},
            "quotes": []})
        inv["quotes"].append({"basis": row["basis"], "relation": row["relation"], "field": row["field"] or None, "quote": row["quote"], "src": src})

    # Prevention: the solid tests behind Panel 1 (same set as Habitat Gaps).
    ext = json.loads((P / "external_tests.json").read_text())
    bass2 = json.loads((P / "bass2_tests.json").read_text())
    solids = gaps_mod.solid_points(ext, bass2)
    prog = Counter(s["id"].split(" ")[0] for s in solids)
    mats = sorted({s["material"] for s in solids})
    covered = next((c for c in moon["covered"] if c["id"] == "solid_window"), None)
    prevention = {
        "facts": [
            {"label": "Solid-material tests placed by O2 and pressure", "value": str(len(solids)), "detail": counts_text(prog),
             "src": "Saffire: data/manual/external_tests.csv (ICES-2024-365 Table 1, p.3); BASS-II: data/raw/PSI-25 experimental table"},
            {"label": "Material and sample types", "value": str(len(mats)), "detail": "; ".join(mats), "src": "same rows, material column"},
            {"label": "Published flammability boundary", "value": "1",
             "detail": "BASS-II eq. 6.1, PMMA rods, measured at 101.3 kPa", "src": "BASS-II Summary Report, sec. 6.1.4.4, p.75"},
        ],
        "moon": {"text": covered["text"] if covered else f"No solid-material test had O2 and pressure in {wtext}.",
                 "gaps": [{"id": g["id"], "text": g["text"], "href": f"#evidence/gap=moon_base.{g['id']}"} for g in moon["gaps"]],
                 "links": [{"href": "#gaps", "label": "All habitat gaps"}]},
    }

    # Suppression: FLEX diluent columns, per test.
    flex = json.loads((P / "flex_tests.json").read_text())
    ft = flex["tests"]
    raw_head = [ws(h) for h in next(csv.reader(open(ROOT / FLEX_RAW, encoding="cp1252", newline="")))]
    # The PSI header says "CO", like "O" and "N" for O2 and N2 (subscripts lost); read as CO2. Checked, not assumed:
    flex_meta = ws(next((ROOT / "data/raw/PSI-69").glob("PSI-69_metadata*/i_Investigation.txt")).read_text(encoding="utf-8", errors="replace"))
    if CO2_PUB not in flex_meta:
        errors.append("FLEX metadata no longer names the oxygen/carbon-dioxide/nitrogen publication: re-check the CO column")
    rows_raw = list(csv.reader(open(ROOT / FLEX_RAW, encoding="cp1252", newline="")))[1:]
    sums = [sum(float(x) for x in r[6:10]) for r in rows_raw if all(x not in ("", "–") for x in r[6:10])]
    sum_ok = sum(1 for x in sums if abs(x - 1) <= 0.02)
    dil = [t for t in ft if (t["co2_frac"] or 0) > 0 or (t["he_frac"] or 0) > 0]
    co2 = [t for t in dil if (t["co2_frac"] or 0) > 0]
    he = [t for t in dil if (t["he_frac"] or 0) > 0]
    both = [t for t in dil if t in co2 and t in he]
    in_win = [t for t in dil if gaps_mod.in_win(t["o2_pct"], t["pressure_kpa"], win)]
    top = max(dil, key=lambda t: (t["o2_pct"], -t["pressure_kpa"]))
    low_p = min(dil, key=lambda t: t["pressure_kpa"])
    fuels = sorted({t["fuel"] for t in ft})
    sf6_col = [h for h in raw_head if re.search(r"SF", h)]
    agent = lambda g, k: {"n": len(g), "o2": rng([t["o2_pct"] for t in g], "%"), "p_kpa": rng([t["pressure_kpa"] for t in g], " kPa"),
                          "frac": rng([t[k] * 100 for t in g], "%"), "ends": counts_text(Counter(t["test_end"] for t in g)),
                          "fuels": counts_text(Counter(t["fuel"] for t in g))}
    a_co2, a_he = agent(co2, "co2_frac"), agent(he, "he_frac")
    bass_t = tables.get("PSI-26", {}).get("reason", "")
    suppression = {
        "facts": [
            {"label": "FLEX tests with a suppressant gas in the chamber", "value": f"{len(dil)} of {len(ft)}",
             "detail": f"CO2 {len(co2)}, helium {len(he)}" + (f", both {len(both)}" if both else "") + f"; the other {len(ft) - len(dil)} had neither",
             "src": f"{FLEX_RAW}: 'CO initial ambient composition; mole fraction' (CO2) and 'He initial ambient composition; mole fraction'",
             "note": (f"The PSI column header reads \"CO\" (as \"O\" and \"N\" stand for O2 and N2); we read it as CO2: the O, N, CO and He fractions "
                      f"sum to 1 (±0.02) in {sum_ok} of {len(sums)} rows, and FLEX's PSI publication list includes \"{CO2_PUB}\".")},
            {"label": "CO2 tests", "value": str(a_co2["n"]),
             "detail": f"CO2 {a_co2['frac']} of the chamber gas; O2 {a_co2['o2']}; {a_co2['p_kpa']}; ended: {a_co2['ends']}", "src": FLEX_RAW},
            {"label": "Helium tests", "value": str(a_he["n"]),
             "detail": f"He {a_he['frac']} of the chamber gas; O2 {a_he['o2']}; {a_he['p_kpa']}; ended: {a_he['ends']}", "src": FLEX_RAW},
            {"label": "Fuels", "value": str(len(fuels)), "detail": f"{', '.join(fuels)} droplets (liquid, not solid materials)", "src": FLEX_RAW},
            {"label": "SF6", "value": "no column" if not sf6_col else str(len(sf6_col)),
             "detail": "FLEX's PSI objective names SF6, but its experimental table has no SF6 column" if not sf6_col else "SF6 column present",
             "src": f"{FLEX_RAW} header"},
            {"label": "Solid materials", "value": "no per-test data",
             "detail": f"BASS (PSI-26) set out to test an inert extinguishing agent on solids; its PSI table: {bass_t}", "src": "data/manual/psi_tables.csv"},
        ],
        "extremes": [{"what": "highest O2 with a suppressant", "id": top["id"], "o2": top["o2_pct"], "p_kpa": top["pressure_kpa"],
                      "co2": top["co2_frac"], "he": top["he_frac"], "fuel": top["fuel"], "end": top["test_end"], "src": top["source"]},
                     {"what": "lowest pressure with a suppressant", "id": low_p["id"], "o2": low_p["o2_pct"], "p_kpa": low_p["pressure_kpa"],
                      "co2": low_p["co2_frac"], "he": low_p["he_frac"], "fuel": low_p["fuel"], "end": low_p["test_end"], "src": low_p["source"]}],
        "moon": {"text": f"{len(in_win)} of {len(dil)} FLEX suppressant tests ran in {wtext}. The highest O2 with CO2 or helium present was "
                         f"{f1(top['o2_pct'])}% at {f1(top['pressure_kpa'])} kPa (FLEX test {top['id']}). All are {' and '.join(f.lower() for f in fuels)} droplets. "
                         "BASS (PSI-26), whose PSI objective is to test an inert extinguishing agent on solid materials, has no O2, pressure or flow columns in its table.",
                 "links": [{"href": "#evidence", "label": "FLEX layer on the Evidence Map"}]},
    }
    if in_win:
        errors.append("FLEX suppressant tests now fall in the Moon-base window: revisit the controls sentence")

    # Detection: SAME and SAME-R per-test tables.
    hr, sr = read_table(SAME_R)
    hs, ss = read_table(SAME)
    sr = [(ln, r) for ln, r in sr if r.get("Sample Type")]
    atm_cols = [h for h in hr + hs if ATM.search(h)]
    mat_r = Counter(r["Sample Type"] for _, r in sr)
    mat_s = Counter(re.sub(r":.*$", "", r["Sample Material"]).strip() for _, r in ss)
    vel = Counter(num(r["Inlet velocity (cm/s)"]) for _, r in sr)
    flow_s = sorted({num(r["Air Flow (cm/s)"]) for _, r in ss} - {None})
    detection = {
        "facts": [
            {"label": "SAME-R smoke tests", "value": str(len(sr)), "detail": f"materials: {counts_text(mat_r)}", "src": f"{SAME_R}: 'Sample Type'"},
            {"label": "SAME-R inlet velocities", "value": str(len([v for v in vel if v is not None])),
             "detail": ", ".join(f"{f1(v)} cm/s ({n})" for v, n in sorted(vel.items(), key=lambda x: (x[0] is None, x[0] or 0)) if v is not None),
             "src": f"{SAME_R}: 'Inlet velocity (cm/s)'"},
            {"label": "SAME samples", "value": str(len(ss)), "detail": f"materials: {counts_text(mat_s)}; air flow given for some rows: {', '.join(f1(v) for v in flow_s)} cm/s",
             "src": f"{SAME}: 'Sample Material', 'Air Flow (cm/s)'"},
            {"label": "O2 or pressure columns", "value": str(len(atm_cols)),
             "detail": "Neither SAME table has an oxygen or pressure column" if not atm_cols else ", ".join(atm_cols), "src": f"{SAME_R} and {SAME} headers"},
        ],
        "moon": {"text": (f"Neither SAME table records O2 or pressure, so none of the {len(sr) + len(ss)} smoke tests can be placed against {wtext}. "
                          "Whether smoke from these materials behaves the same in Moon-base air is not in the data.") if not atm_cols else
                         f"Atmosphere columns found ({', '.join(atm_cols)}): update this sentence.",
                 "links": []},
    }
    if atm_cols:
        errors.append(f"SAME tables now have atmosphere columns {atm_cols}: revisit the detection sentence")

    if errors:
        raise SystemExit("FAIL controls:\n  " + "\n  ".join(errors))

    data = {"prevention": prevention, "detection": detection, "suppression": suppression}
    out = []
    for rid, name, quote in ROLES:
        e = earth.get(EARTH.get(rid, ""))
        out.append({"id": rid, "name": name, "brief_quote": quote, "investigations": list(links[rid].values()),
                    **data[rid], "earth": {"id": e["id"], "title": e["title"]} if e else None,
                    "compare": [i for i in links[rid]][:3]})
    write_json("controls.json", {
        "schema": "roles[]: brief_quote (challenge page), investigations[] (each linked by exact quotes with src), facts[] (counted from PSI tables, src), moon {text, links} (template).",
        "intro": {"quote": INTRO, "source": "Space Apps 2026 challenge page (docs/ref/challenge_brief.md sec. 1)"},
        "window": {"name": win["name"], "text": wtext},
        "roles": out,
    })
    print("controls.json: " + ", ".join(f"{r['id']} {len(r['investigations'])} investigations" for r in out))


if __name__ == "__main__":
    main()

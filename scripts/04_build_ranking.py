"""Ranking: how well each PSI combustion investigation covers each habitat's conditions -> data/processed/ranking.json.

Pure rules, no LLM. A visible rule table (RULES below, shipped in the JSON and rendered on the Ranking tab):
every score is a sum of per-component contributions, each with a template explanation and its source.
- Habitats: data/manual/habitat_profiles.json. Every number has a quote that must be found in its source
  (challenge brief text, or the page text of a pinned NTRS PDF), else the build fails.
- Tested O2 / pressure: read from the PSI experimental tables named in data/manual/condition_columns.csv.
  Inverse-flame XO2 (oxidizer flowing from the burner) is NOT the ambient atmosphere and is never used.
- Material class and flow regime: data/manual/investigation_features.csv, each with a quote that must appear in
  the investigation's metadata, experimental table or the brief.
- Weights are our design choice (stated on the page), not a NASA rating.
"""
from __future__ import annotations

import csv
import json
import re
import sys

from _common import PSI_TO_KPA, ROOT, write_json

RAW = ROOT / "data/raw"
MAN = ROOT / "data/manual"
BRIEF = ROOT / "docs/ref/challenge_brief.md"
ws = lambda s: re.sub(r"\s+", " ", s or "").strip()
UNIT = {"atm": 101.325, "bar": 100.0, "mmHg": 101.325 / 760, "kPa": 1.0}
NUM = re.compile(r"\d+(?:\.\d+)?")

RULES = {
    "o2": {"label": "O2 overlap", "weight": 25,
           "rule": "1 if a per-test ambient O2 falls inside the habitat's O2 window; 0.5 if only a summary-table value does; 0 if none does or no ambient O2 is in our data."},
    "pressure": {"label": "Pressure overlap", "weight": 20,
                 "rule": "1 if one test had both its pressure and its O2 inside the habitat's windows; 0.5 if a tested pressure is inside the window but no single test also had O2 inside (or the table does not pair them); 0 if no tested pressure is inside or none is in our data."},
    "flow": {"label": "Flow regime", "weight": 15,
             "rule": "Forced flow varied within the investigation 1; one flow, a stated flow, or still air 0.5; not stated or not applicable 0.",
             "why": {"quote": "air flow is also important in microgravity", "source": "challenge_brief"}},
    "gravity": {"label": "Gravity", "weight": 15,
                "rule": "Microgravity habitat: flight investigation 1, ground 0. Partial-gravity habitat: no PSI data at partial gravity, so microgravity or ground results score 0.5 (they can only bound it).",
                "why": {"quote": "Microgravity and normal-gravity results could bound what occurs at intermediate gravity levels.", "source": "challenge_brief"}},
    "material": {"label": "Material class", "weight": 15,
                 "rule": "Solid materials 1; gas flames emulating solids, or solids heated for smoke 0.5; liquid droplets or gas flames 0.25; dust 0.",
                 "why": {"quote": "Flammability studies focus on solid materials such as fabrics and plastics", "source": "challenge_brief"}},
    "data": {"label": "Test-level data", "weight": 10,
             "rule": "Per-test table in our PSI download 1; summary table only 0.5; none 0."},
}
FLOW = {"varied": 1.0, "single": 0.5, "stated": 0.5, "quiescent": 0.5, "not_stated": 0.0, "not_applicable": 0.0}
FLOW_TXT = {"varied": "forced flow varied", "single": "one flow speed", "stated": "a flow speed is recorded",
            "quiescent": "still air", "not_stated": "flow not stated in our data", "not_applicable": "no experiment of its own (analysis/modeling)"}
MAT = {"solid": 1.0, "gas_emulating_solid": 0.5, "solid_smoke": 0.5, "liquid": 0.25, "gas": 0.25, "dust": 0.0}
MAT_TXT = {"solid": "solid materials", "gas_emulating_solid": "gas flames emulating burning solids", "solid_smoke": "solids heated to make smoke",
           "liquid": "liquid droplets", "gas": "gas flames", "dust": "dust and aerosol, no flames"}
DATA = {"yes": 1.0, "summary only": 0.5, "no": 0.0}

problems: list[str] = []


def pdf_pages(path):
    import pypdf
    out = {}
    for i, pg in enumerate(pypdf.PdfReader(path).pages, start=1):
        try:
            out[i] = ws(pg.extract_text())
        except Exception:  # noqa: BLE001 (a page that will not decompress simply cannot hold a quote)
            out[i] = ""
    return out


def check_habitats(sources):
    brief = ws(BRIEF.read_text())
    pdfs = {}

    def found(quote, src, page):
        if src == "challenge_brief":
            return ws(quote) in brief
        f = ROOT / sources[src]["file"]
        if not f.exists():
            problems.append(f"{src}: {f} missing (run scripts/01_fetch_refs.py)")
            return False
        pdfs.setdefault(src, pdf_pages(f))
        return ws(quote) in pdfs[src].get(page, "")

    hab = json.load(open(MAN / "habitat_profiles.json"))["habitats"]
    for h in hab:
        for k in ("o2", "p", "gravity"):
            if not found(h[f"{k}_quote"], h[f"{k}_source"], h.get(f"{k}_page")):
                problems.append(f"{h['id']}: {k} quote not found in {h[f'{k}_source']} p.{h.get(f'{k}_page')}")
    zone_p = round(10.2 * PSI_TO_KPA, 2)
    want = {"moon_base": zone_p, "rover": zone_p, "spacesuit": round(4.3 * PSI_TO_KPA, 2)}
    for h in hab:
        if h["id"] in want and abs(h["p_kpa"][1] - want[h["id"]]) > 0.01:
            problems.append(f"{h['id']}: p_kpa {h['p_kpa']} does not match the psi value")
    return hab


def read_table(path):
    raw = path.read_bytes()
    try:
        txt = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        txt = raw.decode("cp1252")
    return list(csv.reader(txt.splitlines()))


def values(cell, mode, scale):
    cell = cell.strip()
    if mode == "num":
        try:
            return [float(cell) * scale]
        except ValueError:
            return []
    if mode == "pct":
        return [float(m) * scale for m in re.findall(r"(\d+(?:\.\d+)?)\s*%", cell)]
    return [float(m) * scale for m in NUM.findall(cell)]  # all_nums, atm_text


def conditions(cat):
    kind = {t["file"]: t["kind"] for c in cat["investigations"] for t in c["tables"]}
    out = {}
    for r in csv.DictReader(open(MAN / "condition_columns.csv", newline="")):
        r["kind"] = kind.get(f"data/raw/{r['file']}")
        if r["kind"] is None:
            problems.append(f"{r['file']}: not a classified table in the catalog")
        path = RAW / r["file"]
        rows = read_table(path)
        head = [ws(h) for h in rows[0]]
        idx = lambda c: head.index(ws(c)) if ws(c) in head else problems.append(f"{r['file']}: no column {c!r}")
        oi = idx(r["o2_col"])
        pi = idx(r["p_col"]) if r["p_col"] else None
        fixed = None
        if r["p_parse"] == "fixed":
            n, u = r["p_unit"].split()
            fixed = float(n) * UNIT[u]
        d = out.setdefault(r["psi_id"], {"o2": [], "o2_summary": [], "p": [], "pairs": [], "o2_cols": [], "p_cols": [], "excluded": [], "notes": []})
        col_src = lambda c: {"file": f"data/raw/{r['file']}", "column": ws(c)}
        if r["o2_kind"] != "ambient":
            d["excluded"].append({**col_src(r["o2_col"]), "why": r["note"]})
            continue
        d["o2_cols"].append(col_src(r["o2_col"]))
        if r["p_parse"] == "fixed":
            d["p_cols"].append({"file": f"data/raw/{r['file']}", "column": None, "fixed": r["p_unit"], "why": r["note"]})
        elif pi is not None:
            d["p_cols"].append(col_src(r["p_col"]))
        if r["note"]:
            d["notes"].append(r["note"])
        if oi is None:
            continue
        o2s_all = []
        for line, row in enumerate(rows[1:], start=2):
            if len(row) <= oi:
                continue
            o2 = [v for v in values(row[oi], r["o2_parse"], float(r["o2_scale"])) if 0 < v <= 100]
            if fixed is not None:
                ps = [fixed] if o2 else []
            elif pi is not None and len(row) > pi:
                ps = [round(v * UNIT[r["p_unit"]], 2) for v in values(row[pi], r["p_parse"], 1.0) if v > 0]
            else:
                ps = []
            o2s_all += o2
            d["o2" if r["kind"] == "per_test" else "o2_summary"] += o2
            d["p"] += ps
            if r["paired"] == "yes" and len(o2) == 1 and len(ps) == 1:
                d["pairs"].append((round(o2[0], 2), round(ps[0], 2), f"data/raw/{r['file']}", line))
        if not o2s_all:
            problems.append(f"{r['file']}: no O2 values parsed from {r['o2_col']!r}")
    return out


def features(cat):
    by = {c["psi_id"]: c for c in cat["investigations"]}
    brief = ws(BRIEF.read_text())
    out = {}
    for r in csv.DictReader(open(MAN / "investigation_features.csv", newline="")):
        c = by.get(r["psi_id"])
        if not c:
            problems.append(f"features: {r['psi_id']} not in catalog")
            continue
        texts = {"metadata": ws((ROOT / c["metadata_dir"] / "i_Investigation.txt").read_text(encoding="utf-8-sig")),
                 "table": " ".join(ws((ROOT / t["file"]).read_bytes().decode(t["encoding"])) for t in c["tables"]),
                 "brief": brief}
        for k in ("material", "flow"):
            q, where = r[f"{k}_quote"], r[f"{k}_where"]
            if q and ws(q) not in texts.get(where, ""):
                problems.append(f"{r['psi_id']}: {k} quote {q!r} not found in its {where}")
        if r["material_class"] not in MAT or r["flow"] not in FLOW:
            problems.append(f"{r['psi_id']}: unknown class {r['material_class']}/{r['flow']}")
        out[r["psi_id"]] = r
    missing = sorted(set(by) - set(out))
    if missing:
        problems.append(f"features missing for {missing}")
    return out


def fmt(lo, hi, unit, nd=1):
    return f"{lo:.{nd}f}{unit}" if abs(lo - hi) < 1e-9 else f"{lo:.{nd}f}–{hi:.{nd}f}{unit}"


def score(h, c, cond, feat):
    comp = {}
    o2lo, o2hi = h["o2_pct"]
    plo, phi = h["p_kpa"]
    o2s, o2sum, ps = cond.get("o2", []), cond.get("o2_summary", []), cond.get("p", [])
    joint = [p for p in cond.get("pairs", []) if o2lo <= p[0] <= o2hi and plo <= p[1] <= phi]
    win_o2 = f"{h['name']} window {fmt(o2lo, o2hi, '%')} O2"
    win_p = f"{h['name']} window {fmt(plo, phi, ' kPa')}" if plo > 0 else f"{h['name']} window ≤ {phi:.1f} kPa"
    if o2s or o2sum:
        allv = o2s + o2sum
        if any(o2lo <= v <= o2hi for v in o2s):
            f_, verdict = 1.0, "a per-test value is inside."
        elif any(o2lo <= v <= o2hi for v in o2sum):
            f_, verdict = 0.5, "only a summary-table value is inside (half credit)."
        else:
            f_, verdict = 0.0, "no tested value inside."
        comp["o2"] = (f_, f"Tested ambient O2 {fmt(min(allv), max(allv), '%')}{' (summary table)' if not o2s else ''}; {win_o2}: {verdict}")
    else:
        why = "only the burner's oxidizer-stream O2 is recorded (not the atmosphere)" if cond.get("excluded") else "no ambient O2 in our data"
        comp["o2"] = (0.0, f"Unknown: {why}. Unknown scores 0; it is not evidence of safety.")
    if ps:
        n_in = sum(plo <= v <= phi for v in ps)
        if joint:
            f_, verdict = 1.0, f"{len(joint)} test{'s' if len(joint) != 1 else ''} had pressure and O2 inside the windows together."
        elif n_in:
            f_, verdict = 0.5, ("a tested pressure is inside, but no single test also had O2 inside." if cond.get("pairs")
                                else "a tested pressure is inside, but the table does not say which O2 went with it.") + " Half credit."
        else:
            f_, verdict = 0.0, "no tested value inside."
        comp["pressure"] = (f_, f"Tested pressure {fmt(min(ps), max(ps), ' kPa')}; {win_p}: {verdict}")
    else:
        comp["pressure"] = (0.0, "Unknown: no pressure in our data. Unknown scores 0.")
    f = feat
    comp["flow"] = (FLOW[f["flow"]], f"{FLOW_TXT[f['flow']][0].upper()}{FLOW_TXT[f['flow']][1:]}" + (f' ("{f["flow_quote"]}", {f["flow_where"]}).' if f["flow_quote"] else "."))
    ground = (c.get("index_type") or {}).get("value") == "Ground Investigation"
    if h["gravity"] == "micro":
        comp["gravity"] = (0.0 if ground else 1.0, "Ground investigation; the habitat is in microgravity." if ground else "Flight investigation in microgravity, same as the habitat.")
    else:
        comp["gravity"] = (0.5, f"{'Ground (normal-gravity)' if ground else 'Microgravity'} results; the habitat is at partial gravity, where PSI has no data. Bounds only.")
    comp["material"] = (MAT[f["material_class"]], f"{MAT_TXT[f['material_class']][0].upper()}{MAT_TXT[f['material_class']][1:]} (\"{f['material_quote']}\", {f['material_where']}).")
    tl = c["test_level"]
    comp["data"] = (DATA[tl], {"yes": f"Per-test table: {c['test_rows']} rows.", "summary only": f"Summary table only ({c['summary_rows']} rows).", "no": "No experimental table in our download."}[tl])
    parts = [{"key": k, "label": RULES[k]["label"], "weight": RULES[k]["weight"], "factor": v, "points": round(v * RULES[k]["weight"], 2), "why": why}
             for k, (v, why) in comp.items()]
    return {"psi_id": c["psi_id"], "title": c["fields"]["title"]["value"], "type": (c.get("index_type") or {}).get("value"),
            "score": round(sum(p["points"] for p in parts), 2), "parts": parts,
            "joint_tests": len(joint), "joint_rows": [{"file": p[2], "line": p[3], "o2_pct": p[0], "p_kpa": p[1]} for p in joint[:50]],
            "paired_data": bool(cond.get("pairs")),
            "o2_range_pct": [round(min(o2s + o2sum), 1), round(max(o2s + o2sum), 1)] if (o2s or o2sum) else None,
            "p_range_kpa": [round(min(ps), 1), round(max(ps), 1)] if ps else None,
            "o2_cols": cond.get("o2_cols", []), "p_cols": cond.get("p_cols", []), "excluded_cols": cond.get("excluded", []), "notes": cond.get("notes", [])}


def main():
    sources = json.load(open(MAN / "sources.json"))
    hab = check_habitats(sources)
    cat = json.load(open(ROOT / "data/processed/catalog.json"))
    cond = conditions(cat)
    feat = features(cat)
    if problems:
        print("\n".join("FAIL " + p for p in problems))
        sys.exit(1)
    out = []
    for h in hab:
        rows = [score(h, c, cond.get(c["psi_id"], {}), feat[c["psi_id"]]) for c in cat["investigations"]]
        rows.sort(key=lambda r: (-r["score"], -r["joint_tests"], r["psi_id"]))
        for i, r in enumerate(rows, start=1):
            r["rank"] = i
        out.append({"habitat": h, "rows": rows,
                    "joint_investigations": [{"psi_id": r["psi_id"], "n": r["joint_tests"], "material": feat[r["psi_id"]]["material_class"]} for r in rows if r["joint_tests"]]})
    write_json("ranking.json", {"schema": 1, "rules": RULES, "max_score": sum(r["weight"] for r in RULES.values()), "habitats": out,
                                "sources": {k: {"short": v.get("short", k), "url": v.get("url")} for k, v in sources.items()},
                                "note": "Weights are our design choice, not a NASA rating."})
    for h in out:
        top = h["rows"][0]
        print(f"ranking    {h['habitat']['id']:10s} top {top['psi_id']} {top['score']}; same-test overlap: {h['joint_investigations']}")


if __name__ == "__main__":
    main()

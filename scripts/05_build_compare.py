"""Compare view data -> data/processed/compare.json. Pure rules, no LLM; runs after 04_build_ranking.py.

One row per attribute the brief asks to compare (objectives; fuels and sample/burner; O2 and pressure tested;
flow; measurements; platform; test-level data), one cell per investigation. Every cell carries:
  text  what is shown (verbatim metadata, or a value computed from a named table column)
  src   where it comes from (file + line + key, or file + column)
  key   a normalised value used ONLY to decide whether cells differ (None = free text, never highlighted)
"""
from __future__ import annotations

import csv
import json

from _common import ROOT, write_json

P = ROOT / "data/processed"
MAN = ROOT / "data/manual"
load = lambda n: json.loads((P / n).read_text(encoding="utf-8"))
MAT = {"solid": "Solid materials", "gas_emulating_solid": "Gas flames emulating burning solids", "solid_smoke": "Solids heated to make smoke",
       "liquid": "Liquid droplets", "gas": "Gas flames", "dust": "Dust and aerosol (no flames)"}
FLOW = {"varied": "Forced flow, varied", "single": "One flow speed", "stated": "A flow speed is recorded", "quiescent": "Still air (no forced flow)",
        "not_stated": "Not stated in our data", "not_applicable": "Not applicable (analysis/modelling)"}
ROWS = [("objective", "Objective"), ("material", "Fuel / sample class"), ("hardware", "Hardware (sample, burner or apparatus)"),
        ("o2", "Ambient O2 tested"), ("pressure", "Pressure tested"), ("moon", "Tests with O2 and pressure both in Moon-base air"),
        ("flow", "Flow"), ("measurements", "Measurements in the per-test table"), ("keywords", "Study design keywords"),
        ("platform", "Flight platform"), ("type", "Investigation type"), ("data", "Test-level data in our download")]


def meta(field):
    s = field.get("source") or {}
    return {"file": s.get("file"), "line": s.get("line"), "key": s.get("key")} if s else None


def rng(r, unit, nd=1):
    if not r:
        return None
    lo, hi = r
    return f"{lo:.{nd}f}{unit}" if lo == hi else f"{lo:.{nd}f}–{hi:.{nd}f}{unit}"


def cells(c, rank_row, moon_row, feat):
    f = c["fields"]
    out = {}
    out["objective"] = {"text": f["objective"]["value"], "src": meta(f["objective"]), "key": None}
    out["hardware"] = {"text": f["hardware"]["value"], "src": meta(f["hardware"]), "key": None}
    out["platform"] = {"text": f["platform"]["value"], "src": meta(f["platform"]), "key": (f["platform"]["value"] or "").strip().lower() or None}
    hw = f["hardware"]["value"] or ""
    if "Cygnus" in hw and "Cygnus" not in (f["platform"]["value"] or ""):
        out["platform"]["flag"] = f"Metadata quirk, shown as-is: the hardware field says \"{hw}\"."
    t = c.get("index_type") or {}
    out["type"] = {"text": t.get("value"), "src": t.get("source"), "key": t.get("value")}
    kw = c["keywords"]["value"]
    out["keywords"] = {"text": " · ".join(kw) if kw else None, "src": meta(c["keywords"]), "key": None}
    out["material"] = {"text": MAT[feat["material_class"]], "quote": feat["material_quote"], "src": {"file": "data/manual/investigation_features.csv", "where": feat["material_where"]},
                       "key": feat["material_class"]}
    out["flow"] = {"text": FLOW[feat["flow"]], "quote": feat["flow_quote"] or None, "src": {"file": "data/manual/investigation_features.csv", "where": feat["flow_where"] or None},
                   "key": feat["flow"]}
    o2c, pc = rank_row["o2_cols"], rank_row["p_cols"]
    if rank_row["o2_range_pct"]:
        summary = not rank_row["paired_data"] and c["test_level"] != "yes"
        out["o2"] = {"text": rng(rank_row["o2_range_pct"], "%") + (" (summary table)" if summary else ""),
                     "src": [{"file": x["file"], "column": x["column"]} for x in o2c], "key": rng(rank_row["o2_range_pct"], "%")}
    elif rank_row["excluded_cols"]:
        out["o2"] = {"text": "Only the burner's oxidizer stream is recorded, not the atmosphere", "src": [{"file": x["file"], "column": x["column"]} for x in rank_row["excluded_cols"]], "key": "none"}
    else:
        out["o2"] = {"text": None, "src": None, "key": "none", "missing": "No O2 column in our download"}
    if rank_row["p_range_kpa"]:
        fixed = [x for x in pc if x.get("fixed")]
        out["pressure"] = {"text": rng(rank_row["p_range_kpa"], " kPa") + (f" (stated once: {fixed[0]['fixed']}, not logged per test)" if fixed else ""),
                           "src": [{"file": x["file"], "column": x.get("column"), "note": x.get("why")} for x in pc], "key": rng(rank_row["p_range_kpa"], " kPa")}
    else:
        out["pressure"] = {"text": None, "src": None, "key": "none", "missing": "No pressure in our download"}
    n = moon_row["joint_tests"]
    out["moon"] = {"text": f"{n} test{'s' if n != 1 else ''}" if rank_row["paired_data"] or n else "Cannot tell (no O2 in our data)" if not rank_row["o2_range_pct"] else "Cannot tell (no pressure in our data)" if not rank_row["p_range_kpa"] else "Cannot tell (O2 and pressure not paired per test)",
                   "src": [{"file": r["file"], "line": r["line"]} for r in moon_row["joint_rows"][:3]] or [{"file": "data/processed/ranking.json", "note": "same-test O2+pressure overlap with the Moon-base window (≥30% O2, ≤70.33 kPa)"}],
                   "key": str(n) if (rank_row["paired_data"] or n) else "unknown"}
    per = [tb for tb in c["tables"] if tb["kind"] == "per_test"]
    out["measurements"] = {"text": "; ".join(f"{len(tb['columns'])} columns: " + ", ".join(tb["columns"]) for tb in per) if per else None,
                           "src": [{"file": tb["file"], "line": 1} for tb in per] or None, "key": None,
                           **({} if per else {"missing": "No per-test table in our download"})}
    tl = c["test_level"]
    out["data"] = {"text": {"yes": f"Per-test: {c['test_rows']} rows", "summary only": f"Summary only: {c['summary_rows']} rows", "no": "No experimental table"}[tl],
                   "src": [{"file": tb["file"]} for tb in c["tables"]] or {"note": "our check of data/raw"}, "key": tl}
    return out


def main():
    cat = load("catalog.json")
    rank = load("ranking.json")
    feats = {r["psi_id"]: r for r in csv.DictReader(open(MAN / "investigation_features.csv", newline=""))}
    moon = next(h for h in rank["habitats"] if h["habitat"]["id"] == "moon_base")
    by_moon = {r["psi_id"]: r for r in moon["rows"]}
    invs = []
    for c in cat["investigations"]:
        pid = c["psi_id"]
        invs.append({"psi_id": pid, "title": c["fields"]["title"]["value"], "cells": cells(c, by_moon[pid], by_moon[pid], feats[pid])})
    missing_src = [(i["psi_id"], k) for i in invs for k, v in i["cells"].items() if v.get("text") and not v.get("src")]
    if missing_src:
        raise SystemExit(f"FAIL cells without a source: {missing_src}")
    write_json("compare.json", {"schema": 1, "rows": [{"key": k, "label": l} for k, l in ROWS], "investigations": invs,
                                "default": ["PSI-25", "PSI-69", "PSI-98"],
                                "note": "Cells differ when their normalised values differ; free-text rows (objective, hardware, measurements, keywords) are never marked."})
    print(f"compare    {len(invs)} investigations x {len(ROWS)} attributes")


if __name__ == "__main__":
    main()

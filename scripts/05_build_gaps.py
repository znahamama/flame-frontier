"""Habitat gap report -> data/processed/gaps.json. Pure rules and sentence templates; no LLM, no free prose.

For each habitat profile (data/manual/habitat_profiles.json): the target window (O2, pressure, gravity) next to what
was tested there, and a list of GAPS IN THE DATA, each tied to a region of the Evidence Map
(Panel 1 = O2 vs pressure; Panel 2 = the BASS-II boundary, measured at 1 atm only).

Test sets are the same ones the charts plot:
- solids: Saffire per-test points and SSCE ranges (external_tests.json), BASS-II (bass2_tests.json, o2_initial_pct set;
  1 atm stated in the report). Saffire-I (PSI-98) has no pressure, so it cannot be placed in any window.
- non-solids, for context only: FLEX droplets (flex_tests.json), CFI-G gas flames (cfig_tests.json).
Gaps are phrased as facts about the data ("no test ..."), never as advice.
"""
from __future__ import annotations

import json
from itertools import product

from _common import ROOT, write_json

P = ROOT / "data/processed"
load = lambda n: json.loads((P / n).read_text(encoding="utf-8"))
f1 = lambda x: f"{x:.1f}".rstrip("0").rstrip(".")


def solid_points(ext, bass2):
    pts = []
    for t in ext["tests"]:
        if t["kind"] == "point":
            pts.append({"id": f"Saffire {t['sample']}", "o2": t["o2_pct"][0], "p": t["pressure_kpa"][0], "flow": t["flow_cm_s"], "material": t["material"],
                        "src": {"file": t["source"]["file"], "doc": t["source"]["short"], "locator": t["source"]["locator"], "printed_page": t["source"].get("printed_page")}})
    for t in bass2["tests"]:
        if t["o2_initial_pct"] is None:
            continue
        steps = [s["cm_s"] for s in t["air_display"]["steps"] if s.get("cm_s") is not None] if t["air_display"]["status"].startswith("clean") else []
        pts.append({"id": f"BASS-II {t['id']}", "o2": t["o2_initial_pct"], "p": t["pressure_kpa"], "flows": steps, "material": t["geometry"]["label"],
                    "src": {"file": t["source"]["file"], "line": t["source"]["line"]}})
    return pts


def in_win(o2, p, h):
    return h["o2_pct"][0] <= o2 <= h["o2_pct"][1] and h["p_kpa"][0] <= p <= h["p_kpa"][1]


def window_text(h):
    o = h["o2_pct"]
    p = h["p_kpa"]
    ot = f"{f1(o[0])}% O2" if o[0] == o[1] else f"≥{f1(o[0])}% O2" if o[1] == 100 else f"{f1(o[0])}–{f1(o[1])}% O2"
    pt = f"{f1(p[0])} kPa" if p[0] == p[1] else f"≤{f1(p[1])} kPa" if p[0] == 0 else f"{f1(p[0])}–{f1(p[1])} kPa"
    return f"{ot} at {pt}"


def region(h, pad=False):
    """Panel 1 rectangle for a habitat window; a point window gets a small box so it is visible."""
    o, p = list(h["o2_pct"]), list(h["p_kpa"])
    if pad:
        if o[0] == o[1]:
            o = [o[0] - 12, 100] if o[1] >= 100 else [o[0] - 3, o[1] + 3]
        if p[0] == p[1]:
            p = [p[0] - 5, p[1] + 5]
    return {"panel": 1, "o2": o, "p_kpa": p}


def habitat(h, solids, ssce, flex, cfig, bass2, ref):
    w = window_text(h)
    inside = [s for s in solids if in_win(s["o2"], s["p"], h)]
    ssce_possible = [t for t in ssce if any(in_win(o, p, h) for o, p in product(t["o2_pct"], t["pressure_kpa"]))]
    flex_in = [t for t in flex["tests"] if in_win(t["o2_pct"], t["pressure_kpa"], h)]
    cfig_in = [t for t in cfig["tests"] if in_win(t["o2_pct"], t["pressure_kpa"], h)]
    flows = sorted({s["flow"] for s in inside if s.get("flow") is not None} | {f for s in inside for f in s.get("flows", [])})
    mats = sorted({s["material"] for s in inside})
    gaps, covered = [], []
    reg = region(h, pad=True)

    if not inside:
        top_o2 = max(solids, key=lambda s: s["o2"])
        low_p = min(solids, key=lambda s: s["p"])
        gaps.append({"id": "solid_window", "region": reg,
                     "text": f"No solid-material test in our sources had O2 and pressure in {w} together.",
                     "detail": f"Closest solids: highest O2 {f1(top_o2['o2'])}% ({top_o2['id']}, {f1(top_o2['p'])} kPa); lowest pressure {f1(low_p['p'])} kPa ({low_p['id']}, {f1(low_p['o2'])}% O2)."
                     + (f" SSCE lists up to {f1(max(o for t in ssce for o in t['o2_pct']))}% O2, but every SSCE pressure is ≥{f1(min(p for t in ssce for p in t['pressure_kpa']))} kPa (range markers; pairing not given)." if ssce else ""),
                     "evidence": [top_o2["src"], low_p["src"]]})
    else:
        covered.append({"id": "solid_window", "text": f"{len(inside)} solid-material test{'s' if len(inside) != 1 else ''} had O2 and pressure in {w}: "
                        + ", ".join(s["id"] for s in inside[:8]) + (f" and {len(inside) - 8} more" if len(inside) > 8 else "") + ".",
                        "evidence": [s["src"] for s in inside[:8]]})
        if len(flows) <= 2:
            gaps.append({"id": "flow", "region": reg,
                         "text": f"Inside {w}, solids were burned at {' and '.join(f1(f) + ' cm/s' for f in flows)} airflow only; no solid test in this window at any other flow.",
                         "detail": "Flow is not an axis on Panel 1: every point in the highlighted box shares that flow.", "evidence": [s["src"] for s in inside]})
        else:
            covered.append({"id": "flow", "text": f"Recorded airflows in {w}: {f1(flows[0])}–{f1(flows[-1])} cm/s ({len(flows)} distinct values).", "evidence": []})
        if len(mats) <= 2:
            gaps.append({"id": "materials", "region": reg, "text": f"Only {len(mats)} solid material{'s' if len(mats) != 1 else ''} burned in {w}: {'; '.join(mats)}.",
                         "evidence": [s["src"] for s in inside]})
    if ssce_possible:
        covered.append({"id": "ssce", "text": f"SSCE may have run in {w} ({', '.join(t['material'] for t in ssce_possible)}), but NASA does not say which O2 went with which pressure, so no SSCE flight can be placed.", "evidence": []})

    p2 = ref["panel2"]
    p_b = bass2["constants"]["pressure_kpa"]
    if not (h["p_kpa"][0] <= p_b <= h["p_kpa"][1]):
        gaps.append({"id": "boundary", "region": {"panel": 2},
                     "text": f"No flammability boundary (where a solid stops burning) was measured in {w}. The only one in our data, BASS-II eq. 6.1 for PMMA rods, was measured at {f1(p_b)} kPa.",
                     "evidence": [p2["source"]]})
    else:
        covered.append({"id": "boundary", "text": f"A flammability boundary exists at this pressure: BASS-II eq. 6.1 (PMMA rods, {f1(p_b)} kPa), post-burn O2 minimum {p2['minimum']['x_o2']}%.", "evidence": [p2["source"]]})

    if h["gravity"] == "partial":
        gaps.append({"id": "gravity", "region": {"panel": 1, "all": True},
                     "text": "No combustion test at partial gravity: every point on both panels is from microgravity.",
                     "detail": f"Challenge page: \"{h['gravity_quote'] if 'partial-gravity' in h['gravity_quote'] else 'there is currently no partial-gravity combustion data available in PSI'}\".",
                     "evidence": [{"doc": "Space Apps 2026 challenge page", "file": "docs/ref/challenge_brief.md"}]})
    else:
        covered.append({"id": "gravity", "text": "Microgravity, as in every flight investigation on the map.", "evidence": []})

    context = [f"Non-solid tests in {w}: {len(cfig_in)} CFI-G gas flames, {len(flex_in)} FLEX liquid droplets. They do not close a solid-material gap."]
    return {"habitat": {k: h[k] for k in ("id", "name", "o2_pct", "p_kpa", "gravity")}, "window": w, "region": reg,
            "target_sources": {"o2": {"source": h["o2_source"], "quote": h["o2_quote"], "page": h.get("o2_page")},
                               "p": {"source": h["p_source"], "quote": h["p_quote"], "page": h.get("p_page"), "as_stated": h.get("p_as_stated")},
                               "gravity": {"source": h["gravity_source"], "quote": h["gravity_quote"], "note": h.get("gravity_note")}},
            "tested": {"solids_inside": len(inside), "flows_cm_s": flows, "materials": mats, "gas_inside": len(cfig_in), "liquid_inside": len(flex_in)},
            "gaps": gaps, "covered": covered, "context": context}


def main():
    hab = json.loads((ROOT / "data/manual/habitat_profiles.json").read_text())["habitats"]
    ext, bass2, flex, cfig, ref = (load(n) for n in ("external_tests.json", "bass2_tests.json", "flex_tests.json", "cfig_tests.json", "reference.json"))
    solids = solid_points(ext, bass2)
    ssce = [t for t in ext["tests"] if t["kind"] != "point"]
    out = [habitat(h, solids, ssce, flex, cfig, bass2, ref) for h in hab]
    write_json("gaps.json", {"schema": 1, "habitats": out,
                             "note": "Gaps in the data we have, phrased as facts about the tests, not as recommendations. Generated from sentence templates; no AI text."})
    for h in out:
        print(f"gaps       {h['habitat']['id']:10s} solids inside {h['tested']['solids_inside']:3d}; gaps: {[g['id'] for g in h['gaps']]}")


if __name__ == "__main__":
    main()

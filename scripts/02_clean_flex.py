"""FLEX (PSI-69) per-test table -> data/processed/flex_tests.json. Pure rules, no LLM.

Liquid-fuel DROPLETS (methanol, heptane), not solid materials: plotted on Panel 1 as its own layer, never
counted in the solid-material headline.
- File is cp1252; "–" (en dash) marks a missing value.
- Pressure column is mmHg (1 mmHg = 101.325/760 kPa). O2 is "initial ambient composition; mole fraction".
- Moon-base zone uses the same inclusive bounds as Panel 1 (O2 >= 30 %, P <= 10.2 psi = 70.33 kPa).
"""
from __future__ import annotations

import csv

from _common import PSI_TO_KPA, ROOT, write_json

SRC = ROOT / "data/raw/PSI-69/PSI-69_Experimental table_FLEX.csv"
MMHG_TO_KPA = 101.325 / 760
ZONE_O2, ZONE_P = 30.0, round(10.2 * PSI_TO_KPA, 2)


def num(s):
    s = (s or "").strip()
    if s in ("", "–", "-"):
        return None
    return float(s)


def main():
    rows = list(csv.reader(SRC.read_bytes().decode("cp1252").splitlines()))
    head = [h.strip() for h in rows[0]]
    col = {h: i for i, h in enumerate(head)}
    tests, flags = [], []
    for line, r in enumerate(rows[1:], start=2):
        g = lambda h: r[col[h]].strip()
        p_mmhg, o2 = num(g("Ambient pressure; mmHg")), num(g("O initial ambient composition; mole fraction"))
        if p_mmhg is None or o2 is None:
            flags.append({"test": g("FLEX Test #"), "line": line, "issue": "missing pressure or O2"})
            continue
        if p_mmhg <= 0:
            flags.append({"test": g("FLEX Test #"), "line": line, "issue": f"pressure {p_mmhg} mmHg: impossible for a burning droplet; not plotted"})
            continue
        p = round(p_mmhg * MMHG_TO_KPA, 2)
        o2p = round(o2 * 100, 2)
        tests.append({
            "id": g("FLEX Test #"), "flex_identifier": g("FLEX Identifier"), "date": g("Test Date"), "fuel": g("Fuel"),
            "pressure_mmhg": p_mmhg, "pressure_kpa": p, "o2_pct": o2p, "o2_basis": "initial ambient mole fraction x 100",
            "n2_frac": num(g("N initial ambient composition; mole fraction")),
            "co2_frac": num(g("CO initial ambient composition; mole fraction")),
            "he_frac": num(g("He initial ambient composition; mole fraction")),
            "d0_mm": num(g("Droplet initial diameter; mm")), "test_end": g("Test end"),
            "in_moon_zone": o2p >= ZONE_O2 and p <= ZONE_P,
            "source": {"file": str(SRC.relative_to(ROOT)), "line": line},
        })
    zone = [t for t in tests if t["in_moon_zone"]]
    # Closest misses: >= 30 % O2 but above the zone's pressure limit, within 2 kPa of it.
    near = sorted((t for t in tests if t["o2_pct"] >= ZONE_O2 and ZONE_P < t["pressure_kpa"] <= ZONE_P + 2), key=lambda t: t["pressure_kpa"])
    write_json("flex_tests.json", {
        "schema": 1, "count": len(tests), "tests": tests, "skipped": flags,
        "moon_zone": {"count": len(zone), "ids": [t["id"] for t in zone],
                      "by_end": {e: sum(t["test_end"] == e for t in zone) for e in sorted({t["test_end"] for t in zone})},
                      "o2_min_pct": ZONE_O2, "p_max_kpa": ZONE_P,
                      "near_misses": [{"id": t["id"], "o2_pct": t["o2_pct"], "pressure_kpa": t["pressure_kpa"], "fuel": t["fuel"],
                                       "test_end": t["test_end"], "source": t["source"]} for t in near]},
        "material_class": "liquid droplets (methanol, heptane), not solid materials",
        "units": {"pressure": "mmHg in source; kPa = mmHg x 101.325/760", "o2": "mole fraction in source; % = x100"},
    })
    print(f"flex       {len(tests)} tests, {len(zone)} in Moon-base zone, {len(flags)} skipped")


if __name__ == "__main__":
    main()

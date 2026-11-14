"""Reference layers for the Evidence Map: brief-derived marks (Panel 1) and the
BASS-II published flammability boundary (Panel 2). No NASA test data here; no LLM.

Output: data/processed/reference.json
"""
from __future__ import annotations

import math

import json

from _common import BASS2_REPORT, CHALLENGE_BRIEF, PROCESSED, PSI_TO_KPA, write_json

R0_CM = 0.318  # base rod radius, report sec 6.1.4.4 p.75


def boundary_xo2(a: float) -> float:
    """Report eq. (6.1), sec 6.1.4.4, printed p.75: X_O2 = 6 exp(-0.5a) + 0.0167a + 13.4."""
    return 6 * math.exp(-0.5 * a) + 0.0167 * a + 13.4


def boundary_min() -> tuple[float, float]:
    # dX/da = -3 exp(-0.5a) + 0.0167 = 0  ->  a* = -2 ln(0.0167/3)
    a_star = -2 * math.log(0.0167 / 3)
    return a_star, boundary_xo2(a_star)


def r(x: float, n: int = 4) -> float:
    return round(x, n)


def panel1() -> dict:
    kpa = lambda psi: r(psi * PSI_TO_KPA, 2)
    brief = CHALLENGE_BRIEF["doc"]
    pp_lines = []
    for pp, label in [(21.2, "Same pO2 as Earth sea-level air"), (29.6, "Same pO2 as spacesuit")]:
        pts = [[p, r(100 * pp / p, 2)] for p in range(10, 211, 2) if 100 * pp / p <= 100]
        pp_lines.append({"pp_o2_kpa": pp, "label": f"{label} (pO2 = {pp} kPa)", "points": pts,
                         "source": "Derived: O2% = 100 * pO2 / P_total (Dalton's law)"})
    p_max = kpa(10.2)
    return {
        "x_axis": "Total pressure (kPa)",
        "y_axis": "O2 before ignition (mol % = vol %)",
        "x_max": 210,
        "spacesuit": {"o2_pct": 100, "p_kpa": kpa(4.3), "label": "Spacesuit: 100% O2 at 4.3 psi (4.3 x 6.894757 = 29.65 kPa)",
                      "source": brief},
        "earth_sea_level": {"p_kpa": kpa(14.7), "label": "Earth sea level, 14.7 psi", "source": brief},
        "moon_base_zone": {
            "o2_min_pct": 30, "p_max_kpa": p_max,
            "label": f"Moon base / pressurized rover: O2 >= 30% and P <= 10.2 psi (10.2 x 6.894757 = {p_max} kPa). "
                     "Boundaries inclusive. The brief gives no lower pressure bound, so the zone is drawn down to 0 kPa.",
            "source": brief},
        "pp_o2_lines": pp_lines,
    }


def panel2(bass2: dict) -> dict:
    a_star, x_min = boundary_min()
    curve = [[r(a, 3), r(boundary_xo2(a))] for a in [0.25 * i for i in range(1, 9)] + list(range(3, 201))]
    page = 75
    return {
        "x_axis": "Stretch rate a (1/s), a = (3/2)(U/r)(r/r0)^0.5, r0 = 0.318 cm",
        "y_axis": "Post-burn (final) O2, % by vol",
        "equation": "X_O2 = 6 exp(-0.5 a) + 0.0167 a + 13.4",
        "r0_cm": R0_CM,
        "curve": curve,
        # From 02_clean_bass2.py: min/max stretch over every Olson flow recorded in cm/s.
        "tested_a_range": bass2.get("panel2_tested_a_range"),
        "tested_a_note": bass2.get("panel2_tested_a_note"),
        "minimum": {"a": r(a_star, 2), "x_o2": r(x_min, 2),
                    "note": "Computed from eq. 6.1; report text says 'a = 8 to 12 1/s at approximately 13.5 percent O2'"},
        "source": {**BASS2_REPORT, "section": "6.1.4.4", "printed_page": page,
                   "pdf_page": page + BASS2_REPORT["pdf_page_offset"], "equation_no": "6.1"},
    }


if __name__ == "__main__":
    bass2_path = PROCESSED / "bass2_tests.json"
    bass2 = json.loads(bass2_path.read_text()) if bass2_path.exists() else {}
    write_json("reference.json", {"schema": 1, "panel1": panel1(), "panel2": panel2(bass2)})

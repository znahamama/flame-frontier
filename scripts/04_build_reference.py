"""Reference layers for the Evidence Map: brief-derived marks (Panel 1) and the
BASS-II published flammability boundary (Panel 2). No NASA test data here; no LLM.

Output: data/processed/reference.json
"""
from __future__ import annotations

import math

from _common import BASS2_REPORT, CHALLENGE_BRIEF, PSI_TO_KPA, write_json

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
        "bass2_placeholder": {
            "p_kpa": 101.33, "x0": 100.7, "x1": 102.0, "y0": 13, "y1": 23,
            "label": "BASS-II (PSI-25): pending data",
            "tip": "130 ISS runs at 1 atm (101.33 kPa). Points pending the PSI table download. "
                   "This strip only reserves layout; its O2 extent is NOT data.",
            "source": {**BASS2_REPORT, "section": "pressure stated on printed p.11 and p.94", "printed_page": 11}},
        "pp_o2_lines": pp_lines,
    }


def panel2() -> dict:
    a_star, x_min = boundary_min()
    curve = [[r(a, 3), r(boundary_xo2(a))] for a in [0.25 * i for i in range(1, 9)] + list(range(3, 201))]
    page = 75
    return {
        "x_axis": "Stretch rate a (1/s), a = (3/2)(U/r)(r/r0)^0.5, r0 = 0.318 cm",
        "y_axis": "Post-burn (final) O2 (% by volume)",
        "equation": "X_O2 = 6 exp(-0.5 a) + 0.0167 a + 13.4",
        "r0_cm": R0_CM,
        "curve": curve,
        # Filled by the BASS-II cleaning step from the min/max a of Olson PMMA rod points.
        # Until then the frontend draws the whole curve dashed (untested).
        "tested_a_range": None,
        "minimum": {"a": r(a_star, 2), "x_o2": r(x_min, 2),
                    "note": "Computed from eq. 6.1; report text says 'a = 8 to 12 1/s at approximately 13.5 percent O2'"},
        "source": {**BASS2_REPORT, "section": "6.1.4.4", "printed_page": page,
                   "pdf_page": page + BASS2_REPORT["pdf_page_offset"], "equation_no": "6.1"},
    }


if __name__ == "__main__":
    write_json("reference.json", {"schema": 1, "panel1": panel1(), "panel2": panel2()})

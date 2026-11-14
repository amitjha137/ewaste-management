"""
Bin fill level from the DFRobot 8x8 ToF sensor (SEN0628).

The sensor sits at the top of the bin looking DOWN. It returns 64 distances in mm.
When the bin is empty every pixel sees the bottom; as waste piles up the distances shrink.

    fill_i = (1 - d_i / base_i) / (1 - full_distance / ref)

  base_i         distance of pixel i when the bin was empty (saved by --fill-calibrate)
  ref            median of the empty-bin distances (straight-down distance)
  full_distance  distance from the sensor to the waste surface when the bin counts as 100 % full
Dividing by base_i keeps it correct for the slanted pixels at the edge of the 60 deg field of view.
"""
import json
from pathlib import Path

import numpy as np

CAL_FILE = Path(__file__).resolve().parent / "fill_calibration.json"
INVALID_MM = 4000      # the sensor reports 4000 when nothing is returned
MIN_VALID_MM = 30      # below this the reading is unreliable (sensor minimum is 20 mm)
FULL_ON = 85.0         # level that switches status to "full"
FULL_OFF = 70.0        # level it must drop below to leave "full" (hysteresis)


def parse_matrix(line):
    """'MATRIX 1,2,...,64' -> (8, 8) float array, or None."""
    if not line or not line.startswith("MATRIX"):
        return None
    try:
        vals = [float(v) for v in line.split(None, 1)[1].split(",")]
    except (IndexError, ValueError):
        return None
    if len(vals) != 64:
        return None
    return np.array(vals, dtype=float).reshape(8, 8)


def _clean(frame):
    f = np.array(frame, dtype=float)
    f[(f < MIN_VALID_MM) | (f >= INVALID_MM)] = np.nan
    return f


def _median_frame(frames):
    stack = np.stack([_clean(f) for f in frames])
    with np.errstate(all="ignore"):
        return np.nanmedian(stack, axis=0)


class FillMeter:
    def __init__(self, full_distance_mm=100.0, percentile=80.0, floor_tolerance=0.15, cal_file=CAL_FILE):
        self.full_distance = float(full_distance_mm)
        self.percentile = float(percentile)
        self.tol = float(floor_tolerance)
        self.cal_file = Path(cal_file)
        self.baseline = None
        self.status = "available"
        self.load()

    def load(self):
        if self.cal_file.exists():
            data = json.loads(self.cal_file.read_text())
            self.baseline = np.array(data["baseline"], dtype=float).reshape(8, 8)
            self.full_distance = float(data.get("full_distance_mm", self.full_distance))
            return True
        return False

    def calibrate(self, frames):
        """Call with the bin EMPTY. Saves the baseline."""
        base = _median_frame(frames)
        if np.isnan(base).sum() > 26:      # more than ~40 % of pixels had no valid reading
            raise ValueError("Too many invalid pixels while calibrating. Check mounting, the protective film and the distance.")
        ref = float(np.nanmedian(base))
        if ref <= self.full_distance + 20:
            raise ValueError(f"Empty-bin distance ({ref:.0f} mm) is not larger than the full distance ({self.full_distance:.0f} mm).")
        base = np.where(np.isnan(base), ref, base)   # fill gaps with the typical distance
        self.baseline = base
        self.cal_file.write_text(json.dumps({
            "baseline": base.round(1).flatten().tolist(),
            "full_distance_mm": self.full_distance,
        }))
        return ref

    def level(self, frames):
        """frames: list of (8, 8) arrays taken while the bin is quiet. Returns a dict or None."""
        if self.baseline is None:
            raise RuntimeError("Not calibrated. Run with --fill-calibrate on an empty bin first.")
        frame = _median_frame(frames)
        base = self.baseline
        ref = float(np.median(base))
        floor = base >= (1 - self.tol) * ref          # ignore pixels that look at the bin wall
        usable = floor & ~np.isnan(frame)
        if int(usable.sum()) < 16:
            return None
        with np.errstate(all="ignore"):
            fill = (1 - frame / base) / (1 - self.full_distance / ref)
        fill = np.clip(fill[usable], 0, 1)
        level = float(np.percentile(fill, self.percentile)) * 100
        if level >= FULL_ON:
            self.status = "full"
        elif level < FULL_OFF:
            self.status = "available"
        return {
            "level": round(level, 1),
            "average": round(float(fill.mean()) * 100, 1),
            "status": self.status,
            "pixels": int(usable.sum()),
            "median_mm": round(float(np.nanmedian(frame)), 0),
        }

"""Transparent electrical-loss calculations used by the screening dashboard.

The supplied CSVs contain node centroids and observed flows, but not surveyed
line routes, conductor geometry, voltage, or thermal ratings.  The original
engineering-grade function therefore remains guarded.  This module also
provides an explicitly labelled *scenario proxy*: centroid-to-centroid
Haversine distance plus visible default assumptions.  It is useful for
explaining the physics and comparing reroute scenarios, not for dispatch.
"""

from math import asin, cos, radians, sin, sqrt


REQUIRED_PARAMETERS = ("line_voltage_kv", "resistance_ohm", "line_length_km", "power_factor")

DEFAULT_LINE_VOLTAGE_KV = 400.0
DEFAULT_POWER_FACTOR = 0.95
DEFAULT_RESISTIVITY_OHM_M = 1.68e-8  # copper at approximately 20°C
DEFAULT_CROSS_SECTION_MM2 = 2000.0    # assumed total conductor/bundle area


def haversine_distance_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    """Return great-circle distance between two WGS84-like coordinates."""
    radius_km = 6371.0088
    lat_delta = radians(float(latitude_b) - float(latitude_a))
    lon_delta = radians(float(longitude_b) - float(longitude_a))
    first = sin(lat_delta / 2) ** 2 + cos(radians(float(latitude_a))) * cos(radians(float(latitude_b))) * sin(lon_delta / 2) ** 2
    return 2 * radius_km * asin(sqrt(max(0.0, min(1.0, first))))


def calculate_three_phase_loss(power_flow_mw: float, line_voltage_kv: float, resistance_ohm: float, line_length_km: float, power_factor: float) -> dict:
    values = {
        "line_voltage_kv": line_voltage_kv,
        "resistance_ohm": resistance_ohm,
        "line_length_km": line_length_km,
        "power_factor": power_factor,
    }
    missing = [name for name, value in values.items() if value is None]
    if missing:
        return {"status": "unavailable", "missing_parameters": missing, "label": "engineering-grade physical loss unavailable"}
    if any(value <= 0 for value in values.values()):
        raise ValueError("Line voltage, resistance, line length, and power factor must be positive")
    # The SRS formula assumes R is the total resistance of the modeled line.
    # Length is required as a data-contract field even when R is already total.
    apparent_power_va = abs(power_flow_mw) * 1_000_000 / power_factor
    current_a = apparent_power_va / (sqrt(3) * line_voltage_kv * 1_000)
    loss_mw = 3 * current_a**2 * resistance_ohm / 1_000_000
    return {
        "status": "physical",
        "power_flow_mw": power_flow_mw,
        "current_a": current_a,
        "loss_mw": loss_mw,
        "parameters": values,
        "label": "three-phase engineering loss estimate",
    }


def calculate_distance_loss_proxy(
    power_flow_mw: float,
    distance_km: float,
    line_voltage_kv: float = DEFAULT_LINE_VOLTAGE_KV,
    power_factor: float = DEFAULT_POWER_FACTOR,
    resistivity_ohm_m: float = DEFAULT_RESISTIVITY_OHM_M,
    cross_section_mm2: float = DEFAULT_CROSS_SECTION_MM2,
) -> dict:
    """Estimate three-phase I²R loss from distance and explicit assumptions.

    Resistance is derived from R = rho * L / A.  The distance is a geodesic
    between country-centroid coordinates; real line corridors will differ.
    """
    values = {
        "distance_km": distance_km,
        "line_voltage_kv": line_voltage_kv,
        "power_factor": power_factor,
        "resistivity_ohm_m": resistivity_ohm_m,
        "cross_section_mm2": cross_section_mm2,
    }
    if any(value is None for value in values.values()):
        return {"status": "unavailable", "missing_parameters": [name for name, value in values.items() if value is None], "label": "distance-based loss proxy unavailable"}
    if any(float(value) <= 0 for value in values.values()):
        raise ValueError("Distance, voltage, power factor, resistivity, and cross-section must be positive")
    area_m2 = float(cross_section_mm2) * 1e-6
    resistance_ohm = float(resistivity_ohm_m) * float(distance_km) * 1000 / area_m2
    physical = calculate_three_phase_loss(power_flow_mw, float(line_voltage_kv), resistance_ohm, float(distance_km), float(power_factor))
    flow_mw = abs(float(power_flow_mw))
    return {
        **physical,
        "status": "proxy_estimate",
        "distance_km": float(distance_km),
        "resistance_ohm": resistance_ohm,
        "loss_pct_of_flow": physical["loss_mw"] / flow_mw if flow_mw else 0.0,
        "loss_method": "Haversine centroid distance + assumed conductor",
        "label": "simplified distance-based three-phase loss proxy",
        "assumptions": {
            "line_voltage_kv": float(line_voltage_kv),
            "power_factor": float(power_factor),
            "resistivity_ohm_m": float(resistivity_ohm_m),
            "cross_section_mm2": float(cross_section_mm2),
        },
    }

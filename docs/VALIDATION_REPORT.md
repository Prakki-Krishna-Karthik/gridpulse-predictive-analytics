# Validation report

This report is generated from the supplied CSVs by `backend/pipeline.py`.

## Dataset checks

- Dynamic rows: 315,598.
- Power-flow rows: 1,262,592.
- Countries: 12.
- Canonical physical links: 24.
- Dynamic missing cells: 0.
- Power-flow missing cells: 0.
- Duplicate composite keys: 0.
- Country timestamp gap hours: 38 across CH, CZ, DK, FR, NO, PL, and SE.
- Interconnector aliases normalized: 7, including `DE_FR → DE-FR` and `NL_NO → NL-NO`.

## Model comparison

The pipeline uses a 168-point chronological walk-forward holdout for each country net-flow series. The current generated artifacts select **Persistence** because it has the lowest pooled RMSE.

| Model | MAE (MW) | RMSE (MW) | MAPE | Accuracy | Precision | Recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Persistence | 375.8 | 580.3 | 61.0% | 91.4% | 81.3% | 81.1% | 81.2% |
| 24h moving average | 947.1 | 1363.4 | 227.6% | 81.3% | 61.5% | 55.5% | 57.9% |
| Linear trend | 1156.9 | 1604.8 | 205.6% | 74.4% | 49.7% | 54.1% | 51.2% |
| Seasonal naive (24h) | 1310.5 | 1994.7 | 324.2% | 75.4% | 51.3% | 51.9% | 51.6% |

Because net flow can be close to zero or change sign, MAPE is unstable here. It is included for course completeness; MAE, RMSE, and class metrics should be emphasized in the presentation.

## Engineering-data check

The application now exposes a transparent distance-based scenario proxy. For every canonical link it computes Haversine distance between the supplied country coordinates, derives `R = ρL/A`, and estimates `P_loss = 3I²R` from observed flow. The displayed defaults are 400 kV, 0.95 power factor, copper resistivity `1.68e-8 Ω·m`, and 2,000 mm² cross-section.

This is not an engineering study: the files do not contain surveyed line corridors, conductor/bundle construction, actual voltage, thermal capacity, reactive power, or N-1 constraints. The dashboard labels the engineering-grade status as unavailable and keeps the proxy assumptions visible.

The route planner removes a selected link, requests a chosen flow share, and uses a shortest-path search with hard proxy guardrails: sufficient headroom and no Critical links. Its soft objective penalizes distance, utilization, warning/critical state, and loss. If no fully feasible path exists, the UI shows the best-effort path and names the bottlenecks instead of presenting it as safe.

## Verification status

- Pipeline runs end to end on the supplied files.
- Canonicalization is deterministic and recorded.
- Forecast selection is reproducible from the saved JSON artifacts.
- Backend endpoints are covered by smoke tests in `tests/test_api.py`.
- Distance-loss and route guardrails are covered by `tests/test_pipeline.py` and `tests/test_routing.py`.
- Browser rendering should be checked by starting the server and opening `http://localhost:8000`; no operational claim depends on the dashboard alone.


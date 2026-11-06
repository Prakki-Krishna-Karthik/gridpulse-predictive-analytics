# GridPulse

GridPulse is a local, real-time replay dashboard for graph-based predictive and prescriptive analytics on cross-border power-flow data. It combines a canonical country/interconnector graph, chronological model comparison, animated network monitoring, uncertainty-aware forecasts, data-quality evidence, and recommendation-only what-if analysis.

The project is designed for the Predictive Analytics course outcomes in the supplied syllabus: preprocessing and validation, regression-style forecasting, model comparison, classification metrics, class imbalance awareness, time-series analysis, and decision support.

## The project idea

The strongest project contribution is a data-quality-aware grid digital twin:

1. Directional records are merged into canonical physical links, with alias normalization recorded instead of hidden.
2. A screening risk score combines flow-envelope utilization, imbalance, and load residuals.
3. Forecast selection is evidence-driven. Four transparent baselines compete under chronological walk-forward validation; the best RMSE is selected automatically.
4. Each link derives a Haversine centroid distance, resistance, and I²R loss estimate from visible scenario assumptions: 400 kV, 0.95 power factor, copper resistivity, and 2,000 mm² area.
5. A stress-aware counterfactual studio searches alternate graph paths, rejects critical links or insufficient proxy headroom, and compares loss before/after the move.
6. The dashboard streams historical observations as a live replay so the end-to-end interface can be demonstrated without a utility connection.
7. A graph-intelligence layer propagates local stress through neighboring countries and performs counterfactual edge-removal screening, so the dashboard can explain why a node or interconnector becomes influential before showing a reroute.

This is an applied systems novelty, not a claim that a new GNN architecture has been scientifically proven. The project now includes a reproducible DCRNN benchmark alongside Fusion GRU and classical baselines. The graph model is evidence for comparison, not a claim that it is ready for grid operation.

## Run locally

The dashboard backend and frontend use Python and browser APIs. When the research dependencies and saved checkpoints are present, `backend/server.py` loads the trained Fusion GRU and DCRNN for real forecast inference; the classical baselines remain available as a lightweight fallback. The experiment runner adds NumPy, PyTorch, scikit-learn, pandas, and Matplotlib to produce research-grade result artifacts.

```powershell
cd "C:\Users\Krishna Karthik\Desktop\predictive-proj"
python backend/pipeline.py
python backend/server.py
```

Open [http://localhost:8000](http://localhost:8000).

To regenerate the saved training and evaluation results used in the research presentation:

```powershell
python -m pip install -r backend/requirements.txt
python backend/pipeline.py
python backend/experiments.py
```

The experiment runner writes `results/` with dataset profile, preprocessing steps, feature catalog, Fusion GRU and DCRNN training/validation curves, ROC and precision-recall data, confusion matrices, baseline comparison metrics, saved model checkpoints, t-SNE hidden-state coordinates, feature permutation/ablation results, error-analysis examples, and light-background review figures. The presentation reads these saved artifacts rather than inventing values inside the slides.

The dashboard forecast endpoint uses the same 24-hour engineered feature window and training-only scaling as the experiment runner. Selecting Fusion GRU or DCRNN returns `engine: trained_checkpoint`; selecting Persistence, moving average, seasonal naive, or linear trend returns `engine: deterministic_baseline`.

The graph-analysis artifact generator can be run independently after the pipeline:

```powershell
python backend/graph_analysis.py
```

It writes `results/graph_stress_analysis.json`, `results/graph_stress_timeline.csv`, `results/graph_resilience_ranking.csv`, and four figures under `results/figures/`: propagated node stress, counterfactual resilience ranking, historical stress timeline, and node influence. These are topology-and-flow screening results; they are not a replacement for AC power flow, thermal limits, voltage stability, or formal N-1 security assessment.

The DCRNN keeps the 12-node graph dimension intact. At every recurrent step it applies two-step forward and reverse random-walk diffusion over the 24 canonical links, then updates a graph-aware hidden state for every country. The experiment uses the same 24-hour lookback, training-only scaling, chronological validation, and 168-hour holdout as Fusion GRU.

The pipeline defaults to the two supplied CSV paths. To use a different copy:

```powershell
$env:DYNAMIC_CSV = "C:\path\to\dynamic_with_flows.csv"
$env:POWER_FLOW_CSV = "C:\path\to\power_flow.csv"
python backend/pipeline.py
```

The raw CSVs stay outside the repository. The pipeline writes compact, reproducible artifacts to `data/processed/` so the dashboard does not load 150 MB of raw data into the browser.

## Architecture

The full component-level system-design diagram is available here: [backend system architecture](docs/backend_system_architecture.svg).
The end-to-end analytical flowchart is available here: [end-to-end workflow architecture](docs/end_to_end_workflow_architecture.svg).

```text
dynamic_with_flows.csv ─┐
                        ├─ backend/pipeline.py ─ data/processed/*.json
power_flow.csv ─────────┘                  │
                                           ▼
                            backend/server.py (REST + SSE)
                                           │
                                           ▼
                              frontend/index.html + app.js
```

API routes include `/api/health`, `/api/metadata`, `/api/topology`, `/api/snapshot`, `/api/forecast`, `/api/metrics`, `/api/validation`, `/api/physical-loss`, `/api/route-plan`, `/api/recommendations`, `/api/what-if`, and `/api/stream`. Each snapshot now also carries `graph_analysis`, containing propagated node-risk rankings, edge criticality, topology impact, and the method caveat used by the new Graph intelligence view.

## Important limitations

- The supplied files do not contain surveyed line geometry, conductor data, actual voltage, power factor, or thermal capacity. The app therefore reports a clearly labeled distance-based scenario proxy, not engineering-grade loss. It uses centroid distance with 400 kV, 0.95 PF, copper ρ = 1.68e-8 Ω·m, and 2,000 mm² as replaceable assumptions.
- The streaming view is a historical replay, not a live utility telemetry connector. The API shape is ready for a future Kafka, MQTT, or utility API adapter.
- Recommendations are screening suggestions. They do not dispatch generation, switch substations, or operate a grid.
- MAPE is shown for completeness, but net flow can approach zero and cross sign, so MAE/RMSE and classification F1 should carry more weight.

## Supporting documents

- [Project SRS](docs/SRS.md)
- [Research review and novelty rationale](docs/RESEARCH_NOTES.md)
- [Validation report](docs/VALIDATION_REPORT.md)
- [User manual](docs/USER_MANUAL.md)
- [Final presentation outline](docs/FINAL_PRESENTATION_OUTLINE.md)


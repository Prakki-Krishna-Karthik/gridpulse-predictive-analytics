# Contribution statement for three group members

Use these statements only after matching them with the work each person actually performed. If all three people worked on every part, replace “I led” with “I co-developed”.

## Person 1 — Data and foundation

> I led the problem definition, dataset understanding, data-quality checks, preprocessing, canonical country/interconnector mapping, feature extraction, and graph representation. I converted the raw CSV records into a consistent model-ready network view.

Main evidence:

- `backend/pipeline.py`
- `data/processed/`
- `docs/SRS.md`
- dataset profile and preprocessing artifacts in `results/`

## Person 2 — Predictive system and application workflow

> I led the technology-stack integration, forecasting workflow, baseline comparison, evaluation metrics, API connection, dashboard behavior, physical-loss equations, and prescriptive routing workflow. I connected the analytical results to an operator-facing interface.

Main evidence:

- `backend/server.py`
- `backend/routing.py`
- `backend/physics.py`
- `frontend/index.html`
- `frontend/app.js`
- `frontend/styles.css`

## Person 3 — Advanced research models and interpretation

> I led the Fusion GRU and DCRNN research experiments, training curves, model comparison, feature-interpretation graphs, error analysis, research review, and the explanation of why graph context did or did not improve this dataset.

Main evidence:

- `backend/experiments.py`
- `results/models/`
- `results/figures/`
- `results/model_comparison.csv`
- `docs/RESEARCH_NOTES.md`

## Shared contribution

> All three members contributed to requirements analysis, testing, interpretation of results, presentation preparation, and discussion of limitations. The project is a group-built decision-support prototype; it is not an automatic grid-control system.


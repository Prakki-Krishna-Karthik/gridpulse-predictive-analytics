# Upload checklist for ChatGPT Web

Upload the following items with `01_COPY_PASTE_PROMPT.txt`.

## Required

- `README.md` — project overview and run instructions.
- `docs/SRS.md` — system requirements and intended modules.
- `docs/USER_MANUAL.md` — dashboard behavior and user workflow.
- `backend/pipeline.py` — preprocessing, baseline models, and data preparation.
- `backend/experiments.py` — Fusion GRU, DCRNN, training, evaluation, and result generation.
- `backend/routing.py` — prescriptive rerouting logic.
- `backend/server.py` — API endpoints and website forecast behavior.
- `frontend/index.html` — visible dashboard structure.
- `frontend/app.js` — charts, controls, API integration, and animations.
- `frontend/styles.css` — interface styling.
- `results/` — saved graphs, metrics, JSON, and CSV results.
- `data/processed/` — processed data and selected-model information.

## Dataset files

Also upload the original CSV files:

- `dynamic_with_flows.csv`
- `power_flow.csv`

## Optional but useful

- `docs/RESEARCH_NOTES.md` — research context and novelty.
- `docs/VALIDATION_REPORT.md` — validation limitations and metric interpretation.
- `results/README.md` — description of generated experiment outputs.
- screenshots of the dashboard — useful for explaining the visual interface.

## Upload order if ChatGPT has a file limit

1. `README.md`, `docs/`, and `results/README.md`.
2. `backend/pipeline.py`, `backend/experiments.py`, `backend/routing.py`, and `backend/server.py`.
3. `frontend/`.
4. The two CSV datasets and `data/processed/`.

Do not upload temporary folders such as `.chart-data-*`, `.codex-docx-build`, or `.codex-ppt-build` unless specifically requested.


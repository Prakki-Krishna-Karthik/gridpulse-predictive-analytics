# Beginner-friendly project structure

```text
predictive-proj/
├── backend/
│   ├── pipeline.py       Clean data, create features, compare baseline models
│   ├── experiments.py    Train Fusion GRU and DCRNN; create research results
│   ├── routing.py        Test alternate routes and calculate reroute outcomes
│   ├── physics.py        Estimate distance, resistance, current, and loss
│   └── server.py         Provide APIs used by the browser dashboard
│
├── frontend/
│   ├── index.html        Dashboard sections and visible controls
│   ├── app.js            Fetch data, draw charts, animate the grid, show results
│   └── styles.css        Colors, layout, panels, responsive design
│
├── data/
│   ├── raw/              Original input datasets, if present
│   └── processed/        Cleaned data, metadata, and selected baseline model
│
├── results/
│   ├── figures/          PNG graphs for reports and presentations
│   ├── models/           Saved trained model checkpoints
│   ├── *.csv             Tables of metrics, errors, features, and curves
│   └── *.json            Machine-readable results and explanations
│
├── docs/
│   ├── SRS.md            Requirements and expected system behavior
│   ├── USER_MANUAL.md    How a person uses the dashboard
│   ├── RESEARCH_NOTES.md Research papers, gaps, and novelty
│   └── VALIDATION_REPORT.md Testing and metric limitations
│
└── tests/                Automated checks
```

## Overall workflow

```text
CSV datasets
     ↓
Clean and align timestamps
     ↓
Create net-flow, load, imbalance, residual, graph, and loss features
     ↓
Create time windows from previous observations
     ↓
Train and compare forecasting models
     ↓
Predict next-hour flow and risk
     ↓
Detect stressed links
     ↓
Test alternate paths
     ↓
Show a routing recommendation in the dashboard
```

## Important distinction

The website forecast and the research experiment are related but not identical:

- The website forecast endpoint uses the selected operational baseline from the processed model metrics.
- Fusion GRU and DCRNN are trained and evaluated in the research experiment and stored in `results/`.
- Routing is a recommendation simulation. It does not physically switch the real grid.


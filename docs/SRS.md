# Software Requirements Specification

## 1. Purpose

GridPulse is a web-based decision-support system for graph-based predictive and prescriptive analytics on cross-border power-grid networks. It is intended for grid operators, energy analysts, researchers, students, evaluators, and system administrators.

## 2. Functional requirements

### Graph and topology

- Represent a country or grid area as a node.
- Represent an interconnector as an edge.
- Preserve direction and flow magnitude when directional records exist.
- Merge duplicate directional records into a canonical physical connection.
- Display node coordinates, edge direction, flow magnitude, and risk color.

### Data validation

- Detect missing values and duplicate records.
- Check timestamp continuity by country.
- Validate country codes.
- Normalize inconsistent interconnector labels.
- Check whether flow-balance validation is physically certifiable.
- Record assumptions and distinguish measured, estimated, and proxy outputs.
- Derive centroid-to-centroid distance and a transparent I²R loss proxy using explicit voltage, power-factor, resistivity, and cross-section assumptions.

### Predictive analytics

- Predict next-period country load and net flow.
- Compare persistence, moving average, linear trend, and seasonal-naive baselines.
- Select the final model using chronological walk-forward validation.
- Report MAE, RMSE, MAPE, accuracy, precision, recall, F1, and a confusion-matrix-compatible per-class breakdown.
- Prevent future-data leakage by keeping validation chronological.

### Risk classification

- Produce Normal, Warning, or Critical screening states for nodes and links.
- Use a flow-envelope proxy when thermal capacity is unavailable.
- Show confidence and data-quality limitations beside risk outputs.

### Prescriptive analytics

- Provide priority, target, suggested action, expected effect, reason, confidence, and required validation checks.
- Provide transfer-reduction what-if analysis and alternate-route headroom.
- Search alternate graph paths under stress, score headroom/distance/loss, show bottlenecks, and compare baseline versus rerouted proxy loss.
- Never automatically control generation, substations, or interconnectors.

### Frontend and backend

- Provide a responsive dashboard with animated topology, moving power particles, explainability guide, physics lens, forecast chart, model evidence, data contract, reroute studio, and recommendation queue.
- Provide health, metadata, topology, snapshot, forecast, model metrics, validation, physical-loss, route-plan, recommendation, what-if, and replay-stream services.

## 3. Non-functional requirements

- Explainable and reproducible.
- Modular enough to add a live telemetry adapter or graph-neural model later.
- Responsive for a browser user.
- Secure against invalid what-if inputs through validation and clamping.
- Clear warning that the system is recommendation-only.

## 4. Out of scope

Automatic generation dispatch, automatic grid switching, direct substation control, and guaranteed real-world operational decisions are excluded.


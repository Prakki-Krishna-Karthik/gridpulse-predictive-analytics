# GridPulse 10-minute presentation split

The condensed deck has 12 slides. Each person presents four slides for approximately 3 minutes and 20 seconds.

## Person 1: problem, data, and graph

Slides: 1–4

### Slide 1 — Title and division

Say that GridPulse combines graph analysis, next-hour flow prediction, risk screening, and what-if routing. Mention that this is a historical data replay and recommendation prototype.

### Slide 2 — The decision problem

Use the road analogy: countries are locations, interconnectors are roads, and power flow is traffic. The system asks what may happen next hour and which alternate path deserves review.

### Slide 3 — Data becomes a model-ready window

Mention the two CSV sources, 315,598 dynamic rows, 1,262,592 power-flow rows, 12 countries, 24 links, and 2022–2024 hourly history. Explain timestamp alignment, alias normalization, duplicate checks, missing-value checks, and the local, network, and graph features.

### Slide 4 — Graph, risk, and loss

Explain countries as nodes and interconnectors as edges. Give the equations `R = ρL/A` and `P_loss = 3I²R`. State that the loss value is a transparent distance-based proxy and requires engineering validation.

Handoff:

> The data and graph are now ready. Person 2 will explain how the project forecasts flow, measures performance, and tests a possible route.

## Person 2: prediction, results, and routing

Slides: 5–8

### Slide 5 — Forecasting models and system stack

Explain Persistence, Moving Average, Seasonal Naive, and Linear Trend in one sentence each. State clearly that the current website uses the selected Persistence baseline, while Fusion GRU and DCRNN are saved research benchmarks.

### Slide 6 — Next-hour prediction

Use the example: if the latest flow is 720 MW, Persistence predicts 720 MW for the next hour. Briefly explain MAE, RMSE, precision, recall, and F1.

### Slide 7 — Performance evidence

Point to the comparison chart and confusion matrix. State the saved values accurately: Persistence RMSE 580.3 MW, Fusion GRU RMSE 570.5 MW, and DCRNN RMSE 634.0 MW. Explain that the matrix shows which stress classes were confused.

### Slide 8 — Prescriptive routing

Explain that moving 25% of a 1,000 MW flow means testing 250 MW on another path. Reject paths with insufficient headroom or Critical risk. Rank the remaining paths by distance, utilization, and estimated loss. Purple means recommendation, not a switching command.

Handoff:

> We have seen how the system predicts and recommends. Person 3 will explain the advanced DCRNN evidence, feature and error graphs, integration, and final contribution of the group.

## Person 3: DCRNN, evidence, integration, and conclusion

Slides: 9–12

### Slide 9 — DCRNN in simple terms

Explain DCRNN as a model that remembers the previous 24 hours and also checks neighboring countries before predicting. State that graph context did not win this saved run, but testing it fairly is still a result.

### Slide 10 — Evidence pack

Briefly interpret the four graphs: training versus validation loss, ROC and precision-recall behavior, feature importance, and success/failure examples. Emphasize that local recent net flow was the strongest signal in this run.

### Slide 11 — Integration, novelty, and limits

Explain the chain: CSV, Python pipeline, saved artifacts, backend API, and HTML/CSS/JavaScript dashboard. State the novelty as transparent integration, model selection by evidence, explicit physics assumptions, and route guardrails. Mention the missing real telemetry, verified ratings, N-1 analysis, and calibrated uncertainty.

### Slide 12 — Conclusion and contributions

Say:

> Person 1 handled data and graph preparation. Person 2 handled models, APIs, metrics, loss, and routing. I handled the Fusion GRU and DCRNN experiments, research evidence, interpretation, and conclusion. Together, we built a decision-support prototype that explains both its predictions and its limitations.

Final sentence:

> Prediction estimates what may happen, routing suggests what should be investigated, and engineering validation decides whether any action is safe.

## Timing rule

- Slide 1: 25 seconds
- Slides 2–12: approximately 50 seconds each
- Do not read every bullet.
- Explain one example per slide.
- Leave detailed equations and metric definitions in the speaker notes for questions.


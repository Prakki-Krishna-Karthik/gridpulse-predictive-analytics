# Final presentation outline

## Slide 1 — Problem

Cross-border power-flow decisions are spatial, temporal, and uncertainty-sensitive. A country or interconnector problem can affect connected regions.

## Slide 2 — Dataset and graph

Show 12 countries, 24 canonical links, 2022–2024 hourly data, and the alias normalization example.

## Slide 3 — Course alignment

Preprocessing, missing-value validation, time-series forecasting, regression metrics, risk classification, model comparison, and prescriptive analytics.

## Slide 4 — System architecture

CSV inputs → reproducible pipeline → graph + metrics artifacts → REST/SSE backend → animated dashboard.

## Slide 5 — Research review

Compare DCRNN, Graph WaveNet, spatial-temporal load forecasting, and uncertainty work. Explain why a benchmark-first design is more defensible for this dataset.

## Slide 6 — Project novelty

Data-quality-aware grid twin: canonical edge audit, proxy separation, evidence-driven model routing, uncertainty bands, and counterfactual route headroom.

## Slide 7 — Validation evidence

Show the model table and chronological validation curve. Explain why Persistence winning is a result, not a failure.

## Slide 8 — Live interface

Demo the animated topology, forecast chart, risk queue, data contract, and history/live replay control.

## Slide 9 — What-if and recommendations

Reduce a highly loaded interconnector. Show projected proxy utilization, alternate-route headroom, confidence, and mandatory engineering checks.

## Slide 10 — Limitations and next work

Add verified line parameters, calibrated conformal intervals, GCN/GAT/GraphSAGE baselines, N-1 validation, and a real telemetry adapter. Keep recommendation-only guardrails. DCRNN is now included in the current results pack.


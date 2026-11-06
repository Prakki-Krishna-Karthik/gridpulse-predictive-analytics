# Research review and novelty rationale

Research was reviewed to avoid presenting a standard graph forecast as a new algorithm. The papers below are the most relevant design anchors for this course project.

## What the literature already does

| Area | Evidence | Design implication |
| --- | --- | --- |
| Directed spatio-temporal forecasting | DCRNN models traffic as diffusion on a directed graph and couples graph convolution with recurrent temporal dynamics. https://arxiv.org/abs/1707.01926 | The project implements a compact forward/reverse diffusion benchmark and compares it with simple temporal baselines. |
| Learned spatial dependency | Graph WaveNet learns an adaptive dependency matrix and uses dilated temporal convolutions. https://arxiv.org/abs/1906.00121 | Physical topology alone may miss semantic dependencies, but adaptive edges must be audited for explainability. |
| Power-system GNN survey | The 2024 survey covers state estimation, load forecasting, fault diagnosis, topology management, and security while identifying robustness and domain-knowledge integration as open issues. https://ieeexplore.ieee.org/document/10754312/ | A practical project should expose topology, assumptions, and failure modes instead of only showing accuracy. |
| Multi-energy graph forecasting | MS-STGNN uses a continuous graph-learning module, graph convolution, feature attention, and multiscale temporal features for energy-load forecasting. https://doi.org/10.1109/TSG.2023.3315750 | A later experiment can add spatial attention or a GNN after the leakage-safe benchmark exists. |
| Grid-aware multi-horizon forecasting | The 2025 grid-aware STGNN separates spatial encoding from temporal forecasting and includes grid constraints such as line capacity and length. https://doi.org/10.1145/3777518.3777523 | Line metadata should be treated as first-class features when the dataset provides it. |
| Forecast uncertainty | Conformalized quantile regression has been applied to short-term load forecasting to create adaptive prediction intervals. https://doi.org/10.46855/energy-proceedings-10898 | Show uncertainty bands and label them honestly. Do not call a residual band a calibrated probability interval. |

## Gap identified for this project

The literature has strong model architectures, but a course-scale implementation still needs to answer operationally awkward questions:

- What happens when the same physical interconnector uses inconsistent labels?
- Which outputs are measurements, which are estimates, and which are proxies?
- What should the operator investigate when a forecast is uncertain or the physical parameters are incomplete?
- Does a complex graph model actually beat persistence on this particular dataset under chronological validation?

Many papers optimize predictive error on curated datasets. GridPulse makes those data-contract questions visible in the interface and logs them as evidence.

## Proposed novelty: DQ-GridPulse

The project contribution is an applied, auditable workflow rather than a new neural layer:

1. **Canonical edge audit.** Merge directional records by source/target endpoints and retain the alias map.
2. **Data-quality-aware risk.** Combine observed-flow envelope utilization, directional imbalance, load residual, and missing-hour information in a screening score.
3. **Evidence-driven model router.** Select the winner from chronological walk-forward metrics instead of fixing DCRNN or GNN as the answer in advance. The current run keeps Persistence as the operational baseline while Fusion GRU wins the saved research comparison on RMSE.
4. **Proxy separation.** Refuse to label a flow-envelope estimate as physical loss when voltage, resistance, length, power factor, or thermal capacity is absent.
5. **Counterfactual headroom.** Test a transfer reduction and surface alternate route headroom with guardrails.
6. **Distance-to-loss bridge.** Turn supplied coordinates into an explicit Haversine distance, derived resistance, and I²R scenario estimate while keeping engineering-grade status unavailable until surveyed line data arrives.
7. **Stress-aware rerouting.** Search for a connected alternate path, hard-reject insufficient headroom/Critical links, and expose best-effort bottlenecks rather than hiding infeasibility.
8. **Action queue.** Convert model output into explainable recommendations that include confidence and validation checks.

This should be presented as a novel integration and transparency contribution for a student project. A publishable novelty claim would require a systematic review, ablation study, and comparison against graph models on a documented benchmark.

## Implemented experiment layer

The experiment runner now provides a like-for-like comparison between Persistence, moving average, seasonal naive, linear trend, Fusion GRU, and DCRNN. DCRNN consumes the same engineered country tensor as Fusion GRU but retains the node axis and applies forward/reverse diffusion over the canonical graph. This is why it can test whether neighboring-country context helps, while the baseline comparison still protects against overclaiming.

## Recommended next research experiments

1. Add leakage-safe GCN, GAT, and GraphSAGE implementations using the same train/validation/test windows as the completed DCRNN benchmark.
2. Add a proper confusion matrix and macro/weighted class metrics for stress labels derived from verified capacity ratings.
3. Add calibrated conformal intervals and evaluate coverage and interval width.
4. Add voltage/resistance/length/power-factor/capacity inputs and validate the three-phase loss formula against an engineering solver.
5. Run ablations: temporal-only, topology-only, topology + weather, topology + quality flags, and counterfactual features.


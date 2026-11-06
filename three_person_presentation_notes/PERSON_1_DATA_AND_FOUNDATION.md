# Person 1 speaker notes — data and project foundation

Slides: 1–12

Speaking time: approximately 8 minutes

## Opening contribution statement

> My part of the project focuses on understanding the power-grid problem and converting the raw datasets into a reliable graph and feature representation. I will explain what the system receives, how we clean it, and how the data becomes ready for prediction.

## Slide 1 — GRID/PULSE

Say:

> Our project is called GridPulse. It combines predictive analytics, graph analysis, and prescriptive what-if routing for cross-border power grids. The supplied records are treated as a historical replay, not as live utility telemetry. The system contains 12 country nodes and 24 canonical interconnector links.

Main message: We are building an explainable decision-support prototype, not an automatic control system.

## Slide 2 — Executive summary

Say:

> The project has four connected parts: understand the network, forecast future flow, classify stress, and test possible actions. A graph view explains where the problem is. A time-series model estimates what may happen next. The routing module then tests whether some flow could be moved through another connected path.

## Slide 3 — Domain and problem definition

Say:

> Electricity crosses borders through interconnected lines. A problem on one line can affect neighboring countries because power flows through a network rather than through isolated roads. The challenge is therefore both temporal—what will happen next hour—and spatial—how neighboring nodes influence one another.

Simple analogy: countries are locations, interconnectors are roads, and power flow is traffic.

## Slide 4 — Literature and existing approaches

Say:

> Existing research uses recurrent models, graph neural networks, diffusion models, and uncertainty methods for network forecasting. Our project uses these ideas carefully, but does not claim that a complex graph model is automatically best. The gap addressed here is an auditable combination of data quality, forecasting, physical assumptions, and route testing.

Important phrase: novelty is the transparent integration and evidence trail, not inventing a completely new neural architecture.

## Slide 5 — Objectives and scope

Say:

> The objectives are to prepare the two CSV sources, construct a country-interconnector graph, predict country net flow, evaluate several models, estimate distance-based losses, classify risk, and recommend stress-aware what-if routes. The scope is limited by the available data: exact engineering ratings, voltage, protection settings, and telemetry are not fully available.

## Slide 6 — Dataset profile and quality

Say:

> The pipeline reads dynamic country records and power-flow records. It checks timestamps, countries, duplicates, missing values, and aliases. Records are normalized before they are merged. This is important because a model can look accurate while actually learning from duplicated, misaligned, or inconsistent rows.

Explain the data contract: every time-series record should identify a country and timestamp and contain the required load and flow signals.

## Slide 7 — Exploratory time-series analysis

Say:

> Before training a model, we inspect the behavior of the data. The chart shows daily rhythm and variation in load and net flow. This helps us see whether the series has regular patterns, sudden changes, or unstable periods. It also explains why simple baselines deserve to be tested before advanced neural networks.

## Slide 8 — System graph

Say:

> Each country becomes a node and each canonical interconnector becomes an edge. Latitude and longitude allow us to estimate the distance between nodes. The graph also lets us calculate degree, closeness, and betweenness centrality. A highly connected or bridge-like node may matter more when checking alternate routes.

Clarify: the line drawing shows topology. It is not a complete electrical power-flow solution.

## Slide 9 — Preprocessing workflow

Say:

> The pipeline parses both CSV files, handles UTF-8 BOM and UTC timestamps, normalizes labels, removes or records duplicate keys, aligns the time series, and creates consistent country histories. The result is saved in `data/processed/`, so later experiments use the same reproducible input.

## Slide 10 — Feature engineering and equations

Say:

> The model does not receive only one raw column. It receives local net flow, local load, flow imbalance, load residual, global network summaries, and static graph features. A load residual is actual load minus the day-ahead forecast. The risk screen combines utilization, imbalance, and residual pressure.

Key risk-screen equation:

```text
score = 75 × utilization
      + 15 × capped absolute imbalance
      + 10 × capped residual-to-load ratio
```

The score is clipped between 0 and 100 and is used for screening, not for declaring an engineering protection trip.

## Slide 11 — Feature/risk analysis

Say:

> This graph explains which signals contribute to the current screening score. Flow pressure has the largest weight, while imbalance and load forecast error add context. This is useful because the dashboard can say why a node is marked Warning or Critical instead of showing only a mysterious label.

## Slide 12 — Architecture and replay

Say:

> The complete path is CSV input, reproducible pipeline, graph and metric artifacts, backend APIs, and animated frontend. The browser requests prepared snapshots and forecast data from the backend. The history/live control replays supplied timestamps, so the visual movement is a controlled demonstration of recorded data rather than a direct utility feed.

## Key terms to remember

- Node: country or grid location.
- Edge: interconnector between two nodes.
- Feature: input signal supplied to a model.
- Target: value to be predicted.
- Net flow: the dataset’s signed overall flow value for a country or link.
- Preprocessing: making raw records consistent before modelling.

## Handoff to Person 2

> I have explained how the raw records become a clean graph and feature set. Person 2 will now explain the technology stack, how the modules communicate, how the forecasting models are evaluated, and how a prediction becomes a routing recommendation.

## Likely questions

**Why use a graph?**

Because countries are connected; neighboring conditions can affect a node’s future flow.

**Is the distance exact?**

No. It is derived from available coordinates and is clearly labelled as an estimate.

**Is the website connected to a real grid?**

No. It currently uses a historical data replay and modelled/proxy values.


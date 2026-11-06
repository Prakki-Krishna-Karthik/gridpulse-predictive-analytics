# GridPulse user manual

## Start the application

1. Open PowerShell in the project folder.
2. Run `python backend/pipeline.py` whenever the raw CSVs change.
3. Run `python backend/server.py`.
4. Open `http://localhost:8000`.

## Read the command view

- **Active transfer** is the sum of current directional flow magnitudes in the visible graph snapshot.
- **Nodes to review** counts nodes with Warning or Critical screening scores.
- **Link pressure** is the highest utilization of the observed-flow proxy envelope.
- **Data confidence** is a quality summary. It is not a forecast probability.

The plain-language guide explains the visual grammar: dots are countries, animated particles are observed transfer, colors are screening states, and purple is a tested reroute. Click a node or interconnector in the topology to inspect its current score, distance, and estimated loss. Red and amber are prioritization signals, not operating limits.

## Use the forecast lab

Select a country and model. The chart shows recent load and net flow plus a short-horizon deterministic forecast. The shaded band is an adaptive residual band, not a calibrated probability interval.

The model table shows the chronological holdout evidence. Persistence may win. That is a valid result: the final algorithm is selected by the data, not by architectural ambition.

## Use history mode

Select **History** in the sidebar, then drag the timeline slider. The topology, signals, and recommendations move to that historical point. Select **Live pulse** to resume the two-second historical replay stream.

## Run a what-if scenario

1. Choose an interconnector. The Physics Lens immediately shows centroid distance, derived resistance, current proxy loss, and the assumptions.
2. Set a hypothetical transfer reduction.
3. Select **Simulate reroute**.
4. The planner removes that share from the selected link and searches for a connected path between the same endpoints. It prefers links with enough observed-envelope headroom, avoids Critical links, and penalizes long, stressed, loss-heavy routes.
5. Compare baseline/projected utilization, the purple path, moved MW, loss delta, and any bottleneck explanation. “Best effort” means a path exists but needs engineering review; “No route” means the visible graph is disconnected for that scenario.

Treat the result as a screening scenario. Confirm line ratings, sign conventions, dispatch constraints, and an N-1 study before any operational use.

## Read the data contract

The data contract shows missing cells, duplicate records, timestamp gaps, normalized aliases, and loss-method status. The Physics Lens uses `R = ρL/A` followed by `P_loss = 3I²R`; because the dataset lacks surveyed route geometry and engineering parameters, the result is deliberately labelled a scenario proxy.


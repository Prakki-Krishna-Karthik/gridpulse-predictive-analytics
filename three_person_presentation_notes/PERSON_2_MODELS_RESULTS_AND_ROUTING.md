# Person 2 speaker notes — models, results, integration, and routing

Slides: 13–24

Speaking time: approximately 8 minutes

## Opening contribution statement

> My part focuses on turning the processed data into a usable predictive and prescriptive application. I will explain the libraries, the model-selection workflow, the evaluation metrics, the physical-loss assumptions, the rerouting logic, and how the backend connects to the animated dashboard.

## Slide 13 — Technology stack

Say:

> Python handles data processing, APIs, physics calculations, and experiments. NumPy supports numerical arrays, pandas or CSV tooling supports tabular data, PyTorch supports Fusion GRU and DCRNN, scikit-learn and Matplotlib support evaluation and figures, and the browser uses HTML, CSS, and JavaScript for the interface. The backend exposes services that the frontend calls.

Do not claim a library is used unless it appears in the actual project files.

## Slide 14 — Integration contract

Say:

> Each stage produces a stable output for the next stage. The pipeline creates processed data and metadata. The backend reads those artifacts and exposes endpoints such as snapshot, forecast, metrics, physical loss, route-plan, what-if, and replay-stream. The frontend uses these responses to update cards, charts, network lines, and explanations.

## Slide 15 — Forecasting methodology

Say:

> We evaluate models in time order. Earlier data is used to predict later data, and the future is not allowed to leak into training. The forecasting target is next-period country net flow. The saved experiment uses a chronological holdout, which is more realistic than randomly mixing future and past rows.

Important distinction:

> The current website forecast uses the selected operational baseline. In the saved run, Persistence was selected because it had the lowest pooled chronological RMSE. Fusion GRU and DCRNN are included as research benchmarks.

## Slide 16 — Regression metrics

Say:

> Regression metrics measure how far the predicted MW value is from the actual MW value.

```text
MAE  = average of absolute errors
RMSE = square root of average squared errors
MAPE = average absolute percentage error
```

If actual values are 100, 200 and 300 MW and predictions are 110, 180 and 330 MW, the errors are 10, 20 and 30 MW. MAE is 20 MW. RMSE gives more weight to the 30 MW error. MAPE can be unstable when actual net flow is near zero, so MAE and RMSE are emphasized.

## Slide 17 — Classification metrics

Say:

> The continuous flow prediction is also converted into a stress class: Normal, Warning, or Critical. Accuracy is the proportion of correct classes. Precision asks, “When we raise a warning, how often are we correct?” Recall asks, “Of all real warnings, how many did we catch?” F1 combines precision and recall.

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 × precision × recall / (precision + recall)
```

## Slide 18 — Confusion matrix

Say:

> Rows represent the actual stress class and columns represent the predicted class. The diagonal means correct predictions. An off-diagonal cell shows the type of mistake, such as Warning predicted as Normal or Critical predicted as Warning. This is more informative than accuracy alone because it shows which class is being confused.

## Slide 19 — Validation curve and error analysis

Say:

> The validation trace shows how error changes as the chronological window moves. It is not automatically the same as a neural training-loss curve. Large gaps or spikes can indicate regime changes, abrupt flow movements, or limited information in the previous window. Error analysis identifies examples where the system succeeds and where it fails.

## Slide 20 — Distance-based physical-loss proxy

Say:

> We use coordinates to estimate line length and then estimate resistance. The equations are transparent, but the result is a screening proxy because exact conductor geometry, voltage, power factor, and engineering ratings are not available.

```text
R = rho × L / A
P_loss = 3 × I² × R
```

Here rho is resistivity, L is length, A is cross-sectional area, and I is current. Longer lines produce higher resistance when the other assumptions stay constant.

## Slide 21 — Prescriptive routing

Say:

> Prescriptive analytics means recommending what to do after forecasting a risk. If a selected line carries 1,000 MW and we test a 25% reduction, the simulation moves 250 MW. It searches for another connected path between the same endpoints. A path is rejected if it lacks headroom or contains a Critical link. Remaining paths are ranked by distance, utilization, and estimated loss.

Simple analogy: if one road is crowded, move some traffic to a connected road only if that road has space and is not already unsafe.

```text
moved MW = current MW × reroute percentage / 100
headroom = proxy capacity − current flow
```

The purple path is a recommendation, not a real switching command.

## Slide 22 — Interface walkthrough

Say:

> The dashboard is organized by user questions. The KPI cards show current network state. The topology shows where stress is located. The forecast panel shows recent values and future estimates. The physics lens explains distance and loss assumptions. The route planner shows the what-if result and the links that require engineering review.

## Slide 23 — Results, limitations, and future scope

Say:

> The current implementation proves a reproducible workflow from raw rows to a forecast, risk screen, and route scenario. It does not prove that the proxy loss equals a real AC power-flow result. Future work includes verified line parameters, calibrated uncertainty, N-1 contingency studies, additional graph baselines, and a real telemetry adapter.

## Slide 24 — Fusion GRU training curves

Say:

> The Fusion GRU uses a 24-hour sequence and combines local signals, network summaries, and static graph features. The training and validation curves help us check whether learning is stable and whether the model overfits. The final model must still be judged on the untouched chronological test period.

## Handoff to Person 3

> I have explained how the application turns the prepared data into predictions, metrics, loss estimates, and routing recommendations. Person 3 will now explain the advanced research results, DCRNN, feature interpretation, error examples, and the final conclusions.

## Likely questions

**Why did Persistence win?**

Because short-horizon flow can be highly autocorrelated, so the latest value was a strong baseline on this dataset. Model complexity must be justified by holdout performance.

**Does routing physically redirect electricity?**

No. It is a counterfactual screening recommendation requiring engineering validation.

**Why is MAPE not the main metric?**

Because net flow can be close to zero or change sign, making percentage errors unstable.


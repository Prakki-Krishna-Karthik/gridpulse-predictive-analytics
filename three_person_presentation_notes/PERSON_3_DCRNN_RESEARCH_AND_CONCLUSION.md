# Person 3 speaker notes — DCRNN, research evidence, and conclusion

Slides: 25–36

Speaking time: approximately 8 minutes

## Opening contribution statement

> My part focuses on the advanced research experiments and the evidence behind the final conclusions. I will explain the DCRNN model, compare it fairly with Fusion GRU and simple baselines, interpret the feature and error graphs, and close with the project’s contribution and limitations.

## Slide 25 — DCRNN ROC and precision-recall analysis

Say:

> The continuous predicted flow is converted into Normal, Warning, and Critical classes using the project thresholds. The ROC curve changes the classification threshold and plots true-positive rate against false-positive rate. The precision-recall curve is especially useful when the classes are not balanced. These graphs show the behavior of the classifier across thresholds, not just one selected threshold.

Formulas:

```text
TPR = TP / (TP + FN)
FPR = FP / (FP + TN)
```

## Slide 26 — Model comparison

Say:

> This chart compares simple baselines, Fusion GRU, and DCRNN on the same chronological target and holdout. RMSE and MAE measure numeric flow error, while accuracy, precision, recall, and F1 measure stress-class behavior. The correct conclusion is the one supported by the saved table, not the one we expected before testing.

Important: DCRNN being more advanced does not guarantee a lower error.

## Slide 27 — Feature interpretation and embeddings

Say:

> Permutation importance measures how much validation error increases when one feature is shuffled. A larger increase suggests the model depended more on that feature. Ablation replaces a feature with its training mean and measures the change. The embedding plot projects learned hidden states into two dimensions so we can visually inspect whether similar operating conditions group together.

Clarify: these plots explain model behavior; they do not prove causality.

## Slide 28 — Error analysis

Say:

> The error-analysis examples show both successes and failures from the holdout. Successes often occur when the recent history is stable. Failures expose abrupt flow movements and class-boundary changes that a one-step forecast cannot anticipate. This tells us where additional data or a better model is needed.

## Slide 29 — Four transparent baselines

Say:

> The four baseline models use simple rules. Persistence copies the latest value. Moving average averages recent values. Seasonal naive uses the same hour from the previous day. Linear trend fits a line to the recent window and extends it. For example, if the recent values end in 600, 700, 900, and 800 MW, each rule produces a different next value. These baselines create a fair standard that a neural model must beat.

## Slide 30 — Fusion GRU

Say:

> A GRU is a neural network with gates that decide what information from earlier hours to remember. Fusion GRU reads a 24-hour window for one country, combines local variables with global network context and static graph features, and outputs the next flow. It is called Fusion because it combines several feature groups before producing the prediction.

Simple analogy: it reads a short diary of the country’s recent behavior and learns which parts of the diary matter.

## Slide 31 — DCRNN graph diffusion

Say:

> DCRNN keeps all country nodes together. At each time step, it first passes information through neighboring nodes using forward and reverse graph transitions. It then applies recurrent memory to retain useful history. Finally, a prediction head outputs the next net flow for every country jointly.

Simple example:

```text
Germany → Belgium → Netherlands
```

If Germany’s flow changes and Belgium is a connected neighbor, graph diffusion allows Germany’s state to influence the hidden representation used for nearby nodes. This is why DCRNN can test whether topology adds useful information.

## Slide 32 — DCRNN training curves

Say:

> The DCRNN curves show normalized training and validation loss plus macro-F1 over epochs. We look for stable learning and a reasonable relationship between training and validation behavior. A lower training loss alone is not enough; validation and final chronological test results matter more.

## Slide 33 — Why graph context did not win this run

Say:

> The saved comparison shows whether graph context improved this particular dataset and split. DCRNN may not win because the data is limited, the network topology is only a proxy, recent local history is already highly predictive, or the available features do not describe enough physical state. This is not a failure of graph neural networks in general. It is evidence about this dataset, this graph, and this training protocol.

Strong conclusion:

> The project keeps DCRNN because it was tested fairly, not because it was forced to be the winner.

## Slide 34 — Saved evidence pack

Say:

> The experiment runner saves JSON, CSV, model checkpoints, and figures in the results folder before the presentation is built. This makes the numbers traceable. The PowerPoint is therefore a report of saved experiment outputs rather than a collection of invented chart values.

## Slide 35 — Feature extraction graph

Say:

> This is the complete bridge from observations to a model-ready decision window. We observe raw load and flow, align the hours, compute local and global features, add graph centrality, standardize using training information, form a 24-hour window, and assign the next hour as the target. The model receives a tensor, not a raw CSV row.

## Slide 36 — References and reproducibility

Say:

> The project records the research references in `docs/RESEARCH_NOTES.md`, including DCRNN, Graph WaveNet, power-system graph surveys, multi-energy forecasting, and uncertainty work. Reproducibility means another person can inspect the inputs, code, saved metrics, assumptions, and limitations.

## Final conclusion

Say:

> GridPulse connects data preparation, graph modelling, forecasting, evaluation, physical-loss screening, and prescriptive routing in one explainable workflow. Its main strength is transparency: it shows the data contract, model comparison, uncertainty, proxy assumptions, and route guardrails. Its main limitation is that it is not yet a certified real-time power-flow or dispatch system.

## Final contribution statement

> My contribution was the advanced model and evidence layer: implementing and evaluating Fusion GRU and DCRNN, producing the saved performance and interpretation graphs, reviewing the research gap, and explaining why the final result should be reported honestly rather than overstated.

## Likely questions

**Why include DCRNN if it did not win?**

Because a fair comparison is itself a research result. It shows whether graph context helps under the current data and protocol.

**What is the novelty?**

The auditable integration of data quality, graph features, model comparison, proxy physics, uncertainty-aware display, and counterfactual routing—not an unsupported claim of a brand-new neural architecture.

**Can DCRNN control the grid?**

No. It forecasts net flow. It does not solve all power-flow equations, perform N-1 security analysis, or authorize switching and dispatch.


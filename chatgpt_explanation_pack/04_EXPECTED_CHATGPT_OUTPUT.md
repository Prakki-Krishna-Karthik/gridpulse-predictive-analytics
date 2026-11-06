# What a good explanation should contain

Ask ChatGPT to produce the answer in this order:

1. Five-sentence project summary.
2. Everyday analogy: countries are locations, power lines are roads, and flow is traffic.
3. Dataset and preprocessing explanation.
4. Feature extraction table with formulas and examples.
5. Graph construction and power-loss calculation.
6. Next-hour prediction explanation.
7. Baseline models versus Fusion GRU versus DCRNN.
8. Training and testing workflow.
9. Metrics and graphs.
10. Prescriptive routing explanation.
11. Website and API integration.
12. Limitations and real-world deployment requirements.
13. Thirty-minute study notes and viva questions.

## Accuracy checks

The explanation should explicitly answer these questions:

- Is the website using DCRNN for its current forecast?
- Is the changing data real-time utility telemetry or replay/simulation?
- Are line capacities measured engineering ratings or proxy values?
- Is the loss calculation an engineering power-flow solution or an estimate?
- Does the routing system send a real switching command or only recommend a what-if route?
- Which model won the saved chronological holdout comparison?

If the uploaded files do not answer a question, ChatGPT should say “not specified in the available files” instead of guessing.


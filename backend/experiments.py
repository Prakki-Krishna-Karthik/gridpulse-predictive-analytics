"""Generate reproducible experiment artifacts for the GridPulse presentation.

The production dashboard keeps its standard-library pipeline and classical
baselines. This module adds an optional research experiment layer using NumPy,
PyTorch, scikit-learn, and Matplotlib:

* a real local-plus-global Fusion GRU trained on chronological sequences
* a directed diffusion-convolution recurrent network (DCRNN) over the country graph
* training/validation loss, accuracy, and macro-F1 traces
* ROC and precision-recall curves for the three screening classes
* confusion matrix, model comparison, feature permutation/ablation results
* t-SNE projections of learned hidden states and error-analysis examples

All outputs are written to ``results/``. The PPT builder consumes these saved
JSON/CSV artifacts instead of recomputing presentation-only numbers.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.manifold import TSNE


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
RESULTS = ROOT / "results"
FIGURES = RESULTS / "figures"
MODEL_DIR = RESULTS / "models"
SEED = 42
SEQ_LEN = 24
TEST_HORIZON = 168
WINDOW_STRIDE = 4
EPOCHS = 40
BATCH_SIZE = 128

FEATURE_NAMES = [
    "local net flow",
    "local load",
    "local imbalance",
    "local load residual",
    "global net flow",
    "global load",
    "global imbalance",
    "global residual",
    "degree centrality",
    "closeness centrality",
    "betweenness centrality",
]
LABELS = ["Normal", "Warning", "Critical"]

FEATURE_CATALOG = [
    {"name": "local net flow", "group": "local time series", "source": "net_flow", "formula": "observed country net flow at t", "reason": "The target's recent history gives the model an autoregressive anchor."},
    {"name": "local load", "group": "local time series", "source": "Actual_Total_Load_MW", "formula": "observed country load at t", "reason": "Demand pressure changes the likely transfer requirement."},
    {"name": "local imbalance", "group": "local time series", "source": "flow_imbalance_ratio", "formula": "inflow/outflow imbalance signal", "reason": "Large imbalance separates stable transfer from directional stress."},
    {"name": "local load residual", "group": "local time series", "source": "load_residual", "formula": "actual load - day-ahead forecast", "reason": "Forecast misses can precede unexpected flow changes."},
    {"name": "global net flow", "group": "network context", "source": "all country net_flow", "formula": "mean(net flow across countries)", "reason": "A node's forecast is conditioned on the system-wide state."},
    {"name": "global load", "group": "network context", "source": "all country load", "formula": "mean(load across countries)", "reason": "Shared demand conditions propagate through interconnectors."},
    {"name": "global imbalance", "group": "network context", "source": "all country imbalance", "formula": "mean(abs(imbalance) across countries)", "reason": "System-wide directional pressure provides context around a node."},
    {"name": "global residual", "group": "network context", "source": "all country load residual", "formula": "mean(abs(residual) across countries)", "reason": "Collective forecast error can signal an unstable operating period."},
    {"name": "degree centrality", "group": "static graph", "source": "canonical graph", "formula": "degree(node)/(N-1)", "reason": "A node with more neighbors has more pathways for pressure to move."},
    {"name": "closeness centrality", "group": "static graph", "source": "canonical graph", "formula": "inverse mean shortest-path distance", "reason": "A node's graph proximity gives a compact connectivity context."},
    {"name": "betweenness centrality", "group": "static graph", "source": "canonical graph", "formula": "fraction of shortest paths through node", "reason": "Bridge nodes can matter to rerouting decisions."},
]


def seed_everything() -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)
    torch.set_num_threads(1)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def safe_div(a: float, b: float) -> float:
    return a / b if b else 0.0


def class_from_value(value: float, warning: float, critical: float) -> str:
    magnitude = abs(float(value))
    if magnitude >= critical:
        return "Critical"
    if magnitude >= warning:
        return "Warning"
    return "Normal"


def macro_metrics(actual: list[str], predicted: list[str]) -> dict:
    correct = sum(a == p for a, p in zip(actual, predicted))
    per_class = {}
    for label in LABELS:
        tp = sum(a == label and p == label for a, p in zip(actual, predicted))
        fp = sum(a != label and p == label for a, p in zip(actual, predicted))
        fn = sum(a == label and p != label for a, p in zip(actual, predicted))
        precision = safe_div(tp, tp + fp)
        recall = safe_div(tp, tp + fn)
        f1 = safe_div(2 * precision * recall, precision + recall)
        per_class[label] = {"precision": precision, "recall": recall, "f1": f1, "support": tp + fn}
    return {
        "accuracy": safe_div(correct, len(actual)),
        "precision": float(np.mean([per_class[label]["precision"] for label in LABELS])),
        "recall": float(np.mean([per_class[label]["recall"] for label in LABELS])),
        "f1": float(np.mean([per_class[label]["f1"] for label in LABELS])),
        "per_class": per_class,
    }


def regression_metrics(actual: np.ndarray, predicted: np.ndarray) -> dict:
    error = predicted - actual
    abs_error = np.abs(error)
    return {
        "mae": float(np.mean(abs_error)),
        "rmse": float(np.sqrt(np.mean(error ** 2))),
        "mape": float(np.mean(abs_error[np.abs(actual) > 1e-6] / np.abs(actual[np.abs(actual) > 1e-6]))) if np.any(np.abs(actual) > 1e-6) else 0.0,
    }


class FusionGRU(torch.nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 32) -> None:
        super().__init__()
        self.gru = torch.nn.GRU(input_size=input_size, hidden_size=hidden_size, batch_first=True)
        self.head = torch.nn.Sequential(
            torch.nn.LayerNorm(hidden_size),
            torch.nn.Linear(hidden_size, 1),
        )

    def forward(self, inputs: torch.Tensor, return_hidden: bool = False):
        sequence, _ = self.gru(inputs)
        hidden = sequence[:, -1, :]
        prediction = self.head(hidden).squeeze(-1)
        return (prediction, hidden) if return_hidden else prediction


class DiffusionGraphConv(torch.nn.Module):
    """A compact DCRNN diffusion convolution.

    The two transition matrices represent forward and reverse random walks on
    the directed country-interconnector graph.  Applying each transition for
    K steps lets a node receive information from progressively farther
    neighbors before the recurrent update combines it with its own history.
    """

    def __init__(self, input_size: int, output_size: int, transitions: list[torch.Tensor], diffusion_steps: int = 2) -> None:
        super().__init__()
        self.diffusion_steps = diffusion_steps
        for index, transition in enumerate(transitions):
            self.register_buffer(f"transition_{index}", transition)
        self.weight = torch.nn.Parameter(torch.empty((1 + len(transitions) * diffusion_steps) * input_size, output_size))
        self.bias = torch.nn.Parameter(torch.zeros(output_size))
        torch.nn.init.xavier_uniform_(self.weight)

    def forward(self, values: torch.Tensor) -> torch.Tensor:
        # values: [batch, nodes, channels]
        supports = [values]
        for index in range(len(self._buffers)):
            transition = self._buffers.get(f"transition_{index}")
            if transition is None:
                continue
            propagated = values
            for _ in range(self.diffusion_steps):
                propagated = torch.einsum("ij,bjf->bif", transition, propagated)
                supports.append(propagated)
        combined = torch.cat(supports, dim=-1)
        return combined @ self.weight + self.bias


class DCRNNCell(torch.nn.Module):
    def __init__(self, input_size: int, hidden_size: int, transitions: list[torch.Tensor], diffusion_steps: int = 2) -> None:
        super().__init__()
        self.hidden_size = hidden_size
        self.gates = DiffusionGraphConv(input_size + hidden_size, hidden_size * 2, transitions, diffusion_steps)
        self.candidate = DiffusionGraphConv(input_size + hidden_size, hidden_size, transitions, diffusion_steps)

    def forward(self, inputs: torch.Tensor, hidden: torch.Tensor) -> torch.Tensor:
        joined = torch.cat([inputs, hidden], dim=-1)
        update, reset = torch.sigmoid(self.gates(joined)).chunk(2, dim=-1)
        candidate_input = torch.cat([inputs, reset * hidden], dim=-1)
        candidate = torch.tanh(self.candidate(candidate_input))
        return update * hidden + (1.0 - update) * candidate


class DCRNN(torch.nn.Module):
    """A small, inspectable DCRNN for the supplied 12-node graph.

    It predicts the next net flow for every country jointly.  This is a
    benchmark implementation, not an engineering dispatch solver.
    """

    def __init__(self, input_size: int, hidden_size: int, transitions: list[torch.Tensor], diffusion_steps: int = 2) -> None:
        super().__init__()
        self.hidden_size = hidden_size
        self.cell = DCRNNCell(input_size, hidden_size, transitions, diffusion_steps)
        self.head = torch.nn.Sequential(
            torch.nn.LayerNorm(hidden_size),
            torch.nn.Linear(hidden_size, 1),
        )

    def forward(self, inputs: torch.Tensor, return_hidden: bool = False):
        # inputs: [batch, lookback, nodes, features]
        batch_size, _, node_count, _ = inputs.shape
        hidden = torch.zeros(batch_size, node_count, self.hidden_size, device=inputs.device)
        for time_index in range(inputs.shape[1]):
            hidden = self.cell(inputs[:, time_index], hidden)
        prediction = self.head(hidden).squeeze(-1)
        return (prediction, hidden) if return_hidden else prediction


def build_feature_tensor(series: dict, manifest: dict) -> tuple[np.ndarray, np.ndarray, list[str], list[str]]:
    countries = manifest["dataset"]["countries"]
    nodes = {node["country"]: node for node in manifest["graph"]["nodes"]}
    lengths = [len(series["countries"][country]["net_flow_mw"]) for country in countries]
    n = min(lengths)
    local = []
    targets = []
    for country in countries:
        data = series["countries"][country]
        local.append(np.column_stack([
            np.asarray(data["net_flow_mw"][-n:], dtype=np.float32),
            np.asarray(data["load_mw"][-n:], dtype=np.float32),
            np.asarray(data["flow_imbalance_ratio"][-n:], dtype=np.float32),
            np.asarray(data["load_residual_mw"][-n:], dtype=np.float32),
        ]))
        targets.append(np.asarray(data["net_flow_mw"][-n:], dtype=np.float32))
    local_arr = np.stack(local, axis=0)
    target_arr = np.stack(targets, axis=0)
    global_arr = np.stack([
        local_arr[:, :, 0].mean(axis=0),
        local_arr[:, :, 1].mean(axis=0),
        np.abs(local_arr[:, :, 2]).mean(axis=0),
        np.abs(local_arr[:, :, 3]).mean(axis=0),
    ], axis=1)
    feature_rows = []
    for idx, country in enumerate(countries):
        node = nodes[country]
        static = np.tile(np.asarray([
            node.get("degree_centrality", 0.0),
            node.get("closeness_centrality", 0.0),
            node.get("betweenness_centrality", 0.0),
        ], dtype=np.float32), (n, 1))
        feature_rows.append(np.concatenate([local_arr[idx], global_arr, static], axis=1))
    return np.stack(feature_rows, axis=0), target_arr, countries, list(series["timestamps"][-n:])


def make_samples(features: np.ndarray, targets: np.ndarray, countries: list[str], timestamps: list[str]):
    n = features.shape[1]
    test_start = n - TEST_HORIZON
    val_start = test_start - TEST_HORIZON
    train_x, train_y, val_x, val_y, test_x, test_y, test_meta = [], [], [], [], [], [], []
    for country_idx, country in enumerate(countries):
        for t in range(SEQ_LEN, val_start, WINDOW_STRIDE):
            train_x.append(features[country_idx, t - SEQ_LEN:t])
            train_y.append(targets[country_idx, t])
        for t in range(val_start, test_start, WINDOW_STRIDE):
            val_x.append(features[country_idx, t - SEQ_LEN:t])
            val_y.append(targets[country_idx, t])
        for t in range(test_start, n):
            test_x.append(features[country_idx, t - SEQ_LEN:t])
            test_y.append(targets[country_idx, t])
            test_meta.append({"country": country, "timestamp": timestamps[t], "index": t})
    return (
        np.asarray(train_x, dtype=np.float32), np.asarray(train_y, dtype=np.float32),
        np.asarray(val_x, dtype=np.float32), np.asarray(val_y, dtype=np.float32),
        np.asarray(test_x, dtype=np.float32), np.asarray(test_y, dtype=np.float32), test_meta,
    )


def make_global_samples(features: np.ndarray, targets: np.ndarray, timestamps: list[str]):
    """Create aligned node-wide windows for DCRNN.

    Fusion GRU evaluates one country at a time. DCRNN receives the same
    window for all countries so the graph convolution can exchange signals
    between neighboring nodes at every recurrent step.
    """

    n = features.shape[1]
    test_start = n - TEST_HORIZON
    val_start = test_start - TEST_HORIZON
    buckets = {"train": ([], []), "validation": ([], []), "test": ([], [])}
    test_meta = []
    for t in range(SEQ_LEN, n):
        if t < val_start:
            split, stride = "train", WINDOW_STRIDE
        elif t < test_start:
            split, stride = "validation", WINDOW_STRIDE
        else:
            split, stride = "test", 1
        if (t - SEQ_LEN) % stride != 0:
            continue
        window = np.transpose(features[:, t - SEQ_LEN:t, :], (1, 0, 2))
        buckets[split][0].append(window)
        buckets[split][1].append(targets[:, t])
        if split == "test":
            test_meta.append({"timestamp": timestamps[t], "index": t})
    return (
        np.asarray(buckets["train"][0], dtype=np.float32), np.asarray(buckets["train"][1], dtype=np.float32),
        np.asarray(buckets["validation"][0], dtype=np.float32), np.asarray(buckets["validation"][1], dtype=np.float32),
        np.asarray(buckets["test"][0], dtype=np.float32), np.asarray(buckets["test"][1], dtype=np.float32), test_meta,
    )


def build_transition_matrices(manifest: dict, countries: list[str]) -> list[torch.Tensor]:
    """Build forward and reverse row-normalized graph transitions.

    The supplied interconnector table defines topology but not a complete
    electrical orientation. We therefore keep both directions of every
    canonical link. This follows the bidirectional diffusion idea in DCRNN
    while avoiding leakage from the holdout flow values.
    """

    index = {country: position for position, country in enumerate(countries)}
    adjacency = np.zeros((len(countries), len(countries)), dtype=np.float32)
    for edge in manifest["graph"]["edges"]:
        source, target = edge["source"], edge["target"]
        if source in index and target in index:
            adjacency[index[source], index[target]] = 1.0
            adjacency[index[target], index[source]] = 1.0
    adjacency += np.eye(len(countries), dtype=np.float32)

    def row_normalize(matrix: np.ndarray) -> torch.Tensor:
        denominator = matrix.sum(axis=1, keepdims=True)
        normalized = matrix / np.where(denominator == 0, 1.0, denominator)
        return torch.from_numpy(normalized.astype(np.float32))

    return [row_normalize(adjacency), row_normalize(adjacency.T)]


def standardize(train_x, val_x, test_x, train_y, val_y, test_y):
    x_mean = train_x.reshape(-1, train_x.shape[-1]).mean(axis=0)
    x_std = train_x.reshape(-1, train_x.shape[-1]).std(axis=0)
    x_std[x_std < 1e-6] = 1.0
    y_mean = float(train_y.mean())
    y_std = float(train_y.std()) or 1.0
    norm = lambda x: (x - x_mean) / x_std
    norm_y = lambda y: (y - y_mean) / y_std
    return norm(train_x), norm(val_x), norm(test_x), norm_y(train_y), norm_y(val_y), norm_y(test_y), x_mean, x_std, y_mean, y_std


def standardize_global(train_x, val_x, test_x, train_y, val_y, test_y):
    x_mean = train_x.reshape(-1, train_x.shape[-1]).mean(axis=0)
    x_std = train_x.reshape(-1, train_x.shape[-1]).std(axis=0)
    x_std[x_std < 1e-6] = 1.0
    y_mean = float(train_y.mean())
    y_std = float(train_y.std()) or 1.0
    norm = lambda x: (x - x_mean) / x_std
    norm_y = lambda y: (y - y_mean) / y_std
    return norm(train_x), norm(val_x), norm(test_x), norm_y(train_y), norm_y(val_y), norm_y(test_y), x_mean, x_std, y_mean, y_std


def classification_scores(values: np.ndarray, warning: float, critical: float) -> list[str]:
    return [class_from_value(float(value), warning, critical) for value in values]


def baseline_prediction(history: np.ndarray, model: str) -> float:
    if len(history) == 0:
        return 0.0
    if model == "persistence":
        return float(history[-1])
    if model == "moving_average":
        return float(np.mean(history[-24:]))
    if model == "seasonal_naive":
        return float(history[-24] if len(history) >= 24 else history[-1])
    window = history[-24:]
    if len(window) < 3:
        return float(history[-1])
    x = np.arange(len(window), dtype=np.float32)
    slope, intercept = np.polyfit(x, window, 1)
    return float(intercept + slope * len(window))


def evaluate_model(model, x, y_norm, y_mean, y_std, warning, critical, device="cpu"):
    model.eval()
    with torch.no_grad():
        pred_norm = model(torch.from_numpy(x).to(device)).cpu().numpy()
    pred = pred_norm * y_std + y_mean
    actual = y_norm * y_std + y_mean
    actual_labels = classification_scores(actual, warning, critical)
    predicted_labels = classification_scores(pred, warning, critical)
    return pred, actual, macro_metrics(actual_labels, predicted_labels)


def training_curves(model, train_x, train_y, val_x, val_y, y_mean, y_std, warning, critical):
    optimizer = torch.optim.Adam(model.parameters(), lr=0.003, weight_decay=1e-4)
    loss_fn = torch.nn.MSELoss()
    history = []
    rng = np.random.default_rng(SEED)
    train_tensor = torch.from_numpy(train_x)
    target_tensor = torch.from_numpy(train_y)
    for epoch in range(1, EPOCHS + 1):
        model.train()
        order = rng.permutation(len(train_x))
        epoch_loss = 0.0
        for start in range(0, len(order), BATCH_SIZE):
            idx = order[start:start + BATCH_SIZE]
            optimizer.zero_grad()
            prediction = model(train_tensor[idx])
            loss = loss_fn(prediction, target_tensor[idx])
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += float(loss.detach()) * len(idx)
        model.eval()
        with torch.no_grad():
            train_prediction = model(train_tensor).numpy()
            val_prediction = model(torch.from_numpy(val_x)).numpy()
            val_loss = float(loss_fn(torch.from_numpy(val_prediction), torch.from_numpy(val_y)))
        train_loss = epoch_loss / len(train_x)
        train_pred = train_prediction * y_std + y_mean
        val_pred = val_prediction * y_std + y_mean
        train_actual = train_y * y_std + y_mean
        val_actual = val_y * y_std + y_mean
        train_cls = macro_metrics(classification_scores(train_actual, warning, critical), classification_scores(train_pred, warning, critical))
        val_cls = macro_metrics(classification_scores(val_actual, warning, critical), classification_scores(val_pred, warning, critical))
        history.append({
            "epoch": epoch,
            "train_loss": float(train_loss),
            "validation_loss": val_loss,
            "train_accuracy": train_cls["accuracy"],
            "validation_accuracy": val_cls["accuracy"],
            "train_f1": train_cls["f1"],
            "validation_f1": val_cls["f1"],
        })
    return history


def evaluate_global_model(model, x, y_norm, y_mean, y_std, warning, critical, device="cpu"):
    model.eval()
    with torch.no_grad():
        pred_norm = model(torch.from_numpy(x).to(device)).cpu().numpy()
    pred = pred_norm * y_std + y_mean
    actual = y_norm * y_std + y_mean
    actual_flat = actual.reshape(-1)
    predicted_flat = pred.reshape(-1)
    actual_labels = classification_scores(actual_flat, warning, critical)
    predicted_labels = classification_scores(predicted_flat, warning, critical)
    return pred, actual, macro_metrics(actual_labels, predicted_labels)


def training_curves_global(model, train_x, train_y, val_x, val_y, y_mean, y_std, warning, critical):
    optimizer = torch.optim.Adam(model.parameters(), lr=0.002, weight_decay=1e-4)
    loss_fn = torch.nn.MSELoss()
    history = []
    rng = np.random.default_rng(SEED)
    train_tensor = torch.from_numpy(train_x)
    target_tensor = torch.from_numpy(train_y)
    for epoch in range(1, EPOCHS + 1):
        model.train()
        order = rng.permutation(len(train_x))
        epoch_loss = 0.0
        for start in range(0, len(order), 32):
            idx = order[start:start + 32]
            optimizer.zero_grad()
            prediction = model(train_tensor[idx])
            loss = loss_fn(prediction, target_tensor[idx])
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += float(loss.detach()) * len(idx)
        model.eval()
        with torch.no_grad():
            train_prediction = model(train_tensor).numpy()
            val_prediction = model(torch.from_numpy(val_x)).numpy()
            val_loss = float(loss_fn(torch.from_numpy(val_prediction), torch.from_numpy(val_y)))
        train_actual = train_y * y_std + y_mean
        val_actual = val_y * y_std + y_mean
        train_pred = train_prediction * y_std + y_mean
        val_pred = val_prediction * y_std + y_mean
        train_cls = macro_metrics(classification_scores(train_actual.reshape(-1), warning, critical), classification_scores(train_pred.reshape(-1), warning, critical))
        val_cls = macro_metrics(classification_scores(val_actual.reshape(-1), warning, critical), classification_scores(val_pred.reshape(-1), warning, critical))
        history.append({
            "epoch": epoch,
            "train_loss": float(epoch_loss / len(train_x)),
            "validation_loss": val_loss,
            "train_accuracy": train_cls["accuracy"],
            "validation_accuracy": val_cls["accuracy"],
            "train_f1": train_cls["f1"],
            "validation_f1": val_cls["f1"],
        })
    return history


def roc_pr_curves(actual_labels: list[str], predictions: np.ndarray, warning: float, critical: float) -> dict:
    magnitude = np.abs(predictions)
    span = max(critical - warning, 1e-6)
    critical_score = np.clip((magnitude - warning) / span, 0.0, 1.0)
    mid = (warning + critical) / 2.0
    warning_score = np.clip(1.0 - np.abs(magnitude - mid) / max(span / 2.0, 1e-6), 0.0, 1.0)
    scores = {"Normal": 1.0 - critical_score, "Warning": warning_score, "Critical": critical_score}
    output = {"classes": LABELS, "curves": {}, "scoring_note": "Continuous score derived from predicted net-flow magnitude and training quantile thresholds."}
    for label in LABELS:
        y_true = np.asarray([1 if value == label else 0 for value in actual_labels], dtype=int)
        y_score = scores[label]
        roc_points, pr_points = [], []
        for threshold in np.linspace(0.0, 1.0, 101):
            predicted_positive = y_score >= threshold
            tp = int(np.sum((y_true == 1) & predicted_positive))
            fp = int(np.sum((y_true == 0) & predicted_positive))
            fn = int(np.sum((y_true == 1) & ~predicted_positive))
            tn = int(np.sum((y_true == 0) & ~predicted_positive))
            roc_points.append({"threshold": float(threshold), "fpr": safe_div(fp, fp + tn), "tpr": safe_div(tp, tp + fn)})
            pr_points.append({"threshold": float(threshold), "recall": safe_div(tp, tp + fn), "precision": safe_div(tp, tp + fp)})
        roc_sorted = sorted(roc_points, key=lambda p: p["fpr"])
        pr_sorted = sorted(pr_points, key=lambda p: p["recall"])
        roc_auc = float(np.trapezoid([p["tpr"] for p in roc_sorted], [p["fpr"] for p in roc_sorted]))
        pr_auc = float(np.trapezoid([p["precision"] for p in pr_sorted], [p["recall"] for p in pr_sorted]))
        output["curves"][label] = {"roc": roc_sorted, "pr": pr_sorted, "roc_auc": max(0.0, roc_auc), "pr_auc": max(0.0, pr_auc)}
    return output


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def save_figures(curves, dcrnn_curves, roc_pr, dcrnn_roc_pr, comparison, feature_rows, embedding, errors) -> None:
    FIGURES.mkdir(parents=True, exist_ok=True)
    # Keep exported evidence readable in a printed or human-authored report.
    plt.style.use("default")

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)
    epochs = [row["epoch"] for row in curves]
    axes[0].plot(epochs, [row["train_loss"] for row in curves], label="Train loss", color="#5EE7FF", linewidth=2)
    axes[0].plot(epochs, [row["validation_loss"] for row in curves], label="Validation loss", color="#FFC778", linewidth=2)
    axes[0].set_title("Fusion GRU loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("MSE on normalized target")
    axes[0].legend()
    axes[1].plot(epochs, [row["train_f1"] for row in curves], label="Train F1", color="#7DEAC8", linewidth=2)
    axes[1].plot(epochs, [row["validation_f1"] for row in curves], label="Validation F1", color="#FF7B86", linewidth=2)
    axes[1].set_title("Fusion GRU macro-F1")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Macro-F1")
    axes[1].legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "training_curves.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)
    epochs = [row["epoch"] for row in dcrnn_curves]
    axes[0].plot(epochs, [row["train_loss"] for row in dcrnn_curves], label="Train loss", color="#168FA6", linewidth=2)
    axes[0].plot(epochs, [row["validation_loss"] for row in dcrnn_curves], label="Validation loss", color="#C98A21", linewidth=2)
    axes[0].set_title("DCRNN loss")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("MSE on normalized target")
    axes[0].legend()
    axes[1].plot(epochs, [row["train_f1"] for row in dcrnn_curves], label="Train F1", color="#1C9A72", linewidth=2)
    axes[1].plot(epochs, [row["validation_f1"] for row in dcrnn_curves], label="Validation F1", color="#D85A61", linewidth=2)
    axes[1].set_title("DCRNN macro-F1")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("Macro-F1")
    axes[1].legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "dcrnn_training_curves.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)
    for label, color in zip(LABELS, ["#5EE7FF", "#FFC778", "#FF7B86"]):
        curve = roc_pr["curves"][label]
        axes[0].plot([p["fpr"] for p in curve["roc"]], [p["tpr"] for p in curve["roc"]], label=f"{label} AUC {curve['roc_auc']:.2f}", color=color)
        axes[1].plot([p["recall"] for p in curve["pr"]], [p["precision"] for p in curve["pr"]], label=f"{label} AUC {curve['pr_auc']:.2f}", color=color)
    axes[0].plot([0, 1], [0, 1], color="#8AA4B3", linestyle="--", linewidth=1)
    axes[0].set_title("One-vs-rest ROC")
    axes[0].set_xlabel("False positive rate")
    axes[0].set_ylabel("True positive rate")
    axes[1].set_title("One-vs-rest precision-recall")
    axes[1].set_xlabel("Recall")
    axes[1].set_ylabel("Precision")
    axes[0].legend(fontsize=8)
    axes[1].legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES / "roc_pr_curves.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)
    for label, color in zip(LABELS, ["#168FA6", "#C98A21", "#D85A61"]):
        curve = dcrnn_roc_pr["curves"][label]
        axes[0].plot([p["fpr"] for p in curve["roc"]], [p["tpr"] for p in curve["roc"]], label=f"{label} AUC {curve['roc_auc']:.2f}", color=color)
        axes[1].plot([p["recall"] for p in curve["pr"]], [p["precision"] for p in curve["pr"]], label=f"{label} AUC {curve['pr_auc']:.2f}", color=color)
    axes[0].plot([0, 1], [0, 1], color="#8397A0", linestyle="--", linewidth=1)
    axes[0].set_title("DCRNN one-vs-rest ROC")
    axes[0].set_xlabel("False positive rate")
    axes[0].set_ylabel("True positive rate")
    axes[1].set_title("DCRNN one-vs-rest precision-recall")
    axes[1].set_xlabel("Recall")
    axes[1].set_ylabel("Precision")
    axes[0].legend(fontsize=8)
    axes[1].legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(FIGURES / "dcrnn_roc_pr_curves.png", bbox_inches="tight")
    plt.close(fig)

    fig, axes = plt.subplots(1, 2, figsize=(12, 4.5), dpi=150)
    names = [row["label"] for row in comparison]
    axes[0].bar(names, [row["rmse"] for row in comparison], color=["#5EE7FF", "#7DEAC8", "#FFC778", "#A892FF", "#FF7B86"][:len(names)])
    axes[0].set_title("RMSE comparison")
    axes[0].set_ylabel("MW, lower is better")
    axes[0].tick_params(axis="x", rotation=35)
    axes[1].bar(names, [row["f1"] for row in comparison], color=["#5EE7FF", "#7DEAC8", "#FFC778", "#A892FF", "#FF7B86"][:len(names)])
    axes[1].set_title("Macro-F1 comparison")
    axes[1].set_ylabel("F1, higher is better")
    axes[1].tick_params(axis="x", rotation=35)
    fig.tight_layout()
    fig.savefig(FIGURES / "model_comparison.png", bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    feature_names = [row["feature"] for row in feature_rows]
    values = [row["permutation_delta_mae"] for row in feature_rows]
    order = np.argsort(values)
    ax.barh(np.asarray(feature_names)[order], np.asarray(values)[order], color="#A892FF")
    ax.set_title("Fusion GRU permutation importance")
    ax.set_xlabel("Validation MAE increase (MW)")
    fig.tight_layout()
    fig.savefig(FIGURES / "feature_importance.png", bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 5), dpi=150)
    for label, color in zip(LABELS, ["#5EE7FF", "#FFC778", "#FF7B86"]):
        subset = [point for point in embedding if point["class"] == label]
        ax.scatter([point["x"] for point in subset], [point["y"] for point in subset], s=14, alpha=0.75, label=label, color=color)
    ax.set_title("t-SNE of learned Fusion GRU hidden states")
    ax.set_xlabel("t-SNE 1")
    ax.set_ylabel("t-SNE 2")
    ax.legend()
    fig.tight_layout()
    fig.savefig(FIGURES / "tsne_projection.png", bbox_inches="tight")
    plt.close(fig)

    fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
    ax.hist([item["absolute_error_mw"] for item in errors], bins=30, color="#FF7B86", alpha=0.85)
    ax.set_title("Fusion GRU test error distribution")
    ax.set_xlabel("Absolute error (MW)")
    ax.set_ylabel("Test examples")
    fig.tight_layout()
    fig.savefig(FIGURES / "error_distribution.png", bbox_inches="tight")
    plt.close(fig)


def write_dataset_artifacts(manifest: dict, features: np.ndarray, countries: list[str], timestamps: list[str], train_x: np.ndarray, val_x: np.ndarray, test_x: np.ndarray, warning: float, critical: float) -> None:
    """Persist the dataset, preprocessing, and feature-extraction evidence."""

    quality = manifest["quality"]
    profile = {
        "sources": manifest["sources"],
        "dynamic_rows": manifest["dataset"]["dynamic_rows"],
        "power_flow_rows": manifest["dataset"]["power_rows"],
        "dynamic_column_count": len(manifest["dataset"]["dynamic_columns"]),
        "power_flow_column_count": len(manifest["dataset"]["power_columns"]),
        "dynamic_columns": manifest["dataset"]["dynamic_columns"],
        "power_flow_columns": manifest["dataset"]["power_columns"],
        "countries": countries,
        "node_count": len(countries),
        "edge_count": manifest["dataset"]["edge_count"],
        "date_min": manifest["dataset"]["date_min"],
        "date_max": manifest["dataset"]["date_max"],
        "processed_history_points_per_country": len(timestamps),
        "quality_checks": {
            "dynamic_missing_cells": quality["dynamic_missing_cells"],
            "power_missing_cells": quality["power_missing_cells"],
            "dynamic_duplicate_keys": quality["dynamic_duplicate_keys"],
            "power_duplicate_keys": quality["power_duplicate_keys"],
            "country_timestamp_gap_total": quality["country_timestamp_gap_total"],
            "normalized_interconnector_alias_count": len(quality["normalized_interconnector_aliases"]),
        },
        "engineering_limitations": quality["physical_loss"],
    }
    preprocessing = {
        "steps": [
            {"step": 1, "name": "Parse", "detail": "Read both CSVs with UTF-8 BOM handling and parse UTC timestamps."},
            {"step": 2, "name": "Validate", "detail": "Count missing cells, duplicate keys, invalid country codes, and hourly gaps."},
            {"step": 3, "name": "Canonicalize", "detail": "Map each interconnector to sorted endpoint ID and keep raw aliases for audit."},
            {"step": 4, "name": "Align", "detail": "Retain the common recent history and align country features by hourly timestamp."},
            {"step": 5, "name": "Scale", "detail": "Fit feature and target mean/std only on the training window, then apply to validation and test."},
            {"step": 6, "name": "Split", "detail": "Use the final 168 hours as a chronological holdout; no random shuffle crosses the split."},
            {"step": 7, "name": "Evaluate", "detail": "Compare classical baselines, Fusion GRU, and DCRNN on the same target and holdout."},
        ],
        "sequence_length_hours": SEQ_LEN,
        "window_stride_hours": WINDOW_STRIDE,
        "test_horizon_hours": TEST_HORIZON,
        "train_samples_fusion_gru": int(len(train_x)),
        "validation_samples_fusion_gru": int(len(val_x)),
        "test_samples_fusion_gru": int(len(test_x)),
        "warning_threshold_mw": warning,
        "critical_threshold_mw": critical,
        "threshold_rule": "absolute net-flow magnitude at the 75th and 90th training quantiles",
    }
    (RESULTS / "dataset_profile.json").write_text(json.dumps(profile, indent=2), encoding="utf-8")
    (RESULTS / "preprocessing_summary.json").write_text(json.dumps(preprocessing, indent=2), encoding="utf-8")
    (RESULTS / "feature_catalog.json").write_text(json.dumps({"features": FEATURE_CATALOG, "feature_count": len(FEATURE_CATALOG), "tensor_shape": list(features.shape)}, indent=2), encoding="utf-8")


def run_experiment() -> dict:
    seed_everything()
    RESULTS.mkdir(parents=True, exist_ok=True)
    series = read_json(PROCESSED / "series.json")
    manifest = read_json(PROCESSED / "manifest.json")
    baseline_metrics = read_json(PROCESSED / "model_metrics.json")
    features, targets, countries, timestamps = build_feature_tensor(series, manifest)
    samples = make_samples(features, targets, countries, timestamps)
    train_x, train_y, val_x, val_y, test_x, test_y, test_meta = samples
    train_x, val_x, test_x, train_y, val_y, test_y, x_mean, x_std, y_mean, y_std = standardize(train_x, val_x, test_x, train_y, val_y, test_y)
    warning = float(np.quantile(np.abs(train_y * y_std + y_mean), 0.75))
    critical = float(np.quantile(np.abs(train_y * y_std + y_mean), 0.90))

    write_dataset_artifacts(manifest, features, countries, timestamps, train_x, val_x, test_x, warning, critical)

    model = FusionGRU(train_x.shape[-1], hidden_size=32)
    curves = training_curves(model, train_x, train_y, val_x, val_y, y_mean, y_std, warning, critical)
    prediction_start = time.perf_counter()
    test_pred, test_actual, test_cls = evaluate_model(model, test_x, test_y, y_mean, y_std, warning, critical)
    inference_ms = (time.perf_counter() - prediction_start) * 1000.0
    test_reg = regression_metrics(test_actual, test_pred)

    # DCRNN receives the same engineered tensor but keeps the node dimension
    # intact. Its graph convolution therefore uses the canonical topology at
    # every recurrent step instead of flattening neighboring countries into a
    # global summary feature.
    global_samples = make_global_samples(features, targets, timestamps)
    global_train_x, global_train_y, global_val_x, global_val_y, global_test_x, global_test_y, dcrnn_test_meta = global_samples
    global_train_x, global_val_x, global_test_x, global_train_y, global_val_y, global_test_y, _, _, global_y_mean, global_y_std = standardize_global(
        global_train_x, global_val_x, global_test_x, global_train_y, global_val_y, global_test_y
    )
    transitions = build_transition_matrices(manifest, countries)
    dcrnn = DCRNN(global_train_x.shape[-1], hidden_size=24, transitions=transitions, diffusion_steps=2)
    dcrnn_curves = training_curves_global(dcrnn, global_train_x, global_train_y, global_val_x, global_val_y, global_y_mean, global_y_std, warning, critical)
    dcrnn_start = time.perf_counter()
    dcrnn_test_pred_matrix, dcrnn_test_actual_matrix, dcrnn_test_cls = evaluate_global_model(
        dcrnn, global_test_x, global_test_y, global_y_mean, global_y_std, warning, critical
    )
    dcrnn_inference_ms = (time.perf_counter() - dcrnn_start) * 1000.0
    dcrnn_test_pred = dcrnn_test_pred_matrix.reshape(-1)
    dcrnn_test_actual = dcrnn_test_actual_matrix.reshape(-1)
    dcrnn_reg = regression_metrics(dcrnn_test_actual, dcrnn_test_pred)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    torch.save({"state_dict": model.state_dict(), "feature_names": FEATURE_NAMES, "sequence_length": SEQ_LEN}, MODEL_DIR / "fusion_gru.pt")
    torch.save({"state_dict": dcrnn.state_dict(), "feature_names": FEATURE_NAMES, "countries": countries, "sequence_length": SEQ_LEN, "diffusion_steps": 2}, MODEL_DIR / "dcrnn.pt")

    baseline_inference = {}
    denormalized_test_history = test_x[:, :, 0] * x_std[0] + x_mean[0]
    for baseline_name in ("persistence", "moving_average", "seasonal_naive", "linear_trend"):
        start = time.perf_counter()
        for history in denormalized_test_history:
            baseline_prediction(history, baseline_name)
        baseline_inference[baseline_name] = (time.perf_counter() - start) * 1000.0

    comparison = []
    for item in baseline_metrics["metrics"]:
        comparison.append({
            "model": item["model"],
            "label": item["label"],
            "rmse": item["rmse"],
            "mae": item["mae"],
            "mape": item["mape"],
            "accuracy": item["accuracy"],
            "precision": item["precision"],
            "recall": item["recall"],
            "f1": item["f1"],
            "inference_time_ms": baseline_inference.get(item["model"]),
            "source": "existing chronological baseline artifact",
        })
    comparison.append({
        "model": "fusion_gru",
        "label": "Fusion GRU",
        **test_reg,
        **{key: test_cls[key] for key in ("accuracy", "precision", "recall", "f1")},
        "inference_time_ms": inference_ms,
        "source": "trained in this experiment run",
    })
    comparison.append({
        "model": "dcrnn",
        "label": "DCRNN",
        **dcrnn_reg,
        **{key: dcrnn_test_cls[key] for key in ("accuracy", "precision", "recall", "f1")},
        "inference_time_ms": dcrnn_inference_ms,
        "source": "trained in this experiment run",
    })

    actual_labels = classification_scores(test_actual, warning, critical)
    predicted_labels = classification_scores(test_pred, warning, critical)
    confusion = {actual: {predicted: 0 for predicted in LABELS} for actual in LABELS}
    for actual, predicted in zip(actual_labels, predicted_labels):
        confusion[actual][predicted] += 1

    roc_pr = roc_pr_curves(actual_labels, test_pred, warning, critical)

    dcrnn_actual_labels = classification_scores(dcrnn_test_actual, warning, critical)
    dcrnn_predicted_labels = classification_scores(dcrnn_test_pred, warning, critical)
    dcrnn_confusion = {actual: {predicted: 0 for predicted in LABELS} for actual in LABELS}
    for actual, predicted in zip(dcrnn_actual_labels, dcrnn_predicted_labels):
        dcrnn_confusion[actual][predicted] += 1
    dcrnn_roc_pr = roc_pr_curves(dcrnn_actual_labels, dcrnn_test_pred, warning, critical)

    model.eval()
    with torch.no_grad():
        _, val_hidden = model(torch.from_numpy(val_x), return_hidden=True)
    val_hidden_np = val_hidden.numpy()
    val_actual_unscaled = val_y * y_std + y_mean
    # Use a deterministic, bounded sample so the saved t-SNE file stays easy to inspect.
    sample_count = min(len(val_hidden_np), 480)
    sample_indices = np.linspace(0, len(val_hidden_np) - 1, sample_count, dtype=int)
    tsne = TSNE(n_components=2, perplexity=min(30, max(5, sample_count // 10)), init="pca", learning_rate="auto", random_state=SEED)
    projection = tsne.fit_transform(val_hidden_np[sample_indices])
    embedding = [
        {"x": float(point[0]), "y": float(point[1]), "class": class_from_value(float(val_actual_unscaled[idx]), warning, critical)}
        for point, idx in zip(projection, sample_indices)
    ]

    baseline_val_pred, baseline_val_actual, _ = evaluate_model(model, val_x, val_y, y_mean, y_std, warning, critical)
    baseline_val_mae = float(np.mean(np.abs(baseline_val_pred - baseline_val_actual)))
    feature_rows = []
    rng = np.random.default_rng(SEED)
    for feature_idx, feature_name in enumerate(FEATURE_NAMES):
        shuffled = val_x.copy()
        flat = shuffled[:, :, feature_idx].reshape(-1)
        rng.shuffle(flat)
        shuffled[:, :, feature_idx] = flat.reshape(shuffled[:, :, feature_idx].shape)
        shuffled_pred, _, _ = evaluate_model(model, shuffled, val_y, y_mean, y_std, warning, critical)
        shuffled_mae = float(np.mean(np.abs(shuffled_pred - baseline_val_actual)))
        ablated = val_x.copy()
        ablated[:, :, feature_idx] = 0.0
        ablated_pred, _, _ = evaluate_model(model, ablated, val_y, y_mean, y_std, warning, critical)
        ablated_mae = float(np.mean(np.abs(ablated_pred - baseline_val_actual)))
        feature_rows.append({
            "feature": feature_name,
            "baseline_validation_mae": baseline_val_mae,
            "permutation_mae": shuffled_mae,
            "permutation_delta_mae": shuffled_mae - baseline_val_mae,
            "ablation_mae": ablated_mae,
            "ablation_delta_mae": ablated_mae - baseline_val_mae,
        })
    feature_rows.sort(key=lambda row: row["permutation_delta_mae"], reverse=True)

    errors = []
    for meta, actual, predicted, actual_label, predicted_label in zip(test_meta, test_actual, test_pred, actual_labels, predicted_labels):
        country_idx = countries.index(meta["country"])
        local_idx = meta["index"]
        row = {
            **meta,
            "actual_net_flow_mw": float(actual),
            "predicted_net_flow_mw": float(predicted),
            "absolute_error_mw": float(abs(predicted - actual)),
            "actual_class": actual_label,
            "predicted_class": predicted_label,
            "local_load_mw": float(features[country_idx, local_idx, 1]),
            "local_imbalance_ratio": float(features[country_idx, local_idx, 2]),
        }
        errors.append(row)
    errors.sort(key=lambda row: row["absolute_error_mw"])
    successes = [row for row in errors if row["actual_class"] == row["predicted_class"]][:5]
    failures = sorted([row for row in errors if row["actual_class"] != row["predicted_class"]], key=lambda row: row["absolute_error_mw"], reverse=True)[:5]

    fusion_row = next(row for row in comparison if row["model"] == "fusion_gru")
    dcrnn_row = next(row for row in comparison if row["model"] == "dcrnn")
    selected_baseline = next(row for row in comparison if row["model"] == baseline_metrics["selected_model"])
    if fusion_row["rmse"] > selected_baseline["rmse"]:
        diagnosis = [
            "Persistence is a strong benchmark because hourly net flow is highly autocorrelated over a short horizon.",
            "The Fusion GRU sees only 624 pre-validation hours per country after the 24-hour lookback and chronological split.",
            "Global graph context adds parameters, but the supplied data does not include physical line ratings, dispatch constraints, or market shocks.",
            "The recurrent model therefore pays a complexity cost without enough exogenous signal to beat the local last-value baseline.",
        ]
    else:
        diagnosis = [
            "Fusion GRU does not lag the selected baseline on this run; its improvement is measured rather than assumed.",
            "The comparison still shows why a baseline matters: it is simpler, faster, and easier to audit.",
            "The supplied data lacks physical line ratings, dispatch constraints, and market shocks, so gains may not generalize.",
        ]

    research_winner = min(comparison, key=lambda row: (row["rmse"], row["mae"]))
    dcrnn_diagnosis = [
        "DCRNN applies forward and reverse graph diffusion before each recurrent update, so neighboring countries share hidden state information.",
        "Its comparison uses the same 24-hour lookback, training-only scaling, chronological validation, and 168-hour test horizon as Fusion GRU.",
        "A stronger DCRNN score would support graph context; a weaker score is still useful evidence because the topology and training protocol remain fixed.",
        "The model is a forecasting benchmark. It does not solve power-flow equations or authorize switching and dispatch actions.",
    ]

    write_csv(RESULTS / "model_comparison.csv", comparison, ["model", "label", "rmse", "mae", "mape", "accuracy", "precision", "recall", "f1", "inference_time_ms", "source"])
    (RESULTS / "model_comparison.json").write_text(json.dumps({
        "models": comparison,
        "research_winner": research_winner,
        "operational_baseline": selected_baseline,
        "selection_rule": "lowest pooled RMSE on the common chronological holdout",
    }, indent=2), encoding="utf-8")
    write_csv(RESULTS / "training_curves.csv", curves, list(curves[0].keys()))
    write_csv(RESULTS / "feature_importance.csv", feature_rows, list(feature_rows[0].keys()))
    (RESULTS / "feature_importance.json").write_text(json.dumps({"features": feature_rows}, indent=2), encoding="utf-8")
    (RESULTS / "training_curves.json").write_text(json.dumps({"model": "Fusion GRU", "epochs": curves}, indent=2), encoding="utf-8")
    write_csv(RESULTS / "dcrnn_training_curves.csv", dcrnn_curves, list(dcrnn_curves[0].keys()))
    (RESULTS / "dcrnn_training_curves.json").write_text(json.dumps({"model": "DCRNN", "epochs": dcrnn_curves}, indent=2), encoding="utf-8")
    (RESULTS / "confusion_matrix.json").write_text(json.dumps({"model": "DCRNN", "labels": LABELS, "matrix": dcrnn_confusion, "thresholds": {"warning": warning, "critical": critical}, "models": {"DCRNN": dcrnn_confusion, "Fusion GRU": confusion}}, indent=2), encoding="utf-8")
    (RESULTS / "fusion_gru_confusion_matrix.json").write_text(json.dumps({"model": "Fusion GRU", "labels": LABELS, "matrix": confusion, "thresholds": {"warning": warning, "critical": critical}}, indent=2), encoding="utf-8")
    (RESULTS / "roc_pr_curves.json").write_text(json.dumps({"model": "DCRNN", **dcrnn_roc_pr}, indent=2), encoding="utf-8")
    (RESULTS / "fusion_gru_roc_pr_curves.json").write_text(json.dumps({"model": "Fusion GRU", **roc_pr}, indent=2), encoding="utf-8")
    (RESULTS / "dcrnn_analysis.json").write_text(json.dumps({"dcrnn": dcrnn_row, "fusion_gru": fusion_row, "operational_baseline": selected_baseline, "research_winner": research_winner, "diagnosis": dcrnn_diagnosis}, indent=2), encoding="utf-8")
    (RESULTS / "embedding_projection.json").write_text(json.dumps({"method": "t-SNE", "model": "Fusion GRU", "points": embedding}, indent=2), encoding="utf-8")
    (RESULTS / "error_analysis.json").write_text(json.dumps({"model": "Fusion GRU", "successes": successes, "failures": failures, "test_examples": len(errors)}, indent=2), encoding="utf-8")
    (RESULTS / "fusion_gru_analysis.json").write_text(json.dumps({"selected_baseline": selected_baseline, "fusion_gru": fusion_row, "diagnosis": diagnosis}, indent=2), encoding="utf-8")
    (RESULTS / "run_metadata.json").write_text(json.dumps({
        "seed": SEED,
        "epochs": EPOCHS,
        "sequence_length_hours": SEQ_LEN,
        "window_stride_hours": WINDOW_STRIDE,
        "test_horizon_hours": TEST_HORIZON,
        "countries": countries,
        "feature_names": FEATURE_NAMES,
        "train_samples": len(train_x),
        "validation_samples": len(val_x),
        "test_samples": len(test_x),
        "framework": "PyTorch Fusion GRU and DCRNN with NumPy/scikit-learn/Matplotlib result tooling",
        "data_source": "data/processed artifacts generated from supplied CSVs",
        "dcrnn": {
            "input_shape": list(global_train_x.shape),
            "hidden_size": 24,
            "diffusion_steps": 2,
            "transition_matrices": "forward and reverse row-normalized canonical graph adjacency",
            "graph_edges": int(len(manifest["graph"]["edges"])),
            "train_samples": int(len(global_train_x)),
            "validation_samples": int(len(global_val_x)),
            "test_samples": int(len(global_test_x)),
        },
    }, indent=2), encoding="utf-8")
    (RESULTS / "README.md").write_text("""# GridPulse experiment results\n\nThis folder is generated by `python backend/experiments.py` after the canonical pipeline runs. JSON and CSV files are the source of truth for the research presentation. The figures folder contains light-background PNG exports suitable for reports.\n\nThe Fusion GRU uses a 24-hour lookback, local country signals, global network context, and static centrality features. DCRNN uses the same engineered tensor but preserves the 12-node graph and applies forward and reverse diffusion before each recurrent update. Both models use training-only standardization and the final 168 hours per country as the chronological test horizon.\n\nResults include dataset profiling, preprocessing evidence, feature catalog, training traces, ROC/PR curves, confusion matrices, model comparison, t-SNE hidden-state projection, permutation/ablation importance, qualitative error examples, graph stress propagation, node influence, and counterfactual edge-resilience ranking. The saved `models/` directory contains the trained checkpoints.\n\nThe graph-analysis artifacts use dynamic utilization, node risk, centrality, topology-removal impact, and the distance-loss proxy. They are transparent screening evidence, not engineering-grade power-flow or N-1 certification.\n\nThe physical-loss calculation remains a distance-based proxy. Neither neural model is a dispatch controller.\n""", encoding="utf-8")
    save_figures(curves, dcrnn_curves, roc_pr, dcrnn_roc_pr, comparison, feature_rows, embedding, errors)
    try:
        from graph_analysis import generate_result_artifacts
    except ImportError:
        from backend.graph_analysis import generate_result_artifacts
    graph_results = generate_result_artifacts()
    return {"results_dir": str(RESULTS), "fusion_gru": fusion_row, "dcrnn": dcrnn_row, "research_winner": research_winner, "selected_baseline": selected_baseline, "diagnosis": diagnosis, "dcrnn_diagnosis": dcrnn_diagnosis, "graph_analysis": graph_results}


def main() -> None:
    global EPOCHS
    parser = argparse.ArgumentParser(description="Generate GridPulse research result artifacts")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    args = parser.parse_args()
    EPOCHS = args.epochs
    print(json.dumps(run_experiment(), indent=2))


if __name__ == "__main__":
    main()

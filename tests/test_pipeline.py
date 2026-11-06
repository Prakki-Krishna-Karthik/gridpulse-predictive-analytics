import json
import unittest
from pathlib import Path

from backend.physics import calculate_distance_loss_proxy, calculate_three_phase_loss, haversine_distance_km


ROOT = Path(__file__).resolve().parents[1]


class ProcessedArtifactTests(unittest.TestCase):
    def setUp(self):
        self.manifest = json.loads((ROOT / "data" / "processed" / "manifest.json").read_text(encoding="utf-8"))
        self.metrics = json.loads((ROOT / "data" / "processed" / "model_metrics.json").read_text(encoding="utf-8"))

    def test_canonical_graph_is_non_empty(self):
        self.assertEqual(len(self.manifest["dataset"]["countries"]), 12)
        self.assertEqual(self.manifest["dataset"]["edge_count"], 24)
        self.assertGreater(len(self.manifest["graph"]["edges"]), 0)

    def test_duplicate_and_missing_checks_are_explicit(self):
        quality = self.manifest["quality"]
        self.assertEqual(quality["dynamic_missing_cells"], 0)
        self.assertEqual(quality["power_missing_cells"], 0)
        self.assertEqual(quality["dynamic_duplicate_keys"], 0)
        self.assertEqual(quality["power_duplicate_keys"], 0)

    def test_model_selection_has_required_metrics(self):
        required = {"mae", "rmse", "mape", "accuracy", "precision", "recall", "f1"}
        self.assertIn(self.metrics["selected_model"], {item["model"] for item in self.metrics["metrics"]})
        for item in self.metrics["metrics"]:
            self.assertTrue(required.issubset(item))
            self.assertGreater(item["n_predictions"], 0)

    def test_physical_loss_is_not_overclaimed(self):
        loss = self.manifest["quality"]["physical_loss"]
        self.assertEqual(loss["status"], "proxy_estimate")
        self.assertEqual(loss["engineering_grade"], "unavailable")
        self.assertGreaterEqual(len(loss["missing_parameters"]), 5)
        self.assertIn("Haversine", loss["assumptions"]["distance_method"])

    def test_physical_loss_formula_is_guarded_and_reproducible(self):
        unavailable = calculate_three_phase_loss(100, None, None, None, None)
        self.assertEqual(unavailable["status"], "unavailable")
        available = calculate_three_phase_loss(100, 400, 0.1, 10, 0.95)
        self.assertEqual(available["status"], "physical")
        self.assertGreater(available["loss_mw"], 0)

    def test_distance_proxy_is_reproducible(self):
        distance = haversine_distance_km(52.52, 13.405, 48.8566, 2.3522)
        self.assertGreater(distance, 800)
        proxy = calculate_distance_loss_proxy(1000, distance)
        self.assertEqual(proxy["status"], "proxy_estimate")
        self.assertGreater(proxy["resistance_ohm"], 0)
        self.assertGreater(proxy["loss_mw"], 0)


if __name__ == "__main__":
    unittest.main()

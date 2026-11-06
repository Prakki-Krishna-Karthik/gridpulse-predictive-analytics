import unittest

from backend.routing import plan_reroute


class RoutingTests(unittest.TestCase):
    def test_prefers_feasible_alternate_path(self):
        edges = [
            {"id": "A-B", "source": "A", "target": "B", "magnitude_mw": 100, "capacity_proxy_mw": 100, "utilization": 1.0, "risk_class": "Critical", "distance_km": 100, "loss_pct_of_flow": .01},
            {"id": "A-C", "source": "A", "target": "C", "magnitude_mw": 10, "capacity_proxy_mw": 200, "utilization": .05, "risk_class": "Normal", "distance_km": 80, "loss_pct_of_flow": .01},
            {"id": "C-B", "source": "C", "target": "B", "magnitude_mw": 10, "capacity_proxy_mw": 200, "utilization": .05, "risk_class": "Normal", "distance_km": 80, "loss_pct_of_flow": .01},
        ]
        result = plan_reroute(edges, "A-B", 25)
        self.assertTrue(result["feasible"])
        self.assertEqual(result["nodes"], ["A", "C", "B"])
        self.assertEqual(result["edge_ids"], ["A-C", "C-B"])
        self.assertEqual(result["bottlenecks"], [])

    def test_marks_best_effort_when_headroom_is_insufficient(self):
        edges = [
            {"id": "A-B", "source": "A", "target": "B", "magnitude_mw": 100, "capacity_proxy_mw": 100, "utilization": 1.0, "risk_class": "Critical", "distance_km": 100, "loss_pct_of_flow": .01},
            {"id": "A-C", "source": "A", "target": "C", "magnitude_mw": 90, "capacity_proxy_mw": 100, "utilization": .9, "risk_class": "Warning", "distance_km": 80, "loss_pct_of_flow": .01},
            {"id": "C-B", "source": "C", "target": "B", "magnitude_mw": 90, "capacity_proxy_mw": 100, "utilization": .9, "risk_class": "Warning", "distance_km": 80, "loss_pct_of_flow": .01},
        ]
        result = plan_reroute(edges, "A-B", 25)
        self.assertFalse(result["feasible"])
        self.assertEqual(result["status"], "best_effort_only")
        self.assertTrue(result["bottlenecks"])


if __name__ == "__main__":
    unittest.main()

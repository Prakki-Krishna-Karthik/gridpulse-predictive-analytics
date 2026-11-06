import json
import unittest
from urllib.request import Request, urlopen


BASE = "http://127.0.0.1:8000"


class ApiSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Run manually after starting `python backend/server.py`.
        try:
            with urlopen(f"{BASE}/api/health", timeout=1) as response:
                cls.available = response.status == 200
        except Exception:
            cls.available = False

    def require_server(self):
        if not self.available:
            self.skipTest("Start python backend/server.py before API smoke tests")

    def get_json(self, path):
        with urlopen(f"{BASE}{path}", timeout=5) as response:
            return json.loads(response.read().decode("utf-8"))

    def test_health(self):
        self.require_server()
        self.assertEqual(self.get_json("/api/health")["status"], "ok")

    def test_metadata_and_forecast(self):
        self.require_server()
        metadata = self.get_json("/api/metadata")
        self.assertEqual(len(metadata["dataset"]["countries"]), 12)
        forecast = self.get_json("/api/forecast?country=DE&horizon=3")
        self.assertEqual(len(forecast["forecast"]), 3)

    def test_what_if_validates_edge(self):
        self.require_server()
        payload = json.dumps({"edge_id": "DE-FR", "reduction_pct": 10}).encode("utf-8")
        request = Request(f"{BASE}/api/what-if", data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=5) as response:
            body = json.loads(response.read().decode("utf-8"))
        self.assertEqual(body["edge_id"], "DE-FR")
        self.assertIn("projected", body)
        self.assertIn("route_plan", body)

    def test_route_plan_endpoint(self):
        self.require_server()
        body = self.get_json("/api/route-plan?edge_id=AT-DE&reduction_pct=25")
        self.assertEqual(body["edge_id"], "AT-DE")
        self.assertIn("nodes", body)
        self.assertIn("loss_delta_mw", body)

    def test_physical_loss_guard(self):
        self.require_server()
        body = self.get_json("/api/physical-loss")
        self.assertEqual(body["status"], "unavailable")
        self.assertIn("line_voltage_kv", body["missing_parameters"])


if __name__ == "__main__":
    unittest.main()

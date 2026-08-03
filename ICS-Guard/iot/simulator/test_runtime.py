import concurrent.futures
import json
import os
import tempfile
import unittest
import urllib.error
import urllib.request
from unittest import mock

from plant_db import PlantDB
from runtime_api import RuntimeAPIServer
from runtime_contracts import (
    calculate_policy_hash,
    canonical_sha256,
    evaluate_policy,
    normalize_attack_scenario,
)


def device(device_id, node_type="sensor", name=None, zone="purdue-l1"):
    return {
        "_id": device_id,
        "name": name or device_id,
        "type": node_type,
        "node_type": node_type,
        "zone": zone,
        "ipAddress": "192.168.1.10",
        "macAddress": "00:11:22:33:44:55",
        "status": "active",
        "security_status": "isolated",
    }


class PlantDBTestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tempdir.name, "plant.sqlite")
        self.db = PlantDB(
            self.db_path,
            runtime_id="hardware-test",
            bump_generation=False,
        )

    def tearDown(self):
        self.tempdir.cleanup()

    def test_snapshot_is_sorted_utf8_and_excludes_security_ownership(self):
        self.db.seed_devices(
            [
                device("sensor-b", name="Cảm biến"),
                device("sensor-a", name="Máy bơm"),
            ]
        )
        snapshot = self.db.generate_full_snapshot()

        self.assertEqual(
            [item["device_id"] for item in snapshot["devices"]],
            ["sensor-a", "sensor-b"],
        )
        self.assertTrue(
            all("security_status" not in item for item in snapshot["devices"])
        )
        canonical = self.db.canonical_snapshot_bytes(snapshot)
        self.assertIn("Máy bơm".encode("utf-8"), canonical)
        self.assertNotIn(b"\\u00e1", canonical)

        unsigned = dict(snapshot)
        unsigned.pop("checksum")
        self.assertEqual(snapshot["checksum"], canonical_sha256(unsigned))

    def test_device_write_and_revision_are_one_transaction(self):
        self.db.seed_devices([device("seed")])
        initial_revision = int(self.db.get_metadata()["snapshot_revision"])

        with mock.patch.object(
            PlantDB,
            "_bump_revision",
            side_effect=RuntimeError("injected revision failure"),
        ):
            with self.assertRaises(RuntimeError):
                self.db.upsert_device(device("must-rollback"))

        self.assertIsNone(self.db.get_device("must-rollback"))
        self.assertEqual(
            int(self.db.get_metadata()["snapshot_revision"]),
            initial_revision,
        )

    def test_crud_is_serialized_across_threads(self):
        self.db.seed_devices([device("seed")])
        start_revision = int(self.db.get_metadata()["snapshot_revision"])

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            list(
                pool.map(
                    lambda index: self.db.upsert_device(
                        device(f"thread-{index}")
                    ),
                    range(12),
                )
            )

        self.assertEqual(len(self.db.get_all_devices()), 13)
        self.assertEqual(
            int(self.db.get_metadata()["snapshot_revision"]),
            start_revision + 12,
        )

    def test_command_ack_is_persistent_and_detects_id_reuse(self):
        self.db.seed_devices([device("plc-1", node_type="controller")])
        claim = self.db.claim_command(
            "cmd-1",
            "isolate",
            "hardware-test",
            "plc-1",
            "hash-a",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:30Z",
        )
        self.assertEqual(claim["state"], "claimed")
        ack = {
            "command_id": "cmd-1",
            "status": "succeeded",
            "target_id": "plc-1",
        }
        self.db.finalize_command("cmd-1", "hash-a", "succeeded", ack)

        reopened = PlantDB(self.db_path, bump_generation=False)
        duplicate = reopened.claim_command(
            "cmd-1",
            "isolate",
            "hardware-test",
            "plc-1",
            "hash-a",
            None,
            None,
        )
        conflict = reopened.claim_command(
            "cmd-1",
            "isolate",
            "hardware-test",
            "plc-1",
            "hash-b",
            None,
            None,
        )
        self.assertEqual(duplicate["state"], "duplicate")
        self.assertEqual(duplicate["record"]["final_ack"], ack)
        self.assertEqual(conflict["state"], "conflict")

    def test_attack_lease_cleanup_only_removes_its_target_overlay(self):
        self.db.seed_devices(
            [
                device("plc-a", node_type="controller"),
                device("plc-b", node_type="controller"),
            ]
        )
        accepted_a = {"request_id": "run-a", "status": "ACCEPTED"}
        accepted_b = {"request_id": "run-b", "status": "ACCEPTED"}
        self.db.start_attack_lease(
            "run-a",
            "hardware-test",
            "plc-a",
            "modbus-flood",
            "modbus_flooding",
            "hash-a",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:10Z",
            accepted_a,
        )
        self.db.start_attack_lease(
            "run-b",
            "hardware-test",
            "plc-b",
            "logic-tampering",
            "logic_tampering",
            "hash-b",
            "2026-01-01T00:00:00Z",
            "2026-01-01T00:00:20Z",
            accepted_b,
        )

        terminal = self.db.rollback_device("plc-a")
        states = self.db.get_runtime_states()
        self.assertEqual(terminal[0]["request_id"], "run-a")
        self.assertEqual(states["plc-a"]["overlay"], {})
        self.assertEqual(
            states["plc-b"]["overlay"]["request_id"],
            "run-b",
        )

        expired = self.db.expire_attack_leases("2026-01-01T00:00:30Z")
        self.assertEqual([ack["request_id"] for ack in expired], ["run-b"])
        self.assertEqual(self.db.get_runtime_states()["plc-b"]["overlay"], {})

    def test_policy_activation_is_atomic_and_persistent(self):
        policy = {
            "policy_id": "main",
            "version": 2,
            "default_action": "deny",
            "asset_zone_map": {"plc-a": "purdue-l1"},
            "rules": [
                {
                    "priority": 10,
                    "source_zone": "attack-lab",
                    "destination_zone": "purdue-l1",
                    "protocol": "modbus-tcp",
                    "port": 502,
                    "action": "allow",
                }
            ],
        }
        policy_hash = calculate_policy_hash(policy)
        ack = {
            "command_id": "apply-2",
            "status": "succeeded",
            "policy_hash": policy_hash,
        }
        result = self.db.apply_policy(
            "apply-2",
            "hardware-test",
            policy,
            policy_hash,
            "envelope-2",
            ack,
        )
        self.assertEqual(result["state"], "applied")

        stale_policy = dict(policy)
        stale_policy["version"] = 1
        stale_result = self.db.apply_policy(
            "apply-1",
            "hardware-test",
            stale_policy,
            calculate_policy_hash(stale_policy),
            "envelope-1",
            {"command_id": "apply-1", "status": "succeeded"},
        )
        self.assertEqual(stale_result["state"], "stale")

        reopened = PlantDB(self.db_path, bump_generation=False)
        self.assertEqual(
            reopened.get_active_policy("hardware-test"),
            policy,
        )
        decision = evaluate_policy(
            policy,
            {
                "source_zone": "attack-lab",
                "destination_device_id": "plc-a",
                "destination_zone": "purdue-l1",
                "protocol": "modbus-tcp",
                "port": 502,
            },
        )
        self.assertEqual(decision["action"], "allow")

    def test_attack_scenario_contract_maps_adapter_ids(self):
        state, error = normalize_attack_scenario(
            "modbus-flood",
            "controller",
        )
        self.assertIsNone(error)
        self.assertEqual(state, "modbus_flooding")


class RuntimeAPITestCase(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        db_path = os.path.join(self.tempdir.name, "api.sqlite")
        self.db = PlantDB(
            db_path,
            runtime_id="hardware-api",
            bump_generation=False,
        )
        self.db.seed_devices([device("sensor-api")])
        self.commits = 0

        def committed():
            self.commits += 1

        self.server = RuntimeAPIServer(
            self.db,
            service_key="service-secret",
            host="127.0.0.1",
            port=0,
            after_commit=committed,
        )
        self.server.start()
        self.port = self.server._server.server_address[1]

    def tearDown(self):
        self.server.stop()
        self.tempdir.cleanup()

    def request(self, path, key=None, method="GET", payload=None):
        data = None
        headers = {}
        if key:
            headers["x-service-key"] = key
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=data,
            headers=headers,
            method=method,
        )
        return urllib.request.urlopen(request, timeout=3)

    def test_service_key_is_required_and_crud_commits(self):
        with self.assertRaises(urllib.error.HTTPError) as unauthorized:
            self.request("/api/plant/devices")
        self.assertEqual(unauthorized.exception.code, 401)

        with self.request(
            "/api/plant/devices",
            key="service-secret",
        ) as response:
            devices = json.loads(response.read().decode("utf-8"))
        self.assertEqual(devices[0]["_id"], "sensor-api")

        with self.request(
            "/api/plant/devices",
            key="service-secret",
            method="POST",
            payload=device("sensor-created", name="Cảm biến mới"),
        ) as response:
            result = json.loads(response.read().decode("utf-8"))
        self.assertEqual(result["device"]["_id"], "sensor-created")
        self.assertEqual(self.commits, 1)


if __name__ == "__main__":
    unittest.main()

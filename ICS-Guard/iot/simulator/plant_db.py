import contextlib
import json
import os
import sqlite3
import threading
import uuid
from typing import Any, Dict, Iterable, List, Optional

from runtime_contracts import canonical_json_bytes, canonical_sha256, utc_now_iso


SAFE_EXTRA_FIELDS = (
    "description",
    "baseline_metrics",
    "firmware_version",
    "hardware_model",
    "icon_path",
)


class PlantDB:
    """Thread-safe authoritative runtime store for the simulator."""

    def __init__(
        self,
        db_path: Optional[str] = None,
        runtime_id: Optional[str] = None,
        bump_generation: bool = True,
    ):
        if not db_path:
            db_path = os.getenv(
                "PLANT_DB_PATH",
                os.path.join(os.path.dirname(__file__), "plant_db.sqlite"),
            )
        self.db_path = os.path.abspath(db_path)
        self._lock = threading.RLock()
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db(runtime_id or os.getenv("RUNTIME_ID", "hardware-01"))
        if bump_generation:
            self._begin_runtime_generation()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout = 10000")
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @contextlib.contextmanager
    def _write_transaction(self):
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN IMMEDIATE")
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()

    def _ensure_column(
        self,
        conn: sqlite3.Connection,
        table: str,
        column: str,
        definition: str,
    ) -> None:
        columns = {
            row["name"]
            for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
        }
        if column not in columns:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    def _init_db(self, runtime_id: str) -> None:
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("PRAGMA journal_mode = WAL")
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS plant_metadata (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS plant_devices (
                        device_id TEXT PRIMARY KEY,
                        external_device_id TEXT,
                        name TEXT NOT NULL,
                        type TEXT NOT NULL,
                        node_type TEXT NOT NULL DEFAULT 'sensor',
                        zone TEXT NOT NULL,
                        purdue_level TEXT NOT NULL DEFAULT 'L1',
                        parent_id TEXT,
                        ip_address TEXT NOT NULL,
                        mac_address TEXT NOT NULL,
                        operational_status TEXT NOT NULL DEFAULT 'active',
                        metadata_json TEXT NOT NULL DEFAULT '{}',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS plant_commands (
                        command_id TEXT PRIMARY KEY,
                        command_type TEXT NOT NULL,
                        runtime_id TEXT NOT NULL,
                        target_id TEXT NOT NULL,
                        envelope_hash TEXT NOT NULL,
                        status TEXT NOT NULL,
                        issued_at TEXT,
                        expires_at TEXT,
                        executed_at TEXT,
                        final_ack TEXT
                    );

                    CREATE TABLE IF NOT EXISTS device_runtime_state (
                        device_id TEXT PRIMARY KEY,
                        isolated INTEGER NOT NULL DEFAULT 0,
                        baseline_json TEXT NOT NULL DEFAULT '{}',
                        overlay_json TEXT NOT NULL DEFAULT '{}',
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS attack_leases (
                        request_id TEXT PRIMARY KEY,
                        runtime_id TEXT NOT NULL,
                        target_id TEXT NOT NULL,
                        scenario_id TEXT NOT NULL,
                        scenario_state TEXT NOT NULL,
                        payload_hash TEXT NOT NULL,
                        status TEXT NOT NULL,
                        started_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        accepted_ack TEXT,
                        final_ack TEXT,
                        updated_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS active_policies (
                        runtime_id TEXT PRIMARY KEY,
                        policy_id TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        policy_hash TEXT NOT NULL,
                        policy_json TEXT NOT NULL,
                        applied_at TEXT NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS policy_applications (
                        apply_id TEXT PRIMARY KEY,
                        runtime_id TEXT NOT NULL,
                        version INTEGER,
                        policy_hash TEXT,
                        envelope_hash TEXT NOT NULL,
                        status TEXT NOT NULL,
                        final_ack TEXT NOT NULL,
                        created_at TEXT NOT NULL
                    );
                    """
                )

                # Migrate databases created by the earlier prototype.
                self._ensure_column(
                    conn, "plant_devices", "node_type", "TEXT DEFAULT 'sensor'"
                )
                self._ensure_column(
                    conn, "plant_devices", "metadata_json", "TEXT DEFAULT '{}'"
                )
                self._ensure_column(
                    conn, "plant_commands", "runtime_id", "TEXT DEFAULT 'hardware-01'"
                )
                self._ensure_column(
                    conn, "plant_commands", "envelope_hash", "TEXT DEFAULT ''"
                )
                self._ensure_column(
                    conn, "plant_commands", "expires_at", "TEXT DEFAULT NULL"
                )

                conn.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS one_active_attack_per_target
                    ON attack_leases(target_id)
                    WHERE status = 'active'
                    """
                )
                defaults = {
                    "runtime_id": runtime_id,
                    "runtime_boot_id": str(uuid.uuid4()),
                    "runtime_generation": "0",
                    "snapshot_revision": "0",
                }
                for key, value in defaults.items():
                    conn.execute(
                        "INSERT OR IGNORE INTO plant_metadata(key, value) VALUES (?, ?)",
                        (key, value),
                    )
                conn.commit()
            finally:
                conn.close()

    def _begin_runtime_generation(self) -> None:
        with self._write_transaction() as conn:
            current = self._get_metadata_value(conn, "runtime_generation", "0")
            generation = int(current) + 1
            conn.execute(
                "UPDATE plant_metadata SET value = ? WHERE key = 'runtime_generation'",
                (str(generation),),
            )
            conn.execute(
                "UPDATE plant_metadata SET value = ? WHERE key = 'runtime_boot_id'",
                (str(uuid.uuid4()),),
            )

    @staticmethod
    def _get_metadata_value(
        conn: sqlite3.Connection,
        key: str,
        default: str,
    ) -> str:
        row = conn.execute(
            "SELECT value FROM plant_metadata WHERE key = ?",
            (key,),
        ).fetchone()
        return row["value"] if row else default

    @staticmethod
    def _bump_revision(conn: sqlite3.Connection) -> int:
        row = conn.execute(
            "SELECT value FROM plant_metadata WHERE key = 'snapshot_revision'"
        ).fetchone()
        revision = int(row["value"]) + 1 if row else 1
        conn.execute(
            """
            INSERT INTO plant_metadata(key, value) VALUES ('snapshot_revision', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(revision),),
        )
        return revision

    def get_metadata(self) -> Dict[str, str]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            rows = conn.execute("SELECT key, value FROM plant_metadata").fetchall()
            return {row["key"]: row["value"] for row in rows}

    def get_runtime_id(self) -> str:
        return self.get_metadata().get("runtime_id", "hardware-01")

    @staticmethod
    def _normalized_device(device_data: Dict[str, Any]) -> Dict[str, Any]:
        if not isinstance(device_data, dict):
            raise ValueError("device must be an object")
        device_id = device_data.get("device_id") or device_data.get("_id")
        if not isinstance(device_id, str) or not device_id.strip():
            raise ValueError("device_id is required")
        device_id = device_id.strip()

        node_type = str(
            device_data.get("node_type")
            or device_data.get("type")
            or "sensor"
        ).lower()
        device_type = str(device_data.get("type") or node_type)
        now = utc_now_iso()
        metadata = {
            key: device_data[key]
            for key in SAFE_EXTRA_FIELDS
            if key in device_data
        }
        return {
            "device_id": device_id,
            "external_device_id": str(
                device_data.get("external_device_id") or device_id
            ),
            "name": str(device_data.get("name") or device_id),
            "type": device_type,
            "node_type": node_type,
            "zone": str(device_data.get("zone") or "purdue-l1"),
            "purdue_level": str(device_data.get("purdue_level") or "L1"),
            "parent_id": device_data.get("parent_id"),
            "ip_address": str(
                device_data.get("ip_address")
                or device_data.get("ipAddress")
                or "0.0.0.0"
            ),
            "mac_address": str(
                device_data.get("mac_address")
                or device_data.get("macAddress")
                or "00:00:00:00:00:00"
            ),
            "operational_status": str(
                device_data.get("operational_status")
                or device_data.get("status")
                or "active"
            ),
            "metadata_json": json.dumps(
                metadata,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            ),
            "created_at": str(device_data.get("created_at") or now),
            "updated_at": now,
        }

    @staticmethod
    def _upsert_device_cursor(
        conn: sqlite3.Connection,
        device: Dict[str, Any],
    ) -> None:
        conn.execute(
            """
            INSERT INTO plant_devices (
                device_id, external_device_id, name, type, node_type, zone,
                purdue_level, parent_id, ip_address, mac_address,
                operational_status, metadata_json, created_at, updated_at
            ) VALUES (
                :device_id, :external_device_id, :name, :type, :node_type, :zone,
                :purdue_level, :parent_id, :ip_address, :mac_address,
                :operational_status, :metadata_json, :created_at, :updated_at
            )
            ON CONFLICT(device_id) DO UPDATE SET
                external_device_id = excluded.external_device_id,
                name = excluded.name,
                type = excluded.type,
                node_type = excluded.node_type,
                zone = excluded.zone,
                purdue_level = excluded.purdue_level,
                parent_id = excluded.parent_id,
                ip_address = excluded.ip_address,
                mac_address = excluded.mac_address,
                operational_status = excluded.operational_status,
                metadata_json = excluded.metadata_json,
                updated_at = excluded.updated_at
            """,
            device,
        )
        baseline = {
            "anomaly_state": "normal",
            "operational_status": device["operational_status"],
        }
        conn.execute(
            """
            INSERT OR IGNORE INTO device_runtime_state(
                device_id, isolated, baseline_json, overlay_json, updated_at
            ) VALUES (?, 0, ?, '{}', ?)
            """,
            (
                device["device_id"],
                json.dumps(baseline, separators=(",", ":"), sort_keys=True),
                device["updated_at"],
            ),
        )

    def seed_devices(self, devices: Iterable[Dict[str, Any]]) -> bool:
        normalized = [self._normalized_device(device) for device in devices]
        if not normalized:
            return False
        ids = [device["device_id"] for device in normalized]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate device_id in seed")
        with self._write_transaction() as conn:
            count = conn.execute("SELECT COUNT(*) AS count FROM plant_devices").fetchone()
            if int(count["count"]) > 0:
                return False
            for device in normalized:
                self._upsert_device_cursor(conn, device)
            self._bump_revision(conn)
        return True

    def upsert_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = self._normalized_device(device_data)
        with self._write_transaction() as conn:
            self._upsert_device_cursor(conn, normalized)
            revision = self._bump_revision(conn)
        result = self.get_device(normalized["device_id"])
        return {"device": result, "snapshot_revision": revision}

    def delete_device(self, device_id: str) -> Dict[str, Any]:
        if not isinstance(device_id, str) or not device_id.strip():
            raise ValueError("device_id is required")
        with self._write_transaction() as conn:
            cursor = conn.execute(
                "DELETE FROM plant_devices WHERE device_id = ?",
                (device_id,),
            )
            if cursor.rowcount == 0:
                return {"deleted": False, "snapshot_revision": None}
            conn.execute(
                "DELETE FROM device_runtime_state WHERE device_id = ?",
                (device_id,),
            )
            conn.execute(
                """
                UPDATE attack_leases
                SET status = 'cancelled', updated_at = ?
                WHERE target_id = ? AND status = 'active'
                """,
                (utc_now_iso(), device_id),
            )
            revision = self._bump_revision(conn)
        return {"deleted": True, "snapshot_revision": revision}

    @staticmethod
    def _device_from_row(
        row: sqlite3.Row,
        legacy_aliases: bool = False,
    ) -> Dict[str, Any]:
        metadata = {}
        try:
            metadata = json.loads(row["metadata_json"] or "{}")
        except (TypeError, json.JSONDecodeError):
            metadata = {}
        device = {
            "device_id": row["device_id"],
            "external_device_id": row["external_device_id"] or row["device_id"],
            "name": row["name"],
            "type": row["type"],
            "node_type": row["node_type"] or "sensor",
            "zone": row["zone"],
            "purdue_level": row["purdue_level"] or "L1",
            "parent_id": row["parent_id"],
            "ip_address": row["ip_address"],
            "mac_address": row["mac_address"],
            "operational_status": row["operational_status"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        device.update(metadata)
        if legacy_aliases:
            device.update(
                {
                    "_id": row["device_id"],
                    "ipAddress": row["ip_address"],
                    "macAddress": row["mac_address"],
                    "status": row["operational_status"],
                }
            )
        return device

    def get_device(
        self,
        device_id: str,
        legacy_aliases: bool = True,
    ) -> Optional[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            row = conn.execute(
                """
                SELECT device_id, external_device_id, name, type, node_type,
                       zone, purdue_level, parent_id, ip_address, mac_address,
                       operational_status, metadata_json, created_at, updated_at
                FROM plant_devices WHERE device_id = ?
                """,
                (device_id,),
            ).fetchone()
            return self._device_from_row(row, legacy_aliases) if row else None

    def get_all_devices(
        self,
        legacy_aliases: bool = True,
    ) -> List[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            rows = conn.execute(
                """
                SELECT device_id, external_device_id, name, type, node_type,
                       zone, purdue_level, parent_id, ip_address, mac_address,
                       operational_status, metadata_json, created_at, updated_at
                FROM plant_devices ORDER BY device_id ASC
                """
            ).fetchall()
            return [
                self._device_from_row(row, legacy_aliases)
                for row in rows
            ]

    def generate_full_snapshot(self) -> Dict[str, Any]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            conn.execute("BEGIN")
            metadata_rows = conn.execute(
                "SELECT key, value FROM plant_metadata"
            ).fetchall()
            metadata = {row["key"]: row["value"] for row in metadata_rows}
            rows = conn.execute(
                """
                SELECT device_id, external_device_id, name, type, node_type,
                       zone, purdue_level, parent_id, ip_address, mac_address,
                       operational_status, metadata_json, created_at, updated_at
                FROM plant_devices ORDER BY device_id ASC
                """
            ).fetchall()
            devices = [
                self._device_from_row(row, legacy_aliases=False)
                for row in rows
            ]
            conn.commit()

        snapshot = {
            "runtime_id": metadata.get("runtime_id", "hardware-01"),
            "runtime_boot_id": metadata.get("runtime_boot_id", ""),
            "runtime_generation": int(metadata.get("runtime_generation", "1")),
            "snapshot_revision": int(metadata.get("snapshot_revision", "0")),
            "snapshot_complete": True,
            "record_count": len(devices),
            "devices": sorted(devices, key=lambda item: item["device_id"]),
        }
        snapshot["checksum"] = canonical_sha256(snapshot)
        return snapshot

    def canonical_snapshot_bytes(self, snapshot: Dict[str, Any]) -> bytes:
        payload = dict(snapshot)
        payload.pop("checksum", None)
        payload["devices"] = sorted(
            payload.get("devices", []),
            key=lambda item: item.get("device_id", ""),
        )
        return canonical_json_bytes(payload)

    def get_command(self, command_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            row = conn.execute(
                "SELECT * FROM plant_commands WHERE command_id = ?",
                (command_id,),
            ).fetchone()
            return self._command_from_row(row) if row else None

    @staticmethod
    def _command_from_row(row: sqlite3.Row) -> Dict[str, Any]:
        result = dict(row)
        if result.get("final_ack"):
            result["final_ack"] = json.loads(result["final_ack"])
        return result

    def claim_command(
        self,
        command_id: str,
        command_type: str,
        runtime_id: str,
        target_id: str,
        payload_hash: str,
        issued_at: Optional[str],
        expires_at: Optional[str],
    ) -> Dict[str, Any]:
        with self._write_transaction() as conn:
            existing = conn.execute(
                "SELECT * FROM plant_commands WHERE command_id = ?",
                (command_id,),
            ).fetchone()
            if existing:
                record = self._command_from_row(existing)
                state = (
                    "duplicate"
                    if record.get("envelope_hash") == payload_hash
                    else "conflict"
                )
                return {"state": state, "record": record}
            conn.execute(
                """
                INSERT INTO plant_commands(
                    command_id, command_type, runtime_id, target_id,
                    envelope_hash, status, issued_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)
                """,
                (
                    command_id,
                    command_type,
                    runtime_id,
                    target_id,
                    payload_hash,
                    issued_at,
                    expires_at,
                ),
            )
        return {"state": "claimed", "record": None}

    def finalize_command(
        self,
        command_id: str,
        payload_hash: str,
        status: str,
        final_ack: Dict[str, Any],
    ) -> None:
        with self._write_transaction() as conn:
            cursor = conn.execute(
                """
                UPDATE plant_commands
                SET status = ?, executed_at = ?, final_ack = ?
                WHERE command_id = ? AND envelope_hash = ?
                """,
                (
                    status,
                    utc_now_iso(),
                    json.dumps(
                        final_ack,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ),
                    command_id,
                    payload_hash,
                ),
            )
            if cursor.rowcount != 1:
                raise ValueError("command claim not found or envelope hash mismatch")

    def get_runtime_states(self) -> Dict[str, Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            rows = conn.execute("SELECT * FROM device_runtime_state").fetchall()
        states = {}
        for row in rows:
            try:
                baseline = json.loads(row["baseline_json"] or "{}")
            except json.JSONDecodeError:
                baseline = {}
            try:
                overlay = json.loads(row["overlay_json"] or "{}")
            except json.JSONDecodeError:
                overlay = {}
            states[row["device_id"]] = {
                "isolated": bool(row["isolated"]),
                "baseline": baseline,
                "overlay": overlay,
            }
        return states

    def set_isolated(self, device_id: str, isolated: bool) -> None:
        if not self.get_device(device_id, legacy_aliases=False):
            raise ValueError(f"unknown target device: {device_id}")
        now = utc_now_iso()
        with self._write_transaction() as conn:
            conn.execute(
                """
                INSERT INTO device_runtime_state(
                    device_id, isolated, baseline_json, overlay_json, updated_at
                ) VALUES (?, ?, '{}', '{}', ?)
                ON CONFLICT(device_id) DO UPDATE SET
                    isolated = excluded.isolated,
                    updated_at = excluded.updated_at
                """,
                (device_id, 1 if isolated else 0, now),
            )

    @staticmethod
    def _terminal_attack_ack(
        row: sqlite3.Row,
        status: str,
        reason: str,
        now: str,
    ) -> Dict[str, Any]:
        return {
            "request_id": row["request_id"],
            "runtime_id": row["runtime_id"],
            "target_id": row["target_id"],
            "scenario_id": row["scenario_id"],
            "status": status,
            "terminal": True,
            "reason": reason,
            "executed_at": now,
        }

    @staticmethod
    def _clear_overlay_for_request(
        conn: sqlite3.Connection,
        target_id: str,
        request_id: str,
        now: str,
    ) -> None:
        row = conn.execute(
            "SELECT overlay_json FROM device_runtime_state WHERE device_id = ?",
            (target_id,),
        ).fetchone()
        if not row:
            return
        try:
            overlay = json.loads(row["overlay_json"] or "{}")
        except json.JSONDecodeError:
            overlay = {}
        if overlay.get("request_id") == request_id:
            conn.execute(
                """
                UPDATE device_runtime_state
                SET overlay_json = '{}', updated_at = ?
                WHERE device_id = ?
                """,
                (now, target_id),
            )

    def rollback_device(self, device_id: str) -> List[Dict[str, Any]]:
        if not self.get_device(device_id, legacy_aliases=False):
            raise ValueError(f"unknown target device: {device_id}")
        now = utc_now_iso()
        terminal_acks = []
        with self._write_transaction() as conn:
            active_rows = conn.execute(
                """
                SELECT * FROM attack_leases
                WHERE target_id = ? AND status = 'active'
                """,
                (device_id,),
            ).fetchall()
            for row in active_rows:
                ack = self._terminal_attack_ack(
                    row,
                    "STOPPED",
                    "security rollback restored target baseline",
                    now,
                )
                conn.execute(
                    """
                    UPDATE attack_leases
                    SET status = 'rolled_back', final_ack = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (
                        json.dumps(ack, separators=(",", ":"), sort_keys=True),
                        now,
                        row["request_id"],
                    ),
                )
                terminal_acks.append(ack)
            conn.execute(
                """
                UPDATE device_runtime_state
                SET isolated = 0, overlay_json = '{}', updated_at = ?
                WHERE device_id = ?
                """,
                (now, device_id),
            )
        return terminal_acks

    def get_attack_lease(self, request_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            row = conn.execute(
                "SELECT * FROM attack_leases WHERE request_id = ?",
                (request_id,),
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        for field in ("accepted_ack", "final_ack"):
            if result.get(field):
                result[field] = json.loads(result[field])
        return result

    def cache_attack_failure(
        self,
        request_id: str,
        runtime_id: str,
        target_id: str,
        scenario_id: str,
        payload_hash: str,
        final_ack: Dict[str, Any],
    ) -> Dict[str, Any]:
        with self._write_transaction() as conn:
            existing = conn.execute(
                "SELECT * FROM attack_leases WHERE request_id = ?",
                (request_id,),
            ).fetchone()
            if existing:
                record = dict(existing)
                cached_ack = (
                    json.loads(record["final_ack"])
                    if record.get("final_ack")
                    else json.loads(record["accepted_ack"])
                    if record.get("accepted_ack")
                    else None
                )
                return {
                    "state": (
                        "duplicate"
                        if record["payload_hash"] == payload_hash
                        else "conflict"
                    ),
                    "ack": cached_ack,
                }
            now = utc_now_iso()
            conn.execute(
                """
                INSERT INTO attack_leases(
                    request_id, runtime_id, target_id, scenario_id,
                    scenario_state, payload_hash, status, started_at,
                    expires_at, final_ack, updated_at
                ) VALUES (?, ?, ?, ?, '', ?, 'failed', ?, ?, ?, ?)
                """,
                (
                    request_id,
                    runtime_id,
                    target_id,
                    scenario_id,
                    payload_hash,
                    now,
                    now,
                    json.dumps(
                        final_ack,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ),
                    now,
                ),
            )
        return {"state": "stored", "ack": final_ack}

    def start_attack_lease(
        self,
        request_id: str,
        runtime_id: str,
        target_id: str,
        scenario_id: str,
        scenario_state: str,
        payload_hash: str,
        started_at: str,
        expires_at: str,
        accepted_ack: Dict[str, Any],
    ) -> Dict[str, Any]:
        with self._write_transaction() as conn:
            existing = conn.execute(
                "SELECT * FROM attack_leases WHERE request_id = ?",
                (request_id,),
            ).fetchone()
            if existing:
                record = dict(existing)
                return {
                    "state": (
                        "duplicate"
                        if record["payload_hash"] == payload_hash
                        else "conflict"
                    ),
                    "record": self.get_attack_lease(request_id),
                }
            active = conn.execute(
                """
                SELECT request_id FROM attack_leases
                WHERE target_id = ? AND status = 'active'
                """,
                (target_id,),
            ).fetchone()
            if active:
                return {
                    "state": "target_busy",
                    "active_request_id": active["request_id"],
                }
            now = utc_now_iso()
            conn.execute(
                """
                INSERT INTO attack_leases(
                    request_id, runtime_id, target_id, scenario_id,
                    scenario_state, payload_hash, status, started_at,
                    expires_at, accepted_ack, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
                """,
                (
                    request_id,
                    runtime_id,
                    target_id,
                    scenario_id,
                    scenario_state,
                    payload_hash,
                    started_at,
                    expires_at,
                    json.dumps(
                        accepted_ack,
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ),
                    now,
                ),
            )
            overlay = {
                "request_id": request_id,
                "scenario_id": scenario_id,
                "scenario_state": scenario_state,
            }
            conn.execute(
                """
                INSERT INTO device_runtime_state(
                    device_id, isolated, baseline_json, overlay_json, updated_at
                ) VALUES (?, 0, '{}', ?, ?)
                ON CONFLICT(device_id) DO UPDATE SET
                    overlay_json = excluded.overlay_json,
                    updated_at = excluded.updated_at
                """,
                (
                    target_id,
                    json.dumps(overlay, separators=(",", ":"), sort_keys=True),
                    now,
                ),
            )
        return {"state": "started", "record": None}

    def stop_attack_lease(
        self,
        request_id: str,
        target_id: str,
        reason: str = "operator stop",
    ) -> Optional[Dict[str, Any]]:
        now = utc_now_iso()
        with self._write_transaction() as conn:
            row = conn.execute(
                """
                SELECT * FROM attack_leases
                WHERE request_id = ? AND target_id = ?
                """,
                (request_id, target_id),
            ).fetchone()
            if not row:
                return None
            if row["status"] != "active":
                if row["final_ack"]:
                    return json.loads(row["final_ack"])
                return None
            ack = self._terminal_attack_ack(row, "STOPPED", reason, now)
            conn.execute(
                """
                UPDATE attack_leases
                SET status = 'stopped', final_ack = ?, updated_at = ?
                WHERE request_id = ?
                """,
                (
                    json.dumps(ack, separators=(",", ":"), sort_keys=True),
                    now,
                    request_id,
                ),
            )
            self._clear_overlay_for_request(conn, target_id, request_id, now)
            return ack

    def expire_attack_leases(self, now_iso: str) -> List[Dict[str, Any]]:
        terminal_acks = []
        with self._write_transaction() as conn:
            rows = conn.execute(
                """
                SELECT * FROM attack_leases
                WHERE status = 'active' AND expires_at <= ?
                ORDER BY expires_at ASC
                """,
                (now_iso,),
            ).fetchall()
            for row in rows:
                ack = self._terminal_attack_ack(
                    row,
                    "EXPIRED",
                    "attack lease reached its deadline",
                    now_iso,
                )
                conn.execute(
                    """
                    UPDATE attack_leases
                    SET status = 'expired', final_ack = ?, updated_at = ?
                    WHERE request_id = ?
                    """,
                    (
                        json.dumps(ack, separators=(",", ":"), sort_keys=True),
                        now_iso,
                        row["request_id"],
                    ),
                )
                self._clear_overlay_for_request(
                    conn,
                    row["target_id"],
                    row["request_id"],
                    now_iso,
                )
                terminal_acks.append(ack)
        return terminal_acks

    def get_active_attack_leases(self) -> List[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            rows = conn.execute(
                """
                SELECT * FROM attack_leases
                WHERE status = 'active'
                ORDER BY started_at ASC
                """
            ).fetchall()
        return [dict(row) for row in rows]

    def get_active_policy(self, runtime_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            row = conn.execute(
                "SELECT * FROM active_policies WHERE runtime_id = ?",
                (runtime_id,),
            ).fetchone()
        if not row:
            return None
        return json.loads(row["policy_json"])

    def get_policy_application(self, apply_id: str) -> Optional[Dict[str, Any]]:
        with self._lock, contextlib.closing(self._get_connection()) as conn:
            row = conn.execute(
                "SELECT * FROM policy_applications WHERE apply_id = ?",
                (apply_id,),
            ).fetchone()
        if not row:
            return None
        result = dict(row)
        result["final_ack"] = json.loads(result["final_ack"])
        return result

    def cache_policy_failure(
        self,
        apply_id: str,
        runtime_id: str,
        version: Optional[int],
        policy_hash: Optional[str],
        payload_hash: str,
        final_ack: Dict[str, Any],
    ) -> Dict[str, Any]:
        with self._write_transaction() as conn:
            existing = conn.execute(
                "SELECT * FROM policy_applications WHERE apply_id = ?",
                (apply_id,),
            ).fetchone()
            if existing:
                record = dict(existing)
                return {
                    "state": (
                        "duplicate"
                        if record["envelope_hash"] == payload_hash
                        else "conflict"
                    ),
                    "final_ack": json.loads(record["final_ack"]),
                }
            conn.execute(
                """
                INSERT INTO policy_applications(
                    apply_id, runtime_id, version, policy_hash, envelope_hash,
                    status, final_ack, created_at
                ) VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
                """,
                (
                    apply_id,
                    runtime_id,
                    version,
                    policy_hash,
                    payload_hash,
                    json.dumps(final_ack, separators=(",", ":"), sort_keys=True),
                    utc_now_iso(),
                ),
            )
        return {"state": "stored", "final_ack": final_ack}

    def apply_policy(
        self,
        apply_id: str,
        runtime_id: str,
        policy: Dict[str, Any],
        policy_hash: str,
        payload_hash: str,
        final_ack: Dict[str, Any],
    ) -> Dict[str, Any]:
        version = int(policy["version"])
        with self._write_transaction() as conn:
            existing = conn.execute(
                "SELECT * FROM policy_applications WHERE apply_id = ?",
                (apply_id,),
            ).fetchone()
            if existing:
                record = dict(existing)
                return {
                    "state": (
                        "duplicate"
                        if record["envelope_hash"] == payload_hash
                        else "conflict"
                    ),
                    "final_ack": json.loads(record["final_ack"]),
                }

            active = conn.execute(
                "SELECT * FROM active_policies WHERE runtime_id = ?",
                (runtime_id,),
            ).fetchone()
            if active and (
                version < int(active["version"])
                or (
                    version == int(active["version"])
                    and policy_hash != active["policy_hash"]
                )
            ):
                return {
                    "state": "stale",
                    "active_version": int(active["version"]),
                    "active_hash": active["policy_hash"],
                }

            now = utc_now_iso()
            policy_json = json.dumps(
                policy,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
            conn.execute(
                """
                INSERT INTO active_policies(
                    runtime_id, policy_id, version, policy_hash,
                    policy_json, applied_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(runtime_id) DO UPDATE SET
                    policy_id = excluded.policy_id,
                    version = excluded.version,
                    policy_hash = excluded.policy_hash,
                    policy_json = excluded.policy_json,
                    applied_at = excluded.applied_at
                """,
                (
                    runtime_id,
                    policy["policy_id"],
                    version,
                    policy_hash,
                    policy_json,
                    now,
                ),
            )
            conn.execute(
                """
                INSERT INTO policy_applications(
                    apply_id, runtime_id, version, policy_hash, envelope_hash,
                    status, final_ack, created_at
                ) VALUES (?, ?, ?, ?, ?, 'succeeded', ?, ?)
                """,
                (
                    apply_id,
                    runtime_id,
                    version,
                    policy_hash,
                    payload_hash,
                    json.dumps(final_ack, separators=(",", ":"), sort_keys=True),
                    now,
                ),
            )
        return {"state": "applied", "final_ack": final_ack}

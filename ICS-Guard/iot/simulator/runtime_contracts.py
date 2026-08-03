import datetime
import hashlib
import json
from typing import Any, Dict, Optional, Tuple


POLICY_FIELDS = (
    "policy_id",
    "version",
    "default_action",
    "asset_zone_map",
    "rules",
)

ATTACK_SCENARIOS = {
    "modbus-flood": ("modbus_flooding", {"controller"}),
    "modbus_flooding": ("modbus_flooding", {"controller"}),
    "logic-tampering": ("logic_tampering", {"controller"}),
    "logic_tampering": ("logic_tampering", {"controller"}),
    "sensor-spoofing": ("sensor_spoofing", {"sensor"}),
    "sensor_spoofing": ("sensor_spoofing", {"sensor"}),
}


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def parse_iso8601(value: Any) -> Optional[datetime.datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = normalized[:-1] + "+00:00"
    try:
        parsed = datetime.datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=datetime.timezone.utc)
    return parsed.astimezone(datetime.timezone.utc)


def canonical_json_bytes(value: Any) -> bytes:
    """Canonical JSON used by Python producers and contract tests."""
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def canonical_sha256(value: Any) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def envelope_hash(payload: Dict[str, Any]) -> str:
    return canonical_sha256(payload)


def normalize_attack_scenario(
    scenario_id: Any,
    node_type: Any,
) -> Tuple[Optional[str], Optional[str]]:
    if not isinstance(scenario_id, str):
        return None, "scenario_id is required"
    definition = ATTACK_SCENARIOS.get(scenario_id.strip().lower())
    if not definition:
        return None, f"unsupported scenario_id: {scenario_id}"
    state, compatible_types = definition
    normalized_type = str(node_type or "").strip().lower()
    if normalized_type not in compatible_types:
        return None, (
            f"scenario {scenario_id} requires node_type "
            f"{sorted(compatible_types)}, got {normalized_type or 'unknown'}"
        )
    return state, None


def extract_policy_document(payload: Dict[str, Any]) -> Dict[str, Any]:
    nested = payload.get("policy")
    source = nested if isinstance(nested, dict) else payload
    return {key: source.get(key) for key in POLICY_FIELDS if key in source}


def validate_policy_document(policy: Dict[str, Any]) -> Optional[str]:
    if not isinstance(policy, dict):
        return "policy must be an object"
    if not isinstance(policy.get("policy_id"), str) or not policy["policy_id"].strip():
        return "policy_id is required"
    version = policy.get("version")
    if not isinstance(version, int) or isinstance(version, bool) or version < 1:
        return "version must be a positive integer"
    if policy.get("default_action") not in {"allow", "deny"}:
        return "default_action must be allow or deny"
    if not isinstance(policy.get("asset_zone_map", {}), dict):
        return "asset_zone_map must be an object"
    rules = policy.get("rules")
    if not isinstance(rules, list):
        return "rules must be an array"
    for index, rule in enumerate(rules):
        if not isinstance(rule, dict):
            return f"rules[{index}] must be an object"
        if rule.get("action") not in {"allow", "deny"}:
            return f"rules[{index}].action must be allow or deny"
        priority = rule.get("priority", 0)
        if not isinstance(priority, int) or isinstance(priority, bool):
            return f"rules[{index}].priority must be an integer"
        port = rule.get("port")
        if port is not None and (
            not isinstance(port, int)
            or isinstance(port, bool)
            or port < 0
            or port > 65535
        ):
            return f"rules[{index}].port must be a valid integer port"
    return None


def calculate_policy_hash(policy: Dict[str, Any]) -> str:
    return canonical_sha256(policy)


def evaluate_policy(
    policy: Optional[Dict[str, Any]],
    flow: Dict[str, Any],
) -> Dict[str, str]:
    if not policy:
        return {"action": "allow", "reason": "no active policy"}

    destination_device_id = flow.get("destination_device_id")
    destination_zone = (
        policy.get("asset_zone_map", {}).get(destination_device_id)
        or flow.get("destination_zone")
    )
    if not destination_zone:
        return {"action": "deny", "reason": "unknown destination zone"}

    matched = []
    for rule in policy.get("rules", []):
        source_match = (
            rule.get("source_zone") in (None, "", flow.get("source_zone"))
        )
        destination_match = (
            rule.get("destination_zone") in (None, "", destination_zone)
        )
        protocol_match = rule.get("protocol") in (None, "", flow.get("protocol"))
        port_match = rule.get("port") in (None, flow.get("port"))
        if source_match and destination_match and protocol_match and port_match:
            matched.append(rule)

    if not matched:
        return {
            "action": policy.get("default_action", "deny"),
            "reason": "default policy action",
        }

    highest_priority = max(int(rule.get("priority", 0)) for rule in matched)
    top_rules = [
        rule
        for rule in matched
        if int(rule.get("priority", 0)) == highest_priority
    ]
    if any(rule.get("action") == "deny" for rule in top_rules):
        return {
            "action": "deny",
            "reason": f"deny-wins at priority {highest_priority}",
        }
    return {
        "action": "allow",
        "reason": f"allow at priority {highest_priority}",
    }

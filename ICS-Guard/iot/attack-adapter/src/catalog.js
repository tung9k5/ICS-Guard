export const SCENARIO_ALLOWLIST = Object.freeze([
  { id: 'wan_dos', name: 'WAN denial of service', max_duration_seconds: 30 },
  { id: 'route_poisoning', name: 'Route poisoning', max_duration_seconds: 30 },
  { id: 'logic_tampering', name: 'PLC logic tampering', max_duration_seconds: 30 },
  { id: 'modbus_flooding', name: 'Modbus traffic flooding', max_duration_seconds: 30 },
  { id: 'ota_tampering', name: 'OTA package tampering', max_duration_seconds: 30 },
  { id: 'watchdog_reset', name: 'Watchdog reset', max_duration_seconds: 30 },
  { id: 'sensor_spoofing', name: 'Sensor telemetry spoofing', max_duration_seconds: 30 },
  { id: 'signal_loss', name: 'Field signal loss', max_duration_seconds: 30 },
  { id: 'command_flooding', name: 'Control command flooding', max_duration_seconds: 30 },
  { id: 'unauthorized_actuation', name: 'Unauthorized actuation', max_duration_seconds: 30 },
]);

const scenarioIds = new Set(SCENARIO_ALLOWLIST.map((scenario) => scenario.id));

export function findScenario(id) {
  return scenarioIds.has(id) ? SCENARIO_ALLOWLIST.find((scenario) => scenario.id === id) : null;
}

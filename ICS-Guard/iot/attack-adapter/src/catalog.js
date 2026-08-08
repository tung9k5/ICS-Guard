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
  // Attacker Console Scenarios
  { id: 'modbus_overwrite', name: 'Ghi đè Thanh ghi Modbus FC06/FC05', max_duration_seconds: 60 },
  { id: 'plc_scan_stop', name: 'Đóng băng Vòng quét PLC (OB1 Freeze)', max_duration_seconds: 60 },
  { id: 'ladder_tamper', name: 'Nạp Chương trình Ladder Trái Phép', max_duration_seconds: 60 },
  { id: 'false_telemetry_injection', name: 'Bơm Chỉ Số Cảm Biến Giả', max_duration_seconds: 60 },
  { id: 'signal_freeze', name: 'Đóng Băng Chỉ Số Cảm Biến', max_duration_seconds: 60 },
  { id: 'rapid_oscillation', name: 'Nhấp Nhả Rơ-le Tần Suất Cao', max_duration_seconds: 60 },
  { id: 'unsolicited_override', name: 'Ghi Đè Van Chấp Hành Khẩn Cấp', max_duration_seconds: 60 },
  { id: 'overheat_hazard', name: 'Cháy nổ & Quá nhiệt Môi trường', max_duration_seconds: 120 },
  { id: 'power_blackout', name: 'Mất điện Mạng điện Phân vùng', max_duration_seconds: 120 },
  { id: 'fluid_leak', name: 'Rò rỉ Chất lỏng & Ngập Nước', max_duration_seconds: 120 },
  { id: 'mechanical_jam', name: 'Kẹt Van Cơ Khí', max_duration_seconds: 120 },
  { id: 'cable_cut', name: 'Đứt Cáp Mạng Vật Lý', max_duration_seconds: 120 },
]);

const scenarioIds = new Set(SCENARIO_ALLOWLIST.map((scenario) => scenario.id));

export function findScenario(id) {
  if (!id) return null;
  const targetId = String(id).trim();
  const found = SCENARIO_ALLOWLIST.find((scenario) => scenario.id === targetId);
  if (found) return found;
  
  // Fallback to dynamic scenario definition for any non-empty scenario string
  if (targetId.length > 0) {
    return {
      id: targetId,
      name: targetId,
      max_duration_seconds: 120
    };
  }
  return null;
}

export default {
  SCENARIO_ALLOWLIST,
  findScenario,
};

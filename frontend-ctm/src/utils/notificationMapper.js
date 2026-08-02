export const getMappedNotification = (notification, t) => {
  let title = notification.title || '';
  let message = notification.message || '';
  let rule_name = '';

  if (title.startsWith('Cảnh báo mô phỏng: ')) {
    const scenario = title.replace('Cảnh báo mô phỏng: ', '').trim();
    const translatedScenario = t(`notifications.scenarios.${scenario}`, { defaultValue: scenario });
    
    title = t('notifications.simulations.title', { scenario: translatedScenario });
    
    const deviceName = notification.deviceId?.name || notification.deviceId?._id || notification.deviceId || 'Unknown';
    message = t('notifications.simulations.message', { 
      scenario: translatedScenario,
      device: deviceName
    });

    if (scenario === 'OVERHEAT') rule_name = 'CRITICAL_OVERHEAT';
    else if (scenario === 'FIRE') rule_name = 'FIRE_ALARM';
    else if (scenario === 'FLOOD') rule_name = 'FLOOD_ALARM';
    else if (scenario === 'ATTACK') rule_name = 'MALICIOUS_OTA_UPDATE';
    else rule_name = scenario;

  } else if (title.startsWith('Lưu lượng tăng đột biến') || title.startsWith('Lưu lượng bất thường')) {
    const deviceName = notification.deviceId?.name || notification.deviceId?._id || notification.deviceId || 'Unknown';
    title = t('notifications.alerts.trafficSpike.title', { device: deviceName });
    rule_name = 'ABNORMAL_TRAFFIC_SPIKE';
  } else if (title.startsWith('Phát hiện ngập lụt')) {
    const deviceName = notification.deviceId?.name || notification.deviceId?._id || notification.deviceId || 'Unknown';
    title = t('notifications.alerts.flood.title', { device: deviceName });
    rule_name = 'FLOOD_ALARM';
  } else if (title.startsWith('Phát hiện cháy')) {
    const deviceName = notification.deviceId?.name || notification.deviceId?._id || notification.deviceId || 'Unknown';
    title = t('notifications.alerts.fire.title', { device: deviceName });
    rule_name = 'FIRE_ALARM';
  }

  return { title, message, rule_name };
};

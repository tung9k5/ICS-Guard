import { BaseDevice } from './BaseDevice.js';

export class HmiDevice extends BaseDevice {
  constructor(id, name, zone) {
    super(id, name, zone, 'HMI');
    this.activeScreens = 2;
    this.failedLogins = 0;
  }

  generateSpecificMetrics(metrics) {
    // Randomly change screens
    if (Math.random() > 0.9) {
      this.activeScreens = Math.floor(Math.random() * 5) + 1;
    }
    
    // Simulate failed logins
    if (Math.random() > 0.95) {
      this.failedLogins += 1;
    } else if (Math.random() > 0.8 && this.failedLogins > 0) {
      this.failedLogins = 0; // reset
    }

    metrics.active_screens = this.activeScreens;
    metrics.failed_logins = this.failedLogins;
    metrics.screen_brightness = 80 + Math.floor(Math.random() * 20); // 80-100%
    return metrics;
  }
}

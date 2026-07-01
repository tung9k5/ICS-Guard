// In-memory registry to track online admin users and manage the emergency alert queue
const activeAdminSessions = {}; // username -> timestamp
let emergencyQueue = [];

export const registerAdminHeartbeat = (username) => {
  activeAdminSessions[username] = Date.now();
};

export const getActiveAdminSessions = () => {
  const now = Date.now();
  const thresholdMs = 25000; // 25 seconds expiry window
  const activeAdmins = [];

  for (const [username, timestamp] of Object.entries(activeAdminSessions)) {
    if (now - timestamp < thresholdMs) {
      activeAdmins.push(username);
    } else {
      delete activeAdminSessions[username]; // Clean up expired session
    }
  }
  return activeAdmins;
};

export const addEmergencyAlert = (alertData) => {
  emergencyQueue.push({
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    ...alertData
  });
};

export const getEmergencyAlerts = () => {
  const now = Date.now();
  // Keep alerts in queue for 30 seconds to allow clients time to fetch
  emergencyQueue = emergencyQueue.filter(alert => now - alert.timestamp < 30000);
  return emergencyQueue;
};

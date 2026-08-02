db = db.getSiblingDB('ics_guard');

// Tạo các bảng dựa trên các model hiện có
const collections = [
  'settings',
  'alerts',
  'auditlogs',
  'blockedips',
  'devices',
  'devicesensors',
  'incidents',
  'incidenttimelines',
  'notifications',
  'refreshtokens',
  'rules',
  'users'
];

for (let i = 0; i < collections.length; i++) {
  if (!db.getCollectionNames().includes(collections[i])) {
    db.createCollection(collections[i]);
    print("Created collection: " + collections[i]);
  }
}

print("Initialization of ics_guard database completed successfully.");

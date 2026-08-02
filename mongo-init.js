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
  'users',
  'id_sequences'
];

for (let i = 0; i < collections.length; i++) {
  if (!db.getCollectionNames().includes(collections[i])) {
    db.createCollection(collections[i]);
    print("Created collection: " + collections[i]);
  }
}

// Khởi tạo dữ liệu cho bảng id_sequences dựa trên idGeneratorService.js của Backend
const initialSequences = [
  { prefix: 'U', current_number: 0, collection_name: 'users' },
  { prefix: 'D', current_number: 0, collection_name: 'devices' },
  { prefix: 'A', current_number: 0, collection_name: 'alerts' },
  { prefix: 'I', current_number: 0, collection_name: 'incidents' },
  { prefix: 'R', current_number: 0, collection_name: 'rules' },
  { prefix: 'L', current_number: 0, collection_name: 'auditlogs' },
  { prefix: 'B', current_number: 0, collection_name: 'blockedips' },
  { prefix: 'S', current_number: 0, collection_name: 'settings' },
  { prefix: 'T', current_number: 0, collection_name: 'refreshtokens' },
  { prefix: 'E', current_number: 0, collection_name: 'devicesensors' },
  { prefix: 'N', current_number: 0, collection_name: 'incidenttimelines' }
];

for (let j = 0; j < initialSequences.length; j++) {
  if (!db.id_sequences.findOne({ prefix: initialSequences[j].prefix })) {
    db.id_sequences.insertOne({
      prefix: initialSequences[j].prefix,
      current_number: initialSequences[j].current_number,
      collection_name: initialSequences[j].collection_name,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    print("Inserted initial sequence for: " + initialSequences[j].collection_name + " (Prefix: " + initialSequences[j].prefix + ")");
  }
}

// Chèn 1 dummy document để la bàn (Compass) không ẩn database trống
db.settings.insertOne({ _id: "init_dummy", note: "Bắt buộc có để Compass hiện DB" });

print("Initialization of ics_guard database completed successfully.");

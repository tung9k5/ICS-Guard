// Script to seed local MongoDB for ICS-Guard
// Located in backend/src/database/seed_local.js
const fs = require('fs');
const path = require('path');

// Target database
const dbName = 'ics_guard';
const conn = new Mongo();
const db = conn.getDB(dbName);

console.log(`Connecting to database: ${dbName}...`);

// Function to load and parse JSON using EJSON for MongoDB types
function loadSeedData(filename) {
    // Locate the seed files in the root scripts/seed folder
    const filePath = path.resolve(__dirname, '..', '..', '..', 'scripts', 'seed', filename);
    console.log(`Reading seed file from: ${filePath}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    return EJSON.parse(content);
}

try {
    // 1. Seed Users
    const users = loadSeedData('users.json');
    console.log('Dropping existing "users" collection...');
    db.users.drop();
    console.log(`Inserting ${users.length} users...`);
    db.users.insertMany(users);
    
    // Create Index for users
    db.users.createIndex({ username: 1 }, { unique: true });
    db.users.createIndex({ email: 1 }, { unique: true });
    console.log('Created indexes for "users" collection.');

    // 2. Seed Devices
    const devices = loadSeedData('devices.json');
    console.log('Dropping existing "devices" collection...');
    db.devices.drop();
    console.log(`Inserting ${devices.length} devices...`);
    db.devices.insertMany(devices);
    
    // Create Index for devices
    db.devices.createIndex({ status: 1 });
    db.devices.createIndex({ zone: 1 });
    db.devices.createIndex({ ip_address: 1 });
    console.log('Created indexes for "devices" collection.');

    // 3. Seed Rules
    const rules = loadSeedData('rules.json');
    console.log('Dropping existing "rules" collection...');
    db.rules.drop();
    console.log(`Inserting ${rules.length} rules...`);
    db.rules.insertMany(rules);
    
    // Create Index for rules
    db.rules.createIndex({ rule_name: 1 }, { unique: true });
    console.log('Created indexes for "rules" collection.');

    // 4. Create indexes for empty collections that will be populated during run-time
    console.log('Configuring schema indexes for alerts, incidents, and audit logs...');
    
    // Alerts Indexes
    db.alerts.createIndex({ detected_at: -1 });
    db.alerts.createIndex({ status: 1, severity: 1 });
    db.alerts.createIndex({ device_id: 1, detected_at: -1 });
    
    // Incidents Indexes
    db.incidents.createIndex({ status: 1 });
    db.incidents.createIndex({ created_at: -1 });
    
    // Timeline Indexes
    db.incident_timeline.createIndex({ incident_id: 1, event_time: 1 });
    
    // Audit Logs Indexes
    db.audit_logs.createIndex({ timestamp: -1 });
    db.audit_logs.createIndex({ user_id: 1 });
    
    print('✅ Database initialization and seeding completed successfully!');
} catch (error) {
    console.error('❌ Error during seeding database:', error);
    quit(1);
}

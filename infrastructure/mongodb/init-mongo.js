// Initialize ics_guard database
db = db.getSiblingDB('ics_guard');

if (db.users.countDocuments({}) === 0) {
    print("Database is empty. Inserting sample data...");

// 1. users
db.users.insertOne({
    username: "admin_test",
    password_hash: "123456",
    email: "admin@gmail.com",
    full_name: "System Admin",
    role: "ADMIN",
    is_active: true,
    login_failures_count: 0,
    last_failed_at: null,
    lockout_until: null,
    created_at: new Date(),
    updated_at: new Date()
});

let user = db.users.findOne({ username: "admin_test" });
let user_id = user._id;

// 2. devices
let device_id = "DEV-001";
db.devices.insertOne({
    _id: device_id,
    name: "PLC-Siemens-S7",
    type: "PLC",
    zone: "Factory Floor A",
    ip_address: "192.168.1.100",
    mac_address: "00:1A:2B:3C:4D:5E",
    status: "ONLINE",
    risk_score: 15.5,
    api_key: "api-key-xyz",
    firmware_version: "v2.1.4",
    hardware_model: "S7-1200",
    created_at: new Date(),
    updated_at: new Date()
});

// 3. device_cves
db.device_cves.insertOne({
    device_id: device_id,
    cve_id: "CVE-2021-3711",
    cvss_score: 8.1,
    description: "Buffer overflow vulnerability in OpenSSL",
    severity: "HIGH",
    status: "OPEN",
    detected_at: new Date(),
    patched_at: null
});

// 4. rules
db.rules.insertOne({
    rule_name: "Detect Multiple Login Failures",
    description: "Triggers when a user fails to login multiple times",
    is_active: true,
    severity: "MEDIUM",
    time_window_seconds: 300,
    trigger_count: 5,
    created_by: user_id,
    created_at: new Date(),
    updated_at: new Date()
});

// 5. incidents
db.incidents.insertOne({
    title: "Suspicious Login Activity",
    description: "Multiple failed login attempts detected",
    status: "OPEN",
    severity: "HIGH",
    assigned_to: user_id,
    created_at: new Date(),
    updated_at: new Date(),
    closed_at: null
});

let incident = db.incidents.findOne({ title: "Suspicious Login Activity" });
let incident_id = incident._id;

// 6. alerts
db.alerts.insertOne({
    rule_name: "Detect Multiple Login Failures",
    device_id: device_id,
    title: "Multiple Failed Logins",
    description: "5 failed logins within 5 minutes from 192.168.1.50",
    severity: "HIGH",
    status: "UNRESOLVED",
    source_ip: "192.168.1.50",
    destination_ip: "192.168.1.100",
    event_count: 5,
    detected_at: new Date(),
    resolved_at: null,
    resolved_by: null,
    incident_id: incident_id
});

// 7. incident_timeline
db.incident_timeline.insertOne({
    incident_id: incident_id,
    event_time: new Date(),
    actor: "System",
    action_type: "CREATED",
    description: "Incident automatically generated from alert."
});

// 8. playbooks
db.playbooks.insertOne({
    name: "Block IP Address",
    description: "Automatically blocks the offending IP address in the firewall",
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
});

let playbook = db.playbooks.findOne({ name: "Block IP Address" });
let playbook_id = playbook._id;

// 9. playbook_executions
db.playbook_executions.insertOne({
    playbook_id: playbook_id,
    incident_id: incident_id,
    status: "IN_PROGRESS",
    started_at: new Date(),
    completed_at: null
});

// 10. ai_analyses
db.ai_analyses.insertOne({
    incident_id: incident_id,
    log_summary: "User admin_test attempted 5 failed logins.",
    attack_reasoning: "Behavior matches brute force dictionary attack signatures.",
    model_used: "llama3.1:latest",
    generated_at: new Date()
});

// 11. audit_logs
db.audit_logs.insertOne({
    user_id: user_id,
    username: "admin_test",
    action: "USER_LOGIN_FAILED",
    target_resource: "Auth Service",
    ip_address: "192.168.1.50",
    user_agent: "Mozilla/5.0",
    status: "FAILURE",
    timestamp: new Date()
});

    print("All collections and sample data created successfully!");
} else {
    print("Database already initialized. Skipping sample data insertion.");
}

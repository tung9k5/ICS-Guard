# Cấu trúc thư mục

```text
iot-simulator/
├── src/
│   ├── config/
│   │   └── index.js            # Đọc toàn bộ config từ .env
│   ├── constants/
│   │   └── index.js            # DEVICE_STATUSES, SCENARIOS, SENSOR_TYPES, TRAFFIC
│   ├── devices/
│   │   ├── BaseDevice.js       # Class cơ sở — generatePayload(), setScenario()
│   │   ├── DeviceFactory.js    # Factory pattern — tạo device theo type
│   │   ├── SensorDevice.js     # Thiết bị cảm biến (Temperature, Humidity)
│   │   ├── PlcDevice.js        # Programmable Logic Controller
│   │   ├── HmiDevice.js        # Human Machine Interface
│   │   └── GatewayDevice.js    # Edge Gateway
│   ├── mqtt/
│   │   └── index.js            # connectMqtt(), publishTelemetry(), getClient()
│   ├── scheduler/
│   │   └── index.js            # SimulatorManager — init(), start(), stop()
│   ├── sensors/
│   │   └── Sensor.js           # Generic sensor — generate(scenario)
│   ├── utils/
│   │   ├── logger.js           # Winston logger (Console + File transport)
│   │   └── crypto.js           # AES-256-CBC encrypt/decrypt
│   └── index.js                # Entry point — bootstrap()
├── logs/
│   ├── simulator.log           # Combined log
│   └── error.log               # Error-only log
├── .env                        # Local environment config
├── .env.example                # Template
├── Dockerfile
└── package.json
```
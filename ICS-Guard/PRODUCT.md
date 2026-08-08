# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Security administrators, SOC analysts, and IT/OT system operators who monitor cybersecurity events across enterprise, IoT, and industrial control (ICS) environments. They operate in high-stakes environments needing fast scanning, high information density, clear severity hierarchy, and rapid incident decision-making without disrupting critical operational systems.

## Product Purpose
ICS-Guard provides real-time cybersecurity monitoring, device visibility, telemetry analysis, and incident-response workflows for industrial IoT and OT/ICS environments.

## Positioning
Combines security event monitoring, OT zone asset context, device visibility, alert analysis, and incident-response workflows in a unified SOC interface tailored to industrial constraints—emphasizing asset context, attack severity, affected devices, and incident relationships without encouraging disruptive actions against critical OT systems.

## Operating Context
SOC control rooms and industrial monitoring centers where operators need to quickly identify abnormal behavior, prioritize alerts, investigate incidents, understand affected assets, and dispatch response actions (e.g. Telegram alerts, OT zone isolation).

## Capabilities and Constraints
- **Confirmed Capabilities:** Real-time SOC dashboard, device management, OT Zone matrix visualization, telemetry analytics (InfluxDB time-series), rule-based alert engine, Telegram notification dispatch, AI log assistant (FastAPI/Llama), Docker Compose multi-container deployment.
- **System Constraints:** Preserve existing application functionality, API contracts, routes, authentication flows, real-time Socket.IO/MQTT data streams, and backend behavior.
- **Design & Layout Constraints:**
  - High readability and clear visual hierarchy supporting fast scanning.
  - High information density without visual clutter.
  - Strong color contrast and accessible text; never rely on color alone to communicate severity.
  - Full responsiveness across desktop, laptop, tablet, and smaller screens.
  - Tables and security data views must handle long IP addresses, hostnames, device IDs, and incident descriptions cleanly.
  - Restrained, functional, operational visual design—avoid generic AI-generated dashboard styling, bloated cards, excessive rounded corners, glassmorphism, or unnecessary decorative gradients.

## Brand Commitments
Professional enterprise and SOC-style visual identity. Operational clarity, rapid incident decision-making, strict severity hierarchy (Critical, High, Medium, Low, Normal).

## Evidence on Hand
- **Frontend Codebase:** React 18 + Vite (`frontend/` with ReactFlow, Recharts, Lucide React, Tailwind CSS, Sass).
- **Backend Services:** Node.js Express API (`backend/`).
- **Telemetry & Storage:** MongoDB (Events/Devices), InfluxDB (Time-series metrics), RabbitMQ, Mosquitto MQTT Broker (TLS 1.3).
- **AI & Automation:** FastAPI AI Engine (`ai-engine/`), Python Device Simulator (`iot/simulator/`).
- **Documentation:** `README.md`, architecture diagrams, assignment guides, work plans (`docs/`).

## Product Principles
1. **Operational Clarity & Rapid Scanning:** Prioritize information density and logical hierarchy to grant operators immediate situational awareness.
2. **Safe & Contextual OT Incident Response:** Frame security threats with asset and zone context, preventing accidental operational disruption to critical industrial systems.
3. **Multimodal Severity Hierarchy:** Clearly differentiate Critical, High, Medium, Low, and Normal states using contrast, iconography, text labels, and badges—never color alone.
4. **Restrained Operational Visual Craft:** Focus on dark SOC enterprise functionality; reject bloated card layouts, aggressive glassmorphism, or gratuitous visual gimmicks.
5. **Contract & Flow Integrity:** Maintain all existing UI routes, API endpoints, WebSocket feeds, and authentication mechanisms without regression.

## Accessibility & Inclusion
Strict adherence to contrast ratios, full keyboard accessibility, explicit text/icon state badges for color-blind accessibility, and clean text wrapping/overflow protection for technical data formats (IPs, MAC addresses, hostnames, logs).

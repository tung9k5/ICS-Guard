# ====================================================================
# AUTOMATED STARTUP SCRIPT FOR ICS-GUARD LOCAL SERVICES (LOCAL RUN)
# ====================================================================

# Set location to the workspace root directory
$PSScriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location -Path $PSScriptRoot
Set-Location -Path ".."

Write-Host "[INFO] Starting ICS-Guard local services..." -ForegroundColor Green
Write-Host "[INFO] Workspace Root: $PWD" -ForegroundColor Gray

# 1. Start RabbitMQ Windows Service
Write-Host "`n--- STARTING DATABASES AND BROKERS ---" -ForegroundColor DarkCyan

$rabbitmq = Get-Service -Name "RabbitMQ" -ErrorAction SilentlyContinue
if ($rabbitmq) {
    if ($rabbitmq.Status -ne "Running") {
        Write-Host "[SERVICE] Starting RabbitMQ Service..." -ForegroundColor Yellow
        Start-Service -Name "RabbitMQ" -ErrorAction SilentlyContinue
        # Check again
        $check = Get-Service -Name "RabbitMQ" -ErrorAction SilentlyContinue
        if ($check.Status -eq "Running") {
            Write-Host "[SUCCESS] RabbitMQ Service started successfully." -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Failed to start RabbitMQ. Please run PowerShell as Administrator." -ForegroundColor Red
        }
    } else {
        Write-Host "[SUCCESS] RabbitMQ Service is already running." -ForegroundColor Gray
    }
} else {
    Write-Host "[WARN] RabbitMQ Service not found." -ForegroundColor DarkYellow
}

# 2. Stop Default Mosquitto Service & Start with Project's TLS Config
$mosquittoService = Get-Service -Name "Mosquitto" -ErrorAction SilentlyContinue
if ($mosquittoService) {
    if ($mosquittoService.Status -eq "Running") {
        Write-Host "[SERVICE] Stopping default Mosquitto service to free port 1883/8883..." -ForegroundColor Yellow
        Stop-Service -Name "Mosquitto" -ErrorAction SilentlyContinue
    }
}

# Generate local mosquitto config with Windows absolute paths
Write-Host "[SERVICE] Generating local Mosquitto config with Windows paths..." -ForegroundColor Yellow
$localConfPath = "$PWD\infrastructure\mosquitto\config\mosquitto_local.conf"
$confContent = @"
listener 1883 0.0.0.0
allow_anonymous true

listener 8883 0.0.0.0
cafile $PWD\infrastructure\mosquitto\config\certs\ca.crt
certfile $PWD\infrastructure\mosquitto\config\certs\server.crt
keyfile $PWD\infrastructure\mosquitto\config\certs\server.key
tls_version tlsv1.3
"@
$confContent | Out-File -FilePath $localConfPath -Encoding ascii

# Start Mosquitto manually with our local TLS config
Write-Host "[SERVICE] Launching Mosquitto with local config..." -ForegroundColor Yellow
$mosquittoPath = "C:\Program Files\mosquitto\mosquitto.exe"
if (Test-Path $mosquittoPath) {
    Start-Process $mosquittoPath -ArgumentList "-c `"$PWD\infrastructure\mosquitto\config\mosquitto_local.conf`"" -WindowStyle Hidden -ErrorAction SilentlyContinue
    Write-Host "[SUCCESS] Mosquitto launched with TLS config." -ForegroundColor Green
} else {
    Write-Host "[WARN] Mosquitto executable not found at C:\Program Files\mosquitto\mosquitto.exe." -ForegroundColor DarkYellow
}

# 3. Start Portable InfluxDB (since it's not a service)
Write-Host "[SERVICE] Launching InfluxDB (Portable)..." -ForegroundColor Yellow
$influxPath = "C:\influxdb-1.8.10-1\influxd.exe"
if (Test-Path $influxPath) {
    Start-Process $influxPath -WindowStyle Hidden -ErrorAction SilentlyContinue
    Write-Host "[SUCCESS] InfluxDB launched successfully." -ForegroundColor Green
} else {
    Write-Host "[WARN] InfluxDB executable not found at C:\influxdb-1.8.10-1\influxd.exe." -ForegroundColor DarkYellow
}

# 4. Wait for databases and brokers to fully initialize
Write-Host ""
Write-Host "[INFO] Waiting 12 seconds for RabbitMQ and Mosquitto to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

# 5. Start Backend Node.js API
Write-Host ""
Write-Host "[BACKEND] Starting Backend Node.js API..." -ForegroundColor Cyan
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location -Path '$PWD\backend'; npm run dev"

# 6. Start Frontend React (Vite)
Write-Host "[FRONTEND] Starting Frontend SOC Dashboard..." -ForegroundColor Cyan
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location -Path '$PWD\frontend'; npm run dev"

# 7. Start IoT Device Simulator (Python)
Write-Host "[SIMULATOR] Starting IoT Simulator..." -ForegroundColor Cyan
Start-Process "powershell" -ArgumentList "-NoExit", "-Command", "Set-Location -Path '$PWD\iot\simulator'; python simulator.py"

Write-Host ""
Write-Host "[SUCCESS] Startup complete! Check the newly opened terminal windows." -ForegroundColor Green

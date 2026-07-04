# =====================================================================
# ICS-Guard: Quick Launch and Testing Script (Non-Docker Windows)
# =====================================================================
# Huong dan: Mo PowerShell tai thu muc goc cua du an va chay:
# .\scripts\Activate.ps1
# =====================================================================

$ErrorActionPreference = "Stop"
Clear-Host

Write-Host "=========================================================" -ForegroundColor Cyan
Write-Host "         ICS-GUARD: KHOI CHAY HE THONG TREN WINDOWS      " -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Cyan

# 1. Kiem tra cac phan mem nen tang
Write-Host "[1/4] Kiem tra cac cong cu he thong..." -ForegroundColor Yellow

# Kiem tra Node.js
try {
    $nodeVer = node -v
    Write-Host "  - Node.js: OK ($nodeVer)" -ForegroundColor Green
} catch {
    Write-Host "  - Node.js: CHUA CAI DAT! Vui long cai dat Node.js tu nodejs.org" -ForegroundColor Red
    Exit
}

# Kiem tra Python
try {
    $pyVer = python --version
    Write-Host "  - Python: OK ($pyVer)" -ForegroundColor Green
} catch {
    Write-Host "  - Python: CHUA CAI DAT! Vui long cai dat Python tu python.org" -ForegroundColor Red
    Exit
}

# 2. Kiem tra cac dich vu co so du lieu va Broker
Write-Host "`n[2/4] Kiem tra trang thai cac cong dich vu..." -ForegroundColor Yellow

# Kiem tra MongoDB (27017)
$mongoConn = Test-NetConnection -ComputerName localhost -Port 27017 -WarningAction SilentlyContinue
if ($mongoConn.TcpTestSucceeded) {
    Write-Host "  - MongoDB (Cong 27017): DANG CHAY" -ForegroundColor Green
} else {
    Write-Host "  - MongoDB (Cong 27017): KHONG PHAN HOI!" -ForegroundColor Red
    Write-Host "    -> Vui long khoi dong dich vu MongoDB (hoac cau hinh MongoDB Atlas)." -ForegroundColor Yellow
}

# Kiem tra Mosquitto MQTT (1883)
$mqttConn = Test-NetConnection -ComputerName localhost -Port 1883 -WarningAction SilentlyContinue
if ($mqttConn.TcpTestSucceeded) {
    Write-Host "  - MQTT Broker (Cong 1883): DANG CHAY" -ForegroundColor Green
} else {
    Write-Host "  - MQTT Broker (Cong 1883): KHONG PHAN HOI!" -ForegroundColor Red
    Write-Host "    -> Vui long khoi dong Mosquitto MQTT Service." -ForegroundColor Yellow
}

# Kiem tra InfluxDB (8086)
$influxConn = Test-NetConnection -ComputerName localhost -Port 8086 -WarningAction SilentlyContinue
if ($influxConn.TcpTestSucceeded) {
    Write-Host "  - InfluxDB (Cong 8086): DANG CHAY" -ForegroundColor Green
} else {
    Write-Host "  - InfluxDB (Cong 8086): CHUA BAT! (Khong ve duoc bieu do lich su, Backend van chay)" -ForegroundColor DarkYellow
}

# 3. Cai dat cac thu vien Node.js neu thieu
Write-Host "`n[3/4] Dong bo cac thu vien phu thuoc..." -ForegroundColor Yellow

if (-not (Test-Path "backend\node_modules")) {
    Write-Host "  - Dang cai dat node_modules cho Backend..." -ForegroundColor Gray
    Start-Process cmd -ArgumentList "/c npm install" -WorkingDirectory "backend" -NoNewWindow -Wait
} else {
    Write-Host "  - Backend dependencies: Day du" -ForegroundColor Green
}

if (-not (Test-Path "frontend\node_modules")) {
    Write-Host "  - Dang cai dat node_modules cho Frontend..." -ForegroundColor Gray
    Start-Process cmd -ArgumentList "/c pnpm install || npm install" -WorkingDirectory "frontend" -NoNewWindow -Wait
} else {
    Write-Host "  - Frontend dependencies: Day du" -ForegroundColor Green
}

# 4. Lua chon khoi chay AI Assistant
Write-Host "`n[4/4] Tuy chon cau hinh chay kiem thu..." -ForegroundColor Yellow
$runAI = Read-Host "Ban co muon khoi chay mo-dun Tro ly AI & FastAPI khong? (Y/N) [Mac dinh: N]"
if ($runAI -eq "") { $runAI = "N" }

# Khoi tao du lieu mau
$seedDB = Read-Host "Ban co muon nap lai du lieu mau (Database Seeding) khong? (Y/N) [Mac dinh: N]"
if ($seedDB -eq "") { $seedDB = "N" }

if ($seedDB.ToUpper() -eq "Y") {
    Write-Host "  - Dang nap du lieu mau MongoDB..." -ForegroundColor Gray
    Start-Process node -ArgumentList "src/database/seed_local.js" -WorkingDirectory "backend" -NoNewWindow -Wait
    
    if ($influxConn.TcpTestSucceeded) {
        Write-Host "  - Dang cau hinh Retention Policy InfluxDB..." -ForegroundColor Gray
        Start-Process node -ArgumentList "src/database/seed_influx.js" -WorkingDirectory "backend" -NoNewWindow -Wait
    }
}

# 5. Tien hanh mo cac cua so CMD de chay song song cac dich vu
Write-Host "`n Kich hoat cac cua so chay tung thanh phan..." -ForegroundColor Cyan

# A. Khoi chay Backend Node.js
Write-Host "  -> Dang khoi chay Backend API (Cong 8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location backend; Write-Host '--- Logs cua Backend ---' -ForegroundColor Green; npm run dev"

# B. Khoi chay Frontend React
Write-Host "  -> Dang khoi chay Frontend SOC Dashboard (Cong 3000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; Write-Host '--- Logs cua Frontend SOC Dashboard ---' -ForegroundColor Cyan; npm run dev"

# C. Khoi chay Device Simulator
Write-Host "  -> Dang khoi chay Python Device Simulator..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location iot/simulator; Write-Host '--- Logs cua Simulator ---' -ForegroundColor Yellow; python simulator.py"

# D. Khoi chay AI Engine
if ($runAI.ToUpper() -eq "Y") {
    Write-Host "  -> Dang khoi chay AI Engine FastAPI (Cong 5000)..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location ai-engine; Write-Host '--- Logs cua AI Engine (FastAPI) ---' -ForegroundColor Magenta; python -m uvicorn main:app --host 0.0.0.0 --port 5000 --reload"
}

Write-Host "`n=========================================================" -ForegroundColor Green
Write-Host " Kich hoat thanh cong. Hay kiem tra cac cua so logs moi mo." -ForegroundColor Green
Write-Host " Truy cap SOC Dashboard: http://localhost:3000" -ForegroundColor Cyan
Write-Host "=========================================================" -ForegroundColor Green

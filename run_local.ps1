param(
    [switch]$UpdateDependencies
)

$ErrorActionPreference = 'Stop'
$ProjectRoot = $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

# 1. Cap nhat thu vien neu co tham so -UpdateDependencies
if ($UpdateDependencies) {
    Write-Step "Dang cai dat thu vien cho Backend API..."
    Set-Location -LiteralPath "$ProjectRoot\backend"
    npm install

    Write-Step "Dang cai dat thu vien cho AI Services..."
    Set-Location -LiteralPath "$ProjectRoot\ai-services"
    npm install
    
    Write-Step "Dang cai dat thu vien cho Admin Dashboard..."
    Set-Location -LiteralPath "$ProjectRoot\frontend-adm"
    npm install
    
    Write-Step "Dang cai dat thu vien cho Customer App..."
    Set-Location -LiteralPath "$ProjectRoot\frontend-ctm"
    npm install
    
    Write-Step "Dang cai dat thu vien cho IoT Simulator..."
    Set-Location -LiteralPath "$ProjectRoot\iot-simulator"
    npm install
    
    Set-Location -LiteralPath $ProjectRoot
    Write-Ok "Da cai dat toan bo thu vien thanh cong!"
}

# 2. Tu dong kiem tra va tat cac tien trinh cu dang chiem dung cong (3000, 5173, 8000, 5001)
Write-Step "Dang kiem tra va giai phong cac cong mang dang ban (3000, 5173, 8000, 5001)..."
$targetPorts = @(3000, 5173, 8000, 5001)
foreach ($port in $targetPorts) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Host "-> Phat hien cong $port dang ban. Dang dung tien trinh cu de giai phong cong..." -ForegroundColor Yellow
        foreach ($c in $conn) {
            if ($c.OwningProcess) {
                Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Write-Ok "Da giai phong toan bo cac cong! San sang khoi chay."

# 3. Kiem tra cac dich vu co so ha tram chu chot
Write-Step "Dang kiem tra ket noi toi cac Database va Broker..."
$portsToCheck = @{
    "27017" = "MongoDB"
    "8086"  = "InfluxDB"
    "1883"  = "Mosquitto MQTT"
    "5672"  = "RabbitMQ"
}

$missingServices = $false
$keys = $portsToCheck.Keys
foreach ($port in $keys) {
    $serviceName = $portsToCheck[$port]
    $socket = New-Object System.Net.Sockets.TcpClient
    $connected = $false
    try {
        $connectTask = $socket.BeginConnect("127.0.0.1", [int]$port, $null, $null)
        $success = $connectTask.AsyncWaitHandle.WaitOne(1000, $false)
        if ($success) {
            $socket.EndConnect($connectTask)
            $connected = $true
        }
    } catch {
        # connection failed
    }

    if ($connected) {
        Write-Ok "Cong $port ($serviceName) dang hoat dong."
        $socket.Close()
    } else {
        Write-Host "[WARN] Cong $port ($serviceName) khong phan hoi. Hay dam bao ban da bat dich vu nay." -ForegroundColor Yellow
        $missingServices = $true
    }
}

if ($missingServices) {
    Write-Host "`n[!] Chu y: Mot so dich vu nen chua bat. Du an co the chay loi neu thieu co so du lieu." -ForegroundColor Yellow
}

# 4. Khoi dong cac dich vu trong cua so PowerShell rieng biet
Write-Step "Dang khoi chay cac dich vu trong cua so rieng..."

# Khoi dong Backend API
Write-Host "-> Dang khoi dong Backend API..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; npm run dev" -WindowStyle Normal

# Khoi dong Frontend Admin
Write-Host "-> Dang khoi dong Admin Dashboard..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend-adm'; npm run dev" -WindowStyle Normal

# Khoi dong Frontend Customer
Write-Host "-> Dang khoi dong Customer App..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend-ctm'; npm run dev" -WindowStyle Normal

# Khoi dong IoT Simulator
Write-Host "-> Dang khoi dong IoT Web Simulator..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\iot-simulator'; npm run dev" -WindowStyle Normal

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "   HE THONG ICS-GUARD DANG DUOC KHOI CHAY CUC BO!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Frontend Admin:    http://localhost:3000" -ForegroundColor White
Write-Host "Frontend Customer: http://localhost:5173" -ForegroundColor White
Write-Host "Backend API:       http://localhost:8000" -ForegroundColor White
Write-Host "Web Simulator:     http://localhost:5001" -ForegroundColor White
Write-Host "Attack Dashboard:  http://localhost:5001/attacks" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Meo: De dung hoac khoi dong lai, ban chi can chay lai run_local.ps1 hoac an F5 tren trinh duyet!" -ForegroundColor Yellow

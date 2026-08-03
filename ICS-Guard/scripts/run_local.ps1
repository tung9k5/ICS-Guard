param(
    [switch]$UpdateDependencies,
    [switch]$InstallDependencies,
    [switch]$ResetDemoData,
    [switch]$RunTests,
    [switch]$SkipInfrastructure,
    [switch]$SkipAiEngine,
    [switch]$SkipIoTSimulator,
    [switch]$SkipSimulator,
    [switch]$SkipWebSimulator,
    [switch]$SkipHardwareBff,
    [switch]$SkipAttackAdapter
)

# Compatibility adjustments
if ($InstallDependencies) { $UpdateDependencies = $true }
if ($SkipSimulator) { $SkipIoTSimulator = $true }

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $ProjectRoot

function Write-Step([string]$Message) {
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Require-Command([string]$Name, [string]$InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Khong tim thay '$Name'. $InstallHint"
    }
}

function Invoke-Checked([string]$WorkingDirectory, [string]$Executable, [string[]]$Arguments) {
    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $Executable @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Lenh that bai: $Executable $($Arguments -join ' ') (exit code $LASTEXITCODE)"
        }
    } finally {
        Pop-Location
    }
}

function Test-Port([int]$Port, [int]$TimeoutMilliseconds = 500) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $attempt = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $attempt.AsyncWaitHandle.WaitOne($TimeoutMilliseconds, $false)) { return $false }
        $client.EndConnect($attempt)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Wait-Port([string]$Name, [int]$Port, [int]$TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Port $Port) {
            Write-Ok "$Name dang nghe tai cong $Port."
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    Write-Warn "$Name chua san sang tai cong $Port sau $TimeoutSeconds giay. Xem log trong cua so dich vu."
    return $false
}

function Start-ServiceIfPresent([string]$ServiceName, [int]$Port, [bool]$Required = $false) {
    if (Test-Port $Port) {
        Write-Ok "$ServiceName da san sang tai cong $Port."
        return $true
    }

    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($service) {
        try {
            if ($service.Status -ne 'Running') { Start-Service -Name $ServiceName }
            if (Wait-Port $ServiceName $Port 8) { return $true }
        } catch {
            Write-Warn "Khong the khoi dong service $ServiceName. Thu chay PowerShell bang Administrator."
        }
    } else {
        Write-Warn "Khong tim thay Windows service $ServiceName."
    }

    if ($Required) { throw "$ServiceName la dich vu bat buoc cho demo nhung cong $Port chua san sang." }
    return $false
}

function Start-AppWindow([string]$Name, [string]$WorkingDirectory, [string]$Command, [int]$Port = 0) {
    if ($Port -gt 0 -and (Test-Port $Port)) {
        Write-Warn "$Name da co tien trinh tai cong $Port; bo qua khoi dong de tranh trung cong."
        return
    }

    $windowCommand = "Set-Location -LiteralPath '$WorkingDirectory'; `$Host.UI.RawUI.WindowTitle = '$Name'; $Command"
    Start-Process powershell `
        -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', $windowCommand `
        -WorkingDirectory $WorkingDirectory
    Write-Host "[START] $Name" -ForegroundColor Gray
}

function Read-DotEnv([string]$Path) {
    $values = @{}
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $parts = $line.Split('=', 2)
            $values[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
    return $values
}

Write-Host '============================================================' -ForegroundColor Green
Write-Host '             ICS-GUARD LOCAL DEMO LAUNCHER' -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host "Project: $ProjectRoot" -ForegroundColor Gray

Write-Step 'Kiem tra cong cu va cau hinh'
Require-Command 'node' 'Hay cai Node.js LTS va mo lai PowerShell.'
Require-Command 'npm' 'Hay cai Node.js LTS va mo lai PowerShell.'
Require-Command 'python' 'Hay cai Python 3 va chon Add Python to PATH.'

$envPath = Join-Path $ProjectRoot '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath (Join-Path $ProjectRoot '.env.example') -Destination $envPath
    throw "Da tao .env tu .env.example. Hay dien MONGO_URI va cac secret local, sau do chay lai script."
}

$localEnv = Read-DotEnv $envPath
$backendPort = if ($localEnv.PORT) { [int]$localEnv.PORT } else { 8000 }
$frontendPort = if ($localEnv.FRONTEND_PORT) { [int]$localEnv.FRONTEND_PORT } else { 3000 }
$webSimulatorPort = if ($localEnv.WEB_SIMULATOR_PORT) { [int]$localEnv.WEB_SIMULATOR_PORT } else { 5174 }
$hardwareBffPort = if ($localEnv.HARDWARE_BFF_PORT) { [int]$localEnv.HARDWARE_BFF_PORT } else { 5001 }
$attackAdapterPort = if ($localEnv.ATTACK_ADAPTER_PORT) { [int]$localEnv.ATTACK_ADAPTER_PORT } else { 5003 }
Write-Ok 'Node.js, npm, Python va .env da san sang.'

Write-Step 'Dong bo dependency khi can'
$nodeProjects = @(
    (Join-Path $ProjectRoot 'backend'),
    (Join-Path $ProjectRoot 'frontend'),
    (Join-Path $ProjectRoot 'iot\web-simulator'),
    (Join-Path $ProjectRoot 'iot\hardware-bff'),
    (Join-Path $ProjectRoot 'iot\attack-adapter')
)

foreach ($nodeProject in $nodeProjects) {
    if ($UpdateDependencies -or -not (Test-Path -LiteralPath (Join-Path $nodeProject 'node_modules'))) {
        Write-Host "npm install: $nodeProject" -ForegroundColor Gray
        Invoke-Checked $nodeProject 'npm' @('install')
    }
}

$pythonChecks = @(
    @{ Directory = (Join-Path $ProjectRoot 'ai-engine'); Import = 'fastapi,uvicorn,sklearn,numpy'; Requirements = 'requirements.txt' },
    @{ Directory = (Join-Path $ProjectRoot 'iot\simulator'); Import = 'paho.mqtt,cryptography,dotenv'; Requirements = 'requirements.txt' }
)
foreach ($pythonProject in $pythonChecks) {
    & python -c "import $($pythonProject.Import)" 2>$null
    if ($UpdateDependencies -or $LASTEXITCODE -ne 0) {
        Write-Host "pip install: $($pythonProject.Directory)" -ForegroundColor Gray
        Invoke-Checked $pythonProject.Directory 'python' @('-m', 'pip', 'install', '-r', $pythonProject.Requirements)
    }
}
Write-Ok 'Dependency da san sang.'

if (-not $SkipInfrastructure) {
    Write-Step 'Khoi dong ha tang local'
    $null = Start-ServiceIfPresent 'MongoDB' 27017 $true

    if (-not (Start-ServiceIfPresent 'Mosquitto' 1883 $false)) {
        $mosquittoExe = 'C:\Program Files\mosquitto\mosquitto.exe'
        if (Test-Path -LiteralPath $mosquittoExe) {
            $localConf = Join-Path $ProjectRoot "infrastructure\mosquitto\config\mosquitto_local.conf"
            if (Test-Path -LiteralPath $localConf) {
                Start-Process -FilePath $mosquittoExe -ArgumentList '-c', "`"$localConf`"" -WindowStyle Hidden
                Write-Host "Mosquitto started with project local config." -ForegroundColor Gray
            } else {
                $runtimeConfig = Join-Path $env:TEMP 'ics-guard-mosquitto-demo.conf'
                @('listener 1883 127.0.0.1', 'allow_anonymous true') | Set-Content -LiteralPath $runtimeConfig -Encoding Ascii
                Start-Process -FilePath $mosquittoExe -ArgumentList '-c', $runtimeConfig -WindowStyle Hidden
                Write-Host "Mosquitto started with temp local config." -ForegroundColor Gray
            }
            $null = Wait-Port 'Mosquitto' 1883 8
        }
    }

    $null = Start-ServiceIfPresent 'RabbitMQ' 5672 $false

    if (-not (Test-Port 8086)) {
        $influxExe = 'C:\influxdb-1.8.10-1\influxd.exe'
        if (Test-Path -LiteralPath $influxExe) {
            Start-Process -FilePath $influxExe -WindowStyle Hidden
            $null = Wait-Port 'InfluxDB' 8086 8
        } else {
            Write-Warn 'Khong tim thay InfluxDB portable; telemetry time-series co the dung fallback.'
        }
    } else { Write-Ok 'InfluxDB da san sang tai cong 8086.' }

    if (Test-Port 6379) { Write-Ok 'Redis da san sang tai cong 6379.' }
    else { Write-Warn 'Redis chua san sang; backend se dung fallback cho demo.' }

    if (-not (Test-Port 11434)) {
        $ollama = Get-Command ollama -ErrorAction SilentlyContinue
        if ($ollama) {
            Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden
            $null = Wait-Port 'Ollama' 11434 8
        } else { Write-Warn 'Ollama khong co trong PATH; AI sinh noi dung se dung fallback.' }
    } else { Write-Ok 'Ollama da san sang tai cong 11434.' }
}

if ($ResetDemoData) {
    Write-Step 'Reset va tao lai du lieu demo'
    Invoke-Checked (Join-Path $ProjectRoot 'backend') 'npm' @('run', 'seed:demo:reset')
    Write-Ok 'Du lieu demo da duoc tao lai.'
}

if ($RunTests) {
    Write-Step 'Chay regression test truoc khi khoi dong'
    Invoke-Checked (Join-Path $ProjectRoot 'backend') 'npm' @('test')
    Invoke-Checked (Join-Path $ProjectRoot 'frontend') 'npm' @('test', '--', '--run')
    Invoke-Checked (Join-Path $ProjectRoot 'iot\web-simulator') 'npm' @('test', '--', '--run')
    if (-not $SkipHardwareBff) {
        Invoke-Checked (Join-Path $ProjectRoot 'iot\hardware-bff') 'npm' @('test')
    }
    if (-not $SkipAttackAdapter) {
        Invoke-Checked (Join-Path $ProjectRoot 'iot\attack-adapter') 'npm' @('test')
    }
    Invoke-Checked (Join-Path $ProjectRoot 'ai-engine') 'python' @('-m', 'unittest', 'discover', '-s', 'tests', '-v')
    Write-Ok 'Toan bo regression test da pass.'
}

Write-Step 'Khoi dong cac thanh phan ung dung'
Start-AppWindow 'ICS-Guard Backend' (Join-Path $ProjectRoot 'backend') 'npm run dev' $backendPort
Start-AppWindow 'ICS-Guard Frontend' (Join-Path $ProjectRoot 'frontend') "npm run dev -- --host 0.0.0.0 --port $frontendPort" $frontendPort

if (-not $SkipAiEngine) {
    Start-AppWindow 'ICS-Guard AI Engine' (Join-Path $ProjectRoot 'ai-engine') 'python main.py' 5000
}
if (-not $SkipWebSimulator) {
    Start-AppWindow 'ICS-Guard Web Simulator' (Join-Path $ProjectRoot 'iot\web-simulator') "npm run dev -- --host 0.0.0.0 --port $webSimulatorPort" $webSimulatorPort
}
if (-not $SkipIoTSimulator) {
    Start-AppWindow 'ICS-Guard IoT Simulator' (Join-Path $ProjectRoot 'iot\simulator') 'python simulator.py'
}
if (-not $SkipHardwareBff) {
    Start-AppWindow 'ICS-Guard Hardware BFF' (Join-Path $ProjectRoot 'iot\hardware-bff') 'npm start' $hardwareBffPort
}
if (-not $SkipAttackAdapter) {
    Start-AppWindow 'ICS-Guard Attack Adapter' (Join-Path $ProjectRoot 'iot\attack-adapter') 'npm start' $attackAdapterPort
}

Write-Step 'Cho cac dich vu san sang'
$backendReady = Wait-Port 'Backend' $backendPort 35
$frontendReady = Wait-Port 'Frontend' $frontendPort 35
$aiReady = if ($SkipAiEngine) { $true } else { Wait-Port 'AI Engine' 5000 25 }
$webReady = if ($SkipWebSimulator) { $true } else { Wait-Port 'Web Simulator' $webSimulatorPort 35 }
$hardwareReady = if ($SkipHardwareBff) { $true } else { Wait-Port 'Hardware BFF' $hardwareBffPort 25 }
$attackReady = if ($SkipAttackAdapter) { $true } else { Wait-Port 'Attack Adapter' $attackAdapterPort 25 }

Write-Host "`n============================================================" -ForegroundColor Green
if ($backendReady -and $frontendReady -and $aiReady -and $webReady -and $hardwareReady -and $attackReady) {
    Write-Host 'ICS-GUARD DEMO DA SAN SANG' -ForegroundColor Green
} else {
    Write-Host 'MOT SO DICH VU CHUA SAN SANG - KIEM TRA CUA SO LOG' -ForegroundColor Yellow
}
Write-Host '============================================================' -ForegroundColor Green
Write-Host "Frontend:      http://localhost:$frontendPort" -ForegroundColor White
Write-Host "Backend API:   http://localhost:$backendPort" -ForegroundColor White
Write-Host "Swagger:       http://localhost:$backendPort/docs" -ForegroundColor White
if (-not $SkipAiEngine) { Write-Host 'AI Engine:     http://localhost:5000/docs' -ForegroundColor White }
if (-not $SkipWebSimulator) {
    Write-Host "Web Simulator: http://localhost:$webSimulatorPort" -ForegroundColor White
    Write-Host "Web Attacker:  http://localhost:$webSimulatorPort/attacker/login" -ForegroundColor White
}
if (-not $SkipHardwareBff) {
    Write-Host "Hardware BFF:  http://localhost:$hardwareBffPort" -ForegroundColor White
}
if (-not $SkipAttackAdapter) {
    Write-Host "Attack Adapter:http://localhost:$attackAdapterPort" -ForegroundColor White
}

Write-Host "`nTai khoan: admin_user | analyst_user | hr_management_user | device_management_user" -ForegroundColor Gray
Write-Host 'Mat khau: gia tri DEMO_USER_PASSWORD trong .env (mac dinh seed: Demo@12345)' -ForegroundColor Gray
Write-Host "`nLan chay thong thuong:" -ForegroundColor Cyan
Write-Host '  .\scripts\run_local.ps1' -ForegroundColor Gray
Write-Host 'Sau khi package/requirements thay doi:' -ForegroundColor Cyan
Write-Host '  .\scripts\run_local.ps1 -UpdateDependencies' -ForegroundColor Gray
Write-Host 'Reset data va test truoc buoi bao ve:' -ForegroundColor Cyan
Write-Host '  .\scripts\run_local.ps1 -ResetDemoData -RunTests' -ForegroundColor Gray
Write-Host "`nNhan Ctrl+C trong tung cua so dich vu de dung du an." -ForegroundColor Yellow

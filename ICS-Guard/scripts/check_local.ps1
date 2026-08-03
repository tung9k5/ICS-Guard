# ====================================================================
# ICS-GUARD LOCAL SERVICES SMOKE TEST & API PROTECTION VERIFIER
# ====================================================================

# Set location to workspace root
$ScriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location -Path $ScriptDir
Set-Location -Path ".."

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "           ICS-GUARD LOCAL SERVICES CHECKER               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "[INFO] Root directory: $PWD" -ForegroundColor Gray

# 1. Parse .env file if it exists
$EnvFile = "$PWD\.env"
$LocalEnv = @{}
$script:Failures = 0

if (Test-Path $EnvFile) {
    Write-Host "[INFO] Loading configuration from .env file..." -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $key, $value = $line.Split("=", 2)
            $LocalEnv[$key.Trim()] = $value.Trim()
        }
    }
} else {
    Write-Host "[WARN] .env file not found. Using defaults." -ForegroundColor Yellow
}

# 2. Resolve Service URLs and Keys
$BackendPort = $LocalEnv["PORT"]
if (-not $BackendPort) { $BackendPort = "8000" }
$BackendUrl = "http://localhost:$BackendPort"

$FrontendPort = $LocalEnv["FRONTEND_PORT"]
if (-not $FrontendPort) { $FrontendPort = "3000" }
$FrontendUrl = "http://localhost:$FrontendPort"

$WebSimulatorUrl = "http://localhost:5174"

$AiEngineUrlRaw = $LocalEnv["AI_ENGINE_URL"]
$AiEngineUrl = "http://localhost:5000" # Fallback local HTTP
if ($AiEngineUrlRaw) {
    # Replace container host with localhost for local testing
    $AiEngineUrl = $AiEngineUrlRaw -replace "ai-engine", "localhost"
}

$DeviceApiKey = $LocalEnv["DEVICE_API_KEY"]

Write-Host ""
Write-Host "Configuration resolved:" -ForegroundColor Gray
Write-Host "  - Backend URL:    $BackendUrl" -ForegroundColor Gray
Write-Host "  - Frontend URL:   $FrontendUrl" -ForegroundColor Gray
Write-Host "  - Web Simulator:  $WebSimulatorUrl" -ForegroundColor Gray
Write-Host "  - AI Engine URL:  $AiEngineUrl" -ForegroundColor Gray
if ($DeviceApiKey) {
    Write-Host "  - Device API Key: [Configured - Masked]" -ForegroundColor Gray
} else {
    Write-Host "  - Device API Key: [Not Configured]" -ForegroundColor DarkYellow
}
Write-Host ""

# Helper function to check HTTP endpoint
function Check-Endpoint {
    param (
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus,
        [hashtable]$Headers = @{},
        [string]$Method = "GET",
        [string]$Body = $null
    )

    Write-Host "[CHECK] Testing $Name... " -NoNewline -ForegroundColor White
    
    $oldSecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol
    $oldCertificateCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
    # Allow self-signed or invalid SSL certs for local testing
    [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

    try {
        $params = @{
            Uri = $Url
            Method = $Method
            ErrorAction = "Stop"
            TimeoutSec = 5
        }
        if ($Headers.Count -gt 0) { $params["Headers"] = $Headers }
        if ($Body) { 
            $params["Body"] = $Body
            $params["ContentType"] = "application/json"
        }

        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode

        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "OK (Status $statusCode)" -ForegroundColor Green
            return $true
        } else {
            Write-Host "FAILED (Expected $ExpectedStatus, got $statusCode)" -ForegroundColor Red
            $script:Failures++
            return $false
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode
        if ($statusCode) {
            $statusCodeInt = [int]$statusCode
            if ($statusCodeInt -eq $ExpectedStatus) {
                Write-Host "OK (Status $statusCodeInt)" -ForegroundColor Green
                return $true
            } else {
                Write-Host "FAILED (Expected $ExpectedStatus, got $statusCodeInt)" -ForegroundColor Red
                $script:Failures++
                return $false
            }
        } else {
            Write-Host "UNREACHABLE (Service might be down)" -ForegroundColor Yellow
            $script:Failures++
            return $false
        }
    }
    finally {
        [System.Net.ServicePointManager]::SecurityProtocol = $oldSecurityProtocol
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $oldCertificateCallback
    }
}

Write-Host "--- Checking Service Accessibility ---" -ForegroundColor DarkCyan

# 3. Check Backend
$null = Check-Endpoint -Name "Backend Home (/)" -Url "$BackendUrl/" -ExpectedStatus 200
$null = Check-Endpoint -Name "Backend Docs (/docs)" -Url "$BackendUrl/docs" -ExpectedStatus 200

# 4. Check AI Engine
# Test both HTTP and HTTPS depending on local FastAPI configuration
$null = Check-Endpoint -Name "AI Engine Health (/health)" -Url "$AiEngineUrl/health" -ExpectedStatus 200

# 5. Check Frontend Port
$null = Check-Endpoint -Name "Frontend Portal" -Url "$FrontendUrl/" -ExpectedStatus 200

# 6. Check Web Simulator Port
$null = Check-Endpoint -Name "Web Simulator UI" -Url "$WebSimulatorUrl/" -ExpectedStatus 200

# 6.1. Check Hardware BFF
$null = Check-Endpoint -Name "Hardware BFF Health (/health)" -Url "http://localhost:5001/health" -ExpectedStatus 200

# 6.2. Check Attack Adapter
$null = Check-Endpoint -Name "Attack Adapter Health (/health)" -Url "http://localhost:5003/health" -ExpectedStatus 200

Write-Host ""
Write-Host "--- Checking API Authentication Protections ---" -ForegroundColor DarkCyan

# 7. Check Telemetry Blocked-IPs endpoint (Needs x-device-api-key)
$null = Check-Endpoint -Name "Telemetry Blocked IPs (Missing Key)" -Url "$BackendUrl/api/telemetry/blocked-ips" -ExpectedStatus 401

if ($DeviceApiKey) {
    $headers = @{ "x-device-api-key" = $DeviceApiKey }
    $null = Check-Endpoint -Name "Telemetry Blocked IPs (With Correct Key)" -Url "$BackendUrl/api/telemetry/blocked-ips" -ExpectedStatus 200 -Headers $headers
} else {
    Write-Host "[SKIP] Telemetry Blocked IPs (With Correct Key) - DEVICE_API_KEY not set in .env" -ForegroundColor Gray
}

# 8. Check Ingest endpoint (Needs x-device-api-key and returns 400 on empty body)
$null = Check-Endpoint -Name "Telemetry Ingest (Missing Key)" -Url "$BackendUrl/api/telemetry/ingest" -Method "POST" -ExpectedStatus 401

# 9. Check Attack Launch endpoint (Needs attackAuthMiddleware - returns 401 when anonymous)
$null = Check-Endpoint -Name "Attack Launch (Anonymous call)" -Url "$BackendUrl/api/attacks/launch" -Method "POST" -ExpectedStatus 401

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
if ($script:Failures -eq 0) {
    Write-Host "Checker run finished: PASS." -ForegroundColor Green
} else {
    Write-Host "Checker run finished: FAIL ($script:Failures check(s) failed)." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Green

if ($script:Failures -gt 0) { exit 1 }

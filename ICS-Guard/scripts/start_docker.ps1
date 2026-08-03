param(
  [switch]$NoBuild,
  [switch]$SkipCertGeneration,
  [switch]$Pull,
  [switch]$ShowLogs
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker was not found. Install Docker Desktop, then run this script again."
}

Write-Host "ICS-Guard Docker startup" -ForegroundColor Green
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray

if (-not (Test-Path ".env")) {
  if (Test-Path ".env.example") {
    Write-Step "Creating .env from .env.example"
    Copy-Item ".env.example" ".env"
    Write-Warn ".env was created with placeholder values. Review secrets/passwords before production use."
  } else {
    throw ".env and .env.example were not found."
  }
}

if (-not $SkipCertGeneration) {
  if (Test-Path "infrastructure\generate_certs.py") {
    Write-Step "Generating local TLS certificates"
    python infrastructure\generate_certs.py
  } else {
    Write-Warn "Certificate generator was not found. Docker may fail if cert files are missing."
  }
}

if ($Pull) {
  Write-Step "Pulling base images"
  docker compose pull
}

Write-Step "Starting Docker Compose services"
if ($NoBuild) {
  docker compose up -d
} else {
  docker compose up -d --build
}

Write-Step "Current container status"
docker compose ps

Write-Host ""
Write-Host "Docker startup completed." -ForegroundColor Green
Write-Host "Common URLs:" -ForegroundColor Cyan
Write-Host "  Frontend:      http://localhost:3000" -ForegroundColor Gray
Write-Host "  Backend:       http://localhost:8000" -ForegroundColor Gray
Write-Host "  Backend docs:  http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "  AI engine:     https://localhost:5000/docs" -ForegroundColor Gray
Write-Host "  Nginx:         http://localhost" -ForegroundColor Gray
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  docker compose ps" -ForegroundColor Gray
Write-Host "  docker compose logs backend --tail=100" -ForegroundColor Gray
Write-Host "  docker compose logs ai-engine --tail=100" -ForegroundColor Gray
Write-Host "  docker compose down" -ForegroundColor Gray

if ($ShowLogs) {
  Write-Step "Following backend logs"
  docker compose logs backend -f --tail=100
}

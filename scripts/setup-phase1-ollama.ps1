# Phase 1 setup: ensure Ollama is reachable and pull qwen2.5:7b
#
# Usage:
#   .\scripts\setup-phase1-ollama.ps1

$ErrorActionPreference = "Stop"
$Model = "qwen2.5:7b"
$OllamaBase = "http://127.0.0.1:11434"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 1 setup - Ollama + $Model" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) {
    $paths = @(
        "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
        "C:\Program Files\Ollama\ollama.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) {
            $ollama = @{ Source = $p }
            break
        }
    }
}

if (-not $ollama) {
    Write-Host "Ollama not found. Install from https://ollama.com/download then re-run." -ForegroundColor Red
    exit 1
}

Write-Host ("Using: {0}" -f $ollama.Source) -ForegroundColor DarkGray
& $ollama.Source --version

$portOk = (Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $portOk) {
    Write-Host "Starting Ollama serve in background..." -ForegroundColor Yellow
    Start-Process -FilePath $ollama.Source -ArgumentList "serve" -WindowStyle Minimized
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $null = Invoke-RestMethod "$OllamaBase/api/tags" -TimeoutSec 2
            $portOk = $true
            break
        }
        catch {}
    }
}

if (-not $portOk) {
    Write-Host "Ollama API not reachable on :11434" -ForegroundColor Red
    exit 1
}

Write-Host "Pulling $Model (may take several minutes)..." -ForegroundColor Cyan
& $ollama.Source pull $Model
if ($LASTEXITCODE -ne 0) {
    Write-Host "Pull failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "Running verify-phase1.ps1 ..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "verify-phase1.ps1")
exit $LASTEXITCODE

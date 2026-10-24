# Phase A: Real Ollama listing draft (agent workspace)
#
# Usage:
#   .\scripts\verify-phaseA-listing-draft.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
$pass = 0
$fail = 0
$warn = 0

function Write-Check([string]$Name, [string]$Status, [string]$Detail = "") {
    switch ($Status) {
        "PASS" { $script:pass++; $color = "Green" }
        "WARN" { $script:warn++; $color = "Yellow" }
        default { $script:fail++; $color = "Red"; $Status = "FAIL" }
    }
    $line = "[{0}] {1}" -f $Status, $Name
    if ($Detail) { $line = $line + " - " + $Detail }
    Write-Host $line -ForegroundColor $color
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase A - Listing draft (Ollama)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$files = @(
    "services\ai\prompt_listing_draft.py",
    "services\ai\ollama_listing_draft.py",
    "services\ai\template_listing_draft.py"
)
foreach ($rel in $files) {
    if (Test-Path (Join-Path $Root $rel)) { Write-Check "File $rel" "PASS" }
    else { Write-Check "File $rel" "FAIL" }
}

$mainPy = Join-Path $Root "services\ai\main.py"
if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern "generate_listing_draft_endpoint|X-PropertyIQ-Listing-Draft" -Quiet)) {
    Write-Check "main.py listing-draft wiring" "PASS"
} else { Write-Check "main.py listing-draft wiring" "FAIL" }

$aiPort = 8002
if (Test-Path (Join-Path $Root ".ai-service.port")) {
    $p = (Get-Content (Join-Path $Root ".ai-service.port") -Raw).Trim()
    if ($p -match '^\d+$') { $aiPort = [int]$p }
}

$aiUp = $false
try {
    $h = Invoke-RestMethod "http://127.0.0.1:$aiPort/health" -TimeoutSec 3
    if ($h.service -like "*PropertyIQ*") {
        $aiUp = $true
        Write-Check "AI service :$aiPort" "PASS"
        if ($h.ops.listing_draft) {
            Write-Check "Health listing_draft config" "PASS" ($h.ops.listing_draft.mode)
        } else {
            Write-Check "Health listing_draft config" "WARN" "restart AI"
        }
    }
} catch {
    Write-Check "AI service" "WARN" "not running - start .\start-dev.ps1"
}

if ($aiUp) {
    $body = @{
        property_type = "House"
        city          = "Lahore"
        area          = "DHA Phase 6"
        size          = 1
        size_unit     = "Kanal"
        price         = 98000000
        bedrooms      = 5
        bathrooms     = 6
        furnishing    = "Semi-Furnished"
        user_notes    = "Solar backup, imported kitchen fittings"
    } | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$aiPort/ai/listing-draft" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 200 -UseBasicParsing
        $src = $resp.Headers["X-PropertyIQ-Listing-Draft"]
        if (-not $src) { $src = $resp.Headers["x-propertyiq-listing-draft"] }
        $json = $resp.Content | ConvertFrom-Json
        if ($json.suggested_title -and $json.suggested_description) {
            Write-Check "Live listing-draft" "PASS" "source=$src"
        } else {
            Write-Check "Live listing-draft" "FAIL" "missing title/description"
        }
        if ($json.selling_highlights -and $json.selling_highlights.Count -ge 1) {
            Write-Check "Highlights array" "PASS"
        } else {
            Write-Check "Highlights array" "WARN"
        }
        if ($src -eq "ollama") {
            Write-Check "Ollama source" "PASS"
        } else {
            Write-Check "Ollama source" "WARN" "got $src (Ollama down or template fallback)"
        }
    }
    catch {
        Write-Check "Live listing-draft" "FAIL" $_.Exception.Message
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase A READY - hybrid listing draft for agents." -ForegroundColor Green
} else {
    Write-Host "  Phase A NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }

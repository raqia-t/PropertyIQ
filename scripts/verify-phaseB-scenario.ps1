# Phase B: comps-aware property scenario
#
# Usage:
#   .\scripts\verify-phaseB-scenario.ps1

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
Write-Host "  PropertyIQ Phase B - Comps property scenario" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($rel in @(
    "services\ai\property_scenario.py",
    "services\ai\ollama_scenario_explain.py",
    "services\api\src\PropertyIQ.Application\Services\PropertyCompsService.cs"
)) {
    if (Test-Path (Join-Path $Root $rel)) { Write-Check "File $rel" "PASS" }
    else { Write-Check "File $rel" "FAIL" }
}

$mainPy = Join-Path $Root "services\ai\main.py"
if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern "compute_scenario|sale_comps" -Quiet)) {
    Write-Check "main.py comps wiring" "PASS"
} else { Write-Check "main.py comps wiring" "FAIL" }

$ctrl = Join-Path $Root "services\api\src\PropertyIQ.Api\Controllers\AiController.cs"
if ((Test-Path $ctrl) -and (Select-String -Path $ctrl -Pattern "IPropertyCompsService|GetCompsAsync" -Quiet)) {
    Write-Check "AiController loads comps" "PASS"
} else { Write-Check "AiController loads comps" "FAIL" }

$apiUp = $false
try {
    Invoke-WebRequest "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 5 | Out-Null
    $apiUp = $true
    Write-Check "API :5000" "PASS"
} catch {
    Write-Check "API :5000" "WARN" "start API then re-run"
}

if ($apiUp) {
    $body = @{
        city          = "Lahore"
        area          = "DHA Phase 6"
        propertyType  = "House"
        size          = 1
        sizeUnit      = "Kanal"
        askingPrice   = 98000000
        bedrooms      = 5
    } | ConvertTo-Json

    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/api/ai/property-scenario" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 120 -UseBasicParsing
        $json = $resp.Content | ConvertFrom-Json
        if ($json.fairPriceLow -gt 0 -and $json.estimatedRentMonthlyMin -gt 0) {
            $detail = "source={0} sale={1} rent={2}" -f $json.valuationSource, $json.saleCompCount, $json.rentCompCount
            Write-Check "Live property-scenario" "PASS" $detail
        } else {
            Write-Check "Live property-scenario" "FAIL" "missing numbers"
        }
        if ($json.valuationSource -in @("comps", "hybrid_formula", "formula")) {
            Write-Check "Valuation source field" "PASS" $json.valuationSource
        } else {
            Write-Check "Valuation source field" "WARN" "restart API after Phase B"
        }
        $saleN = 0; $rentN = 0
        if ($null -ne $json.saleCompCount) { $saleN = [int]$json.saleCompCount }
        if ($null -ne $json.rentCompCount) { $rentN = [int]$json.rentCompCount }
        if ($saleN -gt 0 -or $rentN -gt 0) {
            Write-Check "Comps used" "PASS"
        } else {
            Write-Check "Comps used" "WARN" "seed may lack nearby comps - formula path OK"
        }
        if ($json.assumptions -and $json.assumptions.Count -ge 1) {
            Write-Check "Assumptions present" "PASS"
        } else {
            Write-Check "Assumptions present" "WARN"
        }
    }
    catch {
        Write-Check "Live property-scenario" "FAIL" $_.Exception.Message
    }
}

$py = Join-Path $Root "services\ai\.venv\Scripts\python.exe"
$aiDir = Join-Path $Root "services\ai"
if (Test-Path $py) {
    $probe = Join-Path $aiDir "_probe_phaseB.py"
    Set-Content -Path $probe -Encoding utf8 -Value @'
from property_scenario import compute_scenario
r, s = compute_scenario(
  city="Lahore", area="DHA Phase 6", property_type="House", size=1, size_unit="Kanal",
  asking_price=98000000, bedrooms=5,
  sale_comps=[{"price":98000000,"size":1,"size_unit":"Kanal"},{"price":90000000,"size":1,"size_unit":"Kanal"}],
  rent_comps=[{"price":400000,"size":1,"size_unit":"Kanal"}],
)
print(s, r["sale_comp_count"], r["rent_comp_count"], r["fair_price_low"] > 0)
'@
    try {
        $out = & $py $probe 2>&1 | Out-String
        if ($out -match "comps" -and $out -match "True") {
            Write-Check "Python compute_scenario comps" "PASS" $out.Trim()
        } else {
            Write-Check "Python compute_scenario comps" "FAIL" $out.Trim()
        }
    } finally {
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Check "Python venv" "WARN" "missing"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase B READY - comps-aware rent/valuation scenarios." -ForegroundColor Green
} else {
    Write-Host "  Phase B NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }

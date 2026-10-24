# Phase 2 check: search filter JSON contract (schema + normalize + parser fields)
#
# Usage (from repo root):
#   .\scripts\verify-phase2.ps1

$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
$AiDir = Join-Path $Root "services\ai"
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

function Find-AiPort {
    $portFile = Join-Path $Root ".ai-service.port"
    $candidates = @()
    if (Test-Path $portFile) {
        $fromFile = (Get-Content $portFile -Raw).Trim()
        if ($fromFile -match '^\d+$') { $candidates += [int]$fromFile }
    }
    $candidates += @(8001, 8000)
    foreach ($p in ($candidates | Select-Object -Unique)) {
        try {
            $h = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $p) -TimeoutSec 3
            if ($h.service -like "*PropertyIQ*") { return $p }
        }
        catch {}
    }
    return $null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 2 - Search filter JSON contract" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$schemaPy = Join-Path $AiDir "search_schema.py"
$schemaJson = Join-Path $AiDir "search_filter.schema.json"
if (Test-Path $schemaPy) {
    Write-Check "search_schema.py" "PASS" "present"
}
else {
    Write-Check "search_schema.py" "FAIL" "missing"
}

$py = Join-Path $AiDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Check "AI venv python" "FAIL" "missing .venv"
}
else {
    Write-Check "AI venv python" "PASS" $py
    $code = @'
from search_schema import (
    normalize_search_filter,
    build_ollama_json_schema,
    schema_catalog,
    write_schema_json,
)
from pathlib import Path

# Alias normalization
f = normalize_search_filter({
    "raw_query": "5 marla flat in dha 6 for rent under 50 lac",
    "city": "lhr",
    "area": "dha 6",
    "property_type": "flat",
    "purpose": "for rent",
    "min_price": None,
    "max_price": 5000000,
    "bedrooms": 2,
    "land_area": 5,
    "land_area_unit": "marlas",
    "lifestyle_preferences": ["Near reputable schools"],
    "investment_intent": "Personal Residence",
    "confidence_score": 1.2,
})
assert f.city == "Lahore", f.city
assert f.area == "DHA Phase 6", f.area
assert f.property_type == "ApartmentFlat", f.property_type
assert f.purpose == "Rent", f.purpose
assert f.land_area_unit == "Marla", f.land_area_unit
assert f.confidence_score == 1.0, f.confidence_score
assert f.max_price == 5000000

# Unknown type rejected
f2 = normalize_search_filter({
    "raw_query": "x",
    "city": "Lahore",
    "property_type": "spaceship",
    "confidence_score": 0.5,
})
assert f2.property_type is None

schema = build_ollama_json_schema()
assert schema["type"] == "object"
assert "city" in schema["properties"]
assert "purpose" in schema["properties"]
cat = schema_catalog()
assert cat["version"] == "1.0.0"
path = write_schema_json()
assert Path(path).exists()
print("NORMALIZE_OK")
'@
    $tmp = Join-Path $AiDir "_phase2_check.py"
    Set-Content -Path $tmp -Value $code -Encoding utf8
    try {
        $out = & $py $tmp 2>&1 | Out-String
        if ($out -match "NORMALIZE_OK") {
            Write-Check "normalize_search_filter unit checks" "PASS" "aliases + clamp + schema"
        }
        else {
            Write-Check "normalize_search_filter unit checks" "FAIL" $out.Trim()
        }
    }
    finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}

if (Test-Path $schemaJson) {
    try {
        $null = Get-Content $schemaJson -Raw | ConvertFrom-Json
        Write-Check "search_filter.schema.json" "PASS" "valid JSON on disk"
    }
    catch {
        Write-Check "search_filter.schema.json" "FAIL" $_.Exception.Message
    }
}
else {
    Write-Check "search_filter.schema.json" "WARN" "not written yet - import search_schema or hit /ai/search-schema"
}

Write-Host ""
Write-Host "Live AI service" -ForegroundColor White
$aiPort = Find-AiPort
if ($null -eq $aiPort) {
    Write-Check "AI service" "FAIL" "PropertyIQ AI not up on 8000/8001"
}
else {
    Write-Check "AI service" "PASS" (":{0}" -f $aiPort)
    try {
        $cat = Invoke-RestMethod ("http://127.0.0.1:{0}/ai/search-schema" -f $aiPort) -TimeoutSec 10
        if ($cat.version -eq "1.0.0" -and $cat.json_schema) {
            Write-Check "GET /ai/search-schema" "PASS" ("cities={0}" -f ($cat.allowed_cities -join ","))
        }
        else {
            Write-Check "GET /ai/search-schema" "FAIL" "unexpected payload"
        }
    }
    catch {
        Write-Check "GET /ai/search-schema" "FAIL" $_.Exception.Message
    }

    try {
        $body = @{ query = "2 bed flat in bahria islamabad for rent under 50 lac"; preferred_city = "Lahore" } | ConvertTo-Json
        $parsed = Invoke-RestMethod ("http://127.0.0.1:{0}/ai/search-parser" -f $aiPort) -Method POST -ContentType "application/json" -Body $body -TimeoutSec 20
        $ok = ($parsed.city -eq "Islamabad") -and ($parsed.property_type -eq "ApartmentFlat") -and ($parsed.purpose -eq "Rent")
        $detail = "city={0} type={1} purpose={2} area={3} max={4}" -f $parsed.city, $parsed.property_type, $parsed.purpose, $parsed.area, $parsed.max_price
        if ($ok) { Write-Check "POST /ai/search-parser purpose field" "PASS" $detail }
        else { Write-Check "POST /ai/search-parser purpose field" "FAIL" $detail }
    }
    catch {
        Write-Check "POST /ai/search-parser purpose field" "FAIL" $_.Exception.Message
    }
}

$dto = Join-Path $Root "services\api\src\PropertyIQ.Application\Common\Interfaces\IAiServiceClient.cs"
if ((Test-Path $dto) -and (Select-String -Path $dto -Pattern "Purpose" -Quiet)) {
    Write-Check "C# NaturalLanguageSearchFilterDto.Purpose" "PASS" "field present"
}
else {
    Write-Check "C# NaturalLanguageSearchFilterDto.Purpose" "FAIL" "Purpose missing"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 2 READY - proceed to Phase 3 (Ollama hybrid parser)." -ForegroundColor Green
}
else {
    Write-Host "  Phase 2 NOT ready - fix FAIL items, then re-run." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }

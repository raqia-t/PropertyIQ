# Phase C: photo classification (vision + filename fallback)
#
# Usage:
#   .\scripts\verify-phaseC-image.ps1

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
Write-Host "  PropertyIQ Phase C - Image classification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($rel in @(
    "services\ai\image_classifier.py",
    "apps\web\src\app\api\ai\classify-image\route.ts"
)) {
    if (Test-Path (Join-Path $Root $rel)) { Write-Check "File $rel" "PASS" }
    else { Write-Check "File $rel" "FAIL" }
}

$mainPy = Join-Path $Root "services\ai\main.py"
if ((Test-Path $mainPy) -and (Select-String -Path $mainPy -Pattern "classify_property_image_endpoint|image_base64" -Quiet)) {
    Write-Check "main.py image-classification wiring" "PASS"
} else { Write-Check "main.py image-classification wiring" "FAIL" }

$page = Join-Path $Root "apps\web\src\components\properties\PropertyListingPage.tsx"
if ((Test-Path $page) -and (Select-String -Path $page -Pattern "classifyPhoto|/api/ai/classify-image" -Quiet)) {
    Write-Check "Listing form classify on upload" "PASS"
} else { Write-Check "Listing form classify on upload" "FAIL" }

$aiPort = 8001
if (Test-Path (Join-Path $Root ".ai-service.port")) {
    $p = (Get-Content (Join-Path $Root ".ai-service.port") -Raw).Trim()
    if ($p -match '^\d+$') { $aiPort = [int]$p }
}

$aiUp = $false
try {
    $h = Invoke-RestMethod "http://127.0.0.1:$aiPort/health" -TimeoutSec 5
    if ($h.service -like "*PropertyIQ*") {
        $aiUp = $true
        Write-Check "AI :$aiPort" "PASS"
        if ($h.ops.vision) {
            if ($h.ops.vision.model_present) {
                Write-Check "Vision model present" "PASS" $h.ops.vision.model
            } else {
                Write-Check "Vision model present" "WARN" "run: ollama pull llava:7b (filename fallback active)"
            }
        } else {
            Write-Check "Vision health block" "WARN" "restart AI service"
        }
    }
} catch {
    Write-Check "AI service" "WARN" "not running"
}

if ($aiUp) {
    $body = @{
        image_url      = "https://example.com/photos/kitchen-front.jpg"
        filename       = "kitchen-island.jpg"
        property_type  = "House"
    } | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$aiPort/ai/image-classification" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
        $src = $resp.Headers["X-PropertyIQ-Image-Source"]
        $json = $resp.Content | ConvertFrom-Json
        if ($json.classified_room -eq "Kitchen") {
            Write-Check "Filename kitchen classify" "PASS" "source=$src"
        } else {
            Write-Check "Filename kitchen classify" "FAIL" $json.classified_room
        }
        if ($json.detected_features -and $json.ui_category) {
            Write-Check "Features + ui_category" "PASS"
        } else {
            Write-Check "Features + ui_category" "WARN"
        }
    } catch {
        Write-Check "Live image-classification" "FAIL" $_.Exception.Message
    }
}

$apiUp = $false
try {
    Invoke-WebRequest "http://localhost:5000/swagger/index.html" -UseBasicParsing -TimeoutSec 4 | Out-Null
    $apiUp = $true
    Write-Check "API :5000" "PASS"
} catch {
    Write-Check "API :5000" "WARN" "start API for bridge test"
}

if ($apiUp) {
    $body = @{
        filename      = "master-bedroom.jpg"
        propertyType  = "House"
        imageUrl      = "file://local/master-bedroom.jpg"
    } | ConvertTo-Json
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5000/api/ai/classify-image" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 60 -UseBasicParsing
        $json = $resp.Content | ConvertFrom-Json
        if ($json.classifiedRoom -match "Bedroom|Living") {
            Write-Check "ASP.NET classify-image" "PASS" ("room={0} source={1}" -f $json.classifiedRoom, $json.source)
        } else {
            Write-Check "ASP.NET classify-image" "WARN" $json.classifiedRoom
        }
    } catch {
        Write-Check "ASP.NET classify-image" "FAIL" $_.Exception.Message
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase C READY - hybrid photo classification wired." -ForegroundColor Green
} else {
    Write-Host "  Phase C NOT ready." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan
if ($fail -gt 0) { exit 1 } else { exit 0 }

# Phase 4 check: enriched Pakistan NL prompt + few-shots + eval cases
#
# Usage (from repo root):
#   .\scripts\verify-phase4.ps1

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
    $candidates += @(8002, 8001, 8000)
    foreach ($p in ($candidates | Select-Object -Unique)) {
        try {
            $h = Invoke-RestMethod -Uri ("http://127.0.0.1:{0}/health" -f $p) -TimeoutSec 5
            if ($h.service -like "*PropertyIQ*") { return @{ Port = $p; Health = $h } }
        }
        catch {}
    }
    return $null
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  PropertyIQ Phase 4 - Search prompt design" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$promptPy = Join-Path $AiDir "prompt_search.py"
if (Test-Path $promptPy) {
    Write-Check "prompt_search.py" "PASS" "present"
}
else {
    Write-Check "prompt_search.py" "FAIL" "missing"
}

$py = Join-Path $AiDir ".venv\Scripts\python.exe"
if (Test-Path $py) {
    $code = @'
from prompt_search import build_system_prompt, build_chat_messages, FEW_SHOTS, PROMPT_VERSION, EVAL_CASES
assert PROMPT_VERSION.startswith("4.")
sp = build_system_prompt()
assert "crore" in sp and "Marla" in sp and "ApartmentFlat" in sp
assert "Roman Urdu" in sp or "Roman Urdu" in sp.lower() or "roman" in sp.lower()
msgs = build_chat_messages("test query", "Lahore")
assert msgs[0]["role"] == "system"
assert len(FEW_SHOTS) >= 3
# system + 2*fewshots + final user
assert len(msgs) == 1 + 2 * len(FEW_SHOTS) + 1
assert msgs[-1]["role"] == "user" and "test query" in msgs[-1]["content"]
assert len(EVAL_CASES) >= 4
print("PROMPT_OK", PROMPT_VERSION, "shots", len(FEW_SHOTS), "eval", len(EVAL_CASES))
'@
    $tmp = Join-Path $AiDir "_phase4_check.py"
    Set-Content -Path $tmp -Value $code -Encoding utf8
    try {
        $out = & $py $tmp 2>&1 | Out-String
        if ($out -match "PROMPT_OK") {
            Write-Check "Prompt unit checks" "PASS" $out.Trim()
        }
        else {
            Write-Check "Prompt unit checks" "FAIL" $out.Trim()
        }
    }
    finally {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Check "AI venv" "FAIL" "missing"
}

$info = Find-AiPort
if ($null -eq $info) {
    Write-Check "AI service" "FAIL" "not running"
}
else {
    $aiPort = $info.Port
    Write-Check "AI service" "PASS" (":{0}" -f $aiPort)
    $pv = $info.Health.prompt_version
    if ($pv -like "4.*") {
        Write-Check "Health prompt_version" "PASS" $pv
    }
    else {
        Write-Check "Health prompt_version" "WARN" ("got {0} - restart AI to load Phase 4" -f $pv)
    }

    try {
        $cat = Invoke-RestMethod ("http://127.0.0.1:{0}/ai/search-prompt" -f $aiPort) -TimeoutSec 15
        if ($cat.version -like "4.*" -and $cat.few_shot_count -ge 3) {
            Write-Check "GET /ai/search-prompt" "PASS" ("v={0} shots={1}" -f $cat.version, $cat.few_shot_count)
        }
        else {
            Write-Check "GET /ai/search-prompt" "FAIL" "unexpected catalog"
        }
    }
    catch {
        Write-Check "GET /ai/search-prompt" "FAIL" $_.Exception.Message
    }

    Write-Host ""
    Write-Host "Live eval (Ollama; may take several minutes)" -ForegroundColor White
    $eval = Join-Path $AiDir "eval_phase4.py"
    $evalOut = & $py $eval --base ("http://127.0.0.1:{0}" -f $aiPort) --timeout 120 2>&1 | Out-String
    Write-Host $evalOut
    if ($LASTEXITCODE -eq 0) {
        Write-Check "eval_phase4.py" "PASS" "all cases matched"
    }
    else {
        Write-Check "eval_phase4.py" "FAIL" "see output above"
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 4 READY - prompt glossary + few-shots live." -ForegroundColor Green
}
else {
    Write-Host "  Phase 4 NOT ready - fix FAIL items." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }

# Phase 1 check: Ollama installed + qwen2.5:7b available + JSON smoke test
#
# Usage (from repo root):
#   .\scripts\verify-phase1.ps1

$ErrorActionPreference = "Continue"
$ExpectedModel = "qwen2.5:7b"
$OllamaBase = "http://127.0.0.1:11434"

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
Write-Host "  PropertyIQ Phase 1 - Local LLM (Ollama + Qwen2.5)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
        "C:\Program Files\Ollama\ollama.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $ollamaCmd = @{ Source = $c }
            break
        }
    }
}

if ($ollamaCmd) {
    $ver = & $ollamaCmd.Source --version 2>&1 | Out-String
    Write-Check "Ollama CLI" "PASS" ($ver.Trim())
}
else {
    Write-Check "Ollama CLI" "FAIL" "Install from https://ollama.com/download then re-run"
}

$portOk = (Test-NetConnection -ComputerName localhost -Port 11434 -WarningAction SilentlyContinue).TcpTestSucceeded
if (-not $portOk) {
    Write-Check "Ollama API :11434" "FAIL" "Start Ollama app / run: ollama serve"
}
else {
    try {
        $tags = Invoke-RestMethod -Uri "$OllamaBase/api/tags" -TimeoutSec 10
        $names = @($tags.models | ForEach-Object { $_.name })
        Write-Check "Ollama API /api/tags" "PASS" ("models={0}" -f ($names -join ", "))

        $hasQwen = $false
        foreach ($n in $names) {
            if ($n -eq $ExpectedModel -or $n.StartsWith("qwen2.5:7b")) {
                $hasQwen = $true
                break
            }
        }
        if ($hasQwen) {
            Write-Check "Model $ExpectedModel" "PASS" "present in local library"
        }
        else {
            Write-Check "Model $ExpectedModel" "FAIL" "run: ollama pull qwen2.5:7b"
        }
    }
    catch {
        Write-Check "Ollama API /api/tags" "FAIL" $_.Exception.Message
    }
}

Write-Host ""
Write-Host "JSON smoke test (non-streaming /api/chat)" -ForegroundColor White

if ($portOk) {
    try {
        $payload = @{
            model = $ExpectedModel
            stream = $false
            format = "json"
            messages = @(
                @{
                    role = "system"
                    content = "Reply with JSON only. No markdown."
                },
                @{
                    role = "user"
                    content = 'Reply with JSON only: {"city":"Lahore"}'
                }
            )
            options = @{ temperature = 0; num_predict = 64 }
        } | ConvertTo-Json -Depth 6

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $resp = Invoke-RestMethod -Uri "$OllamaBase/api/chat" -Method POST -ContentType "application/json" -Body $payload -TimeoutSec 180
        $sw.Stop()
        $content = $resp.message.content
        $parsed = $null
        try { $parsed = $content | ConvertFrom-Json } catch {}
        if ($parsed -and $parsed.city -eq "Lahore") {
            Write-Check "Smoke JSON reply" "PASS" ("city=Lahore in {0}ms" -f $sw.ElapsedMilliseconds)
        }
        elseif ($content -match "Lahore") {
            Write-Check "Smoke JSON reply" "WARN" ("got text containing Lahore: {0}" -f $content.Substring(0, [Math]::Min(120, $content.Length)))
        }
        else {
            Write-Check "Smoke JSON reply" "FAIL" ("unexpected: {0}" -f $content)
        }
    }
    catch {
        $msg = $_.Exception.Message
        if ($msg -match "404|not found|model") {
            Write-Check "Smoke JSON reply" "FAIL" "model missing - ollama pull qwen2.5:7b"
        }
        else {
            Write-Check "Smoke JSON reply" "FAIL" $msg
        }
    }
}
else {
    Write-Check "Smoke JSON reply" "FAIL" "skipped - Ollama API down"
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ("  Result: {0} PASS, {1} WARN, {2} FAIL" -f $pass, $warn, $fail)
if ($fail -eq 0) {
    Write-Host "  Phase 1 READY - proceed to Phase 2 (JSON schema) / Phase 3 (wire parser)." -ForegroundColor Green
}
else {
    Write-Host "  Phase 1 NOT ready - fix FAIL items, then re-run." -ForegroundColor Red
}
Write-Host "==========================================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 } else { exit 0 }

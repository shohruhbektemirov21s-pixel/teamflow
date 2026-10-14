<#
.SYNOPSIS
  TeamFlow to'liq regressiya tekshiruvi: backend testlari, migratsiya mosligi,
  TypeScript, frontend testlari, production build.

.DESCRIPTION
  Hech narsa o'zgartirmaydi va amaldagi bazaga tegmaydi: testlar vaqtinchalik
  SQLite bazada ishlaydi; DATABASE_URL, REDIS_URL va Telegram sozlamalari bu
  jarayon uchun bo'shatiladi (haqiqiy xabar ketmasligi uchun).
  Birorta qadam yiqilsa, chiqish kodi 1.

.PARAMETER Backend   Faqat backend qadamlari.
.PARAMETER Frontend  Faqat frontend qadamlari.
.PARAMETER SkipBuild Production buildni o'tkazib yubor (tezroq).

.EXAMPLE
  powershell -File scripts/verify.ps1
  powershell -File scripts/verify.ps1 -Backend
#>
param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runBackend = $Backend -or (-not $Frontend)
$runFrontend = $Frontend -or (-not $Backend)

# Python: TEAMFLOW_PYTHON -> shu checkout'dagi .venv -> asosiy checkout'dagi .venv (git worktree uchun)
function Find-Python {
    if ($env:TEAMFLOW_PYTHON -and (Test-Path $env:TEAMFLOW_PYTHON)) { return $env:TEAMFLOW_PYTHON }
    $local = Join-Path $root "backend\.venv\Scripts\python.exe"
    if (Test-Path $local) { return $local }
    $common = & git -C $root rev-parse --path-format=absolute --git-common-dir 2>$null
    if ($common) {
        $main = Join-Path (Split-Path -Parent $common) "backend\.venv\Scripts\python.exe"
        if (Test-Path $main) { return $main }
    }
    return $null
}

$results = New-Object System.Collections.Generic.List[object]

function Invoke-Step {
    param([string]$Name, [string]$Dir, [scriptblock]$Action)
    Write-Host ""
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    $started = Get-Date
    Push-Location $Dir
    try {
        & $Action
        $ok = ($LASTEXITCODE -eq 0)
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        $ok = $false
    } finally {
        Pop-Location
    }
    $secs = [math]::Round(((Get-Date) - $started).TotalSeconds)
    $results.Add([pscustomobject]@{ Step = $Name; Result = $(if ($ok) { "OK" } else { "FAIL" }); Seconds = $secs })
}

if ($runBackend) {
    $py = Find-Python
    if (-not $py) {
        Write-Host "Python topilmadi. backend/.venv yarating yoki TEAMFLOW_PYTHON ni o'rnating." -ForegroundColor Red
        $results.Add([pscustomobject]@{ Step = "backend: python"; Result = "FAIL"; Seconds = 0 })
    } else {
        # Xavfsizlik: amaldagi baza, kesh va Telegram'ga tegmaslik
        $env:DATABASE_URL = ""
        $env:REDIS_URL = ""
        $env:TELEGRAM_BOT_TOKEN = ""
        $env:TINYFISH_API_KEY = ""
        $backendDir = Join-Path $root "backend"
        Invoke-Step "backend: testlar" $backendDir { & $py manage.py test }
        Invoke-Step "backend: migratsiya mosligi" $backendDir { & $py manage.py makemigrations --check --dry-run }
    }
}

if ($runFrontend) {
    $frontendDir = Join-Path $root "frontend"
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        Write-Host "frontend/node_modules yo'q. Avval: cd frontend; npm ci" -ForegroundColor Red
        $results.Add([pscustomobject]@{ Step = "frontend: node_modules"; Result = "FAIL"; Seconds = 0 })
    } else {
        Invoke-Step "frontend: TypeScript" $frontendDir { npm run typecheck }
        Invoke-Step "frontend: testlar" $frontendDir { npx vitest run }
        if (-not $SkipBuild) {
            Invoke-Step "frontend: build" $frontendDir { npm run build }
        }
    }
}

Write-Host ""
Write-Host "=== NATIJA ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize | Out-String | Write-Host
$failed = @($results | Where-Object { $_.Result -ne "OK" })
if ($failed.Count -gt 0) {
    Write-Host "Tekshiruv O'TMADI ($($failed.Count) ta qadam). Vazifa tugagan hisoblanmaydi." -ForegroundColor Red
    exit 1
}
Write-Host "Hamma qadam o'tdi." -ForegroundColor Green
exit 0

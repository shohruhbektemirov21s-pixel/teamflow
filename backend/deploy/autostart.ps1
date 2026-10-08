# TeamFlow: Windows'ga kirganda Docker Desktop'ni yoqadi va TeamFlow konteynerlarini ishga tushiradi.
# `restart: unless-stopped` yetarli emas: Docker Desktop to'xtatilganda konteynerlar "to'xtatilgan" bo'lib qoladi.
# O'rnatish va o'chirish: README.md, "Docker bilan ishga tushirish".
$containers = "teamflow-db-1", "teamflow-redis-1", "teamflow-app-1", "teamflow-proxy-1", "teamflow-bot-1", "teamflow-telegram-1"
$log = Join-Path $PSScriptRoot "autostart.log"
function Write-Log($text) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text" | Add-Content -Path $log -Encoding utf8 }

if (-not (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue)) {
    Start-Process (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe")
    Write-Log "Docker Desktop ishga tushirildi"
}
$deadline = (Get-Date).AddMinutes(10)
do {
    docker info *> $null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 5
} while ((Get-Date) -lt $deadline)
if ($LASTEXITCODE -ne 0) { Write-Log "Docker 10 daqiqada tayyor bo'lmadi"; exit 1 }

# Bot konteynerlari mavjud bo'lmasa (token yo'q), faqat borlari ishga tushadi.
$existing = docker ps -a --format "{{.Names}}"
$targets = $containers | Where-Object { $existing -contains $_ }
docker start @targets *> $null
Write-Log "Konteynerlar ishga tushirildi: $($targets -join ', ') (kod $LASTEXITCODE)"

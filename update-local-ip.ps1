# update-local-ip.ps1
# Detecta la IP LAN actual y actualiza EXPO_PUBLIC_API_HOST en mobile/.env
# Uso: .\update-local-ip.ps1 (desde la raiz del proyecto)

$EnvFile = "$PSScriptRoot\mobile\.env"

# Obtener la IP LAN principal (primera IPv4 no-loopback)
$LocalIP = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Sort-Object -Property PrefixLength -Descending |
    Select-Object -First 1).IPAddress

if (-not $LocalIP) {
    Write-Error "No se pudo detectar la IP local."
    exit 1
}

Write-Host "Detected Local IP: $LocalIP" -ForegroundColor Cyan

# Leer el .env actual
$content = Get-Content $EnvFile -Raw

# Reemplazar o agregar EXPO_PUBLIC_API_HOST
if ($content -match "EXPO_PUBLIC_API_HOST=") {
    $newContent = $content -replace "EXPO_PUBLIC_API_HOST=.*", "EXPO_PUBLIC_API_HOST=$LocalIP"
} else {
    $newContent = $content.TrimEnd() + "`nEXPO_PUBLIC_API_HOST=$LocalIP`n"
}

Set-Content -Path $EnvFile -Value $newContent -NoNewline

Write-Host "Updated mobile/.env -> EXPO_PUBLIC_API_HOST=$LocalIP" -ForegroundColor Green
Write-Host ""
Write-Host "Now restart your Expo dev server (press 'r' in Expo terminal) to pick up the new IP." -ForegroundColor Yellow

#!/usr/bin/env powershell

# Start backend server in background
Write-Host "Starting backend server..."
$backendProcess = Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory "c:\Users\cris7\OneDrive\Desktop\Threshold\backend" -PassThru -NoNewWindow

# Wait for server to start
Write-Host "Waiting 3 seconds for server initialization..."
Start-Sleep -Seconds 3

# Run test
Write-Host "`nRunning API tests..."
& node "test-api-client.js"

# Kill the server
Write-Host "`nStopping backend server..."
Stop-Process -Id $backendProcess.Id -Force

Write-Host "Done."

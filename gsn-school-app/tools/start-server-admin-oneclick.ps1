#!/usr/bin/env pwsh
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# One-click elevated helper: set HOST=0.0.0.0, ensure firewall rule, and start server
$port = 3001
$host = '0.0.0.0'
$env:PORT = $port
$env:HOST = $host
$ruleName = "GSN School App ($port)"
Write-Output "One-click elevated helper: ensure firewall rule and start server (HOST=$host PORT=$port)"
try {
    $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    if (-not $existing) {
        New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow -Profile Any
        Write-Output "Firewall rule created: $ruleName"
    } else {
        Write-Output "Firewall rule already exists: $ruleName"
    }
} catch {
    Write-Error "Could not ensure firewall rule: $_"
}

Write-Output "Starting Node server in: $scriptDir (HOST=$host PORT=$port)"
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $scriptDir -NoNewWindow

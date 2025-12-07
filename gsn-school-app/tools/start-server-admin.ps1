#!/usr/bin/env pwsh
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# Ensure env defaults
$port = if ($env:PORT) { [int]$env:PORT } else { 3001; $env:PORT = 3001 }
$host = if ($env:HOST) { $env:HOST } else { '127.0.0.1'; $env:HOST = '127.0.0.1' }
$ruleName = 'GSN School App (3001)'
Write-Output "Running elevated helper: ensure firewall rule and start server (port $port)"
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

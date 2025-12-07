# Watcher: runs server.js and restarts it automatically if it exits.
# Writes stdout/stderr to logs/server.log (appends).

param(
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$AppFile = "server.js",
  [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

if (-not (Test-Path -Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
$logFile = Join-Path $LogDir "server.log"

Write-Output "Watcher starting at $(Get-Date)" | Tee-Object -FilePath $logFile -Append

while ($true) {
  try {
    Write-Output "Starting node at $(Get-Date)" | Tee-Object -FilePath $logFile -Append

    # Determine port to bind (use environment PORT if set)
    $Port = if ($env:PORT) { [int]$env:PORT } else { 3000 }

    # Wait while the port is in use to avoid rapid EADDRINUSE restart loops
    $Port = [int]$Port
    # Determine which host to probe: if HOST env set and not 0.0.0.0, use it, otherwise probe localhost
    $CheckHost = if ($env:HOST -and $env:HOST -ne '0.0.0.0') { $env:HOST } else { '127.0.0.1' }
    $tries = 0
    while ((Test-NetConnection -ComputerName $CheckHost -Port $Port -InformationLevel Quiet) -and $tries -lt 120) {
      Write-Output "Port $Port appears in use on $CheckHost; waiting before starting node..." | Tee-Object -FilePath $logFile -Append
      Start-Sleep -Seconds 2
      $tries += 1
    }

    if (Test-NetConnection -ComputerName $CheckHost -Port $Port -InformationLevel Quiet) {
      Write-Output "Port $Port still in use on $CheckHost after wait; will retry loop." | Tee-Object -FilePath $logFile -Append
    } else {
      & "$NodePath" $AppFile 2>&1 | Tee-Object -FilePath $logFile -Append
    }
    Write-Output "Node process exited at $(Get-Date)" | Tee-Object -FilePath $logFile -Append
  } catch {
    Write-Output "Watcher error: $_" | Tee-Object -FilePath $logFile -Append
  }
  Write-Output "Restarting in 2s..." | Tee-Object -FilePath $logFile -Append
  Start-Sleep -Seconds 2
}

<#
  z-sync.ps1 - copies files uploaded on the Workspace Home dashboard ("File
  upload" card) into Z:\ on the company server.

  Why this script exists: a web page is not allowed to write into Z:\ by
  itself, so a file goes browser -> Supabase Storage (private bucket
  "dash-uploads") -> this script -> Z:\RugsUploads\<year>\<month>\.

  What one run does:
    1. asks the dash-upload function for files not copied yet
    2. downloads each one straight to Z:\ (into a .part file, then renames it)
    3. tells the function where it landed, so the dashboard shows "on Z:"
  A file that fails is reported back and retried on later runs; after 6 failed
  tries the function stops offering it, so a broken file never loops for ever.

  Run it by hand first:
      powershell -ExecutionPolicy Bypass -File "<this file>" -WhatIfOnly
  then without -WhatIfOnly, then let Task Scheduler run it every minute
  (see z-sync-setup.md).

  The secret key is NOT in this file and must never be put in it - this folder
  is pushed to GitHub. The script reads it from the RUGS_ZSYNC_KEY environment
  variable, or from the key file named below.
#>
[CmdletBinding()]
param(
  [string]$Dest    = 'Z:\RugsUploads',
  [string]$KeyFile = "$env:USERPROFILE\Desktop\Rugs upload key.txt",
  [int]   $Batch   = 25,
  [switch]$WhatIfOnly
)

$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$FN     = 'https://asbgfjngxsabnnzgxugu.supabase.co/functions/v1/dash-upload'
$ApiKey = 'sb_publishable_puw8o_XzDvXmitIaNZvCtQ_5UGjXTBB'   # public key, same one the website uses
$LogDir = Join-Path $env:ProgramData 'RugsUpload'
$LogFile = Join-Path $LogDir 'z-sync.log'

function Write-Log {
  param([string]$Text)
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Text
  Write-Output $line
  try {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
    if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 1MB) {
      Move-Item $LogFile ($LogFile + '.old') -Force
    }
    Add-Content -Path $LogFile -Value $line -Encoding utf8
  } catch {}
}

function Call-Api {
  param([hashtable]$Body)
  $json = $Body | ConvertTo-Json -Depth 5 -Compress
  return Invoke-RestMethod -Method Post -Uri $FN -TimeoutSec 120 `
    -Headers @{ apikey = $ApiKey; Authorization = 'Bearer ' + $ApiKey } `
    -ContentType 'application/json' -Body $json
}

# Only one run at a time: a slow download must not be joined by the next minute's run.
$mutex = New-Object System.Threading.Mutex($false, 'Global\RugsZSync')
if (-not $mutex.WaitOne(0)) { Write-Log 'another run is still going - skipping this one'; exit 0 }

try {
  # ---- the key ----------------------------------------------------------
  $key = $env:RUGS_ZSYNC_KEY
  if ([string]::IsNullOrWhiteSpace($key) -and (Test-Path $KeyFile)) {
    $key = (Get-Content $KeyFile -Raw).Trim()
  }
  if ([string]::IsNullOrWhiteSpace($key)) {
    Write-Log "NO KEY. Put the key in `"$KeyFile`" (one line), or set the RUGS_ZSYNC_KEY environment variable."
    exit 2
  }

  # ---- is the company server reachable? ---------------------------------
  $root = [System.IO.Path]::GetPathRoot($Dest)
  if (-not (Test-Path $root)) {
    Write-Log "$root is not available (drive not mapped, or the server is off) - nothing done, will try again next run."
    exit 0
  }
  if (-not (Test-Path $Dest)) {
    if ($WhatIfOnly) { Write-Log "would create $Dest" }
    else { New-Item -ItemType Directory -Force -Path $Dest | Out-Null; Write-Log "created $Dest" }
  }

  # ---- what is waiting? -------------------------------------------------
  $pending = Call-Api @{ action = 'pending'; sync_key = $key; limit = $Batch }
  if (-not $pending.ok) { Write-Log ('the server said: ' + $pending.error); exit 1 }
  $files = @($pending.data.files)
  if ($files.Count -eq 0) { Write-Log 'nothing new to copy'; exit 0 }
  Write-Log ("{0} file(s) to copy" -f $files.Count)

  $done = 0; $failed = 0
  foreach ($f in $files) {
    $name = $f.file_name
    try {
      # year\month folders, taken from the path the website stored it under
      $sub = ''
      if ($f.stored_path -match '^(\d{4})/(\d{2})/') { $sub = Join-Path $matches[1] $matches[2] }
      $folder = if ($sub) { Join-Path $Dest $sub } else { $Dest }

      # a safe Windows file name, and never overwrite something already there
      $safe = ($name -replace '[\\/:*?"<>|]', '_').Trim()
      if ([string]::IsNullOrWhiteSpace($safe)) { $safe = 'file' }
      $target = Join-Path $folder $safe
      if (Test-Path $target) {
        $base = [IO.Path]::GetFileNameWithoutExtension($safe)
        $ext  = [IO.Path]::GetExtension($safe)
        for ($i = 2; $i -lt 500; $i++) {
          $try = Join-Path $folder ("{0} ({1}){2}" -f $base, $i, $ext)
          if (-not (Test-Path $try)) { $target = $try; break }
        }
      }

      if ($WhatIfOnly) { Write-Log ("would copy: {0}  ->  {1}" -f $name, $target); continue }

      if (-not (Test-Path $folder)) { New-Item -ItemType Directory -Force -Path $folder | Out-Null }

      # download beside the target, then rename - so a half-finished file is
      # never left looking complete on Z:\
      $part = $target + '.part'
      Invoke-WebRequest -Uri $f.url -OutFile $part -TimeoutSec 600 -UseBasicParsing
      $got = (Get-Item $part).Length
      if ($f.size_bytes -and [int64]$f.size_bytes -ne [int64]$got) {
        Remove-Item $part -Force -ErrorAction SilentlyContinue
        throw ("size does not match (expected {0} bytes, got {1})" -f $f.size_bytes, $got)
      }
      Move-Item $part $target -Force

      $r = Call-Api @{ action = 'mark'; sync_key = $key; id = $f.id; z_path = $target }
      if (-not $r.ok) { Write-Log ("copied but could not tell the server: " + $r.error) }
      Write-Log ("copied: {0}  ->  {1}" -f $name, $target)
      $done++
    }
    catch {
      $msg = $_.Exception.Message
      $failed++
      Write-Log ("FAILED: {0}  -  {1}" -f $name, $msg)
      try { Call-Api @{ action = 'mark'; sync_key = $key; id = $f.id; error = $msg } | Out-Null } catch {}
    }
  }
  if (-not $WhatIfOnly) { Write-Log ("finished - {0} copied, {1} failed" -f $done, $failed) }
}
catch {
  Write-Log ('STOPPED: ' + $_.Exception.Message)
  exit 1
}
finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}

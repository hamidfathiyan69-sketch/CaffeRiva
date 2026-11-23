<#
.SYNOPSIS
  Finds and removes Visual Studio Code and only the files that belong to it
  (program files, extensions, user settings/cache, shortcuts, downloaded installers).

.DESCRIPTION
  Default mode is a DRY RUN: it only lists what would be removed and how much space it frees.
  Pass -Execute to actually delete, and you must type DELETE to confirm.
  Local AI model folders (Ollama, LM Studio, etc.) are always excluded.
  Personal files (Documents, Desktop files, Downloads other than VS Code installers) are never touched.

.PARAMETER Execute
  Actually delete the listed items after confirmation.

.PARAMETER IncludeWorkspaceSettings
  Also remove the per-user .vscode folders found under your profile (Documents, Desktop, etc.).
  Off by default because these can belong to your own projects.

.EXAMPLE
  .\Remove-VSCode.ps1               # dry run, shows the list only
  .\Remove-VSCode.ps1 -Execute      # deletes after you type DELETE
#>
[CmdletBinding()]
param(
    [switch]$Execute,
    [switch]$IncludeWorkspaceSettings
)

$ErrorActionPreference = 'Stop'

# ---------- Safety: paths that must never be deleted ----------
$protectedPatterns = @(
    '\\\.ollama(\\|$)', '\\\.lmstudio(\\|$)', '\\LM Studio(\\|$)', '\\lm-studio(\\|$)',
    '\\\.cache\\huggingface', '\\models?(\\|$)', '\\GPT4All(\\|$)', '\\Jan(\\|$)'
)
$protectedRoots = @($env:SystemRoot, $env:ProgramData) | Where-Object { $_ }

function Test-Protected([string]$Path) {
    foreach ($p in $protectedPatterns) { if ($Path -match $p) { return $true } }
    foreach ($r in $protectedRoots) { if ($Path -like "$r*" -and $Path -notlike '*Code*') { return $true } }
    return $false
}

# ---------- Collect targets ----------
$targets = New-Object System.Collections.Generic.List[object]

function Add-Target([string]$Path, [string]$Category) {
    if (-not $Path) { return }
    if (-not (Test-Path -LiteralPath $Path)) { return }
    if (Test-Protected $Path) { Write-Host "  [skip protected] $Path" -ForegroundColor DarkYellow; return }
    if ($targets | Where-Object { $_.Path -eq $Path }) { return }
    $size = 0
    try {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.PSIsContainer) {
            $size = (Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue |
                     Measure-Object -Property Length -Sum).Sum
        } else { $size = $item.Length }
    } catch {}
    $targets.Add([pscustomobject]@{ Category = $Category; Path = $Path; SizeMB = [math]::Round(([double]$size)/1MB, 2) })
}

# 1) Program installation folders
$installDirs = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code'),
    (Join-Path $env:ProgramFiles 'Microsoft VS Code'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft VS Code')
)
foreach ($d in $installDirs) { Add-Target $d 'Install' }

# 2) User data: settings, cache, logs, extensions, globalStorage
Add-Target (Join-Path $env:APPDATA 'Code') 'UserData'                     # settings, cache, logs
Add-Target (Join-Path $env:APPDATA 'Code - Insiders') 'UserData'
Add-Target (Join-Path $env:USERPROFILE '.vscode') 'Extensions'            # extensions (.vscode\extensions)
Add-Target (Join-Path $env:USERPROFILE '.vscode-insiders') 'Extensions'
Add-Target (Join-Path $env:LOCALAPPDATA 'Microsoft\VSCode') 'Cache'
Add-Target (Join-Path $env:LOCALAPPDATA 'code') 'Cache'

# 3) Shortcuts (Desktop, Start Menu, Startup) that point to VS Code
$shortcutDirs = @(
    [Environment]::GetFolderPath('Desktop'),
    [Environment]::GetFolderPath('CommonDesktopDirectory'),
    [Environment]::GetFolderPath('StartMenu'),
    [Environment]::GetFolderPath('CommonStartMenu'),
    [Environment]::GetFolderPath('Startup')
)
$wsh = New-Object -ComObject WScript.Shell
foreach ($dir in $shortcutDirs) {
    if (-not $dir -or -not (Test-Path $dir)) { continue }
    Get-ChildItem -LiteralPath $dir -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $sc = $wsh.CreateShortcut($_.FullName)
            if ($_.Name -match 'Visual Studio Code|VS Code' -or $sc.TargetPath -match 'Microsoft VS Code|\\Code\.exe') {
                Add-Target $_.FullName 'Shortcut'
            }
        } catch {}
    }
}

# 4) Installer and VSIX files in Downloads (only VS Code related names)
$downloads = Join-Path $env:USERPROFILE 'Downloads'
if (Test-Path $downloads) {
    Get-ChildItem -LiteralPath $downloads -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -match '^VSCode(User|System)?Setup.*\.exe$' -or
            ($_.Extension -eq '.vsix' -and $_.Name -match '^(vscode|ms-)')
        } |
        ForEach-Object { Add-Target $_.FullName 'Download' }
}

# 5) Per-project .vscode folders (optional)
if ($IncludeWorkspaceSettings) {
    foreach ($base in @('Documents', 'Desktop', 'Downloads', 'Source', 'Projects')) {
        $p = Join-Path $env:USERPROFILE $base
        if (Test-Path $p) {
            Get-ChildItem -LiteralPath $p -Directory -Recurse -Force -Depth 3 -Filter '.vscode' -ErrorAction SilentlyContinue |
                ForEach-Object { Add-Target $_.FullName 'Workspace' }
        }
    }
}

# ---------- Show report ----------
if ($targets.Count -eq 0) {
    Write-Host 'Nothing related to VS Code was found.' -ForegroundColor Green
    return
}

Write-Host ''
Write-Host 'Items found:' -ForegroundColor Cyan
$targets | Sort-Object Category, Path | Format-Table Category, SizeMB, Path -AutoSize -Wrap
$total = ($targets | Measure-Object SizeMB -Sum).Sum
Write-Host ("Total: {0} MB in {1} item(s)" -f [math]::Round($total,2), $targets.Count) -ForegroundColor Cyan

if (-not $Execute) {
    Write-Host ''
    Write-Host 'DRY RUN: nothing was deleted. Run with -Execute to delete.' -ForegroundColor Yellow
    return
}

# ---------- Uninstall official program first (if present) ----------
$uninstallers = Get-ChildItem -Path @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Microsoft VS Code'),
    (Join-Path $env:ProgramFiles 'Microsoft VS Code'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft VS Code')
) -Filter 'unins*.exe' -ErrorAction SilentlyContinue

Write-Host ''
$confirm = Read-Host 'Type DELETE to permanently remove the items above'
if ($confirm -cne 'DELETE') { Write-Host 'Cancelled.' -ForegroundColor Yellow; return }

foreach ($u in $uninstallers) {
    Write-Host "Running uninstaller: $($u.FullName)"
    Start-Process -FilePath $u.FullName -ArgumentList '/VERYSILENT', '/NORESTART' -Wait
}

foreach ($t in $targets) {
    if (-not (Test-Path -LiteralPath $t.Path)) { continue }   # the uninstaller may have removed it
    try {
        Remove-Item -LiteralPath $t.Path -Recurse -Force -ErrorAction Stop
        Write-Host "Removed: $($t.Path)" -ForegroundColor Green
    } catch {
        Write-Host "Failed:  $($t.Path) -> $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host 'Done. Restart Windows Explorer or sign out if shortcuts still appear.' -ForegroundColor Cyan

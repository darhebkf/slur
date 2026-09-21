param(
  [string[]]$Targets = @()
)

$ErrorActionPreference = "Stop"
$SlurRepo = if ($env:SLUR_GITHUB_REPO) { $env:SLUR_GITHUB_REPO } else { "darhebkf/slur" }
$LocalBin = Join-Path $HOME ".local/bin"
$CargoBin = Join-Path $HOME ".cargo/bin"
$PathEntries = $env:PATH -split ";"

if ($env:SLUR_INSTALL_ROOT) {
  $InstallRoot = $env:SLUR_INSTALL_ROOT
}
elseif ($PathEntries -contains $LocalBin) {
  $InstallRoot = Join-Path $HOME ".local"
}
elseif ($PathEntries -contains $CargoBin) {
  $InstallRoot = Join-Path $HOME ".cargo"
}
else {
  $InstallRoot = Join-Path $HOME ".local"
}

$Architecture = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "arm64" } else { "x64" }
$Asset = "slur-windows-$Architecture.zip"
$ReleaseUrl = "https://github.com/$SlurRepo/releases/latest/download"
$TemporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("slur-" + [System.Guid]::NewGuid().ToString("N"))
$Archive = Join-Path $TemporaryRoot $Asset
$ChecksumFile = "$Archive.sha256"
$BinaryDirectory = Join-Path $InstallRoot "bin"
$BinaryPath = Join-Path $BinaryDirectory "slur.exe"

New-Item -ItemType Directory -Force -Path $TemporaryRoot | Out-Null

try {
  Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseUrl/$Asset" -OutFile $Archive
  Invoke-WebRequest -UseBasicParsing -Uri "$ReleaseUrl/$Asset.sha256" -OutFile $ChecksumFile

  $Expected = ((Get-Content -Raw $ChecksumFile).Trim() -split "\s+")[0].ToLowerInvariant()
  $Actual = (Get-FileHash -Algorithm SHA256 $Archive).Hash.ToLowerInvariant()
  if (-not $Expected -or $Expected -ne $Actual) {
    throw "Release checksum verification failed."
  }

  $Extracted = Join-Path $TemporaryRoot "extracted"
  Expand-Archive -Force -Path $Archive -DestinationPath $Extracted
  New-Item -ItemType Directory -Force -Path $BinaryDirectory | Out-Null
  Copy-Item -Force (Join-Path $Extracted "slur.exe") $BinaryPath

  $SetupArguments = @("setup")
  if ($Targets.Count -eq 1 -and $Targets[0] -eq "all") {
    $SetupArguments += "--all"
  }
  elseif ($Targets.Count -gt 0) {
    $SetupArguments += $Targets
  }
  elseif ([Console]::IsInputRedirected -or [Console]::IsErrorRedirected) {
    $SetupArguments += "--yes"
  }

  & $BinaryPath @SetupArguments
  if ($LASTEXITCODE -ne 0) { throw "Harness setup failed." }

  if ($PathEntries -notcontains $BinaryDirectory) {
    Write-Warning "Add $BinaryDirectory to PATH before using /slur."
  }
}
finally {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $TemporaryRoot
}

$ErrorActionPreference = 'Stop'
$releaseRoot = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $releaseRoot 'release-manifest.json') -Raw | ConvertFrom-Json
foreach ($item in $manifest.environment.PSObject.Properties) { [Environment]::SetEnvironmentVariable($item.Name, [string]$item.Value, 'Process') }
foreach ($item in $manifest.binaries.PSObject.Properties) {
  $path = Join-Path $releaseRoot $item.Value.path
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing maintained binary $($item.Name)" }
  [Environment]::SetEnvironmentVariable($item.Value.env, $path, 'Process')
}
$env:NODE = Join-Path $releaseRoot $manifest.node.path
if ($env:CAVEMAN_NATIVE_PROFILE -notin @('record-only','core','core-lean-build','ledger','ccr-masking','cache-aware','full-safe')) {
  $env:CAVEMAN_NATIVE_PROFILE = if ($env:CAVEMAN_WRAP_MODE -in @('record','off') -or $env:CAVEMAN_NATIVE_MODE -eq 'record') {'record-only'} else {'full-safe'}
}
$env:CAVEMAN_NATIVE_MODE = if ($env:CAVEMAN_NATIVE_PROFILE -eq 'record-only') {'record'} else {'safe'}
if ($env:CAVEMAN_WRAP_MODE -eq 'pixel') { $env:CAVEMAN_WRAP_MODE = 'compress' }
& $env:CAVEMAN_PROXY_BIN native-hook codex --adapter (Join-Path $releaseRoot 'cli/dist/native-hook-fast.js')
exit $LASTEXITCODE

param([Parameter(ValueFromRemainingArguments=$true)][string[]]$CavemanArgs)
$ErrorActionPreference = 'Stop'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'release-manifest.json') -Raw | ConvertFrom-Json
& (Join-Path $PSScriptRoot $manifest.node.path) (Join-Path $PSScriptRoot $manifest.cli) @CavemanArgs
exit $LASTEXITCODE

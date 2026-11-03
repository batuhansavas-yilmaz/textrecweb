$ErrorActionPreference = 'Stop'

$bucket = 'textrec-models'
$root = Split-Path -Parent $PSScriptRoot
$dirs = @('vendor/paddleocr/models', 'vendor/paddleocr/ort')

foreach ($rel in $dirs) {
  $dir = Join-Path $root $rel
  Get-ChildItem -LiteralPath $dir -File -Recurse | ForEach-Object {
    $key = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
    Write-Host "Uploading $key"
    npx --yes wrangler@4 r2 object put "$bucket/$key" --file $_.FullName --remote
    if ($LASTEXITCODE -ne 0) { throw "Upload failed: $key" }
  }
}

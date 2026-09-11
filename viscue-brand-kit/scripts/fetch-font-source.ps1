$fontUrl = 'https://raw.githubusercontent.com/Instrument/instrument-sans/master/fonts/variable/InstrumentSans%5Bwdth%2Cwght%5D.ttf'
$licenseUrl = 'https://raw.githubusercontent.com/Instrument/instrument-sans/master/OFL.txt'
$fontHashExpected = 'B24F1812584816958AFCF22E22D08E44318C5E51651E25D2438EFDDE389B33B1'
$licenseHashExpected = '9E27A72ED30EB49A08678F6A5D6ED98EC7BA5368F541637EE0683EC9134EF966'

$baseDir = Join-Path $PSScriptRoot "..\font\source\upstream"
if (-not (Test-Path $baseDir)) { New-Item -ItemType Directory -Force -Path $baseDir | Out-Null }

$fontPath = Join-Path $baseDir "InstrumentSans[wdth,wght].ttf"
$licensePath = Join-Path $baseDir "OFL.txt"

$fontDownloadPath = "$fontPath.download"
$licenseDownloadPath = "$licensePath.download"

$tempFontDownloadPath = Join-Path $baseDir "temp.ttf"
$tempLicenseDownloadPath = Join-Path $baseDir "temp.txt"

Write-Host "Downloading upstream font..."
Invoke-WebRequest -Uri $fontUrl -OutFile $tempFontDownloadPath

Write-Host "Downloading upstream license..."
Invoke-WebRequest -Uri $licenseUrl -OutFile $tempLicenseDownloadPath

function Get-FileSha256($path) {
    return (Get-FileHash -Path $path -Algorithm SHA256).Hash
}

$fontHashActual = Get-FileSha256 $tempFontDownloadPath
$licenseHashActual = Get-FileSha256 $tempLicenseDownloadPath

if ($fontHashActual -ne $fontHashExpected) {
    Write-Error "Font hash mismatch! Expected $fontHashExpected but got $fontHashActual"
    Remove-Item $tempFontDownloadPath
    exit 1
}

if ($licenseHashActual -ne $licenseHashExpected) {
    Write-Error "License hash mismatch! Expected $licenseHashExpected but got $licenseHashActual"
    Remove-Item $tempLicenseDownloadPath
    exit 1
}

Move-Item -LiteralPath $tempFontDownloadPath -Destination $fontPath -Force
Move-Item -LiteralPath $tempLicenseDownloadPath -Destination $licensePath -Force

Write-Host "Successfully verified and fetched upstream sources."

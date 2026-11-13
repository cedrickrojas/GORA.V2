# Recreate launcher resources from the supplied GORA artwork on Windows.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$mobileRoot = Split-Path -Parent $PSScriptRoot
$resourceRoot = Join-Path $mobileRoot 'android/app/src/main/res'
$source = [System.Drawing.Image]::FromFile((Join-Path $mobileRoot 'resources/android-icon.png'))

function Write-LauncherIcon([string]$Path, [int]$Size, [int]$ArtworkSize, [bool]$Round) {
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        if ($Round) {
            $clip.AddEllipse(0, 0, $Size, $Size)
            $graphics.SetClip($clip)
        }
        $offset = ($Size - $ArtworkSize) / 2
        $graphics.DrawImage($source, $offset, $offset, $ArtworkSize, $ArtworkSize)
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $clip.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    foreach ($density in @(
        @{ Name = 'mdpi'; Scale = 1 },
        @{ Name = 'hdpi'; Scale = 1.5 },
        @{ Name = 'xhdpi'; Scale = 2 },
        @{ Name = 'xxhdpi'; Scale = 3 },
        @{ Name = 'xxxhdpi'; Scale = 4 }
    )) {
        $directory = Join-Path $resourceRoot ('mipmap-' + $density.Name)
        $legacySize = [int](48 * $density.Scale)
        Write-LauncherIcon (Join-Path $directory 'ic_launcher.png') $legacySize $legacySize $false
        Write-LauncherIcon (Join-Path $directory 'ic_launcher_round.png') $legacySize $legacySize $true
        # Leave room for launcher masks and motion without clipping the GORA wordmark.
        Write-LauncherIcon (Join-Path $directory 'ic_launcher_foreground.png') ([int](108 * $density.Scale)) ([int](80 * $density.Scale)) $false
    }
} finally {
    $source.Dispose()
}
Write-Output 'Generated GORA launcher icons for all five Android densities.'

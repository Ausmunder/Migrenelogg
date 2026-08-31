<#
    Generates the PWA icons with System.Drawing so the project needs no
    image editor and no binary assets in version control.

        powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1

    The glyph is a pain curve: a calm baseline broken by one sharp spike.
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'icons'
if (-not (Test-Path -LiteralPath $outDir)) {
    New-Item -ItemType Directory -Path $outDir | Out-Null
}

function New-AppIcon {
    param(
        [int]$Size,
        [double]$GlyphScale,
        [string]$Path
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    $rect = New-Object System.Drawing.Rectangle(0, 0, $Size, $Size)
    $from = [System.Drawing.ColorTranslator]::FromHtml('#6C5CE7')
    $to = [System.Drawing.ColorTranslator]::FromHtml('#43349E')
    $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $from, $to, 55.0)
    $g.FillRectangle($background, $rect)

    # One unit = 1/512 of the canvas, scaled by GlyphScale.
    $u = ($Size / 512.0) * $GlyphScale
    $cx = $Size / 2.0
    $cy = $Size / 2.0
    $white = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)

    $pen = New-Object System.Drawing.Pen($white, [single](30.0 * $u))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    # A pain curve: a calm baseline broken by one dominant spike. Offsets are
    # relative to the centre and vertically balanced around it.
    $offsets = @(
        @(-160, 70), @(-106, 70), @(-71, 35), @(-41, 70), @(0, -100),
        @(39, 100), @(74, 45), @(109, 70), @(160, 70)
    )

    $points = foreach ($offset in $offsets) {
        New-Object System.Drawing.PointF(
            [single]($cx + $offset[0] * $u),
            [single]($cy + $offset[1] * $u))
    }

    $g.DrawLines($pen, [System.Drawing.PointF[]]$points)

    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

    $pen.Dispose()

    $background.Dispose()
    $g.Dispose()
    $bitmap.Dispose()

    Write-Host ("  wrote {0}" -f (Split-Path -Leaf $Path))
}

New-AppIcon -Size 512 -GlyphScale 1.0 -Path (Join-Path $outDir 'icon-512.png')
New-AppIcon -Size 192 -GlyphScale 1.0 -Path (Join-Path $outDir 'icon-192.png')
New-AppIcon -Size 180 -GlyphScale 1.0 -Path (Join-Path $outDir 'apple-touch-icon-180.png')
# Maskable icons must keep their content inside the central 80% safe zone.
New-AppIcon -Size 512 -GlyphScale 0.72 -Path (Join-Path $outDir 'icon-512-maskable.png')

Write-Host "Done."

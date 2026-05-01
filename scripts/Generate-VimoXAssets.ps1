Add-Type -AssemblyName System.Drawing

function New-Canvas($width, $height) {
    $bitmap = New-Object System.Drawing.Bitmap $width, $height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::FromArgb(255, 10, 10, 15))
    return @($bitmap, $graphics)
}

function New-Pen($hex, $width, $alpha = 255) {
    $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
    return New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, $r, $g, $b)), $width
}

function New-Brush($hex, $alpha = 255) {
    $r = [Convert]::ToInt32($hex.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($hex.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($hex.Substring(4, 2), 16)
    return New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
}

function Draw-VimoXMark($g, $x, $y, $s) {
    $red = "FF2D2D"
    $blue = "00A3FF"
    $blackBrush = New-Brush "05050A" 245

    for ($i = 42; $i -ge 8; $i -= 8) {
        $alpha = [Math]::Max(18, 72 - $i)
        $glowRed = New-Pen $red $i $alpha
        $glowBlue = New-Pen $blue $i $alpha
        $g.DrawArc($glowRed, $x + $s * 0.12, $y + $s * 0.12, $s * 0.76, $s * 0.76, 132, 172)
        $g.DrawArc($glowBlue, $x + $s * 0.12, $y + $s * 0.12, $s * 0.76, $s * 0.76, -55, 185)
    }

    $bubble = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bubble.AddEllipse($x + $s * 0.13, $y + $s * 0.12, $s * 0.74, $s * 0.70)
    $tail = @(
        [System.Drawing.PointF]::new($x + $s * 0.25, $y + $s * 0.72),
        [System.Drawing.PointF]::new($x + $s * 0.08, $y + $s * 0.93),
        [System.Drawing.PointF]::new($x + $s * 0.34, $y + $s * 0.79)
    )
    $bubble.AddPolygon($tail)
    $g.FillPath($blackBrush, $bubble)

    $ringRed = New-Pen $red ($s * 0.035) 255
    $ringBlue = New-Pen $blue ($s * 0.035) 255
    $g.DrawArc($ringRed, $x + $s * 0.13, $y + $s * 0.12, $s * 0.74, $s * 0.70, 132, 177)
    $g.DrawArc($ringBlue, $x + $s * 0.13, $y + $s * 0.12, $s * 0.74, $s * 0.70, -52, 184)
    $g.DrawLines($ringRed, @(
        [System.Drawing.PointF]::new($x + $s * 0.25, $y + $s * 0.72),
        [System.Drawing.PointF]::new($x + $s * 0.08, $y + $s * 0.93),
        [System.Drawing.PointF]::new($x + $s * 0.34, $y + $s * 0.79)
    ))

    $left = @(
        [System.Drawing.PointF]::new($x + $s * 0.32, $y + $s * 0.30),
        [System.Drawing.PointF]::new($x + $s * 0.47, $y + $s * 0.39),
        [System.Drawing.PointF]::new($x + $s * 0.56, $y + $s * 0.78),
        [System.Drawing.PointF]::new($x + $s * 0.48, $y + $s * 0.70)
    )
    $right = @(
        [System.Drawing.PointF]::new($x + $s * 0.72, $y + $s * 0.31),
        [System.Drawing.PointF]::new($x + $s * 0.57, $y + $s * 0.40),
        [System.Drawing.PointF]::new($x + $s * 0.47, $y + $s * 0.79),
        [System.Drawing.PointF]::new($x + $s * 0.58, $y + $s * 0.68)
    )
    $g.FillPolygon((New-Brush $red 235), $left)
    $g.FillPolygon((New-Brush $blue 235), $right)
    $g.DrawPolygon((New-Pen "FFCACA" ($s * 0.012) 255), $left)
    $g.DrawPolygon((New-Pen "BDEFFF" ($s * 0.012) 255), $right)
}

function Draw-Wordmark($g, $x, $y, $size) {
    $font = New-Object System.Drawing.Font "Arial", $size, ([System.Drawing.FontStyle]::Bold)
    $blueBrush = New-Brush "D7F3FF"
    $redBrush = New-Brush "FF2D2D"
    $glowBlue = New-Brush "00A3FF" 55
    $glowRed = New-Brush "FF2D2D" 75
    $g.DrawString("Vimo", $font, $glowBlue, $x - 2, $y - 2)
    $g.DrawString("Vimo", $font, $blueBrush, $x, $y)
    $measure = $g.MeasureString("Vimo", $font)
    $g.DrawString("X", $font, $glowRed, $x + $measure.Width - 8, $y - 2)
    $g.DrawString("X", $font, $redBrush, $x + $measure.Width - 8, $y)
}

$assets = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\assets"))
New-Item -ItemType Directory -Force -Path $assets | Out-Null
Remove-Item -Path (Join-Path $assets "icon.png") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $assets "adaptive-icon.png") -Force -ErrorAction SilentlyContinue
Remove-Item -Path (Join-Path $assets "splash.png") -Force -ErrorAction SilentlyContinue

$icon = New-Canvas 1024 1024
$bitmap = $icon[0]
$g = $icon[1]
Draw-VimoXMark $g 82 70 860
Draw-Wordmark $g 230 760 118
$bitmap.Save((Join-Path $assets "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bitmap.Save((Join-Path $assets "adaptive-icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()

$splash = New-Canvas 1242 2436
$bitmap = $splash[0]
$g = $splash[1]
Draw-VimoXMark $g 191 460 860
Draw-Wordmark $g 265 1280 142
$tagFont = New-Object System.Drawing.Font "Arial", 36, ([System.Drawing.FontStyle]::Bold)
$g.DrawString("TALK. CONNECT. ANYWHERE.", $tagFont, (New-Brush "00A3FF"), 310, 1460)
$bitmap.Save((Join-Path $assets "splash.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bitmap.Dispose()

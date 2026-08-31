<#
    Minimal static file server for local development.

    Service workers and ES modules both require an http(s) origin, so opening
    index.html directly from the file system will not work. Run this instead:

        powershell -ExecutionPolicy Bypass -File tools\serve.ps1

    Then open http://localhost:8080/ in a browser. Ctrl+C stops the server.
#>

param(
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$mime = @{
    '.html'        = 'text/html; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.mjs'         = 'text/javascript; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.png'         = 'image/png'
    '.svg'         = 'image/svg+xml'
    '.ico'         = 'image/x-icon'
    '.txt'         = 'text/plain; charset=utf-8'
    '.md'          = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "Could not listen on port $Port. Is something else using it?" -ForegroundColor Red
    throw
}

Write-Host ""
Write-Host "  Migrenelogg dev server" -ForegroundColor Cyan
Write-Host "  Serving : $root"
Write-Host "  URL     : http://localhost:$Port/"
Write-Host "  Stop    : Ctrl+C"
Write-Host ""

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
    } catch {
        break
    }

    $request = $context.Request
    $response = $context.Response

    try {
        $relative = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath).TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
        $relative = $relative -replace '/', '\'

        $candidate = Join-Path $root $relative
        if (Test-Path -LiteralPath $candidate -PathType Container) {
            $candidate = Join-Path $candidate 'index.html'
        }

        $full = $null
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            $full = (Resolve-Path -LiteralPath $candidate).Path
        }

        # Refuse anything that escapes the project folder.
        if ($full -and -not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
            $full = $null
        }

        if ($full) {
            $extension = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
            $type = $mime[$extension]
            if (-not $type) { $type = 'application/octet-stream' }

            $bytes = [System.IO.File]::ReadAllBytes($full)
            $response.StatusCode = 200
            $response.ContentType = $type
            # No caching, so an edit shows up on the next reload.
            $response.Headers.Add('Cache-Control', 'no-store, must-revalidate')
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host ("  200  /{0}" -f $relative.Replace('\', '/'))
        } else {
            $body = [System.Text.Encoding]::UTF8.GetBytes('404 - not found')
            $response.StatusCode = 404
            $response.ContentType = 'text/plain; charset=utf-8'
            $response.ContentLength64 = $body.Length
            $response.OutputStream.Write($body, 0, $body.Length)
            Write-Host ("  404  /{0}" -f $relative.Replace('\', '/')) -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host ("  500  {0}" -f $_.Exception.Message) -ForegroundColor Red
        try { $response.StatusCode = 500 } catch { }
    } finally {
        try { $response.OutputStream.Close() } catch { }
    }
}

$listener.Stop()
$listener.Close()

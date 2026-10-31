# Relie ce projet à TON compte Expo (EAS), à partir de l'identifiant du projet.
# À faire une seule fois (voir BUILD-EAS.md, section 2). L'identifiant est écrit dans « eas-project.json » :
# ce fichier n'est jamais écrasé par un pack, et il est envoyé aux builds EAS avec le reste du projet.
# Usage, à la racine du projet :
#   powershell -ExecutionPolicy Bypass -File scripts\link-eas.ps1 -Id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
param([Parameter(Mandatory = $true)][string]$Id)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$root = (Get-Location).Path
if (-not (Test-Path (Join-Path $root "app.config.ts"))) {
  Write-Host "app.config.ts introuvable dans $root." -ForegroundColor Red
  Write-Host "Place-toi dans le dossier du projet, puis relance." -ForegroundColor Red
  exit 1
}
$guid = [guid]::Empty
if (-not [guid]::TryParse($Id.Trim().Trim('"').Trim("'"), [ref]$guid)) {
  Write-Host "Cet identifiant n'a pas la bonne forme. Il ressemble a : 12345678-abcd-1234-abcd-1234567890ab" -ForegroundColor Red
  Write-Host "Copie-le en entier depuis le message de « eas init » (ou depuis expo.dev)." -ForegroundColor Red
  exit 1
}
$file = Join-Path $root "eas-project.json"
$json = "{`n  `"projectId`": `"$($guid.ToString())`"`n}`n"
# UTF-8 sans BOM
[System.IO.File]::WriteAllText($file, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "eas-project.json ecrit (projet $($guid.ToString()))." -ForegroundColor Green
Write-Host "Verification aupres d'Expo..." -ForegroundColor Cyan
$out = (& npx --yes eas-cli@latest project:info 2>&1 | ForEach-Object { "$_" }) -join "`n"
if ($LASTEXITCODE -eq 0) {
  Write-Host $out.Trim()
  Write-Host ""
  Write-Host "OK : le projet est relie a ton compte. Etape suivante : scripts\push-env.ps1" -ForegroundColor Cyan
  exit 0
}
$detail = (($out -split "`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 3) -join " | "
Write-Host "ECHEC : $detail" -ForegroundColor Red
if ($out -match "(?i)not authorized|permission") {
  # Un identifiant inutilisable ne doit pas rester : il gênerait « eas init »
  Remove-Item $file -Force -ErrorAction SilentlyContinue
  Write-Host "Ton compte n'a pas acces a ce projet : il appartient a un autre compte Expo." -ForegroundColor Yellow
  Write-Host "J'ai retire eas-project.json pour ne pas garder un identifiant inutilisable." -ForegroundColor Yellow
  Write-Host "Cree un projet sous ton compte avec :  npx eas-cli@latest init   puis relance ce script avec le nouvel identifiant." -ForegroundColor Yellow
}
exit 1

# Envoie les variables EXPO_PUBLIC_* de ton fichier .env vers EAS.
# Pourquoi : un build EAS est construit sur les serveurs d'Expo, qui n'ont PAS ton fichier .env (il est ignoré par
# git). Sans ces variables, l'app construite ne trouve pas sa configuration Firebase et plante au démarrage.
# À relancer chaque fois que tu changes une valeur dans .env. Les valeurs ne sont jamais affichées.
# Utilise toujours la DERNIÈRE version de l'outil EAS (une ancienne version en cache ne connaît pas « env:set »).
# Usage, à la racine du projet :
#   powershell -ExecutionPolicy Bypass -File scripts\push-env.ps1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$envFile = Join-Path (Get-Location).Path ".env"
if (-not (Test-Path $envFile)) {
  Write-Host "Fichier .env introuvable dans $((Get-Location).Path)." -ForegroundColor Red
  Write-Host "Place-toi dans le dossier du projet (celui qui contient .env), puis relance." -ForegroundColor Red
  exit 1
}
$eas = @("--yes", "eas-cli@latest")
& npx @eas whoami *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Tu n'es pas connecte a Expo (ou ton jeton EXPO_TOKEN n'est plus valide)." -ForegroundColor Yellow
  Write-Host "  1) Verifie :        npx eas-cli@latest whoami" -ForegroundColor Yellow
  Write-Host "  2) Si pas connecte : npx eas-cli@latest login" -ForegroundColor Yellow
  Write-Host "  3) Si un message parle de EXPO_TOKEN : lis la section 2 de BUILD-EAS.md" -ForegroundColor Yellow
  exit 1
}
# Le projet EAS doit etre relie a TON compte (sinon Expo refuse : « Entity Not Authorized »)
& npx @eas project:info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Ton projet n'est pas relie a ton compte Expo (ou il n'existe pas encore)." -ForegroundColor Yellow
  Write-Host "  -> section 2 de BUILD-EAS.md :  npx eas-cli@latest init   puis   scripts\link-eas.ps1" -ForegroundColor Yellow
  exit 1
}
$sent = @(); $failed = @(); $empty = 0; $other = 0; $streak = 0
foreach ($raw in (Get-Content $envFile -Encoding UTF8)) {
  $line = $raw.Trim()
  if ($line -eq "" -or $line.StartsWith("#")) { continue }
  $i = $line.IndexOf("=")
  if ($i -lt 1) { continue }
  $name = $line.Substring(0, $i).Trim()
  $value = $line.Substring($i + 1).Trim()
  if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  # Seules les variables EXPO_PUBLIC_ sont lues par l'app
  if (-not $name.StartsWith("EXPO_PUBLIC_")) { $other++; continue }
  if ($value -eq "") { $empty++; continue }
  $cliArgs = $eas + @("env:set", "--name", $name, "--value", $value, "--visibility", "plaintext", "--non-interactive",
                      "--environment", "development", "--environment", "preview", "--environment", "production")
  # Chaque ligne d'erreur est convertie en texte simple (sinon Windows PowerShell affiche un gros bloc rouge illisible)
  $out = (& npx @cliArgs 2>&1 | ForEach-Object { "$_" }) -join "`n"
  if ($LASTEXITCODE -eq 0) {
    $sent += $name
    $streak = 0
    Write-Host "  envoye : $name" -ForegroundColor Green
  } else {
    $failed += $name
    $streak++
    Write-Host "  ECHEC  : $name" -ForegroundColor Red
    $detail = (($out.Replace($value, "***") -split "`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -Last 3) -join " | "
    Write-Host "    $detail" -ForegroundColor DarkGray
    if ($streak -ge 3) {
      Write-Host ""
      Write-Host "3 echecs de suite : j'arrete pour ne pas repeter la meme erreur." -ForegroundColor Yellow
      if ($out -match "not found") { Write-Host "Ton outil EAS est trop ancien. Essaie :  npm install -g eas-cli   puis relance ce script." -ForegroundColor Yellow }
      break
    }
  }
}
Write-Host ""
Write-Host "$($sent.Count) variable(s) envoyee(s) a EAS, $empty vide(s) ignoree(s) (paiements et pubs : a remplir plus tard), $other autre(s) ignoree(s)." -ForegroundColor Cyan
if ($failed.Count -gt 0) {
  Write-Host "$($failed.Count) echec(s) : $($failed -join ', ')" -ForegroundColor Yellow
  exit 1
}
Write-Host "Verifie avec :  npx eas-cli@latest env:list --environment development" -ForegroundColor Cyan

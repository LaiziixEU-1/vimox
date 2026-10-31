// Envoie les réglages de ton fichier .env vers Expo (EAS), pour que la version FABRIQUÉE par Expo les contienne.
// POURQUOI : le fichier .env reste sur ton ordinateur ; Expo fabrique l'app sur ses serveurs et ne le reçoit pas.
// Sans cet envoi, la version publiée n'aurait aucune clé Firebase et ne démarrerait pas.
//
// Utilisation (à la racine du projet) :
//   node scripts/push-env-to-eas.mjs            → SIMULATION : affiche ce qui serait envoyé, n'envoie rien
//   node scripts/push-env-to-eas.mjs --apply    → envoie vraiment (production ET preview)
//   node scripts/push-env-to-eas.mjs --apply --env production   → un seul environnement
// Il faut d'abord être connecté : npx eas-cli@latest login
//
// Seules les variables EXPO_PUBLIC_* sont envoyées : elles sont publiques par construction (elles finissent dans l'app).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = process.env.VIMOX_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const envIdx = args.indexOf("--env");
const environments = envIdx >= 0 && args[envIdx + 1] ? [args[envIdx + 1]] : ["production", "preview"];
const REQUIRED = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
];

function readEnv() {
  const vars = {};
  let text = "";
  try {
    text = fs.readFileSync(path.join(root, ".env"), "utf8");
  } catch {
    console.error("✗ Fichier .env introuvable à la racine du projet.");
    process.exit(1);
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return vars;
}

const mask = (v) => (v.length <= 8 ? "•".repeat(v.length) : v.slice(0, 4) + "…" + v.slice(-2));
const all = readEnv();
const toSend = Object.entries(all).filter(([k, v]) => k.startsWith("EXPO_PUBLIC_") && v !== "");
const empty = Object.entries(all).filter(([k, v]) => k.startsWith("EXPO_PUBLIC_") && v === "").map(([k]) => k);
const ignored = Object.keys(all).filter((k) => !k.startsWith("EXPO_PUBLIC_"));

const missing = REQUIRED.filter((k) => !toSend.some(([key]) => key === k));
if (missing.length) {
  console.error("✗ Réglages Firebase manquants ou vides dans .env :\n   " + missing.join("\n   "));
  console.error("  L'application ne démarrerait pas. Complète le fichier .env puis relance.");
  process.exit(1);
}

// eas.json : chaque profil doit lire l'environnement correspondant
try {
  const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
  for (const env of environments) {
    const ok = Object.values(eas.build ?? {}).some((p) => p?.environment === env);
    if (!ok) console.warn(`⚠ Aucun profil de eas.json n'utilise l'environnement « ${env} » : ajoute "environment": "${env}" au profil.`);
  }
} catch {
  console.warn("⚠ eas.json illisible : vérifie-le.");
}

console.log(apply ? "ENVOI vers Expo :" : "SIMULATION (rien n'est envoyé ; ajoute --apply pour envoyer) :");
console.log(`  environnements : ${environments.join(", ")}`);
for (const [k, v] of toSend) console.log(`  ✓ ${k.padEnd(44)} ${mask(v)}`);
if (empty.length) console.log(`  – vides, ignorées : ${empty.join(", ")}`);
if (ignored.length) console.log(`  – non publiques, jamais envoyées : ${ignored.join(", ")}`);

if (!apply) process.exit(0);

const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const run = (sub, name, value, env) =>
  spawnSync(NPX, ["--yes", "eas-cli@latest", sub, "--name", name, "--value", value, "--environment", env, "--visibility", "plaintext", "--non-interactive"], { encoding: "utf8", cwd: root });

let failures = 0;
for (const env of environments) {
  for (const [name, value] of toSend) {
    let r = run("env:create", name, value, env);
    let how = "créée";
    if (r.status !== 0) {
      r = run("env:update", name, value, env); // elle existe déjà : on la met à jour
      how = "mise à jour";
    }
    if (r.status === 0) console.log(`  ✓ ${env.padEnd(11)} ${name} ${how}`);
    else {
      failures++;
      console.error(`  ✗ ${env.padEnd(11)} ${name} : ${(r.stderr || r.stdout || "échec").trim().split("\n").slice(-2).join(" ")}`);
    }
  }
}
console.log(failures ? `\n${failures} échec(s) : es-tu connecté (npx eas-cli@latest login) ?` : "\nTerminé. Vérifie avec : npx eas-cli@latest env:list --environment production");
process.exit(failures ? 1 : 0);

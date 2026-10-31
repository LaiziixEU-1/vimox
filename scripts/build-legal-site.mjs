// Fabrique le petit site web (dossier « site/ ») avec la politique de confidentialité, les conditions
// et la page d'assistance : l'App Store exige une ADRESSE WEB pour la politique de confidentialité et
// pour le support. Source unique : src/config/legalContent.json (la même que dans l'application).
//
// Utilisation (à la racine du projet) :   node scripts/build-legal-site.mjs
// Les infos de l'éditeur sont lues dans ton fichier .env (EXPO_PUBLIC_EDITOR_NAME, …).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !line.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
  return { ...env, ...process.env };
}

const env = readEnv();
const TODO = "[à compléter avant la publication]";
const shown = (v) => (v && v.trim() ? v.trim() : TODO);
const V = {
  editorName: env.EXPO_PUBLIC_EDITOR_NAME ?? "",
  editorAddress: env.EXPO_PUBLIC_EDITOR_ADDRESS ?? "",
  supportEmail: env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "",
  privacyEmail: env.EXPO_PUBLIC_PRIVACY_EMAIL || env.EXPO_PUBLIC_SUPPORT_EMAIL || "",
  governingLaw: env.EXPO_PUBLIC_GOVERNING_LAW ?? "",
};
// Même remplissage que fillLegal() dans src/config/legal.ts
const fill = (t) =>
  t
    .replace(/\{\{EDITOR\}\}/g, `${shown(V.editorName)}, ${shown(V.editorAddress)}`)
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, shown(V.supportEmail))
    .replace(/\{\{PRIVACY_EMAIL\}\}/g, shown(V.privacyEmail))
    .replace(/\{\{GOVERNING_LAW\}\}/g, shown(V.governingLaw))
    .replace(/\{\{TODO\}\}/g, TODO);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Texte → HTML : lignes « • … » en liste, lignes vides en paragraphes
function bodyToHtml(body) {
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push("<ul>" + list.map((x) => `<li>${x}</li>`).join("") + "</ul>"); list = []; } };
  for (const line of fill(body).split("\n")) {
    if (line.startsWith("• ")) { list.push(esc(line.slice(2))); continue; }
    flush();
    if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  flush();
  return out.join("\n");
}

const CSS = `
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0f0f0e;color:#f2f0ec;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:760px;margin:0 auto;padding:32px 20px 80px}
header{display:flex;align-items:center;gap:12px;margin-bottom:8px}
header a{color:#f2f0ec;text-decoration:none;font-weight:800;font-size:22px;letter-spacing:.5px}
header span{color:#b4384d}
nav{display:flex;gap:16px;flex-wrap:wrap;margin:6px 0 28px;font-size:14px}
nav a{color:#c9b98c}
h1{font-size:28px;margin:12px 0 4px}
h2{font-size:18px;margin:28px 0 6px;color:#c9b98c}
p,li{color:#d8d4cc}
ul{padding-left:20px}
.upd{color:#8d887d;font-size:14px;margin-top:0}
.card{background:#1a1917;border:1px solid #2c2a26;border-radius:14px;padding:14px 18px;margin:14px 0}
a{color:#e87a8c}
footer{margin-top:48px;color:#8d887d;font-size:13px}
`;

function page(title, inner) {
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · VimoX</title>
<meta name="robots" content="index,follow">
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<header><a href="index.html">Vimo<span>X</span></a></header>
<nav><a href="privacy.html">Confidentialité</a><a href="terms.html">Conditions d'utilisation</a><a href="support.html">Assistance</a></nav>
${inner}
<footer>© VimoX — ${esc(shown(V.editorName))}</footer>
</main>
</body>
</html>
`;
}

const content = JSON.parse(fs.readFileSync(path.join(root, "src/config/legalContent.json"), "utf8"));
const sections = (items) => items.map((s) => `<h2>${esc(s.title)}</h2>\n${bodyToHtml(s.body)}`).join("\n");

const pages = {
  "index.html": page("Accueil", `
<h1>VimoX</h1>
<p>Discute, joue et partage avec des amis et de nouvelles rencontres. Application réservée aux personnes de 16 ans et plus.</p>
<div class="card"><p><a href="privacy.html">Politique de confidentialité</a><br><a href="terms.html">Conditions d'utilisation</a><br><a href="support.html">Assistance et contact</a></p></div>`),
  "privacy.html": page("Politique de confidentialité", `<h1>Politique de confidentialité</h1>\n<p class="upd">${esc(content.updated)}</p>\n${sections(content.privacy)}`),
  "terms.html": page("Conditions d'utilisation", `<h1>Conditions d'utilisation</h1>\n<p class="upd">${esc(content.updated)}</p>\n${sections(content.cgu)}`),
  "support.html": page("Assistance", `
<h1>Assistance et contact</h1>
<div class="card"><p><strong>Nous écrire :</strong> ${esc(shown(V.supportEmail))}</p></div>
<h2>Signaler un contenu ou une personne</h2>
<p>Dans l'application, ouvre le menu ⋯ d'une conversation, d'une story ou d'un profil, puis « Signaler » ou « Bloquer ». Nous examinons chaque signalement et agissons si les règles ne sont pas respectées.</p>
<h2>Supprimer mon compte</h2>
<p>Dans l'application : Profil &gt; Paramètres &gt; Supprimer mon compte. Ton profil, tes messages, tes stories, tes souvenirs et tes amis sont alors supprimés de notre base.</p>
<h2>Télécharger mes données</h2>
<p>Dans l'application : Profil &gt; Paramètres &gt; Confidentialité &gt; Télécharger mes données.</p>
<h2>Contester une suspension</h2>
<p>Écris-nous à l'adresse ci-dessus en indiquant l'adresse e-mail de ton compte : nous réexaminons ta situation.</p>
<h2>Données personnelles</h2>
<p>Pour toute question ou demande sur tes données : ${esc(shown(V.privacyEmail))}. Voir aussi la <a href="privacy.html">politique de confidentialité</a>.</p>`),
};

const out = path.join(root, "site");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "style.css"), CSS.trim() + "\n");
for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(out, name), html);
const missing = [V.editorName, V.editorAddress, V.supportEmail, V.governingLaw].filter((x) => !x.trim()).length;
console.log(`Site fabriqué dans « site/ » : ${Object.keys(pages).length} pages.`);
console.log(missing ? `⚠ ${missing} information(s) de l'éditeur manquante(s) dans .env : les pages affichent « ${TODO} ».` : "✓ Informations de l'éditeur complètes.");

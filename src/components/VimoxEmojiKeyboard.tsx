import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

// Seulement la liste des emojis (les composants du module « rn-emoji-keyboard » utilisent
// InteractionManager, supprimé de React Native 0.88 / SDK 58 : ils faisaient planter le chat)
const emojisByCategory: EmojisByCategory[] = require("rn-emoji-keyboard/lib/commonjs/assets/emojis.json");
export type EmojiItem = { emoji: string; name: string; v?: string; toneEnabled?: boolean; keywords?: string[] };
export type EmojisByCategory = { title: string; data: EmojiItem[] };

// ───────────────────────── Clavier d'emojis VimoX ─────────────────────────
// • catégories en français, recherche en français (« coeur », « rire », « chat », « pizza »…)
// • emojis récents en premier, gardés d'une ouverture à l'autre
// • on peut taper plusieurs emojis d'affilée (le clavier ne se ferme plus à chaque fois)
// • bouton ⌫ pour effacer le dernier caractère, comme un vrai clavier

const RECENTS_KEY = "vimox.emojiRecents";

// Mots-clés français ajoutés aux emojis les plus utilisés (la liste d'origine est en anglais)
const FR: Record<string, string> = {
  "😀": "sourire content heureux", "😃": "sourire content", "😄": "sourire rire", "😁": "sourire dents",
  "😆": "rire mdr", "😅": "rire gene sueur", "🤣": "mort de rire mdr ptdr", "😂": "rire larmes mdr ptdr",
  "🙂": "sourire", "🙃": "envers ironie", "😉": "clin d'oeil clin", "😊": "timide sourire rougir",
  "😇": "ange innocent auréole", "🥰": "amoureux coeurs love", "😍": "amoureux yeux coeurs love",
  "🤩": "etoiles wow", "😘": "bisou baiser", "😗": "bisou", "😋": "miam delicieux", "😛": "langue",
  "😜": "langue clin", "🤪": "fou folie", "😝": "langue", "🤑": "argent riche", "🤗": "calin",
  "🤭": "oups main bouche", "🤫": "chut secret", "🤔": "reflechir hmm", "🤐": "bouche cousue",
  "😐": "neutre", "😑": "blase", "😶": "sans voix", "😏": "malin narquois", "😒": "pas content blase",
  "🙄": "yeux au ciel soupir", "😬": "malaise gene", "😌": "soulage", "😔": "triste pensif",
  "😪": "fatigue sommeil", "🤤": "baver", "😴": "dormir dodo sommeil", "😷": "malade masque",
  "🤒": "malade fievre", "🤢": "nausee degoute", "🤮": "vomir degoute", "🥵": "chaud", "🥶": "froid",
  "🥴": "etourdi", "😵": "etourdi", "🤯": "explose choque", "🥳": "fete anniversaire", "😎": "cool lunettes",
  "🤓": "intello lunettes", "😕": "confus", "😟": "inquiet", "🙁": "triste", "😮": "surpris wow",
  "😲": "choque surpris", "😳": "gene rougir", "🥺": "supplier mignon", "😦": "choque", "😧": "angoisse",
  "😨": "peur", "😰": "stress peur", "😥": "decu", "😢": "triste larme pleurer", "😭": "pleurer triste larmes",
  "😱": "peur cri horreur", "😖": "dégoût", "😣": "souffrir", "😞": "decu", "😓": "sueur", "😩": "epuise",
  "😫": "fatigue", "🥱": "baille fatigue", "😤": "enerve fier", "😡": "colere enerve", "😠": "colere",
  "🤬": "insulte colere", "😈": "diable malin", "💀": "mort crane mdr", "💩": "caca", "🤡": "clown",
  "👻": "fantome", "👽": "alien extraterrestre", "🤖": "robot", "🙈": "singe cache honte", "🙉": "singe",
  "🙊": "singe chut", "❤️": "coeur amour love rouge", "🧡": "coeur orange", "💛": "coeur jaune",
  "💚": "coeur vert", "💙": "coeur bleu", "💜": "coeur violet", "🖤": "coeur noir", "🤍": "coeur blanc",
  "💔": "coeur brise rupture", "💕": "coeurs amour", "💞": "coeurs", "💓": "coeur", "💗": "coeur",
  "💖": "coeur brillant", "💘": "coeur fleche", "💝": "coeur cadeau", "💋": "bisou levres", "💯": "cent parfait",
  "💥": "boum explosion", "💫": "etourdi etoile", "💦": "gouttes eau", "💨": "vite fumee", "🔥": "feu flamme chaud",
  "✨": "etincelles paillettes", "⭐": "etoile", "🌟": "etoile brillante", "👍": "pouce oui ok d'accord",
  "👎": "pouce non", "👌": "ok parfait", "✌️": "paix victoire", "🤞": "croise les doigts chance",
  "🤟": "je t'aime", "🤘": "rock", "👏": "applaudir bravo", "🙌": "hourra bravo", "🙏": "merci priere stp",
  "💪": "muscle force", "👋": "salut coucou bonjour", "🤙": "appelle moi", "👀": "yeux regarder",
  "🫶": "coeur mains amour", "🫡": "salut respect", "🐶": "chien", "🐱": "chat", "🐭": "souris",
  "🐰": "lapin", "🦊": "renard", "🐻": "ours", "🐼": "panda", "🐨": "koala", "🦁": "lion", "🐯": "tigre",
  "🐸": "grenouille", "🐵": "singe", "🐔": "poule", "🐧": "pingouin", "🦄": "licorne", "🐝": "abeille",
  "🦋": "papillon", "🐢": "tortue", "🐍": "serpent", "🐙": "pieuvre", "🐬": "dauphin", "🐳": "baleine",
  "🌹": "rose fleur", "🌸": "fleur cerisier", "🌻": "tournesol", "🌈": "arc en ciel", "☀️": "soleil",
  "🌙": "lune nuit", "❄️": "neige flocon", "⚡": "eclair", "☔": "pluie parapluie", "🍕": "pizza",
  "🍔": "burger hamburger", "🍟": "frites", "🌮": "tacos", "🍣": "sushi", "🍩": "donut beignet",
  "🍪": "cookie biscuit", "🎂": "gateau anniversaire", "🍰": "gateau", "🍫": "chocolat", "🍿": "popcorn",
  "☕": "cafe", "🍺": "biere", "🍷": "vin", "🥂": "trinquer champagne", "🍾": "champagne fete",
  "🍓": "fraise", "🍉": "pastèque", "🍌": "banane", "🍎": "pomme", "🥑": "avocat", "⚽": "foot football ballon",
  "🏀": "basket", "🎮": "jeu video manette", "🎵": "musique note", "🎶": "musique", "🎤": "micro chanter",
  "🎧": "casque musique", "🎉": "fete bravo confettis", "🎊": "fete confettis", "🎁": "cadeau",
  "🏆": "trophee victoire", "🥇": "medaille or premier", "📸": "photo appareil", "📱": "telephone portable",
  "💻": "ordinateur", "💸": "argent", "💰": "argent sac", "✈️": "avion voyage", "🚗": "voiture",
  "🏠": "maison", "⏰": "reveil heure", "✅": "ok valide coche", "❌": "non croix", "❓": "question",
  "❗": "exclamation attention", "⚠️": "attention danger", "🆗": "ok", "🔞": "interdit mineurs",
  "🇫🇷": "france drapeau", "🇧🇪": "belgique drapeau", "🇨🇭": "suisse drapeau", "🇨🇦": "canada drapeau",
  "🇲🇦": "maroc drapeau", "🇹🇳": "tunisie drapeau", "🇩🇿": "algerie drapeau", "🇸🇳": "senegal drapeau",
};

// Formes accentuées : on cherche aussi bien « fête » que « fete », « cœur » que « coeur »
const ACCENTS: Record<string, string> = {
  fete: "fête", coeur: "cœur", coeurs: "cœurs", gateau: "gâteau", etoile: "étoile", etoiles: "étoiles",
  colere: "colère", enerve: "énervé", trophee: "trophée", medaille: "médaille", cafe: "café", biere: "bière",
  fievre: "fièvre", nausee: "nausée", degoute: "dégoûté", etourdi: "étourdi", choque: "choqué", decu: "déçu",
  epuise: "épuisé", fatigue: "fatigué", gene: "gêné", soulage: "soulagé", delicieux: "délicieux",
  reflechir: "réfléchir", blase: "blasé", eclair: "éclair", telephone: "téléphone", reveil: "réveil",
  valide: "validé", brise: "brisé", priere: "prière", fantome: "fantôme", baille: "bâille", pasteque: "pastèque",
  algerie: "algérie", senegal: "sénégal", aureole: "auréole", oeil: "œil", gene_: "gêne",
};
const plain = (w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe");

// Ajoute les mots-clés français (calculé une seule fois)
let enriched: EmojisByCategory[] | null = null;
export function emojisFr(): EmojisByCategory[] {
  if (enriched) return enriched;
  enriched = emojisByCategory.map((cat) => ({
    ...cat,
    data: cat.data.map((e) => {
      const extra = FR[e.emoji];
      if (!extra) return e;
      const words = new Set<string>();
      for (const w of extra.split(" ")) {
        const acc = ACCENTS[w] ?? w;
        words.add(acc);
        words.add(plain(acc));
      }
      return { ...e, keywords: [...(e.keywords ?? []), ...words] };
    }),
  }));
  return enriched;
}

// Supprime le dernier caractère visible (un emoji composé compte pour un seul)
export function removeLastGrapheme(text: string): string {
  if (!text) return text;
  const Seg = (Intl as any).Segmenter;
  if (Seg) {
    const parts = [...new Seg(undefined, { granularity: "grapheme" }).segment(text)].map((p: any) => p.segment);
    parts.pop();
    return parts.join("");
  }
  return Array.from(text).slice(0, -1).join("");
}

const CAT_ICONS: Record<string, string> = {
  smileys_emotion: "😀",
  people_body: "👋",
  animals_nature: "🐻",
  food_drink: "🍔",
  travel_places: "✈️",
  activities: "⚽",
  objects: "💡",
  symbols: "❤️",
  flags: "🏳️",
};
const CAT_NAMES: Record<string, string> = {
  smileys_emotion: "Smileys et émotions",
  people_body: "Personnes",
  animals_nature: "Animaux et nature",
  food_drink: "Nourriture et boissons",
  travel_places: "Voyages et lieux",
  activities: "Activités",
  objects: "Objets",
  symbols: "Symboles",
  flags: "Drapeaux",
};

export function VimoxEmojiKeyboard({
  open,
  onClose,
  onEmoji,
  onBackspace,
}: {
  open: boolean;
  onClose: () => void;
  onEmoji: (emoji: string) => void;
  onBackspace?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cats = useMemo(() => emojisFr(), []);
  const [cat, setCat] = useState(-1); // -1 = récents
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<string[]>([]);

  // Emojis récents gardés sur le téléphone (accepte aussi l'ancien format du module)
  useEffect(() => {
    if (!open) return;
    AsyncStorage.getItem(RECENTS_KEY)
      .then((v) => {
        const list = (JSON.parse(v ?? "[]") as any[]).map((x) => (typeof x === "string" ? x : x?.emoji)).filter(Boolean);
        setRecents(list);
        if (list.length === 0) setCat((c) => (c === -1 ? 0 : c));
      })
      .catch(() => setCat((c) => (c === -1 ? 0 : c)));
  }, [open]);

  function pick(e: string) {
    onEmoji(e); // le clavier reste ouvert : on peut en taper plusieurs d'affilée
    const next = [e, ...recents.filter((x) => x !== e)].slice(0, 32);
    setRecents(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
  }

  const q = plain(query.trim().toLowerCase());
  const list = useMemo(() => {
    if (q.length >= 2) {
      return cats
        .flatMap((c) => c.data)
        .filter((e) => plain(e.name.toLowerCase()).includes(q) || (e.keywords ?? []).some((k) => plain(k.toLowerCase()).includes(q)))
        .slice(0, 200)
        .map((e) => e.emoji);
    }
    if (cat === -1) return recents;
    return (cats[cat]?.data ?? []).map((e) => e.emoji);
  }, [q, cat, cats, recents]);

  const title = q.length >= 2 ? "Résultats" : cat === -1 ? "Récents" : CAT_NAMES[cats[cat]?.title] ?? "";

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer les emojis" />
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <View style={st.knob} />
          <View style={st.top}>
            <View style={st.search}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Chercher (cœur, rire, chat…)"
                placeholderTextColor={colors.muted}
                style={st.searchInput}
                autoCorrect={false}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
            {onBackspace && (
              <Pressable
                onPress={onBackspace}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Effacer"
                style={({ pressed }) => [st.backspace, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="backspace-outline" size={22} color={colors.text} />
              </Pressable>
            )}
          </View>

          {q.length < 2 && (
            <View style={st.cats}>
              <Pressable onPress={() => setCat(-1)} style={[st.cat, cat === -1 && st.catOn]} accessibilityLabel="Récents">
                <Ionicons name="time-outline" size={18} color={cat === -1 ? colors.neonRed : colors.muted} />
              </Pressable>
              {cats.map((c, i) => (
                <Pressable key={c.title} onPress={() => setCat(i)} style={[st.cat, cat === i && st.catOn]} accessibilityLabel={CAT_NAMES[c.title]}>
                  <Text style={{ fontSize: 17 }}>{CAT_ICONS[c.title] ?? "•"}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={st.title}>{title}</Text>
          <FlatList
            data={list}
            keyExtractor={(e, i) => e + i}
            numColumns={8}
            initialNumToRender={48}
            maxToRenderPerBatch={64}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: 8 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => pick(item)} style={({ pressed }) => [st.cell, pressed && { backgroundColor: colors.cardLight }]}>
                <Text style={st.emoji}>{item}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={st.empty}>{q.length >= 2 ? "Aucun emoji trouvé." : "Les emojis que tu utilises apparaîtront ici."}</Text>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" },
  sheet: {
    height: "48%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingTop: 8,
  },
  knob: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.neonRed, marginBottom: 8 },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    backgroundColor: colors.black,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 0 },
  backspace: {
    width: 42,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.black,
    marginLeft: 8,
  },
  cats: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 6, paddingTop: 8 },
  cat: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  catOn: { backgroundColor: "rgba(255,46,77,0.18)" },
  title: { color: colors.text, fontSize: 13, fontWeight: "800", paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
  cell: { flex: 1 / 8, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  emoji: { fontSize: 29 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 24, paddingHorizontal: 30 },
});

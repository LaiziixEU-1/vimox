import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { emojisFr } from "./VimoxEmojiKeyboard";

// ───────────── Autocollants, façon Snap ─────────────
// 😀 Emojis (tous, recherche en français, récents) · ✨ Stickers animés · GIF · ⭐ Mes stickers · 🕐 Infos (heure, date, lieu…)
type Tab = "emoji" | "stickers" | "gif" | "mine" | "info";
type Giphy = { id: string; url: string; preview: string };
export type MyStickerItem = { id: string; imageURL: string };

const RECENTS_KEY = "vimox.stickerEmojiRecents";
const TABS: [Tab, string][] = [
  ["emoji", "😀 Emojis"],
  ["stickers", "✨ Stickers"],
  ["gif", "GIF"],
  ["mine", "⭐ Mes stickers"],
  ["info", "🕐 Infos"],
];
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

async function giphy(kind: "stickers" | "gifs", q: string): Promise<Giphy[]> {
  const key = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
  if (!key) throw new Error("no-key");
  const path = q.trim() ? `search?q=${encodeURIComponent(q.trim())}&` : "trending?";
  const r = await fetch(`https://api.giphy.com/v1/${kind}/${path}api_key=${key}&limit=30&rating=pg-13&lang=fr`);
  const j = await r.json();
  return (j?.data ?? [])
    .map((g: any) => ({
      id: String(g.id),
      url: g.images?.fixed_height?.url ?? g.images?.original?.url,
      preview: g.images?.fixed_height_small?.url ?? g.images?.fixed_height?.url,
    }))
    .filter((g: Giphy) => !!g.url);
}

export function StickerSheet({
  visible,
  onClose,
  onEmoji,
  onGif,
  myStickers,
  onMySticker,
  onDeleteMySticker,
  onPickImage,
  place,
  onLocation,
}: {
  visible: boolean;
  onClose: () => void;
  onEmoji: (e: string) => void;
  onGif: (url: string) => void;
  myStickers: MyStickerItem[];
  onMySticker: (s: any) => void;
  onDeleteMySticker: (s: any) => void;
  onPickImage: () => void;
  place?: string | null;
  onLocation?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("emoji");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const [remote, setRemote] = useState<Giphy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cats = useMemo(() => emojisFr(), []);

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(RECENTS_KEY)
      .then((v) => setRecents(JSON.parse(v ?? "[]")))
      .catch(() => {});
  }, [visible]);

  // Stickers animés / GIF : tendances, ou recherche
  useEffect(() => {
    if (!visible || (tab !== "stickers" && tab !== "gif")) return;
    let alive = true;
    setLoading(true);
    setError(null);
    const t = setTimeout(
      () => {
        giphy(tab === "stickers" ? "stickers" : "gifs", query)
          .then((d) => alive && setRemote(d))
          .catch((e) => alive && setError(String(e?.message) === "no-key" ? "Ajoute EXPO_PUBLIC_GIPHY_API_KEY dans ton fichier .env." : "Impossible de charger. Vérifie ta connexion."))
          .finally(() => alive && setLoading(false));
      },
      query ? 350 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [visible, tab, query]);

  function pickEmoji(e: string) {
    const next = [e, ...recents.filter((x) => x !== e)].slice(0, 24);
    setRecents(next);
    AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => {});
    onEmoji(e);
    onClose();
  }

  const q = query.trim().toLowerCase();
  const emojiList = useMemo(() => {
    if (tab !== "emoji") return [];
    if (q.length >= 2) {
      return cats
        .flatMap((c) => c.data)
        .filter((e) => e.name.toLowerCase().includes(q) || (e.keywords ?? []).some((k) => k.toLowerCase().includes(q)))
        .slice(0, 160)
        .map((e) => e.emoji);
    }
    return (cats[cat]?.data ?? []).map((e) => e.emoji);
  }, [tab, q, cat, cats]);

  const now = new Date();
  const infos = [
    `🕐 ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
    `📅 ${now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}`,
    ...(place ? [`📍 ${place}`] : []),
    "☀️ Bonne journée",
    "🌙 Bonne nuit",
    "🎂 Joyeux anniversaire",
    "❤️ Je t'aime",
    "😂 MDR",
    "🔥 Trop bien",
    "🙏 Merci",
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={st.handle} />
          {(tab === "emoji" || tab === "stickers" || tab === "gif") && (
            <View style={st.search}>
              <Ionicons name="search" size={17} color="#9B9BAA" />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={tab === "emoji" ? "Chercher un emoji (cœur, rire, chat…)" : tab === "stickers" ? "Chercher un sticker animé" : "Chercher un GIF"}
                placeholderTextColor="#9B9BAA"
                style={st.searchInput}
                autoCorrect={false}
              />
              {query ? (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Ionicons name="close-circle" size={17} color="#9B9BAA" />
                </Pressable>
              ) : null}
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabs} style={{ flexGrow: 0 }}>
            {TABS.map(([id, label]) => (
              <Pressable
                key={id}
                onPress={() => {
                  setTab(id);
                  setQuery("");
                }}
                style={[st.tab, tab === id && st.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === id }}
              >
                <Text style={[st.tabTxt, tab === id && st.tabTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {tab === "emoji" && (
            <>
              {q.length < 2 && (
                <View style={st.cats}>
                  {cats.map((c, i) => (
                    <Pressable key={c.title} onPress={() => setCat(i)} style={[st.cat, cat === i && st.catOn]} accessibilityRole="button">
                      <Text style={{ fontSize: 18 }}>{CAT_ICONS[c.title] ?? "•"}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {q.length < 2 && recents.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.recents}>
                  <Text style={st.recentLbl}>Récents</Text>
                  {recents.map((e) => (
                    <Pressable key={e} onPress={() => pickEmoji(e)} style={st.recentCell}>
                      <Text style={st.recentEmoji}>{e}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
              <FlatList
                data={emojiList}
                keyExtractor={(e, i) => e + i}
                numColumns={8}
                initialNumToRender={64}
                contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => pickEmoji(item)} style={st.emojiCell}>
                    <Text style={st.emoji}>{item}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={st.empty}>Aucun emoji trouvé.</Text>}
              />
            </>
          )}

          {(tab === "stickers" || tab === "gif") &&
            (loading ? (
              <ActivityIndicator color="#FF2E4D" style={{ marginTop: 40 }} />
            ) : error ? (
              <Text style={st.empty}>{error}</Text>
            ) : (
              <FlatList
                data={remote}
                keyExtractor={(g) => g.id}
                numColumns={3}
                contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 12 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onGif(item.url);
                      onClose();
                    }}
                    style={st.gifCell}
                  >
                    <ExpoImage source={{ uri: item.preview }} style={StyleSheet.absoluteFill} contentFit={tab === "stickers" ? "contain" : "cover"} />
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={st.empty}>Rien trouvé.</Text>}
                ListFooterComponent={<Text style={st.credit}>Propulsé par GIPHY</Text>}
              />
            ))}

          {tab === "mine" && (
            <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
              <Pressable style={st.addBtn} onPress={onPickImage} accessibilityRole="button">
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={st.addTxt}>Créer un sticker depuis ma galerie</Text>
              </Pressable>
              {myStickers.length === 0 ? (
                <Text style={st.empty}>Découpe un objet avec les ciseaux ✂️, puis touche le marque-page pour l'enregistrer ici.</Text>
              ) : (
                <View style={st.mineGrid}>
                  {myStickers.map((s) => (
                    <Pressable
                      key={s.id}
                      style={st.mineCell}
                      onPress={() => {
                        onMySticker(s);
                        onClose();
                      }}
                      onLongPress={() => onDeleteMySticker(s)}
                    >
                      <ExpoImage source={{ uri: s.imageURL }} style={StyleSheet.absoluteFill} contentFit="contain" />
                    </Pressable>
                  ))}
                </View>
              )}
              {myStickers.length > 0 && <Text style={st.credit}>Appui long sur un sticker pour le supprimer</Text>}
            </ScrollView>
          )}

          {tab === "info" && (
            <ScrollView contentContainerStyle={st.infoWrap}>
              {!place && onLocation && (
                <Pressable
                  onPress={() => {
                    onLocation();
                    onClose();
                  }}
                  style={({ pressed }) => [st.info, { borderColor: "#FF2E4D" }, pressed && { opacity: 0.8 }]}
                >
                  <Text style={st.infoTxt}>📍 Ajouter ma position</Text>
                </Pressable>
              )}
              {infos.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => {
                    onEmoji(t);
                    onClose();
                  }}
                  style={({ pressed }) => [st.info, pressed && { opacity: 0.8 }]}
                >
                  <Text style={st.infoTxt}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { height: "72%", backgroundColor: "rgba(21,21,27,0.98)", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#33333F", marginBottom: 10 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, height: 40, borderRadius: 20, paddingHorizontal: 12, backgroundColor: "#1D1D25" },
  searchInput: { flex: 1, color: "#F7F7FA", fontSize: 14 },
  tabs: { gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  tab: { paddingHorizontal: 13, height: 32, borderRadius: 16, backgroundColor: "#1D1D25", justifyContent: "center" },
  tabOn: { backgroundColor: "#F7F7FA" },
  tabTxt: { color: "#9B9BAA", fontSize: 13, fontWeight: "800" },
  tabTxtOn: { color: "#000" },
  cats: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 8, paddingBottom: 6 },
  cat: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  catOn: { backgroundColor: "rgba(255,46,77,0.2)" },
  recents: { alignItems: "center", gap: 4, paddingHorizontal: 14, paddingBottom: 6 },
  recentLbl: { color: "#9B9BAA", fontSize: 11, fontWeight: "800", marginRight: 6 },
  recentCell: { padding: 4 },
  recentEmoji: { fontSize: 26 },
  emojiCell: { flex: 1 / 8, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 30 },
  gifCell: { flex: 1 / 3, aspectRatio: 1, margin: 3, borderRadius: 12, overflow: "hidden", backgroundColor: "#1D1D25" },
  empty: { color: "#9B9BAA", textAlign: "center", marginTop: 30, paddingHorizontal: 30, lineHeight: 20 },
  credit: { color: "#636372", fontSize: 11, textAlign: "center", marginTop: 10 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 23, backgroundColor: "#FF2E4D" },
  addTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  mineGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mineCell: { width: 92, height: 92, borderRadius: 14, backgroundColor: "#1D1D25", overflow: "hidden" },
  infoWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 14 },
  info: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: "#1D1D25", borderWidth: 1, borderColor: "#32323E" },
  infoTxt: { color: "#F7F7FA", fontSize: 15, fontWeight: "800", textTransform: "capitalize" },
});

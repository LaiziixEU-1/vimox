const cache: Record<string, string> = {};

export function getDeviceLang(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.split("-")[0]; // 'fr', 'en', 'ar', etc.
  } catch {
    return "fr";
  }
}

export async function translateText(
  text: string,
  targetLang: string,
): Promise<string> {
  if (!text.trim() || text.length < 2) return text;
  const key = `${text}__${targetLang}`;
  if (cache[key]) return cache[key];

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.responseStatus === 200) {
      const translated = data.responseData.translatedText;
      cache[key] = translated;
      return translated;
    }
    return text;
  } catch {
    return text;
  }
}

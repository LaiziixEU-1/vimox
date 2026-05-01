const bannedTerms = ["insulte", "spam", "arnaque", "violence"];

export function isSuspicious(text: string) {
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return text.length > 700 || bannedTerms.some((term) => normalized.includes(term));
}


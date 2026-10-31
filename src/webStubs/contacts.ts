// Remplace « expo-contacts » dans un NAVIGATEUR uniquement (voir metro.config.js).
// Un navigateur n'a pas accès au répertoire du téléphone. Jamais utilisé sur iPhone/Android.
export const Fields = { PhoneNumbers: "phoneNumbers" };

export async function requestPermissionsAsync() {
  return { status: "denied" };
}
export async function getContactsAsync(_options?: unknown) {
  return { data: [] as any[] };
}

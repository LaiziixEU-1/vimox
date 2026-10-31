/**
 * Expo remplace le fetch global par une version « standard web » qui refuse
 * formData.append("file", { uri, type, name }) : "Unsupported FormDataPart implementation".
 * Ce patch renvoie ces requêtes vers XMLHttpRequest (natif React Native), qui sait
 * toujours envoyer un fichier à partir de son chemin. Les autres requêtes restent
 * sur le fetch d'origine.
 */
const originalFetch: typeof fetch = globalThis.fetch.bind(globalThis);

function hasFileUri(body: any): boolean {
  try {
    const parts: any[] =
      typeof body?.getParts === "function"
        ? body.getParts()
        : (body?._parts ?? []);
    return parts.some((p) => {
      const v = Array.isArray(p) ? p[1] : p;
      return v && typeof v === "object" && typeof v.uri === "string";
    });
  } catch {
    return false;
  }
}

function xhrFetch(input: any, init: any): Promise<Response> {
  return new Promise((resolve, reject) => {
    const url =
      typeof input === "string" ? input : (input?.url ?? String(input));
    const xhr = new XMLHttpRequest();
    xhr.open(init?.method ?? "POST", url);
    xhr.timeout = 120000;

    const h = init?.headers;
    if (h) {
      let entries: [string, string][] = [];
      if (Array.isArray(h)) entries = h as [string, string][];
      else if (typeof h.forEach === "function")
        h.forEach((v: string, k: string) => entries.push([k, v]));
      else entries = Object.entries(h) as [string, string][];
      for (const [k, v] of entries) {
        // On laisse XHR fabriquer lui-même le Content-Type (avec le « boundary »)
        if (String(k).toLowerCase() === "content-type") continue;
        xhr.setRequestHeader(k, String(v));
      }
    }

    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
        }),
      );
    };
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.ontimeout = () => reject(new TypeError("Network request timed out"));
    xhr.send(init.body);
  });
}

const patchedFetch = ((input: any, init?: any) => {
  if (init?.body && hasFileUri(init.body)) return xhrFetch(input, init);
  return originalFetch(input, init);
}) as typeof fetch;

try {
  Object.defineProperty(globalThis, "fetch", {
    value: patchedFetch,
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  console.warn("fetchFormData patch non installé :", e);
}

export {};

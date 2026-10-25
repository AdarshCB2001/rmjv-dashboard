import "server-only";

/**
 * Minimal Firestore client over REST + a service-account JWT (WebCrypto), because
 * firebase-admin needs Node internals that Cloudflare Workers don't have. Covers only
 * what pm-sync needs: existence check, create/replace with a server timestamp, batched
 * string-field reads.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

const b64url = (b: ArrayBuffer | string) =>
  btoa(typeof b === "string" ? b : String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

let cached: { token: string; exp: number } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const unsigned = [
    b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    b64url(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/datastore",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  ].join(".");

  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[A-Z ]+-----|\s/g, "")), (c) =>
    c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: access_token, exp: Date.now() + expires_in * 1000 };
  return access_token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const enc = (v: unknown): any =>
  v === null || v === undefined
    ? { nullValue: null }
    : typeof v === "string"
      ? { stringValue: v }
      : typeof v === "boolean"
        ? { booleanValue: v }
        : typeof v === "number"
          ? Number.isInteger(v)
            ? { integerValue: String(v) }
            : { doubleValue: v }
          : Array.isArray(v)
            ? { arrayValue: { values: v.map(enc) } }
            : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };

export function firestore(sa: ServiceAccount) {
  const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents`;
  const call = async (suffix: string, body: unknown) => {
    const res = await fetch(`${base}${suffix}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Firestore ${suffix} failed: ${res.status} ${await res.text()}`);
    return res.json();
  };

  return {
    /** Reads one string field from each doc; docs that don't exist are absent from the map (keyed by doc id). */
    async getStrings(paths: string[], field: string): Promise<Map<string, string>> {
      const out = new Map<string, string>();
      if (paths.length === 0) return out;
      const rows = (await call(":batchGet", {
        documents: paths.map((p) => `projects/${sa.project_id}/databases/(default)/documents/${p}`),
      })) as { found?: { name: string; fields?: Record<string, { stringValue?: string }> } }[];
      for (const r of rows) {
        const v = r.found?.fields?.[field]?.stringValue;
        if (r.found && v !== undefined) out.set(r.found.name.split("/").pop()!, v);
        else if (r.found) out.set(r.found.name.split("/").pop()!, "");
      }
      return out;
    },

    async exists(path: string): Promise<boolean> {
      return (await this.getStrings([path], "stage")).has(path.split("/").pop()!);
    },

    /** Creates or replaces a doc; `serverTime` names a field to stamp with the server's time. */
    async set(path: string, data: Record<string, unknown>, serverTime: string) {
      await call(":commit", {
        writes: [
          {
            update: {
              name: `projects/${sa.project_id}/databases/(default)/documents/${path}`,
              fields: enc(data).mapValue.fields,
            },
            updateTransforms: [{ fieldPath: serverTime, setToServerValue: "REQUEST_TIME" }],
          },
        ],
      });
    },
  };
}

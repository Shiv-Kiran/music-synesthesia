import crypto from "crypto";

export interface SignedTokenResult<T> {
  valid: boolean;
  payload?: T;
  reason?: string;
}

export function signToken<T extends Record<string, unknown>>(
  payload: T,
  secret: string,
  ttlSeconds: number,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const basePayload = { ...payload, exp };
  const json = JSON.stringify(basePayload);
  const encoded = Buffer.from(json).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  token: string,
  secret: string,
): SignedTokenResult<T> {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) {
    return { valid: false, reason: "invalid-format" };
  }

  const expected = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (expected !== sig) {
    return { valid: false, reason: "bad-signature" };
  }

  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const payload = JSON.parse(json) as T & { exp?: number };
    if (typeof payload.exp === "number") {
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false, reason: "expired" };
      }
    }
    return { valid: true, payload: payload as T };
  } catch {
    return { valid: false, reason: "bad-payload" };
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

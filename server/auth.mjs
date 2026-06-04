import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const COST = 1 << 15;
const SCRYPT_MAX_MEM = 64 * 1024 * 1024;
const SESSION_COOKIE = "hb_session";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Klucz porównawczy numeru telefonu — same cyfry, by "501 100 200" == "501100200".
export function normalizePhone(phone) {
  return String(phone || "").replace(/[^0-9]/g, "");
}

export function validateRegistrationInput(input) {
  const errors = [];

  if (String(input.name || "").trim().length < 2) {
    errors.push("Podaj imię i nazwisko.");
  }

  if (!EMAIL_PATTERN.test(normalizeEmail(input.email))) {
    errors.push("Podaj poprawny adres e-mail.");
  }

  if (!String(input.phone || "").trim()) {
    errors.push("Podaj numer telefonu.");
  }

  if (String(input.password || "").length < 8) {
    errors.push("Hasło musi mieć co najmniej 8 znaków.");
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(String(password), salt, KEY_LENGTH, {
    N: COST,
    maxmem: SCRYPT_MAX_MEM,
  });
  return `scrypt$${COST}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [scheme, cost, salt, hash] = String(storedHash || "").split("$");

  if (scheme !== "scrypt" || !cost || !salt || !hash) {
    return false;
  }

  const derived = await scryptAsync(String(password), salt, KEY_LENGTH, {
    N: Number(cost),
    maxmem: SCRYPT_MAX_MEM,
  });
  const expected = Buffer.from(hash, "hex");

  if (expected.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(expected, derived);
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseCookies(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const index = entry.indexOf("=");
      const key = index >= 0 ? entry.slice(0, index) : entry;
      const value = index >= 0 ? entry.slice(index + 1) : "";
      cookies[safeDecode(key)] = safeDecode(value);
      return cookies;
    }, {});
}

export function serializeSessionCookie(token, { maxAgeSeconds, secure = true } = {}) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (Number.isFinite(maxAgeSeconds)) {
    parts.push(`Max-Age=${maxAgeSeconds}`);
  }

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function clearSessionCookie() {
  return serializeSessionCookie("", { maxAgeSeconds: 0, secure: false });
}

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    clientId: user.client_id ?? user.clientId ?? null,
    staffId: user.staff_id ?? user.staffId ?? null,
  };
}

export function getSessionTokenFromRequest(request) {
  return parseCookies(request.headers.cookie || "")[SESSION_COOKIE] || "";
}

export function generateSessionToken() {
  return randomBytes(32).toString("base64url");
}

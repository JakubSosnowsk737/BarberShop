import test from "node:test";
import assert from "node:assert/strict";

import {
  hashPassword,
  normalizePhone,
  parseCookies,
  sanitizeUser,
  serializeSessionCookie,
  validateRegistrationInput,
  verifyPassword,
} from "../server/auth.mjs";

test("validates public registration input for a client account", () => {
  assert.deepEqual(
    validateRegistrationInput({
      name: "Jan Testowy",
      email: "jan@example.com",
      phone: "500 600 700",
      password: "sekret123",
    }),
    { ok: true },
  );

  assert.deepEqual(
    validateRegistrationInput({
      name: "J",
      email: "bad-email",
      phone: "",
      password: "123",
    }),
    {
      ok: false,
      errors: [
        "Podaj imię i nazwisko.",
        "Podaj poprawny adres e-mail.",
        "Podaj numer telefonu.",
        "Hasło musi mieć co najmniej 8 znaków.",
      ],
    },
  );
});

test("hashes and verifies passwords without storing plain text", async () => {
  const hash = await hashPassword("hairbook123");

  assert.notEqual(hash, "hairbook123");
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassword("hairbook123", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
});

test("parses cookies and serializes an HttpOnly session cookie", () => {
  assert.deepEqual(parseCookies("hb_session=abc; theme=light"), {
    hb_session: "abc",
    theme: "light",
  });

  const cookie = serializeSessionCookie("token-value", {
    maxAgeSeconds: 3600,
    secure: false,
  });

  assert.match(cookie, /^hb_session=token-value;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=3600/);
});

test("normalizePhone keeps digits only for duplicate matching", () => {
  assert.equal(normalizePhone("501 100 200"), "501100200");
  assert.equal(normalizePhone("+48 501-100-200"), "48501100200");
  assert.equal(normalizePhone("(501) 100 200"), "501100200");
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone(null), "");
});

test("sanitizes database users before sending them to the browser", () => {
  assert.deepEqual(
    sanitizeUser({
      id: "user-1",
      role: "client",
      name: "Jan Testowy",
      email: "jan@example.com",
      password_hash: "secret",
      client_id: "client-1",
      staff_id: null,
    }),
    {
      id: "user-1",
      role: "client",
      name: "Jan Testowy",
      email: "jan@example.com",
      clientId: "client-1",
      staffId: null,
    },
  );
});

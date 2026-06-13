// Testy jednostkowe — uzupełnienie pokrycia warstwy uwierzytelniania (server/auth.mjs).
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  clearSessionCookie,
  generateSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  normalizeEmail,
  parseCookies,
  sanitizeUser,
  serializeSessionCookie,
  validateRegistrationInput,
  verifyPassword,
} from "../../server/auth.mjs";

describe("normalizeEmail", () => {
  test("przycina i sprowadza do małych liter", () => {
    assert.equal(normalizeEmail("  Jan.KOWALSKI@Example.COM "), "jan.kowalski@example.com");
  });

  test("wartości puste zwracają pusty string", () => {
    assert.equal(normalizeEmail(null), "");
    assert.equal(normalizeEmail(undefined), "");
  });
});

describe("validateRegistrationInput — granice", () => {
  test("jednoznakowe imię jest odrzucane, dwuznakowe akceptowane", () => {
    assert.equal(validateRegistrationInput({ name: "Al", email: "a@b.pl", phone: "1", password: "12345678" }).ok, true);
    assert.equal(validateRegistrationInput({ name: "A", email: "a@b.pl", phone: "1", password: "12345678" }).ok, false);
  });

  test("hasło 7-znakowe jest odrzucane, 8-znakowe akceptowane", () => {
    const base = { name: "Jan Test", email: "a@b.pl", phone: "1" };
    assert.equal(validateRegistrationInput({ ...base, password: "1234567" }).ok, false);
    assert.equal(validateRegistrationInput({ ...base, password: "12345678" }).ok, true);
  });

  test("zwraca komplet komunikatów dla pustego wejścia", () => {
    const result = validateRegistrationInput({});
    assert.equal(result.ok, false);
    assert.equal(result.errors.length, 4);
  });
});

describe("hashPassword / verifyPassword", () => {
  test("dwa skróty tego samego hasła różnią się (losowa sól)", async () => {
    const a = await hashPassword("tajne-haslo");
    const b = await hashPassword("tajne-haslo");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("tajne-haslo", a), true);
    assert.equal(await verifyPassword("tajne-haslo", b), true);
  });

  test("zniekształcony lub pusty skrót nie weryfikuje się i nie rzuca wyjątku", async () => {
    assert.equal(await verifyPassword("x", ""), false);
    assert.equal(await verifyPassword("x", null), false);
    assert.equal(await verifyPassword("x", "plaintext"), false);
    assert.equal(await verifyPassword("x", "scrypt$only"), false);
    assert.equal(await verifyPassword("x", "bcrypt$1$salt$hash"), false);
  });

  test("poprawny schemat, ale niezgodna długość skrótu → false", async () => {
    assert.equal(await verifyPassword("x", "scrypt$16384$abcd$00"), false);
  });
});

describe("parseCookies", () => {
  test("parsuje wiele ciasteczek i dekoduje wartości", () => {
    assert.deepEqual(parseCookies("hb_session=a%20b; theme=dark"), { hb_session: "a b", theme: "dark" });
  });

  test("pusty nagłówek daje pusty obiekt", () => {
    assert.deepEqual(parseCookies(""), {});
    assert.deepEqual(parseCookies(), {});
  });

  test("ciasteczko bez wartości daje pusty string", () => {
    assert.deepEqual(parseCookies("flag"), { flag: "" });
  });

  test("błędne kodowanie URL nie wywraca parsera (zwraca surową wartość)", () => {
    assert.deepEqual(parseCookies("bad=%E0%A4%"), { bad: "%E0%A4%" });
  });
});

describe("ciasteczko sesji", () => {
  test("flaga Secure dołączana zależnie od opcji", () => {
    assert.match(serializeSessionCookie("t", { secure: true }), /Secure/);
    assert.doesNotMatch(serializeSessionCookie("t", { secure: false }), /Secure/);
  });

  test("token jest kodowany URL-em", () => {
    assert.match(serializeSessionCookie("a/b+c", { secure: false }), /hb_session=a%2Fb%2Bc/);
  });

  test("clearSessionCookie ustawia Max-Age=0", () => {
    assert.match(clearSessionCookie(), /Max-Age=0/);
  });

  test("getSessionTokenFromRequest czyta token z nagłówka cookie", () => {
    const request = { headers: { cookie: "hb_session=abc123; theme=light" } };
    assert.equal(getSessionTokenFromRequest(request), "abc123");
  });

  test("getSessionTokenFromRequest zwraca pusty string bez ciasteczka", () => {
    assert.equal(getSessionTokenFromRequest({ headers: {} }), "");
  });
});

describe("generateSessionToken", () => {
  test("zwraca długi, losowy token base64url", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 32);
    assert.match(a, /^[A-Za-z0-9_-]+$/);
  });
});

describe("sanitizeUser", () => {
  test("null zwraca null", () => {
    assert.equal(sanitizeUser(null), null);
  });

  test("nie przepuszcza password_hash i mapuje pola łączące", () => {
    const safe = sanitizeUser({
      id: "u1",
      role: "barber",
      name: "Bartek",
      email: "b@b.pl",
      password_hash: "scrypt$...$...",
      staff_id: "s1",
      client_id: null,
    });
    assert.deepEqual(safe, { id: "u1", role: "barber", name: "Bartek", email: "b@b.pl", clientId: null, staffId: "s1" });
    assert.ok(!("password_hash" in safe));
  });
});

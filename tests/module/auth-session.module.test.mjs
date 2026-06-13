// Testy modułowe — MODUŁ UŻYTKOWNIKÓW / SESJI.
// Łączą walidację rejestracji, klucze deduplikacji, hashowanie hasła, sanityzację
// rekordu oraz pełny obieg ciasteczka sesji (wydanie → odczyt z żądania → wygaszenie).
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  clearSessionCookie,
  generateSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  sanitizeUser,
  serializeSessionCookie,
  validateRegistrationInput,
  verifyPassword,
} from "../../server/auth.mjs";

describe("rejestracja klienta i obieg sesji", () => {
  test("od danych z formularza do bezpiecznego rekordu i klucza dedup", async () => {
    const form = {
      name: "Jan Kowalski",
      email: "  Jan.KOWALSKI@Example.com ",
      phone: "+48 501-100-200",
      password: "bardzo-tajne-1",
    };

    // 1) Walidacja przechodzi.
    assert.deepEqual(validateRegistrationInput(form), { ok: true });

    // 2) Klucze deduplikacji są znormalizowane (do dopasowania kart-gości).
    assert.equal(normalizeEmail(form.email), "jan.kowalski@example.com");
    assert.equal(normalizePhone(form.phone), "48501100200");

    // 3) Hasło zapisujemy wyłącznie jako skrót scrypt; weryfikacja działa w obie strony.
    const hash = await hashPassword(form.password);
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPassword(form.password, hash), true);
    assert.equal(await verifyPassword("inne-haslo", hash), false);

    // 4) Rekord wysyłany do przeglądarki nie zawiera skrótu hasła.
    const dbRow = {
      id: "user-1",
      role: "client",
      name: form.name,
      email: normalizeEmail(form.email),
      password_hash: hash,
      client_id: "client-1",
      staff_id: null,
    };
    const safe = sanitizeUser(dbRow);
    assert.ok(!("password_hash" in safe));
    assert.equal(safe.clientId, "client-1");
  });

  test("ciasteczko sesji: wydanie → odczyt z kolejnego żądania → wygaszenie", () => {
    const token = generateSessionToken();

    // Serwer wydaje ciasteczko (Set-Cookie).
    const setCookie = serializeSessionCookie(token, { maxAgeSeconds: 3600, secure: false });
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);

    // Przeglądarka odsyła je w nagłówku Cookie kolejnego żądania.
    const cookiePair = setCookie.split(";")[0]; // "hb_session=<token>"
    const nextRequest = { headers: { cookie: `${cookiePair}; theme=dark` } };
    assert.equal(getSessionTokenFromRequest(nextRequest), token);

    // Wylogowanie natychmiast wygasza ciasteczko.
    assert.match(clearSessionCookie(), /Max-Age=0/);
  });

  test("niekompletny formularz zatrzymuje rejestrację z kompletem komunikatów PL", () => {
    const result = validateRegistrationInput({ name: "J", email: "zly-adres", phone: "", password: "123" });
    assert.equal(result.ok, false);
    assert.deepEqual(result.errors, [
      "Podaj imię i nazwisko.",
      "Podaj poprawny adres e-mail.",
      "Podaj numer telefonu.",
      "Hasło musi mieć co najmniej 8 znaków.",
    ]);
  });
});

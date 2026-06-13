// Testy funkcjonalne (E2E) — bezpieczeństwo i kontrola dostępu.
// Autoryzacja wg roli, ochrona CSRF oraz limit nieudanych logowań.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import { createClient, DEMO, probeDatabase, startTestServer } from "./_harness.mjs";

// Bez działającej bazy (np. lokalnie bez Dockera) cały zestaw pomija się
// z czytelnym statusem SKIP zamiast zgłaszać błędy połączenia.
const dbReady = await probeDatabase();
const t = dbReady ? test : test.skip;

let srv;

before(async () => {
  if (!dbReady) return;
  srv = await startTestServer();
});

after(async () => {
  if (!dbReady) return;
  await srv?.close();
});

beforeEach(async () => {
  if (!dbReady) return;
  await srv.reset();
});

describe("kontrola dostępu wg roli", () => {
  t("niezalogowany nie utworzy rezerwacji (401)", async () => {
    const api = createClient(srv.baseUrl);
    const res = await api.post("/api/bookings", { serviceId: "service-cut" });
    assert.equal(res.status, 401);
  });

  t("klient nie może dodać usługi ani karty klienta (403)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.client, DEMO.password);

    const service = await api.post("/api/services", { name: "Hack", category: "x", duration: 30, price: 10 });
    assert.equal(service.status, 403);

    const client = await api.post("/api/clients", { name: "Obcy Klient" });
    assert.equal(client.status, 403);
  });

  t("fryzjer nie może dodawać usług (tylko administrator)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.barber1, DEMO.password);
    const res = await api.post("/api/services", { name: "X", category: "y", duration: 30, price: 10 });
    assert.equal(res.status, 403);
  });

  t("klient nie zmieni statusu na 'zrealizowana' (tylko anulowanie własnej wizyty)", async () => {
    const admin = createClient(srv.baseUrl);
    await admin.login(DEMO.admin, DEMO.password);
    const state = await admin.get("/api/state");
    // Wizyta klienta-1 z seeda (confirmed, należąca do zalogowanego klienta demo).
    const own = state.json.data.bookings.find((b) => b.clientId === "client-1" && b.status === "confirmed");
    assert.ok(own, "seed powinien zawierać potwierdzoną wizytę klienta-1");

    const client = createClient(srv.baseUrl);
    await client.login(DEMO.client, DEMO.password);
    const res = await client.patch(`/api/bookings/${own.id}/status`, { status: "completed" });
    assert.equal(res.status, 403);
  });
});

describe("ochrona CSRF", () => {
  t("żądanie mutujące z obcym Origin jest blokowane (403)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const res = await api.post(
      "/api/services",
      { name: "X", category: "y", duration: 30, price: 10 },
      { headers: { origin: "http://zly-serwis.example" } },
    );
    assert.equal(res.status, 403);
    assert.match(res.json.error, /źródł/i);
  });
});

describe("limit nieudanych logowań", () => {
  t("po serii błędnych prób serwer zwraca 429", async () => {
    const api = createClient(srv.baseUrl);
    let sawTooMany = false;
    for (let i = 0; i < 15; i += 1) {
      const res = await api.login(DEMO.admin, "zle-haslo");
      if (res.status === 429) {
        sawTooMany = true;
        break;
      }
      assert.equal(res.status, 401);
    }
    assert.ok(sawTooMany, "powinien pojawić się status 429 po przekroczeniu limitu prób");
  });
});

// Testy funkcjonalne (E2E) — ścieżki biznesowe ponad pełnym stosem:
// HTTP → routing → logika → PostgreSQL. Wymagają działającej bazy (Docker/CI).
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
  await srv.reset(); // czysty, powtarzalny seed przed każdym testem
});

// Dzień roboczy (pon–pt) ~3 tygodnie naprzód: poza wizytami z seeda,
// w horyzoncie 120 dni rezerwacji online. getUTCDay zgodne z serwerem.
function futureWorkday(daysAhead = 21) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function pastDay(daysBack = 3) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

describe("sesja i uwierzytelnianie", () => {
  t("health-check odpowiada 200", async () => {
    const api = createClient(srv.baseUrl);
    const res = await api.get("/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { ok: true });
  });

  t("niezalogowany użytkownik nie ma sesji", async () => {
    const api = createClient(srv.baseUrl);
    const res = await api.get("/api/session");
    assert.equal(res.status, 200);
    assert.equal(res.json.authenticated, false);
  });

  t("poprawne logowanie ustawia ciasteczko sesji", async () => {
    const api = createClient(srv.baseUrl);
    const login = await api.login(DEMO.admin, DEMO.password);
    assert.equal(login.status, 200);
    assert.equal(login.json.user.role, "admin");
    assert.match(api.cookie, /^hb_session=/);

    const session = await api.get("/api/session");
    assert.equal(session.json.authenticated, true);
  });

  t("błędne hasło zwraca 401", async () => {
    const api = createClient(srv.baseUrl);
    const res = await api.login(DEMO.admin, "zle-haslo");
    assert.equal(res.status, 401);
  });
});

describe("zakres danych wg roli (/api/state)", () => {
  t("administrator widzi pełny stan", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const res = await api.get("/api/state");
    assert.equal(res.status, 200);
    assert.ok(res.json.data.users.length >= 4);
    assert.ok(res.json.data.staff.length >= 2);
    assert.ok(res.json.data.services.length >= 1);
  });

  t("klient widzi wyłącznie własne dane, bez listy kont", async () => {
    const api = createClient(srv.baseUrl);
    const login = await api.login(DEMO.client, DEMO.password);
    const ownClientId = login.json.user.clientId;

    const res = await api.get("/api/state");
    assert.equal(res.json.data.users.length, 0, "klient nie dostaje listy użytkowników");
    assert.ok(
      res.json.data.clients.every((c) => c.id === ownClientId),
      "klient widzi tylko własną kartę",
    );
    assert.ok(
      res.json.data.bookings.every((b) => b.clientId === ownClientId),
      "klient widzi tylko własne wizyty",
    );
    // Powody urlopów są maskowane w widoku klienta.
    assert.ok(res.json.data.timeOff.every((t) => t.reason === ""));
  });
});

describe("rezerwacje", () => {
  t("administrator tworzy wizytę (frontdesk) w wolnym terminie", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const res = await api.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-cut",
      date: futureWorkday(),
      time: "14:00",
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.booking.status, "confirmed");
    assert.equal(res.json.booking.source, "frontdesk");
  });

  t("nakładająca się wizyta tego samego fryzjera jest odrzucana (409)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const slot = { clientId: "client-1", barberId: "barber-1", serviceId: "service-cut", date: futureWorkday(), time: "14:00" };
    const first = await api.post("/api/bookings", slot);
    assert.equal(first.status, 201);

    const second = await api.post("/api/bookings", { ...slot, clientId: "client-2" });
    assert.equal(second.status, 409);
    assert.match(second.json.error, /koliduje/i);
  });

  t("termin poza godzinami pracy salonu jest odrzucany (400)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const res = await api.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-cut",
      date: futureWorkday(),
      time: "20:00", // salon zamyka o 19:00
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /godzinach pracy/i);
  });

  t("nowa rezerwacja w czasie urlopu fryzjera jest odrzucana (400)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const day = futureWorkday(49);
    const off = await api.post("/api/time-off", {
      staffId: "barber-2",
      startDate: day,
      startTime: "00:00",
      endDate: day,
      endTime: "23:59",
    });
    assert.equal(off.status, 201);

    const res = await api.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-2",
      serviceId: "service-cut",
      date: day,
      time: "14:00",
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /urlop/i);
  });

  t("rezerwacja w przeszłości jest odrzucana (400)", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);
    const res = await api.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-cut",
      date: pastDay(),
      time: "10:00",
    });
    assert.equal(res.status, 400);
    assert.match(res.json.error, /przeszło/i);
  });

  t("klient rezerwuje online dla siebie i może anulować własną wizytę", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.client, DEMO.password);
    const created = await api.post("/api/bookings", {
      barberId: "barber-1",
      serviceId: "service-beard",
      date: futureWorkday(28),
      time: "11:00",
    });
    assert.equal(created.status, 201);
    assert.equal(created.json.booking.source, "online");

    const bookingId = created.json.booking.id;
    const cancelled = await api.patch(`/api/bookings/${bookingId}/status`, { status: "cancelled" });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.json.booking.status, "cancelled");
  });
});

describe("cykl życia statusu wizyty (model dynamiczny §8.1)", () => {
  t("stan końcowy jest nieodwracalny — nie można cofnąć 'zrealizowana' → 'potwierdzona'", async () => {
    const api = createClient(srv.baseUrl);
    await api.login(DEMO.admin, DEMO.password);

    const created = await api.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-2",
      serviceId: "service-cut",
      date: futureWorkday(42),
      time: "16:00",
    });
    assert.equal(created.status, 201);
    const bookingId = created.json.booking.id;

    // Przejście dozwolone: potwierdzona → zrealizowana.
    const completed = await api.patch(`/api/bookings/${bookingId}/status`, { status: "completed" });
    assert.equal(completed.status, 200);
    assert.equal(completed.json.booking.status, "completed");

    // Przejście NIEDOZWOLONE: zrealizowana → potwierdzona (stan końcowy jest trwały).
    const reverted = await api.patch(`/api/bookings/${bookingId}/status`, { status: "confirmed" });
    assert.equal(reverted.status, 400);
  });
});

describe("urlop a rezerwacje", () => {
  t("dodanie urlopu anuluje kolidującą wizytę i powiadamia klienta", async () => {
    const admin = createClient(srv.baseUrl);
    await admin.login(DEMO.admin, DEMO.password);

    const day = futureWorkday(35);
    const booking = await admin.post("/api/bookings", {
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-cut",
      date: day,
      time: "15:00",
    });
    assert.equal(booking.status, 201);

    // Urlop barbera-1 na cały ten dzień.
    const timeOff = await admin.post("/api/time-off", {
      staffId: "barber-1",
      startDate: day,
      startTime: "00:00",
      endDate: day,
      endTime: "23:59",
      reason: "Szkolenie",
    });
    assert.equal(timeOff.status, 201);
    assert.ok(timeOff.json.cancelledCount >= 1, "kolidująca wizyta powinna zostać anulowana");

    // Klient widzi anulowaną wizytę i powiadomienie o odwołaniu.
    const client = createClient(srv.baseUrl);
    await client.login(DEMO.client, DEMO.password);
    const state = await client.get("/api/state");
    assert.ok(
      state.json.data.bookings.some((b) => b.id === booking.json.booking.id && b.status === "cancelled"),
    );
    assert.ok(state.json.data.notifications.some((n) => n.title === "Wizyta odwołana"));
  });
});

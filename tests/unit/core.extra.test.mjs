// Testy jednostkowe — uzupełnienie pokrycia czystej logiki domenowej (src/core.js).
// Każdy test sprawdza jedną funkcję w izolacji, bez bazy i bez sieci.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  addMinutes,
  bookingsForDate,
  buildCalendarSlots,
  calculateBookingValue,
  createBooking,
  customerTimeline,
  dayCapacity,
  enrichBooking,
  formatDate,
  formatShortDate,
  formatTime,
  getUpcomingBookings,
  intervalsOverlap,
  localIntervalOnDate,
  monthGrid,
  normalizeDateInput,
  sameLocalDate,
  searchClients,
  staffAvailableMinutes,
  toDateInputValue,
  updateBookingStatus,
  upsertEntity,
  utilizationForDate,
} from "../../src/core.js";

// Zegar salonu == strefa hosta: ISO budujemy z czasu lokalnego, więc asercje
// na godzinach są niezależne od strefy maszyny uruchamiającej testy.
const localIso = (date, time) => new Date(`${date}T${time}:00`).toISOString();

const services = [
  { id: "cut", name: "Strzyżenie", duration: 45, price: 80, active: true },
  { id: "beard", name: "Broda", duration: 30, price: 55, active: true },
  { id: "old", name: "Wycofana", duration: 30, price: 40, active: false },
];

describe("normalizeDateInput", () => {
  test("łączy datę i godzinę w znacznik ISO", () => {
    assert.equal(normalizeDateInput("2026-05-18", "09:30"), localIso("2026-05-18", "09:30"));
  });

  test("domyślną godziną jest północ", () => {
    assert.equal(normalizeDateInput("2026-05-18"), localIso("2026-05-18", "00:00"));
  });

  test("wartość z 'T' jest traktowana jako pełny znacznik", () => {
    const iso = "2026-05-18T08:15:00.000Z";
    assert.equal(normalizeDateInput(iso), new Date(iso).toISOString());
  });
});

describe("intervalsOverlap", () => {
  test("wykrywa nachodzące się przedziały", () => {
    assert.equal(
      intervalsOverlap(
        localIso("2026-05-18", "09:00"),
        localIso("2026-05-18", "10:00"),
        localIso("2026-05-18", "09:30"),
        localIso("2026-05-18", "10:30"),
      ),
      true,
    );
  });

  test("stykające się przedziały [) nie nachodzą", () => {
    assert.equal(
      intervalsOverlap(
        localIso("2026-05-18", "09:00"),
        localIso("2026-05-18", "10:00"),
        localIso("2026-05-18", "10:00"),
        localIso("2026-05-18", "11:00"),
      ),
      false,
    );
  });
});

describe("localIntervalOnDate (wall-clock salonu)", () => {
  const item = {
    startsAt: localIso("2026-05-18", "09:00"),
    endsAt: localIso("2026-05-18", "09:45"),
    startLocal: "2026-05-18T09:00",
    endLocal: "2026-05-18T09:45",
  };

  test("zwraca minuty od północy dla wskazanego dnia", () => {
    assert.deepEqual(localIntervalOnDate(item, "2026-05-18"), { startMin: 540, endMin: 585 });
  });

  test("zwraca null dla innego dnia", () => {
    assert.equal(localIntervalOnDate(item, "2026-05-19"), null);
  });

  test("przycina element wielodniowy do granic doby", () => {
    const overnight = {
      startLocal: "2026-05-18T23:00",
      endLocal: "2026-05-19T02:00",
      startsAt: localIso("2026-05-18", "23:00"),
      endsAt: localIso("2026-05-19", "02:00"),
    };
    assert.deepEqual(localIntervalOnDate(overnight, "2026-05-18"), { startMin: 1380, endMin: 1440 });
    assert.deepEqual(localIntervalOnDate(overnight, "2026-05-19"), { startMin: 0, endMin: 120 });
  });

  test("fallback do startsAt/endsAt, gdy brak pól wall-clock", () => {
    const noLocal = {
      startsAt: localIso("2026-05-18", "11:00"),
      endsAt: localIso("2026-05-18", "11:30"),
    };
    assert.deepEqual(localIntervalOnDate(noLocal, "2026-05-18"), { startMin: 660, endMin: 690 });
  });
});

describe("createBooking — ścieżki walidacji", () => {
  test("odrzuca nieaktywną usługę", () => {
    const result = createBooking({
      bookings: [],
      services,
      request: { clientId: "c1", barberId: "b1", serviceId: "old", startsAt: localIso("2026-05-18", "10:00") },
    });
    assert.deepEqual(result, { ok: false, reason: "Wybrana usługa jest niedostępna." });
  });

  test("odrzuca nieznaną usługę", () => {
    const result = createBooking({
      bookings: [],
      services,
      request: { clientId: "c1", barberId: "b1", serviceId: "nope", startsAt: localIso("2026-05-18", "10:00") },
    });
    assert.equal(result.ok, false);
  });

  test("domyślnym źródłem jest frontdesk", () => {
    const result = createBooking({
      bookings: [],
      services,
      request: { clientId: "c1", barberId: "b1", serviceId: "cut", startsAt: localIso("2026-05-18", "10:00") },
    });
    assert.equal(result.ok, true);
    assert.equal(result.booking.source, "frontdesk");
    assert.equal(result.booking.endsAt, localIso("2026-05-18", "10:45"));
  });
});

describe("buildCalendarSlots — dni pracy i urlopy", () => {
  test("zwraca pustą siatkę poza dniami pracy", () => {
    const slots = buildCalendarSlots({
      date: "2026-05-17", // niedziela
      barberId: "b1",
      bookings: [],
      openHour: 9,
      closeHour: 11,
      stepMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(slots, []);
  });

  test("urlop blokuje slot i ustawia timeOffId", () => {
    const slots = buildCalendarSlots({
      date: "2026-05-18",
      barberId: "b1",
      bookings: [],
      openHour: 9,
      closeHour: 11,
      stepMinutes: 60,
      timeOff: [
        {
          id: "off-1",
          staffId: "b1",
          startLocal: "2026-05-18T09:00",
          endLocal: "2026-05-18T10:00",
          startsAt: localIso("2026-05-18", "09:00"),
          endsAt: localIso("2026-05-18", "10:00"),
        },
      ],
    });
    assert.deepEqual(
      slots.map((s) => ({ time: s.time, available: s.available, timeOffId: s.timeOffId })),
      [
        { time: "09:00", available: false, timeOffId: "off-1" },
        { time: "10:00", available: true, timeOffId: null },
      ],
    );
  });
});

describe("zestawienia rezerwacji", () => {
  const bookings = [
    { id: "b1", clientId: "c1", barberId: "barber-1", serviceId: "cut", status: "confirmed", startsAt: localIso("2026-05-20", "09:00"), endsAt: localIso("2026-05-20", "09:45") },
    { id: "b2", clientId: "c2", barberId: "barber-1", serviceId: "beard", status: "completed", startsAt: localIso("2026-05-18", "12:00"), endsAt: localIso("2026-05-18", "12:30") },
    { id: "b3", clientId: "c1", barberId: "barber-2", serviceId: "cut", status: "cancelled", startsAt: localIso("2026-05-21", "10:00"), endsAt: localIso("2026-05-21", "10:45") },
    { id: "b4", clientId: "c3", barberId: "barber-1", serviceId: "cut", status: "confirmed", startsAt: localIso("2026-05-19", "08:00"), endsAt: localIso("2026-05-19", "08:45") },
  ];

  test("getUpcomingBookings zwraca tylko potwierdzone przyszłe, posortowane i przycięte", () => {
    const now = new Date(localIso("2026-05-18", "00:00"));
    const upcoming = getUpcomingBookings(bookings, 5, now);
    assert.deepEqual(upcoming.map((b) => b.id), ["b4", "b1"]);
  });

  test("getUpcomingBookings respektuje limit", () => {
    const now = new Date(localIso("2026-05-18", "00:00"));
    assert.equal(getUpcomingBookings(bookings, 1, now).length, 1);
  });

  test("bookingsForDate filtruje po dacie i fryzjerze", () => {
    assert.deepEqual(bookingsForDate(bookings, "2026-05-20").map((b) => b.id), ["b1"]);
    assert.deepEqual(bookingsForDate(bookings, "2026-05-20", "barber-2"), []);
  });

  test("calculateBookingValue pomija anulowane wizyty", () => {
    // b1 cut(80) + b2 beard(55) + b4 cut(80) = 215; b3 anulowana = pominięta.
    assert.equal(calculateBookingValue(bookings, services), 215);
  });

  test("customerTimeline sortuje malejąco po dacie startu", () => {
    assert.deepEqual(customerTimeline(bookings, "c1").map((b) => b.id), ["b3", "b1"]);
  });
});

describe("enrichBooking / updateBookingStatus", () => {
  const clients = [{ id: "c1", name: "Adam" }];
  const staff = [{ id: "barber-1", name: "Bartek" }];
  const svc = [{ id: "cut", name: "Strzyżenie" }];
  const booking = { id: "b1", clientId: "c1", barberId: "barber-1", serviceId: "cut", status: "confirmed" };

  test("enrichBooking dołącza powiązane encje", () => {
    const enriched = enrichBooking(booking, { clients, staff, services: svc });
    assert.equal(enriched.client.name, "Adam");
    assert.equal(enriched.barber.name, "Bartek");
    assert.equal(enriched.service.name, "Strzyżenie");
  });

  test("enrichBooking wstawia null przy braku dopasowania", () => {
    const enriched = enrichBooking({ ...booking, clientId: "x" }, { clients, staff, services: svc });
    assert.equal(enriched.client, null);
  });

  test("updateBookingStatus jest niemutujący i stempluje updatedAt", () => {
    const list = [booking];
    const updated = updateBookingStatus(list, "b1", "completed");
    assert.equal(updated[0].status, "completed");
    assert.match(updated[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(list[0].status, "confirmed", "oryginał nie może być zmodyfikowany");
  });
});

describe("upsertEntity", () => {
  test("dodaje nowy element i generuje id", () => {
    const result = upsertEntity([], { name: "Nowa usługa" });
    assert.equal(result.length, 1);
    assert.match(result[0].id, /^item-/);
  });

  test("aktualizuje istniejący element po id (merge)", () => {
    const items = [{ id: "s1", name: "Stara", price: 50 }];
    const result = upsertEntity(items, { id: "s1", price: 70 });
    assert.deepEqual(result, [{ id: "s1", name: "Stara", price: 70 }]);
  });
});

describe("formatowanie i pomocnicze daty", () => {
  test("formatTime zwraca HH:MM w strefie hosta", () => {
    assert.equal(formatTime(localIso("2026-05-18", "09:05")), "09:05");
  });

  test("formatShortDate zwraca dzień.miesiąc", () => {
    assert.equal(formatShortDate(localIso("2026-05-18", "09:00")), "18.05");
  });

  test("toDateInputValue zwraca YYYY-MM-DD czasu lokalnego", () => {
    assert.equal(toDateInputValue(new Date("2026-01-02T10:00:00")), "2026-01-02");
  });

  test("sameLocalDate porównuje dzień lokalny ze stringiem", () => {
    assert.equal(sameLocalDate(localIso("2026-05-18", "23:30"), "2026-05-18"), true);
    assert.equal(sameLocalDate(localIso("2026-05-18", "23:30"), "2026-05-19"), false);
  });

  test("addMinutes nie mutuje wejścia i przechodzi przez granicę doby", () => {
    const value = "2026-05-18T23:30:00.000Z";
    assert.equal(addMinutes(value, 45), "2026-05-19T00:15:00.000Z");
    assert.equal(value, "2026-05-18T23:30:00.000Z");
  });
});

describe("monthGrid — przypadki brzegowe kalendarza", () => {
  test("luty roku przestępnego ma 29 dni i pełne tygodnie", () => {
    const grid = monthGrid("2024-02");
    assert.equal(grid.length % 7, 0);
    const inMonth = grid.filter((c) => c.inMonth);
    assert.equal(inMonth.length, 29);
    assert.equal(inMonth.at(-1).date, "2024-02-29");
  });

  test("miesiąc zaczynający się w niedzielę ma 6 pustych pól wiodących (układ pon-nd)", () => {
    // 2026-03-01 to niedziela → 6 pól z poprzedniego miesiąca przed 1 marca.
    const grid = monthGrid("2026-03");
    const leading = grid.findIndex((c) => c.inMonth);
    assert.equal(leading, 6);
    assert.equal(grid[0].inMonth, false);
  });
});

describe("gałęzie brzegowe (dopełnienie pokrycia)", () => {
  test("formatDate zwraca polski długi format daty", () => {
    const out = formatDate(localIso("2026-05-18", "09:00"));
    assert.match(out, /18/);
    assert.match(out, /2026/);
    assert.match(out, /maj/i);
  });

  test("searchClients bez frazy zwraca pełną listę", () => {
    const clients = [{ id: "c1", name: "A" }, { id: "c2", name: "B" }];
    assert.equal(searchClients(clients, "   ").length, 2);
  });

  test("staffAvailableMinutes zwraca 0, gdy okno salonu jest zerowe", () => {
    const person = { id: "b1", active: true, workDays: [1, 2, 3, 4, 5] };
    assert.equal(staffAvailableMinutes({ person, date: "2026-05-18", openHour: 9, closeHour: 9 }), 0);
  });

  test("utilizationForDate zwraca 0 dla dnia bez pojemności (zamknięty)", () => {
    const staff = [{ id: "b1", active: false, workDays: [1, 2, 3, 4, 5] }];
    assert.equal(utilizationForDate({ bookings: [], staff, date: "2026-05-18", openHour: 9, closeHour: 17 }), 0);
    assert.equal(dayCapacity({ date: "2026-05-18", staff, openHour: 9, closeHour: 17 }).totalMinutes, 0);
  });

  test("localIntervalOnDate zwraca null, gdy element kończy się o północy danego dnia", () => {
    const overnight = {
      startLocal: "2026-05-17T23:00",
      endLocal: "2026-05-18T00:00",
      startsAt: localIso("2026-05-17", "23:00"),
      endsAt: localIso("2026-05-18", "00:00"),
    };
    assert.equal(localIntervalOnDate(overnight, "2026-05-18"), null);
  });

  test("buildCalendarSlots pomija rezerwacje z innego dnia", () => {
    const slots = buildCalendarSlots({
      date: "2026-05-18",
      barberId: "b1",
      bookings: [
        { id: "x", barberId: "b1", status: "confirmed", startsAt: localIso("2026-05-19", "09:00"), endsAt: localIso("2026-05-19", "10:00") },
      ],
      openHour: 9,
      closeHour: 10,
      stepMinutes: 60,
    });
    assert.deepEqual(slots.map((s) => s.available), [true]);
  });
});

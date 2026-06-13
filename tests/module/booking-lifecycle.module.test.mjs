// Testy modułowe — MODUŁ REZERWACJI.
// Pełny cykl życia wizyty: utworzenie → kontrola kolizji → zmiana statusu →
// wpływ na statystyki, wartość i listę nadchodzących wizyt. Funkcje współpracują
// na wspólnej, ewoluującej liście rezerwacji.
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  bookingStatusCounts,
  calculateBookingValue,
  createBooking,
  getUpcomingBookings,
  hasBookingConflict,
  updateBookingStatus,
} from "../../src/core.js";

const localIso = (date, time) => new Date(`${date}T${time}:00`).toISOString();
const DAY = "2026-05-18";

const services = [
  { id: "cut", name: "Strzyżenie", duration: 45, price: 80, active: true },
  { id: "beard", name: "Broda", duration: 30, price: 55, active: true },
];

describe("cykl życia wizyt na wspólnej liście", () => {
  test("scenariusz: utworzenie, odrzucenie kolizji, statusy, wartość, nadchodzące", () => {
    let bookings = [];

    // 1) Pierwsza wizyta — strzyżenie u barbera-1 o 09:00.
    const first = createBooking({
      bookings,
      services,
      request: { clientId: "c1", barberId: "barber-1", serviceId: "cut", startsAt: localIso(DAY, "09:00"), source: "online" },
    });
    assert.equal(first.ok, true);
    bookings = [...bookings, first.booking];

    // 2) Kolidująca rezerwacja u tego samego fryzjera (09:30) — odrzucona.
    const clash = createBooking({
      bookings,
      services,
      request: { clientId: "c2", barberId: "barber-1", serviceId: "beard", startsAt: localIso(DAY, "09:30") },
    });
    assert.equal(clash.ok, false);

    // 3) Druga, nienachodząca wizyta (10:00 broda) — przyjęta.
    const second = createBooking({
      bookings,
      services,
      request: { clientId: "c3", barberId: "barber-1", serviceId: "beard", startsAt: localIso(DAY, "10:00") },
    });
    assert.equal(second.ok, true);
    bookings = [...bookings, second.booking];

    // Stan po utworzeniu: dwie potwierdzone, łączna wartość 80 + 55 = 135.
    assert.deepEqual(bookingStatusCounts(bookings), { confirmed: 2, completed: 0, cancelled: 0 });
    assert.equal(calculateBookingValue(bookings, services), 135);

    // 4) Pierwszą wizytę oznaczamy jako zrealizowaną.
    bookings = updateBookingStatus(bookings, first.booking.id, "completed");
    assert.deepEqual(bookingStatusCounts(bookings), { confirmed: 1, completed: 1, cancelled: 0 });

    // 5) Drugą wizytę anulujemy — znika z wartości i ze statystyk „aktywnych”.
    //    Obie utworzone wizyty są już w stanach końcowych → 0 potwierdzonych.
    bookings = updateBookingStatus(bookings, second.booking.id, "cancelled");
    assert.deepEqual(bookingStatusCounts(bookings), { confirmed: 0, completed: 1, cancelled: 1 });
    assert.equal(calculateBookingValue(bookings, services), 80); // tylko zrealizowane strzyżenie

    // 6) Po anulowaniu slot 10:00 znów jest wolny dla nowej rezerwacji.
    assert.equal(
      hasBookingConflict(bookings, { barberId: "barber-1", startsAt: localIso(DAY, "10:00"), endsAt: localIso(DAY, "10:30") }),
      false,
    );

    // 7) Brak potwierdzonych wizyt w przyszłości → pusta lista nadchodzących.
    const now = new Date(localIso(DAY, "00:00"));
    assert.deepEqual(getUpcomingBookings(bookings, 5, now), []);
  });

  test("anulowana wizyta nie blokuje slotu innego klienta", () => {
    const bookings = [
      { id: "x1", barberId: "barber-2", status: "cancelled", startsAt: localIso(DAY, "12:00"), endsAt: localIso(DAY, "12:45") },
    ];
    const result = createBooking({
      bookings,
      services,
      request: { clientId: "c9", barberId: "barber-2", serviceId: "cut", startsAt: localIso(DAY, "12:00") },
    });
    assert.equal(result.ok, true);
  });
});

// Testy modułowe — MODUŁ HARMONOGRAMU.
// Sprawdzają, że funkcje kalendarza, pojemności dnia i dostępności fryzjera
// dają spójny obraz tego samego dnia pracy (siatka slotów ↔ minuty ↔ obłożenie).
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildCalendarSlots,
  dayAvailability,
  dayCapacity,
  staffAvailableMinutes,
  utilizationForDate,
} from "../../src/core.js";

const localIso = (date, time) => new Date(`${date}T${time}:00`).toISOString();

const salon = { openHour: 9, closeHour: 17 }; // 8 h = 480 min na fryzjera
const staff = [
  { id: "barber-1", active: true, workDays: [1, 2, 3, 4, 5] },
  { id: "barber-2", active: true, workDays: [1, 2, 3, 4, 5, 6] },
];

const MONDAY = "2026-05-18";
const SUNDAY = "2026-05-17";

describe("dzień roboczy z rezerwacjami i częściowym urlopem", () => {
  // barber-1: dwie wizyty (45 + 60 min). barber-2: urlop 09:00–13:00 (240 min).
  const bookings = [
    { id: "b1", barberId: "barber-1", status: "confirmed", startsAt: localIso(MONDAY, "09:00"), endsAt: localIso(MONDAY, "09:45") },
    { id: "b2", barberId: "barber-1", status: "confirmed", startsAt: localIso(MONDAY, "10:00"), endsAt: localIso(MONDAY, "11:00") },
  ];
  const timeOff = [
    {
      id: "off-1",
      staffId: "barber-2",
      startsAt: localIso(MONDAY, "09:00"),
      endsAt: localIso(MONDAY, "13:00"),
      startLocal: `${MONDAY}T09:00`,
      endLocal: `${MONDAY}T13:00`,
    },
  ];

  test("urlop obniża dostępne minuty fryzjera i pojemność dnia", () => {
    assert.equal(staffAvailableMinutes({ person: staff[0], date: MONDAY, ...salon, timeOff }), 480);
    assert.equal(staffAvailableMinutes({ person: staff[1], date: MONDAY, ...salon, timeOff }), 240);

    const capacity = dayCapacity({ date: MONDAY, staff, ...salon, timeOff });
    assert.equal(capacity.workingStaffCount, 2);
    assert.equal(capacity.totalMinutes, 720); // 480 + 240
  });

  test("siatka slotów barbera-1 wyszarza godziny zajęte wizytami", () => {
    const slots = buildCalendarSlots({ date: MONDAY, barberId: "barber-1", bookings, stepMinutes: 60, ...salon });
    const free = slots.filter((s) => s.available).map((s) => s.time);
    assert.deepEqual(free, ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00"]);
  });

  test("INWARIANT: wolne sloty barbera-2 × krok == jego dostępne minuty", () => {
    const step = 60;
    const slots = buildCalendarSlots({ date: MONDAY, barberId: "barber-2", bookings: [], stepMinutes: step, ...salon, timeOff });
    const freeCount = slots.filter((s) => s.available).length;
    const minutes = staffAvailableMinutes({ person: staff[1], date: MONDAY, ...salon, timeOff });
    assert.equal(freeCount * step, minutes); // 4 sloty × 60 == 240 min
  });

  test("obłożenie liczone jest względem realnej (pomniejszonej) pojemności", () => {
    // 105 zarezerwowanych minut / 720 pojemności ≈ 15 %.
    assert.equal(utilizationForDate({ bookings, staff, date: MONDAY, ...salon, timeOff }), 15);

    const day = dayAvailability({ date: MONDAY, bookings, staff, salon, timeOff });
    assert.equal(day.utilization, 15);
    assert.equal(day.isClosed, false);
    assert.equal(day.isFull, false);
    assert.equal(day.totalMinutes, 720);
    assert.equal(day.bookedMinutes, 105);
  });
});

describe("dzień zamknięty (niedziela)", () => {
  test("brak pracujących fryzjerów → dzień zamknięty i puste siatki", () => {
    const day = dayAvailability({ date: SUNDAY, bookings: [], staff, salon, timeOff: [] });
    // barber-2 pracuje też w sobotę, ale NIE w niedzielę → 0 pracujących.
    assert.equal(day.isClosed, true);
    assert.equal(day.workingStaffCount, 0);
    assert.equal(day.utilization, 0);

    for (const person of staff) {
      const slots = buildCalendarSlots({
        date: SUNDAY,
        barberId: person.id,
        bookings: [],
        stepMinutes: 30,
        workDays: person.workDays,
        ...salon,
      });
      assert.deepEqual(slots, [], `fryzjer ${person.id} nie powinien mieć slotów w niedzielę`);
    }
  });
});

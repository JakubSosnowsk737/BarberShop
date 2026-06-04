import test from "node:test";
import assert from "node:assert/strict";

import {
  addMinutes,
  addMonths,
  bookingStatusCounts,
  buildCalendarSlots,
  createBooking,
  customerTimeline,
  dayAvailability,
  dayCapacity,
  getRoleCapabilities,
  hasBookingConflict,
  monthGrid,
  searchClients,
  staffAvailableMinutes,
  utilizationForDate,
} from "../src/core.js";

const services = [
  { id: "cut", name: "Strzyzenie meskie", duration: 45, price: 80, active: true },
  { id: "beard", name: "Broda", duration: 30, price: 55, active: true },
];

const localIso = (date, time) => new Date(`${date}T${time}:00`).toISOString();

const baseBookings = [
  {
    id: "b1",
    barberId: "barber-1",
    clientId: "client-1",
    serviceId: "cut",
    startsAt: localIso("2026-05-18", "09:00"),
    endsAt: localIso("2026-05-18", "09:45"),
    status: "confirmed",
  },
  {
    id: "b2",
    barberId: "barber-2",
    clientId: "client-2",
    serviceId: "beard",
    startsAt: localIso("2026-05-18", "09:15"),
    endsAt: localIso("2026-05-18", "09:45"),
    status: "completed",
  },
];

test("detects overlapping reservations for the same barber only", () => {
  assert.equal(
    hasBookingConflict(baseBookings, {
      barberId: "barber-1",
      startsAt: localIso("2026-05-18", "09:30"),
      endsAt: localIso("2026-05-18", "10:00"),
    }),
    true,
  );

  assert.equal(
    hasBookingConflict(baseBookings, {
      barberId: "barber-1",
      startsAt: localIso("2026-05-18", "09:45"),
      endsAt: localIso("2026-05-18", "10:15"),
    }),
    false,
  );

  assert.equal(
    hasBookingConflict(baseBookings, {
      barberId: "barber-2",
      startsAt: localIso("2026-05-18", "09:00"),
      endsAt: localIso("2026-05-18", "09:30"),
    }),
    true,
  );
});

test("creates a confirmed booking with service duration and rejects double booking", () => {
  const created = createBooking({
    bookings: baseBookings,
    services,
    request: {
      clientId: "client-3",
      barberId: "barber-1",
      serviceId: "beard",
      startsAt: localIso("2026-05-18", "10:00"),
      source: "online",
    },
  });

  assert.equal(created.ok, true);
  assert.equal(created.booking.status, "confirmed");
  assert.equal(created.booking.endsAt, localIso("2026-05-18", "10:30"));
  assert.match(created.booking.id, /^booking-/);

  const rejected = createBooking({
    bookings: baseBookings,
    services,
    request: {
      clientId: "client-3",
      barberId: "barber-1",
      serviceId: "beard",
      startsAt: localIso("2026-05-18", "09:15"),
      source: "online",
    },
  });

  assert.deepEqual(rejected, {
    ok: false,
    reason: "Termin koliduje z inną rezerwacją tego fryzjera.",
  });
});

test("builds calendar slots with unavailable states per barber", () => {
  const slots = buildCalendarSlots({
    date: "2026-05-18",
    barberId: "barber-1",
    bookings: baseBookings,
    openHour: 9,
    closeHour: 11,
    stepMinutes: 30,
  });

  assert.deepEqual(
    slots.map((slot) => ({ time: slot.time, available: slot.available, bookingId: slot.bookingId })),
    [
      { time: "09:00", available: false, bookingId: "b1" },
      { time: "09:30", available: false, bookingId: "b1" },
      { time: "10:00", available: true, bookingId: null },
      { time: "10:30", available: true, bookingId: null },
    ],
  );
});

test("filters role capabilities for client, barber, and admin views", () => {
  assert.deepEqual(getRoleCapabilities("client"), [
    "marketplace",
    "myBookings",
    "profile",
  ]);
  assert.deepEqual(getRoleCapabilities("barber"), [
    "today",
    "calendar",
    "clients",
    "timeOff",
    "notifications",
  ]);
  assert.deepEqual(getRoleCapabilities("admin"), [
    "dashboard",
    "calendar",
    "bookings",
    "clients",
    "staff",
    "services",
    "timeOff",
    "notifications",
    "users",
    "settings",
  ]);
});

test("summarizes booking statuses and builds customer visit timeline", () => {
  assert.deepEqual(bookingStatusCounts(baseBookings), {
    confirmed: 1,
    completed: 1,
    cancelled: 0,
  });

  assert.deepEqual(customerTimeline(baseBookings, "client-1"), [baseBookings[0]]);
});

test("searches clients by name, phone, and note text", () => {
  const clients = [
    { id: "client-1", name: "Adam Nowak", phone: "501 100 200", notes: "Preferuje fade" },
    { id: "client-2", name: "Marek Kowalski", phone: "502 300 400", notes: "Alergia na kosmetyk" },
  ];

  assert.deepEqual(searchClients(clients, "fade").map((client) => client.id), ["client-1"]);
  assert.deepEqual(searchClients(clients, "502").map((client) => client.id), ["client-2"]);
  assert.deepEqual(searchClients(clients, "brak"), []);
});

test("adds minutes using ISO timestamps without mutating the input", () => {
  const value = "2026-05-18T12:00:00.000Z";

  assert.equal(addMinutes(value, 75), "2026-05-18T13:15:00.000Z");
  assert.equal(value, "2026-05-18T12:00:00.000Z");
});

test("dayAvailability computes utilization and flags full / closed days", () => {
  const salon = { openHour: 9, closeHour: 11 };
  const staff = [
    { id: "barber-1", active: true, workDays: [1, 2, 3, 4, 5] },
    { id: "barber-2", active: true, workDays: [1, 2, 3, 4, 5] },
  ];
  // 2026-05-18 is Monday — 2 barbers x 120 min = 240 min capacity
  const partialBookings = [
    {
      id: "b1",
      barberId: "barber-1",
      status: "confirmed",
      startsAt: localIso("2026-05-18", "09:00"),
      endsAt: localIso("2026-05-18", "10:00"),
    },
  ];
  const partial = dayAvailability({
    date: "2026-05-18",
    bookings: partialBookings,
    staff,
    salon,
  });
  assert.equal(partial.utilization, 25);
  assert.equal(partial.isFull, false);
  assert.equal(partial.isClosed, false);

  const fullBookings = [
    ...partialBookings,
    {
      id: "b2",
      barberId: "barber-1",
      status: "confirmed",
      startsAt: localIso("2026-05-18", "10:00"),
      endsAt: localIso("2026-05-18", "11:00"),
    },
    {
      id: "b3",
      barberId: "barber-2",
      status: "confirmed",
      startsAt: localIso("2026-05-18", "09:00"),
      endsAt: localIso("2026-05-18", "11:00"),
    },
  ];
  const full = dayAvailability({
    date: "2026-05-18",
    bookings: fullBookings,
    staff,
    salon,
  });
  assert.equal(full.isFull, true);
  assert.equal(full.utilization, 100);

  // 2026-05-17 is Sunday — neither barber works, salon is closed
  const closed = dayAvailability({
    date: "2026-05-17",
    bookings: partialBookings,
    staff,
    salon,
  });
  assert.equal(closed.isClosed, true);
  assert.equal(closed.workingStaffCount, 0);
});

test("staffAvailableMinutes subtracts partial time-off within working hours", () => {
  const person = { id: "barber-1", active: true, workDays: [1, 2, 3, 4, 5] };
  const baseArgs = { person, date: "2026-05-18", openHour: 9, closeHour: 17 };

  // Bez urlopu: pełne 8h = 480 min.
  assert.equal(staffAvailableMinutes({ ...baseArgs, timeOff: [] }), 480);

  // Urlop 12:00–14:00 → -120 min = 360.
  assert.equal(
    staffAvailableMinutes({
      ...baseArgs,
      timeOff: [
        { staffId: "barber-1", startsAt: localIso("2026-05-18", "12:00"), endsAt: localIso("2026-05-18", "14:00") },
      ],
    }),
    360,
  );

  // Urlop wykraczający poza godziny pracy liczy tylko część w oknie (08:00–11:00 → 09:00–11:00 = 120 off → 360).
  assert.equal(
    staffAvailableMinutes({
      ...baseArgs,
      timeOff: [
        { staffId: "barber-1", startsAt: localIso("2026-05-18", "08:00"), endsAt: localIso("2026-05-18", "11:00") },
      ],
    }),
    360,
  );

  // Nieaktywny fryzjer = 0.
  assert.equal(
    staffAvailableMinutes({ ...baseArgs, person: { ...person, active: false }, timeOff: [] }),
    0,
  );

  // Dzień wolny wg grafiku (niedziela) = 0.
  assert.equal(staffAvailableMinutes({ ...baseArgs, date: "2026-05-17", timeOff: [] }), 0);
});

test("dayCapacity and utilization account for partial time-off", () => {
  const staff = [
    { id: "barber-1", active: true, workDays: [1, 2, 3, 4, 5] },
    { id: "barber-2", active: true, workDays: [1, 2, 3, 4, 5] },
  ];
  const timeOff = [
    { staffId: "barber-2", startsAt: localIso("2026-05-18", "09:00"), endsAt: localIso("2026-05-18", "11:00") },
  ];
  // openHour 9 closeHour 11 → 120 min each; barber-2 has full window off → only barber-1 counts.
  const capacity = dayCapacity({
    date: "2026-05-18",
    staff,
    openHour: 9,
    closeHour: 11,
    timeOff,
  });
  assert.equal(capacity.totalMinutes, 120);
  assert.equal(capacity.workingStaffCount, 1);

  const bookings = [
    {
      id: "b1",
      barberId: "barber-1",
      status: "confirmed",
      startsAt: localIso("2026-05-18", "09:00"),
      endsAt: localIso("2026-05-18", "10:00"),
    },
  ];
  // 60 booked / 120 capacity = 50% (a nie 25% jak bez uwzględnienia urlopu).
  assert.equal(
    utilizationForDate({ bookings, staff, date: "2026-05-18", openHour: 9, closeHour: 11, timeOff }),
    50,
  );
});

test("monthGrid produces aligned weeks and addMonths shifts month strings", () => {
  const grid = monthGrid("2026-05");
  assert.equal(grid.length % 7, 0);
  const inMonth = grid.filter((cell) => cell.inMonth);
  assert.equal(inMonth.length, 31);
  assert.equal(inMonth[0].date, "2026-05-01");
  assert.equal(inMonth.at(-1).date, "2026-05-31");

  assert.equal(addMonths("2026-05", 1), "2026-06");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(addMonths("2026-12", 1), "2027-01");
});

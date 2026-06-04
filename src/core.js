export const ROLE_CAPABILITIES = {
  client: ["marketplace", "myBookings", "profile"],
  barber: ["today", "calendar", "clients", "timeOff", "notifications"],
  admin: [
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
  ],
};

export function addMinutes(isoValue, minutes) {
  const date = new Date(isoValue);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return date.toISOString();
}

export function normalizeDateInput(dateValue, timeValue = "00:00") {
  if (dateValue.includes("T")) {
    return new Date(dateValue).toISOString();
  }

  return new Date(`${dateValue}T${timeValue}:00`).toISOString();
}

export function formatTime(isoValue) {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoValue));
}

export function formatDate(isoValue) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(isoValue));
}

export function formatShortDate(isoValue) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(isoValue));
}

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sameLocalDate(isoValue, dateValue) {
  return toDateInputValue(new Date(isoValue)) === dateValue;
}

export function intervalsOverlap(startA, endA, startB, endB) {
  return new Date(startA) < new Date(endB) && new Date(startB) < new Date(endA);
}

function minutesOfDay(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

// Zwraca przedział [startMin, endMin) zajętości danego elementu (rezerwacji lub
// urlopu) w obrębie wybranego dnia, w minutach od północy. Preferuje wall-clock
// salonu z serwera (startLocal/endLocal) — dzięki temu wynik nie zależy od strefy
// przeglądarki (C7). Bez tych pól wraca do czasu lokalnego przeglądarki.
export function localIntervalOnDate(item, date) {
  let startDate;
  let endDate;
  let startMin;
  let endMin;

  if (item.startLocal && item.endLocal) {
    startDate = item.startLocal.slice(0, 10);
    endDate = item.endLocal.slice(0, 10);
    startMin = minutesOfDay(item.startLocal.slice(11, 16));
    endMin = minutesOfDay(item.endLocal.slice(11, 16));
  } else {
    const s = new Date(item.startsAt);
    const e = new Date(item.endsAt);
    startDate = toDateInputValue(s);
    endDate = toDateInputValue(e);
    startMin = s.getHours() * 60 + s.getMinutes();
    endMin = e.getHours() * 60 + e.getMinutes();
  }

  if (endDate < date || startDate > date) {
    return null;
  }

  const clampedStart = startDate < date ? 0 : startMin;
  const clampedEnd = endDate > date ? 24 * 60 : endMin;

  if (clampedEnd <= clampedStart) {
    return null;
  }

  return { startMin: clampedStart, endMin: clampedEnd };
}

function occupiesSlot(item, date, slotStartMin, slotEndMin) {
  const interval = localIntervalOnDate(item, date);
  if (!interval) {
    return false;
  }
  return interval.startMin < slotEndMin && slotStartMin < interval.endMin;
}

export function hasBookingConflict(bookings, candidate, ignoredBookingId = null) {
  return bookings.some((booking) => {
    if (booking.id === ignoredBookingId || booking.status === "cancelled") {
      return false;
    }

    return (
      booking.barberId === candidate.barberId &&
      intervalsOverlap(
        candidate.startsAt,
        candidate.endsAt,
        booking.startsAt,
        booking.endsAt,
      )
    );
  });
}

export function createBooking({ bookings, services, request }) {
  const service = services.find((item) => item.id === request.serviceId && item.active);

  if (!service) {
    return {
      ok: false,
      reason: "Wybrana usługa jest niedostępna.",
    };
  }

  const startsAt = normalizeDateInput(request.startsAt);
  const endsAt = addMinutes(startsAt, service.duration);
  const candidate = {
    barberId: request.barberId,
    startsAt,
    endsAt,
  };

  if (hasBookingConflict(bookings, candidate)) {
    return {
      ok: false,
      reason: "Termin koliduje z inną rezerwacją tego fryzjera.",
    };
  }

  return {
    ok: true,
    booking: {
      id: `booking-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      clientId: request.clientId,
      barberId: request.barberId,
      serviceId: request.serviceId,
      startsAt,
      endsAt,
      status: "confirmed",
      source: request.source || "frontdesk",
      notes: request.notes || "",
      createdAt: new Date().toISOString(),
    },
  };
}

export function buildCalendarSlots({
  date,
  barberId,
  bookings,
  openHour,
  closeHour,
  stepMinutes,
  workDays = null,
  timeOff = [],
}) {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (Array.isArray(workDays) && workDays.length && !workDays.includes(dayOfWeek)) {
    return [];
  }

  const slots = [];
  const bookingsForBarber = bookings.filter(
    (item) => item.barberId === barberId && item.status !== "cancelled",
  );
  const offForBarber = Array.isArray(timeOff)
    ? timeOff.filter((entry) => entry.staffId === barberId)
    : [];

  const openMin = openHour * 60;
  const closeMin = closeHour * 60;

  for (let slotStartMin = openMin; slotStartMin < closeMin; slotStartMin += stepMinutes) {
    const slotEndMin = slotStartMin + stepMinutes;
    const booking = bookingsForBarber.find((item) =>
      occupiesSlot(item, date, slotStartMin, slotEndMin),
    );
    const offEntry = offForBarber.find((entry) =>
      occupiesSlot(entry, date, slotStartMin, slotEndMin),
    );

    const hh = String(Math.floor(slotStartMin / 60)).padStart(2, "0");
    const mm = String(slotStartMin % 60).padStart(2, "0");

    slots.push({
      time: `${hh}:${mm}`,
      startsAt: `${date}T${hh}:${mm}`,
      available: !booking && !offEntry,
      bookingId: booking?.id || null,
      timeOffId: offEntry?.id || null,
    });
  }

  return slots;
}

export function getRoleCapabilities(role) {
  return [...(ROLE_CAPABILITIES[role] || [])];
}

export function bookingStatusCounts(bookings) {
  return bookings.reduce(
    (counts, booking) => {
      if (Object.hasOwn(counts, booking.status)) {
        counts[booking.status] += 1;
      }
      return counts;
    },
    { confirmed: 0, completed: 0, cancelled: 0 },
  );
}

export function customerTimeline(bookings, clientId) {
  return bookings
    .filter((booking) => booking.clientId === clientId)
    .toSorted((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
}

export function searchClients(clients, query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return clients;
  }

  return clients.filter((client) =>
    [client.name, client.phone, client.email, client.notes]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalized)),
  );
}

export function getUpcomingBookings(bookings, limit = 5, now = new Date()) {
  return bookings
    .filter((booking) => booking.status === "confirmed" && new Date(booking.startsAt) >= now)
    .toSorted((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, limit);
}

export function bookingsForDate(bookings, date, barberId = "all") {
  return bookings
    .filter((booking) => sameLocalDate(booking.startsAt, date))
    .filter((booking) => barberId === "all" || booking.barberId === barberId)
    .toSorted((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

export function calculateBookingValue(bookings, services) {
  const servicePrice = new Map(services.map((service) => [service.id, service.price]));

  return bookings
    .filter((booking) => booking.status !== "cancelled")
    .reduce((sum, booking) => sum + (servicePrice.get(booking.serviceId) || 0), 0);
}

// Ile minut realnie pracuje dany fryzjer w wybranym dniu: pełne okno salonu
// pomniejszone o część urlopu nachodzącą na godziny pracy. 0 = nieaktywny,
// dzień wolny wg grafiku albo cały dzień zabrany urlopem.
export function staffAvailableMinutes({ person, date, openHour, closeHour, timeOff = [] }) {
  if (!person.active) {
    return 0;
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (
    Array.isArray(person.workDays) &&
    person.workDays.length &&
    !person.workDays.includes(dayOfWeek)
  ) {
    return 0;
  }

  const base = Math.max(0, (closeHour - openHour) * 60);
  if (!base) {
    return 0;
  }

  const windowStart = new Date(`${date}T${String(openHour).padStart(2, "0")}:00:00`).getTime();
  const windowEnd = new Date(`${date}T${String(closeHour).padStart(2, "0")}:00:00`).getTime();

  const offMinutes = (Array.isArray(timeOff) ? timeOff : [])
    .filter((entry) => entry.staffId === person.id)
    .reduce((sum, entry) => {
      const overlapStart = Math.max(windowStart, new Date(entry.startsAt).getTime());
      const overlapEnd = Math.min(windowEnd, new Date(entry.endsAt).getTime());
      return sum + Math.max(0, (overlapEnd - overlapStart) / 60000);
    }, 0);

  return Math.max(0, base - offMinutes);
}

// Łączna pojemność salonu (w minutach) i liczba realnie pracujących fryzjerów w dniu.
export function dayCapacity({ date, staff, openHour, closeHour, timeOff = [] }) {
  let totalMinutes = 0;
  let workingStaffCount = 0;

  for (const person of staff) {
    const minutes = staffAvailableMinutes({ person, date, openHour, closeHour, timeOff });
    if (minutes > 0) {
      workingStaffCount += 1;
      totalMinutes += minutes;
    }
  }

  return { totalMinutes, workingStaffCount };
}

function bookedMinutesForDate(bookings, date) {
  return bookingsForDate(bookings, date)
    .filter((booking) => booking.status !== "cancelled")
    .reduce(
      (sum, booking) =>
        sum + Math.max(0, (new Date(booking.endsAt) - new Date(booking.startsAt)) / 60000),
      0,
    );
}

export function utilizationForDate({ bookings, staff, date, openHour, closeHour, timeOff = [] }) {
  const { totalMinutes } = dayCapacity({ date, staff, openHour, closeHour, timeOff });
  if (!totalMinutes) {
    return 0;
  }
  const bookedMinutes = bookedMinutesForDate(bookings, date);
  return Math.min(100, Math.round((bookedMinutes / totalMinutes) * 100));
}

export function enrichBooking(booking, { clients, staff, services }) {
  return {
    ...booking,
    client: clients.find((client) => client.id === booking.clientId) || null,
    barber: staff.find((person) => person.id === booking.barberId) || null,
    service: services.find((service) => service.id === booking.serviceId) || null,
  };
}

export function updateBookingStatus(bookings, bookingId, status) {
  return bookings.map((booking) =>
    booking.id === bookingId
      ? {
          ...booking,
          status,
          updatedAt: new Date().toISOString(),
        }
      : booking,
  );
}

export function dayAvailability({ date, bookings, staff, salon, timeOff = [] }) {
  const { totalMinutes, workingStaffCount } = dayCapacity({
    date,
    staff,
    openHour: salon.openHour,
    closeHour: salon.closeHour,
    timeOff,
  });
  const bookedMinutes = bookedMinutesForDate(bookings, date);
  const utilization = totalMinutes
    ? Math.min(100, Math.round((bookedMinutes / totalMinutes) * 100))
    : 0;

  return {
    date,
    workingStaffCount,
    isClosed: workingStaffCount === 0,
    isFull: totalMinutes > 0 && bookedMinutes >= totalMinutes,
    bookedMinutes,
    totalMinutes,
    utilization,
  };
}

export function addMonths(monthString, delta) {
  const [year, month] = monthString.split("-").map(Number);
  const target = new Date(year, month - 1 + delta, 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
}

export function monthGrid(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const cells = [];

  for (let offset = leadingBlanks; offset > 0; offset -= 1) {
    const d = new Date(year, month - 1, 1 - offset);
    cells.push({ date: toDateInputValue(d), inMonth: false });
  }

  for (let day = 1; day <= lastOfMonth.getDate(); day += 1) {
    cells.push({ date: toDateInputValue(new Date(year, month - 1, day)), inMonth: true });
  }

  while (cells.length % 7) {
    const trailing = cells.length - leadingBlanks - lastOfMonth.getDate() + 1;
    cells.push({
      date: toDateInputValue(new Date(year, month, trailing)),
      inMonth: false,
    });
  }

  return cells;
}

export function upsertEntity(items, item) {
  if (item.id && items.some((entry) => entry.id === item.id)) {
    return items.map((entry) => (entry.id === item.id ? { ...entry, ...item } : entry));
  }

  return [
    ...items,
    {
      ...item,
      id: item.id || `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    },
  ];
}

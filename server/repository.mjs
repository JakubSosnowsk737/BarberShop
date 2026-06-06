import { createHash, randomUUID } from "node:crypto";

import {
  hashPassword,
  normalizeEmail,
  normalizePhone,
  sanitizeUser,
  verifyPassword,
} from "./auth.mjs";
import { initialData } from "../src/data.js";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "1234";
const ALLOWED_BOOKING_STATUSES = new Set(["confirmed", "completed", "cancelled"]);
const ALLOWED_SLOT_STEPS = new Set([15, 30, 45, 60]);
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function id(prefix) {
  return `${prefix}-${randomUUID()}`;
}

function requireString(value, field, { min = 1, max = 200 } = {}) {
  const trimmed = String(value || "").trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw badRequest(`Pole "${field}" jest wymagane.`);
  }
  return trimmed;
}

function requireNumber(value, field, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max || (integer && !Number.isInteger(num))) {
    throw badRequest(`Pole "${field}" ma niepoprawną wartość.`);
  }
  return num;
}

function sessionHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function iso(value) {
  return value ? new Date(value).toISOString() : "";
}

function mapSalon(row) {
  return {
    name: row.name,
    city: row.city,
    address: row.address,
    phone: row.phone,
    email: row.email,
    plan: row.plan,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    openHour: row.open_hour,
    closeHour: row.close_hour,
    slotStep: row.slot_step,
    onboarding: row.onboarding,
  };
}

function mapStaff(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    title: row.title,
    specialty: row.specialty,
    active: row.active,
    workDays: row.work_days,
    color: row.color,
  };
}

function mapClient(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    tags: row.tags,
    lastVisit: iso(row.last_visit),
  };
}

function mapService(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    duration: row.duration,
    price: row.price,
    active: row.active,
    description: row.description,
  };
}

// Wall-clock w strefie salonu ("YYYY-MM-DDTHH:MM"), aby front liczył sloty
// niezależnie od strefy przeglądarki (C7).
function localStamp(value) {
  if (!value) {
    return "";
  }
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

function mapBooking(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    barberId: row.barber_id,
    serviceId: row.service_id,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    startLocal: localStamp(row.starts_at),
    endLocal: localStamp(row.ends_at),
    status: row.status,
    source: row.source,
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapTimeOff(row) {
  return {
    id: row.id,
    staffId: row.staff_id,
    startsAt: iso(row.starts_at),
    endsAt: iso(row.ends_at),
    startLocal: localStamp(row.starts_at),
    endLocal: localStamp(row.ends_at),
    reason: row.reason,
    createdAt: iso(row.created_at),
  };
}

function mapNotification(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    userId: row.user_id ?? null,
    createdAt: iso(row.created_at),
    read: row.read,
  };
}

async function userWithLinks(pool, where, values) {
  const result = await pool.query(
    `
      select
        u.id,
        u.role,
        u.name,
        u.email,
        u.password_hash,
        c.id as client_id,
        s.id as staff_id
      from users u
      left join clients c on c.user_id = u.id
      left join staff s on s.user_id = u.id
      ${where}
      limit 1
    `,
    values,
  );

  return result.rows[0] || null;
}

export async function seedDatabase(pool) {
  const count = await pool.query("select count(*)::int as count from users");

  if (count.rows[0].count > 0) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `
        insert into salon (
          id, name, city, address, phone, email, plan, rating, review_count,
          open_hour, close_hour, slot_step, onboarding
        )
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        on conflict (id) do nothing
      `,
      [
        "main",
        initialData.salon.name,
        initialData.salon.city,
        initialData.salon.address,
        initialData.salon.phone,
        initialData.salon.email,
        initialData.salon.plan,
        initialData.salon.rating,
        initialData.salon.reviewCount,
        initialData.salon.openHour,
        initialData.salon.closeHour,
        initialData.salon.slotStep,
        JSON.stringify(initialData.salon.onboarding),
      ],
    );

    for (const user of initialData.users) {
      await client.query(
        `
          insert into users (id, role, name, email, password_hash)
          values ($1,$2,$3,$4,$5)
          on conflict (id) do nothing
        `,
        [
          user.id,
          user.role,
          user.name,
          normalizeEmail(user.email),
          await hashPassword(DEMO_PASSWORD),
        ],
      );
    }

    for (const person of initialData.staff) {
      await client.query(
        `
          insert into staff (id, user_id, name, title, specialty, active, work_days, color)
          values ($1,$2,$3,$4,$5,$6,$7,$8)
          on conflict (id) do nothing
        `,
        [
          person.id,
          person.userId ?? null,
          person.name,
          person.title,
          person.specialty,
          person.active,
          JSON.stringify(person.workDays),
          person.color,
        ],
      );
    }

    for (const record of initialData.clients) {
      await client.query(
        `
          insert into clients (id, user_id, name, phone, email, notes, tags, last_visit)
          values ($1,$2,$3,$4,$5,$6,$7,$8)
          on conflict (id) do nothing
        `,
        [
          record.id,
          record.userId ?? null,
          record.name,
          record.phone,
          record.email ? normalizeEmail(record.email) : null,
          record.notes,
          JSON.stringify(record.tags),
          record.lastVisit || null,
        ],
      );
    }

    for (const service of initialData.services) {
      await client.query(
        `
          insert into services (id, name, category, duration, price, active, description)
          values ($1,$2,$3,$4,$5,$6,$7)
          on conflict (id) do nothing
        `,
        [
          service.id,
          service.name,
          service.category,
          service.duration,
          service.price,
          service.active,
          service.description,
        ],
      );
    }

    for (const booking of initialData.bookings) {
      await client.query(
        `
          insert into bookings (
            id, client_id, barber_id, service_id, starts_at, ends_at,
            status, source, notes, created_at
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          on conflict (id) do nothing
        `,
        [
          booking.id,
          booking.clientId,
          booking.barberId,
          booking.serviceId,
          booking.startsAt,
          booking.endsAt,
          booking.status,
          booking.source,
          booking.notes,
          booking.createdAt,
        ],
      );
    }

    for (const notification of initialData.notifications) {
      await client.query(
        `
          insert into notifications (id, type, title, message, created_at, read)
          values ($1,$2,$3,$4,$5,$6)
          on conflict (id) do nothing
        `,
        [
          notification.id,
          notification.type,
          notification.title,
          notification.message,
          notification.createdAt,
          notification.read,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetDatabase(pool) {
  await pool.query(`
    truncate table
      sessions,
      notifications,
      time_off,
      bookings,
      clients,
      staff,
      services,
      salon,
      users
    restart identity cascade
  `);
  await seedDatabase(pool);
}

export async function deleteExpiredSessions(pool) {
  const result = await pool.query("delete from sessions where expires_at < now()");
  return result.rowCount || 0;
}

function visibleNotificationsForUser(notifications, user) {
  if (!user) {
    return notifications.filter((notice) => notice.userId == null);
  }
  if (user.role === "admin") {
    return notifications;
  }
  if (user.role === "barber") {
    return notifications.filter(
      (notice) => notice.userId == null || notice.userId === user.id,
    );
  }
  // client — wyłącznie powiadomienia zaadresowane do jego konta
  return notifications.filter((notice) => notice.userId === user.id);
}

// Ograniczenia rozmiaru odpowiedzi /api/state, by payload nie rósł bez końca (C18).
const STATE_BOOKINGS_WINDOW_DAYS = Number(process.env.STATE_BOOKINGS_WINDOW_DAYS || 365);
const STATE_NOTIFICATIONS_LIMIT = Number(process.env.STATE_NOTIFICATIONS_LIMIT || 200);
const STATE_TIMEOFF_WINDOW_DAYS = Number(process.env.STATE_TIMEOFF_WINDOW_DAYS || 365);

export async function getState(pool, user = null) {
  const [salon, users, staff, services, clients, bookings, notifications, timeOff] =
    await Promise.all([
      pool.query("select * from salon where id = 'main'"),
      pool.query(`
        select u.id, u.role, u.name, u.email, c.id as client_id, s.id as staff_id
        from users u
        left join clients c on c.user_id = u.id
        left join staff s on s.user_id = u.id
        order by u.created_at
      `),
      pool.query("select * from staff order by name"),
      pool.query("select * from services order by category, name"),
      pool.query("select * from clients order by name"),
      pool.query(
        `
          select * from bookings
          where starts_at >= now() - make_interval(days => $1::int)
          order by starts_at
        `,
        [STATE_BOOKINGS_WINDOW_DAYS],
      ),
      pool.query(
        "select * from notifications order by created_at desc limit $1::int",
        [STATE_NOTIFICATIONS_LIMIT],
      ),
      pool.query(
        `
          select * from time_off
          where ends_at >= now() - make_interval(days => $1::int)
          order by starts_at
        `,
        [STATE_TIMEOFF_WINDOW_DAYS],
      ),
    ]);

  const allNotifications = notifications.rows.map(mapNotification);
  const full = {
    salon: mapSalon(salon.rows[0]),
    users: users.rows.map(sanitizeUser),
    staff: staff.rows.map(mapStaff),
    services: services.rows.map(mapService),
    clients: clients.rows.map(mapClient),
    bookings: bookings.rows.map(mapBooking),
    notifications: visibleNotificationsForUser(allNotifications, user),
    timeOff: timeOff.rows.map(mapTimeOff),
  };

  return scopeStateForUser(full, user);
}

function scopeStateForUser(state, user) {
  if (!user || user.role === "admin") {
    return state;
  }

  if (user.role === "barber") {
    // Fryzjer obsługuje CRM, ale nie potrzebuje listy kont użytkowników.
    return { ...state, users: [] };
  }

  // Klient widzi wyłącznie własne dane. Urlopy zostają (potrzebne do
  // wyznaczania wolnych slotów), ale bez powodu nieobecności.
  const ownClientId = user.clientId;
  return {
    ...state,
    users: [],
    clients: state.clients.filter((client) => client.id === ownClientId),
    bookings: state.bookings.filter((booking) => booking.clientId === ownClientId),
    timeOff: state.timeOff.map((entry) => ({ ...entry, reason: "" })),
  };
}

export async function authenticateUser(pool, email, password) {
  const user = await userWithLinks(pool, "where u.email = $1", [normalizeEmail(email)]);

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return null;
  }

  return sanitizeUser(user);
}

export async function findUserById(pool, userId) {
  return sanitizeUser(await userWithLinks(pool, "where u.id = $1", [userId]));
}

export async function createSession(pool, userId, token, expiresAt) {
  await pool.query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1,$2,$3)",
    [sessionHash(token), userId, expiresAt],
  );
}

export async function findUserBySessionToken(pool, token) {
  if (!token) {
    return null;
  }

  const result = await pool.query(
    `
      select
        u.id,
        u.role,
        u.name,
        u.email,
        c.id as client_id,
        s.id as staff_id
      from sessions se
      join users u on u.id = se.user_id
      left join clients c on c.user_id = u.id
      left join staff s on s.user_id = u.id
      where se.token_hash = $1 and se.expires_at > now()
      limit 1
    `,
    [sessionHash(token)],
  );

  return sanitizeUser(result.rows[0] || null);
}

export async function deleteSession(pool, token) {
  if (!token) {
    return;
  }

  await pool.query("delete from sessions where token_hash = $1", [sessionHash(token)]);
}

// Szuka istniejącej, NIEpołączonej karty gościa, która należy do tej samej osoby.
// Warunek bezpieczny: ten sam (znormalizowany) telefon ORAZ e-mail zgodny —
// czyli karta ma ten sam e-mail albo nie ma e-maila w ogóle. Łączymy tylko gdy
// kandydat jest dokładnie jeden (brak dwuznaczności = brak ryzyka błędnego scalenia).
async function findGuestCardToLink(txn, { email, phoneKey }) {
  if (!phoneKey) {
    return null;
  }
  const result = await txn.query(
    `
      select id from clients
      where user_id is null
        and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = $1
        and (email is null or email = '' or lower(email) = $2)
    `,
    [phoneKey, email],
  );
  return result.rows.length === 1 ? result.rows[0].id : null;
}

export async function registerClientUser(pool, input) {
  const userId = id("user");
  const passwordHash = await hashPassword(input.password);
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const phone = input.phone.trim();
  const phoneKey = normalizePhone(phone);
  const client = await pool.connect();

  let clientId;
  let linked = false;

  try {
    await client.query("begin");
    await client.query(
      `
        insert into users (id, role, name, email, password_hash)
        values ($1,'client',$2,$3,$4)
      `,
      [userId, name, email, passwordHash],
    );

    const matchedId = await findGuestCardToLink(client, { email, phoneKey });

    if (matchedId) {
      // Podpinamy istniejącą kartę gościa (zachowując historię wizyt i notatki).
      clientId = matchedId;
      linked = true;
      await client.query(
        `
          update clients
          set user_id = $2,
              email = coalesce(nullif(email, ''), $3),
              tags = case
                when tags @> '["online"]'::jsonb then tags
                else tags || '["online"]'::jsonb
              end
          where id = $1
        `,
        [clientId, userId, email],
      );
    } else {
      clientId = id("client");
      await client.query(
        `
          insert into clients (id, user_id, name, phone, email, notes, tags)
          values ($1,$2,$3,$4,$5,'', '["online"]'::jsonb)
        `,
        [clientId, userId, name, phone, email],
      );
    }

    await client.query(
      `
        insert into notifications (id, type, title, message)
        values ($1,'system',$2,$3)
      `,
      [
        id("notice"),
        linked ? "Połączono kartę klienta" : "Nowe konto klienta",
        linked
          ? `${name} założył konto online i połączył je z istniejącą kartą klienta.`
          : `${name} zarejestrował konto klienta.`,
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");

    if (error.code === "23505") {
      const friendly = new Error("Konto z tym adresem e-mail już istnieje.");
      friendly.statusCode = 409;
      throw friendly;
    }

    throw error;
  } finally {
    client.release();
  }

  return {
    id: userId,
    role: "client",
    name,
    email,
    clientId,
    staffId: null,
    linkedExistingCard: linked,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const SALON_TZ = process.env.SALON_TZ || "Europe/Warsaw";
// 0 = bez minimalnego wyprzedzenia. Horyzont domyślnie 120 dni dla rezerwacji klienta.
export const CLIENT_MIN_LEAD_MINUTES = Number(process.env.BOOKING_MIN_LEAD_MINUTES || 0);
export const CLIENT_MAX_ADVANCE_DAYS = Number(process.env.BOOKING_MAX_ADVANCE_DAYS || 120);

function parseDateTimeInputs(body) {
  let dateStr = body?.date;
  let timeStr = body?.time;

  if ((!dateStr || !timeStr) && body?.startsAt) {
    const iso = String(body.startsAt);
    const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      dateStr = dateStr || match[1];
      timeStr = timeStr || `${match[2]}:${match[3]}`;
    }
  }

  if (!DATE_RE.test(String(dateStr || "")) || !TIME_RE.test(String(timeStr || ""))) {
    throw badRequest("Nieprawidłowa data lub godzina.");
  }
  return { dateStr, timeStr };
}

function addMinutesToWallClock(dateStr, timeStr, addMinutes) {
  const [hh, mm] = timeStr.split(":").map(Number);
  const total = hh * 60 + mm + addMinutes;
  const [year, month, day] = dateStr.split("-").map(Number);
  const wallDate = new Date(year, month - 1, day);
  wallDate.setMinutes(total);
  const newDate = `${wallDate.getFullYear()}-${String(wallDate.getMonth() + 1).padStart(2, "0")}-${String(wallDate.getDate()).padStart(2, "0")}`;
  const newTime = `${String(wallDate.getHours()).padStart(2, "0")}:${String(wallDate.getMinutes()).padStart(2, "0")}`;
  return { dateStr: newDate, timeStr: newTime, minutesOfDay: total };
}

function weekdayFromDateString(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  // UTC midnight → getUTCDay() jest niezależne od strefy procesu Node.
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function salonNowParts() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    // niektóre ICU zwracają "24" o północy
    time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`,
  };
}

function isPastWallClock(dateStr, timeStr) {
  const now = salonNowParts();
  if (dateStr < now.date) return true;
  if (dateStr > now.date) return false;
  return timeStr < now.time;
}

// Mapuje wall-clock na fikcyjny UTC, by liczyć RÓŻNICĘ minut niezależnie od strefy
// (realny offset salonu skraca się po obu stronach odejmowania).
function wallClockToComparableMs(dateStr, timeStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hh, mm);
}

function minutesFromSalonNow(dateStr, timeStr) {
  const now = salonNowParts();
  return (
    (wallClockToComparableMs(dateStr, timeStr) -
      wallClockToComparableMs(now.date, now.time)) /
    60000
  );
}

function isoToWallClock(value) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(value)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`,
  };
}

async function assertBookingSlotAllowed(
  pool,
  { clientId, barberId, dateStr, timeStr, duration, allowPast = false, clientLimits = null },
) {
  const end = addMinutesToWallClock(dateStr, timeStr, duration);
  const [hh, mm] = timeStr.split(":").map(Number);
  const startMinutesOfDay = hh * 60 + mm;
  const endMinutesOfDay = startMinutesOfDay + duration;

  if (end.dateStr !== dateStr) {
    throw badRequest("Wizyta nie może przekraczać godziny zamknięcia salonu.");
  }
  if (!allowPast && isPastWallClock(dateStr, timeStr)) {
    throw badRequest("Nie można rezerwować wizyt w przeszłości.");
  }

  if (clientLimits) {
    const minutesAhead = minutesFromSalonNow(dateStr, timeStr);
    if (clientLimits.minLeadMinutes > 0 && minutesAhead < clientLimits.minLeadMinutes) {
      throw badRequest(
        `Rezerwacja online wymaga co najmniej ${clientLimits.minLeadMinutes} min wyprzedzenia.`,
      );
    }
    if (
      clientLimits.maxAdvanceDays > 0 &&
      minutesAhead > clientLimits.maxAdvanceDays * 24 * 60
    ) {
      throw badRequest(
        `Online można rezerwować najwyżej ${clientLimits.maxAdvanceDays} dni naprzód.`,
      );
    }
  }

  const [client, barber, salon, timeOffOverlap] = await Promise.all([
    pool.query("select id from clients where id = $1", [clientId]),
    pool.query("select id, work_days, active from staff where id = $1", [barberId]),
    pool.query("select open_hour, close_hour from salon where id = 'main'"),
    pool.query(
      `
        select id from time_off
        where staff_id = $1
          and tstzrange(starts_at, ends_at, '[)') &&
              tstzrange(
                ($2::text || ' ' || $3::text || ':00')::timestamp at time zone $6,
                ($4::text || ' ' || $5::text || ':00')::timestamp at time zone $6,
                '[)'
              )
        limit 1
      `,
      [barberId, dateStr, timeStr, end.dateStr, end.timeStr, SALON_TZ],
    ),
  ]);

  if (!client.rows[0]) {
    throw badRequest("Nie znaleziono klienta.");
  }
  if (!barber.rows[0]) {
    throw badRequest("Nie znaleziono fryzjera.");
  }
  if (!barber.rows[0].active) {
    throw badRequest("Wybrany fryzjer nie jest aktywny.");
  }

  const workDays = barber.rows[0].work_days || [];
  if (
    Array.isArray(workDays) &&
    workDays.length &&
    !workDays.includes(weekdayFromDateString(dateStr))
  ) {
    throw badRequest("Fryzjer nie pracuje w wybranym dniu.");
  }

  if (salon.rows[0]) {
    const openHour = salon.rows[0].open_hour;
    const closeHour = salon.rows[0].close_hour;
    if (startMinutesOfDay < openHour * 60 || endMinutesOfDay > closeHour * 60) {
      throw badRequest(
        `Wybierz termin w godzinach pracy salonu (${String(openHour).padStart(2, "0")}:00 – ${String(closeHour).padStart(2, "0")}:00).`,
      );
    }
  }

  if (timeOffOverlap.rows[0]) {
    throw badRequest("Fryzjer ma w tym terminie urlop.");
  }

  return end;
}

async function insertBookingAtWallClock(pool, {
  bookingId,
  clientId,
  barberId,
  serviceId,
  startDate,
  startTime,
  endDate,
  endTime,
  status,
  source,
  notes,
}) {
  return pool.query(
    `
      insert into bookings (
        id, client_id, barber_id, service_id, starts_at, ends_at,
        status, source, notes
      )
      values (
        $1, $2, $3, $4,
        ($5::text || ' ' || $6::text || ':00')::timestamp at time zone $9,
        ($7::text || ' ' || $8::text || ':00')::timestamp at time zone $9,
        $10, $11, $12
      )
      returning *
    `,
    [
      bookingId,
      clientId,
      barberId,
      serviceId,
      startDate,
      startTime,
      endDate,
      endTime,
      SALON_TZ,
      status,
      source,
      notes,
    ],
  );
}

export async function createBookingRecord(pool, user, body) {
  if (!body || !body.serviceId) {
    throw badRequest("Wybierz usługę.");
  }

  const service = await pool.query(
    "select id, duration from services where id = $1 and active = true",
    [body.serviceId],
  );

  if (!service.rows[0]) {
    throw badRequest("Wybrana usługa jest niedostępna.");
  }

  const clientId = user.role === "client" ? user.clientId : body.clientId;
  const barberId = user.role === "barber" ? user.staffId || body.barberId : body.barberId;

  if (!clientId || !barberId) {
    throw badRequest("Uzupełnij klienta i fryzjera.");
  }

  const { dateStr, timeStr } = parseDateTimeInputs(body);
  const duration = service.rows[0].duration;

  const end = await assertBookingSlotAllowed(pool, {
    clientId,
    barberId,
    dateStr,
    timeStr,
    duration,
    clientLimits:
      user.role === "client"
        ? {
            minLeadMinutes: CLIENT_MIN_LEAD_MINUTES,
            maxAdvanceDays: CLIENT_MAX_ADVANCE_DAYS,
          }
        : null,
  });

  try {
    const result = await insertBookingAtWallClock(pool, {
      bookingId: id("booking"),
      clientId,
      barberId,
      serviceId: body.serviceId,
      startDate: dateStr,
      startTime: timeStr,
      endDate: end.dateStr,
      endTime: end.timeStr,
      status: "confirmed",
      source: user.role === "client" ? "online" : "frontdesk",
      notes: String(body.notes || "").slice(0, 500),
    });
    return mapBooking(result.rows[0]);
  } catch (error) {
    if (error.code === "23P01") {
      const friendly = new Error("Termin koliduje z inną rezerwacją tego fryzjera.");
      friendly.statusCode = 409;
      throw friendly;
    }
    if (error.code === "23503") {
      throw badRequest("Powiązany rekord nie istnieje.");
    }
    throw error;
  }
}

export async function getBookingById(pool, bookingId) {
  const result = await pool.query("select * from bookings where id = $1", [bookingId]);
  return result.rows[0] ? mapBooking(result.rows[0]) : null;
}

export async function updateBookingStatusRecord(pool, bookingId, status) {
  if (!ALLOWED_BOOKING_STATUSES.has(status)) {
    throw badRequest("Nieprawidłowy status wizyty.");
  }

  const result = await pool.query(
    `
      update bookings
      set status = $2, updated_at = now()
      where id = $1
      returning *
    `,
    [bookingId, status],
  );

  if (!result.rows[0]) {
    throw notFound("Nie znaleziono wizyty.");
  }

  return mapBooking(result.rows[0]);
}

export async function createClientRecord(pool, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const phone = requireString(body?.phone, "Telefon", { min: 3, max: 30 });
  const emailRaw = String(body?.email || "").trim();
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw badRequest("Niepoprawny adres e-mail.");
  }
  const normalizedEmail = emailRaw ? normalizeEmail(emailRaw) : null;
  const phoneKey = normalizePhone(phone);
  const notes = String(body?.notes || "").slice(0, 500);

  // Miękka detekcja duplikatu (nie blokuje — rodziny mogą dzielić numer/e-mail),
  // ale ostrzega fryzjera, by świadomie nie tworzył drugiej karty tej samej osoby.
  const dup = await pool.query(
    `
      select name from clients
      where (
        ($1 <> '' and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = $1)
        or ($2::text is not null and lower(email) = $2)
      )
      limit 1
    `,
    [phoneKey, normalizedEmail],
  );
  const warning = dup.rows[0]
    ? `Istnieje już karta z tym numerem lub e-mailem (np. „${dup.rows[0].name}"). Sprawdź, czy to nie duplikat.`
    : null;

  try {
    const result = await pool.query(
      `
        insert into clients (id, name, phone, email, notes, tags)
        values ($1,$2,$3,$4,$5,'["nowy"]'::jsonb)
        returning *
      `,
      [id("client"), name, phone, normalizedEmail, notes],
    );
    return { client: mapClient(result.rows[0]), warning };
  } catch (error) {
    if (error.code === "23505") {
      throw badRequest("Klient z takim adresem e-mail już istnieje.");
    }
    throw error;
  }
}

export async function createServiceRecord(pool, body) {
  const name = requireString(body?.name, "Nazwa", { min: 2 });
  const category = requireString(body?.category, "Kategoria");
  const duration = requireNumber(body?.duration, "Czas (min)", {
    min: 5,
    max: 480,
    integer: true,
  });
  const price = requireNumber(body?.price, "Cena", { min: 0, max: 100000, integer: true });
  const description = String(body?.description || "").slice(0, 500);

  const result = await pool.query(
    `
      insert into services (id, name, category, duration, price, description, active)
      values ($1,$2,$3,$4,$5,$6,true)
      returning *
    `,
    [id("service"), name, category, duration, price, description],
  );

  return mapService(result.rows[0]);
}

export async function createStaffRecord(pool, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const title = String(body?.title || "Barber").trim().slice(0, 80) || "Barber";
  const specialty = requireString(body?.specialty, "Specjalizacja");
  const color = body?.color && HEX_COLOR.test(body.color) ? body.color : "#0f766e";

  const result = await pool.query(
    `
      insert into staff (id, name, title, specialty, active, work_days, color)
      values ($1,$2,$3,$4,true,'[1,2,3,4,5]'::jsonb,$5)
      returning *
    `,
    [id("barber"), name, title, specialty, color],
  );

  return mapStaff(result.rows[0]);
}

export async function updateSettings(pool, body) {
  const name = requireString(body?.name, "Nazwa salonu", { min: 2 });
  const address = requireString(body?.address, "Adres", { min: 3 });
  const openHour = requireNumber(body?.openHour, "Godzina otwarcia", {
    min: 0,
    max: 23,
    integer: true,
  });
  const closeHour = requireNumber(body?.closeHour, "Godzina zamknięcia", {
    min: 1,
    max: 24,
    integer: true,
  });
  const slotStep = requireNumber(body?.slotStep, "Krok kalendarza", { integer: true });

  if (closeHour <= openHour) {
    throw badRequest("Godzina zamknięcia musi być późniejsza niż godzina otwarcia.");
  }
  if (!ALLOWED_SLOT_STEPS.has(slotStep)) {
    throw badRequest("Krok kalendarza musi wynosić 15, 30, 45 lub 60 minut.");
  }

  const result = await pool.query(
    `
      update salon
      set name = $1, address = $2, open_hour = $3, close_hour = $4, slot_step = $5
      where id = 'main'
      returning *
    `,
    [name, address, openHour, closeHour, slotStep],
  );

  return mapSalon(result.rows[0]);
}

export async function getNotificationById(pool, notificationId) {
  const result = await pool.query("select * from notifications where id = $1", [
    notificationId,
  ]);
  return result.rows[0] ? mapNotification(result.rows[0]) : null;
}

export async function setNotificationRead(pool, notificationId, read) {
  const result = await pool.query(
    "update notifications set read = $2 where id = $1 returning *",
    [notificationId, Boolean(read)],
  );
  if (!result.rows[0]) {
    throw notFound("Nie znaleziono powiadomienia.");
  }
  return mapNotification(result.rows[0]);
}

export function markNotificationRead(pool, notificationId) {
  return setNotificationRead(pool, notificationId, true);
}

export async function updateClientRecord(pool, clientId, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const phone = requireString(body?.phone, "Telefon", { min: 3, max: 30 });
  const emailRaw = String(body?.email || "").trim();
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw badRequest("Niepoprawny adres e-mail.");
  }
  const notes = String(body?.notes || "").slice(0, 500);

  try {
    const result = await pool.query(
      `
        update clients
        set name = $2, phone = $3, email = $4, notes = $5
        where id = $1
        returning *
      `,
      [clientId, name, phone, emailRaw ? normalizeEmail(emailRaw) : null, notes],
    );
    if (!result.rows[0]) {
      throw notFound("Nie znaleziono klienta.");
    }
    return mapClient(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw badRequest("Klient z takim adresem e-mail już istnieje.");
    }
    throw error;
  }
}

// Ręczne scalenie dwóch kart klienta przez administratora.
// targetId = karta zachowana, sourceId = duplikat (zostanie usunięty).
// Przepina wizyty, scala notatki/tagi/dane kontaktowe i przenosi konto, jeśli
// jest tylko po stronie duplikatu.
export async function mergeClients(pool, targetId, sourceId) {
  if (!targetId || !sourceId) {
    throw badRequest("Wskaż obie karty do scalenia.");
  }
  if (targetId === sourceId) {
    throw badRequest("Nie można scalić karty z nią samą.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const both = await client.query(
      "select * from clients where id = any($1::text[]) for update",
      [[targetId, sourceId]],
    );
    const target = both.rows.find((row) => row.id === targetId);
    const source = both.rows.find((row) => row.id === sourceId);

    if (!target || !source) {
      throw notFound("Nie znaleziono karty klienta.");
    }
    if (target.user_id && source.user_id) {
      throw badRequest(
        "Obie karty mają powiązane konto użytkownika — scalanie kont nie jest obsługiwane.",
      );
    }

    // 1) Przepnij wizyty duplikatu na kartę zachowaną.
    await client.query("update bookings set client_id = $1 where client_id = $2", [
      targetId,
      sourceId,
    ]);

    // 2) Jeśli konto jest tylko na duplikacie — przenieś link na kartę zachowaną
    //    (clients.user_id jest UNIQUE, więc najpierw zwalniamy je u źródła).
    if (source.user_id && !target.user_id) {
      await client.query("update clients set user_id = null where id = $1", [sourceId]);
      await client.query("update clients set user_id = $1 where id = $2", [
        source.user_id,
        targetId,
      ]);
    }

    // 3) Scal dane kontaktowe / notatki / tagi / ostatnią wizytę.
    const mergedTags = Array.from(
      new Set([...(target.tags || []), ...(source.tags || [])]),
    );
    const mergedNotes = [target.notes, source.notes]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("\n---\n")
      .slice(0, 1000);
    const phone = target.phone && target.phone.trim() ? target.phone : source.phone;
    const email = target.email || source.email;

    await client.query(
      `
        update clients
        set notes = $2,
            phone = $3,
            email = $4,
            tags = $5::jsonb,
            last_visit = greatest(last_visit, $6)
        where id = $1
      `,
      [targetId, mergedNotes, phone, email, JSON.stringify(mergedTags), source.last_visit],
    );

    // 4) Usuń duplikat.
    await client.query("delete from clients where id = $1", [sourceId]);

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const result = await pool.query("select * from clients where id = $1", [targetId]);
  return mapClient(result.rows[0]);
}

export async function updateOwnProfile(pool, user, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const emailRaw = String(body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw badRequest("Niepoprawny adres e-mail.");
  }
  const email = normalizeEmail(emailRaw);
  const phone = String(body?.phone || "").trim();
  const password = body?.password ? String(body.password) : "";

  if (password && password.length < 8) {
    throw badRequest("Hasło musi mieć co najmniej 8 znaków.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    try {
      if (password) {
        const hash = await hashPassword(password);
        await client.query(
          "update users set name = $2, email = $3, password_hash = $4 where id = $1",
          [user.id, name, email, hash],
        );
      } else {
        await client.query("update users set name = $2, email = $3 where id = $1", [
          user.id,
          name,
          email,
        ]);
      }
    } catch (error) {
      if (error.code === "23505") {
        throw badRequest("Konto z takim adresem e-mail już istnieje.");
      }
      throw error;
    }

    if (user.clientId) {
      await client.query(
        "update clients set name = $2, email = $3, phone = $4 where id = $1",
        [user.clientId, name, email, phone],
      );
    }

    if (user.staffId) {
      await client.query("update staff set name = $2 where id = $1", [user.staffId, name]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return findUserById(pool, user.id);
}

export async function updateBookingRecord(pool, bookingId, body) {
  const existing = await pool.query("select * from bookings where id = $1", [bookingId]);
  if (!existing.rows[0]) {
    throw notFound("Nie znaleziono wizyty.");
  }
  const current = existing.rows[0];

  const clientId = body?.clientId || current.client_id;
  const barberId = body?.barberId || current.barber_id;
  const serviceId = body?.serviceId || current.service_id;
  const status = body?.status || current.status;
  if (!ALLOWED_BOOKING_STATUSES.has(status)) {
    throw badRequest("Nieprawidłowy status wizyty.");
  }

  const serviceChanged = Boolean(body?.serviceId) && body.serviceId !== current.service_id;
  const barberChanged = Boolean(body?.barberId) && body.barberId !== current.barber_id;
  const timeChanged = Boolean(body?.date || body?.time || body?.startsAt);

  // Przy zmianie usługi wymagamy aktywnej; jeśli usługa pozostaje ta sama,
  // dopuszczamy edycję wizyty nawet gdy usługa została w międzyczasie wyłączona (C20).
  const service = serviceChanged
    ? await pool.query("select id, duration from services where id = $1 and active = true", [serviceId])
    : await pool.query("select id, duration from services where id = $1", [serviceId]);
  if (!service.rows[0]) {
    throw badRequest("Wybrana usługa jest niedostępna.");
  }

  let dateStr;
  let timeStr;
  if (timeChanged) {
    ({ dateStr, timeStr } = parseDateTimeInputs(body));
  } else {
    ({ date: dateStr, time: timeStr } = isoToWallClock(current.starts_at));
  }

  // Walidacja slotu tylko gdy wizyta faktycznie się przesuwa (czas/fryzjer/usługa)
  // i nie jest anulowana — pozwala edytować notatki/status historycznych wizyt,
  // ale blokuje przeniesienie wizyty w urlop, poza godziny lub na dzień wolny (C2/C3).
  let end;
  if (status !== "cancelled" && (timeChanged || barberChanged || serviceChanged)) {
    end = await assertBookingSlotAllowed(pool, {
      clientId,
      barberId,
      dateStr,
      timeStr,
      duration: service.rows[0].duration,
      allowPast: true,
    });
  } else {
    end = addMinutesToWallClock(dateStr, timeStr, service.rows[0].duration);
  }

  const notes =
    body?.notes !== undefined ? String(body.notes).slice(0, 500) : current.notes;

  try {
    const result = await pool.query(
      `
        update bookings
        set client_id = $2,
            barber_id = $3,
            service_id = $4,
            starts_at = ($5::text || ' ' || $6::text || ':00')::timestamp at time zone $11,
            ends_at = ($7::text || ' ' || $8::text || ':00')::timestamp at time zone $11,
            status = $9,
            notes = $10,
            updated_at = now()
        where id = $1
        returning *
      `,
      [
        bookingId,
        clientId,
        barberId,
        serviceId,
        dateStr,
        timeStr,
        end.dateStr,
        end.timeStr,
        status,
        notes,
        SALON_TZ,
      ],
    );
    return mapBooking(result.rows[0]);
  } catch (error) {
    if (error.code === "23P01") {
      const friendly = new Error("Termin koliduje z inną rezerwacją tego fryzjera.");
      friendly.statusCode = 409;
      throw friendly;
    }
    if (error.code === "23503") {
      throw badRequest("Powiązany rekord nie istnieje.");
    }
    throw error;
  }
}

export async function createUserAccount(pool, body) {
  const role = String(body?.role || "").trim();
  if (!["admin", "barber", "client"].includes(role)) {
    throw badRequest("Nieprawidłowa rola konta.");
  }
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const emailRaw = String(body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw badRequest("Niepoprawny adres e-mail.");
  }
  const email = normalizeEmail(emailRaw);
  const password = String(body?.password || "");
  if (password.length < 8) {
    throw badRequest("Hasło musi mieć co najmniej 8 znaków.");
  }
  const phone = String(body?.phone || "").trim();
  const specialty = String(body?.specialty || "").trim();

  const userId = id("user");
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      "insert into users (id, role, name, email, password_hash) values ($1,$2,$3,$4,$5)",
      [userId, role, name, email, passwordHash],
    );

    if (role === "client") {
      await client.query(
        `
          insert into clients (id, user_id, name, phone, email, notes, tags)
          values ($1,$2,$3,$4,$5,'', '["nowy"]'::jsonb)
        `,
        [id("client"), userId, name, phone, email],
      );
    } else if (role === "barber") {
      await client.query(
        `
          insert into staff (id, user_id, name, title, specialty, active, work_days, color)
          values ($1,$2,$3,$4,$5,true,'[1,2,3,4,5]'::jsonb,$6)
        `,
        [id("barber"), userId, name, body?.title || "Barber", specialty || "Barbering", "#0f766e"],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23505") {
      throw badRequest("Konto z takim adresem e-mail już istnieje.");
    }
    throw error;
  } finally {
    client.release();
  }

  return findUserById(pool, userId);
}

function validateWorkDays(input) {
  if (input === undefined || input === null) return null;
  const arr = Array.isArray(input) ? input : String(input).split(",");
  const numbers = arr
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return Array.from(new Set(numbers)).sort();
}

export async function updateStaffRecord(pool, staffId, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const title = requireString(body?.title, "Stanowisko", { min: 2, max: 80 });
  const specialty = requireString(body?.specialty, "Specjalizacja");
  const active =
    body?.active === undefined ? true : body.active === true || body.active === "true";
  const color = body?.color && HEX_COLOR.test(body.color) ? body.color : "#0f766e";
  const workDays = validateWorkDays(body?.workDays) ?? [1, 2, 3, 4, 5];

  const result = await pool.query(
    `
      update staff
      set name = $2, title = $3, specialty = $4, active = $5, color = $6, work_days = $7::jsonb
      where id = $1
      returning *
    `,
    [staffId, name, title, specialty, active, color, JSON.stringify(workDays)],
  );

  if (!result.rows[0]) {
    throw notFound("Nie znaleziono fryzjera.");
  }
  return mapStaff(result.rows[0]);
}

export async function updateServiceRecord(pool, serviceId, body) {
  const name = requireString(body?.name, "Nazwa", { min: 2 });
  const category = requireString(body?.category, "Kategoria");
  const duration = requireNumber(body?.duration, "Czas (min)", {
    min: 5,
    max: 480,
    integer: true,
  });
  const price = requireNumber(body?.price, "Cena", { min: 0, max: 100000, integer: true });
  const description = String(body?.description || "").slice(0, 500);
  const active =
    body?.active === undefined ? true : body.active === true || body.active === "true";

  const result = await pool.query(
    `
      update services
      set name = $2, category = $3, duration = $4, price = $5, description = $6, active = $7
      where id = $1
      returning *
    `,
    [serviceId, name, category, duration, price, description, active],
  );

  if (!result.rows[0]) {
    throw notFound("Nie znaleziono usługi.");
  }
  return mapService(result.rows[0]);
}

export async function updateUserAccount(pool, userId, body) {
  const name = requireString(body?.name, "Imię i nazwisko", { min: 2 });
  const emailRaw = String(body?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    throw badRequest("Niepoprawny adres e-mail.");
  }
  const email = normalizeEmail(emailRaw);
  const role = body?.role && ["admin", "barber", "client"].includes(body.role) ? body.role : null;
  const password = body?.password ? String(body.password) : "";
  if (password && password.length < 8) {
    throw badRequest("Hasło musi mieć co najmniej 8 znaków.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    try {
      if (role && password) {
        const hash = await hashPassword(password);
        await client.query(
          "update users set name=$2, email=$3, role=$4, password_hash=$5 where id=$1",
          [userId, name, email, role, hash],
        );
      } else if (role) {
        await client.query("update users set name=$2, email=$3, role=$4 where id=$1", [
          userId,
          name,
          email,
          role,
        ]);
      } else if (password) {
        const hash = await hashPassword(password);
        await client.query(
          "update users set name=$2, email=$3, password_hash=$4 where id=$1",
          [userId, name, email, hash],
        );
      } else {
        await client.query("update users set name=$2, email=$3 where id=$1", [
          userId,
          name,
          email,
        ]);
      }
    } catch (error) {
      if (error.code === "23505") {
        throw badRequest("Konto z takim adresem e-mail już istnieje.");
      }
      throw error;
    }

    await client.query(
      "update clients set name=$2, email=$3 where user_id=$1",
      [userId, name, email],
    );
    await client.query("update staff set name=$2 where user_id=$1", [userId, name]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  return findUserById(pool, userId);
}

function parseTimeOffInputs(body) {
  const startDate = String(body?.startDate || "").trim();
  const startTime = String(body?.startTime || "00:00").trim();
  const endDate = String(body?.endDate || "").trim();
  const endTime = String(body?.endTime || "23:59").trim();
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    throw badRequest("Niepoprawny zakres dat urlopu.");
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw badRequest("Niepoprawne godziny urlopu.");
  }
  const start = new Date(`${startDate}T${startTime}:00`);
  const end = new Date(`${endDate}T${endTime}:00`);
  if (!(end.getTime() > start.getTime())) {
    throw badRequest("Koniec urlopu musi być po jego początku.");
  }
  const maxDays = 366;
  if (end.getTime() - start.getTime() > maxDays * 24 * 60 * 60 * 1000) {
    throw badRequest("Pojedynczy urlop nie może być dłuższy niż rok.");
  }
  return { startDate, startTime, endDate, endTime };
}

async function cancelBookingsOverlapping(txn, { staffId, startDate, startTime, endDate, endTime, reason }) {
  const overlapping = await txn.query(
    `
      select
        b.id,
        b.client_id,
        c.user_id as client_user_id,
        s.name as barber_name,
        to_char(b.starts_at at time zone $6, 'DD.MM.YYYY HH24:MI') as when_label
      from bookings b
      join staff s on s.id = b.barber_id
      left join clients c on c.id = b.client_id
      where b.barber_id = $1
        and b.status <> 'cancelled'
        and tstzrange(b.starts_at, b.ends_at, '[)') &&
            tstzrange(
              ($2::text || ' ' || $3::text || ':00')::timestamp at time zone $6,
              ($4::text || ' ' || $5::text || ':00')::timestamp at time zone $6,
              '[)'
            )
    `,
    [staffId, startDate, startTime, endDate, endTime, SALON_TZ],
  );

  for (const row of overlapping.rows) {
    await txn.query(
      "update bookings set status = 'cancelled', updated_at = now() where id = $1",
      [row.id],
    );

    const reasonSuffix = reason ? ` (${reason})` : "";
    const message = `Twoja wizyta ${row.when_label} u ${row.barber_name} została odwołana z powodu urlopu pracownika${reasonSuffix}. Prosimy o ponowną rezerwację w dogodnym terminie.`;

    await txn.query(
      `
        insert into notifications (id, type, title, message, user_id)
        values ($1, 'booking', $2, $3, $4)
      `,
      [id("notice"), "Wizyta odwołana", message, row.client_user_id],
    );
  }

  return overlapping.rows.length;
}

export async function createTimeOff(pool, user, body) {
  const staffId =
    user.role === "barber" ? user.staffId : String(body?.staffId || "").trim();
  if (!staffId) {
    throw badRequest("Wskaż fryzjera, którego dotyczy urlop.");
  }
  if (user.role === "barber" && body?.staffId && body.staffId !== user.staffId) {
    throw forbidden("Fryzjer może dodać urlop tylko sobie.");
  }

  const { startDate, startTime, endDate, endTime } = parseTimeOffInputs(body);
  const reason = String(body?.reason || "").slice(0, 200);

  const staff = await pool.query("select id from staff where id = $1", [staffId]);
  if (!staff.rows[0]) {
    throw badRequest("Nie znaleziono fryzjera.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const result = await client.query(
      `
        insert into time_off (id, staff_id, starts_at, ends_at, reason)
        values (
          $1, $2,
          ($3::text || ' ' || $4::text || ':00')::timestamp at time zone $7,
          ($5::text || ' ' || $6::text || ':00')::timestamp at time zone $7,
          $8
        )
        returning *
      `,
      [id("timeoff"), staffId, startDate, startTime, endDate, endTime, SALON_TZ, reason],
    );

    const cancelledCount = await cancelBookingsOverlapping(client, {
      staffId,
      startDate,
      startTime,
      endDate,
      endTime,
      reason,
    });

    await client.query("commit");
    return { timeOff: mapTimeOff(result.rows[0]), cancelledCount };
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23P01") {
      throw badRequest("Ten urlop nakłada się na inny urlop tego fryzjera.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateTimeOff(pool, user, timeOffId, body) {
  const existing = await pool.query("select * from time_off where id = $1", [timeOffId]);
  if (!existing.rows[0]) {
    throw notFound("Nie znaleziono urlopu.");
  }
  if (user.role === "barber" && existing.rows[0].staff_id !== user.staffId) {
    throw forbidden("Fryzjer może edytować tylko swój urlop.");
  }

  const staffId = existing.rows[0].staff_id;
  const { startDate, startTime, endDate, endTime } = parseTimeOffInputs(body);
  const reason = String(body?.reason || existing.rows[0].reason || "").slice(0, 200);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const result = await client.query(
      `
        update time_off
        set starts_at = ($2::text || ' ' || $3::text || ':00')::timestamp at time zone $6,
            ends_at = ($4::text || ' ' || $5::text || ':00')::timestamp at time zone $6,
            reason = $7
        where id = $1
        returning *
      `,
      [timeOffId, startDate, startTime, endDate, endTime, SALON_TZ, reason],
    );

    const cancelledCount = await cancelBookingsOverlapping(client, {
      staffId,
      startDate,
      startTime,
      endDate,
      endTime,
      reason,
    });

    await client.query("commit");
    return { timeOff: mapTimeOff(result.rows[0]), cancelledCount };
  } catch (error) {
    await client.query("rollback");
    if (error.code === "23P01") {
      throw badRequest("Ten urlop nakłada się na inny urlop tego fryzjera.");
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteTimeOff(pool, user, timeOffId) {
  const existing = await pool.query("select * from time_off where id = $1", [timeOffId]);
  if (!existing.rows[0]) {
    throw notFound("Nie znaleziono urlopu.");
  }
  if (user.role === "barber" && existing.rows[0].staff_id !== user.staffId) {
    throw forbidden("Fryzjer może usuwać tylko swój urlop.");
  }
  await pool.query("delete from time_off where id = $1", [timeOffId]);
}

export { forbidden };

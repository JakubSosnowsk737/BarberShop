import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  clearSessionCookie,
  generateSessionToken,
  getSessionTokenFromRequest,
  serializeSessionCookie,
  validateRegistrationInput,
} from "./server/auth.mjs";
import { createPool, migrateDatabase, waitForDatabase } from "./server/db.mjs";
import {
  authenticateUser,
  createBookingRecord,
  createClientRecord,
  createServiceRecord,
  createSession,
  createStaffRecord,
  createUserAccount,
  createTimeOff,
  deleteTimeOff,
  updateTimeOff,
  updateServiceRecord,
  updateStaffRecord,
  updateUserAccount,
  deleteSession,
  findUserBySessionToken,
  getBookingById,
  getNotificationById,
  getState,
  markNotificationRead,
  mergeClients,
  registerClientUser,
  resetDatabase,
  seedDatabase,
  setNotificationRead,
  deleteExpiredSessions,
  updateBookingRecord,
  updateBookingStatusRecord,
  updateClientRecord,
  updateOwnProfile,
  updateSettings,
} from "./server/repository.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const preferredPort = Number(process.env.PORT || 5173);
const host = process.env.HOST || "0.0.0.0";
export const pool = createPool();

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 10;

function clientIp(request) {
  return (
    String(request.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

function pruneLoginAttempts(now) {
  for (const [ip, bucket] of loginAttempts) {
    if (now > bucket.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}

// Zwraca true, jeśli logowanie jest dozwolone (nie przekroczono limitu NIEUDANYCH prób).
function loginAllowed(request) {
  const now = Date.now();
  const bucket = loginAttempts.get(clientIp(request));
  if (!bucket || now > bucket.resetAt) {
    return true;
  }
  return bucket.failures < LOGIN_MAX_FAILURES;
}

function recordLoginFailure(request) {
  const now = Date.now();
  const ip = clientIp(request);
  const bucket = loginAttempts.get(ip);
  if (!bucket || now > bucket.resetAt) {
    loginAttempts.set(ip, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    bucket.failures += 1;
  }
  if (loginAttempts.size > 5000) {
    pruneLoginAttempts(now);
  }
}

function clearLoginFailures(request) {
  loginAttempts.delete(clientIp(request));
}

const rolePermissions = {
  admin: new Set(["admin", "barber", "client"]),
  barber: new Set(["barber"]),
  client: new Set(["client"]),
};

function can(user, roles) {
  return roles.some((role) => rolePermissions[user.role]?.has(role));
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, error) {
  sendJson(response, error.statusCode || 500, {
    error: error.statusCode ? error.message : "Wystąpił błąd serwera.",
  });
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  const limit = 1024 * 256;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error("Treść żądania jest zbyt duża.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");

  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("Niepoprawny format JSON.");
    error.statusCode = 400;
    throw error;
  }
}

async function requireUser(request, response) {
  const token = getSessionTokenFromRequest(request);
  const user = await findUserBySessionToken(pool, token);

  if (!user) {
    sendJson(response, 401, { error: "Zaloguj się, aby kontynuować." });
    return null;
  }

  return { token, user };
}

function sessionHeaders(token, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    "Set-Cookie": serializeSessionCookie(token, {
      maxAgeSeconds,
      secure: process.env.COOKIE_SECURE === "true",
    }),
  };
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

// Obrona przed CSRF: dla żądań mutujących z przeglądarki nagłówek Origin/Referer
// musi wskazywać ten sam host. Klienci bez tych nagłówków (curl, testy) są dopuszczani.
function isAllowedMutation(request) {
  if (!MUTATING_METHODS.has(request.method)) {
    return true;
  }
  const host = request.headers.host;
  const source = request.headers.origin || request.headers.referer;
  if (!source) {
    return true;
  }
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

async function handleApi(request, response, url) {
  if (!isAllowedMutation(request)) {
    sendJson(response, 403, { error: "Żądanie zablokowane (nieprawidłowe źródło)." });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/session") {
    const user = await findUserBySessionToken(pool, getSessionTokenFromRequest(request));
    sendJson(response, 200, { authenticated: Boolean(user), user });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    if (!loginAllowed(request)) {
      sendJson(response, 429, {
        error: "Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za kilka minut.",
      });
      return;
    }

    const body = await readJson(request);
    const user = await authenticateUser(pool, body.email, body.password);

    if (!user) {
      recordLoginFailure(request);
      sendJson(response, 401, { error: "Nieprawidłowy e-mail lub hasło." });
      return;
    }

    clearLoginFailures(request);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await createSession(pool, user.id, token, expiresAt);
    sendJson(response, 200, { user }, sessionHeaders(token));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readJson(request);
    const validation = validateRegistrationInput(body);

    if (!validation.ok) {
      sendJson(response, 400, { error: validation.errors.join(" ") });
      return;
    }

    const user = await registerClientUser(pool, body);
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    await createSession(pool, user.id, token, expiresAt);
    sendJson(response, 201, { user }, sessionHeaders(token));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    await deleteSession(pool, getSessionTokenFromRequest(request));
    sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  const auth = await requireUser(request, response);

  if (!auth) {
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, { user: auth.user, data: await getState(pool, auth.user) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reset") {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może resetować dane." });
      return;
    }

    await resetDatabase(pool);
    sendJson(response, 200, { data: await getState(pool, auth.user) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/bookings") {
    const booking = await createBookingRecord(pool, auth.user, await readJson(request));
    sendJson(response, 201, { booking });
    return;
  }

  const bookingStatusMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)\/status$/);
  if (request.method === "PATCH" && bookingStatusMatch) {
    const body = await readJson(request);
    const bookingId = bookingStatusMatch[1];

    if (auth.user.role === "client") {
      const existing = await getBookingById(pool, bookingId);
      if (!existing) {
        sendJson(response, 404, { error: "Nie znaleziono wizyty." });
        return;
      }
      if (existing.clientId !== auth.user.clientId) {
        sendJson(response, 403, { error: "Nie możesz zmienić tej wizyty." });
        return;
      }
      if (body.status !== "cancelled") {
        sendJson(response, 403, {
          error: "Klient może jedynie anulować swoją wizytę.",
        });
        return;
      }
    } else if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień do zmiany statusu wizyty." });
      return;
    }

    const booking = await updateBookingStatusRecord(pool, bookingId, body.status);
    sendJson(response, 200, { booking });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/clients") {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień do dodawania klientów." });
      return;
    }

    const created = await createClientRecord(pool, await readJson(request));
    sendJson(response, 201, created);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/services") {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może dodawać usługi." });
      return;
    }

    sendJson(response, 201, { service: await createServiceRecord(pool, await readJson(request)) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/staff") {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może dodawać fryzjerów." });
      return;
    }

    sendJson(response, 201, { staff: await createStaffRecord(pool, await readJson(request)) });
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/settings") {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może zmieniać ustawienia." });
      return;
    }

    sendJson(response, 200, { salon: await updateSettings(pool, await readJson(request)) });
    return;
  }

  const notificationMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (request.method === "PATCH" && notificationMatch) {
    if (auth.user.role === "client") {
      const notice = await getNotificationById(pool, notificationMatch[1]);
      if (!notice || notice.userId !== auth.user.id) {
        sendJson(response, 404, { error: "Nie znaleziono powiadomienia." });
        return;
      }
    } else if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, {
        error: "Brak uprawnień do oznaczania powiadomień.",
      });
      return;
    }
    sendJson(response, 200, {
      notification: await markNotificationRead(pool, notificationMatch[1]),
    });
    return;
  }

  const notificationToggleMatch = url.pathname.match(/^\/api\/notifications\/([^/]+)$/);
  if (request.method === "PATCH" && notificationToggleMatch) {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, {
        error: "Brak uprawnień do oznaczania powiadomień.",
      });
      return;
    }
    const body = await readJson(request);
    sendJson(response, 200, {
      notification: await setNotificationRead(pool, notificationToggleMatch[1], body.read),
    });
    return;
  }

  if (request.method === "PATCH" && url.pathname === "/api/profile") {
    sendJson(response, 200, {
      user: await updateOwnProfile(pool, auth.user, await readJson(request)),
    });
    return;
  }

  const clientMergeMatch = url.pathname.match(/^\/api\/clients\/([^/]+)\/merge$/);
  if (request.method === "POST" && clientMergeMatch) {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może scalać karty klientów." });
      return;
    }
    const body = await readJson(request);
    sendJson(response, 200, {
      client: await mergeClients(pool, clientMergeMatch[1], body.sourceId),
    });
    return;
  }

  const clientUpdateMatch = url.pathname.match(/^\/api\/clients\/([^/]+)$/);
  if (request.method === "PATCH" && clientUpdateMatch) {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień do edycji klienta." });
      return;
    }
    sendJson(response, 200, {
      client: await updateClientRecord(pool, clientUpdateMatch[1], await readJson(request)),
    });
    return;
  }

  const bookingUpdateMatch = url.pathname.match(/^\/api\/bookings\/([^/]+)$/);
  if (request.method === "PATCH" && bookingUpdateMatch) {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może edytować wizytę." });
      return;
    }
    sendJson(response, 200, {
      booking: await updateBookingRecord(pool, bookingUpdateMatch[1], await readJson(request)),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/users") {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może tworzyć konta." });
      return;
    }
    sendJson(response, 201, { user: await createUserAccount(pool, await readJson(request)) });
    return;
  }

  const userUpdateMatch = url.pathname.match(/^\/api\/users\/([^/]+)$/);
  if (request.method === "PATCH" && userUpdateMatch) {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może edytować konta." });
      return;
    }
    sendJson(response, 200, {
      user: await updateUserAccount(pool, userUpdateMatch[1], await readJson(request)),
    });
    return;
  }

  const staffUpdateMatch = url.pathname.match(/^\/api\/staff\/([^/]+)$/);
  if (request.method === "PATCH" && staffUpdateMatch) {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może edytować zespół." });
      return;
    }
    sendJson(response, 200, {
      staff: await updateStaffRecord(pool, staffUpdateMatch[1], await readJson(request)),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/time-off") {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień do dodawania urlopów." });
      return;
    }
    const result = await createTimeOff(pool, auth.user, await readJson(request));
    sendJson(response, 201, result);
    return;
  }

  const timeOffUpdateMatch = url.pathname.match(/^\/api\/time-off\/([^/]+)$/);
  if (request.method === "PATCH" && timeOffUpdateMatch) {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień." });
      return;
    }
    const result = await updateTimeOff(pool, auth.user, timeOffUpdateMatch[1], await readJson(request));
    sendJson(response, 200, result);
    return;
  }

  if (request.method === "DELETE" && timeOffUpdateMatch) {
    if (!can(auth.user, ["admin", "barber"])) {
      sendJson(response, 403, { error: "Brak uprawnień." });
      return;
    }
    await deleteTimeOff(pool, auth.user, timeOffUpdateMatch[1]);
    sendJson(response, 200, { ok: true });
    return;
  }

  const serviceUpdateMatch = url.pathname.match(/^\/api\/services\/([^/]+)$/);
  if (request.method === "PATCH" && serviceUpdateMatch) {
    if (!can(auth.user, ["admin"])) {
      sendJson(response, 403, { error: "Tylko administrator może edytować usługi." });
      return;
    }
    sendJson(response, 200, {
      service: await updateServiceRecord(pool, serviceUpdateMatch[1], await readJson(request)),
    });
    return;
  }

  sendJson(response, 404, { error: "Nie znaleziono endpointu API." });
}

function resolvePath(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const fullPath = normalize(join(root, requested));

  if (!fullPath.startsWith(root)) {
    return null;
  }

  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    return fullPath;
  }

  return join(root, "index.html");
}

function serveStatic(request, response) {
  const filePath = resolvePath(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  response.writeHead(200, {
    "Content-Type": types[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}

// Pojedynczy punkt wejścia obsługi żądań — wyeksportowany, aby testy funkcjonalne
// mogły uruchomić ten sam handler na efemerycznym porcie bez powielania routingu.
export async function requestListener(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendError(response, error);
  }
}

export async function start() {
  await waitForDatabase(pool);
  await migrateDatabase(pool);
  await seedDatabase(pool);

  // Okresowe czyszczenie wygasłych sesji, aby tabela nie rosła w nieskończoność.
  const sessionSweep = setInterval(() => {
    deleteExpiredSessions(pool).catch((error) => {
      console.error("Nie udało się wyczyścić wygasłych sesji:", error.message);
    });
  }, 60 * 60 * 1000);
  sessionSweep.unref?.();

  const server = createServer(requestListener);

  server.listen(preferredPort, host, () => {
    console.log(`HairBook Local is running at http://127.0.0.1:${preferredPort}`);
  });

  return server;
}

// Auto-start wyłącznie przy uruchomieniu jako główny moduł (node server.mjs).
// Import w testach nie wywołuje połączenia z bazą ani nasłuchu.
const isMainModule =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

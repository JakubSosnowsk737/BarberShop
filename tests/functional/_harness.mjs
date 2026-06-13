// Szkielet testów funkcjonalnych (E2E czarnej skrzynki).
// Startuje TEN SAM handler HTTP co produkcyjny serwer na efemerycznym porcie,
// na dedykowanej bazie testowej (domyślnie hairbook_test), i udostępnia
// prostego klienta HTTP z „słoikiem” na ciasteczko sesji.
import { createServer } from "node:http";
import pg from "pg";

const { Pool } = pg;

// URL bazy testowej — w CI nadpisywany przez TEST_DATABASE_URL.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgres://hairbook:hairbook@localhost:5432/hairbook_test";

function withDatabase(url, dbName) {
  const parsed = new URL(url);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

// Szybka sonda: czy serwer PostgreSQL w ogóle odpowiada? Pozwala testom
// funkcjonalnym pomijać się (zamiast sypać błędami), gdy baza jest niedostępna
// — np. lokalnie bez uruchomionego Dockera.
export async function probeDatabase() {
  const probe = new Pool({
    connectionString: withDatabase(TEST_DATABASE_URL, "postgres"),
    connectionTimeoutMillis: 1500,
  });
  try {
    await probe.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => {});
  }
}

// Tworzy bazę testową, jeśli nie istnieje (łącząc się z bazą utrzymaniową).
async function ensureTestDatabase() {
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  const adminPool = new Pool({ connectionString: withDatabase(TEST_DATABASE_URL, "postgres") });
  try {
    const exists = await adminPool.query("select 1 from pg_database where datname = $1", [dbName]);
    if (exists.rowCount === 0) {
      await adminPool.query(`create database ${dbName}`);
    }
  } finally {
    await adminPool.end();
  }
}

// Uruchamia serwer na losowym porcie i zwraca uchwyt z funkcją sprzątającą.
export async function startTestServer() {
  await ensureTestDatabase();

  // Wskaż pulę aplikacji na bazę testową PRZED importem server.mjs.
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.DEMO_PASSWORD = process.env.DEMO_PASSWORD || "1234";

  const { pool, requestListener } = await import("../../server.mjs");
  const { migrateDatabase } = await import("../../server/db.mjs");
  const { resetDatabase } = await import("../../server/repository.mjs");

  await migrateDatabase(pool);

  const server = createServer(requestListener);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    pool,
    reset: () => resetDatabase(pool),
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}

// Klient HTTP z pamięcią ciasteczek (symuluje jedną przeglądarkę/sesję).
export function createClient(baseUrl) {
  let cookie = "";

  async function request(method, path, { body, headers = {} } = {}) {
    const finalHeaders = { ...headers };
    if (cookie) finalHeaders.cookie = cookie;
    if (body !== undefined) finalHeaders["content-type"] = "application/json";

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookie) {
      const pair = raw.split(";")[0];
      if (pair.startsWith("hb_session=")) cookie = pair;
    }

    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: response.status, json, headers: response.headers };
  }

  return {
    get: (path, opts) => request("GET", path, opts),
    post: (path, body, opts) => request("POST", path, { body, ...opts }),
    patch: (path, body, opts) => request("PATCH", path, { body, ...opts }),
    del: (path, body, opts) => request("DELETE", path, { body, ...opts }),
    async login(email, password) {
      return request("POST", "/api/auth/login", { body: { email, password } });
    },
    get cookie() {
      return cookie;
    },
  };
}

// Konta demo (hasło: DEMO_PASSWORD, domyślnie 1234).
export const DEMO = {
  admin: "j.sosnowski@hairapp.com",
  barber1: "b.sochacki@hairapp.com",
  barber2: "b.walczyk@hairapp.com",
  client: "n.szyszka@hairapp.com",
  password: process.env.DEMO_PASSWORD || "1234",
};

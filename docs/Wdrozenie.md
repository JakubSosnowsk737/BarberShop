# Przewodnik wdrożenia — System E-Barber (Praga Barbers / HairBook)

**Etap 7: Wdrożenie systemu.** Dokument opisuje przygotowanie środowiska, wdrożenie i weryfikację działania systemu oraz wskazówki produkcyjne.

---

## 1. Architektura wdrożenia

System uruchamiany jest jako **dwa kontenery** spięte w jeden stos przez Docker Compose:

```
                 ┌──────────────────────────────────────────┐
   przeglądarka  │  app  (Node.js 20)        port 5173       │
   :5173 ───────▶│   • serwer HTTP + API + pliki statyczne   │
                 │   • migracje schematu + seed przy starcie  │
                 └───────────────┬──────────────────────────┘
                                 │  postgres://…@db:5432
                 ┌───────────────▼──────────────────────────┐
                 │  db  (PostgreSQL 16)      port 5432        │
                 │   • wolumen trwały: hairbook-postgres      │
                 │   • rozszerzenia btree_gist, pgcrypto      │
                 └──────────────────────────────────────────┘
```

Aplikacja przy starcie **czeka na bazę**, zakłada schemat (migracje) i — gdy baza jest pusta — wgrywa dane demonstracyjne (seed).

---

## 2. Wymagania środowiska

- **Docker** ≥ 24 oraz **Docker Compose v2** (`docker compose`).
- Wolne porty hosta: **5173** (aplikacja) i **5432** (baza).
- ~300 MB miejsca na obrazy i wolumen danych.

> Wariant bez Dockera (natywny): Node.js ≥ 20 + PostgreSQL 16 z rozszerzeniami `btree_gist` i `pgcrypto`; konfiguracja przez zmienne środowiskowe z §4.

---

## 3. Przygotowanie środowiska

1. Sklonuj/rozpakuj projekt i wejdź do katalogu.
2. (Opcjonalnie) utwórz plik konfiguracyjny:

```powershell
Copy-Item .env.example .env
```

3. W pliku `.env` ustaw co najmniej **hasło bazy** i — dla HTTPS — `COOKIE_SECURE=true`. Bez pliku `.env` użyte zostaną wartości domyślne (środowisko demonstracyjne).

---

## 4. Konfiguracja (zmienne środowiskowe)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | `hairbook` | Parametry bazy |
| `APP_PORT` | `5173` | Port hosta dla aplikacji |
| `DEMO_PASSWORD` | `1234` | Hasło kont demo przy pierwszym seedzie |
| `COOKIE_SECURE` | `false` | Flaga `Secure` ciasteczka sesji (HTTPS) |
| `SALON_TZ` | `Europe/Warsaw` | Strefa czasowa salonu |
| `BOOKING_MIN_LEAD_MINUTES` | `0` | Min. wyprzedzenie rezerwacji online |
| `BOOKING_MAX_ADVANCE_DAYS` | `120` | Maks. horyzont rezerwacji online |

---

## 5. Wdrożenie — jedno polecenie

```powershell
docker compose up --build -d
```

Compose zbuduje obraz aplikacji, uruchomi bazę, poczeka aż będzie **zdrowa**, a następnie wystartuje aplikację. Obie usługi mają politykę `restart: unless-stopped` (automatyczny restart po awarii/reboocie) oraz **healthcheck**.

Sprawdzenie statusu:

```powershell
docker compose ps
```

Oczekiwane:

```
SERVICE   IMAGE                 STATUS                  PORTS
app       barbershop-main-app   Up (healthy)            0.0.0.0:5173->5173/tcp
db        postgres:16-alpine    Up (healthy)            0.0.0.0:5432->5432/tcp
```

---

## 6. Weryfikacja wdrożenia (testy dymne)

```powershell
# 1) Stan zdrowia API
curl http://127.0.0.1:5173/api/health          # → {"ok":true}

# 2) Strona aplikacji
#    otwórz w przeglądarce:
#    http://127.0.0.1:5173
```

Logowanie kontem demo i odczyt stanu (PowerShell):

```powershell
$body = '{"email":"j.sosnowski@hairapp.com","password":"1234"}'
curl -X POST http://127.0.0.1:5173/api/auth/login -H "Content-Type: application/json" -d $body
```

**Wynik weryfikacji (13.06.2026):** `/api/health` → `{"ok":true}`; strona z tytułem „Praga Barbers — Barber Studio”; logowanie administratora zwraca konto; `/api/state` zwraca dane salonu (2 fryzjerów, 4 usługi, 4 klientów, 5 rezerwacji). Oba kontenery w stanie **healthy**.

---

## 7. Konta demo

Hasło wszystkich kont: **`1234`**

| Rola | E-mail |
|------|--------|
| Administrator | `j.sosnowski@hairapp.com` |
| Fryzjer | `b.sochacki@hairapp.com` |
| Fryzjer | `b.walczyk@hairapp.com` |
| Klient | `n.szyszka@hairapp.com` |

---

## 8. Eksploatacja

```powershell
docker compose logs -f app        # podgląd logów aplikacji
docker compose restart app        # restart aplikacji
docker compose stop               # zatrzymanie (dane pozostają)
docker compose up -d              # ponowny start
docker compose down               # usunięcie kontenerów (wolumen danych zostaje)
docker compose down -v            # PEŁNY reset: usuwa też dane i wolumen
```

- **Reset danych z aplikacji:** administrator może zresetować i ponownie zaseedować bazę endpointem `POST /api/reset`.
- **Kopia zapasowa bazy:**

```powershell
docker compose exec db pg_dump -U hairbook hairbook > backup.sql
```

---

## 9. Wdrożenie produkcyjne — wskazówki

Środowisko domyślne jest **demonstracyjne**. Dla produkcji:

1. **Hasła i sekrety** — zmień `POSTGRES_PASSWORD` i `DEMO_PASSWORD`; trzymaj je w pliku `.env`/menedżerze sekretów, nie w repozytorium.
2. **HTTPS** — postaw reverse proxy (np. Nginx/Caddy/Traefik) z certyfikatem TLS przed aplikacją i ustaw `COOKIE_SECURE=true`.
3. **Sieć** — nie wystawiaj portu `5432` bazy publicznie; ogranicz go do sieci wewnętrznej Compose (usuń mapowanie portu db).
4. **Trwałość** — wolumen `hairbook-postgres` przechowuje dane; zaplanuj regularny `pg_dump`.
5. **Aktualizacje** — `docker compose pull && docker compose up --build -d`.

---

## 10. Rozwiązywanie problemów

| Objaw | Przyczyna / rozwiązanie |
|-------|--------------------------|
| `app` restartuje się w pętli | Baza niedostępna — sprawdź `docker compose logs db`; aplikacja sama ponawia połączenie. |
| Port zajęty (`5173`/`5432`) | Zmień `APP_PORT` w `.env` lub zwolnij port. |
| Brak danych demo po starcie | Seed wykonuje się tylko na **pustej** bazie. Wyczyść: `docker compose down -v`. |
| Błędne godziny wizyt | Ustaw spójną strefę `Europe/Warsaw` (zmienne `TZ`/`SALON_TZ`). |

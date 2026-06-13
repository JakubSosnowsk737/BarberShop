# Plan testów — System E-Barber (Praga Barbers / HairBook)

**Etap 6 projektu: Testy systemu**
Dokument opisuje plan testów jednostkowych, modułowych i funkcjonalnych, środowisko i automatyzację procesu testowania. Powiązany z dokumentacją wymagań z *Części II* (§6).

Prezentacja: **13.06.2026**

---

## 1. Cel i zakres

Celem testów jest potwierdzenie, że zaimplementowany system spełnia wymagania funkcjonalne, niefunkcjonalne i kontrolę ryzyka zdefiniowane w *Części II*, oraz zabezpieczenie kodu przed regresją podczas dalszego rozwoju.

**W zakresie:**
- czysta logika domenowa frontu (`src/core.js`) — kalendarz, sloty, obłożenie, rezerwacje;
- warstwa uwierzytelniania (`server/auth.mjs`) — hasła, sesje, walidacja, sanityzacja;
- pełen przepływ HTTP → routing → logika → PostgreSQL (`server.mjs`, `server/repository.mjs`);
- reguły biznesowe: kontrola kolizji, urlopy, kontrola dostępu wg roli, CSRF, limit logowań.

**Poza zakresem (zgodnie z MVP):** moduł płatności/prowizji/fakturowania (celowo pominięty), testy wydajnościowe pod realnym obciążeniem produkcyjnym, testy UI w przeglądarce (manualne, poza tym dokumentem).

---

## 2. Strategia testów — piramida

Przyjęto klasyczną piramidę testów: szeroka, szybka podstawa testów jednostkowych, węższa warstwa testów modułowych i wąski, ale reprezentatywny zestaw testów funkcjonalnych E2E.

```
            ┌───────────────────────────┐
            │   Funkcjonalne (E2E)  20   │   HTTP + PostgreSQL
          ┌─┴───────────────────────────┴─┐
          │      Modułowe          10      │   współpraca funkcji modułu
        ┌─┴───────────────────────────────┴─┐
        │      Jednostkowe        73         │   pojedyncze funkcje, izolacja
        └───────────────────────────────────┘
                    Razem: 103 testy
```

| Poziom | Co weryfikuje | Zależności | Liczba |
|--------|---------------|-----------|:------:|
| **Jednostkowe** | pojedyncze, czyste funkcje w izolacji | brak (tylko `node:test`) | 73 |
| **Modułowe** | współpracę wielu funkcji jednego modułu w realistycznym scenariuszu | brak | 10 |
| **Funkcjonalne (E2E)** | zachowanie całego systemu przez API, na realnej bazie | PostgreSQL (Docker/CI) | 20 |

---

## 3. Poziomy testów — szczegóły

### 3.1. Testy jednostkowe (`tests/unit/`)

Sprawdzają pojedyncze funkcje bez efektów ubocznych, dla wielu danych wejściowych i przypadków brzegowych.

- `core.test.mjs`, `core.extra.test.mjs` — logika domenowa: `createBooking`, `hasBookingConflict`, `buildCalendarSlots`, `dayAvailability`, `utilizationForDate`, `staffAvailableMinutes`, `monthGrid`, `localIntervalOnDate` (wall-clock), formatery, `upsertEntity` itd.
- `auth.test.mjs`, `auth.extra.test.mjs` — `validateRegistrationInput`, `hashPassword`/`verifyPassword` (scrypt), `parseCookies`/`serializeSessionCookie`, `normalizeEmail`/`normalizePhone`, `sanitizeUser`.

**Cel pokrycia:** ≥ 90 % linii i gałęzi dla `core.js` i `auth.mjs`.

### 3.2. Testy modułowe (`tests/module/`)

Sprawdzają, że funkcje jednego modułu dają **spójny** obraz przy współdziałaniu (integracja wewnątrz modułu, nadal bez bazy).

- `scheduling.module.test.mjs` — moduł harmonogramu: siatka slotów ↔ minuty dostępności ↔ obłożenie dnia muszą być wzajemnie spójne (m.in. inwariant „wolne sloty × krok = dostępne minuty”).
- `booking-lifecycle.module.test.mjs` — moduł rezerwacji: pełny cykl wizyty (utworzenie → kolizja → zmiana statusu → wartość, statystyki, nadchodzące).
- `auth-session.module.test.mjs` — moduł użytkowników/sesji: walidacja → klucze deduplikacji → hash → sanityzacja → obieg ciasteczka sesji.

### 3.3. Testy funkcjonalne / E2E (`tests/functional/`)

Czarna skrzynka ponad pełnym stosem. Szkielet (`_harness.mjs`) uruchamia **ten sam** handler HTTP co produkcja na efemerycznym porcie, na dedykowanej bazie `hairbook_test`, i udostępnia klienta HTTP z obsługą ciasteczka sesji. Przed każdym testem baza jest resetowana do powtarzalnego seeda.

- `api.functional.test.mjs` — ścieżki biznesowe: sesja/logowanie, zakres danych wg roli, tworzenie rezerwacji, kolizja (409), termin w przeszłości / poza godzinami / w urlopie (400), rezerwacja i anulowanie przez klienta, urlop anulujący wizytę + powiadomienie, nieodwracalność stanu końcowego.
- `security.functional.test.mjs` — bezpieczeństwo: kontrola dostępu wg roli (401/403), ochrona CSRF (obcy `Origin` → 403), limit nieudanych logowań (429).

> Gdy baza jest niedostępna (np. lokalnie bez Dockera), zestaw funkcjonalny **pomija się** ze statusem SKIP zamiast zgłaszać błędy — dzięki sondzie `probeDatabase()`.

---

## 4. Środowisko testowe i narzędzia

| Element | Wybór | Uzasadnienie |
|---------|-------|--------------|
| Runner testów | **`node:test`** (wbudowany w Node 20+) | zero zależności, zgodny ze stosem projektu |
| Asercje | **`node:assert/strict`** | wbudowane, jednoznaczne |
| Pokrycie | `node --test --experimental-test-coverage` | natywny pomiar bez dodatkowych narzędzi |
| Baza (E2E) | **PostgreSQL 16** (kontener `postgres:16-alpine`) | identyczna jak produkcyjna; rozszerzenia `btree_gist`, `pgcrypto` |
| Orkiestracja lokalnie | **Docker Compose** | `docker compose up -d db` |
| CI | **GitHub Actions** | testy na każdym pushu/PR, baza jako *service container* |
| Strefa czasowa | **Europe/Warsaw** | spójność wall-clock front↔back (kontrola ryzyka KR-03) |

**Wymagania środowiska:** Node ≥ 20, npm, (dla E2E) Docker. Strefa `Europe/Warsaw` zalecana dla zgodności asercji czasu.

---

## 5. Organizacja i konwencje

```
tests/
├── unit/         # testy jednostkowe (*.test.mjs)
├── module/       # testy modułowe (*.module.test.mjs)
└── functional/   # testy E2E (*.functional.test.mjs) + _harness.mjs
```

- Nazewnictwo plików: `*.test.mjs`; przypadki nazwane po polsku, opisowo (zachowanie, nie implementacja).
- Grupowanie: `describe()` per funkcja/scenariusz, `test()`/`t()` per przypadek.
- Dane testowe budowane z czasu lokalnego (`localIso`) — asercje niezależne od strefy maszyny.
- Izolacja E2E: `beforeEach` resetuje bazę; każdy plik biegnie w osobnym procesie; pliki funkcjonalne uruchamiane z `--test-concurrency=1`, by nie kolidować na wspólnej bazie.

### Polecenia

| Polecenie | Zakres |
|-----------|--------|
| `npm test` | jednostkowe + modułowe (bez bazy) |
| `npm run test:unit` | tylko jednostkowe |
| `npm run test:module` | tylko modułowe |
| `npm run test:functional` | tylko funkcjonalne (wymaga bazy) |
| `npm run test:functional:db` | wstaje `db` w Dockerze i uruchamia E2E |
| `npm run test:all` | wszystkie poziomy |
| `npm run test:coverage` | jednostkowe + modułowe z pomiarem pokrycia |

---

## 6. Kryteria wejścia i wyjścia

**Kryteria wejścia:** kod kompiluje się i uruchamia; dostępne środowisko (Node, dla E2E baza); seed danych demonstracyjnych działa.

**Kryteria wyjścia (akceptacji):**
1. 100 % zaplanowanych przypadków wykonanych.
2. 0 testów nieprzechodzących (`fail = 0`).
3. Pokrycie `core.js` i `auth.mjs` ≥ 90 % linii i gałęzi.
4. Każde wymaganie funkcjonalne z §6 *Części II* ma co najmniej jeden powiązany przypadek (macierz w §8).
5. Wszystkie defekty o priorytecie wysokim/krytycznym usunięte i pokryte testem regresyjnym.

---

## 7. Zarządzanie defektami

Defekty rejestrowane w *Raporcie z testów* (`Raport-testow.md`) z identyfikatorem `D-NN`, opisem, priorytetem, statusem i powiązanym testem. Tryb pracy: **red → green** — test odtwarzający defekt powstaje przed poprawką i pozostaje jako test regresyjny.

| Priorytet | Definicja | Czas reakcji |
|-----------|-----------|--------------|
| Krytyczny | utrata/uszkodzenie danych, obejście kontroli dostępu | natychmiast, blokuje wydanie |
| Wysoki | niezgodność z wymaganiem/specyfikacją | przed prezentacją etapu |
| Średni | błąd brzegowy bez wpływu na ścieżkę główną | w kolejnej iteracji |
| Niski | kosmetyka, dług techniczny | wg możliwości |

---

## 8. Macierz identyfikowalności (wymaganie → test)

Wymagania wg *Części II*, §6: funkcjonalne (**WF**), niefunkcjonalne (**WN**), kontrola ryzyka (**KR**).

| ID | Wymaganie | Poziom | Powiązane testy |
|----|-----------|--------|-----------------|
| WF-01 | Rejestracja klienta z weryfikacją danych | J, M | `validateRegistrationInput` (unit), `auth-session.module` |
| WF-02 | Uwierzytelnianie użytkowników | J, F | `hashPassword`/`verifyPassword` (unit); „logowanie/sesja” (E2E) |
| WF-03 | Kalendarz z procentowym obłożeniem | J, M | `dayAvailability`, `utilizationForDate`, `monthGrid` (unit); `scheduling.module` |
| WF-04 | Blokada rezerwacji poza godzinami pracy | F | „termin poza godzinami pracy (400)” (E2E) |
| WF-05 | Blokada rezerwacji w przeszłości | F | „rezerwacja w przeszłości (400)” (E2E) |
| WF-06 | Blokada rezerwacji w czasie urlopu | F | „nowa rezerwacja w czasie urlopu (400)” (E2E) |
| WF-07 | Sloty z kolorami dostępności | J, M | `buildCalendarSlots` (unit); `scheduling.module` |
| WF-08 | Klient anuluje wyłącznie własną wizytę | F | „klient rezerwuje/anuluje”, „klient nie zmieni statusu (403)” (E2E) |
| WF-09 | Administrator zarządza zespołem/usługami/kontami | F | kontrola dostępu wg roli (E2E) |
| WF-10 | Pełna edycja rezerwacji z rewalidacją terminu | J, F | `hasBookingConflict` (unit); kolizja 409 (E2E) |
| WF-11 | Urlop anuluje kolidujące wizyty + powiadomienie | F | „urlop anuluje wizytę i powiadamia klienta” (E2E) |
| WF-12 | Cykl życia statusu wizyty (stany końcowe trwałe, §8.1) | F | „stan końcowy nieodwracalny” (E2E) — defekt **D-01** |
| WN-02 | Spójność transakcyjna (kolizje na poziomie bazy) | F | kolizja 409 z constraintu `EXCLUDE` (E2E) |
| WN-03 | Hasła jako skrót + sól, brak jawnego hasła | J, M | `hashPassword`/`verifyPassword`, `sanitizeUser` |
| WN-04 | Limit nieudanych prób logowania | F | „po serii błędnych prób 429” (E2E) |
| WN-06 | Lokalizacja PL komunikatów | J, F | asercje treści komunikatów (unit + E2E) |
| KR-01 | Niemożliwość podwójnej rezerwacji | J, M, F | `hasBookingConflict` (unit), `booking-lifecycle.module`, kolizja 409 (E2E) |
| KR-02 | Role i uprawnienia przy każdej akcji | J, F | `getRoleCapabilities` (unit); kontrola dostępu 401/403, zakres `/api/state` (E2E) |
| KR-03 | Jedna strefa czasowa (wall-clock) | J, M | `localIntervalOnDate`, `scheduling.module` |
| — | Ochrona CSRF | F | „obcy Origin → 403” (E2E) |

> **WN-01** (czas odpowiedzi < 2 s) i **WN-05** (uruchomienie jednym poleceniem Docker) weryfikowane przeglądem konfiguracji i obserwacją czasów odpowiedzi (E2E: ~0,5 s/żądanie), nie odrębnym testem automatycznym.

---

## 9. Ryzyka procesu testowego

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Brak Dockera w środowisku dewelopera | testy E2E nie ruszą lokalnie | sonda `probeDatabase()` → SKIP; E2E i tak biegną w CI |
| Różnica stref czasowych maszyny | nietrwałe asercje czasu | dane z czasu lokalnego; zalecana strefa `Europe/Warsaw`; weekday liczony w UTC po stronie serwera |
| Współdzielona baza między plikami E2E | wyścigi danych | `--test-concurrency=1` + reset per test |
| Niestabilność dat względnych w seedzie | „dziś”-zależne wizyty | terminy E2E liczone 3–7 tyg. naprzód, w dni robocze |

---

## 10. Harmonogram

| Krok | Status |
|------|:------:|
| Opracowanie planu testów | ✅ |
| Implementacja testów jednostkowych | ✅ |
| Implementacja testów modułowych | ✅ |
| Implementacja testów funkcjonalnych (E2E) | ✅ |
| Automatyzacja (skrypty npm + CI GitHub Actions) | ✅ |
| Wykonanie i raport z wynikami | ✅ (`Raport-testow.md`) |
| Prezentacja | 13.06.2026 |

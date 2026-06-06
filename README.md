# HairBook — system zarządzania salonem barberskim

Lokalna aplikacja webowa do prowadzenia salonu barberskiego: rezerwacje online i z recepcji,
kalendarz pracy, kartoteka klientów (CRM), zespół, usługi, urlopy pracownicze i powiadomienia.
Zbudowana na podstawie dokumentów `E-Barber-System.pdf` oraz `HairBook_BiznesPlan_v1.0.docx`
(pełna dokumentacja koncepcyjna w katalogu [`docs/`](docs/)).

Backend to lekki serwer Node.js (bez frameworka) z bazą **PostgreSQL**, frontend to czysty
JavaScript (ES Modules) renderowany po stronie przeglądarki. Całość uruchamiana jednym
poleceniem w Dockerze.

---

## Spis treści

- [Najważniejsze funkcje](#najważniejsze-funkcje)
- [Role i uprawnienia](#role-i-uprawnienia)
- [Stos technologiczny](#stos-technologiczny)
- [Struktura projektu](#struktura-projektu)
- [Uruchomienie w Dockerze](#uruchomienie-w-dockerze)
- [Konta demo](#konta-demo)
- [Logika biznesowa](#logika-biznesowa)
- [Bezpieczeństwo](#bezpieczeństwo)
- [Przegląd API](#przegląd-api)
- [Konfiguracja (zmienne środowiskowe)](#konfiguracja-zmienne-środowiskowe)
- [Testy](#testy)
- [Reset bazy danych](#reset-bazy-danych)
- [Zakres MVP i ograniczenia](#zakres-mvp-i-ograniczenia)

---

## Najważniejsze funkcje

- **Konta i sesje** — logowanie i rejestracja, hasła hashowane (scrypt), sesje w ciasteczku
  `HttpOnly` przechowywane w bazie.
- **Rezerwacje** — wybór usługi, fryzjera, dnia i godziny w slotach (krok konfigurowalny).
  Twarda blokada nakładających się wizyt — także constraintem `EXCLUDE` w PostgreSQL.
- **Kalendarz** — widok miesięczny z mapą obłożenia oraz dzienny grafik per fryzjer.
  Dni, w które fryzjer nie pracuje lub nie ma już wolnych miejsc, są **wyszarzone**.
- **Urlopy pracownicze** — fryzjer zarządza swoimi nieobecnościami, administrator widzi
  wszystkie. Dodanie urlopu **automatycznie anuluje kolidujące wizyty i powiadamia klienta**.
- **CRM klientów** — kartoteka z notatkami, tagami i historią wizyt; wyszukiwarka.
  Ochrona przed duplikatami: automatyczne łączenie konta z kartą gościa przy rejestracji
  oraz ręczne scalanie kart przez administratora.
- **Zespół i usługi** — administrator dodaje i edytuje fryzjerów (dni pracy, kolor, status)
  oraz pozycje cennika.
- **Powiadomienia** — skrzynka zdarzeń salonowych oraz powiadomienia adresowane do klienta
  (np. o odwołanej wizycie).
- **Ustawienia salonu** — nazwa, adres, godziny otwarcia i krok kalendarza.

## Role i uprawnienia

| Widok / akcja                       | Klient | Fryzjer | Administrator |
|-------------------------------------|:------:|:-------:|:-------------:|
| Rezerwacja online                   |   ✅   |    —    |       —       |
| Moje wizyty / własny profil         |   ✅   |    —    |       —       |
| Grafik dnia (swój)                  |   —    |   ✅    |      ✅       |
| Kalendarz salonu                    |   —    |   ✅    |      ✅       |
| Lista rezerwacji + zmiana statusu   |   —    |   ✅    |      ✅       |
| Edycja wizyty (przepięcie terminu)  |   —    |    —    |      ✅       |
| CRM klientów                        |   —    |   ✅    |      ✅       |
| Urlopy własne                       |   —    |   ✅    |      ✅       |
| Urlopy całego zespołu               |   —    |    —    |      ✅       |
| Zespół, usługi, użytkownicy         |   —    |    —    |      ✅       |
| Ustawienia salonu                   |   —    |    —    |      ✅       |

Klient może anulować wyłącznie własną przyszłą wizytę. Fryzjer zarządza tylko swoimi urlopami.

## Stos technologiczny

- **Node.js 20** — serwer HTTP oparty o moduł `node:http` (bez Express).
- **PostgreSQL 16** — trwałe dane, rozszerzenia `pgcrypto` i `btree_gist`
  (constrainty `EXCLUDE` przeciw nakładającym się wizytom i urlopom).
- **Frontend** — czysty JavaScript (ES Modules), bez bundlera; logika domenowa wydzielona
  do testowalnych funkcji w `src/core.js`.
- **Docker / Docker Compose** — uruchomienie aplikacji i bazy.
- **node:test** — testy jednostkowe logiki domenowej i warstwy auth (bez bazy).

## Struktura projektu

```
.
├── server.mjs              # serwer HTTP, routing API, serwowanie plików, CSRF, rate-limit
├── server/
│   ├── auth.mjs            # hashowanie haseł, ciasteczka sesji, walidacja, normalizacja
│   ├── db.mjs              # pula połączeń, migracje schematu i constrainty
│   └── repository.mjs      # logika domenowa + zapytania SQL (rezerwacje, urlopy, CRM)
├── src/
│   ├── app.js             # warstwa UI (render, zdarzenia, modale, kalendarz)
│   ├── core.js            # czysta logika domenowa (sloty, obłożenie, kalendarz)
│   ├── data.js            # dane startowe (seed)
│   └── styles.css         # style
├── tests/                 # testy node:test (core + auth)
├── docs/                  # dokumentacja koncepcyjna (PDF/DOCX/MD + diagramy)
├── index.html
├── Dockerfile
└── docker-compose.yml
```

## Uruchomienie w Dockerze

```powershell
docker compose up --build
```

Po starcie otwórz w przeglądarce:

```text
http://127.0.0.1:5173
```

PostgreSQL jest wystawiony lokalnie na porcie `5432`. Strefa czasowa kontenerów to
`Europe/Warsaw` (godziny wizyt liczone są w strefie salonu).

## Konta demo

Hasło dla wszystkich kont demo: **`1234`**

| Rola          | Imię i nazwisko    | E-mail                    |
|---------------|--------------------|---------------------------|
| Administrator | Jakub Sosnowski    | `j.sosnowski@hairapp.com` |
| Fryzjer       | Bartosz Sochacki   | `b.sochacki@hairapp.com`  |
| Fryzjer       | Bartosz Walczyk    | `b.walczyk@hairapp.com`   |
| Klient        | Norbert Szyszka    | `n.szyszka@hairapp.com`   |

Rejestracja w aplikacji tworzy nowe konto klienta (hasło min. 8 znaków). Jeśli podane dane
pasują do istniejącej karty gościa, konto zostanie z nią automatycznie połączone.

Terminy przykładowych wizyt są generowane względem dnia uruchomienia, więc demo zawsze
pokazuje nadchodzące i niedawne wizyty.

## Logika biznesowa

### Rezerwacje
- Walidacja po stronie serwera: usługa aktywna, fryzjer aktywny i pracujący danego dnia,
  termin w godzinach otwarcia, brak kolizji z inną wizytą i z urlopem, brak rezerwacji
  w przeszłości.
- Rezerwacje online klienta mają konfigurowalny minimalny czas wyprzedzenia i maksymalny
  horyzont (domyślnie 120 dni).
- Sloty i kolizje liczone są w strefie salonu (spójnie między frontendem a backendem).

### Urlopy a rezerwacje
- Dodanie lub wydłużenie urlopu w transakcji **anuluje kolidujące wizyty** i tworzy dla
  każdego klienta powiadomienie z datą i powodem.
- Urlop blokuje nowe rezerwacje w danym terminie; nakładające się urlopy jednego fryzjera są
  niedozwolone (constraint w bazie).
- Częściowy urlop poprawnie obniża dostępność i obłożenie dnia.

### Deduplikacja klientów
1. **Przy tworzeniu karty** — miękkie ostrzeżenie, gdy istnieje karta z tym samym telefonem
   lub e-mailem.
2. **Przy rejestracji** — automatyczne połączenie konta z niepołączoną kartą gościa
   (zgodny telefon i e-mail), gdy kandydat jest dokładnie jeden.
3. **Ręczne scalanie** — administrator scala duplikat w kartę docelową: przepięcie wizyt,
   połączenie notatek/tagów, zachowanie konta i usunięcie duplikatu.

## Bezpieczeństwo

- Hasła hashowane algorytmem **scrypt**; sesje jako losowy token, w bazie trzymany hash.
- Ciasteczko sesji `HttpOnly`, `SameSite=Lax` (opcjonalnie `Secure`).
- **Ochrona CSRF** — żądania mutujące z przeglądarki muszą mieć zgodny nagłówek
  `Origin`/`Referer`.
- **Rate-limit logowania** — limit nieudanych prób na adres IP, reset po udanym logowaniu.
- **Zakres danych wg roli** — klient otrzymuje wyłącznie własne dane; listy CRM i kont nie
  wyciekają do nieuprawnionych ról.
- Wygasłe sesje są cyklicznie czyszczone.

## Przegląd API

Wszystkie odpowiedzi są w formacie JSON. Uwierzytelnianie przez ciasteczko sesji.

| Metoda i ścieżka                         | Opis                                   | Rola            |
|------------------------------------------|----------------------------------------|-----------------|
| `POST /api/auth/login`                   | Logowanie                              | —               |
| `POST /api/auth/register`                | Rejestracja klienta                    | —               |
| `POST /api/auth/logout`                  | Wylogowanie                            | zalogowany      |
| `GET /api/session`                       | Stan sesji                             | —               |
| `GET /api/state`                         | Stan aplikacji (wg roli)               | zalogowany      |
| `POST /api/bookings`                     | Nowa rezerwacja                        | klient/recepcja |
| `PATCH /api/bookings/:id/status`         | Zmiana statusu wizyty                  | wg roli         |
| `PATCH /api/bookings/:id`                | Edycja wizyty                          | admin           |
| `POST /api/clients`                      | Nowa karta klienta                     | admin/fryzjer   |
| `PATCH /api/clients/:id`                 | Edycja karty                           | admin/fryzjer   |
| `POST /api/clients/:id/merge`            | Scalenie duplikatu                     | admin           |
| `POST /api/time-off`                     | Dodanie urlopu                         | admin/fryzjer   |
| `PATCH/DELETE /api/time-off/:id`         | Edycja/usunięcie urlopu                | admin/fryzjer   |
| `POST /api/services`, `PATCH .../:id`    | Usługi                                 | admin           |
| `POST /api/staff`, `PATCH .../:id`       | Zespół                                 | admin           |
| `POST /api/users`, `PATCH .../:id`       | Konta użytkowników                     | admin           |
| `PATCH /api/profile`                     | Edycja własnego profilu                | zalogowany      |
| `PATCH /api/notifications/:id/read`      | Oznaczenie powiadomienia               | wg roli         |
| `PATCH /api/settings`                    | Ustawienia salonu                      | admin           |
| `POST /api/reset`                        | Reset i ponowny seed bazy              | admin           |

## Konfiguracja (zmienne środowiskowe)

| Zmienna                      | Domyślnie         | Opis                                            |
|------------------------------|-------------------|-------------------------------------------------|
| `DATABASE_URL`               | (z części składowych) | Połączenie do PostgreSQL                     |
| `PORT` / `HOST`              | `5173` / `0.0.0.0`| Adres serwera                                   |
| `DEMO_PASSWORD`              | `1234`            | Hasło kont demo przy seedzie                     |
| `COOKIE_SECURE`             | `false`           | Flaga `Secure` na ciasteczku sesji              |
| `SALON_TZ`                   | `Europe/Warsaw`   | Strefa czasowa salonu                           |
| `BOOKING_MIN_LEAD_MINUTES`   | `0`               | Min. wyprzedzenie rezerwacji online             |
| `BOOKING_MAX_ADVANCE_DAYS`   | `120`             | Maks. horyzont rezerwacji online                |
| `STATE_BOOKINGS_WINDOW_DAYS` | `365`             | Okno rezerwacji zwracanych w `/api/state`       |
| `STATE_NOTIFICATIONS_LIMIT`  | `200`             | Limit powiadomień w `/api/state`                |

## Testy

Testy logiki domenowej i auth nie wymagają bazy:

```powershell
node --test tests/*.test.mjs
```

(lub `npm test`)

## Reset bazy danych

Seed wykonuje się tylko na pustej bazie. Aby wczytać nowe dane startowe lub wyczyścić wszystko:

```powershell
docker compose down -v
docker compose up --build
```

Administrator może też zresetować dane z poziomu aplikacji (endpoint `POST /api/reset`).

## Zakres MVP i ograniczenia

- Moduł **płatności, prowizji i fakturowania jest celowo pominięty**.
- Aplikacja zaprojektowana do pracy lokalnej / na pojedynczej instancji salonu.
- Publiczna rejestracja wymaga hasła min. 8 znaków; konta demo (`1234`) tworzy seed z pominięciem
  tej walidacji.

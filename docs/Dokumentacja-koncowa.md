# Dokumentacja końcowa — System E-Barber (Praga Barbers / HairBook)

**Projekt z Inżynierii Oprogramowania — dokument zamykający (Etap 7).**
Podsumowuje cel, architekturę, realizację wszystkich etapów, wyniki testów i wdrożenie systemu.

Data: 13.06.2026

---

## 1. Wprowadzenie

**E-Barber** to lokalna aplikacja webowa do prowadzenia salonu barberskiego: rezerwacje online i z recepcji, kalendarz pracy, kartoteka klientów (CRM), zarządzanie zespołem, usługami, urlopami i powiadomieniami. Wdrożenie demonstracyjne działa pod marką **Praga Barbers** (Warszawa).

**Problem biznesowy.** Salon przed wdrożeniem opierał się na telefonie i papierowym terminarzu — brakowało jednego źródła prawdy o terminach, zdarzały się podwójne rezerwacje, a klienci umawiali się na dni wolne pracowników. System rozwiązuje to cyfrowym kalendarzem z wielowarstwową kontrolą kolizji, widocznością urlopów i panelem administracyjnym.

---

## 2. Aktorzy i role

| Rola | Zakres |
|------|--------|
| **Klient** | rezerwacja online, kalendarz z obłożeniem, „moje wizyty”, anulowanie własnej wizyty, edycja profilu |
| **Fryzjer** | plan dnia, kalendarz salonu, CRM klientów, własne urlopy, zmiana statusu wizyty |
| **Administrator** | pełny CRUD: zespół, usługi, konta, wszystkie rezerwacje i urlopy, ustawienia salonu |

Aktorzy systemowi: **moduł rezerwacji** (kontrola kolizji, obłożenie) i **magazyn powiadomień** działają automatycznie w tle. Hierarchia uprawnień jest egzekwowana w interfejsie, w logice aplikacji i w bazie danych.

---

## 3. Zakres funkcjonalny — moduły

| Moduł | Odpowiedzialność |
|-------|------------------|
| Użytkownicy / sesje | rejestracja, logowanie (scrypt), sesje, edycja profilu |
| Rezerwacje | tworzenie wizyt, kontrola kolizji, statusy, edycja |
| Harmonogram | kalendarz miesięczny i dzienny, sloty, obłożenie, urlopy |
| Powiadomienia | rejestr zdarzeń salonowych i powiadomienia do klienta |
| Zasoby | zespół (fryzjerzy) i katalog usług |
| Konfiguracja | profil salonu, godziny pracy, krok kalendarza |

Świadomie **poza zakresem MVP**: płatności, prowizje, fakturowanie.

---

## 4. Architektura techniczna

- **Backend:** Node.js 20, serwer HTTP na module `node:http` (bez frameworka). Routing API, serwowanie plików, ochrona CSRF, rate-limit logowania.
- **Baza:** PostgreSQL 16 z rozszerzeniami `pgcrypto` i `btree_gist`. Twarda kontrola kolizji wizyt i urlopów constraintami `EXCLUDE` (zakresy czasu `tstzrange`).
- **Frontend:** czysty JavaScript (ES Modules), renderowany po stronie przeglądarki, bez bundlera. Logika domenowa wydzielona do testowalnego `src/core.js`.
- **Uruchomienie:** Docker + Docker Compose (app + db), strefa czasowa `Europe/Warsaw`.

```
server.mjs            routing API, CSRF, rate-limit, pliki statyczne, handler (requestListener)
server/
  auth.mjs            hasła (scrypt), ciasteczka sesji, walidacja, normalizacja
  db.mjs              pula połączeń, migracje schematu, constrainty
  repository.mjs      logika domenowa + zapytania SQL (rezerwacje, urlopy, CRM)
src/
  core.js             czysta logika domenowa (sloty, obłożenie, kalendarz)
  app.js              warstwa UI (render, zdarzenia, modale, kalendarz)
  data.js             dane startowe (seed)
```

---

## 5. Model danych (encje)

Konto użytkownika (`users`) jest wspólne dla wszystkich ról i — zależnie od roli — powiązane z kartą klienta (`clients`) lub stanowiskiem fryzjera (`staff`). Rezerwacja (`bookings`) łączy klienta, fryzjera, usługę (`services`) i przedział czasu. Urlop (`time_off`) dotyczy fryzjera. Salon (`salon`) i powiadomienia (`notifications`) to obiekty globalne. Sesje (`sessions`) przechowują skrót tokenu.

Spójność na poziomie bazy: zakaz nakładających się wizyt jednego fryzjera oraz nakładających się urlopów (constrainty `EXCLUDE … gist`), walidacja godzin i statusów (`CHECK`).

---

## 6. Kluczowa logika biznesowa

- **Rezerwacje** — walidacja po stronie serwera: usługa aktywna, fryzjer aktywny i pracujący danego dnia, termin w godzinach otwarcia, brak kolizji z wizytą i urlopem, brak rezerwacji w przeszłości. Sloty i kolizje liczone w strefie salonu (spójnie front↔back).
- **Urlopy a rezerwacje** — dodanie urlopu w transakcji **anuluje kolidujące wizyty** i tworzy powiadomienie dla klienta; urlop blokuje nowe rezerwacje w danym terminie.
- **Cykl życia wizyty** — `potwierdzona → {zrealizowana | anulowana}`; stany końcowe są **nieodwracalne** (egzekwowane po stronie serwera — zob. defekt D-01).
- **Deduplikacja klientów** — ostrzeżenie o duplikacie, automatyczne łączenie konta z kartą gościa przy rejestracji, ręczne scalanie kart przez administratora.

---

## 7. Bezpieczeństwo

- Hasła hashowane **scrypt** z indywidualną solą; system nigdy nie przechowuje hasła jawnie.
- Ciasteczko sesji `HttpOnly`, `SameSite=Lax`, opcjonalnie `Secure`.
- **Ochrona CSRF** — żądania mutujące z przeglądarki muszą mieć zgodny `Origin`/`Referer`.
- **Rate-limit logowania** — limit nieudanych prób na adres IP.
- **Zakres danych wg roli** — klient otrzymuje wyłącznie własne dane; listy CRM i kont nie wyciekają.

---

## 8. Jakość — testy (Etap 6)

Trójpoziomowy zestaw **103 testów automatycznych**, wszystkie przechodzą:

| Poziom | Liczba | Zależności |
|--------|:------:|------------|
| Jednostkowe | 73 | brak |
| Modułowe | 10 | brak |
| Funkcjonalne (E2E) | 20 | PostgreSQL |

Pokrycie logiki domenowej i auth: **100 % linii, 96 % gałęzi, 100 % funkcji**. Proces zautomatyzowany (skrypty npm + CI GitHub Actions z bazą). W trakcie testów wykryto i naprawiono defekt **D-01** (egzekwowanie maszyny stanów rezerwacji) oraz poprawkę testowalności **P-02**. Szczegóły: [`Plan-testow.md`](Plan-testow.md), [`Raport-testow.md`](Raport-testow.md).

---

## 9. Wdrożenie (Etap 7)

System wdrażany jest jednym poleceniem `docker compose up --build -d` jako stos **app + db**, z politykami restartu i healthcheckami. Wdrożenie zweryfikowano testami dymnymi (health, strona, logowanie, stan z bazą) — oba kontenery w stanie *healthy*. Pełna instrukcja: [`Wdrozenie.md`](Wdrozenie.md).

Dostęp: `http://127.0.0.1:5173` · konta demo (hasło `1234`) w przewodniku wdrożenia.

---

## 10. Realizacja etapów projektu

| Etap | Zakres | Rezultat |
|------|--------|----------|
| 1–2 | Koncepcja, model opisowy, cel projektu | Część I dokumentacji |
| 3 | Aktorzy, przypadki użycia, wymagania, modele statyczny i dynamiczny | [Część II](E-Barber-System-CzescII.md) + diagramy |
| 4–5 | Implementacja systemu (backend, frontend, baza, Docker) | Działająca aplikacja referencyjna |
| 6 | Testy systemu (plan, implementacja, automatyzacja, raport) | 103 testy, CI, [raport](Raport-testow.md) |
| 7 | Wdrożenie i prezentacja systemu | System wdrożony + dokumentacja końcowa |

---

## 11. Ograniczenia i kierunki rozwoju

**Ograniczenia (MVP):** brak modułu płatności/prowizji/fakturowania; aplikacja przewidziana dla pojedynczej instancji salonu; obliczenia czasu zakładają zgodność strefy przeglądarki ze strefą salonu (warstwą rozstrzygającą jest serwer).

**Możliwy rozwój:** integracja płatności i powiadomień SMS/e-mail, panel statystyk i raportów, wielooddziałowość, aplikacja mobilna, testy wydajnościowe pod obciążeniem.

---

## 12. Spis dokumentacji

| Dokument | Zawartość |
|----------|-----------|
| [`E-Barber-System-CzescII.md`](E-Barber-System-CzescII.md) | aktorzy, przypadki użycia, wymagania, modele |
| [`Plan-testow.md`](Plan-testow.md) | plan testów (Etap 6) |
| [`Raport-testow.md`](Raport-testow.md) | wyniki testów i poprawki (Etap 6) |
| [`Wdrozenie.md`](Wdrozenie.md) | przewodnik wdrożenia (Etap 7) |
| `Dokumentacja-koncowa.md` | niniejszy dokument zamykający |
| `Prezentacja-Systemu.pptx` | prezentacja systemu dla grupy projektowej |
| [`../README.md`](../README.md) | przegląd techniczny i API |

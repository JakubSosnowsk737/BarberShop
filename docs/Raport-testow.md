# Raport z testów — System E-Barber (Praga Barbers / HairBook)

**Etap 6 projektu: Testy systemu — wyniki i poprawki**
Data wykonania: **13.06.2026**

---

## 1. Streszczenie wykonawcze

Zaprojektowano i zaimplementowano trójpoziomowy zestaw **103 testów automatycznych** (jednostkowe, modułowe, funkcjonalne E2E). Wszystkie przechodzą. Pokrycie kluczowej logiki domenowej i warstwy uwierzytelniania osiągnęło **100 % linii** i **96 % gałęzi**. W trakcie testów wykryto i naprawiono **1 defekt** (niezgodność z modelem dynamicznym §8.1) oraz wprowadzono 1 poprawkę testowalności. Proces testowania został zautomatyzowany (skrypty npm + CI GitHub Actions z bazą PostgreSQL).

| Metryka | Wynik |
|---------|:-----:|
| Testy łącznie | **103** |
| Przeszły | **103 (100 %)** |
| Nie przeszły | 0 |
| Pominięte | 0 |
| Pokrycie linii (`core.js` + `auth.mjs`) | **100 %** |
| Pokrycie gałęzi | **96,02 %** |
| Pokrycie funkcji | **100 %** |
| Defekty wykryte / naprawione | **1 / 1** |

---

## 2. Środowisko wykonania

| Element | Wartość |
|---------|---------|
| Node.js | v24.15.0 |
| Runner | `node:test` + `node:assert/strict` |
| System | Windows 11 Pro (26200) |
| Baza (E2E) | PostgreSQL 16-alpine (Docker, kontener `barbershop-main-db-1`) |
| Strefa czasowa | Europe/Warsaw |
| Polecenie pełnego przebiegu | `npm run test:all` |

---

## 3. Wyniki wg poziomów

### 3.1. Testy jednostkowe — `tests/unit/`

```
ℹ tests 73
ℹ pass 73
ℹ fail 0
```

| Plik | Zakres | Przypadki |
|------|--------|:---------:|
| `core.test.mjs` | bazowa logika domenowa (kolizje, sloty, obłożenie, kalendarz) | 11 |
| `core.extra.test.mjs` | uzupełnienie + gałęzie brzegowe `core.js` | 37 |
| `auth.test.mjs` | bazowa walidacja/sesja | 5 |
| `auth.extra.test.mjs` | uzupełnienie + gałęzie brzegowe `auth.mjs` | 20 |

### 3.2. Testy modułowe — `tests/module/`

```
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

| Plik | Moduł | Co potwierdza |
|------|-------|---------------|
| `scheduling.module.test.mjs` | harmonogram | spójność: sloty ↔ minuty ↔ obłożenie; inwariant „wolne sloty × krok = dostępne minuty”; dzień zamknięty |
| `booking-lifecycle.module.test.mjs` | rezerwacje | cykl: utworzenie → kolizja → statusy → wartość/statystyki/nadchodzące |
| `auth-session.module.test.mjs` | użytkownicy/sesja | walidacja → dedup → hash → sanityzacja → obieg ciasteczka |

### 3.3. Testy funkcjonalne (E2E) — `tests/functional/`

```
ℹ tests 20
ℹ pass 20
ℹ fail 0
ℹ duration_ms ~10000   (≈ 0,5 s / żądanie, pełny stos + PostgreSQL)
```

| Obszar | Przypadki (skrót) |
|--------|-------------------|
| Sesja / logowanie | health 200; brak sesji; logowanie ustawia ciasteczko; błędne hasło 401 |
| Zakres danych wg roli | admin pełny stan; klient tylko własne dane, bez listy kont, zamaskowane powody urlopów |
| Rezerwacje | utworzenie (frontdesk); kolizja 409; poza godzinami 400; w urlopie 400; w przeszłości 400; klient online + anulowanie |
| Cykl statusu (§8.1) | stan końcowy nieodwracalny (**regresja D-01**) |
| Urlop ↔ wizyty | urlop anuluje kolidującą wizytę i powiadamia klienta |
| Bezpieczeństwo | 401 bez sesji; 403 wg roli (klient/fryzjer); klient nie ustawi „zrealizowana”; CSRF (obcy Origin) 403; limit logowań 429 |

---

## 4. Pokrycie kodu

Pomiar: `npm run test:coverage` (testy jednostkowe + modułowe).

```
ℹ file      | line % | branch % | funcs % | uncovered lines
ℹ  auth.mjs | 100.00 |   100.00 |  100.00 |
ℹ  core.js  | 100.00 |    94.66 |  100.00 |
ℹ all files | 100.00 |    96.02 |  100.00 |
```

Pozostałe ~5 % gałęzi w `core.js` to defensywne wartości domyślne i krótkie spięcia (`|| []`, `?.`) bez ścieżki biznesowej. Warstwa `server/repository.mjs` (zapytania SQL) jest pokrywana **behawioralnie** przez testy funkcjonalne E2E, a nie przez pomiar liniowy.

---

## 5. Rejestr defektów i poprawek

### D-01 — Brak egzekwowania maszyny stanów rezerwacji (priorytet: wysoki) — ✅ naprawiony

**Opis.** Model dynamiczny (*Część II*, §8.1) stanowi, że stany końcowe rezerwacji — *zrealizowana* i *anulowana* — są nieodwracalne. Implementacja `updateBookingStatusRecord` (`server/repository.mjs`) walidowała jedynie **nazwę** docelowego statusu, nie sprawdzając stanu bieżącego. Umożliwiało to niedozwolone przejścia, np. *zrealizowana → potwierdzona*, wbrew specyfikacji.

**Wykrycie (red).** Test funkcjonalny odtwarzający scenariusz początkowo **nie przechodził** — serwer zwracał `200 OK` zamiast odrzucenia:

```
✖ stan końcowy jest nieodwracalny — nie można cofnąć 'zrealizowana' → 'potwierdzona'
ℹ pass 11  ℹ fail 1
```

**Poprawka.** W `updateBookingStatusRecord` dodano kontrolę stanu bieżącego: ze stanu końcowego (`completed`/`cancelled`) nie jest możliwe żadne przejście; próba kończy się `400` z komunikatem PL „Wizyta jest już zakończona — jej statusu nie można zmienić.”

**Weryfikacja (green).** Po poprawce zestaw funkcjonalny przechodzi w całości:

```
✔ stan końcowy jest nieodwracalny — nie można cofnąć 'zrealizowana' → 'potwierdzona'
ℹ pass 20  ℹ fail 0
```

Test pozostaje w zestawie jako **test regresyjny**.

### P-02 — Refaktoryzacja testowalności serwera (poprawka, nie defekt) — ✅ wprowadzona

`server.mjs` automatycznie startował serwer i łączył się z bazą przy każdym imporcie, co uniemożliwiało testy E2E w procesie. Wydzielono handler żądań (`requestListener`) i objęto auto-start strażą „głównego modułu” (`node server.mjs`). Import w testach nie wywołuje już nasłuchu ani połączenia — zachowanie produkcyjne bez zmian. Umożliwiło to uruchomienie tego samego handlera na efemerycznym porcie w testach funkcjonalnych.

---

## 6. Obserwacje i zalecenia (bez zmian w tym etapie)

1. **Sprzężenie ze strefą czasową we froncie (ryzyko KR-03).** Funkcje `staffAvailableMinutes`/`dayCapacity` w `core.js` liczą okno pracy w czasie lokalnym przeglądarki i porównują je z instantami UTC. Działa to poprawnie, gdy strefa przeglądarki = strefa salonu (założenie projektu). Warstwą rozstrzygającą pozostaje serwer (wall-clock w `Europe/Warsaw`). *Zalecenie:* rozważyć ujednolicenie obliczeń frontu do jawnego wall-clock salonu, analogicznie do `localIntervalOnDate`.
2. **WN-01 (czas odpowiedzi < 2 s).** Zaobserwowany czas obsługi żądania w E2E to ≈ 0,5 s na pełnym stosie z PostgreSQL — z dużym zapasem względem wymagania. *Zalecenie:* dla potwierdzenia pod obciążeniem dodać osobny test wydajnościowy (poza zakresem etapu).
3. **Rejestracja przez API.** Walidacja rejestracji jest pokryta na poziomie jednostkowym i modułowym; pełną ścieżkę `POST /api/auth/register` można w przyszłości domknąć dodatkowym testem E2E.

---

## 7. Ocena kryteriów akceptacji (z Planu testów §6)

| Kryterium | Próg | Wynik | Status |
|-----------|------|-------|:------:|
| Wykonanie zaplanowanych przypadków | 100 % | 103/103 | ✅ |
| Testy nieprzechodzące | 0 | 0 | ✅ |
| Pokrycie linii/gałęzi `core.js`+`auth.mjs` | ≥ 90 % | 100 % / 96 % | ✅ |
| Każde wymaganie z macierzy ma test | tak | tak (§8 Planu) | ✅ |
| Defekty wysokie/krytyczne usunięte + regresja | tak | D-01 naprawiony + test | ✅ |

---

## 8. Wnioski

Wszystkie cele etapu 6 zostały osiągnięte. System został pokryty zestawem 103 testów na trzech poziomach, w pełni zautomatyzowanym (lokalnie i w CI). Testy potwierdziły zgodność z wymaganiami z *Części II* i wykryły jedną realną niezgodność ze specyfikacją (D-01), którą naprawiono i zabezpieczono testem regresyjnym. Zestaw testów stanowi trwałą siatkę bezpieczeństwa dla dalszego rozwoju systemu.

# Skrypt do prezentacji — Etap 6: Testy systemu E-Barber

Tekst do odczytania, slajd po slajdzie. Czas całości ≈ 10–12 min.
Wskazówki w nawiasach `(...)` są dla prelegenta — nie czyta się ich na głos.

---

## Slajd 1 — Tytuł  *(≈ 40 s)*

Dzień dobry. Przedstawiamy szósty etap naszego projektu — **testy systemu E-Barber**, czyli aplikacji do zarządzania barbershopem Praga Barbers.

W tym etapie zajęliśmy się czterema rzeczami: opracowaniem **planu testów**, ich **implementacją i przeprowadzeniem**, **automatyzacją** całego procesu oraz przygotowaniem **raportu z wynikami**.

Od razu zdradzę najważniejszą liczbę, do której wrócimy: przygotowaliśmy **103 testy, wszystkie przechodzą**, a w trakcie pracy znaleźliśmy i naprawiliśmy jeden realny błąd.

*(przejście do slajdu 2)*

---

## Slajd 2 — Cel i zakres  *(≈ 55 s)*

Zacznijmy od celu. Testy mają nam dać **dwie rzeczy**: po pierwsze — potwierdzić, że system faktycznie spełnia wymagania, które zdefiniowaliśmy w Części II dokumentacji; po drugie — stworzyć siatkę bezpieczeństwa, która wychwyci błędy przy dalszym rozwoju.

Co testujemy? Po lewej stronie — **w zakresie**: logikę domenową frontu, czyli kalendarz, sloty, obłożenie i rezerwacje; warstwę uwierzytelniania — hasła, sesje, walidację; cały stos od żądania HTTP, przez routing i logikę, aż po bazę PostgreSQL; oraz reguły biznesowe — kontrolę kolizji, urlopy, role, ochronę CSRF i limit logowań.

Po prawej — **poza zakresem**, zgodnie z założeniami MVP: moduł płatności, który celowo pominęliśmy w projekcie, testy wydajnościowe pod realnym obciążeniem oraz manualne testy interfejsu w przeglądarce.

*(przejście)*

---

## Slajd 3 — Strategia: piramida testów  *(≈ 60 s)*

Naszą strategię oparliśmy na klasycznej **piramidzie testów**.

U podstawy — **73 testy jednostkowe**. Są najszybsze i najtańsze: sprawdzają pojedyncze funkcje w izolacji, bez bazy, w ułamku sekundy.

W środku — **10 testów modułowych**. One łapią błędy integracji *wewnątrz* modułu — sprawdzają, że współpracujące ze sobą funkcje dają spójny wynik.

Na szczycie — **20 testów funkcjonalnych**, czyli end-to-end. Jest ich najmniej, ale są najbardziej wartościowe poznawczo: potwierdzają realne zachowanie całego systemu na prawdziwym PostgreSQL.

Taki układ to świadomy wybór: dużo szybkich testów na dole daje błyskawiczną informację zwrotną, a wąski szczyt — pewność, że całość naprawdę działa. Razem **103 testy**.

*(przejście)*

---

## Slajd 4 — Trzy poziomy testów  *(≈ 70 s)*

Przyjrzyjmy się, co konkretnie sprawdza każdy poziom.

**Jednostkowe** — w katalogu `tests/unit`. Tu testujemy tworzenie rezerwacji i wykrywanie kolizji, budowanie siatki slotów i liczenie obłożenia dnia, hashowanie haseł algorytmem scrypt, a także obliczenia kalendarzowe i czas „wall-clock".

**Modułowe** — w `tests/module`. Przykład najlepiej pokazuje ideę: w module harmonogramu sprawdzamy, że siatka slotów, dostępne minuty fryzjera i procent obłożenia **zgadzają się ze sobą** — mamy nawet test inwariantu „liczba wolnych slotów razy krok równa się dostępnym minutom". Drugi moduł to pełny cykl życia wizyty, trzeci — obieg rejestracji i sesji.

**Funkcjonalne** — w `tests/functional`. Tu przez API testujemy logowanie i zakres danych zależny od roli, tworzenie rezerwacji wraz z odrzucaniem kolizji (kod 409) i błędnych terminów (400), scenariusz „urlop anuluje wizytę i powiadamia klienta", a także bezpieczeństwo — CSRF i limit logowań.

*(przejście)*

---

## Slajd 5 — Środowisko i narzędzia  *(≈ 50 s)*

Świadomie dobraliśmy narzędzia tak, żeby **nie dokładać projektowi zależności**.

Testy uruchamiamy **wbudowanym** runnerem `node:test` z asercjami `node:assert/strict` — to standard biblioteczny Node, bez instalowania frameworków. Pokrycie kodu mierzymy również natywnie, flagą `--experimental-test-coverage`.

Do testów end-to-end używamy **PostgreSQL 16** — dokładnie takiej samej bazy jak produkcyjna, z rozszerzeniami `btree_gist` i `pgcrypto` — uruchamianej przez **Docker Compose** jednym poleceniem. Całość spina **GitHub Actions**, które uruchamia testy przy każdej zmianie kodu.

*(przejście)*

---

## Slajd 6 — Automatyzacja procesu testowania  *(≈ 60 s)*

To był jeden z głównych wymogów etapu — **automatyzacja**.

Po lewej widać zestaw skryptów npm. Najważniejsze: `npm test` uruchamia testy jednostkowe i modułowe — bez bazy, więc działa wszędzie. `npm run test:functional:db` sam wstawia bazę w Dockerze i odpala testy end-to-end. `npm run test:all` uruchamia wszystkie poziomy, a `test:coverage` dokłada pomiar pokrycia.

Po prawej — przepływ w CI. Każdy `push` lub pull request wyzwala pipeline: najpierw testy jednostkowe i modułowe z pomiarem pokrycia, potem funkcjonalne na osobnym kontenerze PostgreSQL. Dopiero **zielony build** jest warunkiem scalenia zmian.

Dodam jeszcze jedną rzecz: testy end-to-end potrafią się **inteligentnie pominąć**, jeśli baza jest niedostępna — wtedy zamiast błędu pokazują status SKIP. Dzięki temu kolega bez Dockera dalej spokojnie odpali testy jednostkowe.

*(przejście)*

---

## Slajd 7 — Wyniki testów  *(≈ 55 s)*

I najważniejszy slajd — wyniki.

**103 testy, sto procent przechodzi. Zero testów czerwonych.**

Pokrycie kluczowej logiki — czyli modułów `core.js` i `auth.mjs` — to **100 procent linii** i **96 procent gałęzi**. Funkcje pokryte w całości.

Na wykresie widać rozkład: 73 jednostkowe, 10 modułowych, 20 funkcjonalnych. W tabeli obok — szczegóły pokrycia: oba kluczowe pliki mają komplet pokrycia linii, a brakujące kilka procent gałęzi w `core.js` to defensywne wartości domyślne bez znaczenia biznesowego.

Warto dodać, że testy end-to-end wykonały się **realnie**, na uruchomionym PostgreSQL — to nie są wyniki „na sucho".

*(przejście)*

---

## Slajd 8 — Wykryty defekt i poprawka  *(≈ 75 s)*

Testy nie są od tego, żeby tylko świecić na zielono — mają **wykrywać błędy**. I jeden wykryły.

W naszej dokumentacji, w modelu dynamicznym, zapisaliśmy, że **stany końcowe rezerwacji są nieodwracalne** — wizyty „zrealizowanej" ani „anulowanej" nie da się cofnąć. Okazało się, że serwer tego **nie pilnował**: sprawdzał tylko, czy nazwa nowego statusu jest poprawna, a nie czy takie przejście w ogóle jest dozwolone.

Zadziałaliśmy metodą **red–green**. Najpierw napisaliśmy test odtwarzający sytuację z dokumentacji — i on, jak widać po lewej, **nie przeszedł**: cofnięcie statusu zwracało „200 OK" zamiast odrzucenia.

Potem nanieśliśmy poprawkę — serwer egzekwuje teraz maszynę stanów i odrzuca takie przejście kodem 400. Test po prawej jest **zielony** i zostaje w zestawie jako test regresyjny, który nie pozwoli temu błędowi wrócić.

Na dole — druga, drobniejsza poprawka, oznaczona P-02: uczyniliśmy serwer **testowalnym**. Wcześniej startował automatycznie przy każdym imporcie; teraz ten sam kod obsługi żądań można uruchomić w testach na losowym porcie, a zachowanie produkcyjne pozostało bez zmian.

*(przejście)*

---

## Slajd 9 — Identyfikowalność wymagań  *(≈ 55 s)*

Żeby udowodnić, że testy faktycznie pokrywają wymagania, a nie testują czegoś przypadkowego, przygotowaliśmy **macierz identyfikowalności**.

Każdemu wymaganiu z Części II — funkcjonalnemu, niefunkcjonalnemu i kontroli ryzyka — przypisaliśmy konkretny test i poziom, na którym jest sprawdzane.

Kilka przykładów: blokady terminów — poza godzinami, w przeszłości, w urlopie — pokrywają testy end-to-end. Hasła i ich bezpieczne przechowywanie — testy jednostkowe i modułowe. Najważniejsze ryzyko, czyli **niemożliwość podwójnej rezerwacji**, sprawdzamy aż na trzech poziomach jednocześnie — w logice, w module i end-to-end na ograniczeniu bazy danych.

Krótko mówiąc: **żadne wymaganie nie zostało bez pokrycia.**

*(przejście)*

---

## Slajd 10 — Wnioski  *(≈ 45 s)*

Podsumowując.

Zrealizowaliśmy wszystkie cele etapu: plan, implementację, automatyzację i raport. Mamy **103 testy na trzech poziomach, sto procent przechodzi**, a pokrycie logiki to 100 procent linii.

Testy spełniły swoją rolę — wykryły jedną realną niezgodność ze specyfikacją, którą **naprawiliśmy i zabezpieczyliśmy testem regresyjnym**.

Cały proces jest w pełni zautomatyzowany — lokalnie i w CI. A powstały zestaw testów to **trwała siatka bezpieczeństwa** dla dalszego rozwoju systemu.

Dziękujemy za uwagę. Chętnie odpowiemy na pytania.

---

## Załącznik — przygotowanie do pytań *(nie czytać; ściąga na Q&A)*

**Dlaczego `node:test`, a nie Jest/Mocha?**
Bo projekt nie ma frameworka i chcieliśmy zero dodatkowych zależności. `node:test` jest wbudowany w Node 20+, ma asercje i pomiar pokrycia — w zupełności wystarcza.

**Czemu repozytorium (`repository.mjs`) nie ma pokrycia liniowego?**
Bo to warstwa zapytań SQL — testujemy ją **behawioralnie**, przez testy end-to-end na prawdziwej bazie, a nie pomiarem linii. Pomiar pokrycia robimy dla czystej logiki (`core.js`, `auth.mjs`).

**Jak testy E2E nie psują sobie nawzajem danych?**
Każdy plik biegnie w osobnym procesie, na dedykowanej bazie `hairbook_test`, a przed każdym testem baza jest resetowana do powtarzalnego seeda. Pliki funkcjonalne uruchamiamy sekwencyjnie (`--test-concurrency=1`).

**Czy testy są stabilne mimo dat względnych?**
Tak — terminy w testach liczymy kilka tygodni naprzód i tylko w dni robocze, a dzień tygodnia po stronie serwera liczony jest w UTC, więc wynik nie zależy od strefy maszyny.

**Co z wymaganiem czasu odpowiedzi poniżej 2 sekund?**
W testach E2E obserwowaliśmy około pół sekundy na żądanie na pełnym stosie z bazą — z dużym zapasem. Pełny test obciążeniowy jest poza zakresem tego etapu.

**Ile czasu zajmuje pełny przebieg?**
Jednostkowe i modułowe — ułamek sekundy. Wszystkie 103 testy z bazą — około 12 sekund.

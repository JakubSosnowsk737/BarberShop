# Skrypt do prezentacji — Etap 7: Wdrożenie i prezentacja systemu E-Barber

Tekst do odczytania, slajd po slajdzie, z wplecionymi wskazówkami do **demonstracji na żywo**.
Czas całości ≈ 12–15 min (w tym ~4 min demo). Uwagi w `(...)` są dla prelegenta.

> **Przed startem:** upewnij się, że stos działa — `docker compose ps` pokazuje `app` i `db` jako *healthy*, a w przeglądarce otwiera się `http://127.0.0.1:5173`. Miej otwarte dwie karty: jedną zalogowaną jako klient, drugą gotową do logowania jako administrator.

---

## Slajd 1 — Tytuł *(≈ 35 s)*

Dzień dobry. Przedstawiamy finalny, siódmy etap projektu — **wdrożenie i prezentację systemu E-Barber**, aplikacji do zarządzania salonem barberskim, którą zbudowaliśmy w ramach przedmiotu.

System jest **wdrożony i działa** — za chwilę pokażemy go na żywo. Jest w pełni przetestowany — 103 testy, sto procent przechodzi — i obsługuje trzy role użytkowników.

*(przejście)*

---

## Slajd 2 — Problem i rozwiązanie *(≈ 55 s)*

Zacznijmy od tego, **po co** ten system powstał.

Salon przed wdrożeniem działał na telefonie i papierowym terminarzu. To rodziło konkretne problemy — po lewej: brak jednego źródła prawdy o terminach, podwójne rezerwacje tego samego fryzjera, umawianie klientów na dni, w które pracownik miał wolne, oraz brak historii i preferencji klienta.

Nasze rozwiązanie — po prawej — to **cyfrowy kalendarz jako jedno źródło prawdy**, z kontrolą kolizji na trzech poziomach naraz, z widocznymi urlopami, które blokują wolne terminy, z kartoteką klientów i panelem administratora, który pozwala salonowi obsługiwać się samodzielnie.

*(przejście)*

---

## Slajd 3 — Aktorzy i role *(≈ 50 s)*

System obsługuje **trzy role**, a każda rozwiązuje inny problem salonu.

**Klient** rezerwuje wizyty online — widzi kalendarz z procentem obłożenia, swoje wizyty i może anulować własną.

**Fryzjer** zarządza swoim dyżurem — plan dnia, kartoteka swoich klientów, samodzielne zgłaszanie urlopów.

**Administrator** ma pełen zakres — zespół, usługi, konta, wszystkie rezerwacje i urlopy oraz ustawienia salonu.

Co ważne: uprawnienia są egzekwowane **wszędzie** — w interfejsie, w logice i w bazie danych.

*(przejście)*

---

## Slajd 4 — Moduły systemu *(≈ 40 s)*

Funkcjonalnie system dzieli się na **sześć modułów**: użytkownicy i sesje, rezerwacje, harmonogram, powiadomienia, zasoby — czyli zespół i usługi — oraz konfiguracja salonu.

Każdy moduł ma jasno wydzielony zakres i własny model danych. Zgodnie z założeniami MVP świadomie pominęliśmy moduł płatności.

*(przejście do demo)*

---

## Slajd 5 — Demo: rezerwacja online *(≈ 60 s slajd + przejście do żywego demo)*

Najważniejszy scenariusz to **rezerwacja online klienta** — pięć kroków: wybór usługi, wybór fryzjera, kalendarz z obłożeniem dnia, wybór 15-minutowego slotu i potwierdzenie z walidacją po stronie serwera.

Kolory na dole to klucz do kalendarza — od zielonego „wolne", przez żółty i pomarańczowy, po czerwone „pełne lub zajęte".

**(DEMO NA ŻYWO — przełącz na przeglądarkę, karta klienta)**
- *Jesteśmy zalogowani jako klient.* Wybieram usługę — na przykład skin fade — i fryzjera.
- *Pokaż kalendarz miesięczny.* Widać procent obłożenia każdego dnia; dni zamknięte i pełne są wyszarzone.
- *Kliknij wolny dzień.* Pojawia się siatka slotów — wybieram wolny termin i potwierdzam.
- *Pokaż „Moje wizyty".* Wizyta jest na liście; mogę ją anulować — i termin natychmiast się zwalnia.

*(wróć do slajdów)*

---

## Slajd 6 — Demo: kalendarz i urlopy *(≈ 60 s slajd + żywe demo)*

Druga rzecz, którą warto pokazać, to **urlopy** — bo to one chronią klienta.

Po lewej: co widać w kalendarzu — widok miesięczny z mapą obłożenia, dni zamknięte wyszarzone, widok dzienny per fryzjer i sloty co 15 minut.

Po prawej najciekawszy mechanizm: gdy fryzjer doda urlop, system w **jednej transakcji** anuluje kolidujące wizyty i wysyła klientowi powiadomienie „Wizyta odwołana" wraz z terminem. Klient nigdy nie zostaje z wizytą w dniu, w którym fryzjera nie ma.

**(DEMO NA ŻYWO — przełącz na kartę administratora / fryzjera)**
- *Zaloguj się jako administrator.* Pokaż kalendarz salonu i listę rezerwacji.
- *Dodaj urlop* fryzjerowi na dzień, w którym jest wizyta.
- *Pokaż efekt:* wizyta zmienia status na „anulowana", a u klienta pojawia się powiadomienie.

*(wróć do slajdów)*

---

## Slajd 7 — Architektura techniczna *(≈ 55 s)*

Kilka słów o tym, jak to jest zbudowane.

Architektura jest prosta i celowo lekka: **przeglądarka** z czystym JavaScriptem, **serwer Node.js** na module `node:http` — bez żadnego frameworka — oraz baza **PostgreSQL 16**.

Najważniejsze: kontrola kolizji jest dociśnięta aż do bazy — ograniczeniami `EXCLUDE` na zakresach czasu. Nawet gdyby w logice aplikacji pojawił się błąd, baza i tak nie pozwoli zapisać dwóch nakładających się wizyt.

Całość uruchamiamy w Dockerze.

*(przejście)*

---

## Slajd 8 — Bezpieczeństwo *(≈ 50 s)*

Bezpieczeństwo zaadresowaliśmy **wielowarstwowo**.

Hasła przechowujemy wyłącznie jako skrót algorytmem scrypt z indywidualną solą — system nigdy nie zna hasła w postaci jawnej. Sesje to token w ciasteczku `HttpOnly`, a w bazie trzymamy tylko jego skrót. Mamy ochronę CSRF — kontrolę nagłówka `Origin` — oraz limit nieudanych logowań. I wreszcie: dane są ograniczane wedle roli — klient dostaje wyłącznie własne informacje, listy CRM i kont nie wyciekają.

A najważniejsze ryzyko — podwójna rezerwacja — jest blokowane jednocześnie w interfejsie, w logice i w bazie.

*(przejście)*

---

## Slajd 9 — Jakość: testy systemu *(≈ 45 s)*

Krótko o jakości, bo to był osobny etap.

Przygotowaliśmy **103 testy na trzech poziomach** — jednostkowe, modułowe i funkcjonalne end-to-end — i wszystkie przechodzą. Pokrycie kluczowej logiki to sto procent linii.

Cały proces jest zautomatyzowany — skryptami npm i w CI na GitHub Actions, z prawdziwą bazą PostgreSQL. Testy spełniły swoją rolę: wykryły jeden realny błąd, który naprawiliśmy i zabezpieczyliśmy testem regresyjnym.

*(przejście)*

---

## Slajd 10 — Wdrożenie systemu *(≈ 55 s)*

I sedno tego etapu — **wdrożenie**.

Cały system stawiamy **jednym poleceniem**: `docker compose up --build -d`. Compose buduje obraz aplikacji, uruchamia bazę, czeka aż będzie zdrowa, i startuje aplikację. Obie usługi mają automatyczny restart i healthcheck.

Po lewej widać status — oba kontenery w stanie *healthy*. Po prawej — testy dymne, które wykonaliśmy po wdrożeniu: API odpowiada, strona się ładuje, logowanie działa, a dane przychodzą z bazy. Wszystkie zaliczone.

System jest dostępny pod adresem localhost na porcie 5173 — i to jest dokładnie ta instancja, którą przed chwilą pokazywaliśmy.

*(przejście)*

---

## Slajd 11 — Podsumowanie *(≈ 40 s)*

Podsumowując całość projektu.

Przeszliśmy pełną drogę: od koncepcji, aktorów i wymagań w pierwszych etapach, przez implementację backendu, frontendu i bazy, przez testy systemu w etapie szóstym, aż po wdrożenie i dokumentację końcową w etapie siódmym.

Rezultat to **gotowy, działający system, wdrożony w środowisku Docker, wraz z kompletną dokumentacją końcową**.

Dziękujemy za uwagę. Chętnie odpowiemy na pytania albo pokażemy dowolny fragment systemu jeszcze raz na żywo.

---

## Załącznik — przygotowanie do pytań *(ściąga, nie czytać)*

**Czy system jest gotowy produkcyjnie?**
To wdrożenie demonstracyjne. Do produkcji przewidzieliśmy konkretne kroki — opisane w `Wdrozenie.md`: zmiana haseł, HTTPS z reverse proxy i `COOKIE_SECURE=true`, ukrycie portu bazy, regularny backup `pg_dump`.

**Co się stanie, jeśli aplikacja albo baza padnie?**
Obie usługi mają politykę `restart: unless-stopped`, więc wstają automatycznie. Aplikacja przy starcie czeka na bazę i ponawia połączenie. Dane są w trwałym wolumenie Dockera.

**Jak wgrywają się dane i schemat?**
Aplikacja przy pierwszym starcie sama zakłada schemat (migracje) i — gdy baza jest pusta — wgrywa dane demonstracyjne. To dlatego po `docker compose up` od razu mamy działające konta i przykładowe wizyty.

**Czemu bez frameworka (Express)?**
Świadoma decyzja — projekt jest lekki, zależności minimalne (tylko sterownik `pg`), a `node:http` w zupełności wystarcza. Łatwiej to też utrzymać i wdrożyć.

**Jak skalowalibyście to dalej?**
Naturalne kierunki: integracja płatności i powiadomień SMS/e-mail, panel statystyk, wielooddziałowość, aplikacja mobilna i testy wydajnościowe pod obciążeniem.

**Ile zajmuje wdrożenie od zera?**
Jedno polecenie i około minuty na zbudowanie obrazu oraz start — potem system jest gotowy pod adresem localhost:5173.

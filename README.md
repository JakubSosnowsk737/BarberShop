# HairBook Local

Lokalna aplikacja do zarządzania salonem barberskim zbudowana na podstawie plików `E-Barber-System.pdf` i `HairBook_BiznesPlan_v1.0.docx`.

## Zakres

- Logowanie i rejestracja kont użytkowników.
- Role: klient, fryzjer, administrator.
- Sesje użytkowników w ciasteczku `HttpOnly`.
- PostgreSQL jako trwała baza danych dla kont, klientów, zespołu, usług, rezerwacji, powiadomień i ustawień salonu.
- Rezerwacje z blokadą nakładających się terminów dla tego samego fryzjera, także constraintem w PostgreSQL.
- Kalendarz dzienny, szybkie tworzenie wizyt, statusy wizyt.
- Widoki klientów, historii wizyt, zespołu, usług, powiadomień i ustawień salonu.
- Moduł płatności, prowizji i fakturowania jest celowo pominięty.

## Uruchomienie w Dockerze

```powershell
docker compose up --build
```

Po starcie otwórz:

```text
http://127.0.0.1:5173
```

PostgreSQL jest wystawiony lokalnie na porcie `5432`.

## Konta demo

Hasło dla wszystkich kont demo:

```text
hairbook123
```

- Administrator: `marta@hairbook.local`
- Fryzjer: `oskar@hairbook.local`
- Klient: `adam@example.com`

Rejestracja w aplikacji tworzy nowe konto klienta.

## Testy lokalne

Testy logiki domenowej i auth nie wymagają bazy:

```powershell
& 'C:\Users\jakub\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --test .\tests\*.test.mjs
```

## Reset bazy Docker

Jeśli chcesz wyczyścić dane Postgresa i odtworzyć seed:

```powershell
docker compose down -v
docker compose up --build
```

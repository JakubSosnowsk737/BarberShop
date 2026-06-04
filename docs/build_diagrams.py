"""Generate diagram PNGs used inside the Part II PDF.

Produces visuals that mirror the look-and-feel of Part I:
- actors of the system
- use case bubbles
- booking state machine
- activity diagram for online booking
- sequence diagram for online booking
- static class/module map
- module decomposition badges

Outputs are saved to docs/img/.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle, Rectangle

OUT = Path(__file__).resolve().parent / "img"
OUT.mkdir(parents=True, exist_ok=True)

TEAL = "#0F766E"
TEAL_DARK = "#115E59"
INK = "#17201D"
MUTED = "#66736E"
LINE = "#D9E0DC"
PANEL = "#FFFFFF"
PANEL_SOFT = "#EEF4F1"
AMBER = "#B45309"
SOFT_BG = "#F1F5F4"
SOFT_GREEN = "#DCFCE7"
SOFT_YELLOW = "#FEF9C3"
SOFT_RED = "#FECACA"
WHITE = "#FFFFFF"

plt.rcParams["font.family"] = "Calibri"
plt.rcParams["font.size"] = 11


def save(fig, name: str):
    fig.savefig(OUT / name, dpi=180, bbox_inches="tight",
                facecolor=fig.get_facecolor(), edgecolor="none")
    plt.close(fig)


# ---------------------------------------------------------------- actor figure

def stick_figure(ax, cx, cy, scale=1.0, color=TEAL):
    head = Circle((cx, cy + 0.55 * scale), 0.18 * scale,
                  facecolor=color, edgecolor=color, zorder=3)
    ax.add_patch(head)
    ax.plot([cx, cx], [cy + 0.37 * scale, cy - 0.25 * scale],
            color=color, lw=3 * scale, zorder=2)
    ax.plot([cx - 0.32 * scale, cx + 0.32 * scale], [cy + 0.15 * scale, cy + 0.15 * scale],
            color=color, lw=3 * scale, zorder=2)
    ax.plot([cx, cx - 0.25 * scale], [cy - 0.25 * scale, cy - 0.75 * scale],
            color=color, lw=3 * scale, zorder=2)
    ax.plot([cx, cx + 0.25 * scale], [cy - 0.25 * scale, cy - 0.75 * scale],
            color=color, lw=3 * scale, zorder=2)


def actor_card(ax, cx, cy, title, role_color, items: list[str]):
    width, height = 4.2, 4.0
    box = FancyBboxPatch(
        (cx - width / 2, cy - height / 2),
        width, height,
        boxstyle="round,pad=0.04,rounding_size=0.18",
        linewidth=1.2,
        edgecolor=role_color,
        facecolor=PANEL_SOFT,
    )
    ax.add_patch(box)
    stick_figure(ax, cx, cy + 1.2, scale=1.0, color=role_color)
    ax.text(cx, cy + 0.05, title,
            ha="center", va="center", fontsize=15, fontweight="bold", color=INK)
    for i, item in enumerate(items):
        ax.text(cx, cy - 0.4 - 0.3 * i, "•  " + item,
                ha="center", va="center", fontsize=9.5, color=MUTED)


def diagram_actors():
    fig, ax = plt.subplots(figsize=(11, 5.2))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 15)
    ax.set_ylim(0, 7)
    ax.axis("off")

    actor_card(ax, 2.6, 3.3, "Klient", TEAL, [
        "Rezerwacja online", "Edycja profilu",
        "Historia wizyt", "Anulowanie wizyty",
    ])
    actor_card(ax, 7.5, 3.3, "Fryzjer", AMBER, [
        "Plan dnia / kalendarz", "Kartoteka klientów",
        "Urlopy własne", "Powiadomienia",
    ])
    actor_card(ax, 12.4, 3.3, "Administrator", TEAL_DARK, [
        "Zarządzanie zespołem", "Cennik i usługi",
        "Konta użytkowników", "Wszystkie wizyty",
    ])
    ax.text(7.5, 6.5, "Trzy role, trzy poziomy odpowiedzialności",
            ha="center", va="center", fontsize=14, color=TEAL, fontweight="bold")
    save(fig, "01-actors.png")


# ---------------------------------------------------------------- use case bubble

def use_case_diagram():
    fig, ax = plt.subplots(figsize=(11.5, 8))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis("off")

    # System boundary
    ax.add_patch(Rectangle((3.4, 0.7), 7.2, 8.6, fill=False,
                           edgecolor=TEAL, linewidth=1.5))
    ax.text(7.0, 9.1, "System E-Barber", ha="center", va="center",
            fontsize=12, color=TEAL, fontweight="bold")

    # Actors
    stick_figure(ax, 1.5, 6.5, color=TEAL)
    ax.text(1.5, 5.4, "Klient", ha="center", fontsize=11, fontweight="bold", color=INK)

    stick_figure(ax, 1.5, 3.0, color=AMBER)
    ax.text(1.5, 1.9, "Fryzjer", ha="center", fontsize=11, fontweight="bold", color=INK)

    stick_figure(ax, 12.5, 4.8, color=TEAL_DARK)
    ax.text(12.5, 3.7, "Administrator", ha="center", fontsize=11, fontweight="bold", color=INK)

    # Use cases (label, x, y)
    use_cases_client = [
        ("Rezerwacja\nwizyty", 5.5, 7.6),
        ("Wybór terminu\nw kalendarzu", 5.5, 6.4),
        ("Anulowanie\nwłasnej wizyty", 5.5, 5.2),
        ("Edycja profilu", 5.5, 4.0),
        ("Przegląd oferty", 5.5, 2.8),
    ]
    use_cases_barber = [
        ("Plan dnia", 8.0, 7.6),
        ("Zarządzanie\nurlopem", 8.0, 6.4),
        ("Karta klienta", 8.0, 5.2),
        ("Status wizyty", 8.0, 4.0),
    ]
    use_cases_admin = [
        ("Zespół", 10.0, 7.6),
        ("Usługi", 10.0, 6.4),
        ("Konta", 10.0, 5.2),
        ("Konfiguracja\nsalonu", 10.0, 2.8),
        ("Edycja wizyty", 10.0, 4.0),
    ]

    def bubble(x, y, text, color):
        ax.add_patch(mpatches.Ellipse((x, y), 1.7, 0.85,
                                       facecolor=PANEL_SOFT, edgecolor=color, lw=1.2))
        ax.text(x, y, text, ha="center", va="center", fontsize=8.5, color=INK)

    for label, x, y in use_cases_client:
        bubble(x, y, label, TEAL)
        ax.plot([1.9, x - 0.8], [6.0, y], color=TEAL, lw=0.6, alpha=0.45)
    for label, x, y in use_cases_barber:
        bubble(x, y, label, AMBER)
        ax.plot([1.9, x - 0.8], [3.0, y], color=AMBER, lw=0.6, alpha=0.45)
    for label, x, y in use_cases_admin:
        bubble(x, y, label, TEAL_DARK)
        ax.plot([12.1, x + 0.8], [4.7, y], color=TEAL_DARK, lw=0.6, alpha=0.45)

    save(fig, "02-use-cases.png")


# ---------------------------------------------------------------- state diagram

def state_diagram():
    fig, ax = plt.subplots(figsize=(10, 3.8))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 4)
    ax.axis("off")

    def state(x, y, label, fill):
        box = FancyBboxPatch((x - 1.2, y - 0.55), 2.4, 1.1,
                             boxstyle="round,pad=0.02,rounding_size=0.4",
                             facecolor=fill, edgecolor=TEAL_DARK, linewidth=1.5)
        ax.add_patch(box)
        ax.text(x, y, label, ha="center", va="center",
                fontsize=12, fontweight="bold", color=INK)

    # Initial dot
    ax.add_patch(Circle((1.2, 2), 0.18, color=INK))

    state(3.6, 2, "POTWIERDZONA", SOFT_GREEN)
    state(8.0, 3.1, "ZREALIZOWANA", PANEL_SOFT)
    state(8.0, 0.9, "ANULOWANA", SOFT_RED)

    # Arrows
    ax.annotate("", xy=(2.4, 2), xytext=(1.4, 2),
                arrowprops=dict(arrowstyle="->", color=INK, lw=1.5))
    ax.text(1.9, 2.3, "nowa", fontsize=9, ha="center", color=MUTED)

    ax.annotate("", xy=(6.8, 3.0), xytext=(4.8, 2.3),
                arrowprops=dict(arrowstyle="->", color=TEAL, lw=1.5))
    ax.text(5.8, 3.0, "wizyta wykonana", fontsize=9, color=TEAL)

    ax.annotate("", xy=(6.8, 1.0), xytext=(4.8, 1.7),
                arrowprops=dict(arrowstyle="->", color=AMBER, lw=1.5))
    ax.text(5.8, 1.0, "odwołanie", fontsize=9, color=AMBER)

    ax.text(6.0, 3.7, "Cykl życia rezerwacji",
            fontsize=13, fontweight="bold", color=TEAL, ha="center")
    save(fig, "03-booking-state.png")


# ---------------------------------------------------------------- activity diagram

def activity_diagram():
    fig, ax = plt.subplots(figsize=(8.5, 11))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 13)
    ax.axis("off")

    def node(x, y, label, shape="box", fill=PANEL_SOFT, edge=TEAL_DARK, w=4.2, h=0.9):
        if shape == "box":
            ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                                        boxstyle="round,pad=0.02,rounding_size=0.18",
                                        facecolor=fill, edgecolor=edge, linewidth=1.3))
        elif shape == "diamond":
            verts = [(x, y + h * 0.7), (x + w * 0.55, y),
                     (x, y - h * 0.7), (x - w * 0.55, y)]
            ax.add_patch(mpatches.Polygon(verts, facecolor=fill,
                                           edgecolor=edge, linewidth=1.3))
        elif shape == "start":
            ax.add_patch(Circle((x, y), 0.28, color=INK))
            return
        elif shape == "end":
            ax.add_patch(Circle((x, y), 0.32, facecolor=WHITE,
                                edgecolor=INK, linewidth=1.5))
            ax.add_patch(Circle((x, y), 0.16, color=INK))
            return
        ax.text(x, y, label, ha="center", va="center", fontsize=10,
                color=INK, fontweight="bold" if shape != "diamond" else "normal")

    def arrow(x1, y1, x2, y2, label=None, color=INK):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color=color, lw=1.3))
        if label:
            ax.text((x1 + x2) / 2 + 0.1, (y1 + y2) / 2, label,
                    fontsize=9, color=MUTED)

    # Start
    node(5, 12.5, "", shape="start")

    node(5, 11.4, "Wybór usługi", fill=PANEL_SOFT)
    arrow(5, 12.2, 5, 11.85)

    node(5, 10.2, "Wybór fryzjera", fill=PANEL_SOFT)
    arrow(5, 10.95, 5, 10.65)

    node(5, 9.0, "Otwarcie kalendarza miesięcznego", fill=SOFT_BG, w=5.2)
    arrow(5, 9.75, 5, 9.45)

    node(5, 7.6, "Czy dzień jest pełny / zamknięty?",
         shape="diamond", fill=SOFT_YELLOW, w=5.4, h=1.0)
    arrow(5, 8.55, 5, 8.25)

    node(1.9, 6.5, "Blokada\nwyboru", fill=SOFT_RED, edge=AMBER, w=2.6, h=0.9)
    arrow(2.8, 7.45, 2.8, 6.95, label="tak", color=AMBER)
    node(1.9, 5.4, "", shape="end")
    arrow(1.9, 6.05, 1.9, 5.7)

    node(5, 5.9, "Wybór 15-minutowego slotu", fill=PANEL_SOFT, w=5)
    arrow(5, 6.7, 5, 6.35, label="nie", color=TEAL)

    node(5, 4.5, "Walidacja terminu",
         shape="diamond", fill=SOFT_YELLOW, w=4.6, h=1.0)
    arrow(5, 5.45, 5, 4.95)

    node(8.0, 3.4, "Komunikat\nbłędu (PL)", fill=SOFT_RED, edge=AMBER, w=2.6)
    arrow(6.6, 4.0, 7.4, 3.6, label="błąd", color=AMBER)
    node(8.0, 2.2, "", shape="end")
    arrow(8.0, 2.95, 8.0, 2.55)

    node(5, 3.0, "Zapis w bazie i potwierdzenie",
         fill=SOFT_GREEN, edge=TEAL, w=5.2)
    arrow(5, 4.0, 5, 3.45, label="ok", color=TEAL)

    node(5, 1.6, "Wyświetlenie potwierdzenia", fill=PANEL_SOFT, w=5)
    arrow(5, 2.55, 5, 2.05)

    node(5, 0.5, "", shape="end")
    arrow(5, 1.15, 5, 0.8)

    ax.text(5, 13, "Aktywność: rezerwacja online klienta",
            ha="center", fontsize=13, fontweight="bold", color=TEAL)
    save(fig, "04-activity-booking.png")


# ---------------------------------------------------------------- sequence diagram

def sequence_diagram():
    fig, ax = plt.subplots(figsize=(11, 6.8))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 8)
    ax.axis("off")

    lanes = [
        ("Klient", 1.3, TEAL),
        ("Interfejs", 4.0, TEAL),
        ("System rezerwacji", 7.4, TEAL_DARK),
        ("Baza danych", 11.0, AMBER),
    ]

    # Lifelines
    for name, x, color in lanes:
        box = FancyBboxPatch((x - 1.3, 7.0), 2.6, 0.75,
                             boxstyle="round,pad=0.02,rounding_size=0.18",
                             facecolor=color, edgecolor=color)
        ax.add_patch(box)
        ax.text(x, 7.38, name, ha="center", va="center",
                fontsize=10.5, color=WHITE, fontweight="bold")
        ax.plot([x, x], [7.0, 0.5], color=MUTED, ls="dashed", lw=0.8)

    def msg(x1, y, x2, label, dashed=False, color=INK):
        ls = "dashed" if dashed else "solid"
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="->", color=color, lw=1.2, ls=ls))
        ax.text((x1 + x2) / 2, y + 0.18, label, fontsize=9.5,
                ha="center", color=INK)

    msg(1.3, 6.4, 4.0, "Otwarcie widoku rezerwacji", color=TEAL)
    msg(4.0, 5.7, 7.4, "Pobierz stan salonu", color=TEAL)
    msg(7.4, 5.0, 11.0, "Odczyt usług, fryzjerów, kalendarza", color=AMBER)
    msg(11.0, 4.3, 4.0, "Dane do prezentacji", dashed=True, color=MUTED)
    msg(1.3, 3.6, 4.0, "Wybór dnia i slotu", color=TEAL)
    msg(4.0, 2.9, 7.4, "Wyślij rezerwację", color=TEAL)

    # Self call on system
    ax.annotate("", xy=(7.4, 2.0), xytext=(8.2, 2.4),
                arrowprops=dict(arrowstyle="->", color=TEAL_DARK, lw=1.2))
    ax.plot([7.4, 8.2, 8.2], [2.4, 2.4, 2.0], color=TEAL_DARK, lw=1.0)
    ax.text(9.4, 2.2, "Walidacja (godziny, urlop,\nkolizja)",
            fontsize=9, color=TEAL_DARK)

    msg(7.4, 1.3, 11.0, "Zapis rezerwacji", color=AMBER)
    msg(11.0, 0.7, 1.3, "Potwierdzenie wizyty", dashed=True, color=MUTED)

    ax.text(6.5, 7.85, "Sekwencja: rezerwacja online (klient → baza)",
            ha="center", fontsize=12.5, fontweight="bold", color=TEAL)
    save(fig, "05-sequence-booking.png")


# ---------------------------------------------------------------- static model

def class_diagram():
    fig, ax = plt.subplots(figsize=(11.5, 7))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis("off")

    def entity(x, y, title, attrs, color=TEAL):
        w, h = 3.2, 0.8 + 0.4 * len(attrs)
        ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                                    boxstyle="round,pad=0.02,rounding_size=0.12",
                                    facecolor=PANEL_SOFT, edgecolor=color, linewidth=1.3))
        ax.add_patch(Rectangle((x - w / 2, y + h / 2 - 0.6), w, 0.6,
                               facecolor=color, edgecolor=color))
        ax.text(x, y + h / 2 - 0.3, title, ha="center", va="center",
                fontsize=10.5, color=WHITE, fontweight="bold")
        for i, attr in enumerate(attrs):
            ax.text(x, y + h / 2 - 0.95 - 0.36 * i, attr,
                    ha="center", va="center", fontsize=9, color=INK)

    def link(x1, y1, x2, y2, label=None):
        ax.plot([x1, x2], [y1, y2], color=MUTED, lw=1.1)
        if label:
            ax.text((x1 + x2) / 2 + 0.1, (y1 + y2) / 2 + 0.18, label,
                    fontsize=8.5, color=MUTED)

    entity(2.2, 7.0, "Użytkownik", ["rola", "imię", "e-mail", "hasło (hash)"], TEAL_DARK)
    entity(7.0, 7.0, "Klient", ["telefon", "notatki", "tagi"], TEAL)
    entity(11.5, 7.0, "Fryzjer", ["stanowisko", "specjalizacja", "dni pracy", "kolor"], AMBER)

    entity(2.2, 3.6, "Usługa", ["nazwa", "kategoria", "czas trwania", "cena"], TEAL)
    entity(7.0, 3.6, "Rezerwacja", ["start", "koniec", "status", "źródło"], TEAL_DARK)
    entity(11.5, 3.6, "Urlop", ["start", "koniec", "powód"], AMBER)

    entity(2.2, 0.9, "Salon", ["nazwa", "godziny", "krok kalendarza"], TEAL)
    entity(7.0, 0.9, "Powiadomienie", ["typ", "treść", "przeczytane"], TEAL_DARK)

    # Relations
    link(3.8, 7.0, 5.4, 7.0, "1..1")
    link(8.6, 7.0, 9.9, 7.0, "1..1")
    link(3.8, 3.6, 5.4, 3.6, "0..n")
    link(8.6, 3.6, 9.9, 3.6, "0..n")
    link(7.0, 6.0, 7.0, 4.6)
    link(11.5, 6.0, 11.5, 4.6)
    link(2.2, 6.0, 2.2, 4.6, label="rola=klient")
    link(2.2, 6.0, 6.8, 4.6, label="rola=fryzjer")

    ax.text(7, 8.5, "Model statyczny — encje systemu i ich relacje",
            ha="center", fontsize=13, color=TEAL, fontweight="bold")
    save(fig, "06-class-diagram.png")


# ---------------------------------------------------------------- module decomposition

def module_decomposition():
    fig, ax = plt.subplots(figsize=(11, 6))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis("off")

    modules = [
        ("01", "Moduł\nUżytkowników", "Konta, sesje, role.\nRejestracja, logowanie, profile.", TEAL_DARK, 2.4, 5.3),
        ("02", "Moduł\nRezerwacji", "Tworzenie i edycja wizyt.\nBlokada terminów, kontrola kolizji.", TEAL, 6.8, 5.3),
        ("03", "Moduł\nHarmonogramu", "Kalendarz dnia i miesiąca,\nurlopy, dostępność.", AMBER, 11.2, 5.3),
        ("04", "Moduł\nPowiadomień", "Rejestr zdarzeń systemowych\nz oznaczeniem przeczytania.", TEAL_DARK, 2.4, 1.8),
        ("05", "Moduł\nKonfiguracji", "Profil salonu, godziny pracy,\nkrok kalendarza.", TEAL, 6.8, 1.8),
        ("06", "Moduł\nZasobów", "Zespół, usługi, cennik,\ndni pracy fryzjerów.", AMBER, 11.2, 1.8),
    ]

    for badge, title, desc, color, cx, cy in modules:
        w, h = 3.6, 2.6
        ax.add_patch(FancyBboxPatch((cx - w / 2, cy - h / 2), w, h,
                                    boxstyle="round,pad=0.02,rounding_size=0.22",
                                    facecolor=PANEL_SOFT, edgecolor=color, linewidth=1.4))
        # Badge circle
        ax.add_patch(Circle((cx - w / 2 + 0.5, cy + h / 2 - 0.5), 0.34,
                            facecolor=color, edgecolor=color))
        ax.text(cx - w / 2 + 0.5, cy + h / 2 - 0.5, badge,
                ha="center", va="center", fontsize=10,
                color=WHITE, fontweight="bold")
        ax.text(cx, cy + 0.5, title, ha="center", va="center",
                fontsize=12, fontweight="bold", color=INK)
        ax.text(cx, cy - 0.55, desc, ha="center", va="center",
                fontsize=9.5, color=MUTED)

    ax.text(7, 7.4, "Dekompozycja modułowa systemu",
            ha="center", fontsize=14, color=TEAL, fontweight="bold")
    save(fig, "07-modules.png")


# ---------------------------------------------------------------- requirements map

def requirements_overview():
    fig, ax = plt.subplots(figsize=(11, 5.6))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 7)
    ax.axis("off")

    columns = [
        ("Wymagania funkcjonalne", TEAL,
         ["Rejestracja konta", "Wizualny kalendarz dostępności",
          "Rezerwacja z blokadą kolizji", "Anulowanie i edycja wizyty",
          "Zarządzanie zespołem i usługami",
          "Konta administracyjne, role"],
         2.3),
        ("Wymagania niefunkcjonalne", AMBER,
         ["Czas odpowiedzi do 2 s",
          "Spójność transakcyjna bazy",
          "Bezpieczne przechowywanie haseł",
          "Ograniczenie prób logowania",
          "Lokalizacja polska",
          "Uruchomienie w kontenerze"],
         7.0),
        ("Kontrola ryzyka", TEAL_DARK,
         ["Trzy warstwy walidacji terminu",
          "Wymuszenie ról deklaratywne",
          "Ochrona przed XSS w widokach",
          "Czyszczenie sesji wygaśniętych",
          "Idempotentne migracje",
          "Strefa czasowa salonu"],
         11.7),
    ]

    for title, color, items, cx in columns:
        w, h = 4.0, 6.0
        ax.add_patch(FancyBboxPatch((cx - w / 2, 0.4), w, h,
                                    boxstyle="round,pad=0.02,rounding_size=0.2",
                                    facecolor=PANEL_SOFT, edgecolor=color, linewidth=1.4))
        ax.add_patch(Rectangle((cx - w / 2, h - 0.6 + 0.4), w, 0.8,
                               facecolor=color, edgecolor=color))
        ax.text(cx, h + 0.2, title, ha="center", va="center",
                fontsize=12, color=WHITE, fontweight="bold")
        for i, item in enumerate(items):
            ax.text(cx, h - 0.5 - 0.6 * i, "•  " + item,
                    ha="center", va="center", fontsize=10, color=INK)

    save(fig, "08-requirements.png")


# ---------------------------------------------------------------- problem analysis

def problem_analysis():
    fig, ax = plt.subplots(figsize=(11, 5.2))
    fig.patch.set_facecolor(WHITE)
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 6.5)
    ax.axis("off")

    problems = [
        ("Telefon i kalendarze papierowe", "Brak źródła prawdy o terminach"),
        ("Podwójne rezerwacje", "Konflikty grafiku, niezadowolenie klienta"),
        ("Niewidoczne urlopy", "Klient umawia się na dzień wolny"),
        ("Ręczne zarządzanie zespołem", "Brak elastyczności i danych"),
    ]
    solutions = [
        ("Cyfrowy kalendarz online", "Jeden zapis wizyty, automatyczne potwierdzenia"),
        ("Wielowarstwowa blokada", "Walidacja na 3 poziomach z kolorami slotów"),
        ("Moduł urlopów z widokiem klienta", "Dni wolne ukryte, sloty zablokowane"),
        ("Panel administratora", "Pełna edycja zespołu, usług, kont, ustawień"),
    ]

    ax.text(3.5, 6.2, "PROBLEM", ha="center", fontsize=13,
            color=AMBER, fontweight="bold")
    ax.text(10.5, 6.2, "ROZWIĄZANIE", ha="center", fontsize=13,
            color=TEAL, fontweight="bold")

    for i, ((p_t, p_d), (s_t, s_d)) in enumerate(zip(problems, solutions)):
        y = 5.2 - i * 1.3
        # Problem card
        ax.add_patch(FancyBboxPatch((0.6, y - 0.55), 5.7, 1.1,
                                    boxstyle="round,pad=0.02,rounding_size=0.18",
                                    facecolor=PANEL_SOFT, edgecolor=AMBER, linewidth=1.2))
        ax.text(0.85, y + 0.25, p_t, fontsize=10.5, color=INK, fontweight="bold")
        ax.text(0.85, y - 0.18, p_d, fontsize=9, color=MUTED)
        # Arrow
        ax.annotate("", xy=(7.7, y), xytext=(6.5, y),
                    arrowprops=dict(arrowstyle="->", lw=2, color=TEAL))
        # Solution card
        ax.add_patch(FancyBboxPatch((7.7, y - 0.55), 5.7, 1.1,
                                    boxstyle="round,pad=0.02,rounding_size=0.18",
                                    facecolor=SOFT_GREEN, edgecolor=TEAL, linewidth=1.2))
        ax.text(7.95, y + 0.25, s_t, fontsize=10.5, color=INK, fontweight="bold")
        ax.text(7.95, y - 0.18, s_d, fontsize=9, color=MUTED)

    save(fig, "09-problem-solution.png")


# ---------------------------------------------------------------- run all

def main() -> int:
    diagram_actors()
    use_case_diagram()
    state_diagram()
    activity_diagram()
    sequence_diagram()
    class_diagram()
    module_decomposition()
    requirements_overview()
    problem_analysis()
    print("Diagrams saved to", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

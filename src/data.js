import { addMinutes, normalizeDateInput } from "./core.js";

// --- Pomocnicze: terminy wizyt liczone względem dnia uruchomienia seeda, ---
// --- aby demo zawsze pokazywało nadchodzące i niedawne wizyty.            ---
function pad2(value) {
  return String(value).padStart(2, "0");
}

function ymd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Najbliższe przyszłe wystąpienie dnia tygodnia (1 = pon … 6 = sob, 0 = nd).
function nextWeekday(targetDow, time) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let add = (targetDow - date.getDay() + 7) % 7;
  if (add === 0) add = 7;
  date.setDate(date.getDate() + add);
  return normalizeDateInput(ymd(date), time);
}

// Najbliższe minione wystąpienie dnia tygodnia.
function prevWeekday(targetDow, time) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let sub = (date.getDay() - targetDow + 7) % 7;
  if (sub === 0) sub = 7;
  date.setDate(date.getDate() - sub);
  return normalizeDateInput(ymd(date), time);
}

function daysAgo(days, time) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return normalizeDateInput(ymd(date), time);
}

const SERVICE_DURATION = {
  "service-cut": 45,
  "service-fade": 60,
  "service-beard": 30,
  "service-combo": 75,
};

function booking({ id, clientId, barberId, serviceId, startsAt, status, source, notes, createdAt }) {
  return {
    id,
    clientId,
    barberId,
    serviceId,
    startsAt,
    endsAt: addMinutes(startsAt, SERVICE_DURATION[serviceId]),
    status,
    source,
    notes,
    createdAt,
  };
}

export const initialData = {
  salon: {
    name: "HairBook Barber Studio",
    city: "Warszawa",
    address: "ul. Brzeska 18",
    phone: "+48 511 200 300",
    email: "kontakt@hairapp.com",
    plan: "Pro",
    rating: 4.8,
    reviewCount: 184,
    openHour: 9,
    closeHour: 19,
    slotStep: 30,
    onboarding: {
      services: true,
      staff: true,
      firstBooking: true,
      profile: true,
    },
  },
  users: [
    {
      id: "admin-1",
      role: "admin",
      name: "Jakub Sosnowski",
      email: "j.sosnowski@hairapp.com",
    },
    {
      id: "barber-1",
      role: "barber",
      name: "Bartosz Sochacki",
      email: "b.sochacki@hairapp.com",
    },
    {
      id: "barber-2",
      role: "barber",
      name: "Bartosz Walczyk",
      email: "b.walczyk@hairapp.com",
    },
    {
      id: "client-1",
      role: "client",
      name: "Norbert Szyszka",
      email: "n.szyszka@hairapp.com",
    },
  ],
  staff: [
    {
      id: "barber-1",
      userId: "barber-1",
      name: "Bartosz Sochacki",
      title: "Senior barber",
      specialty: "Skin fade i klasyczne cięcia",
      active: true,
      workDays: [1, 2, 3, 4, 5],
      color: "#0f766e",
    },
    {
      id: "barber-2",
      userId: "barber-2",
      name: "Bartosz Walczyk",
      title: "Barber",
      specialty: "Broda, kontur i koloryzacja",
      active: true,
      workDays: [1, 2, 3, 4, 5, 6],
      color: "#b45309",
    },
  ],
  services: [
    {
      id: "service-cut",
      name: "Strzyżenie męskie",
      category: "Włosy",
      duration: 45,
      price: 80,
      active: true,
      description: "Konsultacja, strzyżenie, mycie i stylizacja.",
    },
    {
      id: "service-fade",
      name: "Skin fade",
      category: "Włosy",
      duration: 60,
      price: 100,
      active: true,
      description: "Precyzyjne cieniowanie z wykończeniem brzytwą.",
    },
    {
      id: "service-beard",
      name: "Trymowanie brody",
      category: "Broda",
      duration: 30,
      price: 55,
      active: true,
      description: "Kontur, trymowanie i pielęgnacja gorącym ręcznikiem.",
    },
    {
      id: "service-combo",
      name: "Combo: włosy + broda",
      category: "Pakiet",
      duration: 75,
      price: 135,
      active: true,
      description: "Pełna wizyta barberska dla stałego klienta.",
    },
  ],
  clients: [
    {
      id: "client-1",
      userId: "client-1",
      name: "Norbert Szyszka",
      phone: "511 200 300",
      email: "n.szyszka@hairapp.com",
      notes: "Preferuje skin fade i matowe wykończenie.",
      tags: ["stały klient"],
      lastVisit: prevWeekday(2, "12:00"),
    },
    {
      id: "client-2",
      name: "Marek Kowalski",
      phone: "502 300 400",
      email: "marek.kowalski@example.com",
      notes: "Wrażliwa skóra po goleniu.",
      tags: ["broda"],
      lastVisit: prevWeekday(3, "16:00"),
    },
    {
      id: "client-3",
      name: "Filip Baran",
      phone: "503 200 100",
      email: "filip.baran@example.com",
      notes: "Przychodzi co 3 tygodnie.",
      tags: ["online"],
      lastVisit: daysAgo(20, "10:00"),
    },
    {
      id: "client-4",
      name: "Kamil Lis",
      phone: "504 440 550",
      email: "",
      notes: "Gość bez konta, zapisany osobiście w salonie.",
      tags: ["nowy"],
      lastVisit: "",
    },
  ],
  bookings: [
    booking({
      id: "booking-1001",
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-fade",
      startsAt: nextWeekday(2, "10:00"),
      status: "confirmed",
      source: "online",
      notes: "Klient prosi o ciche powiadomienie SMS.",
      createdAt: daysAgo(2, "11:20"),
    }),
    booking({
      id: "booking-1002",
      clientId: "client-2",
      barberId: "barber-2",
      serviceId: "service-combo",
      startsAt: nextWeekday(3, "12:00"),
      status: "confirmed",
      source: "frontdesk",
      notes: "",
      createdAt: daysAgo(1, "15:00"),
    }),
    booking({
      id: "booking-1003",
      clientId: "client-3",
      barberId: "barber-1",
      serviceId: "service-cut",
      startsAt: nextWeekday(4, "13:00"),
      status: "confirmed",
      source: "online",
      notes: "Bez mycia.",
      createdAt: daysAgo(1, "17:00"),
    }),
    booking({
      id: "booking-1004",
      clientId: "client-1",
      barberId: "barber-1",
      serviceId: "service-combo",
      startsAt: prevWeekday(2, "12:00"),
      status: "completed",
      source: "frontdesk",
      notes: "Udana wizyta, zaproponować kolejny termin.",
      createdAt: daysAgo(9, "09:10"),
    }),
    booking({
      id: "booking-1005",
      clientId: "client-2",
      barberId: "barber-2",
      serviceId: "service-beard",
      startsAt: prevWeekday(3, "16:00"),
      status: "completed",
      source: "online",
      notes: "",
      createdAt: daysAgo(12, "18:00"),
    }),
  ],
  notifications: [
    {
      id: "notice-1",
      type: "booking",
      title: "Nowa rezerwacja online",
      message: "Norbert Szyszka zarezerwował Skin fade u Bartosza Sochackiego.",
      createdAt: daysAgo(2, "11:20"),
      read: false,
    },
    {
      id: "notice-2",
      type: "system",
      title: "Brak płatności w MVP",
      message: "Moduł płatności jest celowo wyłączony w lokalnej wersji aplikacji.",
      createdAt: daysAgo(3, "09:00"),
      read: false,
    },
    {
      id: "notice-3",
      type: "risk",
      title: "Kontrola double-bookingu",
      message: "System blokuje nakładające się wizyty tego samego fryzjera.",
      createdAt: daysAgo(3, "09:10"),
      read: true,
    },
  ],
};

export function cloneInitialData() {
  return structuredClone(initialData);
}

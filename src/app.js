import {
  addMonths,
  bookingStatusCounts,
  bookingsForDate,
  buildCalendarSlots,
  calculateBookingValue,
  customerTimeline,
  dayAvailability,
  enrichBooking,
  formatDate,
  formatShortDate,
  formatTime,
  getRoleCapabilities,
  getUpcomingBookings,
  localIntervalOnDate,
  monthGrid,
  normalizeDateInput,
  searchClients,
  toDateInputValue,
  utilizationForDate,
} from "./core.js";

function todayDateString() {
  return toDateInputValue(new Date());
}

// Musi odpowiadać BOOKING_MAX_ADVANCE_DAYS po stronie serwera (domyślnie 120).
// To tylko podpowiedź UX — twardą blokadę i tak wymusza backend.
const CLIENT_MAX_ADVANCE_DAYS = 120;

function clientMaxBookingDate() {
  const limit = new Date();
  limit.setDate(limit.getDate() + CLIENT_MAX_ADVANCE_DAYS);
  return toDateInputValue(limit);
}

const app = document.querySelector("#app");

const labels = {
  dashboard: "Pulpit",
  marketplace: "Rezerwacja",
  myBookings: "Moje wizyty",
  profile: "Profil klienta",
  today: "Dzisiaj",
  calendar: "Kalendarz",
  bookings: "Rezerwacje",
  clients: "Klienci",
  staff: "Zespół",
  services: "Usługi",
  notifications: "Powiadomienia",
  timeOff: "Urlopy",
  users: "Użytkownicy",
  settings: "Ustawienia",
};

const roleLabels = {
  admin: "Administrator",
  barber: "Fryzjer",
  client: "Klient",
};

const statusLabels = {
  confirmed: "Potwierdzona",
  completed: "Zrealizowana",
  cancelled: "Anulowana",
};

const icons = {
  dashboard:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v3H7V2Zm8 0h2v3h-2V2ZM4 5h16a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 6v9h16v-9H4Z"/></svg>',
  bookings:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h10V6H7v2Zm0 5h10v-2H7v2Zm0 5h7v-2H7v2Z"/></svg>',
  clients:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm-9 9a9 9 0 0 1 18 0H3Z"/></svg>',
  staff:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm8 1a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM2 21a7 7 0 0 1 12 0H2Zm10.5 0a8.9 8.9 0 0 0-2.1-4.9A7 7 0 0 1 22 21h-9.5Z"/></svg>',
  services:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.7 13.3 2 2L4 22H2v-2l6.7-6.7ZM14.5 2a5.5 5.5 0 0 1 4.6 8.5l2.9 2.9-2.1 2.1-3-2.9A5.5 5.5 0 1 1 14.5 2Zm0 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>',
  notifications:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22a2.8 2.8 0 0 0 2.7-2h-5.4A2.8 2.8 0 0 0 12 22Zm8-6-2-2V9A6 6 0 0 0 6 9v5l-2 2v2h16v-2Z"/></svg>',
  settings:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 13.5.1-1.5-.1-1.5 2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 2h-4l-.4 3a8 8 0 0 0-2.6 1.5l-2.4-1-2 3.5 2 1.5L4.5 12l.1 1.5-2 1.5 2 3.5 2.4-1a8 8 0 0 0 2.6 1.5l.4 3h4l.4-3a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>',
  marketplace:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16l2 6v2h-2v8H4v-8H2v-2l2-6Zm2.2 2-1.1 4H8l.5-4H6.2Zm4.3 0-.5 4h4l-.5-4h-3Zm5 0 .5 4h2.9l-1.1-4h-2.3ZM6 12v6h12v-6H6Z"/></svg>',
  today:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14v18H5V3Zm3 4h8V5H8v2Zm0 5h8V9H8v3Zm0 5h5v-3H8v3Z"/></svg>',
  profile:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 9a7 7 0 0 1 14 0H5Z"/></svg>',
  users:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm8 1a4 4 0 1 0-4-4 4 4 0 0 0 4 4ZM2 21a7 7 0 0 1 12 0H2Zm10.5 0a8.9 8.9 0 0 0-2.1-4.9A7 7 0 0 1 22 21h-9.5Z"/></svg>',
  timeOff:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v3H5V4Zm-2 5h18v11H3V9Zm4 3v2h3v-2H7Zm5 0v2h3v-2h-3Zm5 0v2h3v-2h-3ZM7 16v2h3v-2H7Zm5 0v2h3v-2h-3Z"/></svg>',
};

const state = {
  loading: true,
  authMode: "login",
  user: null,
  data: null,
  activeView: "dashboard",
  selectedDate: todayDateString(),
  calendarMonth: todayDateString().slice(0, 7),
  modal: null,
  selectedBarber: "all",
  selectedClientId: "",
  clientSearch: "",
  toast: null,
  initialSelectionsApplied: false,
  bookingDraft: {
    clientId: "",
    barberId: "",
    serviceId: "",
    date: todayDateString(),
    time: "10:00",
    notes: "",
  },
};

function resetTransientState() {
  state.activeView = "dashboard";
  state.selectedDate = todayDateString();
  state.calendarMonth = todayDateString().slice(0, 7);
  state.selectedBarber = "all";
  state.selectedClientId = "";
  state.clientSearch = "";
  state.initialSelectionsApplied = false;
  state.modal = null;
  state.bookingDraft = {
    clientId: "",
    barberId: "",
    serviceId: "",
    date: todayDateString(),
    time: "10:00",
    notes: "",
  };
}

function currentRole() {
  return state.user?.role || "client";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Operacja nie powiodła się.");
  }

  return payload;
}

async function init() {
  try {
    const session = await api("/api/session");

    if (session.authenticated) {
      state.user = session.user;
      await loadState();
    } else {
      state.loading = false;
      render();
    }
  } catch (error) {
    state.loading = false;
    showToast(error.message, "error");
  }
}

async function loadState() {
  const payload = await api("/api/state");
  state.user = payload.user;
  state.data = payload.data;
  state.loading = false;
  syncSelections();
  render();
}

function syncSelections() {
  const role = currentRole();
  const capabilities = getRoleCapabilities(role);

  if (!capabilities.includes(state.activeView)) {
    state.activeView = capabilities[0];
  }

  if (role === "client") {
    state.selectedClientId = state.user.clientId;
  } else if (!state.selectedClientId || !state.data.clients.some((client) => client.id === state.selectedClientId)) {
    state.selectedClientId = state.data.clients[0]?.id || "";
  }

  if (role === "barber") {
    state.selectedBarber = state.user.staffId || state.data.staff[0]?.id || "all";
  } else if (
    state.selectedBarber !== "all" &&
    !state.data.staff.some((person) => person.id === state.selectedBarber)
  ) {
    state.selectedBarber = "all";
  }

  const defaultBarberId =
    role === "barber"
      ? state.user.staffId || state.data.staff[0]?.id || ""
      : state.data.staff[0]?.id || "";

  state.bookingDraft = {
    ...state.bookingDraft,
    clientId: state.bookingDraft.clientId || state.selectedClientId || state.data.clients[0]?.id || "",
    barberId: state.bookingDraft.barberId || defaultBarberId,
    serviceId: state.bookingDraft.serviceId || state.data.services[0]?.id || "",
  };

  if (role === "barber" && state.user.staffId) {
    state.bookingDraft.barberId = state.user.staffId;
  }

  if (!state.initialSelectionsApplied) {
    const today = toDateInputValue(new Date());
    if (today > state.selectedDate) {
      state.selectedDate = today;
      state.bookingDraft.date = today;
    }
    state.initialSelectionsApplied = true;
  }
}

function showToast(message, tone = "success") {
  const now = Date.now();
  if (
    showToast.last &&
    showToast.last.message === message &&
    now - showToast.last.at < 600
  ) {
    return;
  }
  showToast.last = { message, at: now };
  state.toast = { message, tone };
  render();
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    state.toast = null;
    render();
  }, 3400);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

function activeStaff() {
  return state.data.staff.filter((person) => person.active);
}

function enrichedBookings(bookings = state.data.bookings) {
  return bookings.map((booking) => enrichBooking(booking, state.data));
}

function captureFocus() {
  const active = document.activeElement;
  if (!active || active === document.body || !app.contains(active)) {
    return null;
  }
  const id =
    active.dataset.state ||
    active.dataset.draft ||
    active.getAttribute("name") ||
    null;
  if (!id) return null;
  const selector = active.dataset.state
    ? `[data-state="${active.dataset.state}"]`
    : active.dataset.draft
      ? `[data-draft="${active.dataset.draft}"]`
      : `[name="${active.getAttribute("name")}"]`;
  const value = "value" in active ? active.value : null;
  const start = active.selectionStart ?? null;
  const end = active.selectionEnd ?? null;
  return { selector, value, start, end };
}

function restoreFocus(snapshot) {
  if (!snapshot) return;
  const next = app.querySelector(snapshot.selector);
  if (!next) return;
  if (snapshot.value !== null && "value" in next && next.value !== snapshot.value) {
    next.value = snapshot.value;
  }
  next.focus();
  if (
    snapshot.start !== null &&
    snapshot.end !== null &&
    typeof next.setSelectionRange === "function"
  ) {
    try {
      next.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      /* niektóre typy inputów nie obsługują selectionRange */
    }
  }
}

function render() {
  if (state.loading) {
    app.innerHTML = `<div class="loading-screen">Ładowanie…</div>`;
    return;
  }

  if (!state.user || !state.data) {
    app.innerHTML = renderAuth();
    return;
  }

  const focusSnapshot = captureFocus();

  app.innerHTML = `
    <div class="app-shell">
      ${renderSidebar()}
      <div class="workspace">
        ${renderTopbar()}
        <main class="content" tabindex="-1">
          ${renderMain()}
        </main>
      </div>
      ${state.modal ? renderModal() : ""}
      ${state.toast ? `<div class="toast ${state.toast.tone}">${escapeHtml(state.toast.message)}</div>` : ""}
    </div>
  `;

  restoreFocus(focusSnapshot);
}

function renderModal() {
  const modal = state.modal;
  if (!modal) return "";
  let body = "";
  let title = "";

  switch (modal.type) {
    case "quickBooking":
      title = "Nowa wizyta";
      body = renderQuickBookingForm(modal.payload);
      break;
    case "clientDetail":
      title = "Karta klienta";
      body = renderClientDetailModal(modal.payload);
      break;
    case "editBooking":
      title = "Edytuj wizytę";
      body = renderEditBookingForm(modal.payload);
      break;
    case "newUser":
      title = "Nowe konto użytkownika";
      body = renderNewUserForm();
      break;
    case "editStaff":
      title = "Edycja stanowiska";
      body = renderEditStaffForm(modal.payload);
      break;
    case "editService":
      title = "Edycja usługi";
      body = renderEditServiceForm(modal.payload);
      break;
    case "editUser":
      title = "Edycja użytkownika";
      body = renderEditUserForm(modal.payload);
      break;
    case "editTimeOff":
      title = "Edycja urlopu";
      body = renderEditTimeOffForm(modal.payload);
      break;
    default:
      body = "";
  }

  return `
    <div class="modal-backdrop" data-action="modal-close">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header class="modal-header">
          <strong>${escapeHtml(title)}</strong>
          <button class="icon-button" data-action="modal-close" aria-label="Zamknij">×</button>
        </header>
        <div class="modal-body">${body}</div>
      </div>
    </div>
  `;
}

const BRAND_NAME = "PRAGA BARBERS";
const BRAND_TAGLINE = "Barber Studio · Warszawa";

let brandLogoSeq = 0;

// Emblemat marki — słup barberski (czerwono-niebieskie pasy, mosiężne nakładki).
function brandLogo(className = "brand-logo") {
  const id = `bp-${(brandLogoSeq += 1)}`;
  return `
    <svg class="${className}" viewBox="0 0 48 48" role="img" aria-label="Logo ${BRAND_NAME}">
      <defs>
        <clipPath id="${id}"><rect x="18" y="9" width="12" height="30" rx="6"/></clipPath>
      </defs>
      <rect x="15.5" y="3.5" width="17" height="6" rx="3" fill="#c89b4a"/>
      <rect x="15.5" y="38.5" width="17" height="6" rx="3" fill="#c89b4a"/>
      <rect x="18" y="9" width="12" height="30" rx="6" fill="#ffffff"/>
      <g clip-path="url(#${id})">
        <g transform="rotate(28 24 24)">
          <rect x="-8" y="-11" width="5" height="70" fill="#d62828"/>
          <rect x="2" y="-11" width="5" height="70" fill="#1d4ed8"/>
          <rect x="12" y="-11" width="5" height="70" fill="#d62828"/>
          <rect x="22" y="-11" width="5" height="70" fill="#1d4ed8"/>
          <rect x="32" y="-11" width="5" height="70" fill="#d62828"/>
          <rect x="42" y="-11" width="5" height="70" fill="#1d4ed8"/>
        </g>
      </g>
      <rect x="18" y="9" width="12" height="30" rx="6" fill="none" stroke="rgba(15,23,23,0.18)" stroke-width="1.5"/>
    </svg>
  `;
}

function renderAuth() {
  const isLogin = state.authMode === "login";

  return `
    <main class="auth-screen">
      <section class="auth-copy">
        <div class="brand brand-lg">
          <span class="brand-mark">${brandLogo()}</span>
          <div>
            <strong>${BRAND_NAME}</strong>
            <span>${BRAND_TAGLINE}</span>
          </div>
        </div>
        <p class="auth-tagline">Rezerwacje, grafik zespołu i kartoteka klientów w jednym miejscu.</p>
        <div class="demo-credentials">
          <strong>Konta demo · hasło 1234</strong>
          <span><em>Administrator</em><code>j.sosnowski@hairapp.com</code></span>
          <span><em>Fryzjer</em><code>b.sochacki@hairapp.com</code></span>
          <span><em>Fryzjer</em><code>b.walczyk@hairapp.com</code></span>
          <span><em>Klient</em><code>n.szyszka@hairapp.com</code></span>
        </div>
      </section>
      <section class="auth-panel">
        <h2 class="auth-title">${isLogin ? "Zaloguj się" : "Załóż konto klienta"}</h2>
        <div class="auth-tabs" role="group" aria-label="Tryb autoryzacji">
          <button class="${isLogin ? "active" : ""}" data-auth-mode="login">Logowanie</button>
          <button class="${!isLogin ? "active" : ""}" data-auth-mode="register">Rejestracja</button>
        </div>
        <form class="stack-form" data-form="${isLogin ? "login" : "register"}">
          ${!isLogin ? `<label><span>Imię i nazwisko</span><input name="name" autocomplete="name" required minlength="2"></label>` : ""}
          <label><span>E-mail</span><input name="email" type="email" autocomplete="email" required></label>
          ${!isLogin ? `<label><span>Telefon</span><input name="phone" autocomplete="tel" required></label>` : ""}
          <label><span>Hasło</span><input name="password" type="password" autocomplete="${isLogin ? "current-password" : "new-password"}" required ${isLogin ? "" : 'minlength="8"'}></label>
          <button class="primary-button wide" type="submit">${isLogin ? "Zaloguj" : "Utwórz konto klienta"}</button>
        </form>
      </section>
      ${state.toast ? `<div class="toast ${state.toast.tone}">${escapeHtml(state.toast.message)}</div>` : ""}
    </main>
  `;
}

function renderSidebar() {
  const capabilities = getRoleCapabilities(currentRole());

  return `
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">${brandLogo()}</span>
        <div>
          <strong>${BRAND_NAME}</strong>
          <span>${BRAND_TAGLINE}</span>
        </div>
      </div>
      <nav class="nav-list" aria-label="Główna nawigacja">
        ${capabilities.map(renderNavItem).join("")}
      </nav>
      <div class="sidebar-card">
        <span class="eyeline">Salon</span>
        <strong>${escapeHtml(state.data.salon.name)}</strong>
        <small>${escapeHtml(state.data.salon.address)}, ${escapeHtml(state.data.salon.city)}</small>
      </div>
    </aside>
  `;
}

function renderNavItem(view) {
  const unread =
    view === "notifications"
      ? state.data.notifications.filter((notice) => !notice.read).length
      : 0;
  return `
    <button class="nav-item ${state.activeView === view ? "active" : ""}" data-view="${view}">
      <span class="nav-icon">${icons[view] || icons.dashboard}</span>
      <span>${labels[view]}</span>
      ${unread ? `<span class="nav-badge" aria-label="Nieprzeczytane: ${unread}">${unread}</span>` : ""}
    </button>
  `;
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div>
        <p class="eyeline">Konto: ${roleLabels[currentRole()]}</p>
        <h1>${labels[state.activeView] || "Panel salonu"}</h1>
      </div>
      <div class="topbar-actions">
        <div class="user-chip">
          <span>${escapeHtml(state.user.name)}</span>
        </div>
        <button class="secondary-button" data-action="logout">Wyloguj</button>
      </div>
    </header>
  `;
}

function renderMain() {
  const clientInbox = currentRole() === "client" ? renderClientInbox() : "";

  switch (state.activeView) {
    case "dashboard":
      return renderDashboard();
    case "marketplace":
      return clientInbox + renderMarketplace();
    case "myBookings":
      return clientInbox + renderMyBookings();
    case "profile":
      return clientInbox + renderClientProfile();
    case "today":
      return renderToday();
    case "calendar":
      return renderCalendar();
    case "bookings":
      return renderBookings();
    case "clients":
      return renderClients();
    case "staff":
      return renderStaff();
    case "services":
      return renderServices();
    case "notifications":
      return renderNotifications();
    case "timeOff":
      return renderTimeOff();
    case "users":
      return renderUsers();
    case "settings":
      return renderSettings();
    default:
      return renderDashboard();
  }
}

function renderDashboard() {
  const todayBookings = bookingsForDate(state.data.bookings, state.selectedDate);
  const counts = bookingStatusCounts(state.data.bookings);
  const upcoming = getUpcomingBookings(state.data.bookings, 5, new Date(`${state.selectedDate}T00:00:00`));
  const value = calculateBookingValue(todayBookings, state.data.services);
  const utilization = utilizationForDate({
    bookings: state.data.bookings,
    staff: state.data.staff,
    date: state.selectedDate,
    openHour: state.data.salon.openHour,
    closeHour: state.data.salon.closeHour,
    timeOff: state.data.timeOff,
  });

  return `
    <section class="hero-panel">
      <div>
        <p class="eyeline">PostgreSQL + sesje użytkowników</p>
        <h2>Pełny rytm dnia salonu z prawdziwymi kontami.</h2>
        <p>Rezerwacje, klienci, zespół i ustawienia są zapisywane w bazie danych. Płatności nadal pozostają poza zakresem.</p>
      </div>
      <div class="hero-actions">
        <button class="primary-button" data-view="calendar">Otwórz kalendarz</button>
        <button class="secondary-button" data-view="bookings">Dodaj rezerwację</button>
      </div>
    </section>

    <section class="metric-grid">
      ${metricCard("Wizyty dnia", todayBookings.length, "Na wybraną datę")}
      ${metricCard("Obłożenie", `${utilization}%`, "Aktywne stanowiska")}
      ${metricCard("Przychód usług", money(value), "Bez modułu płatności")}
      ${metricCard("Potwierdzone", counts.confirmed, `${counts.completed} zrealizowane`)}
    </section>

    <section class="split-layout">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Najbliższe wizyty</p>
            <h3>Operacyjna kolejka salonu</h3>
          </div>
          <span class="muted">${formatDate(normalizeDateInput(state.selectedDate))}</span>
        </div>
        ${renderMonthCalendar({ target: "selectedDate", value: state.selectedDate, idSuffix: "dashboard" })}
        <div class="timeline-list">
          ${upcoming.map(renderBookingRow).join("") || emptyState("Brak zaplanowanych wizyt.")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Onboarding</p>
            <h3>Gotowość salonu</h3>
          </div>
          <span class="status-pill good">Plan ${escapeHtml(state.data.salon.plan)}</span>
        </div>
        <div class="check-list">
          ${Object.entries(state.data.salon.onboarding).map(renderCheckRow).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderCheckRow([key, done]) {
  const copy = {
    services: "Usługi i czasy trwania skonfigurowane",
    staff: "Fryzjerzy przypisani do grafiku",
    firstBooking: "Pierwsza rezerwacja w systemie",
    profile: "Profil salonu gotowy dla klientów",
  }[key];

  return `
    <div class="check-row">
      <span class="${done ? "check-dot done" : "check-dot"}"></span>
      <span>${copy}</span>
    </div>
  `;
}

function metricCard(label, value, hint) {
  return `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `;
}

const MONTH_NAMES = [
  "Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień",
];
const WEEK_LABELS = ["Pn","Wt","Śr","Cz","Pt","Sb","Nd"];

function formatMonthLabel(monthString) {
  const [year, month] = monthString.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function availabilityLevel(avail, { isPast, inMonth }) {
  if (!inMonth) return "outside";
  if (isPast) return "past";
  if (avail.isClosed) return "closed";
  if (avail.isFull) return "full";
  if (avail.utilization >= 70) return "high";
  if (avail.utilization >= 30) return "medium";
  return "free";
}

// Dostępność konkretnego fryzjera w danym dniu (na potrzeby wyszarzania pól).
// off  = nie pracuje / cały dzień urlopu, full = pracuje, ale brak wolnych slotów.
function barberDayInfo(barberId, date) {
  const person = state.data.staff.find((p) => p.id === barberId);
  if (!person || !person.active) {
    return { level: "off", free: 0, total: 0 };
  }

  const slots = buildCalendarSlots({
    date,
    barberId,
    bookings: state.data.bookings,
    openHour: state.data.salon.openHour,
    closeHour: state.data.salon.closeHour,
    stepMinutes: state.data.salon.slotStep,
    workDays: person.workDays,
    timeOff: state.data.timeOff,
  });

  if (!slots.length) {
    return { level: "off", free: 0, total: 0 };
  }

  const free = slots.filter((slot) => slot.available).length;
  if (free === 0) {
    const allTimeOff = slots.every((slot) => slot.timeOffId);
    return { level: allTimeOff ? "off" : "full", free: 0, total: slots.length };
  }

  const usedRatio = 1 - free / slots.length;
  const level = usedRatio >= 0.7 ? "high" : usedRatio >= 0.3 ? "medium" : "free";
  return { level, free, total: slots.length };
}

function renderMonthCalendar({
  target,
  value,
  blockFullForClient = false,
  idSuffix = "",
  barberId = null,
}) {
  const month = state.calendarMonth || (value || todayDateString()).slice(0, 7);
  const today = todayDateString();
  const cells = monthGrid(month);
  const isClient = currentRole() === "client";
  const perBarber = Boolean(barberId);

  const dayCells = cells
    .map(({ date, inMonth }) => {
      const avail = dayAvailability({
        date,
        bookings: state.data.bookings,
        staff: state.data.staff,
        salon: state.data.salon,
        timeOff: state.data.timeOff,
      });
      const isPast = date < today;
      const isToday = date === today;
      const isSelected = date === value;
      const beyondHorizon = isClient && blockFullForClient && date > clientMaxBookingDate();

      // W trybie per-fryzjer poziom wynika z grafiku tego fryzjera (off/full/free…),
      // poza miesiącem i w przeszłości używamy ogólnej skali.
      const perInfo = perBarber && inMonth && !isPast ? barberDayInfo(barberId, date) : null;
      const level = perInfo
        ? perInfo.level
        : availabilityLevel(avail, { isPast, inMonth });

      const unavailable = level === "off" || level === "full" || level === "closed";
      const blockedForClient =
        blockFullForClient &&
        isClient &&
        (unavailable || isPast || beyondHorizon);
      const disabled =
        !inMonth || blockedForClient || (blockFullForClient && isPast) || beyondHorizon;

      const meta = (() => {
        if (beyondHorizon) return "—";
        if (perInfo) {
          if (perInfo.level === "off") return "—";
          if (perInfo.level === "full") return "brak";
          return `${perInfo.free} wol.`;
        }
        return avail.isClosed ? "—" : `${avail.utilization}%`;
      })();

      const titleParts = [formatDate(`${date}T00:00:00`)];
      if (beyondHorizon) {
        titleParts.push("poza horyzontem rezerwacji");
      } else if (perInfo) {
        titleParts.push(
          perInfo.level === "off"
            ? "fryzjer nie pracuje"
            : perInfo.level === "full"
              ? "brak wolnych terminów"
              : `${perInfo.free} wolnych slotów`,
        );
      } else {
        titleParts.push(avail.isClosed ? "salon zamknięty" : `obłożenie ${avail.utilization}%`);
      }

      return `
        <button
          type="button"
          class="cal-day level-${level} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}"
          data-cal-day="${date}"
          data-cal-target="${target}"
          ${disabled ? "disabled aria-disabled=\"true\"" : ""}
          title="${escapeHtml(titleParts.join(" · "))}"
        >
          <span class="cal-day-num">${Number(date.slice(8, 10))}</span>
          <span class="cal-day-meta">${meta}</span>
        </button>
      `;
    })
    .join("");

  const legend = perBarber
    ? `
        <span><i class="cal-chip level-free"></i> wolne</span>
        <span><i class="cal-chip level-medium"></i> umiarkowane</span>
        <span><i class="cal-chip level-high"></i> wysokie</span>
        <span><i class="cal-chip level-full"></i> brak miejsc</span>
        <span><i class="cal-chip level-off"></i> nie pracuje</span>
      `
    : `
        <span><i class="cal-chip level-free"></i> wolne</span>
        <span><i class="cal-chip level-medium"></i> umiarkowane</span>
        <span><i class="cal-chip level-high"></i> wysokie</span>
        <span><i class="cal-chip level-full"></i> pełne</span>
        <span><i class="cal-chip level-closed"></i> zamknięte</span>
      `;

  return `
    <div class="month-calendar" data-cal-widget="${idSuffix}">
      <header class="cal-header">
        <button type="button" class="cal-nav" data-cal-nav="prev" aria-label="Poprzedni miesiąc">‹</button>
        <strong>${formatMonthLabel(month)}</strong>
        <button type="button" class="cal-nav" data-cal-nav="next" aria-label="Następny miesiąc">›</button>
      </header>
      <div class="cal-weekdays">
        ${WEEK_LABELS.map((label) => `<span>${label}</span>`).join("")}
      </div>
      <div class="cal-grid">${dayCells}</div>
      <div class="cal-legend">${legend}</div>
    </div>
  `;
}

function renderMarketplace() {
  return `
    <section class="client-hero">
      <div>
        <p class="eyeline">Salon partnerski HairBook</p>
        <h2>${escapeHtml(state.data.salon.name)}</h2>
        <p>${escapeHtml(state.data.salon.address)}, ${escapeHtml(state.data.salon.city)} · ocena ${state.data.salon.rating}/5 (${state.data.salon.reviewCount} opinii)</p>
      </div>
      <div class="rating-tile">
        <strong>${state.data.salon.rating}</strong>
        <span>Zweryfikowane wizyty</span>
      </div>
    </section>
    <section class="split-layout">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Klient</p>
            <h3>Umów wizytę online</h3>
          </div>
          <span class="status-pill">Bez płatności online</span>
        </div>
        ${renderBookingForm({ clientLocked: currentRole() === "client" })}
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Oferta</p>
            <h3>Usługi barberskie</h3>
          </div>
        </div>
        <div class="service-list compact">
          ${state.data.services.filter((service) => service.active).map(renderServiceCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderToday() {
  const barberId = state.user.staffId || state.selectedBarber;
  const todayBookings = bookingsForDate(state.data.bookings, state.selectedDate, barberId);

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyeline">Widok fryzjera</p>
          <h3>Plan dnia: ${formatDate(normalizeDateInput(state.selectedDate))}</h3>
        </div>
        <span class="muted">${formatDate(normalizeDateInput(state.selectedDate))}</span>
      </div>
      ${renderMonthCalendar({ target: "selectedDate", value: state.selectedDate, idSuffix: "today", barberId: state.user.staffId || null })}
      <div class="timeline-list">
        ${todayBookings.map(renderBookingRow).join("") || emptyState("Na ten dzień nie ma wizyt dla Twojego konta.")}
      </div>
    </section>
    <section class="metric-grid">
      ${metricCard("Wizyty", todayBookings.length, "Twoje stanowisko")}
      ${metricCard("Zrealizowane", todayBookings.filter((booking) => booking.status === "completed").length, "Historia dnia")}
      ${metricCard("Do obsługi", todayBookings.filter((booking) => booking.status === "confirmed").length, "Potwierdzone")}
      ${metricCard("Klienci", new Set(todayBookings.map((booking) => booking.clientId)).size, "Unikalne osoby")}
    </section>
  `;
}

function renderCalendar() {
  const staff = state.selectedBarber === "all"
    ? activeStaff()
    : activeStaff().filter((person) => person.id === state.selectedBarber);

  return `
    <section class="panel calendar-panel">
      <div class="panel-header calendar-controls">
        <div>
          <p class="eyeline">Harmonogram</p>
          <h3>${formatDate(normalizeDateInput(state.selectedDate))}</h3>
        </div>
        <div class="filters">
          ${renderBarberFilter()}
          <button class="primary-button" data-action="open-new-booking">+ Nowa wizyta</button>
        </div>
      </div>
      ${renderMonthCalendar({ target: "selectedDate", value: state.selectedDate, idSuffix: "calendar", barberId: state.selectedBarber !== "all" ? state.selectedBarber : null })}
      <div class="calendar-grid" style="--columns:${staff.length || 1}">
        ${staff.map(renderBarberCalendar).join("") || emptyState("Brak aktywnych fryzjerów.")}
      </div>
    </section>
  `;
}

function renderBarberFilter() {
  if (currentRole() === "barber") {
    return "";
  }

  return `
    <select data-state="selectedBarber" aria-label="Fryzjer w kalendarzu">
      <option value="all" ${state.selectedBarber === "all" ? "selected" : ""}>Wszyscy fryzjerzy</option>
      ${activeStaff()
        .map((person) => `<option value="${person.id}" ${state.selectedBarber === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`)
        .join("")}
    </select>
  `;
}

function renderBarberCalendar(person) {
  const slots = buildCalendarSlots({
    date: state.selectedDate,
    barberId: person.id,
    bookings: state.data.bookings,
    openHour: state.data.salon.openHour,
    closeHour: state.data.salon.closeHour,
    stepMinutes: state.data.salon.slotStep,
    workDays: person.workDays,
    timeOff: state.data.timeOff,
  });

  const noFreeSlots = slots.length > 0 && slots.every((slot) => !slot.available);
  const columnState = !slots.length ? "off" : noFreeSlots ? "full" : "open";

  return `
    <article class="barber-column state-${columnState}">
      <header style="--barber:${safeColor(person.color)}">
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(person.title)}</span>
        ${columnState === "off" ? `<span class="column-flag">nie pracuje</span>` : ""}
        ${columnState === "full" ? `<span class="column-flag">brak miejsc</span>` : ""}
      </header>
      <div class="slot-list">
        ${slots.length
          ? slots.map((slot) => renderSlot(slot, person)).join("")
          : emptyState("Fryzjer nie pracuje w wybranym dniu.")}
      </div>
    </article>
  `;
}

function renderSlot(slot, person) {
  const booking = slot.bookingId
    ? enrichBooking(state.data.bookings.find((item) => item.id === slot.bookingId), state.data)
    : null;
  const onTimeOff = slot.timeOffId && !booking;

  let label = "<strong>Wolny termin</strong><small>Kliknij, aby zarezerwować</small>";
  let cls = slot.available ? "available" : "busy";
  if (booking) {
    label = `<strong>${escapeHtml(booking.client?.name || "Klient")}</strong><small>${escapeHtml(booking.service?.name || "Usługa")}</small>`;
  } else if (onTimeOff) {
    label = "<strong>Urlop</strong><small>fryzjer nieobecny</small>";
    cls = "busy time-off";
  }

  return `
    <button class="slot ${cls}" data-action="fill-slot" data-barber="${person.id}" data-time="${slot.time}" ${slot.available ? "" : "disabled"}>
      <span>${slot.time}</span>
      ${label}
    </button>
  `;
}

function renderBookings() {
  return `
    <section class="split-layout wide-left">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Rezerwacje</p>
            <h3>Lista wizyt i statusów</h3>
          </div>
          <div class="filters">
            ${renderBarberFilter()}
          </div>
        </div>
        ${renderMonthCalendar({ target: "selectedDate", value: state.selectedDate, idSuffix: "bookings" })}
        <div class="table-list">
          ${bookingsForDate(state.data.bookings, state.selectedDate, state.selectedBarber)
            .map((booking) => renderBookingTableRow(booking, { actions: true }))
            .join("") || emptyState("Brak wizyt dla wybranych filtrów.")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Recepcja</p>
            <h3>Nowa rezerwacja</h3>
          </div>
        </div>
        ${renderBookingForm({ clientLocked: false })}
      </div>
    </section>
  `;
}

function renderBookingForm({ clientLocked }) {
  const draft = state.bookingDraft;
  const clientId = clientLocked ? state.selectedClientId : draft.clientId;

  return `
    <form class="stack-form" data-form="booking">
      <label>
        <span>Klient</span>
        ${
          clientLocked
            ? `<input value="${escapeHtml(state.data.clients.find((client) => client.id === state.selectedClientId)?.name || "")}" disabled>`
            : `<select name="clientId" data-draft="clientId">
                ${state.data.clients.map((client) => `<option value="${client.id}" ${clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`).join("")}
              </select>`
        }
      </label>
      <label>
        <span>Usługa</span>
        <select name="serviceId" data-draft="serviceId">
          ${state.data.services
            .filter((service) => service.active)
            .map((service) => `<option value="${service.id}" ${draft.serviceId === service.id ? "selected" : ""}>${escapeHtml(service.name)} · ${service.duration} min · ${money(service.price)}</option>`)
            .join("")}
        </select>
      </label>
      <label>
        <span>Fryzjer</span>
        <select name="barberId" data-draft="barberId" ${currentRole() === "barber" ? "disabled" : ""}>
          ${activeStaff()
            .map((person) => `<option value="${person.id}" ${draft.barberId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`)
            .join("")}
        </select>
      </label>
      <div class="booking-date-picker">
        <span class="eyeline">Wybierz dzień</span>
        ${renderMonthCalendar({
          target: "bookingDate",
          value: draft.date,
          blockFullForClient: true,
          idSuffix: "booking",
          barberId: draft.barberId,
        })}
        <input type="hidden" name="date" value="${draft.date}">
      </div>
      <div class="booking-time-picker">
        <span class="eyeline">Wybierz godzinę (sloty co ${state.data.salon.slotStep} min)</span>
        ${renderTimeSlotPicker(draft)}
        <input type="hidden" name="time" value="${draft.time}">
      </div>
      <label>
        <span>Notatka</span>
        <textarea name="notes" data-draft="notes" rows="3" placeholder="Preferencje klienta, uwagi dla fryzjera">${escapeHtml(draft.notes)}</textarea>
      </label>
      <button class="primary-button wide" type="submit">Zarezerwuj termin</button>
    </form>
  `;
}

function renderTimeSlotPicker(draft) {
  const salon = state.data.salon;
  const service =
    state.data.services.find((item) => item.id === draft.serviceId && item.active) ||
    state.data.services.find((item) => item.active);
  if (!service) {
    return emptyState("Brak aktywnych usług.");
  }
  const duration = service.duration;
  const barber = state.data.staff.find((person) => person.id === draft.barberId);
  if (!barber) {
    return emptyState("Wybierz fryzjera, aby zobaczyć terminy.");
  }

  const date = draft.date;
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();
  if (Array.isArray(barber.workDays) && barber.workDays.length && !barber.workDays.includes(dayOfWeek)) {
    return emptyState("Fryzjer nie pracuje w wybranym dniu.");
  }

  const closingMinutes = salon.closeHour * 60;
  const step = [15, 30, 45, 60].includes(salon.slotStep) ? salon.slotStep : 30;
  const slots = [];
  const now = Date.now();
  const sameDayAsToday = date === todayDateString();

  const bookingsForBarber = state.data.bookings.filter(
    (booking) => booking.barberId === barber.id && booking.status !== "cancelled",
  );
  const offForBarber = (state.data.timeOff || []).filter((entry) => entry.staffId === barber.id);

  for (let minutes = salon.openHour * 60; minutes < closingMinutes; minutes += step) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    const time = `${hh}:${mm}`;
    const candidateStartMin = minutes;
    const candidateEndMin = minutes + duration;
    const startsAt = new Date(`${date}T${time}:00`);
    const outOfHours = candidateEndMin > closingMinutes;
    const inPast = sameDayAsToday && startsAt.getTime() < now;
    const overlaps = (item) => {
      const iv = localIntervalOnDate(item, date);
      return Boolean(iv) && iv.startMin < candidateEndMin && candidateStartMin < iv.endMin;
    };
    const conflict = bookingsForBarber.some(overlaps);
    const onTimeOff = offForBarber.some(overlaps);
    const blocked = outOfHours || conflict || inPast || onTimeOff;
    const level = outOfHours
      ? "outside"
      : inPast
        ? "past"
        : onTimeOff
          ? "closed"
          : conflict
            ? "busy"
            : "free";

    slots.push({ time, blocked, level });
  }

  if (!slots.length) {
    return emptyState("Brak slotów dla wybranego dnia.");
  }

  return `
    <div class="time-slot-grid">
      ${slots
        .map(
          (slot) => `
            <button
              type="button"
              class="time-slot level-${slot.level} ${draft.time === slot.time ? "selected" : ""}"
              data-time-slot="${slot.time}"
              ${slot.blocked ? "disabled aria-disabled=\"true\"" : ""}
            >${slot.time}</button>
          `,
        )
        .join("")}
    </div>
    <div class="cal-legend">
      <span><i class="cal-chip level-free"></i> wolny</span>
      <span><i class="cal-chip level-full"></i> zajęty</span>
      <span><i class="cal-chip level-closed"></i> poza godzinami</span>
    </div>
  `;
}

function renderQuickBookingForm() {
  return renderBookingForm({ clientLocked: currentRole() === "client" });
}

function renderClientDetailModal({ clientId }) {
  const client = state.data.clients.find((item) => item.id === clientId);
  if (!client) {
    return emptyState("Nie znaleziono klienta.");
  }
  const timeline = customerTimeline(state.data.bookings, client.id);
  const canEdit = ["admin", "barber"].includes(currentRole());
  const isAdmin = currentRole() === "admin";
  const otherClients = state.data.clients.filter((item) => item.id !== client.id);

  return `
    <div class="modal-grid">
      ${
        canEdit
          ? `<form class="stack-form" data-form="client-edit" data-client="${client.id}">
              <label><span>Imię i nazwisko</span><input name="name" value="${escapeHtml(client.name)}" required minlength="2"></label>
              <label><span>Telefon</span><input name="phone" value="${escapeHtml(client.phone || "")}" required minlength="3"></label>
              <label><span>E-mail</span><input name="email" type="email" value="${escapeHtml(client.email || "")}"></label>
              <label><span>Notatki</span><textarea name="notes" rows="4">${escapeHtml(client.notes || "")}</textarea></label>
              <button class="primary-button wide" type="submit">Zapisz zmiany</button>
            </form>`
          : `<div>
              <h4>${escapeHtml(client.name)}</h4>
              <p>${escapeHtml(client.phone || "")} · ${escapeHtml(client.email || "")}</p>
              <p>${escapeHtml(client.notes || "")}</p>
            </div>`
      }
      <div>
        <p class="eyeline">Historia wizyt</p>
        <div class="timeline-list">
          ${timeline.map(renderBookingRow).join("") || emptyState("Brak historii wizyt.")}
        </div>
      </div>
    </div>
    ${
      isAdmin && otherClients.length
        ? `<div class="merge-panel">
            <p class="eyeline">Scalanie duplikatu</p>
            <p class="muted">Wybierz drugą kartę tego samego klienta. Jej wizyty i notatki trafią tutaj, a duplikat zostanie usunięty.</p>
            <form class="merge-form" data-form="client-merge" data-target="${client.id}">
              <select name="sourceId" required>
                <option value="">— wybierz kartę do scalenia —</option>
                ${otherClients
                  .map(
                    (item) =>
                      `<option value="${item.id}">${escapeHtml(item.name)}${item.phone ? " · " + escapeHtml(item.phone) : ""}</option>`,
                  )
                  .join("")}
              </select>
              <button class="secondary-button danger-button" type="submit">Scal i usuń duplikat</button>
            </form>
          </div>`
        : ""
    }
  `;
}

function renderEditBookingForm({ bookingId }) {
  const booking = state.data.bookings.find((item) => item.id === bookingId);
  if (!booking) {
    return emptyState("Nie znaleziono wizyty.");
  }
  const startDate = booking.startsAt.slice(0, 10);
  const startTime = (() => {
    const d = new Date(booking.startsAt);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  })();

  return `
    <form class="stack-form" data-form="booking-edit" data-booking="${booking.id}">
      <label>
        <span>Klient</span>
        <select name="clientId">
          ${state.data.clients
            .map(
              (client) =>
                `<option value="${client.id}" ${booking.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>
        <span>Fryzjer</span>
        <select name="barberId">
          ${activeStaff()
            .map(
              (person) =>
                `<option value="${person.id}" ${booking.barberId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>
        <span>Usługa</span>
        <select name="serviceId">
          ${state.data.services
            .filter((service) => service.active)
            .map(
              (service) =>
                `<option value="${service.id}" ${booking.serviceId === service.id ? "selected" : ""}>${escapeHtml(service.name)} · ${service.duration} min</option>`,
            )
            .join("")}
        </select>
      </label>
      <div class="form-grid">
        <label><span>Data</span><input type="date" name="date" value="${startDate}" required></label>
        <label><span>Godzina</span><input type="time" name="time" value="${startTime}" step="900" required></label>
      </div>
      <label>
        <span>Status</span>
        <select name="status">
          ${["confirmed", "completed", "cancelled"]
            .map(
              (s) =>
                `<option value="${s}" ${booking.status === s ? "selected" : ""}>${statusLabels[s]}</option>`,
            )
            .join("")}
        </select>
      </label>
      <label>
        <span>Notatka</span>
        <textarea name="notes" rows="3">${escapeHtml(booking.notes || "")}</textarea>
      </label>
      <button class="primary-button wide" type="submit">Zapisz wizytę</button>
    </form>
  `;
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: "Pn" },
  { value: 2, label: "Wt" },
  { value: 3, label: "Śr" },
  { value: 4, label: "Cz" },
  { value: 5, label: "Pt" },
  { value: 6, label: "Sb" },
  { value: 0, label: "Nd" },
];

function renderEditStaffForm({ staffId }) {
  const person = state.data.staff.find((item) => item.id === staffId);
  if (!person) return emptyState("Nie znaleziono fryzjera.");
  const workDays = person.workDays || [];

  return `
    <form class="stack-form" data-form="staff-edit" data-staff="${person.id}">
      <label><span>Imię i nazwisko</span><input name="name" value="${escapeHtml(person.name)}" required minlength="2"></label>
      <label><span>Stanowisko</span><input name="title" value="${escapeHtml(person.title)}" required minlength="2"></label>
      <label><span>Specjalizacja</span><input name="specialty" value="${escapeHtml(person.specialty)}" required></label>
      <label><span>Kolor (HEX)</span><input name="color" value="${escapeHtml(safeColor(person.color))}" pattern="^#[0-9a-fA-F]{6}$" required></label>
      <fieldset class="weekday-fieldset">
        <legend>Dni pracy</legend>
        ${WEEKDAY_OPTIONS.map(
          (day) => `
            <label class="checkbox-inline">
              <input type="checkbox" name="workDays" value="${day.value}" ${workDays.includes(day.value) ? "checked" : ""}>
              <span>${day.label}</span>
            </label>
          `,
        ).join("")}
      </fieldset>
      <label class="checkbox-inline">
        <input type="checkbox" name="active" value="true" ${person.active ? "checked" : ""}>
        <span>Pracownik aktywny</span>
      </label>
      <button class="primary-button wide" type="submit">Zapisz fryzjera</button>
    </form>
  `;
}

function renderEditServiceForm({ serviceId }) {
  const service = state.data.services.find((item) => item.id === serviceId);
  if (!service) return emptyState("Nie znaleziono usługi.");

  return `
    <form class="stack-form" data-form="service-edit" data-service="${service.id}">
      <label><span>Nazwa</span><input name="name" value="${escapeHtml(service.name)}" required minlength="2"></label>
      <label><span>Kategoria</span><input name="category" value="${escapeHtml(service.category)}" required></label>
      <div class="form-grid">
        <label><span>Czas (min)</span><input name="duration" type="number" min="5" step="5" value="${service.duration}" required></label>
        <label><span>Cena</span><input name="price" type="number" min="0" step="5" value="${service.price}" required></label>
      </div>
      <label><span>Opis</span><textarea name="description" rows="3">${escapeHtml(service.description || "")}</textarea></label>
      <label class="checkbox-inline">
        <input type="checkbox" name="active" value="true" ${service.active ? "checked" : ""}>
        <span>Usługa dostępna w cenniku</span>
      </label>
      <button class="primary-button wide" type="submit">Zapisz usługę</button>
    </form>
  `;
}

function renderEditUserForm({ userId }) {
  const user = state.data.users.find((item) => item.id === userId);
  if (!user) return emptyState("Nie znaleziono użytkownika.");

  return `
    <form class="stack-form" data-form="user-edit" data-user="${user.id}">
      <label><span>Imię i nazwisko</span><input name="name" value="${escapeHtml(user.name)}" required minlength="2"></label>
      <label><span>E-mail</span><input name="email" type="email" value="${escapeHtml(user.email)}" required></label>
      <label>
        <span>Rola</span>
        <select name="role">
          ${["client", "barber", "admin"]
            .map((r) => `<option value="${r}" ${user.role === r ? "selected" : ""}>${escapeHtml(roleLabels[r])}</option>`)
            .join("")}
        </select>
      </label>
      <label><span>Nowe hasło (opcjonalnie, min. 8 znaków)</span><input name="password" type="password" minlength="8" autocomplete="new-password"></label>
      <button class="primary-button wide" type="submit">Zapisz konto</button>
    </form>
  `;
}

function splitIsoForInputs(iso) {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { date, time };
}

function renderEditTimeOffForm({ timeOffId }) {
  const entry = (state.data.timeOff || []).find((item) => item.id === timeOffId);
  if (!entry) return emptyState("Nie znaleziono urlopu.");
  const isAdmin = currentRole() === "admin";
  const start = splitIsoForInputs(entry.startsAt);
  const end = splitIsoForInputs(entry.endsAt);

  return `
    <form class="stack-form" data-form="time-off-edit" data-timeoff="${entry.id}">
      ${
        isAdmin
          ? `<label>
              <span>Fryzjer</span>
              <select name="staffId">
                ${state.data.staff
                  .map(
                    (person) =>
                      `<option value="${person.id}" ${entry.staffId === person.id ? "selected" : ""}>${escapeHtml(person.name)}</option>`,
                  )
                  .join("")}
              </select>
            </label>`
          : ""
      }
      <div class="form-grid">
        <label><span>Początek (data)</span><input type="date" name="startDate" value="${start.date}" required></label>
        <label><span>Początek (godz.)</span><input type="time" name="startTime" value="${start.time}" step="900" required></label>
      </div>
      <div class="form-grid">
        <label><span>Koniec (data)</span><input type="date" name="endDate" value="${end.date}" required></label>
        <label><span>Koniec (godz.)</span><input type="time" name="endTime" value="${end.time}" step="900" required></label>
      </div>
      <label><span>Powód</span><input name="reason" maxlength="200" value="${escapeHtml(entry.reason || "")}"></label>
      <button class="primary-button wide" type="submit">Zapisz urlop</button>
    </form>
  `;
}

function renderNewUserForm() {
  return `
    <form class="stack-form" data-form="new-user">
      <label>
        <span>Rola</span>
        <select name="role" required>
          <option value="client">Klient</option>
          <option value="barber">Fryzjer</option>
          <option value="admin">Administrator</option>
        </select>
      </label>
      <label><span>Imię i nazwisko</span><input name="name" required minlength="2"></label>
      <label><span>E-mail</span><input name="email" type="email" required></label>
      <label><span>Telefon (klient)</span><input name="phone"></label>
      <label><span>Specjalizacja (fryzjer)</span><input name="specialty"></label>
      <label><span>Tytuł (fryzjer)</span><input name="title" value="Barber"></label>
      <label><span>Hasło (min. 8 znaków)</span><input name="password" type="password" minlength="8" required></label>
      <button class="primary-button wide" type="submit">Utwórz konto</button>
    </form>
  `;
}

function safeColor(value, fallback = "#0f766e") {
  return /^#[0-9a-fA-F]{6}$/.test(String(value || "")) ? value : fallback;
}

function renderBookingRow(rawBooking) {
  const booking = enrichBooking(rawBooking, state.data);

  return `
    <article class="booking-row">
      <div class="time-block">
        <strong>${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}</strong>
        <span>${formatShortDate(booking.startsAt)}</span>
      </div>
      <div>
        <strong>${escapeHtml(booking.client?.name || "Klient")}</strong>
        <span>${escapeHtml(booking.service?.name || "Usługa")} · ${escapeHtml(booking.barber?.name || "Fryzjer")}</span>
      </div>
      <span class="status-pill ${booking.status}">${statusLabels[booking.status]}</span>
    </article>
  `;
}

function renderBookingTableRow(rawBooking, { actions = false } = {}) {
  const booking = enrichBooking(rawBooking, state.data);

  return `
    <article class="booking-table-row">
      <div>
        <strong>${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}</strong>
        <span>${escapeHtml(booking.client?.name || "Klient")}</span>
      </div>
      <div>
        <span>${escapeHtml(booking.service?.name || "Usługa")}</span>
        <small>${escapeHtml(booking.barber?.name || "Fryzjer")}</small>
      </div>
      <span class="status-pill ${booking.status}">${statusLabels[booking.status]}</span>
      ${
        actions
          ? `<div class="row-actions">
              <button class="icon-button" title="Oznacz jako zrealizowaną" data-action="booking-status" data-booking="${booking.id}" data-status="completed">✓</button>
              ${currentRole() === "admin" ? `<button class="icon-button" title="Edytuj wizytę" data-action="open-edit-booking" data-booking="${booking.id}">✎</button>` : ""}
              <button class="icon-button danger" title="Anuluj wizytę" data-action="booking-status" data-booking="${booking.id}" data-status="cancelled">×</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderClientInbox() {
  const notices = (state.data.notifications || [])
    .filter((notice) => notice.userId === state.user.id)
    .toSorted((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unread = notices.filter((notice) => !notice.read);

  if (!unread.length) {
    return "";
  }

  return `
    <section class="panel inbox-panel">
      <div class="panel-header">
        <div>
          <p class="eyeline">Powiadomienia</p>
          <h3>Masz ${unread.length} ${unread.length === 1 ? "nową wiadomość" : "nowe wiadomości"}</h3>
        </div>
      </div>
      <div class="notice-list">
        ${unread
          .map(
            (notice) => `
              <article class="notice unread">
                <div>
                  <span class="eyeline">${formatDate(notice.createdAt)}</span>
                  <strong>${escapeHtml(notice.title)}</strong>
                  <p>${escapeHtml(notice.message)}</p>
                </div>
                <button class="ghost-button" data-action="mark-read" data-notice="${notice.id}">OK, rozumiem</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderMyBookings() {
  const bookings = enrichedBookings(
    state.data.bookings.filter((booking) => booking.clientId === state.selectedClientId),
  ).toSorted((a, b) => new Date(b.startsAt) - new Date(a.startsAt));

  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyeline">Klient</p>
          <h3>Twoje wizyty</h3>
        </div>
        <button class="secondary-button" data-view="marketplace">Nowa rezerwacja</button>
      </div>
      <div class="table-list">
        ${bookings.map((booking) => renderClientBookingRow(booking)).join("") || emptyState("Nie masz jeszcze wizyt.")}
      </div>
    </section>
  `;
}

function renderClientBookingRow(booking) {
  const upcoming =
    booking.status === "confirmed" && new Date(booking.startsAt) > new Date();
  return `
    <article class="booking-table-row">
      <div>
        <strong>${formatTime(booking.startsAt)} - ${formatTime(booking.endsAt)}</strong>
        <span>${formatShortDate(booking.startsAt)}</span>
      </div>
      <div>
        <span>${escapeHtml(booking.service?.name || "Usługa")}</span>
        <small>${escapeHtml(booking.barber?.name || "Fryzjer")}</small>
      </div>
      <span class="status-pill ${booking.status}">${statusLabels[booking.status]}</span>
      ${
        upcoming
          ? `<div class="row-actions">
              <button class="icon-button danger" title="Anuluj wizytę" data-action="booking-status" data-booking="${booking.id}" data-status="cancelled">×</button>
            </div>`
          : ""
      }
    </article>
  `;
}

function renderClientProfile() {
  const client = state.data.clients.find((item) => item.id === state.selectedClientId);
  const timeline = customerTimeline(state.data.bookings, state.selectedClientId);

  return `
    <section class="split-layout">
      <div class="panel profile-panel">
        <div class="avatar">${escapeHtml((state.user.name || "KL").slice(0, 2).toUpperCase())}</div>
        <h3>${escapeHtml(state.user.name || "Klient")}</h3>
        <p>${escapeHtml(client?.phone || "")} · ${escapeHtml(state.user.email || "")}</p>
        <div class="tag-row">
          ${(client?.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <form class="stack-form" data-form="profile">
          <label><span>Imię i nazwisko</span><input name="name" value="${escapeHtml(state.user.name || "")}" required minlength="2"></label>
          <label><span>E-mail</span><input name="email" type="email" value="${escapeHtml(state.user.email || "")}" required></label>
          <label><span>Telefon</span><input name="phone" value="${escapeHtml(client?.phone || "")}"></label>
          <label><span>Nowe hasło (opcjonalnie, min. 8 znaków)</span><input name="password" type="password" minlength="8" autocomplete="new-password"></label>
          <button class="primary-button wide" type="submit">Zapisz profil</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Historia</p>
            <h3>Twoje wizyty</h3>
          </div>
        </div>
        <div class="timeline-list">
          ${timeline.map(renderBookingRow).join("") || emptyState("Brak historii wizyt.")}
        </div>
      </div>
    </section>
  `;
}

function renderClients() {
  const clients = searchClients(state.data.clients, state.clientSearch);
  const selected = state.data.clients.find((c) => c.id === state.selectedClientId);
  const timeline = selected ? customerTimeline(state.data.bookings, selected.id) : [];

  return `
    <section class="split-layout wide-left">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">CRM salonu</p>
            <h3>Klienci i preferencje</h3>
          </div>
          <input type="search" value="${escapeHtml(state.clientSearch)}" data-state="clientSearch" placeholder="Szukaj po nazwie, telefonie, notatce">
        </div>
        <div class="client-grid">
          ${clients.map(renderClientCard).join("") || emptyState("Nie znaleziono klientów.")}
        </div>
        ${
          selected
            ? `<div class="client-detail">
                <div class="panel-header">
                  <div>
                    <p class="eyeline">Karta klienta</p>
                    <h3>${escapeHtml(selected.name)}</h3>
                  </div>
                  <span class="status-pill">${escapeHtml(selected.phone || "")}</span>
                </div>
                <p class="note">${escapeHtml(selected.notes || "Brak notatek.")}</p>
                <div class="timeline-list">
                  ${timeline.map(renderBookingRow).join("") || emptyState("Brak historii wizyt.")}
                </div>
              </div>`
            : ""
        }
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Nowy klient</p>
            <h3>Dodaj kartę klienta</h3>
          </div>
        </div>
        <form class="stack-form" data-form="client">
          <label><span>Imię i nazwisko</span><input name="name" required minlength="2"></label>
          <label><span>Telefon</span><input name="phone" required minlength="3"></label>
          <label><span>E-mail</span><input name="email" type="email"></label>
          <label><span>Notatki</span><textarea name="notes" rows="4"></textarea></label>
          <button class="primary-button wide" type="submit">Dodaj klienta</button>
        </form>
      </div>
    </section>
  `;
}

function renderClientCard(client) {
  const visits = state.data.bookings.filter((booking) => booking.clientId === client.id);

  return `
    <article class="client-card ${state.selectedClientId === client.id ? "active" : ""}">
      <div>
        <strong>${escapeHtml(client.name)}</strong>
        <span>${escapeHtml(client.phone)}</span>
      </div>
      <p>${escapeHtml(client.notes)}</p>
      <div class="card-footer">
        <span>${visits.length} wizyt</span>
        <button class="ghost-button" data-action="open-client" data-client="${client.id}">Otwórz</button>
      </div>
    </article>
  `;
}

function renderStaff() {
  return `
    <section class="split-layout wide-left">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Zasoby osobowe</p>
            <h3>Fryzjerzy i stanowiska</h3>
          </div>
        </div>
        <div class="staff-grid">
          ${state.data.staff.map(renderStaffCard).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Zespół</p>
            <h3>Dodaj fryzjera</h3>
          </div>
        </div>
        <form class="stack-form" data-form="staff">
          <label><span>Imię i nazwisko</span><input name="name" required></label>
          <label><span>Stanowisko</span><input name="title" value="Barber" required></label>
          <label><span>Specjalizacja</span><input name="specialty" required></label>
          <button class="primary-button wide" type="submit">Dodaj do zespołu</button>
        </form>
      </div>
    </section>
  `;
}

function renderStaffCard(person) {
  const bookings = state.data.bookings.filter((booking) => booking.barberId === person.id);

  return `
    <article class="staff-card" style="--barber:${safeColor(person.color)}">
      <div class="staff-avatar">${escapeHtml(person.name.slice(0, 2).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(person.name)}</strong>
        <span>${escapeHtml(person.title)}${person.active ? "" : " · nieaktywny"}</span>
      </div>
      <p>${escapeHtml(person.specialty)}</p>
      <div class="card-footer">
        <small>${bookings.length} wizyt w systemie</small>
        ${currentRole() === "admin" ? `<button class="icon-button" title="Edytuj fryzjera" data-action="open-edit-staff" data-staff="${person.id}">✎</button>` : ""}
      </div>
    </article>
  `;
}

function renderServices() {
  return `
    <section class="split-layout wide-left">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Katalog usług</p>
            <h3>Cennik i czas trwania</h3>
          </div>
        </div>
        <div class="service-list">
          ${state.data.services.map(renderServiceCard).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Usługa</p>
            <h3>Dodaj pozycję</h3>
          </div>
        </div>
        <form class="stack-form" data-form="service">
          <label><span>Nazwa</span><input name="name" required></label>
          <label><span>Kategoria</span><input name="category" value="Włosy" required></label>
          <div class="form-grid">
            <label><span>Czas (min)</span><input name="duration" type="number" min="15" step="5" value="45" required></label>
            <label><span>Cena</span><input name="price" type="number" min="0" step="5" value="80" required></label>
          </div>
          <label><span>Opis</span><textarea name="description" rows="3"></textarea></label>
          <button class="primary-button wide" type="submit">Dodaj usługę</button>
        </form>
      </div>
    </section>
  `;
}

function renderServiceCard(service) {
  return `
    <article class="service-card">
      <div>
        <span class="eyeline">${escapeHtml(service.category)}${service.active ? "" : " · niedostępna"}</span>
        <strong>${escapeHtml(service.name)}</strong>
        <p>${escapeHtml(service.description)}</p>
      </div>
      <div class="service-meta">
        <strong>${service.duration} min</strong>
        <span>${money(service.price)}</span>
        ${currentRole() === "admin" ? `<button class="icon-button" title="Edytuj usługę" data-action="open-edit-service" data-service="${service.id}">✎</button>` : ""}
      </div>
    </article>
  `;
}

function renderNotifications() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyeline">Zdarzenia systemowe</p>
          <h3>Powiadomienia i alerty</h3>
        </div>
      </div>
      <div class="notice-list">
        ${state.data.notifications
          .toSorted((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(renderNotice)
          .join("")}
      </div>
    </section>
  `;
}

function renderNotice(notice) {
  return `
    <article class="notice ${notice.read ? "" : "unread"}">
      <div>
        <span class="eyeline">${formatDate(notice.createdAt)}</span>
        <strong>${escapeHtml(notice.title)}</strong>
        <p>${escapeHtml(notice.message)}</p>
      </div>
      <button class="ghost-button" data-action="toggle-notification" data-notice="${notice.id}" data-read="${notice.read ? "false" : "true"}">
        ${notice.read ? "Oznacz jako nieprzeczytane" : "Oznacz jako przeczytane"}
      </button>
    </article>
  `;
}

function renderTimeOff() {
  const isAdmin = currentRole() === "admin";
  const entries = (state.data.timeOff || [])
    .filter((entry) => isAdmin || entry.staffId === state.user.staffId)
    .toSorted((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const fmt = (iso) => `${formatDate(iso)} ${formatTime(iso)}`;

  return `
    <section class="split-layout wide-left">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Urlopy i nieobecności</p>
            <h3>${isAdmin ? "Wszystkie urlopy zespołu" : "Twoje urlopy"}</h3>
          </div>
        </div>
        <div class="table-list">
          ${
            entries.length
              ? entries
                  .map((entry) => {
                    const person = state.data.staff.find((p) => p.id === entry.staffId);
                    const canEdit =
                      isAdmin || entry.staffId === state.user.staffId;
                    return `
                      <article class="booking-table-row">
                        <div>
                          <strong>${escapeHtml(person?.name || "Fryzjer")}</strong>
                          <span>${escapeHtml(entry.reason || "Urlop")}</span>
                        </div>
                        <div>
                          <span>${fmt(entry.startsAt)}</span>
                          <small>— ${fmt(entry.endsAt)}</small>
                        </div>
                        ${
                          canEdit
                            ? `<div class="row-actions">
                                <button class="icon-button" title="Edytuj" data-action="open-edit-timeoff" data-timeoff="${entry.id}">✎</button>
                                <button class="icon-button danger" title="Usuń" data-action="delete-timeoff" data-timeoff="${entry.id}">×</button>
                              </div>`
                            : ""
                        }
                      </article>
                    `;
                  })
                  .join("")
              : emptyState("Brak zapisanych urlopów.")
          }
        </div>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Nowy urlop</p>
            <h3>Dodaj nieobecność</h3>
          </div>
        </div>
        <form class="stack-form" data-form="time-off">
          ${
            isAdmin
              ? `<label>
                  <span>Fryzjer</span>
                  <select name="staffId" required>
                    ${state.data.staff
                      .map(
                        (person) =>
                          `<option value="${person.id}">${escapeHtml(person.name)}</option>`,
                      )
                      .join("")}
                  </select>
                </label>`
              : ""
          }
          <div class="form-grid">
            <label><span>Początek (data)</span><input type="date" name="startDate" value="${todayDateString()}" required></label>
            <label><span>Początek (godz.)</span><input type="time" name="startTime" value="09:00" step="900" required></label>
          </div>
          <div class="form-grid">
            <label><span>Koniec (data)</span><input type="date" name="endDate" value="${todayDateString()}" required></label>
            <label><span>Koniec (godz.)</span><input type="time" name="endTime" value="17:00" step="900" required></label>
          </div>
          <label><span>Powód (opcjonalnie)</span><input name="reason" maxlength="200"></label>
          <button class="primary-button wide" type="submit">Dodaj urlop</button>
        </form>
      </div>
    </section>
  `;
}

function renderUsers() {
  return `
    <section class="panel">
      <div class="panel-header">
        <div>
          <p class="eyeline">Konta i dostęp</p>
          <h3>Zarządzanie użytkownikami</h3>
        </div>
        <button class="primary-button" data-action="open-new-user">Dodaj użytkownika</button>
      </div>
      <div class="user-list">
        ${state.data.users
          .map(
            (user) => `
              <article class="user-row">
                <div>
                  <strong>${escapeHtml(user.name)}</strong>
                  <span>${escapeHtml(user.email)}</span>
                </div>
                <span class="status-pill">${escapeHtml(roleLabels[user.role] || user.role)}</span>
                <button class="icon-button" title="Edytuj konto" data-action="open-edit-user" data-user="${user.id}">✎</button>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  return `
    <section class="split-layout">
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Konfiguracja salonu</p>
            <h3>Godziny pracy i profil</h3>
          </div>
        </div>
        <form class="stack-form" data-form="settings">
          <label><span>Nazwa salonu</span><input name="name" value="${escapeHtml(state.data.salon.name)}" required></label>
          <label><span>Adres</span><input name="address" value="${escapeHtml(state.data.salon.address)}" required></label>
          <div class="form-grid">
            <label><span>Otwarcie</span><input name="openHour" type="number" min="0" max="23" value="${state.data.salon.openHour}" required></label>
            <label><span>Zamknięcie</span><input name="closeHour" type="number" min="1" max="24" value="${state.data.salon.closeHour}" required></label>
          </div>
          <label><span>Krok kalendarza</span><input name="slotStep" type="number" min="15" max="60" step="15" value="${state.data.salon.slotStep}" required></label>
          <button class="primary-button wide" type="submit">Zapisz ustawienia</button>
        </form>
      </div>
      <div class="panel">
        <div class="panel-header">
          <div>
            <p class="eyeline">Zakres MVP</p>
            <h3>Założenia z dokumentów</h3>
          </div>
        </div>
        <div class="scope-list">
          <p><strong>Role:</strong> Klient, Fryzjer, Administrator.</p>
          <p><strong>Baza:</strong> PostgreSQL przechowuje konta, sesje, CRM, usługi, personel i rezerwacje.</p>
          <p><strong>Ograniczenie:</strong> płatności, prowizje i fakturowanie nie są częścią lokalnej aplikacji.</p>
          <p><strong>Ryzyko techniczne:</strong> nakładające się rezerwacje są blokowane także constraintem w bazie.</p>
        </div>
      </div>
    </section>
  `;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

async function submitAuth(form) {
  const formData = new FormData(form);
  const endpoint = form.dataset.form === "login" ? "/api/auth/login" : "/api/auth/register";
  const payload = Object.fromEntries(formData.entries());
  const result = await api(endpoint, { method: "POST", body: payload });
  state.user = result.user;
  state.activeView = getRoleCapabilities(result.user.role)[0];
  await loadState();
  if (form.dataset.form === "login") {
    showToast("Zalogowano.");
  } else if (result.user?.linkedExistingCard) {
    showToast("Konto utworzone i połączone z Twoją dotychczasową kartą w salonie.");
  } else {
    showToast("Konto klienta zostało utworzone.");
  }
}

async function submitBooking(form) {
  const data = new FormData(form);
  const date = data.get("date");
  const time = data.get("time");

  if (!date || !time) {
    showToast("Wybierz datę i godzinę wizyty.", "error");
    return;
  }

  await api("/api/bookings", {
    method: "POST",
    body: {
      clientId: currentRole() === "client" ? state.selectedClientId : data.get("clientId"),
      barberId: currentRole() === "barber" ? state.user.staffId : data.get("barberId"),
      serviceId: data.get("serviceId"),
      date,
      time,
      notes: data.get("notes"),
    },
  });
  state.bookingDraft = { ...state.bookingDraft, notes: "" };
  state.modal = null;
  await loadState();
  showToast("Rezerwacja została dodana i termin jest zablokowany.");
}

async function submitClient(form) {
  const result = await api("/api/clients", {
    method: "POST",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  form.reset();
  await loadState();
  if (result?.warning) {
    showToast(result.warning, "error");
  } else {
    showToast("Dodano klienta do CRM.");
  }
}

async function submitClientEdit(form) {
  const clientId = form.dataset.client;
  await api(`/api/clients/${clientId}`, {
    method: "PATCH",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  state.modal = null;
  await loadState();
  showToast("Karta klienta zaktualizowana.");
}

async function submitClientMerge(form) {
  const targetId = form.dataset.target;
  const sourceId = new FormData(form).get("sourceId");
  if (!sourceId) {
    showToast("Wybierz kartę do scalenia.", "error");
    return;
  }
  const sourceName =
    state.data.clients.find((item) => item.id === sourceId)?.name || "wybraną kartę";
  if (
    !window.confirm(
      `Scalić „${sourceName}" z tą kartą? Wizyty i notatki zostaną przeniesione, a duplikat usunięty. Operacja jest nieodwracalna.`,
    )
  ) {
    return;
  }
  await api(`/api/clients/${targetId}/merge`, {
    method: "POST",
    body: { sourceId },
  });
  state.modal = null;
  await loadState();
  showToast("Karty klienta zostały scalone.");
}

async function submitBookingEdit(form) {
  const bookingId = form.dataset.booking;
  const data = new FormData(form);
  const date = data.get("date");
  const time = data.get("time");
  await api(`/api/bookings/${bookingId}`, {
    method: "PATCH",
    body: {
      clientId: data.get("clientId"),
      barberId: data.get("barberId"),
      serviceId: data.get("serviceId"),
      status: data.get("status"),
      notes: data.get("notes"),
      date,
      time,
    },
  });
  state.modal = null;
  await loadState();
  showToast("Wizyta zaktualizowana.");
}

function timeOffToast(prefix, result) {
  const cancelled = result?.cancelledCount || 0;
  if (cancelled > 0) {
    showToast(
      `${prefix} Automatycznie odwołano ${cancelled} ${cancelled === 1 ? "kolidującą wizytę" : "kolidujące wizyty"}; klienci zostali powiadomieni.`,
    );
  } else {
    showToast(prefix);
  }
}

async function submitTimeOff(form) {
  const data = Object.fromEntries(new FormData(form).entries());
  const result = await api("/api/time-off", { method: "POST", body: data });
  form.reset();
  await loadState();
  timeOffToast("Urlop dodany.", result);
}

async function submitTimeOffEdit(form) {
  const timeOffId = form.dataset.timeoff;
  const data = Object.fromEntries(new FormData(form).entries());
  const result = await api(`/api/time-off/${timeOffId}`, { method: "PATCH", body: data });
  state.modal = null;
  await loadState();
  timeOffToast("Urlop zaktualizowany.", result);
}

async function submitStaffEdit(form) {
  const staffId = form.dataset.staff;
  const data = new FormData(form);
  const workDays = data.getAll("workDays").map(Number);
  await api(`/api/staff/${staffId}`, {
    method: "PATCH",
    body: {
      name: data.get("name"),
      title: data.get("title"),
      specialty: data.get("specialty"),
      color: data.get("color"),
      workDays,
      active: data.get("active") === "true",
    },
  });
  state.modal = null;
  await loadState();
  showToast("Fryzjer zaktualizowany.");
}

async function submitServiceEdit(form) {
  const serviceId = form.dataset.service;
  const data = new FormData(form);
  await api(`/api/services/${serviceId}`, {
    method: "PATCH",
    body: {
      name: data.get("name"),
      category: data.get("category"),
      duration: Number(data.get("duration")),
      price: Number(data.get("price")),
      description: data.get("description"),
      active: data.get("active") === "true",
    },
  });
  state.modal = null;
  await loadState();
  showToast("Usługa zaktualizowana.");
}

async function submitUserEdit(form) {
  const userId = form.dataset.user;
  const payload = Object.fromEntries(new FormData(form).entries());
  if (!payload.password) delete payload.password;
  await api(`/api/users/${userId}`, { method: "PATCH", body: payload });
  state.modal = null;
  await loadState();
  showToast("Konto zaktualizowane.");
}

async function submitNewUser(form) {
  await api("/api/users", {
    method: "POST",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  form.reset();
  state.modal = null;
  await loadState();
  showToast("Konto użytkownika utworzone.");
}

async function submitProfile(form) {
  const payload = Object.fromEntries(new FormData(form).entries());
  if (!payload.password) {
    delete payload.password;
  }
  const result = await api("/api/profile", { method: "PATCH", body: payload });
  state.user = result.user;
  await loadState();
  showToast("Profil zaktualizowany.");
}

async function submitService(form) {
  await api("/api/services", {
    method: "POST",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  form.reset();
  await loadState();
  showToast("Dodano usługę do cennika.");
}

async function submitStaff(form) {
  await api("/api/staff", {
    method: "POST",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  form.reset();
  await loadState();
  showToast("Dodano fryzjera do zespołu.");
}

async function submitSettings(form) {
  await api("/api/settings", {
    method: "PATCH",
    body: Object.fromEntries(new FormData(form).entries()),
  });
  await loadState();
  showToast("Ustawienia salonu zapisane w bazie.");
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.data = null;
  state.authMode = "login";
  resetTransientState();
  render();
}

app.addEventListener("click", async (event) => {
  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    state.authMode = authModeButton.dataset.authMode;
    render();
    return;
  }

  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.activeView = viewButton.dataset.view;
    render();
    return;
  }

  const calNav = event.target.closest("[data-cal-nav]");
  if (calNav) {
    state.calendarMonth = addMonths(
      state.calendarMonth || todayDateString().slice(0, 7),
      calNav.dataset.calNav === "prev" ? -1 : 1,
    );
    render();
    return;
  }

  const timeSlot = event.target.closest("[data-time-slot]");
  if (timeSlot && !timeSlot.disabled) {
    state.bookingDraft = { ...state.bookingDraft, time: timeSlot.dataset.timeSlot };
    render();
    return;
  }

  const calDay = event.target.closest("[data-cal-day]");
  if (calDay && !calDay.disabled) {
    const date = calDay.dataset.calDay;
    const target = calDay.dataset.calTarget;
    if (target === "bookingDate") {
      state.bookingDraft = { ...state.bookingDraft, date };
    } else if (target === "selectedDate") {
      state.selectedDate = date;
      state.bookingDraft = { ...state.bookingDraft, date };
    }
    state.calendarMonth = date.slice(0, 7);
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  try {
    const { action } = actionButton.dataset;

    if (action === "logout") {
      await logout();
    }

    if (action === "fill-slot") {
      state.bookingDraft = {
        ...state.bookingDraft,
        barberId: actionButton.dataset.barber,
        date: state.selectedDate,
        time: actionButton.dataset.time,
      };
      state.modal = { type: "quickBooking", payload: {} };
      render();
    }

    if (action === "modal-close") {
      const clickedBackdrop =
        actionButton.classList.contains("modal-backdrop") && event.target === actionButton;
      const clickedX = !actionButton.classList.contains("modal-backdrop");
      if (clickedBackdrop || clickedX) {
        state.modal = null;
        render();
      }
    }

    if (action === "open-client") {
      state.selectedClientId = actionButton.dataset.client;
      state.modal = { type: "clientDetail", payload: { clientId: actionButton.dataset.client } };
      render();
    }

    if (action === "open-edit-booking") {
      state.modal = {
        type: "editBooking",
        payload: { bookingId: actionButton.dataset.booking },
      };
      render();
    }

    if (action === "open-new-booking") {
      state.modal = { type: "quickBooking", payload: {} };
      render();
    }

    if (action === "open-new-user") {
      state.modal = { type: "newUser", payload: {} };
      render();
    }

    if (action === "open-edit-staff") {
      state.modal = { type: "editStaff", payload: { staffId: actionButton.dataset.staff } };
      render();
    }

    if (action === "open-edit-service") {
      state.modal = { type: "editService", payload: { serviceId: actionButton.dataset.service } };
      render();
    }

    if (action === "open-edit-user") {
      state.modal = { type: "editUser", payload: { userId: actionButton.dataset.user } };
      render();
    }

    if (action === "open-edit-timeoff") {
      state.modal = { type: "editTimeOff", payload: { timeOffId: actionButton.dataset.timeoff } };
      render();
    }

    if (action === "delete-timeoff") {
      await api(`/api/time-off/${actionButton.dataset.timeoff}`, { method: "DELETE" });
      await loadState();
      showToast("Urlop usunięty.");
    }

    if (action === "toggle-notification") {
      await api(`/api/notifications/${actionButton.dataset.notice}`, {
        method: "PATCH",
        body: { read: actionButton.dataset.read === "true" },
      });
      await loadState();
    }

    if (action === "booking-status") {
      await api(`/api/bookings/${actionButton.dataset.booking}/status`, {
        method: "PATCH",
        body: { status: actionButton.dataset.status },
      });
      await loadState();
      showToast("Status wizyty został zmieniony.");
    }

    if (action === "select-client") {
      state.selectedClientId = actionButton.dataset.client;
      if (currentRole() === "client") {
        state.activeView = "profile";
        render();
      } else {
        state.modal = {
          type: "clientDetail",
          payload: { clientId: actionButton.dataset.client },
        };
        render();
      }
    }

    if (action === "mark-read") {
      await api(`/api/notifications/${actionButton.dataset.notice}/read`, {
        method: "PATCH",
      });
      await loadState();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;

  if (target.matches("[data-state]")) {
    state[target.dataset.state] = target.value;
    render();
  }

  if (target.matches("[data-draft]")) {
    state.bookingDraft = {
      ...state.bookingDraft,
      [target.dataset.draft]: target.value,
    };
  }
});

app.addEventListener("change", (event) => {
  const target = event.target;

  if (target.matches("[data-state]")) {
    state[target.dataset.state] = target.value;
    render();
  }

  if (target.matches("[data-draft]")) {
    state.bookingDraft = {
      ...state.bookingDraft,
      [target.dataset.draft]: target.value,
    };
    render();
  }
});

app.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target.closest("[data-form]");

  if (!form) {
    return;
  }

  try {
    const formType = form.dataset.form;

    if (formType === "login" || formType === "register") await submitAuth(form);
    if (formType === "booking") await submitBooking(form);
    if (formType === "client") await submitClient(form);
    if (formType === "client-edit") await submitClientEdit(form);
    if (formType === "client-merge") await submitClientMerge(form);
    if (formType === "booking-edit") await submitBookingEdit(form);
    if (formType === "service") await submitService(form);
    if (formType === "staff") await submitStaff(form);
    if (formType === "settings") await submitSettings(form);
    if (formType === "new-user") await submitNewUser(form);
    if (formType === "staff-edit") await submitStaffEdit(form);
    if (formType === "service-edit") await submitServiceEdit(form);
    if (formType === "user-edit") await submitUserEdit(form);
    if (formType === "time-off") await submitTimeOff(form);
    if (formType === "time-off-edit") await submitTimeOffEdit(form);
    if (formType === "profile") await submitProfile(form);
  } catch (error) {
    showToast(error.message, "error");
  }
});

init();

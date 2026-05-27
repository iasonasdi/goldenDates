const API_URL = "https://script.google.com/macros/s/AKfycbyljqioqsXizBvwOWwUwEUlwsxZhG7d61FmuDjIqb642MOw4gQMMs8owAw8pp57xtfNhg/exec";
const TRIP_LENGTH_DAYS = 3;

const state = {
  entries: [],
  selectedUnavailable: new Set(),
  selectedPreferred: new Set(),
  unavailableMonth: new Date(),
  preferredMonth: new Date(),
  overviewMonth: new Date(),
  authPasscode: "",
};

const appContent = document.getElementById("app-content");
const authScreen = document.getElementById("auth-screen");
const passcodeInput = document.getElementById("passcode-input");
const passcodeSubmit = document.getElementById("passcode-submit");
const authStatus = document.getElementById("auth-status");

const form = document.getElementById("availability-form");
const formStatus = document.getElementById("form-status");
const dataStatus = document.getElementById("data-status");
const timeline = document.getElementById("timeline");
const tripSuggestions = document.getElementById("trip-suggestions");
const overviewCalendar = document.getElementById("overview-calendar");
const overviewMonthLabel = document.getElementById("overview-month-label");

const viewStartInput = document.getElementById("view-start");
const viewEndInput = document.getElementById("view-end");
const nameInput = document.getElementById("name");

const unavailablePicker = document.getElementById("unavailable-picker");
const unavailableMonthLabel = document.getElementById("unavailable-month-label");
const unavailableSelected = document.getElementById("unavailable-selected");
const preferredPicker = document.getElementById("preferred-picker");
const preferredMonthLabel = document.getElementById("preferred-month-label");
const preferredSelected = document.getElementById("preferred-selected");
const statVoted = document.getElementById("stat-voted");
const statBestDay = document.getElementById("stat-best-day");
const statBestTrip = document.getElementById("stat-best-trip");
const tabButtons = document.querySelectorAll(".tab");
const tabAvailability = document.getElementById("tab-availability");
const tabResults = document.getElementById("tab-results");
const dailyTip = document.getElementById("daily-tip");
const tipShuffle = document.getElementById("tip-shuffle");

const BACHELOR_TIPS = [
  "Book flights on a Tuesday. Your liver won't care, but your wallet might send a thank-you note.",
  "If nobody can make the same three days, that's not a scheduling bug — that's democracy.",
  "Preferred dates are wishes. Unavailable dates are facts. Plan accordingly.",
  "Rule of three: one legendary night, one recovery day, one group photo you'll all deny.",
  "Hydration isn't a vibe — it's a survival strategy with better lighting.",
  "The groom wins when the group shows up. Everyone else wins when someone actually fills this calendar.",
  "Good bachelor trips are planned like heists: dates first, chaos later.",
  "Open bar math: one drink per hour is a budget. One drink per minute is a memoir.",
  "Send your availability early. The best weekends vanish faster than free appetizers.",
  "Group chats propose. Shared calendars decide. This app is the grown-up table.",
  "Pack light, tip well, and never let the groom pay for his own surprise.",
  "If half the group is free and half isn't, you're not unlucky — you're negotiating.",
  "A great trip needs three things: aligned dates, charged phones, and one responsible adult (rotate daily).",
  "Sunscreen by day, stories by night, apologies by Monday.",
  "The perfect bachelor weekend isn't the wildest one — it's the one everyone can actually attend.",
  "Mark your unavailable dates like you're protecting treasure. Because sleep is treasure.",
  "Confetti is temporary. A well-picked weekend is legendary.",
  "When in doubt, pick the dates with the most green on the calendar. Science-ish.",
  "Bring cash, bring ID, bring your availability — in that order of importance for planning.",
  "The best man plans the trip. The best friends show up on time. Both are rare birds.",
  "Never trust a plan made after midnight unless it includes breakfast and a nap slot.",
  "Three days is enough for glory, recovery, and one story that starts with 'Okay, legally…'",
  "Vote with your calendar, not with 'I'm probably free.' Probably is how trips die.",
  "If someone says 'any weekend works,' they mean it until you pick one.",
  "Celebrate the groom. Document responsibly. Delete strategically.",
];

let lastTipIndex = -1;

function showRandomTip() {
  if (!dailyTip || !BACHELOR_TIPS.length) return;
  let index = Math.floor(Math.random() * BACHELOR_TIPS.length);
  if (BACHELOR_TIPS.length > 1 && index === lastTipIndex) {
    index = (index + 1) % BACHELOR_TIPS.length;
  }
  lastTipIndex = index;
  dailyTip.textContent = BACHELOR_TIPS[index];
}

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function toMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function dateRange(start, end) {
  const out = [];
  const current = new Date(`${start}T00:00:00`);
  const target = new Date(`${end}T00:00:00`);
  while (current <= target) {
    out.push(toIsoDate(current));
    current.setDate(current.getDate() + 1);
  }
  return out;
}

function setStatus(el, text, ok = true) {
  el.textContent = text;
  el.className = `status ${ok ? "ok" : "error"}`;
}

function inferDateBounds(entries) {
  const allDates = entries
    .flatMap((e) => [...(e.unavailableDates || []), ...(e.preferredDates || [])])
    .filter(Boolean);
  if (!allDates.length) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }
  return {
    start: allDates.slice().sort()[0],
    end: allDates.slice().sort().reverse()[0],
  };
}

function normalizeMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthCells(monthDate) {
  const first = normalizeMonth(monthDate);
  const firstWeekday = first.getDay();
  const start = new Date(first);
  start.setDate(1 - firstWeekday);
  const out = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    out.push(day);
  }
  return out;
}

function renderPicker(type) {
  const isUnavailable = type === "unavailable";
  const picker = isUnavailable ? unavailablePicker : preferredPicker;
  const label = isUnavailable ? unavailableMonthLabel : preferredMonthLabel;
  const selected = isUnavailable ? state.selectedUnavailable : state.selectedPreferred;
  const month = isUnavailable ? state.unavailableMonth : state.preferredMonth;
  const selectionLabel = isUnavailable ? unavailableSelected : preferredSelected;

  label.textContent = toMonthLabel(month);

  const header = weekdayLabels.map((w) => `<div class="weekday-cell">${w}</div>`).join("");
  const cells = monthCells(month)
    .map((day) => {
      const iso = toIsoDate(day);
      const outside = day.getMonth() !== month.getMonth();
      const selectedClass = selected.has(iso)
        ? isUnavailable
          ? "selected-unavailable"
          : "selected-preferred"
        : "";
      return `<button type="button" class="day-btn ${outside ? "outside" : ""} ${selectedClass}" data-date="${iso}" data-picker="${type}">${day.getDate()}</button>`;
    })
    .join("");
  picker.innerHTML = `${header}${cells}`;

  const chosen = [...selected].sort();
  selectionLabel.textContent = chosen.length ? `Selected: ${chosen.join(", ")}` : "No dates selected yet.";
}

function getDayAvailability(entries, iso) {
  const total = entries.length;
  if (!total) return { total: 0, unavailable: 0, available: 0, preferred: 0 };
  let unavailable = 0;
  let preferred = 0;
  entries.forEach((e) => {
    if ((e.unavailableDates || []).includes(iso)) unavailable += 1;
    if ((e.preferredDates || []).includes(iso)) preferred += 1;
  });
  return { total, unavailable, available: total - unavailable, preferred };
}

function getHeatClass(available, total) {
  if (!total) return "heat-empty";
  const ratio = available / total;
  if (ratio >= 0.9) return "heat-best";
  if (ratio >= 0.7) return "heat-good";
  if (ratio >= 0.5) return "heat-mixed";
  return "heat-worst";
}

function renderGroupStats(entries) {
  const total = entries.length;
  statVoted.textContent = String(total);
  if (!total) {
    statBestDay.textContent = "—";
    statBestTrip.textContent = "—";
    return;
  }

  const { start, end } = inferDateBounds(entries);
  const days = dateRange(start, end);
  let bestDay = null;
  let bestAvailable = -1;
  days.forEach((iso) => {
    const { available } = getDayAvailability(entries, iso);
    if (available > bestAvailable) {
      bestAvailable = available;
      bestDay = iso;
    }
  });
  statBestDay.textContent = bestDay ? `${bestDay.slice(5)} (${bestAvailable}/${total})` : "—";

  const trips = findBestTrips(entries);
  statBestTrip.textContent = trips.length
    ? `${trips[0].start.slice(5)} → ${trips[0].end.slice(5)} (${trips[0].availableCount}/${total})`
    : "—";
}

function renderOverviewCalendar(entries) {
  const month = state.overviewMonth;
  overviewMonthLabel.textContent = toMonthLabel(month);
  const total = entries.length;

  const header = weekdayLabels.map((w) => `<div class="weekday-cell">${w}</div>`).join("");
  const cells = monthCells(month)
    .map((day) => {
      const iso = toIsoDate(day);
      const outside = day.getMonth() !== month.getMonth();
      const { available, preferred } = getDayAvailability(entries, iso);
      const heat = getHeatClass(available, total);
      const cls = `day-btn overview-day ${heat}${outside ? " outside" : ""}`;
      const freeLabel = total ? `${available}/${total} free` : "No votes";
      return `<div class="${cls}" title="${iso}: ${freeLabel}">
        <span class="overview-day-num">${day.getDate()}</span>
        <span class="overview-cell-line">${freeLabel}</span>
        ${preferred ? `<span class="overview-cell-line">★ ${preferred}</span>` : ""}
      </div>`;
    })
    .join("");
  overviewCalendar.innerHTML = `${header}${cells}`;
}

function renderResults(entries) {
  renderGroupStats(entries);
  renderTripSuggestions();
  renderOverviewCalendar(entries);
  drawTimeline(entries);
}

function switchTab(tabName) {
  const isAvailability = tabName === "availability";
  tabAvailability.classList.toggle("hidden", !isAvailability);
  tabAvailability.classList.toggle("active", isAvailability);
  tabResults.classList.toggle("hidden", isAvailability);
  tabResults.classList.toggle("active", !isAvailability);
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
}

async function apiFetch(path = "") {
  if (!API_URL) return null;
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `${API_URL}${path}${separator}passcode=${encodeURIComponent(state.authPasscode)}`,
    { method: "GET" },
  );
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const payload = await res.json();
  if (payload && payload.error) throw new Error(payload.error);
  return payload;
}

async function apiUpsert(payload) {
  if (!API_URL) {
    const idx = state.entries.findIndex((e) => e.name.toLowerCase() === payload.name.toLowerCase());
    if (idx >= 0) state.entries[idx] = payload;
    else state.entries.push(payload);
    return { ok: true, mode: idx >= 0 ? "updated local" : "created local" };
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, passcode: state.authPasscode }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  const result = await res.json();
  if (result && result.error) throw new Error(result.error);
  return result;
}

function drawTimeline(entries) {
  if (!entries.length) {
    timeline.innerHTML = "<p>No entries yet.</p>";
    return;
  }
  const { start, end } = inferDateBounds(entries);
  if (!viewStartInput.value) viewStartInput.value = start;
  if (!viewEndInput.value) viewEndInput.value = end;
  const displayStart = viewStartInput.value || start;
  const displayEnd = viewEndInput.value || end;
  const days = dateRange(displayStart, displayEnd);
  const headerDays = days.map((d) => `<th>${d.slice(5)}</th>`).join("");
  const rows = entries
    .map((entry) => {
      const unavail = new Set(entry.unavailableDates || []);
      const preferred = new Set(entry.preferredDates || []);
      const cells = days
        .map((d) => {
          let cls = "day-free";
          let text = "";
          if (unavail.has(d)) {
            cls = "day-unavailable";
            text = "X";
          } else if (preferred.has(d)) {
            cls = "day-preferred";
            text = "P";
          }
          return `<td class="${cls}" title="${d}">${text}</td>`;
        })
        .join("");
      return `<tr><td class="sticky">${entry.name}</td>${cells}</tr>`;
    })
    .join("");
  timeline.innerHTML = `<table class="timeline-table"><thead><tr><th class="sticky">Name</th>${headerDays}</tr></thead><tbody>${rows}</tbody></table>`;
}

function findBestTrips(entries) {
  if (!entries.length) return [];
  const { start, end } = inferDateBounds(entries);
  const days = dateRange(start, end);
  if (days.length < TRIP_LENGTH_DAYS) return [];
  const unavailMap = new Map();
  const prefMap = new Map();
  entries.forEach((e) => {
    unavailMap.set(e.name, new Set(e.unavailableDates || []));
    prefMap.set(e.name, new Set(e.preferredDates || []));
  });
  const windows = [];
  for (let i = 0; i <= days.length - TRIP_LENGTH_DAYS; i += 1) {
    const tripDays = days.slice(i, i + TRIP_LENGTH_DAYS);
    const unavailableNames = [];
    let preferenceScore = 0;
    entries.forEach((e) => {
      const blocked = tripDays.some((d) => unavailMap.get(e.name).has(d));
      if (blocked) unavailableNames.push(e.name);
      tripDays.forEach((d) => {
        if (prefMap.get(e.name).has(d)) preferenceScore += 1;
      });
    });
    windows.push({
      start: tripDays[0],
      end: tripDays[tripDays.length - 1],
      unavailableCount: unavailableNames.length,
      unavailableNames,
      availableCount: entries.length - unavailableNames.length,
      preferenceScore,
    });
  }
  windows.sort((a, b) => {
    if (a.unavailableCount !== b.unavailableCount) return a.unavailableCount - b.unavailableCount;
    if (a.preferenceScore !== b.preferenceScore) return b.preferenceScore - a.preferenceScore;
    return a.start.localeCompare(b.start);
  });
  return windows.slice(0, 7);
}

function renderTripSuggestions() {
  const windows = findBestTrips(state.entries);
  if (!windows.length) {
    tripSuggestions.innerHTML = "<p>No possible windows to suggest yet.</p>";
    return;
  }
  tripSuggestions.innerHTML = windows
    .map(
      (w, idx) => `<article class="trip-card">
        <div><strong>#${idx + 1}: ${w.start} to ${w.end}</strong></div>
        <div class="trip-score">${w.availableCount} available, ${w.unavailableCount} unavailable</div>
        <div>Preference score: ${w.preferenceScore}</div>
        <div>Missing: ${w.unavailableNames.length ? w.unavailableNames.join(", ") : "Nobody"}</div>
      </article>`,
    )
    .join("");
}

function fillFormFromEntry(entry) {
  if (!entry) return;
  state.selectedUnavailable = new Set(entry.unavailableDates || []);
  state.selectedPreferred = new Set(entry.preferredDates || []);
  renderPicker("unavailable");
  renderPicker("preferred");
}

async function refreshData() {
  if (API_URL && !state.authPasscode) {
    throw new Error("Missing passcode");
  }
  try {
    if (!API_URL) {
      renderResults(state.entries);
      setStatus(dataStatus, "Using local storage mode. Set API_URL for shared data.", true);
      return true;
    }
    const payload = await apiFetch();
    state.entries = Array.isArray(payload.entries) ? payload.entries : [];
    renderResults(state.entries);
    setStatus(dataStatus, `Loaded ${state.entries.length} entries.`, true);
    return true;
  } catch (err) {
    setStatus(dataStatus, `Could not load data: ${err.message}`, false);
    throw err;
  }
}

function toggleAuth() {
  const unlocked = Boolean(state.authPasscode);
  authScreen.classList.toggle("hidden", unlocked);
  appContent.classList.toggle("hidden", !unlocked);
}

async function onPasscodeSubmit() {
  const passcode = passcodeInput.value.trim();
  if (!passcode) {
    setStatus(authStatus, "Please enter passcode.", false);
    return;
  }
  state.authPasscode = passcode;
  try {
    await refreshData();
    sessionStorage.setItem("goldenDatesPasscode", passcode);
    setStatus(authStatus, "Access granted.", true);
    toggleAuth();
  } catch (err) {
    state.authPasscode = "";
    sessionStorage.removeItem("goldenDatesPasscode");
    setStatus(authStatus, `Access denied: ${err.message}`, false);
    toggleAuth();
  }
}

nameInput.addEventListener("blur", () => {
  const name = nameInput.value.trim().toLowerCase();
  if (!name) return;
  const match = state.entries.find((e) => e.name.toLowerCase() === name);
  if (match) fillFormFromEntry(match);
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    setStatus(formStatus, "Name is required.", false);
    return;
  }
  const entry = {
    name,
    unavailableDates: [...state.selectedUnavailable].sort(),
    preferredDates: [...state.selectedPreferred].sort(),
    updatedAt: new Date().toISOString(),
  };
  try {
    const result = await apiUpsert(entry);
    setStatus(formStatus, `Saved successfully (${result.mode || "ok"}).`, true);
    await refreshData();
    switchTab("results");
  } catch (err) {
    setStatus(formStatus, `Save failed: ${err.message}`, false);
  }
});

document.body.addEventListener("click", (ev) => {
  const target = ev.target.closest("button");
  if (!target) return;
  const date = target.dataset.date;
  const picker = target.dataset.picker;
  if (!date || !picker) return;
  const setRef = picker === "unavailable" ? state.selectedUnavailable : state.selectedPreferred;
  if (setRef.has(date)) setRef.delete(date);
  else setRef.add(date);
  renderPicker(picker);
});

document.getElementById("refresh-data").addEventListener("click", refreshData);
document.getElementById("suggest-trips").addEventListener("click", renderTripSuggestions);
viewStartInput.addEventListener("change", () => renderResults(state.entries));
viewEndInput.addEventListener("change", () => renderResults(state.entries));

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

document.getElementById("unavailable-prev").addEventListener("click", () => {
  state.unavailableMonth = new Date(state.unavailableMonth.getFullYear(), state.unavailableMonth.getMonth() - 1, 1);
  renderPicker("unavailable");
});
document.getElementById("unavailable-next").addEventListener("click", () => {
  state.unavailableMonth = new Date(state.unavailableMonth.getFullYear(), state.unavailableMonth.getMonth() + 1, 1);
  renderPicker("unavailable");
});
document.getElementById("preferred-prev").addEventListener("click", () => {
  state.preferredMonth = new Date(state.preferredMonth.getFullYear(), state.preferredMonth.getMonth() - 1, 1);
  renderPicker("preferred");
});
document.getElementById("preferred-next").addEventListener("click", () => {
  state.preferredMonth = new Date(state.preferredMonth.getFullYear(), state.preferredMonth.getMonth() + 1, 1);
  renderPicker("preferred");
});
document.getElementById("overview-prev").addEventListener("click", () => {
  state.overviewMonth = new Date(state.overviewMonth.getFullYear(), state.overviewMonth.getMonth() - 1, 1);
  renderOverviewCalendar(state.entries);
  renderGroupStats(state.entries);
});
document.getElementById("overview-next").addEventListener("click", () => {
  state.overviewMonth = new Date(state.overviewMonth.getFullYear(), state.overviewMonth.getMonth() + 1, 1);
  renderOverviewCalendar(state.entries);
  renderGroupStats(state.entries);
});

passcodeSubmit.addEventListener("click", onPasscodeSubmit);
passcodeInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") onPasscodeSubmit();
});
tipShuffle.addEventListener("click", showRandomTip);

state.unavailableMonth = normalizeMonth(new Date());
state.preferredMonth = normalizeMonth(new Date());
state.overviewMonth = normalizeMonth(new Date());
renderPicker("unavailable");
renderPicker("preferred");
renderOverviewCalendar([]);
showRandomTip();
state.authPasscode = sessionStorage.getItem("goldenDatesPasscode") || "";
toggleAuth();
if (state.authPasscode) {
  refreshData().catch(() => {
    state.authPasscode = "";
    sessionStorage.removeItem("goldenDatesPasscode");
    toggleAuth();
  });
}

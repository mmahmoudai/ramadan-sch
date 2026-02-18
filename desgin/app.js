const STORAGE_KEY = "ramadan_tracker_entries_v1";

const dateInput = document.querySelector("#tracker-date");
const resetButton = document.querySelector("#reset-day");
const progressText = document.querySelector("#progress-text");
const fields = Array.from(document.querySelectorAll("[data-field]"));

const today = new Date();
dateInput.value = today.toISOString().split("T")[0];

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (_error) {
    return {};
  }
}

function writeStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function currentDateKey() {
  return dateInput.value;
}

function loadDay() {
  const store = readStorage();
  const record = store[currentDateKey()] || {};

  fields.forEach((field) => {
    const key = field.dataset.field;
    const value = record[key];

    if (field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }

    if (field.type === "radio") {
      field.checked = value === field.value;
      return;
    }

    field.value = typeof value === "string" ? value : "";
  });

  updateProgress();
}

function saveDay() {
  const store = readStorage();
  const key = currentDateKey();
  const record = {};

  fields.forEach((field) => {
    const fieldKey = field.dataset.field;

    if (field.type === "checkbox") {
      record[fieldKey] = field.checked;
      return;
    }

    if (field.type === "radio") {
      if (field.checked) {
        record[fieldKey] = field.value;
      } else if (!record[fieldKey]) {
        record[fieldKey] = "";
      }
      return;
    }

    record[fieldKey] = field.value.trim();
  });

  store[key] = record;
  writeStorage(store);
  updateProgress();
}

function updateProgress() {
  const checkedCount = fields.filter((field) => field.type === "checkbox" && field.checked).length;
  const textCount = fields.filter(
    (field) => (field.tagName === "TEXTAREA" || field.type === "text") && field.value.trim().length > 0
  ).length;
  const moodSelected = fields.some((field) => field.type === "radio" && field.checked) ? 1 : 0;
  const total = checkedCount + textCount + moodSelected;
  progressText.textContent = `${total} completed items`;
}

fields.forEach((field) => {
  const eventName = field.type === "checkbox" || field.type === "radio" ? "change" : "input";
  field.addEventListener(eventName, saveDay);
});

dateInput.addEventListener("change", loadDay);

resetButton.addEventListener("click", () => {
  const store = readStorage();
  delete store[currentDateKey()];
  writeStorage(store);
  loadDay();
});

loadDay();

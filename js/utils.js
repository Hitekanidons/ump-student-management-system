// js/utils.js
// Shared helpers used across every page.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatDate(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-ZA", {
    year: "numeric", month: "short", day: "numeric"
  });
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("en-ZA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

export function timeAgo(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? "s" : ""} ago`;
  return formatDate(value);
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ── Toasts ────────────────────────────────────────────────────
function ensureToastHost() {
  let host = $("#toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  return host;
}

export function toast(message, type = "info", timeout = 4000) {
  const host = ensureToastHost();
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Dismiss">×</button>
  `;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-in"));
  const remove = () => {
    el.classList.remove("toast-in");
    el.addEventListener("transitionend", () => el.remove(), { once: true });
  };
  el.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, timeout);
}

// ── Full-page loader ─────────────────────────────────────────
export function showLoader(message = "Loading…") {
  let el = $("#globalLoader");
  if (!el) {
    el = document.createElement("div");
    el.id = "globalLoader";
    el.className = "global-loader";
    el.innerHTML = `
      <div class="loader-card">
        <div class="loader-spinner"></div>
        <p class="loader-message">${escapeHtml(message)}</p>
      </div>`;
    document.body.appendChild(el);
  } else {
    el.querySelector(".loader-message").textContent = message;
    el.style.display = "flex";
  }
}

export function hideLoader() {
  const el = $("#globalLoader");
  if (el) el.style.display = "none";
}

// ── Button busy state ───────────────────────────────────────
export function setBusy(button, isBusy, busyText = "Please wait…") {
  if (!button) return;
  if (isBusy) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="btn-spinner"></span><span>${escapeHtml(busyText)}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

// ── Mapping Firebase error codes to friendly messages ──────
export function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "That email address is not valid.",
    "auth/weak-password": "Password is too weak. Please follow the rules below.",
    "auth/user-not-found": "No account found with this email address.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your internet connection.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/requires-recent-login": "Please log in again to continue."
  };
  return map[code] || "Something went wrong. Please try again.";
}
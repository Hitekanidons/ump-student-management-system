// js/announcements.js
import { db } from "./firebase-init.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, formatDateTime } from "./utils.js";

const { profile } = await requireAuth({ role: "student" });
const { main } = mountLayout({
  active: "announcements",
  profile,
  title: "Announcements",
  subtitle: "Updates from your lecturer"
});

main.innerHTML = `
  <section class="page-section">
    <div class="announce-list" id="announceList">
      <div class="skeleton skeleton-card"></div>
    </div>
  </section>`;

if (window.lucide) lucide.createIcons();

const [annSnap, modSnap] = await Promise.all([
  get(ref(db, "announcements")),
  get(ref(db, "modules"))
]);

const modules = Object.entries(modSnap.val() || {})
  .map(([id, v]) => ({ ...(v || {}), moduleId: id }))
  .filter((m) => m.programme === profile.programme && m.academicYear === profile.academicYear);
const moduleIds = new Set(modules.map((m) => m.moduleId));
const moduleById = new Map(modules.map((m) => [m.moduleId, m]));

const announcements = Object.entries(annSnap.val() || {})
  .map(([id, v]) => ({ ...(v || {}), _id: id }))
  .filter((a) => !a.moduleId || moduleIds.has(a.moduleId))
  .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

const listEl = document.getElementById("announceList");
if (announcements.length === 0) {
  listEl.innerHTML = `
    <div class="empty-state">
      <i data-lucide="megaphone"></i>
      <h3>No announcements yet</h3>
      <p>When your lecturer posts an update, it will appear here.</p>
    </div>`;
} else {
  listEl.innerHTML = announcements.map((a) => {
    const priority = (a.priority || "normal").toLowerCase();
    const mod = moduleById.get(a.moduleId);
    return `
      <article class="announce-card announce-card--${priority}">
        <div class="announce-card__head">
          <h3 class="announce-card__title">${escapeHtml(a.title)}</h3>
          <span class="announce-card__badge">${escapeHtml(priority)}</span>
        </div>
        <p class="announce-card__message">${escapeHtml(a.message)}</p>
        <div class="announce-card__meta">
          <span><i data-lucide="calendar"></i> ${formatDateTime(a.publishedAt)}</span>
          ${mod ? `<span><i data-lucide="book"></i> ${escapeHtml(mod.moduleCode)}</span>` : ""}
          ${a.lecturerName ? `<span><i data-lucide="user"></i> ${escapeHtml(a.lecturerName)}</span>` : ""}
        </div>
      </article>`;
  }).join("");
  if (window.lucide) lucide.createIcons();
}
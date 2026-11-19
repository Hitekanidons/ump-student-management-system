// js/text-in-scope.js
import { db } from "./firebase-init.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, formatDate } from "./utils.js";
import { renderResourceCard, attachResourceHandlers } from "./resources.js";

const { profile } = await requireAuth({ role: "student" });
const { main } = mountLayout({
  active: "scope",
  profile,
  title: "Text in Scope",
  subtitle: "Examination scope information from your lecturer"
});

main.innerHTML = `
  <section class="page-section">
    <div class="card card--glass" style="margin-bottom:20px;">
      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div class="stat-card__icon"><i data-lucide="file-search"></i></div>
        <div>
          <h2 style="margin:0 0 4px;">Exam scope information</h2>
          <p class="text-muted" style="margin:0;font-size:.9rem;">
            Materials published here define what is in scope for your assessments. Read each item carefully.
          </p>
        </div>
      </div>
    </div>
    <div class="resource-list" id="scopeList">
      <div class="skeleton skeleton-card"></div>
    </div>
  </section>`;

if (window.lucide) lucide.createIcons();

const [resSnap, modSnap] = await Promise.all([
  get(ref(db, "resources")),
  get(ref(db, "modules"))
]);

const modules = Object.entries(modSnap.val() || {})
  .map(([id, v]) => ({ ...(v || {}), moduleId: id }))
  .filter((m) => m.programme === profile.programme && m.academicYear === profile.academicYear);
const moduleById = new Map(modules.map((m) => [m.moduleId, m]));

const scopeItems = Object.entries(resSnap.val() || {})
  .map(([id, v]) => ({ ...(v || {}), _id: id }))
  .filter((r) => r.category === "Text in Scope" && moduleById.has(r.moduleId) && r.status !== "hidden")
  .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
  .map((r) => ({ ...r, lecturerName: moduleById.get(r.moduleId)?.lecturerName || "" }));

const listEl = document.getElementById("scopeList");
if (scopeItems.length === 0) {
  listEl.innerHTML = `
    <div class="empty-state">
      <i data-lucide="file-x"></i>
      <h3>No scope published yet</h3>
      <p>Your lecturer will publish exam scope information closer to the assessment period.</p>
    </div>`;
} else {
  listEl.innerHTML = scopeItems.map((r) => renderResourceCard(r, {
    showModule: true,
    moduleLabel: moduleById.get(r.moduleId)?.moduleCode || ""
  })).join("");
  attachResourceHandlers(listEl, scopeItems, profile);
  if (window.lucide) lucide.createIcons();
}
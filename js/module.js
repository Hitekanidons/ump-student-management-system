// js/module.js
import { db } from "./firebase-init.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, formatDate } from "./utils.js";
import {
  CATEGORIES, renderResourceCard, attachResourceHandlers,
  filterResources, categoryTabs
} from "./resources.js";

const { profile } = await requireAuth({ role: "student" });

const params = new URLSearchParams(window.location.search);
const moduleId = params.get("id");
if (!moduleId) {
  window.location.replace("student-dashboard.html");
  throw new Error("Missing module id");
}

const moduleSnap = await get(ref(db, `modules/${moduleId}`));
if (!moduleSnap.exists()) {
  window.location.replace("student-dashboard.html");
  throw new Error("Module not found");
}
const moduleData = { ...moduleSnap.val(), moduleId };

const { main } = mountLayout({
  active: "modules",
  profile,
  title: moduleData.moduleName || "Module",
  subtitle: `${moduleData.moduleCode || ""} • ${moduleData.academicYear || ""}`
});

main.innerHTML = `
  <section class="page-section">
    <div class="card" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;">
      <div class="stat-card__icon"><i data-lucide="book-open"></i></div>
      <div style="flex:1;min-width:200px;">
        <h2 style="margin:0 0 4px;">${escapeHtml(moduleData.moduleName)}</h2>
        <p class="text-muted" style="margin:0;font-size:.9rem;">
          ${escapeHtml(moduleData.moduleCode)} • Lecturer: ${escapeHtml(moduleData.lecturerName || "TBA")}
        </p>
      </div>
      <a href="student-dashboard.html" class="btn btn-secondary btn-sm">
        <i data-lucide="arrow-left"></i> Dashboard
      </a>
    </div>
  </section>

  <section class="page-section">
    <div class="toolbar">
      <div class="search-box">
        <i data-lucide="search"></i>
        <input type="search" id="searchInput" placeholder="Search this module's resources…">
      </div>
    </div>

    <div class="tabs" id="categoryTabs">
      ${categoryTabs("All")}
    </div>

    <div class="resource-list" id="resourceList">
      <div class="skeleton skeleton-card"></div>
    </div>
  </section>
`;
if (window.lucide) lucide.createIcons();

// ── Load & render ────────────────────────────────────────
const resourcesSnap = await get(ref(db, "resources"));
const allResources = Object.entries(resourcesSnap.val() || {})
  .map(([id, v]) => ({ ...(v || {}), _id: id }))
  .filter((r) => r.moduleId === moduleId && r.status !== "hidden")
  .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0))
  .map((r) => ({ ...r, lecturerName: moduleData.lecturerName }));

const state = { query: "", category: "All" };

function render() {
  const filtered = filterResources(allResources, state);
  const listEl = document.getElementById("resourceList");

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <h3>No resources found</h3>
        <p>${state.query || state.category !== "All"
          ? "Try a different search or category."
          : "Your lecturer hasn't uploaded resources for this category yet."}</p>
      </div>`;
  } else {
    listEl.innerHTML = filtered.map((r) => renderResourceCard(r)).join("");
    attachResourceHandlers(listEl, filtered, profile);
  }
  if (window.lucide) lucide.createIcons();
}

document.getElementById("categoryTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll("#categoryTabs .tab").forEach((t) => t.classList.remove("is-active"));
  tab.classList.add("is-active");
  state.category = tab.dataset.category;
  render();
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

render();
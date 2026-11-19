// js/student-dashboard.js
import { db } from "./firebase-init.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout, initials } from "./navigation.js";
import { escapeHtml, formatDate, timeAgo } from "./utils.js";

const { profile } = await requireAuth({ role: "student" });

const { main } = mountLayout({
  active: "dashboard",
  profile,
  title: `Welcome, ${profile.fullName?.split(" ")[0] || "Student"}`,
  subtitle: `${profile.programme || "BICT"} • ${profile.academicYear || "First Year"}`
});

// Mount the skeleton
main.innerHTML = `
  <section class="welcome">
    <h2>Hello, ${escapeHtml(profile.fullName || "Student")} 👋</h2>
    <p>Here's what's happening in your ${escapeHtml(profile.academicYear || "First Year")} journey today.</p>
    <div class="welcome__chips">
      <span class="welcome__chip">${escapeHtml(profile.programme || "BICT")}</span>
      <span class="welcome__chip">${escapeHtml(profile.academicYear || "First Year")}</span>
      <span class="welcome__chip">${escapeHtml(profile.studentNumber || "")}</span>
    </div>
  </section>

  <section class="page-section">
    <div class="stat-grid" id="statGrid">
      ${skeleton(4)}
    </div>
  </section>

  <section class="page-section" id="modules">
    <div class="section-head">
      <div>
        <h2>My Modules</h2>
        <p>Your enrolled modules for this academic year.</p>
      </div>
    </div>
    <div class="module-grid" id="moduleGrid">
      ${skeleton(1)}
    </div>
  </section>

  <section class="page-section">
    <div class="section-head">
      <div>
        <h2>Recently Uploaded</h2>
        <p>The latest learning materials from your lecturer.</p>
      </div>
      <a href="resources.html" class="btn btn-ghost btn-sm">View all <i data-lucide="arrow-right"></i></a>
    </div>
    <div class="resource-list" id="recentResources">
      ${skeleton(1)}
    </div>
  </section>
`;

if (window.lucide) lucide.createIcons();

function skeleton(n) {
  return Array.from({ length: n }, () => `<div class="skeleton skeleton-card"></div>`).join("");
}

// ── Load data ─────────────────────────────────────────────
try {
  const [modulesSnap, resourcesSnap, announcesSnap, recentSnap] = await Promise.all([
    get(ref(db, "modules")),
    get(ref(db, "resources")),
    get(ref(db, "announcements")),
    get(ref(db, "resources")) // reuse — we sort & slice below
  ]);

  const allModules = toArray(modulesSnap.val())
    .filter((m) => m.programme === profile.programme && m.academicYear === profile.academicYear && m.status !== "archived");
  const moduleIds = new Set(allModules.map((m) => m.moduleId));

  const allResources = toArray(resourcesSnap.val())
    .filter((r) => moduleIds.has(r.moduleId) && r.status !== "hidden")
    .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));

  const allAnnounces = toArray(announcesSnap.val())
    .filter((a) => !a.moduleId || moduleIds.has(a.moduleId))
    .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));

  const latestUploads = allResources.slice(0, 5);

  // ── Stats ─────────────────────────────────────────────
  const recentWindow = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newResources = allResources.filter((r) => (r.uploadedAt || 0) >= recentWindow).length;
  const newAnnouncements = allAnnounces.filter((a) => (a.publishedAt || 0) >= recentWindow).length;

  document.getElementById("statGrid").innerHTML = [
    statCard("book-open", allModules.length, "Available modules"),
    statCard("folder-open", allResources.length, "Learning resources"),
    statCard("megaphone", newAnnouncements, "New announcements"),
    statCard("upload", newResources, "New this week")
  ].join("");

  // ── Modules ───────────────────────────────────────────
  const grid = document.getElementById("moduleGrid");
  if (allModules.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <i data-lucide="book-x"></i>
        <h3>No modules yet</h3>
        <p>Your lecturer has not published modules for this academic year yet. Check back soon.</p>
      </div>`;
  } else {
    grid.innerHTML = allModules.map((mod) => {
      const modResources = allResources.filter((r) => r.moduleId === mod.moduleId);
      const latest = modResources[0];
      return `
        <article class="module-card">
          <span class="module-card__code">${escapeHtml(mod.moduleCode)}</span>
          <h3>${escapeHtml(mod.moduleName)}</h3>
          <div class="module-card__meta">
            <span><i data-lucide="user"></i>${escapeHtml(mod.lecturerName || "Assigned lecturer")}</span>
            <span><i data-lucide="files"></i>${modResources.length} resource${modResources.length === 1 ? "" : "s"}</span>
            <span><i data-lucide="clock"></i>${latest ? timeAgo(latest.uploadedAt) : "No uploads yet"}</span>
          </div>
          <div class="module-card__actions">
            <a href="module.html?id=${encodeURIComponent(mod.moduleId)}" class="btn btn-primary btn-sm">
              Open module <i data-lucide="arrow-right"></i>
            </a>
          </div>
        </article>`;
    }).join("");
  }

  // ── Recent uploads ────────────────────────────────────
  const listEl = document.getElementById("recentResources");
  if (latestUploads.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <h3>Nothing here yet</h3>
        <p>Your lecturer hasn't uploaded any learning materials recently.</p>
      </div>`;
  } else {
    listEl.innerHTML = latestUploads.map((r) => resourceRow(r, allModules)).join("");
  }

  if (window.lucide) lucide.createIcons();
} catch (err) {
  console.error(err);
  document.getElementById("statGrid").innerHTML = `
    <div class="empty-state" style="grid-column: 1/-1;">
      <i data-lucide="alert-circle"></i>
      <h3>Could not load dashboard</h3>
      <p>${escapeHtml(err.message || "Please refresh the page.")}</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ── Helpers ───────────────────────────────────────────────
function toArray(obj) {
  if (!obj) return [];
  return Object.entries(obj).map(([k, v]) => ({ ...(v || {}), _id: k }));
}

function statCard(icon, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-card__icon"><i data-lucide="${icon}"></i></div>
      <div class="stat-card__value">${value}</div>
      <div class="stat-card__label">${escapeHtml(label)}</div>
    </div>`;
}

function resourceRow(r, allModules) {
  const mod = allModules.find((m) => m.moduleId === r.moduleId);
  return `
    <article class="resource-card">
      <div class="resource-card__icon ${iconClassFor(r.fileType)}">${typeLabel(r.fileType)}</div>
      <div class="resource-card__body">
        <h3 class="resource-card__title">${escapeHtml(r.title)}</h3>
        ${r.description ? `<p class="resource-card__desc">${escapeHtml(r.description)}</p>` : ""}
        <div class="resource-card__meta">
          <span><i data-lucide="book"></i>${escapeHtml(mod?.moduleCode || "")}</span>
          <span><i data-lucide="folder"></i>${escapeHtml(r.category || "General")}</span>
          <span><i data-lucide="clock"></i>${formatDate(r.uploadedAt)}</span>
        </div>
      </div>
      <div class="resource-card__actions">
        <a href="module.html?id=${encodeURIComponent(r.moduleId)}#${encodeURIComponent(r._id)}"
           class="btn btn-secondary btn-sm">Open</a>
      </div>
    </article>`;
}

function iconClassFor(fileType = "") {
  const t = fileType.toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "pptx";
  if (t.includes("word") || t.includes("doc")) return "doc";
  return "other";
}
function typeLabel(fileType = "") {
  const t = fileType.toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "PPTX";
  if (t.includes("word") || t.includes("doc")) return "DOC";
  return "FILE";
}
// js/admin.js
import { auth, db } from "./firebase-init.js";
import {
  ref, get, push, set, update, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, formatDate, timeAgo, toast, setBusy } from "./utils.js";

const { profile } = await requireAuth({ role: "admin" });

const { main } = mountLayout({
  active: "dashboard",
  profile,
  title: "Administrator Dashboard",
  subtitle: "Manage modules, lecturers and students"
});

// ── Render loading shell immediately (page never goes blank) ──
main.innerHTML = `
  <section class="page-section">
    <div class="card" style="padding:40px;text-align:center;">
      <div class="loader-spinner" style="margin:0 auto 16px;"></div>
      <p class="text-muted">Loading dashboard…</p>
    </div>
  </section>`;

// ── Load data with proper error handling ─────────────────────
let users = [], modules = [], resources = [];
try {
  const [usersSnap, modulesSnap, resourcesSnap] = await Promise.all([
    get(ref(db, "users")),
    get(ref(db, "modules")),
    get(ref(db, "resources"))
  ]);
  users = entries(usersSnap.val());
  modules = entries(modulesSnap.val());
  resources = entries(resourcesSnap.val());
} catch (err) {
  console.error("❌ Admin dashboard data load failed:", err);
  main.innerHTML = `
    <section class="page-section">
      <div class="card" style="padding:32px;">
        <h2 style="margin-top:0;">⚠️ Could not load dashboard data</h2>
        <p class="text-muted" style="margin-bottom:12px;">${escapeHtml(err.message || "Permission denied")}</p>
        <p class="text-muted" style="font-size:.88rem;line-height:1.6;">
          <strong>Most likely cause:</strong> the security rules on <code>users/</code>
          don't allow admin reads at the collection root.<br>
          <strong>Fix:</strong> deploy the updated <code>database.rules.json</code>,
          then hard-refresh with <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>R</kbd>.
        </p>
      </div>
    </section>`;
  throw err; // stop execution
}

const lecturers = users.filter((u) => u.role === "lecturer");
const students = users.filter((u) => u.role === "student");

// ── Layout ──────────────────────────────────────────────────
main.innerHTML = `
  <section class="page-section">
    <div class="welcome">
      <h2>Welcome, ${escapeHtml(profile.fullName || "Administrator")}</h2>
      <p>Manage the entire UMP BICT platform from here.</p>
      <div class="welcome__chips">
        <span class="welcome__chip">${modules.length} modules</span>
        <span class="welcome__chip">${lecturers.length} lecturers</span>
        <span class="welcome__chip">${students.length} students</span>
      </div>
    </div>
  </section>

  <section class="page-section">
    <div class="stat-grid">
      ${statCard("book-open", modules.length, "Total modules")}
      ${statCard("presentation", lecturers.length, "Lecturers")}
      ${statCard("users", students.length, "Students")}
      ${statCard("folder-open", resources.length, "Resources")}
    </div>
  </section>

  <section class="page-section" id="modulesSection">
    <div class="section-head">
      <div>
        <h2>Module management</h2>
        <p>Create modules and assign lecturers.</p>
      </div>
      <button class="btn btn-primary" id="createModuleBtn">
        <i data-lucide="plus"></i> New module
      </button>
    </div>
    <div class="card" id="modulesTable" style="padding:0;overflow:hidden;"></div>
  </section>

  <section class="page-section">
    <div class="section-head">
      <div>
        <h2>Lecturers</h2>
        <p>Registered lecturer accounts. <em>New lecturer Auth users are still created via the Firebase Console — see README §5.</em></p>
      </div>
    </div>
    <div class="card" id="lecturersTable" style="padding:0;overflow:hidden;"></div>
  </section>

  <section class="page-section">
    <div class="section-head">
      <div>
        <h2>Students</h2>
        <p>Suspend or reactivate student accounts.</p>
      </div>
    </div>
    <div class="card" id="studentsTable" style="padding:0;overflow:hidden;"></div>
  </section>

  <div id="modalHost"></div>
`;
if (window.lucide) lucide.createIcons();

// ── Tables ──────────────────────────────────────────────────
function renderModules() {
  const el = document.getElementById("modulesTable");
  if (modules.length === 0) {
    el.innerHTML = `<div class="empty-state" style="border:none;"><i data-lucide="book-x"></i><h3>No modules yet</h3><p>Click "New module" to create the first one.</p></div>`;
  } else {
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--grey);text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;">
            <th style="padding:12px 16px;">Code</th>
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Programme</th>
            <th style="padding:12px 16px;">Lecturer</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${modules.map((m) => {
            const assignedLecturer = users.find((u) => u._id === m.lecturerId);
            return `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:12px 16px;font-weight:700;color:var(--navy);">${escapeHtml(m.moduleCode || "—")}</td>
                <td style="padding:12px 16px;">${escapeHtml(m.moduleName || "—")}</td>
                <td style="padding:12px 16px;color:var(--text-muted);">${escapeHtml(m.programme || "—")} · ${escapeHtml(m.academicYear || "—")}</td>
                <td style="padding:12px 16px;color:${assignedLecturer ? "var(--text)" : "var(--danger)"};">
                  ${assignedLecturer ? escapeHtml(assignedLecturer.fullName) : "<em>Unassigned</em>"}
                </td>
                <td style="padding:12px 16px;">
                  <span style="font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:999px;
                    background:${m.status === "active" ? "#f0fdf4" : "#fef2f2"};
                    color:${m.status === "active" ? "#166534" : "#991b1b"};">
                    ${escapeHtml(m.status || "active")}
                  </span>
                </td>
                <td style="padding:12px 16px;text-align:right;">
                  <button class="btn btn-ghost btn-sm" data-edit-module="${escapeHtml(m._id)}"><i data-lucide="pencil"></i></button>
                  <button class="btn btn-ghost btn-sm" data-del-module="${escapeHtml(m._id)}" style="color:var(--danger);"><i data-lucide="trash-2"></i></button>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  }
  if (window.lucide) lucide.createIcons();

  el.querySelectorAll("[data-edit-module]").forEach((btn) => {
    btn.addEventListener("click", () => openModuleModal(modules.find((m) => m._id === btn.dataset.editModule)));
  });
  el.querySelectorAll("[data-del-module]").forEach((btn) => {
    btn.addEventListener("click", () => deleteModule(btn.dataset.delModule));
  });
}

function renderLecturers() {
  const el = document.getElementById("lecturersTable");
  if (lecturers.length === 0) {
    el.innerHTML = `<div class="empty-state" style="border:none;"><i data-lucide="user-x"></i><h3>No lecturers yet</h3><p>Create the first lecturer via Firebase Console (README §5), then refresh.</p></div>`;
  } else {
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--grey);text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;">
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Email</th>
            <th style="padding:12px 16px;">Modules</th>
            <th style="padding:12px 16px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${lecturers.map((l) => {
            const moduleCount = modules.filter((m) => m.lecturerId === l._id).length;
            return `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:12px 16px;font-weight:600;">${escapeHtml(l.fullName || "—")}</td>
                <td style="padding:12px 16px;color:var(--text-muted);">${escapeHtml(l.email || "—")}</td>
                <td style="padding:12px 16px;">${moduleCount}</td>
                <td style="padding:12px 16px;">
                  <span style="font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:999px;
                    background:${l.accountStatus === "active" ? "#f0fdf4" : "#fef2f2"};
                    color:${l.accountStatus === "active" ? "#166534" : "#991b1b"};">
                    ${escapeHtml(l.accountStatus || "active")}
                  </span>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  }
  if (window.lucide) lucide.createIcons();
}

function renderStudents() {
  const el = document.getElementById("studentsTable");
  if (students.length === 0) {
    el.innerHTML = `<div class="empty-state" style="border:none;"><i data-lucide="users"></i><h3>No students registered yet</h3></div>`;
  } else {
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--grey);text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;">
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Student #</th>
            <th style="padding:12px 16px;">Registered</th>
            <th style="padding:12px 16px;">Status</th>
            <th style="padding:12px 16px;text-align:right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map((s) => `
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:12px 16px;font-weight:600;">${escapeHtml(s.fullName || "—")}</td>
              <td style="padding:12px 16px;color:var(--text-muted);">${escapeHtml(s.studentNumber || "—")}</td>
              <td style="padding:12px 16px;color:var(--text-muted);">${timeAgo(s.createdAt)}</td>
              <td style="padding:12px 16px;">
                <span style="font-size:.75rem;font-weight:700;padding:3px 9px;border-radius:999px;
                  background:${s.accountStatus === "active" ? "#f0fdf4" : "#fef2f2"};
                  color:${s.accountStatus === "active" ? "#166534" : "#991b1b"};">
                  ${escapeHtml(s.accountStatus || "active")}
                </span>
              </td>
              <td style="padding:12px 16px;text-align:right;">
                <button class="btn btn-ghost btn-sm" data-toggle-status="${escapeHtml(s._id)}">
                  ${s.accountStatus === "active" ? "Suspend" : "Activate"}
                </button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }
  if (window.lucide) lucide.createIcons();

  el.querySelectorAll("[data-toggle-status]").forEach((btn) => {
    btn.addEventListener("click", () => toggleStudentStatus(btn.dataset.toggleStatus));
  });
}

renderModules();
renderLecturers();
renderStudents();

// ── Modals ──────────────────────────────────────────────────
function closeModal() { document.getElementById("modalHost").innerHTML = ""; }
function showModal(title, bodyHtml) {
  const host = document.getElementById("modalHost");
  host.innerHTML = `
    <div class="modal-overlay" style="position:fixed;inset:0;background:rgba(15,25,40,.5);display:grid;place-items:center;z-index:800;padding:16px;">
      <div style="background:#fff;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid var(--border);">
          <h2 style="margin:0;font-size:1.15rem;">${escapeHtml(title)}</h2>
          <button class="btn btn-ghost btn-sm" id="modalClose"><i data-lucide="x"></i></button>
        </div>
        <div style="padding:22px 24px;">${bodyHtml}</div>
      </div>
    </div>`;
  if (window.lucide) lucide.createIcons();
  document.getElementById("modalClose").addEventListener("click", closeModal);
  host.querySelector(".modal-overlay").addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) closeModal();
  });
}

// ── Create / edit module ────────────────────────────────────
document.getElementById("createModuleBtn").addEventListener("click", () => openModuleModal());

function openModuleModal(existing = null) {
  const isEdit = !!existing;
  const lecturerOptions = lecturers.map((l) =>
    `<option value="${escapeHtml(l._id)}" data-name="${escapeHtml(l.fullName || "")}" ${existing?.lecturerId === l._id ? "selected" : ""}>${escapeHtml(l.fullName || l.email)}</option>`
  ).join("");

  showModal(isEdit ? "Edit module" : "Create new module", `
    <form id="moduleForm">
      <div class="form-field">
        <label>Module name</label>
        <input type="text" id="mName" required value="${escapeHtml(existing?.moduleName || "")}">
      </div>
      <div class="form-field">
        <label>Module code</label>
        <input type="text" id="mCode" required value="${escapeHtml(existing?.moduleCode || "")}" placeholder="e.g. ITP101">
      </div>
      <div class="form-field">
        <label>Programme</label>
        <input type="text" id="mProgramme" required value="${escapeHtml(existing?.programme || "BICT")}">
      </div>
      <div class="form-field">
        <label>Academic year</label>
        <input type="text" id="mYear" required value="${escapeHtml(existing?.academicYear || "First Year")}">
      </div>
      <div class="form-field">
        <label>Assign lecturer</label>
        <select id="mLecturer" class="select" style="width:100%;" required>
          <option value="">— Select lecturer —</option>
          ${lecturerOptions}
        </select>
        ${lecturers.length === 0 ? `<p class="field-hint" style="color:var(--danger);">No lecturers exist yet. Create one via Firebase Console (README §5).</p>` : ""}
      </div>
      <div class="form-field">
        <label>Status</label>
        <select id="mStatus" class="select" style="width:100%;">
          <option value="active" ${existing?.status === "active" ? "selected" : ""}>Active</option>
          <option value="archived" ${existing?.status === "archived" ? "selected" : ""}>Archived</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="modalSubmit">
          <i data-lucide="${isEdit ? "save" : "plus"}"></i> ${isEdit ? "Save changes" : "Create module"}
        </button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("moduleForm").addEventListener("submit", (e) => saveModule(e, existing));
}

async function saveModule(e, existing) {
  e.preventDefault();
  const moduleName = document.getElementById("mName").value.trim();
  const moduleCode = document.getElementById("mCode").value.trim();
  const programme = document.getElementById("mProgramme").value.trim();
  const academicYear = document.getElementById("mYear").value.trim();
  const lecturerSelect = document.getElementById("mLecturer");
  const lecturerId = lecturerSelect.value;
  const lecturerName = lecturerSelect.selectedOptions[0]?.dataset.name || "";
  const status = document.getElementById("mStatus").value;
  const btn = document.getElementById("modalSubmit");

  if (!moduleName || !moduleCode || !programme || !academicYear || !lecturerId) {
    toast("All fields are required.", "error");
    return;
  }

  setBusy(btn, true, existing ? "Saving…" : "Creating…");
  try {
    const payload = {
      moduleName, moduleCode, programme, academicYear,
      lecturerId, lecturerName, status
    };

    if (existing) {
      await update(ref(db, `modules/${existing._id}`), payload);
      toast("Module updated.", "success");
    } else {
      const id = push(ref(db, "modules")).key;
      await set(ref(db, `modules/${id}`), { ...payload, createdAt: serverTimestamp() });
      toast("Module created.", "success");
    }

    closeModal();
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    console.error(err);
    toast(err.message || "Save failed.", "error");
    setBusy(btn, false);
  }
}

async function deleteModule(moduleId) {
  const m = modules.find((x) => x._id === moduleId);
  if (!confirm(`Archive module "${m?.moduleCode}"? Students will no longer see it.`)) return;
  try {
    await update(ref(db, `modules/${moduleId}`), { status: "archived" });
    toast("Module archived.", "success");
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    toast("Could not archive module.", "error");
  }
}

// ── Student status ──────────────────────────────────────────
async function toggleStudentStatus(uid) {
  const s = students.find((u) => u._id === uid);
  if (!s) return;
  const next = s.accountStatus === "active" ? "suspended" : "active";
  if (!confirm(`${next === "active" ? "Activate" : "Suspend"} ${s.fullName}?`)) return;
  try {
    await update(ref(db, `users/${uid}`), { accountStatus: next });
    toast(`Account ${next}.`, "success");
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    toast("Could not update account.", "error");
  }
}

// ── Utilities ───────────────────────────────────────────────
function entries(obj) {
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
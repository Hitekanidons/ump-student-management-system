// js/lecturer-dashboard.js
import { db } from "./firebase-init.js";
import {
  ref, get, push, set, update, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, formatDate, formatDateTime, timeAgo, toast, setBusy } from "./utils.js";
import {
  CATEGORIES, filterResources, categoryTabs, uploadFileToR2, iconClassFor, typeLabel
} from "./resources.js";
import { R2_CONFIG } from "./r2-config.js";

const { profile } = await requireAuth({ role: "lecturer" });

const { main } = mountLayout({
  active: "dashboard",
  profile,
  title: `Lecturer Dashboard`,
  subtitle: `Welcome, ${profile.fullName || "Lecturer"}`
});

// ────────────────────────────────────────────────────────────
// Data loading
// ────────────────────────────────────────────────────────────
const [modulesSnap, studentsSnap, resourcesSnap, annSnap, downloadsSnap] = await Promise.all([
  get(ref(db, "modules")).catch((e) => { console.error("❌ modules:", e); return { val: () => null }; }),
  get(ref(db, "users")).catch((e) => { console.error("❌ users:", e); return { val: () => null }; }),
  get(ref(db, "resources")).catch((e) => { console.error("❌ resources:", e); return { val: () => null }; }),
  get(ref(db, "announcements")).catch((e) => { console.error("❌ announcements:", e); return { val: () => null }; }),
  get(ref(db, "downloads")).catch((e) => { console.error("❌ downloads:", e); return { val: () => null }; })
]);

// ✅ FIX 1 — modules use `_id` (the Firebase key), not `moduleId`
const allModules = entries(modulesSnap.val())
  .filter((m) => m.lecturerId === profile.uid || m.lecturerId === profile._uid);
const myModuleIds = new Set(allModules.map((m) => m._id));

const students = entries(studentsSnap.val()).filter((u) => u.role === "student");
const resources = entries(resourcesSnap.val())
  .filter((r) => myModuleIds.has(r.moduleId))
  .sort((a, b) => (b.uploadedAt || 0) - (a.uploadedAt || 0));
const announcements = entries(annSnap.val())
  .filter((a) => myModuleIds.has(a.moduleId) || a.lecturerId === profile.uid)
  .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
const downloads = entries(downloadsSnap.val());

// ────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────
main.innerHTML = `
  <section class="page-section">
    <div class="welcome">
      <h2>Welcome, ${escapeHtml(profile.fullName || "Lecturer")}</h2>
      <p>Manage your ${allModules.length} module${allModules.length === 1 ? "" : "s"} and share resources with ${students.length} registered student${students.length === 1 ? "" : "s"}.</p>
      <div class="welcome__chips">
        ${allModules.map((m) => `<span class="welcome__chip">${escapeHtml(m.moduleCode)}</span>`).join("") || `<span class="welcome__chip">No modules yet</span>`}
      </div>
    </div>
  </section>

  <section class="page-section">
    <div class="stat-grid" id="statGrid">
      ${statCard("users", students.length, "Registered students")}
      ${statCard("folder-open", resources.length, "Resources uploaded")}
      ${statCard("megaphone", announcements.length, "Announcements")}
      ${statCard("download", downloads.filter((d) => myModuleIds.has(d.moduleId)).length, "Total downloads")}
    </div>
  </section>

  <section class="page-section">
    <div class="section-head">
      <div><h2>Quick actions</h2></div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" id="openUploadBtn"><i data-lucide="upload"></i> Upload resource</button>
      <button class="btn btn-secondary" id="openAnnounceBtn"><i data-lucide="megaphone"></i> Publish announcement</button>
      <button class="btn btn-secondary" id="openScopeBtn"><i data-lucide="file-search"></i> Publish exam scope</button>
    </div>
  </section>

  <section class="page-section" id="resourcesSection">
    <div class="section-head">
      <div>
        <h2>My Resources</h2>
        <p>Manage all learning materials you've published.</p>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <i data-lucide="search"></i>
        <input type="search" id="searchInput" placeholder="Search your resources…">
      </div>
      <select class="select" id="moduleFilter"><option value="">All modules</option></select>
    </div>
    <div class="tabs" id="categoryTabs">${categoryTabs("All")}</div>
    <div class="resource-list" id="resourceList"></div>
  </section>

  <section class="page-section">
    <div class="section-head"><div><h2>Recent announcements</h2></div></div>
    <div class="announce-list" id="announceList"></div>
  </section>

  <section class="page-section">
    <div class="section-head"><div><h2>Recently registered students</h2></div></div>
    <div class="card" id="studentsList" style="padding:0;overflow:hidden;"></div>
  </section>

  <div id="modalHost"></div>
`;

// ✅ FIX 2 — populate module filter with real keys
const moduleFilter = document.getElementById("moduleFilter");
allModules.forEach((m) => {
  const opt = document.createElement("option");
  opt.value = m._id;
  opt.textContent = `${m.moduleCode} — ${m.moduleName}`;
  moduleFilter.appendChild(opt);
});

if (window.lucide) lucide.createIcons();

// ────────────────────────────────────────────────────────────
// Resource list
// ────────────────────────────────────────────────────────────
const state = { query: "", category: "All", moduleId: "" };

function renderResources() {
  const filtered = filterResources(resources, state);
  const listEl = document.getElementById("resourceList");
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="inbox"></i>
        <h3>No resources yet</h3>
        <p>Click <strong>Upload resource</strong> to publish your first file.</p>
      </div>`;
  } else {
    listEl.innerHTML = filtered.map((r) => `
      <article class="resource-card" data-resource-id="${escapeHtml(r._id)}">
        <div class="resource-card__icon ${iconClassFor(r.fileType)}">${typeLabel(r.fileType)}</div>
        <div class="resource-card__body">
          <h3 class="resource-card__title">${escapeHtml(r.title)}</h3>
          ${r.description ? `<p class="resource-card__desc">${escapeHtml(r.description)}</p>` : ""}
          <div class="resource-card__meta">
            <span><i data-lucide="folder"></i>${escapeHtml(r.category)}</span>
            <span><i data-lucide="clock"></i>${formatDate(r.uploadedAt)}</span>
            <span><i data-lucide="download"></i>${r.downloadCount || 0} downloads</span>
            <span><i data-lucide="file"></i>${escapeHtml(r.fileName || "")}</span>
          </div>
        </div>
        <div class="resource-card__actions">
          <button class="btn btn-secondary btn-sm" data-edit="${escapeHtml(r._id)}"><i data-lucide="pencil"></i> Edit</button>
          <button class="btn btn-ghost btn-sm" data-delete="${escapeHtml(r._id)}" style="color:var(--danger);"><i data-lucide="trash-2"></i> Delete</button>
        </div>
      </article>`).join("");

    listEl.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => openEditModal(filtered.find((r) => r._id === btn.dataset.edit)));
    });
    listEl.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", () => deleteResource(btn.dataset.delete));
    });
    if (window.lucide) lucide.createIcons();
  }
}

// Filter handlers
document.getElementById("categoryTabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab"); if (!tab) return;
  document.querySelectorAll("#categoryTabs .tab").forEach((t) => t.classList.remove("is-active"));
  tab.classList.add("is-active");
  state.category = tab.dataset.category;
  renderResources();
});
document.getElementById("searchInput").addEventListener("input", (e) => {
  state.query = e.target.value; renderResources();
});
moduleFilter.addEventListener("change", (e) => {
  state.moduleId = e.target.value; renderResources();
});

// ────────────────────────────────────────────────────────────
// Announcements
// ────────────────────────────────────────────────────────────
function renderAnnouncements() {
  const el = document.getElementById("announceList");
  if (announcements.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <i data-lucide="megaphone"></i>
        <h3>No announcements yet</h3>
        <p>Publish one to notify your students.</p>
      </div>`;
  } else {
    el.innerHTML = announcements.slice(0, 5).map((a) => {
      const p = (a.priority || "normal").toLowerCase();
      return `
        <article class="announce-card announce-card--${p}">
          <div class="announce-card__head">
            <h3 class="announce-card__title">${escapeHtml(a.title)}</h3>
            <span class="announce-card__badge">${escapeHtml(p)}</span>
          </div>
          <p class="announce-card__message">${escapeHtml(a.message)}</p>
          <div class="announce-card__meta">
            <span><i data-lucide="calendar"></i>${formatDateTime(a.publishedAt)}</span>
          </div>
        </article>`;
    }).join("");
  }
  if (window.lucide) lucide.createIcons();
}

// ────────────────────────────────────────────────────────────
// Recent students
// ────────────────────────────────────────────────────────────
function renderStudents() {
  const el = document.getElementById("studentsList");
  const recent = [...students].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 6);
  if (recent.length === 0) {
    el.innerHTML = `<div class="empty-state" style="border:none;"><i data-lucide="users"></i><h3>No students registered yet</h3></div>`;
  } else {
    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--grey);text-align:left;font-size:.78rem;color:var(--text-muted);text-transform:uppercase;">
            <th style="padding:12px 16px;">Name</th>
            <th style="padding:12px 16px;">Student #</th>
            <th style="padding:12px 16px;">Registered</th>
          </tr>
        </thead>
        <tbody>
          ${recent.map((s) => `
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:12px 16px;font-weight:600;">${escapeHtml(s.fullName || "—")}</td>
              <td style="padding:12px 16px;color:var(--text-muted);">${escapeHtml(s.studentNumber || "—")}</td>
              <td style="padding:12px 16px;color:var(--text-muted);">${timeAgo(s.createdAt)}</td>
            </tr>`).join("")}
        </tbody>
      </table>`;
  }
  if (window.lucide) lucide.createIcons();
}

renderResources();
renderAnnouncements();
renderStudents();

// ────────────────────────────────────────────────────────────
// Modals
// ────────────────────────────────────────────────────────────
function closeModal() {
  document.getElementById("modalHost").innerHTML = "";
}

function showModal(title, bodyHtml) {
  const host = document.getElementById("modalHost");
  host.innerHTML = `
    <div class="modal-overlay" style="position:fixed;inset:0;background:rgba(15,25,40,.5);display:grid;place-items:center;z-index:800;padding:16px;">
      <div class="modal-card" style="background:#fff;border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);max-width:560px;width:100%;max-height:90vh;overflow-y:auto;">
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

// ✅ FIX 3 — use `_id` so options actually have values
function moduleOptions(selectedId = "") {
  return allModules.map((m) =>
    `<option value="${escapeHtml(m._id)}" ${m._id === selectedId ? "selected" : ""}>${escapeHtml(m.moduleCode)} — ${escapeHtml(m.moduleName)}</option>`
  ).join("");
}
function categoryOptions(selected = "") {
  return CATEGORIES.map((c) =>
    `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`
  ).join("");
}

// ── Upload / Edit modal ─────────────────────────────────────
document.getElementById("openUploadBtn").addEventListener("click", () => openUploadModal());

function openUploadModal(resource = null) {
  const isEdit = !!resource;
  if (allModules.length === 0) {
    toast("You have no modules assigned yet. Ask an administrator to assign you.", "error");
    return;
  }
  showModal(isEdit ? "Edit resource" : "Upload resource", `
    <form id="resourceForm" novalidate>
      <div class="form-field">
        <label>Title</label>
        <input type="text" id="resTitle" required value="${escapeHtml(resource?.title || "")}">
      </div>
      <div class="form-field">
        <label>Description</label>
        <textarea id="resDesc" rows="3" style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-md);font-family:inherit;resize:vertical;">${escapeHtml(resource?.description || "")}</textarea>
      </div>
      <div class="form-field">
        <label>Module</label>
        <select id="resModule" class="select" style="width:100%;">${moduleOptions(resource?.moduleId)}</select>
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="resCategory" class="select" style="width:100%;">${categoryOptions(resource?.category)}</select>
      </div>
      ${isEdit ? `
        <div class="form-field">
          <label>Replace file (optional)</label>
          <input type="file" id="resFile" accept=".pdf,.ppt,.pptx,.doc,.docx,.txt">
          <p class="field-hint">Current: ${escapeHtml(resource.fileName || "")}. Leave empty to keep.</p>
        </div>
      ` : `
        <div class="form-field">
          <label>File</label>
          <input type="file" id="resFile" required accept=".pdf,.ppt,.pptx,.doc,.docx,.txt">
          <p class="field-hint">PDF, PowerPoint, Word or TXT · max ${Math.round(R2_CONFIG.maxFileSizeBytes / 1024 / 1024)} MB.</p>
        </div>
      `}
      <div id="uploadProgressWrap" class="hidden" style="margin-bottom:16px;">
        <div style="background:var(--grey);border-radius:999px;height:8px;overflow:hidden;">
          <div id="uploadProgressBar" style="height:100%;width:0%;background:var(--navy);transition:width .2s;"></div>
        </div>
        <p style="font-size:.8rem;color:var(--text-muted);margin:6px 0 0;" id="uploadProgressLabel">Uploading…</p>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
        <button type="button" class="btn btn-secondary" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="modalSubmit">
          <i data-lucide="${isEdit ? "save" : "upload"}"></i> ${isEdit ? "Save changes" : "Upload & publish"}
        </button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();

  document.getElementById("modalCancel").addEventListener("click", closeModal);
  document.getElementById("resourceForm").addEventListener("submit", (e) => submitResource(e, resource));
}

async function submitResource(e, existing) {
  e.preventDefault();
  const title = document.getElementById("resTitle").value.trim();
  const description = document.getElementById("resDesc").value.trim();
  const moduleId = document.getElementById("resModule").value;
  const category = document.getElementById("resCategory").value;
  const fileInput = document.getElementById("resFile");
  const file = fileInput?.files?.[0] || null;
  const submitBtn = document.getElementById("modalSubmit");

  if (!title) { toast("Please enter a title.", "error"); return; }
  if (!moduleId) { toast("Please select a module.", "error"); return; }
  if (!existing && !file) { toast("Please choose a file to upload.", "error"); return; }

  setBusy(submitBtn, true, existing ? "Saving…" : "Uploading…");

  try {
    let fileMeta = null;
    if (file) {
      const wrap = document.getElementById("uploadProgressWrap");
      const bar = document.getElementById("uploadProgressBar");
      const label = document.getElementById("uploadProgressLabel");
      wrap?.classList.remove("hidden");

      fileMeta = await uploadFileToR2(file, moduleId, (pct) => {
        bar.style.width = pct + "%";
        label.textContent = pct < 100 ? `Uploading… ${pct}%` : "Finalising…";
      });
    }

    if (existing) {
      const patch = { title, description, moduleId, category };
      if (fileMeta) {
        patch.fileName = file.name;
        patch.fileType = file.type;
        patch.fileSize = fileMeta.size;
        patch.storageKey = fileMeta.key;
      }
      await update(ref(db, `resources/${existing._id}`), patch);
      toast("Resource updated.", "success");
    } else {
      const id = push(ref(db, "resources")).key;
      await set(ref(db, `resources/${id}`), {
        title, description, moduleId, category,
        fileName: file.name,
        fileType: file.type,
        fileSize: fileMeta.size,
        storageKey: fileMeta.key,
        lecturerId: profile.uid,
        lecturerName: profile.fullName || "",
        uploadedAt: serverTimestamp(),
        downloadCount: 0,
        status: "active"
      });

      await notifyAllStudents({
        title: "New resource uploaded",
        message: `${category}: "${title}" is now available.`,
        type: "resource"
      });

      toast("Resource uploaded and published.", "success");
    }

    closeModal();
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    console.error(err);
    toast(err.message || "Something went wrong.", "error");
    setBusy(submitBtn, false);
  }
}

function openEditModal(resource) {
  if (!resource) return;
  openUploadModal(resource);
}

async function deleteResource(id) {
  if (!confirm("Delete this resource? This cannot be undone.")) return;
  try {
    await update(ref(db, `resources/${id}`), { status: "hidden" });
    toast("Resource removed from student view.", "success");
    setTimeout(() => window.location.reload(), 400);
  } catch (err) {
    toast("Could not delete resource.", "error");
  }
}

// ── Announcement modal ──────────────────────────────────────
document.getElementById("openAnnounceBtn").addEventListener("click", () => {
  if (allModules.length === 0) {
    toast("You have no modules assigned yet.", "error");
    return;
  }
  showModal("Publish announcement", `
    <form id="annForm">
      <div class="form-field">
        <label>Title</label>
        <input type="text" id="annTitle" required>
      </div>
      <div class="form-field">
        <label>Message</label>
        <textarea id="annMsg" rows="4" required style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-md);font-family:inherit;"></textarea>
      </div>
      <div class="form-field">
        <label>Module</label>
        <select id="annModule" class="select" style="width:100%;">${moduleOptions()}</select>
      </div>
      <div class="form-field">
        <label>Priority</label>
        <select id="annPriority" class="select" style="width:100%;">
          <option value="normal">Normal</option>
          <option value="important">Important</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="modalSubmit"><i data-lucide="send"></i> Publish</button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
  document.getElementById("modalCancel").addEventListener("click", closeModal);

  document.getElementById("annForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("annTitle").value.trim();
    const message = document.getElementById("annMsg").value.trim();
    const moduleId = document.getElementById("annModule").value;
    const priority = document.getElementById("annPriority").value;
    const btn = document.getElementById("modalSubmit");
    if (!title || !message) { toast("Title and message are required.", "error"); return; }
    if (!moduleId) { toast("Please select a module.", "error"); return; }

    setBusy(btn, true, "Publishing…");
    try {
      const id = push(ref(db, "announcements")).key;
      await set(ref(db, `announcements/${id}`), {
        title, message, priority, moduleId,
        lecturerId: profile.uid,
        lecturerName: profile.fullName || "",
        publishedAt: serverTimestamp()
      });
      await notifyAllStudents({
        title: priority === "urgent" ? "Urgent announcement" : "New announcement",
        message: title,
        type: "announcement"
      });
      toast("Announcement published.", "success");
      closeModal();
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      toast(err.message || "Could not publish.", "error");
      setBusy(btn, false);
    }
  });
});

// ── Scope modal ─────────────────────────────────────────────
document.getElementById("openScopeBtn").addEventListener("click", () => {
  if (allModules.length === 0) {
    toast("You have no modules assigned yet.", "error");
    return;
  }
  showModal("Publish exam scope", `
    <p class="text-muted" style="margin-top:0;font-size:.88rem;">
      Upload a PDF or write a scope document. The file will be categorised as <strong>Text in Scope</strong>.
    </p>
    <form id="scopeForm">
      <div class="form-field">
        <label>Title</label>
        <input type="text" id="scopeTitle" required placeholder="e.g. Test 1 scope — Chapters 1–4">
      </div>
      <div class="form-field">
        <label>Description</label>
        <textarea id="scopeDesc" rows="3" style="width:100%;padding:12px 14px;border:1px solid var(--border);border-radius:var(--radius-md);font-family:inherit;"></textarea>
      </div>
      <div class="form-field">
        <label>Module</label>
        <select id="scopeModule" class="select" style="width:100%;">${moduleOptions()}</select>
      </div>
      <div class="form-field">
        <label>Scope PDF</label>
        <input type="file" id="scopeFile" required accept=".pdf,.doc,.docx,.txt">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn btn-secondary" id="modalCancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="modalSubmit"><i data-lucide="upload"></i> Publish scope</button>
      </div>
    </form>
  `);
  if (window.lucide) lucide.createIcons();
  document.getElementById("modalCancel").addEventListener("click", closeModal);

  document.getElementById("scopeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("scopeTitle").value.trim();
    const description = document.getElementById("scopeDesc").value.trim();
    const moduleId = document.getElementById("scopeModule").value;
    const file = document.getElementById("scopeFile").files[0];
    const btn = document.getElementById("modalSubmit");
    if (!title || !file) { toast("Title and file are required.", "error"); return; }
    if (!moduleId) { toast("Please select a module.", "error"); return; }

    setBusy(btn, true, "Uploading…");
    try {
      const meta = await uploadFileToR2(file, moduleId);
      const id = push(ref(db, "resources")).key;
      await set(ref(db, `resources/${id}`), {
        title, description, moduleId,
        category: "Text in Scope",
        fileName: file.name,
        fileType: file.type,
        fileSize: meta.size,
        storageKey: meta.key,
        lecturerId: profile.uid,
        lecturerName: profile.fullName || "",
        uploadedAt: serverTimestamp(),
        downloadCount: 0,
        status: "active"
      });
      await notifyAllStudents({
        title: "Exam scope updated",
        message: `"${title}" is now available.`,
        type: "scope"
      });
      toast("Scope published.", "success");
      closeModal();
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      toast(err.message || "Could not publish scope.", "error");
      setBusy(btn, false);
    }
  });
});

// ────────────────────────────────────────────────────────────
// Notifications helper
// ────────────────────────────────────────────────────────────
async function notifyAllStudents({ title, message, type }) {
  const studentList = students.filter((s) => s.accountStatus === "active");
  if (studentList.length === 0) return;
  const updates = {};
  const now = Date.now();
  studentList.forEach((s) => {
    const nid = push(ref(db, `notifications/${s._id}`)).key;
    updates[`notifications/${s._id}/${nid}`] = {
      title, message, type, isRead: false, createdAt: now
    };
  });
  try {
    await update(ref(db, "/"), updates);
  } catch (err) {
    console.warn("Could not send notifications:", err);
  }
}

// ────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────
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
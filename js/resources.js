// js/resources.js
// Shared resource helpers: upload to / download from R2 via Worker,
// render resource cards, filter, category tabs.

import { db } from "./firebase-init.js";
import { ref, push, set, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { R2_CONFIG } from "./r2-config.js";
import { escapeHtml, formatDate, toast } from "./utils.js";

export const CATEGORIES = [
  "Lecture Notes",
  "PowerPoint Presentations",
  "Study Guides",
  "Text in Scope",
  "Assignments",
  "Examination Preparation",
  "Additional Resources"
];

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
];

// ────────────────────────────────────────────────────────────
// Worker interactions
// ────────────────────────────────────────────────────────────
async function requestSignedUrl(payload) {
  const res = await fetch(R2_CONFIG.workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    throw new Error(data.error || `Worker error (${res.status})`);
  }
  return data.url;
}

export function sanitizeFileName(name) {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "file";
}

export function buildResourceKey(moduleId, fileName) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `module-resources/${moduleId}/${ts}-${rand}-${sanitizeFileName(fileName)}`;
}

/**
 * Validates and uploads a File to R2 via presigned PUT.
 * Returns the R2 key that was used (to store in the resource metadata).
 */
export async function uploadFileToR2(file, moduleId, onProgress) {
  if (!file) throw new Error("No file selected.");
  if (file.size > R2_CONFIG.maxFileSizeBytes) {
    throw new Error(`File is larger than the ${Math.round(R2_CONFIG.maxFileSizeBytes / 1024 / 1024)} MB limit.`);
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error("Unsupported file type. Please upload PDF, PowerPoint, Word or TXT.");
  }

  const key = buildResourceKey(moduleId, file.name);
  const signedUrl = await requestSignedUrl({
    action: "upload",
    key,
    fileType: file.type
  });

  // Upload directly to R2 using fetch with progress (via XMLHttpRequest for progress support)
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}). Check R2 CORS policy.`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Check R2 CORS policy."));
    xhr.send(file);
  });

  return { key, size: file.size, mimeType: file.type };
}

export async function downloadFromR2(resource, profile) {
  try {
    const signedUrl = await requestSignedUrl({
      action: "download",
      key: resource.storageKey
    });

    // Kick off the download via a temporary anchor (works cross-origin)
    const a = document.createElement("a");
    a.href = signedUrl;
    a.rel = "noopener";
    a.download = resource.fileName || "resource";
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Best-effort download log (fire-and-forget)
    if (profile?.uid) {
      try {
        const id = push(ref(db, "downloads")).key;
        await set(ref(db, `downloads/${id}`), {
          userId: profile.uid,
          resourceId: resource._id || resource.resourceId,
          moduleId: resource.moduleId,
          downloadedAt: serverTimestamp()
        });
      } catch (e) { console.warn("Download log failed:", e); }
    }

    toast("Download started.", "success", 2500);
  } catch (err) {
    console.error(err);
    toast(err.message || "Download failed.", "error");
  }
}

// ────────────────────────────────────────────────────────────
// Rendering helpers
// ────────────────────────────────────────────────────────────
export function iconClassFor(fileType = "") {
  const t = (fileType || "").toLowerCase();
  if (t.includes("pdf")) return "pdf";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "pptx";
  if (t.includes("word") || t.includes("doc")) return "doc";
  return "other";
}

export function typeLabel(fileType = "") {
  const t = (fileType || "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "PPTX";
  if (t.includes("word") || t.includes("doc")) return "DOC";
  return "FILE";
}

export function renderResourceCard(r, opts = {}) {
  const { showModule = false, moduleLabel = "" } = opts;
  const isPdf = (r.fileType || "").toLowerCase().includes("pdf");
  return `
    <article class="resource-card" data-resource-id="${escapeHtml(r._id || r.resourceId || "")}">
      <div class="resource-card__icon ${iconClassFor(r.fileType)}">${typeLabel(r.fileType)}</div>
      <div class="resource-card__body">
        <h3 class="resource-card__title">${escapeHtml(r.title || "Untitled")}</h3>
        ${r.description ? `<p class="resource-card__desc">${escapeHtml(r.description)}</p>` : ""}
        <div class="resource-card__meta">
          ${showModule && moduleLabel ? `<span><i data-lucide="book"></i>${escapeHtml(moduleLabel)}</span>` : ""}
          <span><i data-lucide="folder"></i>${escapeHtml(r.category || "General")}</span>
          <span><i data-lucide="clock"></i>${formatDate(r.uploadedAt)}</span>
          ${r.lecturerName ? `<span><i data-lucide="user"></i>${escapeHtml(r.lecturerName)}</span>` : ""}
          ${r.downloadCount ? `<span><i data-lucide="download"></i>${r.downloadCount}</span>` : ""}
        </div>
      </div>
      <div class="resource-card__actions">
        ${isPdf ? `<button class="btn btn-secondary btn-sm" data-preview="${escapeHtml(r._id || r.resourceId)}">
          <i data-lucide="eye"></i> Preview</button>` : ""}
        <button class="btn btn-primary btn-sm" data-download="${escapeHtml(r._id || r.resourceId)}">
          <i data-lucide="download"></i> Download
        </button>
      </div>
    </article>`;
}

export function attachResourceHandlers(container, resources, profile) {
  const byId = new Map(resources.map((r) => [String(r._id || r.resourceId), r]));

  container.querySelectorAll("[data-download]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const r = byId.get(btn.dataset.download);
      if (!r) return;
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner" style="border-color:rgba(255,255,255,.4);border-top-color:#fff;"></span> Preparing…`;
      try {
        await downloadFromR2(r, profile);
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
        if (window.lucide) lucide.createIcons();
      }
    });
  });

  container.querySelectorAll("[data-preview]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const r = byId.get(btn.dataset.preview);
      if (!r) return;
      try {
        const url = await requestSignedUrl({ action: "download", key: r.storageKey });
        window.open(url, "_blank", "noopener");
      } catch (err) {
        toast(err.message || "Could not open preview.", "error");
      }
    });
  });
}

export function categoryTabs(activeCategory, allCategory = "All") {
  const cats = [allCategory, ...CATEGORIES];
  return cats.map((c) =>
    `<button class="tab${c === activeCategory ? " is-active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join("");
}

export function filterResources(resources, { query = "", category = "All", moduleId = "" } = {}) {
  const q = query.trim().toLowerCase();
  return resources.filter((r) => {
    if (category !== "All" && r.category !== category) return false;
    if (moduleId && r.moduleId !== moduleId) return false;
    if (!q) return true;
    const haystack = `${r.title || ""} ${r.description || ""} ${r.fileName || ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
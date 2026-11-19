// js/notifications.js
import { db } from "./firebase-init.js";
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { requireAuth } from "./guards.js";
import { mountLayout } from "./navigation.js";
import { escapeHtml, timeAgo, toast } from "./utils.js";

const { profile } = await requireAuth({ role: "student" });
const { main } = mountLayout({
  active: "notifications",
  profile,
  title: "Notifications",
  subtitle: "Your activity feed"
});

main.innerHTML = `
  <section class="page-section">
    <div class="section-head">
      <div>
        <h2>Inbox</h2>
        <p>You'll be notified about new notes, announcements and exam scopes.</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="markAllBtn">
        <i data-lucide="check-check"></i> Mark all as read
      </button>
    </div>
    <div class="notif-list" id="notifList">
      <div class="skeleton skeleton-card"></div>
    </div>
  </section>`;

if (window.lucide) lucide.createIcons();

const notifRef = ref(db, `notifications/${profile.uid}`);
let latestData = {};

onValue(notifRef, (snap) => {
  latestData = snap.val() || {};
  render();
}, (err) => {
  console.error(err);
  document.getElementById("notifList").innerHTML = `
    <div class="empty-state">
      <i data-lucide="alert-circle"></i>
      <h3>Could not load notifications</h3>
      <p>${escapeHtml(err.message || "")}</p>
    </div>`;
  if (window.lucide) lucide.createIcons();
});

function render() {
  const items = Object.entries(latestData)
    .map(([id, v]) => ({ ...(v || {}), _id: id }))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const listEl = document.getElementById("notifList");
  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i data-lucide="bell-off"></i>
        <h3>No notifications yet</h3>
        <p>When new materials are uploaded or announcements are posted, you'll see them here.</p>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  listEl.innerHTML = items.map((n) => `
    <div class="notif-item${n.isRead ? "" : " is-unread"}">
      <div class="notif-item__icon"><i data-lucide="${iconForType(n.type)}"></i></div>
      <div class="notif-item__body">
        <h3 class="notif-item__title">${escapeHtml(n.title || "Notification")}</h3>
        <p class="notif-item__message">${escapeHtml(n.message || "")}</p>
        <div class="notif-item__time">${timeAgo(n.createdAt)}</div>
      </div>
      ${n.isRead ? "" : `<div class="notif-item__actions">
        <button class="btn btn-ghost btn-sm" data-read="${n._id}">Mark read</button>
      </div>`}
    </div>`).join("");

  listEl.querySelectorAll("[data-read]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await update(ref(db, `notifications/${profile.uid}/${btn.dataset.read}`), { isRead: true });
      } catch (err) {
        toast("Could not mark notification.", "error");
      }
    });
  });

  if (window.lucide) lucide.createIcons();
}

document.getElementById("markAllBtn").addEventListener("click", async () => {
  const unread = Object.entries(latestData).filter(([, v]) => v && !v.isRead);
  if (unread.length === 0) { toast("Nothing to mark.", "info"); return; }
  try {
    await Promise.all(unread.map(([id]) =>
      update(ref(db, `notifications/${profile.uid}/${id}`), { isRead: true })
    ));
    toast("All notifications marked as read.", "success");
  } catch (err) {
    toast("Could not update notifications.", "error");
  }
});

function iconForType(type = "") {
  const t = (type || "").toLowerCase();
  if (t.includes("announce")) return "megaphone";
  if (t.includes("scope")) return "file-search";
  if (t.includes("resource") || t.includes("material") || t.includes("note")) return "folder-open";
  return "bell";
}
// js/navigation.js
// Builds the app shell (sidebar + topbar) for each page,
// wires mobile menu, logout, and the notification bell.

import { db, auth } from "./firebase-init.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { logout } from "./auth.js";
import { escapeHtml } from "./utils.js";

const NAV = {
  student: [
    { key: "dashboard", label: "Dashboard", href: "student-dashboard.html", icon: "layout-dashboard" },
    { key: "modules", label: "My Modules", href: "student-dashboard.html#modules", icon: "book-open" },
    { key: "resources", label: "Study Materials", href: "resources.html", icon: "folder-open" },
    { key: "announcements", label: "Announcements", href: "announcements.html", icon: "megaphone" },
    { key: "scope", label: "Text in Scope", href: "text-in-scope.html", icon: "file-search" },
    { key: "notifications", label: "Notifications", href: "notifications.html", icon: "bell" },
    { key: "profile", label: "My Profile", href: "profile.html", icon: "user-circle" }
  ],
  lecturer: [
  { key: "dashboard", label: "Dashboard", href: "lecturer-dashboard.html", icon: "layout-dashboard" },
  { key: "profile", label: "My Profile", href: "profile.html", icon: "user-circle" }
],
  admin: [
    { key: "dashboard", label: "Dashboard", href: "admin-dashboard.html", icon: "layout-dashboard" },
    { key: "profile", label: "My Profile", href: "profile.html", icon: "user-circle" }
  ]
};

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

/**
 * Injects the full app shell into #appRoot and returns handles.
 * @param {object} opts
 * @param {string} opts.active   - nav key to highlight
 * @param {object} opts.profile  - { uid, fullName, studentNumber, role, ... }
 * @param {string} [opts.title]  - topbar title
 * @param {string} [opts.subtitle] - topbar subtitle
 */
export function mountLayout({ active, profile, title = "", subtitle = "" }) {
  const root = document.getElementById("appRoot");
  if (!root) throw new Error("Missing #appRoot container in the page.");

  const items = NAV[profile.role] || [];
  const navHtml = items.map((item) => `
    <a class="sidebar__link${item.key === active ? " is-active" : ""}"
       href="${item.href}">
      <i data-lucide="${item.icon}"></i><span>${escapeHtml(item.label)}</span>
    </a>`).join("");

  const userLabel = profile.studentNumber
    ? `Student • ${escapeHtml(profile.studentNumber)}`
    : escapeHtml(profile.role || "");

  root.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="appSidebar">
        <div class="sidebar__brand">
          <div class="sidebar__mark">UMP</div>
          <div class="sidebar__brand-text">
            BICT Platform
            <small>Learning &amp; Resources</small>
          </div>
        </div>

        <nav class="sidebar__nav">
          ${navHtml}
        </nav>

        <div class="sidebar__footer">
          <div class="sidebar__user">
            <div class="sidebar__user-avatar">${escapeHtml(initials(profile.fullName))}</div>
            <div class="sidebar__user-meta">
              <div class="sidebar__user-name">${escapeHtml(profile.fullName || "User")}</div>
              <div class="sidebar__user-sub">${userLabel}</div>
            </div>
          </div>
          <button class="btn btn-ghost btn-block sidebar__logout" id="logoutBtn">
            <i data-lucide="log-out"></i><span>Log out</span>
          </button>
        </div>
      </aside>

      <div class="sidebar-overlay" id="sidebarOverlay"></div>

      <div class="app-main">
        <header class="topbar">
          <button class="topbar__toggle" id="sidebarToggle" aria-label="Open menu">
            <i data-lucide="menu"></i>
          </button>
          <div class="topbar__titles">
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
          </div>
          <div class="topbar__actions">
            <a href="notifications.html" class="notif-bell" aria-label="Notifications">
              <i data-lucide="bell"></i>
              <span class="notif-badge hidden" id="notifBadge">0</span>
            </a>
          </div>
        </header>
        <main class="page" id="pageContent"></main>
      </div>
    </div>
  `;

  // Icons
  if (window.lucide) lucide.createIcons();

  // Mobile sidebar
  const sidebar = document.getElementById("appSidebar");
  const overlay = document.getElementById("sidebarOverlay");
  const toggle = document.getElementById("sidebarToggle");
  const close = () => { sidebar.classList.remove("is-open"); overlay.classList.remove("is-open"); };
  toggle?.addEventListener("click", () => {
    sidebar.classList.add("is-open");
    overlay.classList.add("is-open");
  });
  overlay?.addEventListener("click", close);

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", () => logout());

  // Live notification count
  watchNotificationCount(profile.uid);

  return {
    main: document.getElementById("pageContent"),
    closeSidebar: close
  };
}

function watchNotificationCount(uid) {
  const badge = document.getElementById("notifBadge");
  if (!badge) return;
  onValue(ref(db, `notifications/${uid}`), (snap) => {
    const data = snap.val() || {};
    const unread = Object.values(data).filter((n) => n && !n.isRead).length;
    if (unread > 0) {
      badge.textContent = unread > 99 ? "99+" : String(unread);
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }, (err) => console.warn("Notification count error:", err));
}

export { initials };
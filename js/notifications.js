"use strict";

/*
========================================
SMART WORK NETWORK
AUTOMATED NOTIFICATIONS
========================================

Works with:
- Customer
- Worker
- Admin

Features:
- Notification bell
- Unread count
- Notification dropdown
- Booking notifications
- Work updates
- Payment success/failure/refund
- Admin notifications
- Mark one as read
- Mark all as read
- Auto refresh
========================================
*/

(function () {
  const REFRESH_INTERVAL = 30000;
  const MAX_NOTIFICATIONS = 50;

  let refreshTimer = null;
  let notificationRoot = null;
  let notifications = [];

  function escape(value = "") {
    if (
      typeof window.escapeHtml === "function"
    ) {
      return window.escapeHtml(value);
    }

    const div =
      document.createElement("div");

    div.textContent = String(value);

    return div.innerHTML;
  }

  function getApi() {
    if (
      window.SWN &&
      typeof window.SWN.request === "function"
    ) {
      return window.SWN;
    }

    return null;
  }

  function getCurrentUser() {
    if (
      window.SWN &&
      typeof window.SWN.user === "function"
    ) {
      return window.SWN.user();
    }

    if (
      typeof window.getCurrentUser ===
      "function"
    ) {
      return window.getCurrentUser();
    }

    try {
      const value =
        localStorage.getItem("swn_user");

      return value
        ? JSON.parse(value)
        : null;
    } catch {
      return null;
    }
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    ).format(date);
  }

  function notificationIcon(type) {
    switch (type) {
      case "booking_created":
        return "📋";

      case "booking_accepted":
        return "✅";

      case "booking_rejected":
        return "❌";

      case "booking_confirmed":
        return "📅";

      case "booking_cancelled":
        return "🚫";

      case "work_started":
        return "🔨";

      case "work_completed":
        return "🎉";

      case "payment_success":
        return "💳";

      case "payment_failure":
        return "⚠️";

      case "payment_refunded":
        return "↩️";

      case "admin_update":
        return "🛡️";

      default:
        return "🔔";
    }
  }

  function createStyles() {
    if (
      document.getElementById(
        "swnNotificationStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id =
      "swnNotificationStyles";

    style.textContent = `
      .swn-notification-wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .swn-notification-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        padding: 0;
        border: 1px solid rgba(0,0,0,.10);
        border-radius: 50%;
        background: #fff;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
      }

      .swn-notification-button:hover {
        transform: translateY(-1px);
      }

      .swn-notification-badge {
        position: absolute;
        top: -4px;
        right: -3px;
        min-width: 19px;
        height: 19px;
        padding: 0 5px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        background: #d93025;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        border: 2px solid #fff;
      }

      .swn-notification-panel {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: min(390px, calc(100vw - 24px));
        max-height: 560px;
        overflow: hidden;
        z-index: 9999;
        background: #fff;
        border: 1px solid rgba(0,0,0,.12);
        border-radius: 14px;
        box-shadow: 0 14px 40px rgba(0,0,0,.16);
      }

      .swn-notification-panel[hidden] {
        display: none;
      }

      .swn-notification-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(0,0,0,.08);
      }

      .swn-notification-title {
        margin: 0;
        font-size: 17px;
        font-weight: 700;
      }

      .swn-notification-actions {
        display: flex;
        gap: 6px;
      }

      .swn-notification-action {
        border: 0;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        padding: 5px 7px;
        border-radius: 6px;
      }

      .swn-notification-action:hover {
        background: rgba(0,0,0,.06);
      }

      .swn-notification-list {
        max-height: 480px;
        overflow-y: auto;
      }

      .swn-notification-item {
        display: grid;
        grid-template-columns: 38px 1fr;
        gap: 10px;
        padding: 13px 15px;
        border-bottom: 1px solid rgba(0,0,0,.06);
        cursor: pointer;
      }

      .swn-notification-item:hover {
        background: rgba(0,0,0,.035);
      }

      .swn-notification-item.unread {
        background: rgba(25,118,210,.055);
      }

      .swn-notification-icon {
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        background: rgba(0,0,0,.055);
        font-size: 18px;
      }

      .swn-notification-content {
        min-width: 0;
      }

      .swn-notification-item-title {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .swn-notification-message {
        font-size: 13px;
        line-height: 1.45;
        opacity: .82;
      }

      .swn-notification-date {
        margin-top: 6px;
        font-size: 11px;
        opacity: .58;
      }

      .swn-notification-empty,
      .swn-notification-loading,
      .swn-notification-error {
        padding: 24px 18px;
        text-align: center;
        font-size: 13px;
        opacity: .72;
      }

      .swn-notification-error {
        color: #a51d2d;
        opacity: 1;
      }

      @media (max-width: 600px) {
        .swn-notification-panel {
          position: fixed;
          top: 70px;
          right: 12px;
          width: calc(100vw - 24px);
          max-height: calc(100vh - 90px);
        }

        .swn-notification-list {
          max-height: calc(100vh - 150px);
        }
      }
    `;

    document.head.appendChild(style);
  }

  function findNavTarget() {
    return (
      document.querySelector(
        ".navlinks"
      ) ||
      document.querySelector(
        "header nav"
      ) ||
      document.querySelector(
        "nav"
      )
    );
  }

  function createNotificationUI() {
    if (
      document.getElementById(
        "swnNotificationRoot"
      )
    ) {
      notificationRoot =
        document.getElementById(
          "swnNotificationRoot"
        );

      return;
    }

    const nav =
      findNavTarget();

    if (!nav) {
      return;
    }

    const wrapper =
      document.createElement("span");

    wrapper.className =
      "swn-notification-wrap";

    wrapper.id =
      "swnNotificationRoot";

    wrapper.innerHTML = `
      <button
        type="button"
        class="swn-notification-button"
        id="swnNotificationButton"
        aria-label="Notifications"
        aria-expanded="false"
        title="Notifications"
      >
        🔔
        <span
          class="swn-notification-badge"
          id="swnNotificationBadge"
          hidden
        ></span>
      </button>

      <div
        class="swn-notification-panel"
        id="swnNotificationPanel"
        hidden
      >
        <div class="swn-notification-header">
          <h3 class="swn-notification-title">
            Notifications
          </h3>

          <div class="swn-notification-actions">
            <button
              type="button"
              class="swn-notification-action"
              id="swnMarkAllRead"
            >
              Mark all read
            </button>
          </div>
        </div>

        <div
          class="swn-notification-list"
          id="swnNotificationList"
        >
          <div class="swn-notification-loading">
            Loading notifications...
          </div>
        </div>
      </div>
    `;

    nav.appendChild(wrapper);

    notificationRoot =
      wrapper;

    const button =
      document.getElementById(
        "swnNotificationButton"
      );

    const panel =
      document.getElementById(
        "swnNotificationPanel"
      );

    const markAll =
      document.getElementById(
        "swnMarkAllRead"
      );

    button.addEventListener(
      "click",
      async function (event) {
        event.stopPropagation();

        const willOpen =
          panel.hidden;

        panel.hidden =
          !willOpen;

        button.setAttribute(
          "aria-expanded",
          String(willOpen)
        );

        if (willOpen) {
          await loadNotifications();
        }
      }
    );

    markAll.addEventListener(
      "click",
      async function (event) {
        event.stopPropagation();

        await markAllNotificationsRead();
      }
    );

    document.addEventListener(
      "click",
      function (event) {
        if (
          notificationRoot &&
          !notificationRoot.contains(
            event.target
          )
        ) {
          panel.hidden = true;

          button.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }
    );
  }

  function renderBadge(unreadCount) {
    const badge =
      document.getElementById(
        "swnNotificationBadge"
      );

    if (!badge) {
      return;
    }

    const count =
      Number(unreadCount) || 0;

    if (count <= 0) {
      badge.hidden = true;
      badge.textContent = "";
      return;
    }

    badge.hidden = false;

    badge.textContent =
      count > 99
        ? "99+"
        : String(count);
  }

  function renderNotifications() {
    const list =
      document.getElementById(
        "swnNotificationList"
      );

    if (!list) {
      return;
    }

    if (!notifications.length) {
      list.innerHTML = `
        <div class="swn-notification-empty">
          No notifications yet.
        </div>
      `;

      return;
    }

    list.innerHTML =
      notifications
        .slice(
          0,
          MAX_NOTIFICATIONS
        )
        .map(
          notification => {
            const id =
              escape(
                notification?._id || ""
              );

            const type =
              notification?.type || "";

            const title =
              escape(
                notification?.title ||
                "Notification"
              );

            const message =
              escape(
                notification?.message ||
                ""
              );

            const date =
              escape(
                formatDate(
                  notification?.createdAt
                )
              );

            const unread =
              notification?.read !== true;

            return `
              <div
                class="
                  swn-notification-item
                  ${unread ? "unread" : ""}
                "
                data-notification-id="${id}"
              >
                <div
                  class="swn-notification-icon"
                  aria-hidden="true"
                >
                  ${notificationIcon(type)}
                </div>

                <div
                  class="swn-notification-content"
                >
                  <div
                    class="swn-notification-item-title"
                  >
                    ${title}
                  </div>

                  <div
                    class="swn-notification-message"
                  >
                    ${message}
                  </div>

                  <div
                    class="swn-notification-date"
                  >
                    ${date}
                  </div>
                </div>
              </div>
            `;
          }
        )
        .join("");

    list
      .querySelectorAll(
        "[data-notification-id]"
      )
      .forEach(
        item => {
          item.addEventListener(
            "click",
            async function () {
              const id =
                item.getAttribute(
                  "data-notification-id"
                );

              if (id) {
                await markNotificationRead(
                  id
                );
              }
            }
          );
        }
      );
  }

  async function loadNotifications() {
    const api =
      getApi();

    if (!api) {
      return;
    }

    const user =
      getCurrentUser();

    if (!user) {
      return;
    }

    const list =
      document.getElementById(
        "swnNotificationList"
      );

    if (list && !notifications.length) {
      list.innerHTML = `
        <div class="swn-notification-loading">
          Loading notifications...
        </div>
      `;
    }

    try {
      const result =
        await api.request(
          "/notifications?limit=50"
        );

      notifications =
        Array.isArray(
          result?.data
        )
          ? result.data
          : [];

      renderNotifications();

      renderBadge(
        result?.unreadCount || 0
      );
    } catch (error) {
      console.error(
        "LOAD NOTIFICATIONS ERROR:",
        error
      );

      if (list) {
        list.innerHTML = `
          <div class="swn-notification-error">
            Unable to load notifications.
          </div>
        `;
      }
    }
  }

  async function refreshUnreadCount() {
    const api =
      getApi();

    if (!api) {
      return;
    }

    const user =
      getCurrentUser();

    if (!user) {
      renderBadge(0);
      return;
    }

    try {
      const result =
        await api.request(
          "/notifications/unread-count"
        );

      renderBadge(
        result?.unreadCount || 0
      );
    } catch (error) {
      console.error(
        "REFRESH NOTIFICATION COUNT ERROR:",
        error
      );
    }
  }

  async function markNotificationRead(
    notificationId
  ) {
    const api =
      getApi();

    if (!api || !notificationId) {
      return;
    }

    try {
      await api.request(
        `/notifications/${encodeURIComponent(
          notificationId
        )}/read`,
        {
          method: "PATCH"
        }
      );

      const notification =
        notifications.find(
          item =>
            String(item?._id) ===
            String(notificationId)
        );

      if (notification) {
        notification.read = true;
        notification.readAt =
          new Date().toISOString();
      }

      renderNotifications();

      await refreshUnreadCount();
    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ ERROR:",
        error
      );
    }
  }

  async function markAllNotificationsRead() {
    const api =
      getApi();

    if (!api) {
      return;
    }

    try {
      await api.request(
        "/notifications/read-all",
        {
          method: "PATCH"
        }
      );

      notifications =
        notifications.map(
          notification => ({
            ...notification,
            read: true,
            readAt:
              new Date().toISOString()
          })
        );

      renderNotifications();

      renderBadge(0);
    } catch (error) {
      console.error(
        "MARK ALL NOTIFICATIONS READ ERROR:",
        error
      );
    }
  }

  function startAutoRefresh() {
    if (refreshTimer) {
      clearInterval(
        refreshTimer
      );
    }

    refreshTimer =
      window.setInterval(
        async function () {
          await refreshUnreadCount();

          const panel =
            document.getElementById(
              "swnNotificationPanel"
            );

          if (
            panel &&
            !panel.hidden
          ) {
            await loadNotifications();
          }
        },
        REFRESH_INTERVAL
      );
  }

  async function init() {
    const user =
      getCurrentUser();

    if (!user) {
      return;
    }

    createStyles();

    createNotificationUI();

    if (!notificationRoot) {
      return;
    }

    await refreshUnreadCount();

    startAutoRefresh();
  }

  window.SWNNotifications = {
    init,
    load: loadNotifications,
    refreshCount:
      refreshUnreadCount,
    markRead:
      markNotificationRead,
    markAllRead:
      markAllNotificationsRead
  };

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      window.setTimeout(
        init,
        0
      );
    }
  );
})();

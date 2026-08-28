const SWN_CONFIG = {
  // Live backend deploy होने के बाद केवल यह URL बदलना होगा.
  // Example: https://your-backend.onrender.com/api
  API_URL:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000/api"
      : ""
};

const SWN = {
  apiUrl() {
    return SWN_CONFIG.API_URL;
  },

  api(path = "") {
    const base = SWN_CONFIG.API_URL.replace(/\/$/, "");
    const endpoint = path.startsWith("/") ? path : `/${path}`;

    if (!base) {
      throw new Error(
        "Production API URL is not configured yet."
      );
    }

    return `${base}${endpoint}`;
  },

  get(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);

      return value
        ? JSON.parse(value)
        : defaultValue;
    } catch {
      return defaultValue;
    }
  },

  set(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  },

  user() {
    try {
      if (
        typeof window.getCurrentUser === "function"
      ) {
        return window.getCurrentUser();
      }

      const user = localStorage.getItem(
        "swn_user"
      );

      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  token() {
    if (
      typeof window.getAuthToken === "function"
    ) {
      return window.getAuthToken();
    }

    return localStorage.getItem("swn_token");
  },

  authHeaders(extraHeaders = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...extraHeaders
    };

    const token = this.token();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  },

  async request(path, options = {}) {
    const response = await fetch(
      this.api(path),
      {
        ...options,
        headers: this.authHeaders(
          options.headers || {}
        )
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        `Request failed with status ${response.status}`
      );
    }

    return data;
  },

  logout() {
    if (
      typeof window.logout === "function"
    ) {
      window.logout();
      return;
    }

    localStorage.removeItem("swn_token");
    localStorage.removeItem("swn_user");

    window.location.href = "login.html";
  },

  flash(message) {
    alert(message);
  }
};

function dashboardUrl(user) {
  if (!user) {
    return "login.html";
  }

  if (user.role === "admin") {
    return "admin.html";
  }

  if (user.role === "worker") {
    return "worker-dashboard.html";
  }

  return "customer-dashboard.html";
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function authBox() {
  const element =
    document.querySelector("[data-auth]");

  if (!element) return;

  const user = SWN.user();

  element.innerHTML = user
    ? `
      <span class="muted">
        Hi, ${escapeHtml(user.name || "User")}
      </span>

      <a href="${dashboardUrl(user)}">
        Dashboard
      </a>

      <button
        class="btn btn-primary"
        onclick="SWN.logout()"
      >
        Logout
      </button>
    `
    : `
      <a href="login.html">
        Login
      </a>

      <a
        class="btn btn-primary"
        href="signup.html"
      >
        Get Started
      </a>
    `;
}

function redirectToCorrectDashboard(user) {
  window.location.href = dashboardUrl(user);
}

function protect(role = null) {
  const user = SWN.user();
  const token = SWN.token();

  if (!user || !token) {
    window.location.href = "login.html";
    return null;
  }

  if (role && user.role !== role) {
    redirectToCorrectDashboard(user);
    return null;
  }

  return user;
}

async function verifyAuth() {
  const token = SWN.token();

  if (!token) {
    return null;
  }

  if (
    typeof window.refreshCurrentUser !== "function"
  ) {
    return SWN.user();
  }

  try {
    return await window.refreshCurrentUser();
  } catch (error) {
    console.error("Authentication verification failed:", error);

    localStorage.removeItem("swn_token");
    localStorage.removeItem("swn_user");

    return null;
  }
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    authBox();

    const token = SWN.token();

    if (token) {
      const user = await verifyAuth();

      if (user) {
        authBox();
      }
    }
  }
);

window.SWN_CONFIG = SWN_CONFIG;
window.SWN = SWN;
window.protect = protect;
window.verifyAuth = verifyAuth;
window.escapeHtml = escapeHtml;

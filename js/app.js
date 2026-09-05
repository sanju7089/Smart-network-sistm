"use strict";

/*
========================================
SMART WORK NETWORK
CENTRAL API CONFIGURATION
========================================

Development:
- localhost
- 127.0.0.1

Production:
- Render backend

All frontend API requests must go
through SWN.api(), SWN.raw() or
SWN.request().
*/

const isLocalhost =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(
    window.location.hostname
  );

const SWN_CONFIG = Object.freeze({
  API_URL: isLocalhost
    ? "http://localhost:3000/api"
    : "https://smart-network-sistm.onrender.com/api"
});

const SWN = {
  apiUrl() {
    return SWN_CONFIG.API_URL;
  },

  api(path = "") {
    const base =
      SWN_CONFIG.API_URL.replace(/\/$/, "");

    const cleanPath =
      String(path || "").trim();

    if (!cleanPath) {
      return base;
    }

    return `${base}${
      cleanPath.startsWith("/")
        ? cleanPath
        : `/${cleanPath}`
    }`;
  },

  get(key, defaultValue = null) {
    try {
      const value =
        localStorage.getItem(key);

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
        typeof window.getCurrentUser ===
        "function"
      ) {
        return window.getCurrentUser();
      }

      const value =
        localStorage.getItem(
          "swn_user"
        );

      return value
        ? JSON.parse(value)
        : null;
    } catch {
      return null;
    }
  },

  token() {
    if (
      typeof window.getAuthToken ===
      "function"
    ) {
      return window.getAuthToken();
    }

    return localStorage.getItem(
      "swn_token"
    );
  },

  clearAuth() {
    localStorage.removeItem(
      "swn_token"
    );

    localStorage.removeItem(
      "swn_user"
    );
  },

  authHeaders(
    extraHeaders = {},
    hasBody = false
  ) {
    const headers =
      new Headers(
        extraHeaders || {}
      );

    const token =
      this.token();

    if (
      hasBody &&
      !headers.has(
        "Content-Type"
      )
    ) {
      headers.set(
        "Content-Type",
        "application/json"
      );
    }

    if (
      token &&
      !headers.has(
        "Authorization"
      )
    ) {
      headers.set(
        "Authorization",
        `Bearer ${token}`
      );
    }

    headers.set(
      "Accept",
      "application/json"
    );

    return headers;
  },

  async raw(
    path,
    options = {}
  ) {
    const requestOptions = {
      ...options
    };

    const hasBody =
      requestOptions.body !==
        undefined &&
      requestOptions.body !==
        null;

    const isFormData =
      typeof FormData !==
        "undefined" &&
      requestOptions.body instanceof
        FormData;

    if (isFormData) {
      requestOptions.headers =
        new Headers(
          requestOptions.headers ||
            {}
        );

      requestOptions.headers.delete(
        "Content-Type"
      );
    }

    requestOptions.headers =
      this.authHeaders(
        requestOptions.headers ||
          {},
        hasBody && !isFormData
      );

    let response;

    try {
      response =
        await fetch(
          this.api(path),
          requestOptions
        );
    } catch (error) {
      const networkError =
        new Error(
          "Unable to connect to the server. Please check your internet connection and try again."
        );

      networkError.cause =
        error;

      throw networkError;
    }

    if (
      response.status === 401
    ) {
      this.clearAuth();
    }

    return response;
  },

  async parseResponse(
    response
  ) {
    if (!response) {
      return null;
    }

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      try {
        return await response.json();
      } catch {
        return null;
      }
    }

    try {
      const text =
        await response.text();

      return text
        ? {
            message: text
          }
        : null;
    } catch {
      return null;
    }
  },

  async request(
    path,
    options = {}
  ) {
    const response =
      await this.raw(
        path,
        options
      );

    const data =
      await this.parseResponse(
        response
      );

    if (!response.ok) {
      const error =
        new Error(
          data?.message ||
            data?.error ||
            `Request failed with status ${response.status}`
        );

      error.status =
        response.status;

      error.response =
        response;

      error.data =
        data;

      throw error;
    }

    return data;
  },

  logout() {
    if (
      typeof window.logout ===
        "function" &&
      window.logout !==
        this.logout
    ) {
      window.logout();
      return;
    }

    this.clearAuth();

    window.location.href =
      "login.html";
  },

  flash(message) {
    alert(
      String(
        message || ""
      )
    );
  }
};

function dashboardUrl(user) {
  if (!user) {
    return "login.html";
  }

  if (
    user.role ===
    "admin"
  ) {
    return "admin.html";
  }

  if (
    user.role ===
    "worker"
  ) {
    return "worker-dashboard.html";
  }

  return "customer-dashboard.html";
}

function escapeHtml(
  value = ""
) {
  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function authBox() {
  const element =
    document.querySelector(
      "[data-auth]"
    );

  if (!element) {
    return;
  }

  const user =
    SWN.user();

  if (user) {
    element.innerHTML = `
      <span class="muted">
        Hi, ${escapeHtml(
          user.name || "User"
        )}
      </span>

      <a href="${dashboardUrl(
        user
      )}">
        Dashboard
      </a>

      <button
        type="button"
        class="btn btn-primary"
        id="logoutButton"
      >
        Logout
      </button>
    `;

    const logoutButton =
      document.querySelector(
        "#logoutButton"
      );

    if (logoutButton) {
      logoutButton.addEventListener(
        "click",
        () => {
          SWN.logout();
        }
      );
    }

    return;
  }

  element.innerHTML = `
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

function redirectToCorrectDashboard(
  user
) {
  window.location.href =
    dashboardUrl(user);
}

function protect(
  role = null
) {
  const user =
    SWN.user();

  const token =
    SWN.token();

  if (!user || !token) {
    window.location.href =
      "login.html";

    return null;
  }

  if (
    role &&
    user.role !== role
  ) {
    redirectToCorrectDashboard(
      user
    );

    return null;
  }

  return user;
}

async function verifyAuth() {
  const token =
    SWN.token();

  if (!token) {
    return null;
  }

  if (
    typeof window.refreshCurrentUser !==
    "function"
  ) {
    return SWN.user();
  }

  try {
    return await window.refreshCurrentUser();
  } catch (error) {
    console.error(
      "Authentication verification failed:",
      error
    );

    SWN.clearAuth();

    return null;
  }
}

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    authBox();

    if (SWN.token()) {
      const user =
        await verifyAuth();

      if (user) {
        authBox();
      }
    }
  }
);

window.SWN_CONFIG =
  SWN_CONFIG;

window.SWN =
  SWN;

window.protect =
  protect;

window.verifyAuth =
  verifyAuth;

window.escapeHtml =
  escapeHtml;

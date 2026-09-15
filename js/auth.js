"use strict";

function showMessage(message) {
  if (
    window.SWN &&
    typeof SWN.flash ===
      "function"
  ) {
    SWN.flash(message);
  } else {
    alert(
      String(
        message || ""
      )
    );
  }
}

function getApiUrl(path) {
  if (
    !window.SWN ||
    typeof SWN.api !==
      "function"
  ) {
    throw new Error(
      "API configuration is not available."
    );
  }

  return SWN.api(path);
}

function saveAuth(user) {
  if (
    !user ||
    typeof user !==
      "object"
  ) {
    return null;
  }

  localStorage.setItem(
    "swn_user",
    JSON.stringify(user)
  );

  return user;
}

function clearLocalUser() {
  localStorage.removeItem(
    "swn_user"
  );
}

function setCurrentUser(user) {
  if (
    !user ||
    typeof user !==
      "object"
  ) {
    clearLocalUser();

    return null;
  }

  return saveAuth(user);
}

function redirectByRole(user) {
  if (!user) {
    window.location.href =
      "login.html";

    return;
  }

  if (
    user.role ===
    "admin"
  ) {
    window.location.href =
      "admin.html";

    return;
  }

  if (
    user.role ===
    "worker"
  ) {
    window.location.href =
      "worker-dashboard.html";

    return;
  }

  window.location.href =
    "customer-dashboard.html";
}

/* =========================================
   SIGNUP
========================================= */

async function signup() {
  try {
    const form =
      document.querySelector(
        "#signupForm"
      );

    if (!form) {
      showMessage(
        "Signup form not found."
      );

      return;
    }

    const data =
      Object.fromEntries(
        new FormData(form)
      );

    const name =
      String(
        data.name || ""
      ).trim();

    const email =
      String(
        data.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        data.password || ""
      );

    const role =
      String(
        data.role ||
          "customer"
      )
        .trim()
        .toLowerCase();

    const phone =
      String(
        data.phone || ""
      ).trim();

    const location =
      String(
        data.location || ""
      ).trim();

    if (
      !name ||
      !email ||
      !password
    ) {
      showMessage(
        "Name, email and password are required."
      );

      return;
    }

    const result =
      await SWN.request(
        "/auth/register",
        {
          method: "POST",

          body:
            JSON.stringify({
              name,
              email,
              password,
              role,
              phone,
              location
            })
        }
      );

    if (
      !result ||
      !result.success
    ) {
      showMessage(
        result?.message ||
          "Unable to create account."
      );

      return;
    }

    if (
      result.otpRequired
    ) {
      sessionStorage.setItem(
        "swn_pending_signup_email",
        email
      );

      window.location.href =
        `verify-otp.html?mode=signup&email=${encodeURIComponent(
          email
        )}`;

      return;
    }

    showMessage(
      result.message ||
        "Signup started successfully."
    );
  } catch (error) {
    console.error(
      "SIGNUP ERROR:",
      error
    );

    showMessage(
      error.message ||
        "Unable to connect to the server."
    );
  }
}

/* =========================================
   LOGIN
   EMAIL + PASSWORD -> OTP
========================================= */

async function login() {
  try {
    const form =
      document.querySelector(
        "#loginForm"
      );

    if (!form) {
      showMessage(
        "Login form not found."
      );

      return;
    }

    const data =
      Object.fromEntries(
        new FormData(form)
      );

    const email =
      String(
        data.email || ""
      )
        .trim()
        .toLowerCase();

    const password =
      String(
        data.password || ""
      );

    if (
      !email ||
      !password
    ) {
      showMessage(
        "Email and password are required."
      );

      return;
    }

    const result =
      await SWN.request(
        "/auth/login",
        {
          method: "POST",

          body:
            JSON.stringify({
              email,
              password
            })
        }
      );

    if (
      !result ||
      !result.success
    ) {
      showMessage(
        result?.message ||
          "Invalid email or password."
      );

      return;
    }

    /*
     * Login is NOT complete yet.
     */
    if (
      result.otpRequired
    ) {
      sessionStorage.setItem(
        "swn_pending_login_email",
        result.email ||
          email
      );

      window.location.href =
        `verify-otp.html?mode=login&email=${encodeURIComponent(
          result.email || email
        )}`;

      return;
    }

    /*
     * Safety fallback:
     * never accept an incomplete
     * login response.
     */
    if (
      !result.user
    ) {
      showMessage(
        "Login requires OTP verification."
      );

      return;
    }

    saveAuth(
      result.user
    );

    redirectByRole(
      result.user
    );
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    showMessage(
      error.message ||
        "Unable to connect to the server."
    );
  }
}

/* =========================================
   LOGOUT
========================================= */

async function logout() {
  try {
    if (
      window.SWN &&
      typeof SWN.request ===
        "function"
    ) {
      try {
        await SWN.request(
          "/auth/logout",
          {
            method: "POST"
          }
        );
      } catch (error) {
        console.error(
          "LOGOUT REQUEST ERROR:",
          error
        );
      }
    }
  } finally {
    clearLocalUser();

    window.location.href =
      "login.html";
  }
}

/* =========================================
   JWT NEVER EXPOSED
========================================= */

function getAuthToken() {
  return null;
}

/* =========================================
   LOCAL USER
========================================= */

function getCurrentUser() {
  try {
    const user =
      localStorage.getItem(
        "swn_user"
      );

    return user
      ? JSON.parse(user)
      : null;
  } catch {
    return null;
  }
}

/* =========================================
   REFRESH CURRENT USER
========================================= */

async function refreshCurrentUser() {
  try {
    const result =
      await SWN.request(
        "/auth/me",
        {
          method: "GET"
        }
      );

    if (
      !result ||
      !result.success ||
      !result.user
    ) {
      clearLocalUser();

      return null;
    }

    saveAuth(
      result.user
    );

    return result.user;
  } catch (error) {
    console.error(
      "AUTH REFRESH ERROR:",
      error
    );

    if (
      error.status === 401 ||
      error.status === 403
    ) {
      clearLocalUser();

      return null;
    }

    throw error;
  }
}

/* =========================================
   RAW API HELPER
========================================= */

async function apiFetch(
  path,
  options = {}
) {
  if (
    window.SWN &&
    typeof SWN.raw ===
      "function"
  ) {
    return SWN.raw(
      path,
      options
    );
  }

  const headers =
    new Headers(
      options.headers || {}
    );

  const hasBody =
    options.body !==
      undefined &&
    options.body !== null;

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

  headers.set(
    "Accept",
    "application/json"
  );

  const response =
    await fetch(
      getApiUrl(path),
      {
        ...options,
        credentials:
          "include",
        headers
      }
    );

  if (
    response.status === 401 ||
    response.status === 403
  ) {
    clearLocalUser();
  }

  return response;
}

window.signup =
  signup;

window.login =
  login;

window.logout =
  logout;

window.getAuthToken =
  getAuthToken;

window.getCurrentUser =
  getCurrentUser;

window.setCurrentUser =
  setCurrentUser;

window.refreshCurrentUser =
  refreshCurrentUser;

window.apiFetch =
  apiFetch;

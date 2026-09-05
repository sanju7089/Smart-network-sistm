"use strict";

function showMessage(message) {
  if (
    window.SWN &&
    typeof SWN.flash ===
      "function"
  ) {
    SWN.flash(message);
  } else {
    alert(String(message || ""));
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

function saveAuth(token, user) {
  if (!token || !user) {
    return;
  }

  localStorage.setItem(
    "swn_token",
    token
  );

  localStorage.setItem(
    "swn_user",
    JSON.stringify(user)
  );
}

function setCurrentUser(user) {
  if (
    !user ||
    typeof user !== "object"
  ) {
    return null;
  }

  localStorage.setItem(
    "swn_user",
    JSON.stringify(user)
  );

  return user;
}

function redirectByRole(user) {
  if (!user) {
    window.location.href =
      "login.html";
    return;
  }

  if (user.role === "admin") {
    window.location.href =
      "admin.html";
    return;
  }

  if (user.role === "worker") {
    window.location.href =
      "worker-dashboard.html";
    return;
  }

  window.location.href =
    "customer-dashboard.html";
}

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

    if (
      !data.name ||
      !data.email ||
      !data.password
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
          body: JSON.stringify({
            name:
              String(data.name)
                .trim(),

            email:
              String(data.email)
                .trim(),

            password:
              data.password,

            role:
              data.role ||
              "customer",

            phone:
              String(
                data.phone || ""
              ).trim(),

            location:
              String(
                data.location || ""
              ).trim()
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
      !result.token ||
      !result.user
    ) {
      showMessage(
        "Account was created, but authentication data is incomplete."
      );
      return;
    }

    saveAuth(
      result.token,
      result.user
    );

    showMessage(
      result.message ||
      "Account created successfully."
    );

    redirectByRole(
      result.user
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

    if (
      !data.email ||
      !data.password
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
          body: JSON.stringify({
            email:
              String(data.email)
                .trim(),

            password:
              data.password
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

    if (
      !result.token ||
      !result.user
    ) {
      showMessage(
        "Login response is incomplete."
      );
      return;
    }

    saveAuth(
      result.token,
      result.user
    );

    showMessage(
      result.message ||
      "Login successful."
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

function logout() {
  if (
    window.SWN &&
    typeof SWN.clearAuth ===
      "function"
  ) {
    SWN.clearAuth();
  } else {
    localStorage.removeItem(
      "swn_token"
    );

    localStorage.removeItem(
      "swn_user"
    );
  }

  window.location.href =
    "login.html";
}

function getAuthToken() {
  return localStorage.getItem(
    "swn_token"
  );
}

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

async function refreshCurrentUser() {
  const token =
    getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const result =
      await SWN.request(
        "/auth/me"
      );

    if (
      !result ||
      !result.success ||
      !result.user
    ) {
      logout();
      return null;
    }

    saveAuth(
      token,
      result.user
    );

    return result.user;
  } catch (error) {
    console.error(
      "AUTH REFRESH ERROR:",
      error
    );

    if (
      error.status === 401
    ) {
      logout();
      return null;
    }

    throw error;
  }
}

/*
 * Raw Response API helper.
 *
 * Existing pages such as:
 * profile.html
 * checkout.html
 * earnings.js
 *
 * use response.ok and response.json(),
 * so this function intentionally returns
 * the native fetch Response.
 */
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

  const token =
    getAuthToken();

  const headers =
    new Headers(
      options.headers || {}
    );

  const hasBody =
    options.body !== undefined &&
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

  const response =
    await fetch(
      getApiUrl(path),
      {
        ...options,
        headers
      }
    );

  if (
    response.status === 401
  ) {
    localStorage.removeItem(
      "swn_token"
    );

    localStorage.removeItem(
      "swn_user"
    );
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

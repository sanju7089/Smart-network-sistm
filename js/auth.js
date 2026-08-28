function showMessage(message) {
  if (window.SWN && typeof SWN.flash === "function") {
    SWN.flash(message);
  } else {
    alert(message);
  }
}

function getApiUrl(path) {
  if (!window.SWN || typeof SWN.api !== "function") {
    throw new Error("API configuration is not available.");
  }

  return SWN.api(path);
}

function saveAuth(token, user) {
  localStorage.setItem("swn_token", token);

  // Password कभी localStorage में save नहीं होगा
  localStorage.setItem(
    "swn_user",
    JSON.stringify(user)
  );
}

function redirectByRole(user) {
  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  if (user.role === "worker") {
    window.location.href = "worker-dashboard.html";
    return;
  }

  window.location.href = "customer-dashboard.html";
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function signup() {
  try {
    const form = document.querySelector("#signupForm");

    if (!form) {
      showMessage("Signup form not found.");
      return;
    }

    const data = Object.fromEntries(new FormData(form));

    if (!data.name || !data.email || !data.password) {
      showMessage(
        "Name, email and password are required."
      );
      return;
    }

    const response = await fetch(
      getApiUrl("/auth/register"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim(),
          password: data.password,
          role: data.role || "customer",
          phone: data.phone || "",
          location: data.location || ""
        })
      }
    );

    const result = await readJson(response);

    if (!response.ok || !result.success) {
      showMessage(
        result.message ||
        "Unable to create account."
      );
      return;
    }

    if (!result.token || !result.user) {
      showMessage(
        "Account was created, but authentication data is incomplete."
      );
      return;
    }

    saveAuth(result.token, result.user);

    showMessage(
      result.message ||
      "Account created successfully."
    );

    redirectByRole(result.user);
  } catch (error) {
    console.error("SIGNUP ERROR:", error);

    showMessage(
      error.message ===
      "Production API URL is not configured yet."
        ? "Server configuration is not complete yet."
        : "Unable to connect to the server."
    );
  }
}

async function login() {
  try {
    const form = document.querySelector("#loginForm");

    if (!form) {
      showMessage("Login form not found.");
      return;
    }

    const data = Object.fromEntries(new FormData(form));

    if (!data.email || !data.password) {
      showMessage(
        "Email and password are required."
      );
      return;
    }

    const response = await fetch(
      getApiUrl("/auth/login"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: data.email.trim(),
          password: data.password
        })
      }
    );

    const result = await readJson(response);

    if (!response.ok || !result.success) {
      showMessage(
        result.message ||
        "Invalid email or password."
      );
      return;
    }

    if (!result.token || !result.user) {
      showMessage(
        "Login response is incomplete."
      );
      return;
    }

    saveAuth(result.token, result.user);

    showMessage(
      result.message ||
      "Login successful."
    );

    redirectByRole(result.user);
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    showMessage(
      error.message ===
      "Production API URL is not configured yet."
        ? "Server configuration is not complete yet."
        : "Unable to connect to the server."
    );
  }
}

function logout() {
  localStorage.removeItem("swn_token");
  localStorage.removeItem("swn_user");

  window.location.href = "login.html";
}

function getAuthToken() {
  return localStorage.getItem("swn_token");
}

function getCurrentUser() {
  try {
    const user = localStorage.getItem("swn_user");

    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

async function refreshCurrentUser() {
  const token = getAuthToken();

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(
      getApiUrl("/auth/me"),
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await readJson(response);

    if (!response.ok || !result.success) {
      logout();
      return null;
    }

    if (!result.user) {
      logout();
      return null;
    }

    saveAuth(token, result.user);

    return result.user;
  } catch (error) {
    console.error(
      "AUTH REFRESH ERROR:",
      error
    );

    return getCurrentUser();
  }
}

async function apiFetch(path, options = {}) {
  const token = getAuthToken();

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(
    getApiUrl(path),
    {
      ...options,
      headers
    }
  );

  if (response.status === 401) {
    localStorage.removeItem("swn_token");
    localStorage.removeItem("swn_user");
  }

  return response;
}

window.signup = signup;
window.login = login;
window.logout = logout;
window.getAuthToken = getAuthToken;
window.getCurrentUser = getCurrentUser;
window.refreshCurrentUser = refreshCurrentUser;
window.apiFetch = apiFetch;

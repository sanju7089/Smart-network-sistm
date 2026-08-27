const SWN = {
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

function authBox() {
  const element =
    document.querySelector("[data-auth]");

  if (!element) return;

  const user = SWN.user();

  element.innerHTML = user
    ? `
      <span class="muted">
        Hi, ${user.name || "User"}
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

  return await window.refreshCurrentUser();
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

window.SWN = SWN;
window.protect = protect;
window.verifyAuth = verifyAuth;

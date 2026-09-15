"use strict";

/*
========================================================
SMART WORK NETWORK
CENTRAL FRONTEND APP
========================================================

FIXES:
- Central API client
- credentials: include
- HttpOnly cookie authentication
- apiFetch compatibility
- Authentication helpers
- Dashboard routing
- Logout
- Notification button bridge
- Global HTML escaping
========================================================
*/


/* ======================================================
   CONFIG
====================================================== */

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


/* ======================================================
   CENTRAL API CLIENT
====================================================== */

const SWN = {

  apiUrl() {
    return SWN_CONFIG.API_URL;
  },


  api(path = "") {

    const base =
      SWN_CONFIG.API_URL;

    const cleanPath =
      String(path || "").trim();

    if (!cleanPath) {
      return base;
    }

    if (
      cleanPath.charAt(0) === "/"
    ) {
      return base + cleanPath;
    }

    return base + "/" + cleanPath;
  },


  get(
    key,
    defaultValue = null
  ) {

    try {

      const value =
        localStorage.getItem(key);

      if (!value) {
        return defaultValue;
      }

      return JSON.parse(value);

    } catch {

      return defaultValue;
    }
  },


  set(
    key,
    value
  ) {

    try {

      localStorage.setItem(
        key,
        JSON.stringify(value)
      );

    } catch (error) {

      console.error(
        "LOCAL STORAGE SET ERROR:",
        error
      );
    }
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


      if (!value) {
        return null;
      }


      return JSON.parse(value);

    } catch {

      return null;
    }
  },


  token() {

    /*
      JWT is intentionally NOT readable
      by JavaScript.

      Authentication is handled through
      HttpOnly cookie.
    */

    return null;
  },


  clearAuth() {

    try {

      localStorage.removeItem(
        "swn_user"
      );

    } catch (error) {

      console.error(
        "CLEAR AUTH ERROR:",
        error
      );
    }
  },


  authHeaders(
    extraHeaders = {},
    hasBody = false
  ) {

    const headers =
      new Headers(
        extraHeaders || {}
      );


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
      requestOptions.body
        instanceof FormData;


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
        hasBody &&
          !isFormData
      );


    /*
      IMPORTANT:
      Send HttpOnly authentication
      cookie with every request.
    */

    requestOptions.credentials =
      "include";


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


    /*
      Authentication failure.
    */

    if (
      response.status === 401 ||
      response.status === 403
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


      if (!text) {
        return null;
      }


      return {
        message: text
      };

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
          "Request failed with status " +
            response.status
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


  async logout() {

    try {

      await this.request(
        "/auth/logout",
        {
          method: "POST"
        }
      );

    } catch (error) {

      console.error(
        "LOGOUT ERROR:",
        error
      );
    }


    this.clearAuth();


    window.location.href =
      "login.html";
  },


  flash(message) {

    window.alert(
      String(
        message || ""
      )
    );
  }
};


/* ======================================================
   LEGACY / COMPATIBILITY API
====================================================== */

/*
IMPORTANT FIX:

Several existing frontend pages use:

    apiFetch("/some-route")

Older code expects apiFetch()
to return the native Response object.

Therefore we expose a compatibility
wrapper around SWN.raw().
*/

async function apiFetch(
  path,
  options = {}
) {

  return SWN.raw(
    path,
    options
  );
}


window.apiFetch =
  apiFetch;


/*
Some older frontend code may use
apiRequest() expecting parsed JSON.
*/

async function apiRequest(
  path,
  options = {}
) {

  return SWN.request(
    path,
    options
  );
}


window.apiRequest =
  apiRequest;


/* ======================================================
   DASHBOARD ROUTING
====================================================== */

function dashboardUrl(
  user
) {

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


/* ======================================================
   HTML ESCAPING
====================================================== */

function escapeHtml(
  value = ""
) {

  const element =
    document.createElement(
      "div"
    );


  element.textContent =
    String(value);


  return element.innerHTML;
}


/* ======================================================
   AUTH UI
====================================================== */

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

    const greeting =
      document.createElement(
        "span"
      );


    greeting.className =
      "muted";


    greeting.textContent =
      "Hi, " +
      String(
        user.name ||
        "User"
      );


    const dashboard =
      document.createElement(
        "a"
      );


    dashboard.href =
      dashboardUrl(
        user
      );


    dashboard.textContent =
      "Dashboard";


    const logoutButton =
      document.createElement(
        "button"
      );


    logoutButton.type =
      "button";


    logoutButton.className =
      "btn btn-primary";


    logoutButton.id =
      "logoutButton";


    logoutButton.textContent =
      "Logout";


    element.innerHTML =
      "";


    element.appendChild(
      greeting
    );


    element.appendChild(
      dashboard
    );


    element.appendChild(
      logoutButton
    );


    logoutButton.addEventListener(
      "click",
      function () {

        SWN.logout();

      }
    );


    return;
  }


  element.innerHTML =
    "";


  const loginLink =
    document.createElement(
      "a"
    );


  loginLink.href =
    "login.html";


  loginLink.textContent =
    "Login";


  const signupLink =
    document.createElement(
      "a"
    );


  signupLink.className =
    "btn btn-primary";


  signupLink.href =
    "signup.html";


  signupLink.textContent =
    "Get Started";


  element.appendChild(
    loginLink
  );


  element.appendChild(
    signupLink
  );
}


/* ======================================================
   PROTECTED PAGE
====================================================== */

function protect(
  role = null
) {

  const user =
    SWN.user();


  if (!user) {

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


/* ======================================================
   AUTH VERIFICATION
====================================================== */

async function verifyAuth() {

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
      "AUTHENTICATION VERIFICATION FAILED:",
      error
    );


    SWN.clearAuth();


    return null;
  }
}


/* ======================================================
   DASHBOARD REDIRECT
====================================================== */

function redirectToCorrectDashboard(
  user
) {

  window.location.href =
    dashboardUrl(
      user
    );
}


/* ======================================================
   NOTIFICATION BELL BRIDGE
====================================================== */

/*
Some pages already contain:

.swn-notification

while notifications.js creates:

#swnNotificationButton

This bridge connects the old/static
button to the real notification system.
*/

function connectNotificationButtons() {

  const staticButtons =
    document.querySelectorAll(
      ".swn-notification"
    );


  if (
    !staticButtons.length
  ) {

    return;
  }


  staticButtons.forEach(
    function (button) {

      if (
        button.dataset.swnNotificationBound ===
        "true"
      ) {

        return;
      }


      button.dataset.swnNotificationBound =
        "true";


      button.addEventListener(
        "click",
        function (event) {

          event.preventDefault();
          event.stopPropagation();


          const realButton =
            document.getElementById(
              "swnNotificationButton"
            );


          if (realButton) {

            realButton.click();

            return;
          }


          /*
            If notifications.js has not
            finished initializing yet,
            try again shortly.
          */

          window.setTimeout(
            function () {

              const retryButton =
                document.getElementById(
                  "swnNotificationButton"
                );


              if (retryButton) {

                retryButton.click();

              } else {

                /*
                  No notification system
                  available on this page.
                */

                window.location.href =
                  "customer-dashboard.html";
              }

            },
            300
          );
        }
      );
    }
  );
}


/* ======================================================
   GLOBAL NOTIFICATION SCRIPT LOADER
====================================================== */

function ensureNotificationSystem() {

  if (
    document.querySelector(
      'script[data-swn-notifications="true"]'
    )
  ) {

    return;
  }


  /*
    Don't load notification system
    on login/signup/OTP pages.
  */

  const path =
    String(
      window.location.pathname ||
      ""
    ).toLowerCase();


  const excludedPages = [
    "login.html",
    "signup.html",
    "verify-otp.html",
    "forgot-password.html",
    "reset-password.html"
  ];


  const currentPage =
    path.split("/").pop();


  if (
    excludedPages.includes(
      currentPage
    )
  ) {

    return;
  }


  const script =
    document.createElement(
      "script"
    );


  script.src =
    "js/notifications.js";


  script.async =
    false;


  script.dataset.swnNotifications =
    "true";


  script.onload =
    function () {

      connectNotificationButtons();
    };


  document.body.appendChild(
    script
  );
}


/* ======================================================
   DOM READY
====================================================== */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    /*
      First render authentication UI.
    */

    authBox();


    /*
      Verify logged-in session.
    */

    if (
      SWN.user()
    ) {

      const user =
        await verifyAuth();


      if (user) {

        authBox();
      }
    }


    /*
      Connect notification buttons.
    */

    connectNotificationButtons();


    /*
      Load notification system.
    */

    ensureNotificationSystem();


    /*
      Retry once after scripts
      have initialized.
    */

    window.setTimeout(
      function () {

        connectNotificationButtons();

      },
      500
    );

  }
);


/* ======================================================
   GLOBAL EXPORTS
====================================================== */

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


window.dashboardUrl =
  dashboardUrl;


window.redirectToCorrectDashboard =
  redirectToCorrectDashboard;


window.connectNotificationButtons =
  connectNotificationButtons;

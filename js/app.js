"use strict";

/*
SMART WORK NETWORK
CENTRAL API CONFIGURATION

Authentication:

- JWT is stored only in HttpOnly cookie.
- JavaScript cannot read the JWT.
- Requests use credentials: include.
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
const base = SWN_CONFIG.API_URL;
const cleanPath =
String(path || "").trim();

if (!cleanPath) {
  return base;
}

if (cleanPath.charAt(0) === "/") {
  return base + cleanPath;
}

return base + "/" + cleanPath;

},

get(key, defaultValue = null) {
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

  if (!value) {
    return null;
  }

  return JSON.parse(value);
} catch {
  return null;
}

},

token() {
return null;
},

clearAuth() {
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

/*

* Safe HTML escaping without regex
* and without manually writing HTML
* entity strings.
  */
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
    user.name || "User"
  );

const dashboard =
  document.createElement(
    "a"
  );

dashboard.href =
  dashboardUrl(user);

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
  () => {
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

if (SWN.user()) {
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

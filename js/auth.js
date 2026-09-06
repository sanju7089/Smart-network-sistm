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

/*

* JWT is intentionally NOT stored in localStorage.
* 
* Authentication is handled by the backend
* using the HttpOnly "swn_auth" cookie.
* 
* Only safe user profile information is kept
* locally for UI/dashboard routing.
  */

function saveAuth(user) {
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

function clearLocalUser() {
localStorage.removeItem(
"swn_user"
);
}

function setCurrentUser(user) {
if (
!user ||
typeof user !== "object"
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
          String(data.password),

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

if (!result.user) {
  showMessage(
    "Account was created, but user information is incomplete."
  );
  return;
}

/*
 * Backend has already created the
 * HttpOnly authentication cookie.
 *
 * The JWT is never exposed to JavaScript.
 */
saveAuth(
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
          String(data.password)
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

if (!result.user) {
  showMessage(
    "Login response is incomplete."
  );
  return;
}

/*
 * Backend has already set the
 * HttpOnly authentication cookie.
 */
saveAuth(
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
/*
* Even if the network request fails,
* local user data must be removed.
*/
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

/*

* JWT is HttpOnly.
* 
* JavaScript must never read it.
* Returning null here keeps compatibility
* with older pages without exposing the token.
  */
  function getAuthToken() {
  return null;
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

headers.set(
"Accept",
"application/json"
);

const response =
await fetch(
getApiUrl(path),
{
...options,
credentials: "include",
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

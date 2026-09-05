"use strict";

/*

SMART WORK NETWORK
WORK SYSTEM

Includes:

- Post Work
- Find Work
- Search
- Category filter
- Service filter
- Location filter
- Pagination
- Work Detail
- Invalid/closed work handling
- Central SWN API client
- XSS-safe rendering
  ==================================================
  */

/*

COMMON HELPERS

*/

function showWorkMessage(message) {
if (
window.SWN &&
typeof window.SWN.flash === "function"
) {
window.SWN.flash(message);
} else {
alert(String(message || ""));
}
}

function escapeWorkHtml(value = "") {
if (typeof window.escapeHtml === "function") {
return window.escapeHtml(String(value));
}

return String(value)
.replace(/&/g, "&")
.replace(/</g, "<")
.replace(/>/g, ">")
.replace(/"/g, """)
.replace(/'/g, "'");
}

function getJobIdFromUrl() {
return String(
new URLSearchParams(window.location.search).get("id") || ""
).trim();
}

function normalizeWorkText(value, maxLength = 200) {
return String(value ?? "")
.trim()
.slice(0, maxLength);
}

/*

POST WORK

*/

async function postWork(event) {
if (event) {
event.preventDefault();
}

if (typeof window.protect !== "function") {
showWorkMessage(
"Authentication system is unavailable."
);
return;
}

const user = window.protect("customer");

if (!user) {
return;
}

if (
!window.SWN ||
typeof window.SWN.request !== "function"
) {
showWorkMessage(
"API connection is unavailable."
);
return;
}

const form = document.querySelector("#workForm");

if (!form) {
showWorkMessage("Work form not found.");
return;
}

const formData = new FormData(form);

const jobData = {
title: String(
formData.get("title") || ""
).trim(),

description: String(
  formData.get("description") || ""
).trim(),

category: String(
  formData.get("category") || ""
).trim(),

service: String(
  formData.get("service") || ""
).trim(),

location: String(
  formData.get("location") || ""
).trim(),

budget: String(
  formData.get("budget") || ""
).trim()

};

if (
!jobData.title ||
!jobData.description
) {
showWorkMessage(
"Please enter both work title and description."
);
return;
}

if (jobData.title.length < 3) {
showWorkMessage(
"Work title must be at least 3 characters."
);
return;
}

if (
jobData.budget !== "" &&
(
!Number.isFinite(Number(jobData.budget)) ||
Number(jobData.budget) < 0
)
) {
showWorkMessage(
"Please enter a valid budget."
);
return;
}

const submitButton = form.querySelector(
'button[type="submit"], input[type="submit"]'
);

const originalButtonText = submitButton
? submitButton.textContent
: "";

try {
if (submitButton) {
submitButton.disabled = true;
submitButton.textContent = "Posting...";
}

const payload = {
  title: jobData.title,
  description: jobData.description,
  category: jobData.category,
  service: jobData.service,
  location: jobData.location,
  budget:
    jobData.budget === ""
      ? ""
      : Number(jobData.budget)
};

const result = await window.SWN.request(
  "/jobs",
  {
    method: "POST",
    body: JSON.stringify(payload)
  }
);

if (
  !result ||
  result.success !== true
) {
  throw new Error(
    result?.message ||
    "Unable to post work."
  );
}

showWorkMessage(
  result.message ||
  "Work posted successfully."
);

window.location.href =
  "customer-dashboard.html";

} catch (error) {
console.error(
"POST WORK ERROR:",
error
);

showWorkMessage(
  error?.message ||
  "Unable to post work."
);

} finally {
if (submitButton) {
submitButton.disabled = false;

  submitButton.textContent =
    originalButtonText ||
    "Post Work";
}

}
}

/*

FIND WORK STATE

*/

const workSearchState = {
page: 1,
limit: 20,
total: 0,
totalPages: 1,
search: "",
category: "",
service: "",
location: "",
loading: false
};

/*

READ SEARCH FILTERS

*/

function readWorkFilters() {
const search =
document.querySelector("#workSearch");

const category =
document.querySelector("#workCategory");

const service =
document.querySelector("#workService");

const location =
document.querySelector("#workLocation");

workSearchState.search =
normalizeWorkText(
search?.value || "",
200
);

workSearchState.category =
normalizeWorkText(
category?.value || "",
100
);

workSearchState.service =
normalizeWorkText(
service?.value || "",
150
);

workSearchState.location =
normalizeWorkText(
location?.value || "",
200
);
}

/*

BUILD JOB SEARCH URL

*/

function buildWorkListEndpoint() {
const params = new URLSearchParams();

/*
Public Find Work must only request OPEN jobs.
*/

params.set(
"status",
"open"
);

params.set(
"page",
String(workSearchState.page)
);

params.set(
"limit",
String(workSearchState.limit)
);

if (workSearchState.search) {
params.set(
"search",
workSearchState.search
);
}

if (workSearchState.category) {
params.set(
"category",
workSearchState.category
);
}

if (workSearchState.service) {
params.set(
"service",
workSearchState.service
);
}

if (workSearchState.location) {
params.set(
"location",
workSearchState.location
);
}

return "/jobs?${params.toString()}";
}

/*

EXTRACT JOB LIST

*/

function extractJobList(result) {
if (
result &&
Array.isArray(result.data)
) {
return result.data;
}

if (
result &&
result.data &&
Array.isArray(result.data.jobs)
) {
return result.data.jobs;
}

if (
result &&
Array.isArray(result.jobs)
) {
return result.jobs;
}

return [];
}

/*

RENDER FIND WORK CARD

*/

function renderWorkCard(job) {
if (!job) {
return "";
}

const jobId =
job._id ||
job.id;

if (!jobId) {
return "";
}

/*
Public list must contain only open jobs.
*/

if (
job.status &&
job.status !== "open"
) {
return "";
}

const title =
escapeWorkHtml(
job.title ||
"Untitled Work"
);

const description =
escapeWorkHtml(
job.description ||
""
);

const service =
escapeWorkHtml(
job.service ||
job.category ||
"General Service"
);

const category =
escapeWorkHtml(
job.category ||
"General"
);

const location =
escapeWorkHtml(
job.location ||
"Location not specified"
);

let budget = "Negotiable";

if (
job.budget !== null &&
job.budget !== undefined &&
job.budget !== ""
) {
const numericBudget =
Number(job.budget);

if (
  Number.isFinite(numericBudget)
) {
  budget =
    `₹${numericBudget.toLocaleString("en-IN")}`;
}

}

const safeDescription =
description.length > 220
? "${description.slice(0, 220)}..."
: description;

return `
<article
class="item"
data-job-id="${escapeWorkHtml(jobId)}"
>

  <div
    class="row between"
    style="
      align-items:flex-start;
    "
  >

    <div
      style="
        min-width:0;
        flex:1;
      "
    >

      <h3
        style="
          margin:0 0 8px;
        "
      >
        ${title}
      </h3>

      <div
        class="row"
        style="
          gap:6px;
          margin-bottom:8px;
        "
      >

        <span class="tag">
          ${service}
        </span>

        <span class="tag">
          ${category}
        </span>

        <span class="tag">
          ${location}
        </span>

      </div>

      <p
        class="muted"
        style="
          margin:8px 0;
        "
      >
        ${safeDescription}
      </p>

      <p
        style="
          margin:8px 0 0;
        "
      >
        <b>Budget:</b>
        ${escapeWorkHtml(budget)}
      </p>

    </div>

    <a
      class="btn btn-primary"
      href="work-request.html?id=${encodeURIComponent(
        String(jobId)
      )}"
      aria-label="View work details for ${escapeWorkHtml(
        job.title ||
        "work request"
      )}"
    >
      View Details
    </a>

  </div>

</article>

`;
}

/*

RENDER PAGINATION

*/

function renderWorkPagination() {
const pagination =
document.querySelector(
"#workPagination"
);

const previous =
document.querySelector(
"#workPrevious"
);

const next =
document.querySelector(
"#workNext"
);

const pageInfo =
document.querySelector(
"#workPageInfo"
);

if (
!pagination ||
!previous ||
!next ||
!pageInfo
) {
return;
}

const totalPages =
Math.max(
1,
Number(
workSearchState.totalPages
) || 1
);

const currentPage =
Math.min(
Math.max(
1,
Number(
workSearchState.page
) || 1
),
totalPages
);

workSearchState.totalPages =
totalPages;

workSearchState.page =
currentPage;

if (totalPages <= 1) {
pagination.style.display =
"none";

return;

}

pagination.style.display =
"flex";

previous.disabled =
currentPage <= 1;

next.disabled =
currentPage >= totalPages;

pageInfo.textContent =
"Page ${currentPage} of ${totalPages}";
}

/*

RENDER RESULT SUMMARY

*/

function renderWorkSummary(
visibleCount
) {
const summary =
document.querySelector(
"#workResultsSummary"
);

if (!summary) {
return;
}

const total =
Number(
workSearchState.total
) || 0;

const currentPage =
Number(
workSearchState.page
) || 1;

const limit =
Number(
workSearchState.limit
) || 20;

if (!total) {
summary.textContent =
"No matching open work requests found.";

return;

}

const count =
Number(visibleCount) || 0;

const start =
(
(currentPage - 1) *
limit
) + 1;

const end =
Math.min(
start + Math.max(count, 1) - 1,
total
);

summary.textContent =
"Showing ${start}-${end} of ${total} available work requests.";
}

/*

LOAD OPEN JOBS

*/

async function jobs(
id = "jobsList",
options = {}
) {
const element =
document.getElementById(id);

if (!element) {
return;
}

if (
!window.SWN ||
typeof window.SWN.request !==
"function"
) {
element.innerHTML =
"<div class="notice"> API connection is unavailable. </div>";

return;

}

if (
options.resetPage === true
) {
workSearchState.page = 1;
}

readWorkFilters();

workSearchState.loading =
true;

element.innerHTML =
"<div class="notice"> Loading work requests... </div>";

try {
const endpoint =
buildWorkListEndpoint();

const result =
  await window.SWN.request(
    endpoint
  );

if (
  !result ||
  result.success !== true
) {
  throw new Error(
    result?.message ||
    "Unable to load work requests."
  );
}

const jobList =
  extractJobList(result);

const pagination =
  result.pagination || {};

workSearchState.total =
  Number(
    pagination.total
  ) || jobList.length;

workSearchState.totalPages =
  Number(
    pagination.totalPages
  ) ||
  Math.max(
    1,
    Math.ceil(
      workSearchState.total /
      workSearchState.limit
    )
  );

/*
Backend is authoritative,
browser also protects against
closed/invalid jobs.
*/

const validJobs =
  jobList.filter(
    (job) =>
      job &&
      (
        !job.status ||
        job.status === "open"
      )
  );

const cards =
  validJobs
    .map(
      renderWorkCard
    )
    .filter(Boolean)
    .join("");

if (!cards) {
  element.innerHTML =
    `
      <div class="notice">
        No matching open work requests found.
      </div>
    `;
} else {
  element.innerHTML =
    cards;
}

renderWorkSummary(
  validJobs.length
);

renderWorkPagination();

} catch (error) {
console.error(
"LOAD JOBS ERROR:",
error
);

element.innerHTML =
  `
    <div class="notice">
      ${escapeWorkHtml(
        error?.message ||
        "Unable to load work requests."
      )}
    </div>
  `;

const summary =
  document.querySelector(
    "#workResultsSummary"
  );

if (summary) {
  summary.textContent =
    "Unable to load work requests.";
}

renderWorkPagination();

} finally {
workSearchState.loading =
false;
}
}

/*

RESET FIND WORK FILTERS

*/

function resetWorkFilters() {
const search =
document.querySelector(
"#workSearch"
);

const category =
document.querySelector(
"#workCategory"
);

const service =
document.querySelector(
"#workService"
);

const location =
document.querySelector(
"#workLocation"
);

if (search) {
search.value = "";
}

if (category) {
category.value = "";
}

if (service) {
service.value = "";
}

if (location) {
location.value = "";
}

workSearchState.search = "";
workSearchState.category = "";
workSearchState.service = "";
workSearchState.location = "";
workSearchState.page = 1;

jobs(
"jobsList",
{
resetPage: true
}
);
}

/*

WORK DETAIL

*/

async function request() {
const container =
document.querySelector(
"#requestDetail"
);

if (!container) {
return;
}

const jobId =
getJobIdFromUrl();

if (!jobId) {
container.innerHTML =
"<div class="notice"> Invalid work request. </div>";

return;

}

if (
!window.SWN ||
typeof window.SWN.request !==
"function"
) {
container.innerHTML =
"<div class="notice"> API connection is unavailable. </div>";

return;

}

container.innerHTML =
"<div class="notice"> Loading work details... </div>";

try {
const result =
await window.SWN.request(
"/jobs/${encodeURIComponent(jobId)}"
);

if (
  !result ||
  result.success !== true ||
  !result.data
) {
  throw new Error(
    result?.message ||
    "Work request not found."
  );
}

const job =
  result.data;

const status =
  String(
    job.status ||
    "open"
  ).toLowerCase();

/*
--------------------------------------------------
PUBLIC / OWNER / ADMIN ACCESS CHECK
--------------------------------------------------
*/

let currentUser = null;

if (
  window.SWN &&
  typeof window.SWN.user ===
    "function"
) {
  currentUser =
    window.SWN.user();
}

if (!currentUser) {
  try {
    const storedUser =
      localStorage.getItem(
        "swn_user"
      );

    if (storedUser) {
      currentUser =
        JSON.parse(
          storedUser
        );
    }
  } catch (error) {
    console.warn(
      "Unable to read stored user:",
      error
    );
  }
}

const customerId =
  job.customerId &&
  typeof job.customerId === "object"
    ? (
        job.customerId._id ||
        job.customerId.id
      )
    : job.customerId;

const currentUserId =
  currentUser &&
  (
    currentUser._id ||
    currentUser.id
  );

const isOwner =
  Boolean(
    currentUserId &&
    customerId &&
    String(currentUserId) ===
      String(customerId)
  );

const isAdmin =
  Boolean(
    currentUser &&
    currentUser.role === "admin"
  );

/*
Public users can only view OPEN jobs.
Owner/admin can view their private jobs.
*/

if (
  status !== "open" &&
  !isOwner &&
  !isAdmin
) {
  container.innerHTML =
    `
      <div class="notice">
        This work request is no longer available.
      </div>
    `;

  return;
}

/*
--------------------------------------------------
SAFE DATA
--------------------------------------------------
*/

const title =
  escapeWorkHtml(
    job.title ||
    "Untitled Work"
  );

const description =
  escapeWorkHtml(
    job.description ||
    "No description provided."
  );

const category =
  escapeWorkHtml(
    job.category ||
    "General"
  );

const service =
  escapeWorkHtml(
    job.service ||
    "General Service"
  );

const location =
  escapeWorkHtml(
    job.location ||
    "Location not specified"
  );

let budget =
  "Negotiable";

if (
  job.budget !== null &&
  job.budget !== undefined &&
  job.budget !== ""
) {
  const numericBudget =
    Number(job.budget);

  if (
    Number.isFinite(numericBudget)
  ) {
    budget =
      `₹${numericBudget.toLocaleString("en-IN")}`;
  }
}

const safeStatus =
  escapeWorkHtml(
    status
  );

/*
--------------------------------------------------
FIND MATCHED WORKERS
--------------------------------------------------
*/

const matchedWorkersButton =
  status === "open"
    ? `
      <a
        class="btn btn-primary"
        href="workers.html?jobId=${encodeURIComponent(
          String(jobId)
        )}"
      >
        Find Matched Workers
      </a>
    `
    : "";

/*
--------------------------------------------------
DETAIL RENDER
--------------------------------------------------
*/

container.innerHTML =
  `
    <article class="card">

      <div
        class="row between"
        style="
          align-items:flex-start;
          gap:16px;
        "
      >

        <div
          style="
            min-width:0;
            flex:1;
          "
        >

          <h1
            style="
              margin-top:0;
            "
          >
            ${title}
          </h1>

          <div
            class="row"
            style="
              gap:6px;
              margin-bottom:14px;
            "
          >

            <span class="tag">
              ${service}
            </span>

            <span class="tag">
              ${category}
            </span>

            <span class="tag">
              ${location}
            </span>

            <span class="tag">
              Status: ${safeStatus}
            </span>

          </div>

        </div>

      </div>

      <div
        style="
          margin-top:16px;
        "
      >

        <h3>
          Work Description
        </h3>

        <p
          style="
            white-space:pre-wrap;
          "
        >
          ${description}
        </p>

      </div>

      <div
        style="
          margin-top:16px;
        "
      >

        <p>
          <b>Category:</b>
          ${category}
        </p>

        <p>
          <b>Service:</b>
          ${service}
        </p>

        <p>
          <b>Location:</b>
          ${location}
        </p>

        <p>
          <b>Budget:</b>
          ${escapeWorkHtml(budget)}
        </p>

      </div>

      <div
        class="row"
        style="
          margin-top:20px;
          gap:10px;
        "
      >

        ${matchedWorkersButton}

        <a
          class="btn btn-light"
          href="find-work.html"
        >
          Back to Find Work
        </a>

      </div>

    </article>
  `;

} catch (error) {
console.error(
"LOAD WORK DETAIL ERROR:",
error
);

container.innerHTML =
  `
    <div class="notice">
      ${escapeWorkHtml(
        error?.message ||
        "This work request is invalid, unavailable, or no longer exists."
      )}
    </div>
  `;

}
}

/*

INITIALIZE FIND WORK SEARCH

*/

function initializeWorkSearch() {
const form =
document.querySelector(
"#workSearchForm"
);

const resetButton =
document.querySelector(
"#resetWorkFilters"
);

const previous =
document.querySelector(
"#workPrevious"
);

const next =
document.querySelector(
"#workNext"
);

if (form) {
form.addEventListener(
"submit",
function(event) {
event.preventDefault();

    workSearchState.page = 1;

    jobs(
      "jobsList",
      {
        resetPage: true
      }
    );
  }
);

}

if (resetButton) {
resetButton.addEventListener(
"click",
function() {
resetWorkFilters();
}
);
}

if (previous) {
previous.addEventListener(
"click",
function() {
if (
workSearchState.loading ||
workSearchState.page <= 1
) {
return;
}

    workSearchState.page -= 1;

    jobs("jobsList");
  }
);

}

if (next) {
next.addEventListener(
"click",
function() {
if (
workSearchState.loading ||
workSearchState.page >=
workSearchState.totalPages
) {
return;
}

    workSearchState.page += 1;

    jobs("jobsList");
  }
);

}
}

/*

PAGE INITIALIZATION

*/

function initializeWorkPage() {
initializeWorkSearch();

const list =
document.querySelector(
"#jobsList"
);

const detail =
document.querySelector(
"#requestDetail"
);

if (list) {
jobs("jobsList");
}

if (detail) {
request();
}
}

/*

DOM READY

*/

document.addEventListener(
"DOMContentLoaded",
initializeWorkPage
);

/*

GLOBAL EXPORTS

*/

window.postWork =
postWork;

window.jobs =
jobs;

window.request =
request;

window.resetWorkFilters =
resetWorkFilters;
大小规律

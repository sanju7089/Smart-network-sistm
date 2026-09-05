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
  ========================================
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
alert(message);
}
}

function escapeWorkHtml(value = "") {
if (
typeof window.escapeHtml ===
"function"
) {
return window.escapeHtml(value);
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
new URLSearchParams(
window.location.search
).get("id") || ""
).trim();
}

function normalizeWorkText(
value,
maxLength = 200
) {
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

if (
typeof window.protect !==
"function"
) {
showWorkMessage(
"Authentication system is unavailable."
);
return;
}

const user =
window.protect("customer");

if (!user) {
return;
}

if (
!window.SWN ||
typeof window.SWN.request !==
"function"
) {
showWorkMessage(
"API connection is unavailable."
);
return;
}

const form =
document.querySelector("#workForm");

if (!form) {
showWorkMessage(
"Work form not found."
);
return;
}

const formData =
new FormData(form);

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

if (
jobData.title.length < 3
) {
showWorkMessage(
"Work title must be at least 3 characters."
);
return;
}

if (
jobData.budget !== "" &&
(
!Number.isFinite(
Number(jobData.budget)
) ||
Number(jobData.budget) < 0
)
) {
showWorkMessage(
"Please enter a valid budget."
);
return;
}

const submitButton =
form.querySelector(
'button[type="submit"], input[type="submit"]'
);

const originalButtonText =
submitButton
? submitButton.textContent
: "";

try {
if (submitButton) {
submitButton.disabled = true;
submitButton.textContent =
"Posting...";
}

const payload = {
  title: jobData.title,

  description:
    jobData.description,

  category:
    jobData.category,

  service:
    jobData.service,

  location:
    jobData.location,

  budget:
    jobData.budget === ""
      ? ""
      : Number(jobData.budget)
};

const result =
  await window.SWN.request(
    "/jobs",
    {
      method: "POST",
      body: JSON.stringify(
        payload
      )
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
const params =
new URLSearchParams();

/*
Public Find Work must only
request OPEN jobs.
*/

params.set(
"status",
"open"
);

params.set(
"page",
String(
workSearchState.page
)
);

params.set(
"limit",
String(
workSearchState.limit
)
);

if (
workSearchState.search
) {
params.set(
"search",
workSearchState.search
);
}

if (
workSearchState.category
) {
params.set(
"category",
workSearchState.category
);
}

if (
workSearchState.service
) {
params.set(
"service",
workSearchState.service
);
}

if (
workSearchState.location
) {
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

function extractJobList(
result
) {
if (
result &&
Array.isArray(result.data)
) {
return result.data;
}

if (
result &&
result.data &&
Array.isArray(
result.data.jobs
)
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

function renderWorkCard(
job
) {
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
Public list is expected to
contain only open jobs.

Do not render invalid/closed
jobs even if malformed data
somehow reaches the browser.

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

const budget =
job.budget === null ||
job.budget === undefined ||
job.budget === ""
? "Negotiable"
: "₹${Number( job.budget ).toLocaleString( "en-IN" )}";

const safeDescription =
description.length > 220
? "${description.slice(0, 220)}..."
: description;

return `
<article
class="item"
data-job-id="${escapeWorkHtml(
jobId
)}"
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
        ${budget}
      </p>

    </div>


    <a
      class="btn btn-primary"
      href="work-request.html?id=${encodeURIComponent(
        jobId
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

if (
totalPages <= 1
) {
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
workSearchState.page;

const limit =
workSearchState.limit;

if (!total) {
summary.textContent =
"No matching open work requests found.";
return;
}

const start =
(
(currentPage - 1) *
limit
) + 1;

const end =
Math.min(
start + visibleCount - 1,
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
element.innerHTML = "<div class="notice"> API connection is unavailable. </div>";

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

element.innerHTML = "<div class="notice"> Loading work requests... </div>";

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
  but browser also protects
  against closed/invalid jobs.
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
  element.innerHTML = `
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

element.innerHTML = `
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

workSearchState.search =
"";

workSearchState.category =
"";

workSearchState.service =
"";

workSearchState.location =
"";

workSearchState.page =
1;

jobs(
"jobsList",
{
resetPage: false
}
);
}

/*

WORK DETAIL

*/

async function request() {
const element =
document.querySelector(
"#requestDetail"
);

const id =
getJobIdFromUrl();

if (!element) {
return;
}

if (!id) {
element.innerHTML = "<div class="notice"> Work request ID is missing. </div>";

return;

}

if (
!window.SWN ||
typeof window.SWN.request !==
"function"
) {
element.innerHTML = "<div class="notice"> API connection is unavailable. </div>";

return;

}

element.innerHTML = "<div class="notice"> Loading work details... </div>";

try {
const result =
await window.SWN.request(
"/jobs/${encodeURIComponent(id)}"
);

if (
  !result ||
  result.success !== true
) {
  throw new Error(
    result?.message ||
    "Work request not found or is no longer available."
  );
}

const job =
  result.data;

if (!job) {
  throw new Error(
    "Work request not found or is no longer available."
  );
}

/*
  Public detail should be open.

  Non-open jobs can only be returned
  by backend to authorized owner/admin.
  Therefore the frontend must not
  blindly treat every response as
  public work.
*/

const currentUser =
  typeof window.SWN.user ===
  "function"
    ? window.SWN.user()
    : null;

const isOwner =
  Boolean(
    currentUser &&
    currentUser.id &&
    job.customerId &&
    String(
      job.customerId?._id ||
      job.customerId
    ) ===
    String(
      currentUser.id
    )
  );

const isAdmin =
  Boolean(
    currentUser &&
    currentUser.role ===
    "admin"
  );

if (
  job.status &&
  job.status !== "open" &&
  !isOwner &&
  !isAdmin
) {
  throw new Error(
    "This work request is no longer available."
  );
}

const title =
  escapeWorkHtml(
    job.title ||
    "Work Request"
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
    "General"
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

const budget =
  job.budget === null ||
  job.budget === undefined ||
  job.budget === ""
    ? "Negotiable"
    : `₹${Number(
        job.budget
      ).toLocaleString(
        "en-IN"
      )}`;

const jobId =
  job._id ||
  job.id;

if (!jobId) {
  throw new Error(
    "Invalid work data."
  );
}

const status =
  String(
    job.status ||
    "open"
  ).toLowerCase();

const statusLabel =
  escapeWorkHtml(
    status
      .replace(
        /_/g,
        " "
      )
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      )
  );

const canFindWorkers =
  status === "open";

element.innerHTML = `
  <div class="card">

    <div
      class="row"
      style="
        margin-bottom:12px;
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
        Status: ${statusLabel}
      </span>

    </div>


    <h1>
      ${title}
    </h1>


    <p class="lead">
      ${description}
    </p>


    <div
      style="
        display:grid;
        gap:8px;
        margin:18px 0;
      "
    >

      <p>
        <b>Service:</b>
        ${service}
      </p>

      <p>
        <b>Category:</b>
        ${category}
      </p>

      <p>
        <b>Location:</b>
        ${location}
      </p>

      <p>
        <b>Budget:</b>
        ${budget}
      </p>

    </div>


    <div
      class="row"
      style="
        margin-top:18px;
      "
    >

      <a
        class="btn btn-light"
        href="find-work.html"
      >
        ← Back to Find Work
      </a>

      ${
        canFindWorkers
          ? `
            <a
              class="btn btn-primary"
              href="workers.html?service=${encodeURIComponent(
                job.service ||
                job.category ||
                ""
              )}&jobId=${encodeURIComponent(
                jobId
              )}"
            >
              Find Matched Workers
            </a>
          `
          : `
            <span
              class="notice"
              style="
                margin:0;
              "
            >
              This work request is no longer
              accepting new worker bookings.
            </span>
          `
      }

    </div>

  </div>
`;

} catch (error) {
console.error(
"LOAD JOB DETAIL ERROR:",
error
);

const message =
  error?.message ||
  "Unable to load work details.";

element.innerHTML = `
  <div class="notice">

    <strong>
      Work request unavailable
    </strong>

    <p
      style="
        margin:8px 0 14px;
      "
    >
      ${escapeWorkHtml(
        message
      )}
    </p>

    <a
      class="btn btn-primary"
      href="find-work.html"
    >
      Back to Find Work
    </a>

  </div>
`;

}
}

/*

FIND WORK EVENT HANDLERS

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
(event) => {
event.preventDefault();

    if (
      workSearchState.loading
    ) {
      return;
    }

    readWorkFilters();

    workSearchState.page =
      1;

    jobs(
      "jobsList",
      {
        resetPage: false
      }
    );
  }
);

}

if (resetButton) {
resetButton.addEventListener(
"click",
resetWorkFilters
);
}

if (previous) {
previous.addEventListener(
"click",
() => {
if (
workSearchState.loading ||
workSearchState.page <= 1
) {
return;
}

    workSearchState.page -=
      1;

    jobs(
      "jobsList",
      {
        resetPage: false
      }
    );
  }
);

}

if (next) {
next.addEventListener(
"click",
() => {
if (
workSearchState.loading ||
workSearchState.page >=
workSearchState.totalPages
) {
return;
}

    workSearchState.page +=
      1;

    jobs(
      "jobsList",
      {
        resetPage: false
      }
    );
  }
);

}
}

/*

PAGE INITIALIZATION

*/

function initializeWorkPage() {
initializeWorkSearch();

const hasJobsList =
document.querySelector(
"#jobsList"
);

const hasRequestDetail =
document.querySelector(
"#requestDetail"
);

if (hasJobsList) {
jobs();
}

if (hasRequestDetail) {
request();
}
}

if (
document.readyState ===
"loading"
) {
document.addEventListener(
"DOMContentLoaded",
initializeWorkPage
);
} else {
initializeWorkPage();
}

/*

PUBLIC API

*/

window.postWork =
postWork;

window.jobs =
jobs;

window.request =
request;

window.resetWorkFilters =
resetWorkFilters;

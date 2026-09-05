"use strict";

/*
========================================================
SMART WORK NETWORK
WORK-MANAGE.JS
========================================================

Customer Work Management

Features:
- Detect current logged-in user
- Detect job owner
- Edit own job
- Delete own job
- Admin management support
- Server-side authorization remains authoritative
- XSS-safe rendering
- Central SWN API client
========================================================
*/


/* ======================================================
   HELPERS
====================================================== */

function workManageEscape(value = "") {
  if (
    typeof window.escapeHtml === "function"
  ) {
    return window.escapeHtml(value);
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


function workManageShowMessage(message) {
  if (
    window.SWN &&
    typeof window.SWN.flash === "function"
  ) {
    window.SWN.flash(message);
    return;
  }

  alert(message);
}


function workManageGetJobId() {
  return new URLSearchParams(
    window.location.search
  ).get("id");
}


function workManageGetCurrentUser() {
  try {
    if (
      window.SWN &&
      typeof window.SWN.user === "function"
    ) {
      const user = window.SWN.user();

      if (user) {
        return user;
      }
    }
  } catch (error) {
    console.error(
      "WORK MANAGE USER ERROR:",
      error
    );
  }

  try {
    const raw =
      localStorage.getItem("swn_user");

    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error(
      "WORK MANAGE USER STORAGE ERROR:",
      error
    );

    return null;
  }
}


function workManageGetCustomerId(job) {
  if (!job) {
    return null;
  }

  const customer =
    job.customerId ||
    job.customer ||
    null;

  if (
    customer &&
    typeof customer === "object"
  ) {
    return (
      customer._id ||
      customer.id ||
      null
    );
  }

  return customer || null;
}


function workManageIsOwner(job, user) {
  if (!job || !user) {
    return false;
  }

  const customerId =
    workManageGetCustomerId(job);

  const userId =
    user._id ||
    user.id ||
    null;

  if (
    !customerId ||
    !userId
  ) {
    return false;
  }

  return (
    String(customerId) ===
    String(userId)
  );
}


function workManageIsAdmin(user) {
  return (
    user &&
    String(user.role || "").toLowerCase() ===
      "admin"
  );
}


function workManageCanManage(job, user) {
  return (
    workManageIsOwner(job, user) ||
    workManageIsAdmin(user)
  );
}


function workManageStatus(job) {
  return String(
    job?.status || "open"
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
}


function workManageCanEdit(job, user) {
  if (
    !workManageCanManage(job, user)
  ) {
    return false;
  }

  if (
    workManageIsAdmin(user)
  ) {
    return true;
  }

  return ![
    "completed",
    "cancelled"
  ].includes(
    workManageStatus(job)
  );
}


function workManageCanDelete(job, user) {
  return workManageCanManage(
    job,
    user
  );
}


function workManageMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return "";
  }

  return String(amount);
}


/* ======================================================
   API
====================================================== */

async function workManageRequest(
  path,
  options = {}
) {
  if (
    !window.SWN ||
    typeof window.SWN.request !==
      "function"
  ) {
    throw new Error(
      "API connection is unavailable."
    );
  }

  return window.SWN.request(
    path,
    options
  );
}


/* ======================================================
   EDIT FORM
====================================================== */

function workManageRenderEditForm(
  container,
  job
) {
  if (!container || !job) {
    return;
  }

  const title =
    workManageEscape(
      job.title || ""
    );

  const description =
    workManageEscape(
      job.description || ""
    );

  const category =
    workManageEscape(
      job.category || ""
    );

  const service =
    workManageEscape(
      job.service || ""
    );

  const location =
    workManageEscape(
      job.location || ""
    );

  const budget =
    workManageMoney(
      job.budget
    );

  container.innerHTML = `
    <section
      class="card work-edit-card"
      id="workEditSection"
    >

      <div class="row between">
        <div>
          <h3>
            Edit Work
          </h3>

          <p class="muted">
            Update the details of your work request.
          </p>
        </div>

        <button
          type="button"
          class="btn"
          id="cancelWorkEdit"
        >
          Cancel
        </button>
      </div>


      <form
        id="workEditForm"
        novalidate
      >

        <label for="editWorkTitle">
          Work Title
        </label>

        <input
          id="editWorkTitle"
          name="title"
          type="text"
          maxlength="200"
          minlength="3"
          required
          value="${title}"
        >


        <label for="editWorkDescription">
          Description
        </label>

        <textarea
          id="editWorkDescription"
          name="description"
          maxlength="5000"
          required
          rows="6"
        >${description}</textarea>


        <label for="editWorkCategory">
          Category
        </label>

        <input
          id="editWorkCategory"
          name="category"
          type="text"
          maxlength="100"
          value="${category}"
        >


        <label for="editWorkService">
          Service
        </label>

        <input
          id="editWorkService"
          name="service"
          type="text"
          maxlength="150"
          value="${service}"
        >


        <label for="editWorkLocation">
          Location
        </label>

        <input
          id="editWorkLocation"
          name="location"
          type="text"
          maxlength="200"
          value="${location}"
        >


        <label for="editWorkBudget">
          Budget
        </label>

        <input
          id="editWorkBudget"
          name="budget"
          type="number"
          min="0"
          step="0.01"
          value="${workManageEscape(budget)}"
        >


        <div class="row">
          <button
            type="submit"
            class="btn btn-primary"
            id="saveWorkEdit"
          >
            Save Changes
          </button>

          <button
            type="button"
            class="btn"
            id="cancelWorkEditBottom"
          >
            Cancel
          </button>
        </div>

      </form>

    </section>
  `;


  const form =
    document.getElementById(
      "workEditForm"
    );

  const cancelTop =
    document.getElementById(
      "cancelWorkEdit"
    );

  const cancelBottom =
    document.getElementById(
      "cancelWorkEditBottom"
    );


  const closeEditor = () => {
    container.innerHTML = "";
    container.hidden = true;
  };


  if (cancelTop) {
    cancelTop.addEventListener(
      "click",
      closeEditor
    );
  }


  if (cancelBottom) {
    cancelBottom.addEventListener(
      "click",
      closeEditor
    );
  }


  if (form) {
    form.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await workManageSubmitEdit(
          form,
          job
        );
      }
    );
  }
}


/* ======================================================
   SUBMIT EDIT
====================================================== */

async function workManageSubmitEdit(
  form,
  originalJob
) {
  const id =
    workManageGetJobId();

  if (!id) {
    workManageShowMessage(
      "Invalid work ID."
    );
    return;
  }

  const user =
    workManageGetCurrentUser();

  if (
    !workManageCanManage(
      originalJob,
      user
    )
  ) {
    workManageShowMessage(
      "You do not have permission to edit this work."
    );
    return;
  }

  if (
    !workManageCanEdit(
      originalJob,
      user
    )
  ) {
    workManageShowMessage(
      "This work can no longer be edited."
    );
    return;
  }


  const formData =
    new FormData(form);


  const title =
    String(
      formData.get("title") || ""
    ).trim();

  const description =
    String(
      formData.get("description") || ""
    ).trim();

  const category =
    String(
      formData.get("category") || ""
    ).trim();

  const service =
    String(
      formData.get("service") || ""
    ).trim();

  const location =
    String(
      formData.get("location") || ""
    ).trim();

  const budgetRaw =
    String(
      formData.get("budget") || ""
    ).trim();


  if (!title) {
    workManageShowMessage(
      "Work title is required."
    );
    return;
  }

  if (title.length < 3) {
    workManageShowMessage(
      "Work title must be at least 3 characters."
    );
    return;
  }

  if (!description) {
    workManageShowMessage(
      "Description is required."
    );
    return;
  }


  let budget = "";

  if (budgetRaw !== "") {
    budget =
      Number(budgetRaw);

    if (
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      workManageShowMessage(
        "Please enter a valid budget."
      );
      return;
    }
  }


  const saveButton =
    form.querySelector(
      "#saveWorkEdit"
    );


  const originalText =
    saveButton
      ? saveButton.textContent
      : "Save Changes";


  try {
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        "Saving...";
    }


    const payload = {
      title,
      description,
      category,
      service,
      location,
      budget
    };


    const result =
      await workManageRequest(
        `/jobs/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
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
        "Unable to update work."
      );
    }


    workManageShowMessage(
      result.message ||
      "Work updated successfully."
    );


    window.location.reload();

  } catch (error) {
    console.error(
      "UPDATE WORK ERROR:",
      error
    );

    workManageShowMessage(
      error?.message ||
      "Unable to update work."
    );

  } finally {
    if (saveButton) {
      saveButton.disabled = false;

      saveButton.textContent =
        originalText;
    }
  }
}


/* ======================================================
   DELETE WORK
====================================================== */

async function workManageDelete(
  job
) {
  const id =
    workManageGetJobId();

  if (!id) {
    workManageShowMessage(
      "Invalid work ID."
    );
    return;
  }


  const user =
    workManageGetCurrentUser();


  if (
    !workManageCanDelete(
      job,
      user
    )
  ) {
    workManageShowMessage(
      "You do not have permission to delete this work."
    );
    return;
  }


  const confirmed =
    window.confirm(
      "Are you sure you want to delete this work request? This action cannot be undone."
    );


  if (!confirmed) {
    return;
  }


  const deleteButton =
    document.getElementById(
      "deleteWorkButton"
    );


  try {
    if (deleteButton) {
      deleteButton.disabled = true;
      deleteButton.textContent =
        "Deleting...";
    }


    const result =
      await workManageRequest(
        `/jobs/${encodeURIComponent(id)}`,
        {
          method: "DELETE"
        }
      );


    if (
      !result ||
      result.success !== true
    ) {
      throw new Error(
        result?.message ||
        "Unable to delete work."
      );
    }


    workManageShowMessage(
      result.message ||
      "Work deleted successfully."
    );


    window.location.href =
      "customer-dashboard.html";

  } catch (error) {
    console.error(
      "DELETE WORK ERROR:",
      error
    );

    workManageShowMessage(
      error?.message ||
      "Unable to delete work."
    );

    if (deleteButton) {
      deleteButton.disabled = false;
      deleteButton.textContent =
        "Delete Work";
    }
  }
}


/* ======================================================
   MANAGEMENT CONTROLS
====================================================== */

async function workManageInit() {
  const controls =
    document.getElementById(
      "workManagement"
    );

  const editor =
    document.getElementById(
      "workEditor"
    );

  if (!controls) {
    return;
  }


  const id =
    workManageGetJobId();

  if (!id) {
    controls.hidden = true;

    if (editor) {
      editor.hidden = true;
    }

    return;
  }


  try {
    const result =
      await workManageRequest(
        `/jobs/${encodeURIComponent(id)}`
      );


    if (
      !result ||
      result.success !== true ||
      !result.data
    ) {
      controls.hidden = true;

      if (editor) {
        editor.hidden = true;
      }

      return;
    }


    const job =
      result.data;

    const user =
      workManageGetCurrentUser();


    const canManage =
      workManageCanManage(
        job,
        user
      );


    if (!canManage) {
      controls.hidden = true;

      if (editor) {
        editor.hidden = true;
      }

      return;
    }


    controls.hidden = false;


    const editButton =
      document.getElementById(
        "editWorkButton"
      );

    const deleteButton =
      document.getElementById(
        "deleteWorkButton"
      );


    const canEdit =
      workManageCanEdit(
        job,
        user
      );

    const canDelete =
      workManageCanDelete(
        job,
        user
      );


    if (editButton) {
      editButton.hidden =
        !canEdit;

      if (canEdit) {
        editButton.addEventListener(
          "click",
          () => {
            if (!editor) {
              return;
            }

            editor.hidden = false;

            workManageRenderEditForm(
              editor,
              job
            );

            editor.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });
          }
        );
      }
    }


    if (deleteButton) {
      deleteButton.hidden =
        !canDelete;

      if (canDelete) {
        deleteButton.addEventListener(
          "click",
          () => {
            workManageDelete(job);
          }
        );
      }
    }


    if (
      !canEdit &&
      !canDelete
    ) {
      controls.hidden = true;
    }

  } catch (error) {
    console.error(
      "WORK MANAGEMENT INIT ERROR:",
      error
    );

    controls.hidden = true;

    if (editor) {
      editor.hidden = true;
    }
  }
}


/* ======================================================
   INITIALIZATION
====================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    workManageInit();
  }
);


/* ======================================================
   PUBLIC API
====================================================== */

window.workManageInit =
  workManageInit;

window.workManageDelete =
  workManageDelete;

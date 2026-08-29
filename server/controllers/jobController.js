import mongoose from "mongoose";

import Job, {
  JOB_STATUSES
} from "../models/Job.js";

import Booking from "../models/Booking.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isOwner(job, userId) {
  return (
    String(job.customerId) ===
    String(userId)
  );
}

function publicJobCustomerFields() {
  return "name location";
}

function normalizeText(value, maxLength = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parsePositiveInteger(
  value,
  fallback,
  max
) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    Math.max(number, 1),
    max
  );
}

function isValidStatus(status) {
  return JOB_STATUSES.includes(status);
}

function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function canViewCustomerJobs(req, customerId) {
  return (
    req.user &&
    (
      req.user.role === "admin" ||
      String(req.user.id) ===
        String(customerId)
    )
  );
}

/*
========================================
CREATE JOB
========================================
*/

export async function createJob(req, res) {
  try {
    if (
      req.user.role !== "customer" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only customers can create jobs."
      });
    }

    const {
      title,
      description,
      category,
      service,
      location,
      budget
    } = req.body || {};

    const cleanTitle =
      normalizeText(title, 200);

    const cleanDescription =
      normalizeText(description, 5000);

    if (!cleanTitle || !cleanDescription) {
      return res.status(400).json({
        success: false,
        message:
          "Title and description are required."
      });
    }

    if (cleanTitle.length < 3) {
      return res.status(400).json({
        success: false,
        message:
          "Title must be at least 3 characters."
      });
    }

    let normalizedBudget = null;

    if (
      budget !== undefined &&
      budget !== null &&
      budget !== ""
    ) {
      normalizedBudget = Number(budget);

      if (
        !Number.isFinite(normalizedBudget) ||
        normalizedBudget < 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Budget must be a valid non-negative number."
        });
      }
    }

    const job = await Job.create({
      title: cleanTitle,
      description: cleanDescription,
      category: normalizeText(
        category,
        100
      ),
      service: normalizeText(
        service,
        150
      ),
      location: normalizeText(
        location,
        200
      ),
      budget: normalizedBudget,
      customerId: req.user.id,
      status: "open"
    });

    return res.status(201).json({
      success: true,
      message:
        "Job created successfully.",
      data: job
    });

  } catch (error) {
    console.error(
      "CREATE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create job."
    });
  }
}

/*
========================================
GET JOBS
========================================
*/

export async function getJobs(req, res) {
  try {
    const {
      status,
      category,
      service,
      location,
      customerId,
      search,
      page,
      limit
    } = req.query;

    const filter = {};

    /*
      CUSTOMER DASHBOARD JOBS
    */

    if (customerId) {
      if (!isValidId(customerId)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid customer ID."
        });
      }

      if (!canViewCustomerJobs(
        req,
        customerId
      )) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view these jobs."
        });
      }

      filter.customerId = customerId;

      if (status) {
        const requestedStatus =
          normalizeText(
            status,
            50
          ).toLowerCase();

        if (
          !isValidStatus(
            requestedStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid job status."
          });
        }

        filter.status =
          requestedStatus;
      }

    } else {
      /*
        PUBLIC JOB LIST:
        only OPEN jobs are public.
      */

      filter.status = "open";
    }

    /*
      CATEGORY FILTER
    */

    if (category) {
      const value =
        normalizeText(
          category,
          100
        );

      if (value) {
        filter.category = {
          $regex: escapeRegex(value),
          $options: "i"
        };
      }
    }

    /*
      SERVICE FILTER
    */

    if (service) {
      const value =
        normalizeText(
          service,
          150
        );

      if (value) {
        filter.service = {
          $regex: escapeRegex(value),
          $options: "i"
        };
      }
    }

    /*
      LOCATION FILTER
    */

    if (location) {
      const value =
        normalizeText(
          location,
          200
        );

      if (value) {
        filter.location = {
          $regex: escapeRegex(value),
          $options: "i"
        };
      }
    }

    /*
      SEARCH
    */

    if (search) {
      const searchText =
        normalizeText(
          search,
          200
        );

      if (searchText) {
        const safeSearch =
          escapeRegex(searchText);

        filter.$or = [
          {
            title: {
              $regex: safeSearch,
              $options: "i"
            }
          },
          {
            description: {
              $regex: safeSearch,
              $options: "i"
            }
          },
          {
            category: {
              $regex: safeSearch,
              $options: "i"
            }
          },
          {
            service: {
              $regex: safeSearch,
              $options: "i"
            }
          },
          {
            location: {
              $regex: safeSearch,
              $options: "i"
            }
          }
        ];
      }
    }

    /*
      PAGINATION
    */

    const currentPage =
      parsePositiveInteger(
        page,
        1,
        100000
      );

    const pageLimit =
      parsePositiveInteger(
        limit,
        20,
        100
      );

    const skip =
      (currentPage - 1) *
      pageLimit;

    const [
      jobs,
      total
    ] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate(
          "customerId",
          publicJobCustomerFields()
        ),

      Job.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page: currentPage,
        limit: pageLimit,
        total,
        totalPages:
          Math.max(
            1,
            Math.ceil(
              total / pageLimit
            )
          ),
        hasNextPage:
          currentPage * pageLimit <
          total,
        hasPreviousPage:
          currentPage > 1
      },

      count: jobs.length,

      data: jobs
    });

  } catch (error) {
    console.error(
      "GET JOBS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch jobs."
    });
  }
}

/*
========================================
GET JOB BY ID
========================================
*/

export async function getJobById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid job ID."
      });
    }

    const job =
      await Job.findById(id)
        .populate(
          "customerId",
          publicJobCustomerFields()
        );

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found."
      });
    }

    /*
      Non-open jobs are private unless
      owner or admin.
    */

    if (
      job.status !== "open" &&
      !canViewCustomerJobs(
        req,
        job.customerId._id ||
          job.customerId
      )
    ) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: job
    });

  } catch (error) {
    console.error(
      "GET JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch job."
    });
  }
}

/*
========================================
UPDATE JOB
========================================
*/

export async function updateJob(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid job ID."
      });
    }

    const job =
      await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isOwner(
        job,
        req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update this job."
      });
    }

    /*
      Completed/cancelled jobs cannot
      be edited by customers.
    */

    if (
      req.user.role !== "admin" &&
      [
        "completed",
        "cancelled"
      ].includes(job.status)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This job can no longer be edited."
      });
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "service",
      "location",
      "budget"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (
        req.body?.[field] !== undefined
      ) {
        updates[field] =
          typeof req.body[field] ===
          "string"
            ? normalizeText(
                req.body[field],
                field === "description"
                  ? 5000
                  : field === "title"
                    ? 200
                    : field === "category"
                      ? 100
                      : field === "service"
                        ? 150
                        : 200
              )
            : req.body[field];
      }
    }

    /*
      Only admin can directly change
      status from this endpoint.
    */

    if (
      req.user.role === "admin" &&
      req.body?.status !== undefined
    ) {
      const newStatus =
        normalizeText(
          req.body.status,
          50
        ).toLowerCase();

      if (!isValidStatus(newStatus)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid job status."
        });
      }

      updates.status = newStatus;
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields provided."
      });
    }

    if (
      updates.title !== undefined &&
      updates.title.length < 3
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title must be at least 3 characters."
      });
    }

    if (
      updates.description !== undefined &&
      !updates.description
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description cannot be empty."
      });
    }

    if (
      updates.budget !== undefined
    ) {
      if (updates.budget === "") {
        updates.budget = null;
      } else {
        const amount =
          Number(updates.budget);

        if (
          !Number.isFinite(amount) ||
          amount < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Budget must be a valid non-negative number."
          });
        }

        updates.budget = amount;
      }
    }

    const updatedJob =
      await Job.findByIdAndUpdate(
        id,
        {
          $set: updates
        },
        {
          new: true,
          runValidators: true
        }
      ).populate(
        "customerId",
        publicJobCustomerFields()
      );

    return res.status(200).json({
      success: true,
      message:
        "Job updated successfully.",
      data: updatedJob
    });

  } catch (error) {
    console.error(
      "UPDATE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update job."
    });
  }
}

/*
========================================
DELETE JOB
========================================
*/

export async function deleteJob(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid job ID."
      });
    }

    const job =
      await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isOwner(
        job,
        req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to delete this job."
      });
    }

    const activeBooking =
      await Booking.exists({
        jobId: id,
        status: {
          $in: [
            "pending",
            "accepted",
            "confirmed",
            "in_progress"
          ]
        }
      });

    if (activeBooking) {
      return res.status(409).json({
        success: false,
        message:
          "Job has an active booking and cannot be deleted."
      });
    }

    await Job.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Job deleted successfully."
    });

  } catch (error) {
    console.error(
      "DELETE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete job."
    });
  }
}

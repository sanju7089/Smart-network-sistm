import mongoose from "mongoose";

import Job from "../models/Job.js";
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
    } = req.body;

    if (
      !title ||
      !String(title).trim() ||
      !description ||
      !String(description).trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title and description are required."
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
            "Budget must be a valid number."
        });
      }
    }

    const job = await Job.create({
      title: String(title).trim(),
      description:
        String(description).trim(),
      category: category
        ? String(category).trim()
        : "",
      service: service
        ? String(service).trim()
        : "",
      location: location
        ? String(location).trim()
        : "",
      budget: normalizedBudget,
      customerId: req.user.id,
      status: "open"
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully.",
      data: job
    });
  } catch (error) {
    console.error(
      "CREATE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to create job."
    });
  }
}

export async function getJobs(req, res) {
  try {
    const {
      status,
      category,
      service,
      location
    } = req.query;

    const filter = {};

    // Public API default:
    // केवल open jobs दिखें
    filter.status = status || "open";

    if (category) {
      filter.category = {
        $regex: String(category).trim(),
        $options: "i"
      };
    }

    if (service) {
      filter.service = {
        $regex: String(service).trim(),
        $options: "i"
      };
    }

    if (location) {
      filter.location = {
        $regex: String(location).trim(),
        $options: "i"
      };
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .populate(
        "customerId",
        publicJobCustomerFields()
      );

    return res.json({
      success: true,
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
      message: "Unable to fetch jobs."
    });
  }
}

export async function getJobById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID."
      });
    }

    const job = await Job.findById(id)
      .populate(
        "customerId",
        publicJobCustomerFields()
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    return res.json({
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
      message: "Unable to fetch job."
    });
  }
}

export async function updateJob(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID."
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isOwner(job, req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update this job."
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
      if (req.body[field] !== undefined) {
        updates[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    // केवल admin status बदल सकता है
    if (
      req.user.role === "admin" &&
      req.body.status !== undefined
    ) {
      updates.status = req.body.status;
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
              "Budget must be a valid number."
          });
        }

        updates.budget = amount;
      }
    }

    const updatedJob =
      await Job.findByIdAndUpdate(
        id,
        { $set: updates },
        {
          new: true,
          runValidators: true
        }
      );

    return res.json({
      success: true,
      message: "Job updated successfully.",
      data: updatedJob
    });
  } catch (error) {
    console.error(
      "UPDATE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update job."
    });
  }
}

export async function deleteJob(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID."
      });
    }

    const job = await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isOwner(job, req.user.id)
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

    return res.json({
      success: true,
      message: "Job deleted successfully."
    });
  } catch (error) {
    console.error(
      "DELETE JOB ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to delete job."
    });
  }
        }

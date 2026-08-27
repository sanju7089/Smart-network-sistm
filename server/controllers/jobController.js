import mongoose from "mongoose";
import Job from "../models/Job.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isOwner(job, userId) {
  return String(job.customerId) === String(userId);
}

export async function createJob(req, res) {
  try {
    const {
      title,
      description,
      category,
      service,
      location,
      budget
    } = req.body;

    if (req.user.role !== "customer" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only customers can create jobs."
      });
    }

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        message: "Title and description are required."
      });
    }

    if (
      budget !== undefined &&
      budget !== null &&
      budget !== "" &&
      (!Number.isFinite(Number(budget)) || Number(budget) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Budget must be a valid positive number."
      });
    }

    const job = await Job.create({
      title: String(title).trim(),
      description: String(description).trim(),
      category: category ? String(category).trim() : "",
      service: service ? String(service).trim() : "",
      location: location ? String(location).trim() : "",
      budget:
        budget === "" || budget === undefined || budget === null
          ? null
          : Number(budget),
      customerId: req.user.id
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully.",
      data: job
    });
  } catch (error) {
    console.error("CREATE JOB ERROR:", error);

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
      location,
      customerId
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (service) filter.service = service;
    if (location) filter.location = location;

    if (customerId) {
      if (!isValidId(customerId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID."
        });
      }

      filter.customerId = customerId;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .populate("customerId", "name email phone location");

    return res.json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    console.error("GET JOBS ERROR:", error);

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
      .populate("customerId", "name email phone location");

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
    console.error("GET JOB ERROR:", error);

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

    if (req.user.role !== "admin" && !isOwner(job, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this job."
      });
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "service",
      "location",
      "budget",
      "status"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update."
      });
    }

    if (
      updates.budget !== undefined &&
      updates.budget !== null &&
      updates.budget !== "" &&
      (!Number.isFinite(Number(updates.budget)) ||
        Number(updates.budget) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Budget must be a valid positive number."
      });
    }

    if (updates.budget === "") {
      updates.budget = null;
    } else if (
      updates.budget !== undefined &&
      updates.budget !== null
    ) {
      updates.budget = Number(updates.budget);
    }

    const updatedJob = await Job.findByIdAndUpdate(
      id,
      updates,
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
    console.error("UPDATE JOB ERROR:", error);

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

    if (req.user.role !== "admin" && !isOwner(job, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to delete this job."
      });
    }

    await Job.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Job deleted successfully."
    });
  } catch (error) {
    console.error("DELETE JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete job."
    });
  }
}

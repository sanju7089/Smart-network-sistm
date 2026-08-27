import mongoose from "mongoose";
import Worker from "../models/Worker.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isWorkerOwner(worker, userId) {
  return String(worker.userId) === String(userId);
}

export async function getWorkers(req, res) {
  try {
    const { service, location, verified } = req.query;

    const filter = {
      isActive: true
    };

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

    if (verified === "true") {
      filter.verified = true;
    }

    const workers = await Worker.find(filter)
      .sort({ verified: -1, createdAt: -1 })
      .populate("userId", "email role");

    return res.json({
      success: true,
      count: workers.length,
      data: workers
    });
  } catch (error) {
    console.error("GET WORKERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch workers."
    });
  }
}

export async function getWorkerById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID."
      });
    }

    const worker = await Worker.findById(id)
      .populate("userId", "email role");

    if (!worker || !worker.isActive) {
      return res.status(404).json({
        success: false,
        message: "Worker not found."
      });
    }

    return res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error("GET WORKER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch worker."
    });
  }
}

export async function getMyWorkerProfile(req, res) {
  try {
    const worker = await Worker.findOne({
      userId: req.user.id
    }).populate("userId", "email role");

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found."
      });
    }

    return res.json({
      success: true,
      data: worker
    });
  } catch (error) {
    console.error("GET MY WORKER PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch worker profile."
    });
  }
}

export async function createWorkerProfile(req, res) {
  try {
    if (req.user.role !== "worker" && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only workers can create a worker profile."
      });
    }

    const existingWorker = await Worker.findOne({
      userId: req.user.id
    });

    if (existingWorker) {
      return res.status(409).json({
        success: false,
        message: "Worker profile already exists."
      });
    }

    const {
      name,
      service,
      location,
      phone,
      experience,
      bio
    } = req.body;

    if (!name || !service) {
      return res.status(400).json({
        success: false,
        message: "Name and service are required."
      });
    }

    const worker = await Worker.create({
      userId: req.user.id,
      name: String(name).trim(),
      service: String(service).trim(),
      location: location ? String(location).trim() : "",
      phone: phone ? String(phone).trim() : "",
      experience: experience ? String(experience).trim() : "",
      bio: bio ? String(bio).trim() : ""
    });

    return res.status(201).json({
      success: true,
      message: "Worker profile created successfully.",
      data: worker
    });
  } catch (error) {
    console.error("CREATE WORKER PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create worker profile."
    });
  }
}

export async function updateWorkerProfile(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid worker ID."
      });
    }

    const worker = await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker profile not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isWorkerOwner(worker, req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this profile."
      });
    }

    const allowedFields = [
      "name",
      "service",
      "location",
      "phone",
      "experience",
      "bio"
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

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update."
      });
    }

    const updatedWorker = await Worker.findByIdAndUpdate(
      id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    return res.json({
      success: true,
      message: "Worker profile updated successfully.",
      data: updatedWorker
    });
  } catch (error) {
    console.error("UPDATE WORKER PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update worker profile."
    });
  }
      }

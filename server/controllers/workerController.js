import mongoose from "mongoose";

import Worker from "../models/Worker.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isWorkerOwner(worker, userId) {
  return (
    String(worker.userId) ===
    String(userId)
  );
}

function normalizeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function isMeaningful(value) {
  const text = normalizeText(value);

  return (
    text.length > 0 &&
    text.toLowerCase() !== "not specified"
  );
}

function calculateProfileCompleted(worker) {
  return Boolean(
    isMeaningful(worker.name) &&
    isMeaningful(worker.service) &&
    isMeaningful(worker.location) &&
    isMeaningful(worker.phone)
  );
}

function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const number =
    Number.parseInt(value, 10);

  if (
    !Number.isFinite(number) ||
    number < 1
  ) {
    return fallback;
  }

  return Math.min(number, maximum);
}

function publicWorkerFields() {
  return [
    "name",
    "service",
    "location",
    "phone",
    "experience",
    "bio",
    "verified",
    "profileCompleted",
    "createdAt",
    "updatedAt"
  ].join(" ");
}

/*
========================================
GET PUBLIC WORKERS
========================================
*/

export async function getWorkers(req, res) {
  try {
    const {
      service,
      location,
      verified,
      search,
      page,
      limit
    } = req.query;

    const filter = {
      isActive: true,
      profileCompleted: true
    };

    if (
      verified === "true"
    ) {
      filter.verified = true;
    }

    if (
      verified !== undefined &&
      verified !== "true" &&
      verified !== "false"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Verified must be true or false."
      });
    }

    if (
      verified === "false"
    ) {
      filter.verified = false;
    }

    if (service) {
      const value =
        normalizeText(service, 100);

      if (value) {
        filter.service = {
          $regex: escapeRegex(value),
          $options: "i"
        };
      }
    }

    if (location) {
      const value =
        normalizeText(location, 200);

      if (value) {
        filter.location = {
          $regex: escapeRegex(value),
          $options: "i"
        };
      }
    }

    if (search) {
      const value =
        normalizeText(search, 200);

      if (value) {
        const safeSearch =
          escapeRegex(value);

        filter.$or = [
          {
            name: {
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
          },
          {
            bio: {
              $regex: safeSearch,
              $options: "i"
            }
          }
        ];
      }
    }

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
      workers,
      total
    ] = await Promise.all([
      Worker.find(
        filter,
        publicWorkerFields()
      )
        .sort({
          verified: -1,
          createdAt: -1
        })
        .skip(skip)
        .limit(pageLimit),

      Worker.countDocuments(filter)
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

      count: workers.length,

      data: workers
    });

  } catch (error) {
    console.error(
      "GET WORKERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch workers."
    });
  }
}

/*
========================================
GET PUBLIC WORKER BY ID
========================================
*/

export async function getWorkerById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid worker ID."
      });
    }

    const worker =
      await Worker.findOne(
        {
          _id: id,
          isActive: true,
          profileCompleted: true
        },
        publicWorkerFields()
      );

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: worker
    });

  } catch (error) {
    console.error(
      "GET WORKER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch worker."
    });
  }
}

/*
========================================
GET MY WORKER PROFILE
========================================
*/

export async function getMyWorkerProfile(
  req,
  res
) {
  try {
    const worker =
      await Worker.findOne({
        userId: req.user.id
      });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker profile not found."
      });
    }

    return res.status(200).json({
      success: true,
      data: worker
    });

  } catch (error) {
    console.error(
      "GET MY WORKER PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch worker profile."
    });
  }
}

/*
========================================
CREATE WORKER PROFILE
========================================
*/

export async function createWorkerProfile(
  req,
  res
) {
  try {
    if (
      req.user.role !== "worker" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only workers can create a worker profile."
      });
    }

    const existingWorker =
      await Worker.findOne({
        userId: req.user.id
      });

    if (existingWorker) {
      return res.status(409).json({
        success: false,
        message:
          "Worker profile already exists. Please update your existing profile."
      });
    }

    const {
      name,
      service,
      location,
      phone,
      experience,
      bio
    } = req.body || {};

    const cleanName =
      normalizeText(name, 100);

    const cleanService =
      normalizeText(service, 100);

    const cleanLocation =
      normalizeText(location, 200);

    const cleanPhone =
      normalizeText(phone, 30);

    const cleanExperience =
      normalizeText(experience, 100);

    const cleanBio =
      normalizeText(bio, 2000);

    if (
      !isMeaningful(cleanName) ||
      !isMeaningful(cleanService) ||
      !isMeaningful(cleanLocation) ||
      !isMeaningful(cleanPhone)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, service, location and phone are required."
      });
    }

    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters."
      });
    }

    if (cleanService.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "Service must be at least 2 characters."
      });
    }

    const worker = await Worker.create({
      userId: req.user.id,

      name: cleanName,
      service: cleanService,
      location: cleanLocation,
      phone: cleanPhone,
      experience: cleanExperience,
      bio: cleanBio,

      verified: false,
      isActive: true,

      profileCompleted:
        calculateProfileCompleted({
          name: cleanName,
          service: cleanService,
          location: cleanLocation,
          phone: cleanPhone
        })
    });

    return res.status(201).json({
      success: true,
      message:
        "Worker profile created successfully.",
      data: worker
    });

  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Worker profile already exists."
      });
    }

    console.error(
      "CREATE WORKER PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create worker profile."
    });
  }
}

/*
========================================
UPDATE WORKER PROFILE
========================================
*/

export async function updateWorkerProfile(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid worker ID."
      });
    }

    const worker =
      await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker profile not found."
      });
    }

    if (
      req.user.role !== "admin" &&
      !isWorkerOwner(
        worker,
        req.user.id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update this profile."
      });
    }

    const fieldLimits = {
      name: 100,
      service: 100,
      location: 200,
      phone: 30,
      experience: 100,
      bio: 2000
    };

    const updates = {};

    for (
      const [
        field,
        maxLength
      ] of Object.entries(
        fieldLimits
      )
    ) {
      if (
        req.body?.[field] !== undefined
      ) {
        updates[field] =
          normalizeText(
            req.body[field],
            maxLength
          );
      }
    }

    /*
      Admin-only fields.
      Workers cannot verify or disable
      themselves.
    */

    if (
      req.user.role === "admin"
    ) {
      if (
        typeof req.body?.verified ===
        "boolean"
      ) {
        updates.verified =
          req.body.verified;
      }

      if (
        typeof req.body?.isActive ===
        "boolean"
      ) {
        updates.isActive =
          req.body.isActive;
      }
    }

    if (
      Object.keys(updates).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields provided for update."
      });
    }

    if (
      updates.name !== undefined &&
      updates.name.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name must be at least 2 characters."
      });
    }

    if (
      updates.service !== undefined &&
      updates.service.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Service must be at least 2 characters."
      });
    }

    Object.assign(
      worker,
      updates
    );

    worker.profileCompleted =
      calculateProfileCompleted(
        worker
      );

    await worker.save();

    return res.status(200).json({
      success: true,
      message:
        worker.profileCompleted
          ? "Worker profile updated successfully."
          : "Worker profile updated. Please complete all required details.",
      data: worker
    });

  } catch (error) {
    console.error(
      "UPDATE WORKER PROFILE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update worker profile."
    });
  }
}

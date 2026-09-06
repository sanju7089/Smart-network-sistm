import mongoose from "mongoose";

import LiveLocation from "../models/LiveLocation.js";
import Job from "../models/Job.js";
import Worker from "../models/Worker.js";

const DEFAULT_RADIUS_KM = 30;
const MAX_RADIUS_KM = 500;

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function numberValue(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function validateCoordinates(latitude, longitude) {
  return (
    latitude !== null &&
    longitude !== null &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function getRadiusKm(value) {
  const radius = Number(value);

  if (!Number.isFinite(radius)) {
    return DEFAULT_RADIUS_KM;
  }

  return Math.min(
    Math.max(radius, DEFAULT_RADIUS_KM),
    MAX_RADIUS_KM
  );
}

function getUserId(req) {
  return req.user?.id || req.user?._id || null;
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function publicDistanceKm(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return null;
  }

  return Number(
    (distanceMeters / 1000).toFixed(2)
  );
}

/*
 * SAVE / UPDATE JOB LOCATION
 */
export async function updateJobLocation(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID."
      });
    }

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const job = await Job.findById(id).select(
      "customerId status"
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    if (
      !isAdmin(req) &&
      String(job.customerId) !== String(userId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not allowed to update this job location."
      });
    }

    const latitude = numberValue(
      req.body?.latitude
    );

    const longitude = numberValue(
      req.body?.longitude
    );

    if (
      !validateCoordinates(
        latitude,
        longitude
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required."
      });
    }

    const location =
      await LiveLocation.findOneAndUpdate(
        {
          entityType: "job",
          entityId: job._id
        },
        {
          $set: {
            userId,
            latitude,
            longitude,
            point: {
              type: "Point",
              coordinates: [
                longitude,
                latitude
              ]
            },
            updatedAt: new Date()
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

    return res.json({
      success: true,
      message:
        "Job live location saved successfully.",
      data: {
        entityType: "job",
        entityId: job._id,
        updatedAt: location.updatedAt
      }
    });
  } catch (error) {
    console.error(
      "UPDATE JOB LIVE LOCATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to save job live location."
    });
  }
}

/*
 * SAVE / UPDATE WORKER LOCATION
 */
export async function updateWorkerLocation(
  req,
  res
) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const worker = await Worker.findOne({
      userId
    }).select("_id");

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker profile not found."
      });
    }

    const latitude = numberValue(
      req.body?.latitude
    );

    const longitude = numberValue(
      req.body?.longitude
    );

    if (
      !validateCoordinates(
        latitude,
        longitude
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required."
      });
    }

    const location =
      await LiveLocation.findOneAndUpdate(
        {
          entityType: "worker",
          entityId: worker._id
        },
        {
          $set: {
            userId,
            latitude,
            longitude,
            point: {
              type: "Point",
              coordinates: [
                longitude,
                latitude
              ]
            },
            updatedAt: new Date()
          }
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }
      );

    return res.json({
      success: true,
      message:
        "Worker live location saved successfully.",
      data: {
        entityType: "worker",
        entityId: worker._id,
        updatedAt: location.updatedAt
      }
    });
  } catch (error) {
    console.error(
      "UPDATE WORKER LIVE LOCATION ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to save worker live location."
    });
  }
}

/*
 * NEARBY JOBS
 * DEFAULT = 30 KM
 */
export async function getNearbyJobs(
  req,
  res
) {
  try {
    const latitude = numberValue(
      req.query?.latitude
    );

    const longitude = numberValue(
      req.query?.longitude
    );

    if (
      !validateCoordinates(
        latitude,
        longitude
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required."
      });
    }

    const radiusKm = getRadiusKm(
      req.query?.radiusKm
    );

    const radiusMeters =
      radiusKm * 1000;

    const locations =
      await LiveLocation.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                longitude,
                latitude
              ]
            },
            key: "point",
            distanceField: "distanceMeters",
            maxDistance: radiusMeters,
            spherical: true,
            query: {
              entityType: "job"
            }
          }
        },
        {
          $limit: 100
        }
      ]);

    const jobIds = locations.map(
      (item) => item.entityId
    );

    if (!jobIds.length) {
      return res.json({
        success: true,
        radiusKm,
        count: 0,
        data: []
      });
    }

    const jobs = await Job.find({
      _id: {
        $in: jobIds
      },
      status: "open"
    })
      .sort({
        createdAt: -1
      })
      .populate(
        "customerId",
        "name location"
      );

    const distanceMap = new Map(
      locations.map((item) => [
        String(item.entityId),
        publicDistanceKm(
          item.distanceMeters
        )
      ])
    );

    const data = jobs.map((job) => ({
      ...job.toObject(),
      distanceKm:
        distanceMap.get(
          String(job._id)
        ) ?? null
    }));

    data.sort(
      (a, b) =>
        (a.distanceKm ?? Infinity) -
        (b.distanceKm ?? Infinity)
    );

    return res.json({
      success: true,
      radiusKm,
      count: data.length,
      data
    });
  } catch (error) {
    console.error(
      "GET NEARBY JOBS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to find nearby jobs."
    });
  }
}

/*
 * NEARBY WORKERS
 * DEFAULT = 30 KM
 */
export async function getNearbyWorkers(
  req,
  res
) {
  try {
    const latitude = numberValue(
      req.query?.latitude
    );

    const longitude = numberValue(
      req.query?.longitude
    );

    if (
      !validateCoordinates(
        latitude,
        longitude
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid latitude and longitude are required."
      });
    }

    const radiusKm = getRadiusKm(
      req.query?.radiusKm
    );

    const radiusMeters =
      radiusKm * 1000;

    const locations =
      await LiveLocation.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                longitude,
                latitude
              ]
            },
            key: "point",
            distanceField: "distanceMeters",
            maxDistance: radiusMeters,
            spherical: true,
            query: {
              entityType: "worker"
            }
          }
        },
        {
          $limit: 100
        }
      ]);

    const workerIds = locations.map(
      (item) => item.entityId
    );

    if (!workerIds.length) {
      return res.json({
        success: true,
        radiusKm,
        count: 0,
        data: []
      });
    }

    const workers = await Worker.find({
      _id: {
        $in: workerIds
      },
      isActive: true,
      isAvailable: true,
      profileCompleted: true
    });

    const distanceMap = new Map(
      locations.map((item) => [
        String(item.entityId),
        publicDistanceKm(
          item.distanceMeters
        )
      ])
    );

    const data = workers.map((worker) => ({
      ...worker.toObject(),
      distanceKm:
        distanceMap.get(
          String(worker._id)
        ) ?? null
    }));

    data.sort(
      (a, b) =>
        (a.distanceKm ?? Infinity) -
        (b.distanceKm ?? Infinity)
    );

    return res.json({
      success: true,
      radiusKm,
      count: data.length,
      data
    });
  } catch (error) {
    console.error(
      "GET NEARBY WORKERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to find nearby workers."
    });
  }
}

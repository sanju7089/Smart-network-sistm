import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Worker from "../models/Worker.js";
import Job from "../models/Job.js";

const VALID_STATUSES = [
  "pending",
  "accepted",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "rejected"
];

const WORKER_TRANSITIONS = {
  pending: ["accepted", "rejected"],
  accepted: ["confirmed"],
  confirmed: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  rejected: []
};

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isAdmin(user) {
  return user?.role === "admin";
}

async function getWorkerForUser(userId) {
  return Worker.findOne({
    userId,
    isActive: true
  });
}

async function populateBooking(query) {
  return query
    .populate(
      "customerId",
      "name email phone location"
    )
    .populate({
      path: "workerId",
      select:
        "name service location phone verified userId",
      populate: {
        path: "userId",
        select: "email"
      }
    })
    .populate(
      "jobId",
      "title description category service location budget status"
    );
}

export async function getBookings(req, res) {
  try {
    const filter = {};
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    if (!isAdmin(req.user)) {
      if (req.user.role === "worker") {
        const worker =
          await getWorkerForUser(userId);

        if (!worker) {
          return res.json({
            success: true,
            count: 0,
            data: []
          });
        }

        filter.workerId = worker._id;
      } else {
        filter.customerId = userId;
      }
    }

    const bookings = await populateBooking(
      Booking.find(filter)
        .sort({ createdAt: -1 })
    );

    return res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error(
      "GET BOOKINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch bookings."
    });
  }
}

export async function getBookingById(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    const booking = await populateBooking(
      Booking.findById(id)
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    if (!isAdmin(req.user)) {
      const userId = String(req.user.id);

      const customerId =
        booking.customerId?._id
          ? String(booking.customerId._id)
          : String(booking.customerId);

      const workerUserId =
        booking.workerId?.userId
          ? String(
              booking.workerId.userId._id ||
              booking.workerId.userId
            )
          : "";

      if (
        customerId !== userId &&
        workerUserId !== userId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You do not have permission to view this booking."
        });
      }
    }

    return res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error(
      "GET BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to fetch booking."
    });
  }
}

export async function createBooking(req, res) {
  try {
    if (
      !req.user ||
      req.user.role !== "customer"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only customers can create bookings."
      });
    }

    const {
      workerId,
      jobId,
      date,
      notes
    } = req.body;

    if (
      !workerId ||
      !isValidId(workerId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid worker ID is required."
      });
    }

    const worker = await Worker.findOne({
      _id: workerId,
      isActive: true
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker not found or inactive."
      });
    }

    let validJobId = null;

    if (jobId) {
      if (!isValidId(jobId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid job ID."
        });
      }

      const job =
        await Job.findById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found."
        });
      }

      if (
        String(job.customerId) !==
        String(req.user.id)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only book workers for your own jobs."
        });
      }

      if (
        ["closed", "cancelled", "completed"]
          .includes(
            String(job.status || "")
              .toLowerCase()
          )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This job is no longer available for booking."
        });
      }

      validJobId = job._id;
    }

    let bookingDate = null;

    if (date) {
      bookingDate = new Date(date);

      if (
        Number.isNaN(
          bookingDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking date."
        });
      }

      if (
        bookingDate.getTime() <=
        Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Booking date must be in the future."
        });
      }
    }

    const cleanNotes =
      notes === undefined || notes === null
        ? ""
        : String(notes).trim();

    if (cleanNotes.length > 2000) {
      return res.status(400).json({
        success: false,
        message:
          "Notes cannot exceed 2000 characters."
      });
    }

    const duplicateFilter = {
      customerId: req.user.id,
      workerId: worker._id,
      status: {
        $in: [
          "pending",
          "accepted",
          "confirmed",
          "in_progress"
        ]
      }
    };

    if (validJobId) {
      duplicateFilter.jobId = validJobId;
    }

    const existingBooking =
      await Booking.findOne(
        duplicateFilter
      );

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message:
          "An active booking already exists for this worker."
      });
    }

    const booking =
      await Booking.create({
        customerId: req.user.id,
        workerId: worker._id,
        jobId: validJobId,
        date: bookingDate,
        notes: cleanNotes,
        status: "pending"
      });

    return res.status(201).json({
      success: true,
      message:
        "Booking created successfully.",
      data: booking
    });
  } catch (error) {
    console.error(
      "CREATE BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create booking."
    });
  }
}

export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const requestedStatus =
      String(
        req.body?.status || ""
      )
        .trim()
        .toLowerCase();

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    if (
      !VALID_STATUSES.includes(
        requestedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid booking status."
      });
    }

    const booking =
      await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const currentStatus =
      String(booking.status)
        .trim()
        .toLowerCase();

    if (currentStatus === requestedStatus) {
      return res.status(400).json({
        success: false,
        message:
          "Booking already has this status."
      });
    }

    if (isAdmin(req.user)) {
      booking.status = requestedStatus;
      await booking.save();

      return res.json({
        success: true,
        message:
          "Booking status updated successfully.",
        data: booking
      });
    }

    if (
      req.user?.role !== "worker"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only the assigned worker can update booking status."
      });
    }

    const worker =
      await getWorkerForUser(
        req.user.id
      );

    if (
      !worker ||
      String(worker._id) !==
        String(booking.workerId)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update this booking."
      });
    }

    const allowedNextStatuses =
      WORKER_TRANSITIONS[
        currentStatus
      ] || [];

    if (
      !allowedNextStatuses.includes(
        requestedStatus
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid status transition from ${currentStatus} to ${requestedStatus}.`
      });
    }

    booking.status =
      requestedStatus;

    await booking.save();

    return res.json({
      success: true,
      message:
        "Booking status updated successfully.",
      data: booking
    });
  } catch (error) {
    console.error(
      "UPDATE BOOKING STATUS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update booking."
    });
  }
}

export async function cancelBooking(req, res) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    const booking =
      await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const isCustomer =
      String(booking.customerId) ===
      String(req.user.id);

    if (
      !isAdmin(req.user) &&
      !isCustomer
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to cancel this booking."
      });
    }

    const status =
      String(booking.status)
        .toLowerCase();

    if (
      [
        "completed",
        "cancelled",
        "rejected"
      ].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "This booking cannot be cancelled."
      });
    }

    booking.status = "cancelled";

    await booking.save();

    return res.json({
      success: true,
      message:
        "Booking cancelled successfully.",
      data: booking
    });
  } catch (error) {
    console.error(
      "CANCEL BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to cancel booking."
    });
  }
        }

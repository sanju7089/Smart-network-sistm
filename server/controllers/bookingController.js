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

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isAdmin(user) {
  return user?.role === "admin";
}

async function getWorkerForUser(userId) {
  return Worker.findOne({ userId });
}

export async function getBookings(req, res) {
  try {
    const filter = {};
    const userId = req.user?.id;

    if (userId && !isAdmin(req.user)) {
      if (req.user.role === "worker") {
        const worker = await getWorkerForUser(userId);

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

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
      .populate("customerId", "name email phone location")
      .populate({
        path: "workerId",
        select: "name service location phone verified",
        populate: {
          path: "userId",
          select: "email"
        }
      })
      .populate("jobId", "title description category service location budget status");

    return res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error("GET BOOKINGS ERROR:", error);

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

    const booking = await Booking.findById(id)
      .populate("customerId", "name email phone location")
      .populate({
        path: "workerId",
        select: "name service location phone verified userId",
        populate: {
          path: "userId",
          select: "email"
        }
      })
      .populate("jobId", "title description category service location budget status");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    if (!isAdmin(req.user)) {
      const userId = String(req.user.id);
      const customerId = String(booking.customerId._id);

      let workerUserId = "";

      if (booking.workerId?.userId) {
        workerUserId = String(booking.workerId.userId._id || booking.workerId.userId);
      }

      if (customerId !== userId && workerUserId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to view this booking."
        });
      }
    }

    return res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error("GET BOOKING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch booking."
    });
  }
}

export async function createBooking(req, res) {
  try {
    if (!req.user || req.user.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can create bookings."
      });
    }

    const { workerId, jobId, date, notes } = req.body;

    if (!workerId || !isValidId(workerId)) {
      return res.status(400).json({
        success: false,
        message: "A valid worker ID is required."
      });
    }

    const worker = await Worker.findOne({
      _id: workerId,
      isActive: true
    });

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found or inactive."
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

      const job = await Job.findById(jobId);

      if (!job) {
        return res.status(404).json({
          success: false,
          message: "Job not found."
        });
      }

      if (String(job.customerId) !== String(req.user.id)) {
        return res.status(403).json({
          success: false,
          message: "You can only book workers for your own jobs."
        });
      }

      validJobId = job._id;
    }

    let bookingDate = null;

    if (date) {
      bookingDate = new Date(date);

      if (Number.isNaN(bookingDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking date."
        });
      }
    }

    const booking = await Booking.create({
      customerId: req.user.id,
      workerId: worker._id,
      jobId: validJobId,
      date: bookingDate,
      notes: notes ? String(notes).trim() : "",
      status: "pending"
    });

    return res.status(201).json({
      success: true,
      message: "Booking created successfully.",
      data: booking
    });
  } catch (error) {
    console.error("CREATE BOOKING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create booking."
    });
  }
}

export async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID."
      });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status."
      });
    }

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const worker = await Worker.findById(booking.workerId);

    const isBookingWorker =
      worker &&
      String(worker.userId) === String(req.user.id);

    if (!isAdmin(req.user) && !isBookingWorker) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to update this booking."
      });
    }

    booking.status = status;
    await booking.save();

    return res.json({
      success: true,
      message: "Booking status updated successfully.",
      data: booking
    });
  } catch (error) {
    console.error("UPDATE BOOKING STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update booking."
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

    const booking = await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found."
      });
    }

    const isCustomer =
      String(booking.customerId) === String(req.user.id);

    if (!isAdmin(req.user) && !isCustomer) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to cancel this booking."
      });
    }

    if (
      booking.status === "completed" ||
      booking.status === "cancelled"
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking cannot be cancelled."
      });
    }

    booking.status = "cancelled";
    await booking.save();

    return res.json({
      success: true,
      message: "Booking cancelled successfully.",
      data: booking
    });
  } catch (error) {
    console.error("CANCEL BOOKING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to cancel booking."
    });
  }
}

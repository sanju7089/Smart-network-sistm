import mongoose from "mongoose";

import Booking, {
  BOOKING_STATUSES
} from "../models/Booking.js";

import Job from "../models/Job.js";
import Worker from "../models/Worker.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeText(value, maxLength = 2000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function parsePositiveInteger(
  value,
  fallback,
  maximum
) {
  const number = Number.parseInt(value, 10);

  if (
    !Number.isFinite(number) ||
    number < 1
  ) {
    return fallback;
  }

  return Math.min(number, maximum);
}

function isAdmin(req) {
  return req.user?.role === "admin";
}

function isCustomerBooking(booking, userId) {
  return (
    String(booking.customerId) ===
    String(userId)
  );
}

function isWorkerBooking(
  booking,
  workerId
) {
  return (
    String(booking.workerId) ===
    String(workerId)
  );
}

function getWorkerUserId(worker) {
  return worker?.userId
    ? String(worker.userId)
    : null;
}

function canAccessBooking(
  req,
  booking,
  worker
) {
  if (isAdmin(req)) return true;

  if (
    isCustomerBooking(
      booking,
      req.user.id
    )
  ) {
    return true;
  }

  return (
    worker &&
    getWorkerUserId(worker) ===
      String(req.user.id)
  );
}

function canCancelBooking(
  req,
  booking,
  worker
) {
  if (isAdmin(req)) return true;

  if (
    isCustomerBooking(
      booking,
      req.user.id
    )
  ) {
    return [
      "pending",
      "accepted",
      "confirmed"
    ].includes(booking.status);
  }

  return (
    worker &&
    getWorkerUserId(worker) ===
      String(req.user.id) &&
    [
      "pending",
      "accepted",
      "confirmed"
    ].includes(booking.status)
  );
}

function getAllowedNextStatuses(
  currentStatus,
  actor
) {
  const workflows = {
    customer: {
      pending: ["cancelled"],
      accepted: [
        "confirmed",
        "cancelled"
      ],
      confirmed: ["cancelled"]
    },

    worker: {
      pending: [
        "accepted",
        "cancelled"
      ],

      accepted: [
        "confirmed",
        "cancelled"
      ],

      confirmed: [
        "in_progress",
        "cancelled"
      ],

      in_progress: [
        "completed"
      ]
    },

    admin: {
      pending: BOOKING_STATUSES,
      accepted: BOOKING_STATUSES,
      confirmed: BOOKING_STATUSES,
      in_progress: BOOKING_STATUSES,
      completed: BOOKING_STATUSES,
      cancelled: BOOKING_STATUSES
    }
  };

  return (
    workflows[actor]?.[
      currentStatus
    ] || []
  );
}

function applyStatusTimestamp(
  booking,
  status,
  userId
) {
  const now = new Date();

  switch (status) {
    case "accepted":
      booking.acceptedAt = now;
      break;

    case "confirmed":
      booking.confirmedAt = now;
      break;

    case "in_progress":
      booking.startedAt = now;
      break;

    case "completed":
      booking.completedAt = now;
      break;

    case "cancelled":
      booking.cancelledAt = now;
      booking.cancelledBy = userId;
      break;

    default:
      break;
  }
}

/*
========================================
CREATE BOOKING
========================================
*/

export async function createBooking(
  req,
  res
) {
  try {
    const {
      jobId,
      workerId,
      customerMessage
    } = req.body || {};

    if (
      !isValidId(jobId) ||
      !isValidId(workerId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid job ID and worker ID are required."
      });
    }

    if (
      req.user.role !== "customer" &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only customers can create bookings."
      });
    }

    const [
      job,
      worker
    ] = await Promise.all([
      Job.findById(jobId),

      Worker.findById(workerId)
    ]);

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found."
      });
    }

    if (!worker) {
      return res.status(404).json({
        success: false,
        message:
          "Worker not found."
      });
    }

    if (
      !worker.isActive ||
      !worker.profileCompleted
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This worker is not currently available for bookings."
      });
    }

    if (job.status !== "open") {
      return res.status(409).json({
        success: false,
        message:
          "This job is not available for booking."
      });
    }

    /*
      Customer can only book their own job.
      Admin may create/manage bookings.
    */

    if (
      !isAdmin(req) &&
      String(job.customerId) !==
        String(req.user.id)
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You can only create a booking for your own job."
      });
    }

    /*
      Worker cannot be the same user
      as the job customer.
    */

    if (
      String(worker.userId) ===
      String(job.customerId)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "You cannot book your own worker profile."
      });
    }

    const existingBooking =
      await Booking.findOne({
        jobId,
        workerId
      });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message:
          "A booking already exists for this worker and job.",
        data: existingBooking
      });
    }

    const booking =
      await Booking.create({
        jobId,
        customerId: job.customerId,
        workerId,
        status: "pending",
        customerMessage:
          normalizeText(
            customerMessage,
            2000
          )
      });

    return res.status(201).json({
      success: true,
      message:
        "Booking created successfully.",
      data: booking
    });

  } catch (error) {
    /*
      Handle duplicate unique index race.
    */

    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "A booking already exists for this worker and job."
      });
    }

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

/*
========================================
GET BOOKINGS
========================================
*/

export async function getBookings(
  req,
  res
) {
  try {
    const {
      status,
      page,
      limit
    } = req.query;

    const filter = {};

    /*
      ADMIN → ALL BOOKINGS
    */

    if (isAdmin(req)) {
      if (status) {
        const requestedStatus =
          normalizeText(
            status,
            50
          ).toLowerCase();

        if (
          !BOOKING_STATUSES.includes(
            requestedStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid booking status."
          });
        }

        filter.status =
          requestedStatus;
      }

    /*
      CUSTOMER → OWN BOOKINGS
    */

    } else if (
      req.user.role === "customer"
    ) {
      filter.customerId =
        req.user.id;

      if (status) {
        const requestedStatus =
          normalizeText(
            status,
            50
          ).toLowerCase();

        if (
          !BOOKING_STATUSES.includes(
            requestedStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid booking status."
          });
        }

        filter.status =
          requestedStatus;
      }

    /*
      WORKER → BOOKINGS FOR OWN PROFILE
    */

    } else if (
      req.user.role === "worker"
    ) {
      const worker =
        await Worker.findOne({
          userId: req.user.id
        }).select("_id");

      if (!worker) {
        return res.status(404).json({
          success: false,
          message:
            "Worker profile not found."
        });
      }

      filter.workerId = worker._id;

      if (status) {
        const requestedStatus =
          normalizeText(
            status,
            50
          ).toLowerCase();

        if (
          !BOOKING_STATUSES.includes(
            requestedStatus
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid booking status."
          });
        }

        filter.status =
          requestedStatus;
      }

    } else {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view bookings."
      });
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
      bookings,
      total
    ] = await Promise.all([
      Booking.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(pageLimit)
        .populate(
          "jobId",
          "title description category service location budget status"
        )
        .populate(
          "customerId",
          "name email phone location"
        )
        .populate(
          "workerId",
          "name service location phone verified"
        ),

      Booking.countDocuments(filter)
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
      message:
        "Unable to fetch bookings."
    });
  }
}

/*
========================================
GET BOOKING BY ID
========================================
*/

export async function getBookingById(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid booking ID."
      });
    }

    const booking =
      await Booking.findById(id)
        .populate(
          "jobId",
          "title description category service location budget status customerId"
        )
        .populate(
          "customerId",
          "name email phone location"
        )
        .populate(
          "workerId",
          "name service location phone verified userId"
        );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking not found."
      });
    }

    const worker =
      booking.workerId;

    if (
      !canAccessBooking(
        req,
        booking,
        worker
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to view this booking."
      });
    }

    /*
      Do not expose worker userId
      unnecessarily.
    */

    const bookingData =
      booking.toObject();

    if (
      bookingData.workerId
    ) {
      delete bookingData
        .workerId
        .userId;
    }

    return res.status(200).json({
      success: true,
      data: bookingData
    });

  } catch (error) {
    console.error(
      "GET BOOKING ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch booking."
    });
  }
}

/*
========================================
UPDATE BOOKING STATUS
========================================
*/

export async function updateBookingStatus(
  req,
  res
) {
  try {
    const { id } = req.params;

    const requestedStatus =
      normalizeText(
        req.body?.status,
        50
      ).toLowerCase();

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid booking ID."
      });
    }

    if (
      !BOOKING_STATUSES.includes(
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
        message:
          "Booking not found."
      });
    }

    let actor;

    if (isAdmin(req)) {
      actor = "admin";

    } else if (
      isCustomerBooking(
        booking,
        req.user.id
      )
    ) {
      actor = "customer";

    } else {
      const worker =
        await Worker.findById(
          booking.workerId
        ).select("userId");

      if (
        worker &&
        String(worker.userId) ===
          String(req.user.id)
      ) {
        actor = "worker";
      }
    }

    if (!actor) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update this booking."
      });
    }

    const allowedStatuses =
      getAllowedNextStatuses(
        booking.status,
        actor
      );

    if (
      !allowedStatuses.includes(
        requestedStatus
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          `Cannot change booking status from "${booking.status}" to "${requestedStatus}".`
      });
    }

    /*
      Prevent meaningless same-status updates.
    */

    if (
      booking.status ===
      requestedStatus
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Booking already has this status."
      });
    }

    booking.status =
      requestedStatus;

    applyStatusTimestamp(
      booking,
      requestedStatus,
      req.user.id
    );

    if (
      req.body?.workerMessage !==
        undefined &&
      actor === "worker"
    ) {
      booking.workerMessage =
        normalizeText(
          req.body.workerMessage,
          2000
        );
    }

    await booking.save();

    return res.status(200).json({
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
        "Unable to update booking status."
    });
  }
}

/*
========================================
CANCEL BOOKING
========================================
*/

export async function cancelBooking(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid booking ID."
      });
    }

    const booking =
      await Booking.findById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message:
          "Booking not found."
      });
    }

    const worker =
      await Worker.findById(
        booking.workerId
      ).select("userId");

    if (
      !canCancelBooking(
        req,
        booking,
        worker
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot cancel this booking."
      });
    }

    if (
      [
        "completed",
        "cancelled",
        "in_progress"
      ].includes(booking.status)
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This booking can no longer be cancelled."
      });
    }

    booking.status = "cancelled";

    applyStatusTimestamp(
      booking,
      "cancelled",
      req.user.id
    );

    await booking.save();

    return res.status(200).json({
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

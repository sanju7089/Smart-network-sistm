import mongoose from "mongoose";
import Razorpay from "razorpay";

import Booking, {
  BOOKING_STATUSES
} from "../models/Booking.js";

import Job from "../models/Job.js";
import Worker from "../models/Worker.js";
import Payment from "../models/Payment.js";


function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}


function normalizeText(
  value,
  maxLength = 2000
) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
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

  return Math.min(
    number,
    maximum
  );
}


function isAdmin(req) {
  return req.user?.role === "admin";
}


function isCustomerBooking(
  booking,
  userId
) {
  return (
    String(booking.customerId) ===
    String(userId)
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
  if (isAdmin(req)) {
    return true;
  }

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


/*
========================================
CANCELLATION PERMISSIONS
========================================

Customer:
  pending
  accepted
  confirmed

Worker:
  pending
  accepted
  confirmed

Admin:
  administrative override

Never cancellable:
  rejected
  in_progress
  completed
  cancelled
========================================
*/
function canCancelBooking(
  req,
  booking,
  worker
) {
  if (isAdmin(req)) {
    return true;
  }

  const cancellableStatuses = [
    "pending",
    "accepted",
    "confirmed"
  ];

  if (
    isCustomerBooking(
      booking,
      req.user.id
    )
  ) {
    return cancellableStatuses.includes(
      booking.status
    );
  }

  return (
    worker &&
    getWorkerUserId(worker) ===
      String(req.user.id) &&
    cancellableStatuses.includes(
      booking.status
    )
  );
}


/*
========================================
BOOKING WORKFLOW
========================================
*/
function getAllowedNextStatuses(
  currentStatus,
  actor
) {
  const workflows = {
    customer: {
      pending: [
        "cancelled"
      ],

      accepted: [
        "confirmed",
        "cancelled"
      ],

      confirmed: [
        "cancelled"
      ]
    },

    worker: {
      pending: [
        "accepted",
        "rejected",
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

    /*
      Admin may perform administrative
      status corrections.
    */
    admin: {
      pending: BOOKING_STATUSES,
      accepted: BOOKING_STATUSES,
      rejected: BOOKING_STATUSES,
      confirmed: BOOKING_STATUSES,
      in_progress: BOOKING_STATUSES,
      completed: BOOKING_STATUSES,
      cancelled: BOOKING_STATUSES
    }
  };

  return (
    workflows[actor]?.[currentStatus] ||
    []
  );
}


/*
========================================
STATUS TIMESTAMPS
========================================
*/
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

    case "rejected":
      booking.rejectedAt = now;
      booking.rejectedBy = userId;
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
RAZORPAY CLIENT
========================================
*/
function getRazorpayClient() {
  const keyId =
    String(
      process.env.RAZORPAY_KEY_ID || ""
    ).trim();

  const keySecret =
    String(
      process.env.RAZORPAY_KEY_SECRET || ""
    ).trim();

  if (!keyId || !keySecret) {
    const error =
      new Error(
        "Razorpay credentials are not configured."
      );

    error.statusCode = 500;

    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}


/*
========================================
REFUND PAID BOOKING PAYMENT
========================================

Important:

- Payment amount is stored in paise.
- Only successful paid Razorpay payment
  is refundable.
- Already refunded payment is ignored.
- Refund is completed before booking
  becomes cancelled.
- If refund fails, booking remains
  unchanged so money is not lost.
========================================
*/
async function refundBookingPayment(
  booking
) {
  const payment =
    await Payment.findOne({
      bookingId: booking._id,
      method: "razorpay",
      status: "paid"
    }).sort({
      createdAt: -1
    });

  if (!payment) {
    return {
      refunded: false,
      reason: "no_paid_payment"
    };
  }

  /*
    Already refunded.
  */
  if (
    payment.status ===
      "refunded" ||
    payment.refundId
  ) {
    return {
      refunded: true,
      alreadyRefunded: true,
      payment
    };
  }

  if (
    !payment.gatewayPaymentId
  ) {
    const error =
      new Error(
        "Paid payment does not have a Razorpay payment ID."
      );

    error.statusCode = 409;

    throw error;
  }

  const amount =
    Number(payment.amount);

  if (
    !Number.isSafeInteger(amount) ||
    amount < 100
  ) {
    const error =
      new Error(
        "Paid payment has an invalid refund amount."
      );

    error.statusCode = 409;

    throw error;
  }

  const razorpay =
    getRazorpayClient();

  let refund;

  try {
    refund =
      await razorpay.payments.refund(
        payment.gatewayPaymentId,
        {
          amount,

          notes: {
            bookingId:
              String(
                booking._id
              ),

            reason:
              "Booking cancelled"
          }
        }
      );
  } catch (error) {
    console.error(
      "RAZORPAY REFUND ERROR:",
      error
    );

    const refundError =
      new Error(
        "Payment refund could not be initiated. Booking was not cancelled."
      );

    refundError.statusCode =
      502;

    throw refundError;
  }

  if (
    !refund?.id
  ) {
    const error =
      new Error(
        "Razorpay did not return a refund ID. Booking was not cancelled."
      );

    error.statusCode = 502;

    throw error;
  }

  payment.status =
    "refunded";

  payment.refundId =
    String(refund.id);

  payment.refundAmount =
    amount;

  payment.refundedAt =
    new Date();

  await payment.save();

  return {
    refunded: true,
    alreadyRefunded: false,
    payment,
    refund
  };
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
      date,
      notes,
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

    let preferredDate = null;

    if (date) {
      preferredDate =
        new Date(date);

      if (
        Number.isNaN(
          preferredDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid preferred booking date."
        });
      }

      if (
        preferredDate.getTime() <=
        Date.now()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Preferred booking date must be in the future."
        });
      }
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
      !worker.profileCompleted ||
      worker.isAvailable !== true
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This worker is not currently available for bookings."
      });
    }

    if (
      job.status !== "open"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This job is not available for booking."
      });
    }

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
        data:
          existingBooking
      });
    }

    const finalCustomerMessage =
      normalizeText(
        customerMessage || notes,
        2000
      );

    const booking =
      await Booking.create({
        jobId,
        customerId:
          job.customerId,
        workerId,
        status:
          "pending",
        date:
          preferredDate,

        notes:
          normalizeText(
            notes,
            2000
          ),

        customerMessage:
          finalCustomerMessage
      });

    return res.status(201).json({
      success: true,
      message:
        "Booking created successfully.",
      data:
        booking
    });

  } catch (error) {
    if (
      error?.code === 11000
    ) {
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

    } else if (
      req.user.role === "worker"
    ) {

      const worker =
        await Worker.findOne({
          userId:
            req.user.id
        }).select("_id");

      if (!worker) {
        return res.status(404).json({
          success: false,
          message:
            "Worker profile not found."
        });
      }

      filter.workerId =
        worker._id;

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
          "title description category service location budget status customerId"
        )

        .populate(
          "customerId",
          "name email phone location"
        )

        .populate(
          "workerId",
          "name service location phone verified"
        ),

      Booking.countDocuments(
        filter
      )
    ]);

    return res.status(200).json({
      success: true,

      pagination: {
        page:
          currentPage,

        limit:
          pageLimit,

        total,

        totalPages:
          Math.max(
            1,
            Math.ceil(
              total /
                pageLimit
            )
          ),

        hasNextPage:
          currentPage *
            pageLimit <
          total,

        hasPreviousPage:
          currentPage > 1
      },

      count:
        bookings.length,

      data:
        bookings
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
    const { id } =
      req.params;

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
      data:
        bookingData
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
    const { id } =
      req.params;

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

    /*
      Cancellation has its own dedicated
      endpoint so refund logic cannot be
      bypassed through the normal status API.
    */
    if (
      requestedStatus ===
      "cancelled"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Use the booking cancellation endpoint to cancel a booking."
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
      data:
        booking
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

Customer:
  pending
  accepted
  confirmed

Worker:
  pending
  accepted
  confirmed

Admin:
  administrative cancellation

Payment:
  paid Razorpay payment
    ↓
  initiate full refund
    ↓
  refund successful
    ↓
  booking cancelled

If refund fails:
  booking remains unchanged.
========================================
*/
export async function cancelBooking(
  req,
  res
) {
  try {
    const { id } =
      req.params;

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

    const nonCancellableStatuses = [
      "completed",
      "cancelled",
      "in_progress",
      "rejected"
    ];

    if (
      nonCancellableStatuses.includes(
        booking.status
      )
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This booking can no longer be cancelled."
      });
    }

    /*
      Refund paid Razorpay payment before
      changing booking status.

      This prevents the dangerous state:

        booking = cancelled
        payment = paid
        money = not refunded
    */
    const refundResult =
      await refundBookingPayment(
        booking
      );

    /*
      If no paid payment exists,
      cancellation continues normally.

      If refund exists, it has already
      been successfully recorded.
    */

    booking.status =
      "cancelled";

    applyStatusTimestamp(
      booking,
      "cancelled",
      req.user.id
    );

    await booking.save();

    let message =
      "Booking cancelled successfully.";

    if (
      refundResult.refunded
    ) {
      if (
        refundResult.alreadyRefunded
      ) {
        message =
          "Booking cancelled successfully. Payment was already refunded.";
      } else {
        message =
          "Booking cancelled successfully. Full payment refund has been initiated.";
      }
    } else if (
      refundResult.reason ===
      "no_paid_payment"
    ) {
      message =
        "Booking cancelled successfully. No paid payment requires a refund.";
    }

    return res.status(200).json({
      success: true,
      message,

      data: {
        booking,
        refund: {
          required:
            refundResult.refunded,
          refunded:
            refundResult.refunded,
          alreadyRefunded:
            refundResult.alreadyRefunded ||
            false,
          refundId:
            refundResult.refund?.id ||
            refundResult.payment?.refundId ||
            null,
          refundAmount:
            refundResult.payment?.refundAmount ||
            0
        }
      }
    });

  } catch (error) {
    console.error(
      "CANCEL BOOKING ERROR:",
      error
    );

    return res.status(
      error.statusCode || 500
    ).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Unable to cancel booking."
    });
  }
}

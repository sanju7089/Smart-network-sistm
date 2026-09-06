import mongoose from "mongoose";
import Razorpay from "razorpay";

import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Job, { JOB_STATUSES } from "../models/Job.js";
import Payment, {
  PAYMENT_STATUSES
} from "../models/Payment.js";

/*
==================================================
ADMIN MANAGEMENT CONTROLLER
==================================================

Admin-only management endpoints used by:

server/routes/admin.js

Routes:
PATCH  /api/admin/jobs/:id
DELETE /api/admin/jobs/:id
PATCH  /api/admin/workers/:id
PATCH  /api/admin/payments/:id/status
POST   /api/admin/payments/:id/refund

The admin router already applies:
requireAuth
requireRole("admin")
==================================================
*/

/* ==================================================
   HELPERS
================================================== */

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function cleanString(value, maxLength = 2000) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim().slice(0, maxLength);
}

function isValidationError(error) {
  return error?.name === "ValidationError";
}

function isCastError(error) {
  return error?.name === "CastError";
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

function validationErrors(error) {
  const errors = {};

  for (const [field, value] of Object.entries(
    error?.errors || {}
  )) {
    errors[field] =
      value?.message || "Invalid value.";
  }

  return errors;
}

function errorResponse(res, error, fallbackMessage) {
  console.error(
    "ADMIN MANAGEMENT ERROR:",
    error
  );

  if (isValidationError(error)) {
    return res.status(400).json({
      success: false,
      message: "Invalid data.",
      errors: validationErrors(error)
    });
  }

  if (isCastError(error)) {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or data format."
    });
  }

  if (isDuplicateKeyError(error)) {
    return res.status(409).json({
      success: false,
      message:
        "A record with the same unique value already exists."
    });
  }

  const statusCode =
    Number.isInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  return res.status(statusCode).json({
    success: false,
    message:
      error?.message || fallbackMessage
  });
}

function setPaymentStatusDates(
  status,
  existingPayment = {}
) {
  const update = {};

  if (status === "paid") {
    update.paidAt =
      existingPayment.paidAt || new Date();
    update.failedAt = null;
    update.cancelledAt = null;
  }

  if (status === "failed") {
    update.failedAt =
      existingPayment.failedAt || new Date();
  }

  if (status === "cancelled") {
    update.cancelledAt =
      existingPayment.cancelledAt || new Date();
  }

  if (status === "refunded") {
    update.refundedAt =
      existingPayment.refundedAt || new Date();
  }

  return update;
}

function getRazorpayClient() {
  const keyId = String(
    process.env.RAZORPAY_KEY_ID || ""
  ).trim();

  const keySecret = String(
    process.env.RAZORPAY_KEY_SECRET || ""
  ).trim();

  if (!keyId || !keySecret) {
    const error = new Error(
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

/* ==================================================
   UPDATE ADMIN JOB
================================================== */

export async function updateAdminJob(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid job ID is required."
      });
    }

    const existingJob =
      await Job.findById(id);

    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    const body = req.body || {};
    const update = {};

    /*
    ------------------------------------------
    Only allow safe job fields.
    Never allow customerId to be changed
    through this generic admin endpoint.
    ------------------------------------------
    */

    if (body.title !== undefined) {
      const value = cleanString(
        body.title,
        200
      );

      if (!value || value.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Job title must contain at least 2 characters."
        });
      }

      update.title = value;
    }

    if (body.description !== undefined) {
      const value = cleanString(
        body.description,
        5000
      );

      if (!value || value.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Job description is required."
        });
      }

      update.description = value;
    }

    if (body.category !== undefined) {
      update.category =
        cleanString(body.category, 100) || "";
    }

    if (body.service !== undefined) {
      update.service =
        cleanString(body.service, 100) || "";
    }

    if (body.location !== undefined) {
      update.location =
        cleanString(body.location, 300) || "";
    }

    if (body.budget !== undefined) {
      if (
        body.budget === null ||
        body.budget === ""
      ) {
        update.budget = null;
      } else {
        const budget = Number(body.budget);

        if (
          !Number.isFinite(budget) ||
          budget < 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Budget must be a valid non-negative number."
          });
        }

        update.budget = budget;
      }
    }

    if (body.status !== undefined) {
      const status = String(
        body.status
      ).trim();

      if (!JOB_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid job status.",
          allowedStatuses: JOB_STATUSES
        });
      }

      update.status = status;
    }

    if (body.workerId !== undefined) {
      if (
        body.workerId === null ||
        body.workerId === ""
      ) {
        update.workerId = null;
      } else {
        if (!isValidId(body.workerId)) {
          return res.status(400).json({
            success: false,
            message:
              "Valid worker ID is required."
          });
        }

        const worker =
          await Worker.findById(
            body.workerId
          );

        if (!worker) {
          return res.status(404).json({
            success: false,
            message:
              "Selected worker was not found."
          });
        }

        update.workerId = worker._id;

        /*
        If a worker is assigned and no explicit
        status was supplied, move an open job
        to assigned.
        */
        if (
          body.status === undefined &&
          existingJob.status === "open"
        ) {
          update.status = "assigned";
        }
      }
    }

    if (
      Object.keys(update).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields were provided for update."
      });
    }

    const job =
      await Job.findByIdAndUpdate(
        id,
        {
          $set: update
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Job updated successfully.",
      data: job
    });
  } catch (error) {
    return errorResponse(
      res,
      error,
      "Unable to update job."
    );
  }
}

/* ==================================================
   DELETE ADMIN JOB
================================================== */

export async function deleteAdminJob(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Valid job ID is required."
      });
    }

    const job =
      await Job.findById(id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found."
      });
    }

    /*
    ------------------------------------------------
    SAFE DELETE:

    We intentionally cancel the job instead of
    physically deleting it.

    This preserves:
    - booking references
    - payment history
    - audit/history
    - notification history
    - database integrity
    ------------------------------------------------
    */

    if (job.status !== "cancelled") {
      job.status = "cancelled";
      await job.save();
    }

    return res.status(200).json({
      success: true,
      message:
        "Job cancelled successfully.",
      data: job
    });
  } catch (error) {
    return errorResponse(
      res,
      error,
      "Unable to delete job."
    );
  }
}

/* ==================================================
   UPDATE ADMIN WORKER
================================================== */

export async function updateAdminWorker(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid worker ID is required."
      });
    }

    const worker =
      await Worker.findById(id);

    if (!worker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found."
      });
    }

    const body = req.body || {};
    const update = {};

    /* ------------------------------------------
       TEXT FIELDS
    ------------------------------------------ */

    if (body.name !== undefined) {
      const value = cleanString(
        body.name,
        100
      );

      if (!value || value.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Worker name must contain at least 2 characters."
        });
      }

      update.name = value;
    }

    if (body.service !== undefined) {
      const value = cleanString(
        body.service,
        100
      );

      if (!value || value.length < 2) {
        return res.status(400).json({
          success: false,
          message:
            "Worker service must contain at least 2 characters."
        });
      }

      update.service = value;
    }

    if (body.location !== undefined) {
      update.location =
        cleanString(body.location, 300) || "";
    }

    if (body.phone !== undefined) {
      update.phone =
        cleanString(body.phone, 30) || "";
    }

    if (body.experience !== undefined) {
      update.experience =
        cleanString(body.experience, 100) || "";
    }

    if (body.bio !== undefined) {
      update.bio =
        cleanString(body.bio, 3000) || "";
    }

    /* ------------------------------------------
       SKILLS
    ------------------------------------------ */

    if (body.skills !== undefined) {
      if (!Array.isArray(body.skills)) {
        return res.status(400).json({
          success: false,
          message:
            "Skills must be an array."
        });
      }

      const skills = body.skills
        .map((skill) =>
          String(skill || "")
            .trim()
            .slice(0, 100)
        )
        .filter(Boolean)
        .slice(0, 50);

      update.skills = [
        ...new Set(skills)
      ];
    }

    /* ------------------------------------------
       BOOLEAN FIELDS
    ------------------------------------------ */

    const booleanFields = [
      "verified",
      "profileCompleted",
      "isActive",
      "isAvailable"
    ];

    for (const field of booleanFields) {
      if (body[field] !== undefined) {
        if (
          typeof body[field] !== "boolean"
        ) {
          return res.status(400).json({
            success: false,
            message:
              `${field} must be true or false.`
          });
        }

        update[field] = body[field];
      }
    }

    if (
      Object.keys(update).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "No valid fields were provided for update."
      });
    }

    const updatedWorker =
      await Worker.findByIdAndUpdate(
        id,
        {
          $set: update
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!updatedWorker) {
      return res.status(404).json({
        success: false,
        message: "Worker not found."
      });
    }

    /*
    Keep the linked user's active state
    consistent when admin changes worker
    availability/account activation.
    */
    if (
      body.isActive !== undefined &&
      updatedWorker.userId
    ) {
      await User.findByIdAndUpdate(
        updatedWorker.userId,
        {
          $set: {
            isActive: body.isActive
          }
        },
        {
          runValidators: true
        }
      );
    }

    return res.status(200).json({
      success: true,
      message:
        "Worker updated successfully.",
      data: updatedWorker
    });
  } catch (error) {
    return errorResponse(
      res,
      error,
      "Unable to update worker."
    );
  }
}

/* ==================================================
   UPDATE ADMIN PAYMENT STATUS
================================================== */

export async function updateAdminPaymentStatus(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid payment ID is required."
      });
    }

    const payment =
      await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found."
      });
    }

    const status = String(
      req.body?.status || ""
    ).trim();

    if (!PAYMENT_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment status.",
        allowedStatuses:
          PAYMENT_STATUSES
      });
    }

    /*
    Do not allow a normal status endpoint
    to manufacture a refund record.

    Refund must go through the dedicated
    refund endpoint.
    */
    if (
      status === "refunded" &&
      payment.status !== "refunded"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Use the refund endpoint to refund a payment."
      });
    }

    if (payment.status === "refunded") {
      return res.status(409).json({
        success: false,
        message:
          "A refunded payment cannot be moved to another status."
      });
    }

    if (payment.status === status) {
      return res.status(200).json({
        success: true,
        message:
          "Payment already has this status.",
        data: payment
      });
    }

    const dateFields =
      setPaymentStatusDates(
        status,
        payment
      );

    payment.status = status;

    for (const [key, value] of Object.entries(
      dateFields
    )) {
      payment[key] = value;
    }

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment status updated successfully.",
      data: payment
    });
  } catch (error) {
    return errorResponse(
      res,
      error,
      "Unable to update payment status."
    );
  }
}

/* ==================================================
   REFUND ADMIN PAYMENT
================================================== */

export async function refundAdminPayment(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid payment ID is required."
      });
    }

    const payment =
      await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found."
      });
    }

    /*
    Idempotent protection.
    */
    if (payment.status === "refunded") {
      return res.status(200).json({
        success: true,
        message:
          "Payment is already refunded.",
        data: payment
      });
    }

    if (payment.status !== "paid") {
      return res.status(409).json({
        success: false,
        message:
          "Only a paid payment can be refunded."
      });
    }

    if (payment.method !== "razorpay") {
      return res.status(409).json({
        success: false,
        message:
          "Only Razorpay payments can be refunded automatically."
      });
    }

    if (!payment.gatewayPaymentId) {
      return res.status(409).json({
        success: false,
        message:
          "Razorpay payment ID is missing. Automatic refund cannot be processed."
      });
    }

    const amount = Number(
      payment.amount
    );

    if (
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return res.status(409).json({
        success: false,
        message:
          "Payment amount is invalid for refund."
      });
    }

    /*
    Optional partial refund amount.

    Payment.amount is stored in paise.
    Therefore:
      body.amount = rupees
      converted to paise
    */

    let refundAmount = amount;

    if (
      req.body?.amount !== undefined &&
      req.body?.amount !== null &&
      req.body?.amount !== ""
    ) {
      const requestedAmount =
        Number(req.body.amount);

      if (
        !Number.isFinite(
          requestedAmount
        ) ||
        requestedAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Refund amount must be greater than zero."
        });
      }

      refundAmount = Math.round(
        requestedAmount * 100
      );

      if (
        !Number.isSafeInteger(
          refundAmount
        ) ||
        refundAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid refund amount."
        });
      }

      if (refundAmount > amount) {
        return res.status(400).json({
          success: false,
          message:
            "Refund amount cannot exceed the payment amount."
        });
      }
    }

    /*
    Prevent duplicate/over-refund attempts.
    */
    const alreadyRefunded =
      Number(payment.refundAmount || 0);

    if (
      alreadyRefunded > 0 &&
      alreadyRefunded >= amount
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This payment has already been fully refunded."
      });
    }

    const razorpay =
      getRazorpayClient();

    let refund;

    try {
      refund =
        await razorpay.payments.refund(
          payment.gatewayPaymentId,
          {
            amount: refundAmount,
            notes: {
              paymentId: String(
                payment._id
              ),
              bookingId: String(
                payment.bookingId
              ),
              refundedBy: "admin"
            }
          }
        );
    } catch (gatewayError) {
      console.error(
        "RAZORPAY REFUND ERROR:",
        gatewayError
      );

      const error = new Error(
        "Razorpay refund failed. Payment was not marked as refunded."
      );

      error.statusCode = 502;
      throw error;
    }

    if (!refund?.id) {
      const error = new Error(
        "Razorpay did not return a refund ID."
      );

      error.statusCode = 502;
      throw error;
    }

    /*
    ------------------------------------------
    Mark local payment as refunded only AFTER
    Razorpay confirms the refund.
    ------------------------------------------
    */

    payment.status = "refunded";
    payment.refundId =
      String(refund.id);
    payment.refundAmount =
      refundAmount;
    payment.refundedAt =
      new Date();

    await payment.save();

    return res.status(200).json({
      success: true,
      message:
        "Payment refunded successfully.",
      data: {
        payment,
        refund: {
          id: refund.id,
          amount:
            refund.amount,
          currency:
            refund.currency,
          status:
            refund.status
        }
      }
    });
  } catch (error) {
    return errorResponse(
      res,
      error,
      "Unable to refund payment."
    );
  }
}

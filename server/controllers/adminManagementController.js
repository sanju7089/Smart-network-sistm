import mongoose from "mongoose";
import Razorpay from "razorpay";

import Job, {
JOB_STATUSES
} from "../models/Job.js";

import Worker from "../models/Worker.js";

import Payment, {
PAYMENT_STATUSES
} from "../models/Payment.js";

import Booking from "../models/Booking.js";

function isValidId(id) {
return mongoose.Types.ObjectId.isValid(id);
}

function cleanText(value, maxLength = 2000) {
return String(value ?? "")
.trim()
.slice(0, maxLength);
}

function getRequiredEnv(name) {
const value = String(
process.env[name] || ""
).trim();

if (!value) {
const error = new Error(
"${name} is not configured."
);

error.statusCode = 500;

throw error;

}

return value;
}

function getRazorpayClient() {
return new Razorpay({
key_id: getRequiredEnv(
"RAZORPAY_KEY_ID"
),
key_secret: getRequiredEnv(
"RAZORPAY_KEY_SECRET"
)
});
}

/*

ADMIN JOB UPDATE

*/

export async function updateAdminJob(
req,
res
) {
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

const body = req.body || {};
const updates = {};

const textFields = {
  title: 200,
  description: 5000,
  category: 100,
  service: 150,
  location: 200
};

for (const [
  field,
  maxLength
] of Object.entries(textFields)) {
  if (body[field] !== undefined) {
    const value = cleanText(
      body[field],
      maxLength
    );

    if (
      field === "title" &&
      value.length < 3
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Job title must be at least 3 characters."
      });
    }

    if (
      field === "description" &&
      value.length < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Job description is required."
      });
    }

    updates[field] = value;
  }
}

if (body.budget !== undefined) {
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

  updates.budget = budget;
}

if (body.status !== undefined) {
  const status = cleanText(
    body.status,
    50
  ).toLowerCase();

  if (!JOB_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid job status."
    });
  }

  updates.status = status;
}

if (
  Object.keys(updates).length === 0
) {
  return res.status(400).json({
    success: false,
    message:
      "No valid job fields were provided."
  });
}

const updatedJob =
  await Job.findByIdAndUpdate(
    id,
    {
      $set: updates
    },
    {
      new: true,
      runValidators: true
    }
  ).populate(
    "customerId",
    "name email phone"
  );

return res.status(200).json({
  success: true,
  message:
    "Job updated successfully.",
  data: updatedJob
});

} catch (error) {
console.error(
"ADMIN JOB UPDATE ERROR:",
error
);

return res.status(
  error.statusCode || 500
).json({
  success: false,
  message:
    error.statusCode
      ? error.message
      : "Unable to update job."
});

}
}

/*

ADMIN JOB DELETE

*/

export async function deleteAdminJob(
req,
res
) {
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
      "This job cannot be deleted while an active booking exists."
  });
}

await Job.findByIdAndDelete(id);

return res.status(200).json({
  success: true,
  message:
    "Job deleted successfully.",
  data: {
    id
  }
});

} catch (error) {
console.error(
"ADMIN JOB DELETE ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Unable to delete job."
});

}
}

/*

ADMIN WORKER MANAGEMENT

*/

export async function updateAdminWorker(
req,
res
) {
try {
const { id } = req.params;

if (!isValidId(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid worker ID."
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

const body = req.body || {};
const updates = {};

if (
  body.verified !== undefined
) {
  if (
    typeof body.verified !==
    "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "verified must be true or false."
    });
  }

  updates.verified =
    body.verified;
}

if (
  body.isActive !== undefined
) {
  if (
    typeof body.isActive !==
    "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "isActive must be true or false."
    });
  }

  updates.isActive =
    body.isActive;

  if (
    body.isActive === false
  ) {
    updates.isAvailable = false;
  }
}

if (
  body.isAvailable !== undefined
) {
  if (
    typeof body.isAvailable !==
    "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "isAvailable must be true or false."
    });
  }

  if (
    body.isAvailable === true &&
    worker.isActive === false &&
    body.isActive !== true
  ) {
    return res.status(409).json({
      success: false,
      message:
        "An inactive worker cannot be made available."
    });
  }

  updates.isAvailable =
    body.isAvailable;
}

if (
  Object.keys(updates).length === 0
) {
  return res.status(400).json({
    success: false,
    message:
      "No valid worker management fields were provided."
  });
}

const updatedWorker =
  await Worker.findByIdAndUpdate(
    id,
    {
      $set: updates
    },
    {
      new: true,
      runValidators: true
    }
  );

return res.status(200).json({
  success: true,
  message:
    "Worker management status updated successfully.",
  data: updatedWorker
});

} catch (error) {
console.error(
"ADMIN WORKER UPDATE ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Unable to update worker."
});

}
}

/*

ADMIN PAYMENT STATUS

Admin cannot manually mark a payment as
"paid" or "refunded".

Those states must come from Razorpay
verification/webhook or the refund action.

Admin may cancel only an active
created/pending/processing payment.

*/

export async function updateAdminPaymentStatus(
req,
res
) {
try {
const { id } = req.params;
const status = cleanText(
req.body?.status,
30
).toLowerCase();

if (!isValidId(id)) {
  return res.status(400).json({
    success: false,
    message:
      "Invalid payment ID."
  });
}

if (
  !PAYMENT_STATUSES.includes(status)
) {
  return res.status(400).json({
    success: false,
    message:
      "Invalid payment status."
  });
}

const payment =
  await Payment.findById(id);

if (!payment) {
  return res.status(404).json({
    success: false,
    message:
      "Payment not found."
  });
}

if (
  status !== "cancelled"
) {
  return res.status(409).json({
    success: false,
    message:
      "Paid, failed and refunded states must be controlled by the payment gateway workflow."
  });
}

if (
  ![
    "created",
    "pending",
    "processing"
  ].includes(payment.status)
) {
  return res.status(409).json({
    success: false,
    message:
      "Only an active payment can be cancelled."
  });
}

const updatedPayment =
  await Payment.findOneAndUpdate(
    {
      _id: id,
      status: {
        $in: [
          "created",
          "pending",
          "processing"
        ]
      }
    },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date()
      }
    },
    {
      new: true
    }
  );

if (!updatedPayment) {
  return res.status(409).json({
    success: false,
    message:
      "Payment changed before it could be cancelled."
  });
}

return res.status(200).json({
  success: true,
  message:
    "Payment cancelled successfully.",
  data: updatedPayment
});

} catch (error) {
console.error(
"ADMIN PAYMENT STATUS ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Unable to update payment status."
});

}
}

/*

ADMIN RAZORPAY REFUND

*/

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
      "Invalid payment ID."
  });
}

const payment =
  await Payment.findById(id);

if (!payment) {
  return res.status(404).json({
    success: false,
    message:
      "Payment not found."
  });
}

if (
  payment.status === "refunded"
) {
  return res.status(200).json({
    success: true,
    message:
      "Payment is already refunded.",
    data: payment
  });
}

if (
  payment.status !== "paid"
) {
  return res.status(409).json({
    success: false,
    message:
      "Only a paid payment can be refunded."
  });
}

if (
  payment.method !== "razorpay"
) {
  return res.status(409).json({
    success: false,
    message:
      "Only Razorpay payments can be automatically refunded."
  });
}

if (
  !payment.gatewayPaymentId
) {
  return res.status(409).json({
    success: false,
    message:
      "Razorpay payment ID is missing."
  });
}

const razorpay =
  getRazorpayClient();

const refund =
  await razorpay.payments.refund(
    String(
      payment.gatewayPaymentId
    ),
    {
      amount: Number(
        payment.amount
      ),
      notes: {
        source:
          "smart-work-network-admin",
        paymentId:
          String(payment._id),
        bookingId:
          String(payment.bookingId)
      }
    }
  );

if (!refund?.id) {
  return res.status(502).json({
    success: false,
    message:
      "Razorpay did not return a refund ID."
  });
}

const refundAmount =
  Number(
    refund.amount ??
    payment.amount
  );

const updatedPayment =
  await Payment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "paid"
    },
    {
      $set: {
        status: "refunded",
        refundId:
          String(refund.id),
        refundAmount,
        refundedAt:
          new Date()
      }
    },
    {
      new: true
    }
  );

if (!updatedPayment) {
  return res.status(409).json({
    success: false,
    message:
      "Refund was processed but payment state could not be updated. Check Razorpay before retrying."
  });
}

/*
  Keep booking state consistent with
  a successful full administrative refund.
*/
await Booking.findOneAndUpdate(
  {
    _id: payment.bookingId,
    status: {
      $in: [
        "pending",
        "accepted",
        "confirmed",
        "in_progress"
      ]
    }
  },
  {
    $set: {
      status: "cancelled"
    }
  }
);

return res.status(200).json({
  success: true,
  message:
    "Payment refunded successfully.",
  data: updatedPayment
});

} catch (error) {
console.error(
"ADMIN PAYMENT REFUND ERROR:",
error
);

return res.status(
  error.statusCode || 500
).json({
  success: false,
  message:
    error.statusCode
      ? error.message
      : "Unable to refund payment."
});

}
}

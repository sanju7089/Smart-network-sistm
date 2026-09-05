import express from "express";

import Payment from "../models/Payment.js";
import Worker from "../models/Worker.js";
import Booking from "../models/Booking.js";

import {
requireAuth,
requireRole
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

const PAYMENT_HISTORY_STATUSES = [
"paid",
"refunded"
];

const MAX_HISTORY_LIMIT = 100;

function toSafeNumber(value) {
const number = Number(value);

return Number.isFinite(number)
? number
: 0;
}

function formatAmount(paise) {
return toSafeNumber(paise) / 100;
}

function normalizePagination(page, limit) {
const parsedPage = Number(page);
const parsedLimit = Number(limit);

const safePage =
Number.isInteger(parsedPage) &&
parsedPage >= 1
? parsedPage
: 1;

const safeLimit =
Number.isInteger(parsedLimit) &&
parsedLimit >= 1
? Math.min(
parsedLimit,
MAX_HISTORY_LIMIT
)
: 50;

return {
page: safePage,
limit: safeLimit,
skip:
(safePage - 1) *
safeLimit
};
}

function serializeBooking(booking) {
if (!booking) {
return null;
}

return {
id: booking._id,
status: booking.status,
date: booking.date,
completedAt:
booking.completedAt || null,

job: booking.jobId
  ? {
      id: booking.jobId._id,
      title: booking.jobId.title,
      category:
        booking.jobId.category,
      service:
        booking.jobId.service,
      location:
        booking.jobId.location,
      budget:
        booking.jobId.budget
    }
  : null

};
}

function serializePayment(payment) {
if (!payment) {
return null;
}

const amount =
toSafeNumber(payment.amount);

return {
id: payment._id,

transactionId:
  payment.transactionId ||
  payment.gatewayPaymentId ||
  payment.razorpayOrderId ||
  null,

razorpayPaymentId:
  payment.gatewayPaymentId ||
  null,

razorpayOrderId:
  payment.razorpayOrderId ||
  null,

amount:
  formatAmount(amount),

amountPaise:
  amount,

currency:
  payment.currency ||
  "INR",

method:
  payment.method ||
  null,

status:
  payment.status,

paidAt:
  payment.paidAt ||
  null,

refundedAt:
  payment.refundedAt ||
  null,

refundId:
  payment.refundId ||
  null,

refundAmount:
  toSafeNumber(
    payment.refundAmount
  ) > 0
    ? formatAmount(
        payment.refundAmount
      )
    : 0,

booking:
  serializeBooking(
    payment.bookingId
  )

};
}

/*

GET MY WORKER EARNINGS

*/

router.get(
"/me",
requireRole("worker"),
async (req, res) => {
try {
const {
page,
limit
} = req.query || {};

  const pagination =
    normalizePagination(
      page,
      limit
    );

  const worker =
    await Worker.findOne({
      userId: req.user.id
    })
      .select(
        "_id name service"
      )
      .lean();

  if (!worker) {
    return res.status(404).json({
      success: false,
      message:
        "Worker profile not found."
    });
  }

  const workerBookings =
    await Booking.find({
      workerId:
        worker._id
    })
      .select(
        "_id workerId jobId status date completedAt createdAt"
      )
      .populate(
        "jobId",
        "title category service location budget"
      )
      .sort({
        createdAt: -1
      })
      .lean();

  const bookingIds =
    workerBookings.map(
      (booking) =>
        booking._id
    );

  if (!bookingIds.length) {
    return res.status(200).json({
      success: true,

      data: {
        worker: {
          id:
            worker._id,
          name:
            worker.name,
          service:
            worker.service
        },

        currency: "INR",

        grossPaise: 0,
        grossAmount: 0,

        completedPaise: 0,
        completedAmount: 0,

        pendingWorkPaise: 0,
        pendingWorkAmount: 0,

        availablePaise: 0,
        availableAmount: 0,

        totalPaidBookings: 0,
        completedPaidBookings: 0,
        completedBookingCount: 0,

        pagination: {
          page:
            pagination.page,
          limit:
            pagination.limit,
          total: 0,
          totalPages: 0
        },

        payments: []
      }
    });
  }

  const allWorkerPayments =
    await Payment.find({
      bookingId: {
        $in:
          bookingIds
      },

      status: {
        $in:
          PAYMENT_HISTORY_STATUSES
      }
    })
      .select(
        [
          "bookingId",
          "amount",
          "currency",
          "method",
          "status",
          "razorpayOrderId",
          "gatewayPaymentId",
          "transactionId",
          "paidAt",
          "refundedAt",
          "refundId",
          "refundAmount",
          "createdAt"
        ].join(" ")
      )
      .populate({
        path:
          "bookingId",

        select:
          "_id workerId jobId status date completedAt",

        populate: {
          path:
            "jobId",

          select:
            "title category service location budget"
        }
      })
      .sort({
        paidAt: -1,
        createdAt: -1
      })
      .lean();

  const workerPayments =
    allWorkerPayments.filter(
      (payment) => {
        const booking =
          payment.bookingId;

        return (
          booking &&
          String(
            booking.workerId
          ) ===
            String(
              worker._id
            )
        );
      }
    );

  /*
  --------------------------------------------------
  FINANCIAL SAFETY

  One booking should represent one earning.

  If historical/legacy data contains more than one
  paid/refunded payment for the same booking, use
  only the newest payment record for earnings.

  This prevents accidental double counting.
  --------------------------------------------------
  */

  const latestPaymentByBooking =
    new Map();

  for (
    const payment of workerPayments
  ) {
    const booking =
      payment.bookingId;

    const bookingKey =
      booking?._id
        ? String(
            booking._id
          )
        : null;

    if (!bookingKey) {
      continue;
    }

    if (
      !latestPaymentByBooking.has(
        bookingKey
      )
    ) {
      latestPaymentByBooking.set(
        bookingKey,
        payment
      );
    }
  }

  const accountingPayments =
    Array.from(
      latestPaymentByBooking.values()
    );

  /*
  --------------------------------------------------
  CURRENTLY PAID PAYMENTS
  --------------------------------------------------
  */

  const paidPayments =
    accountingPayments.filter(
      (payment) =>
        payment.status ===
        "paid"
    );

  const grossPaise =
    paidPayments.reduce(
      (
        total,
        payment
      ) =>
        total +
        toSafeNumber(
          payment.amount
        ),
      0
    );

  /*
  --------------------------------------------------
  COMPLETED + PAID
  --------------------------------------------------
  */

  const completedPayments =
    paidPayments.filter(
      (payment) =>
        payment.bookingId &&
        payment.bookingId.status ===
          "completed"
    );

  const completedPaise =
    completedPayments.reduce(
      (
        total,
        payment
      ) =>
        total +
        toSafeNumber(
          payment.amount
        ),
      0
    );

  /*
  --------------------------------------------------
  PAID BUT WORK NOT COMPLETED
  --------------------------------------------------
  */

  const pendingWorkPayments =
    paidPayments.filter(
      (payment) =>
        payment.bookingId &&
        payment.bookingId.status !==
          "completed"
    );

  const pendingWorkPaise =
    pendingWorkPayments.reduce(
      (
        total,
        payment
      ) =>
        total +
        toSafeNumber(
          payment.amount
        ),
      0
    );

  /*
  --------------------------------------------------
  AVAILABLE EARNINGS

  No payout/withdrawal ledger exists yet.

  Therefore available earnings currently means:

  completed booking
  +
  successful paid payment
  -
  refunded payment

  Since refunded records are excluded above,
  completedPaise is the current available amount.
  --------------------------------------------------
  */

  const availablePaise =
    completedPaise;

  /*
  --------------------------------------------------
  TRANSACTION HISTORY

  Show paid/refunded transactions while keeping
  the accounting result protected from duplicates.
  --------------------------------------------------
  */

  const history =
    accountingPayments;

  const historyTotal =
    history.length;

  const totalPages =
    historyTotal > 0
      ? Math.ceil(
          historyTotal /
            pagination.limit
        )
      : 0;

  const paginatedHistory =
    history.slice(
      pagination.skip,
      pagination.skip +
        pagination.limit
    );

  return res.status(200).json({
    success: true,

    data: {
      worker: {
        id:
          worker._id,

        name:
          worker.name,

        service:
          worker.service
      },

      currency: "INR",

      grossPaise,

      grossAmount:
        formatAmount(
          grossPaise
        ),

      completedPaise,

      completedAmount:
        formatAmount(
          completedPaise
        ),

      pendingWorkPaise,

      pendingWorkAmount:
        formatAmount(
          pendingWorkPaise
        ),

      availablePaise,

      availableAmount:
        formatAmount(
          availablePaise
        ),

      totalPaidBookings:
        paidPayments.length,

      completedPaidBookings:
        completedPayments.length,

      completedBookingCount:
        completedPayments.length,

      pagination: {
        page:
          pagination.page,

        limit:
          pagination.limit,

        total:
          historyTotal,

        totalPages
      },

      payments:
        paginatedHistory.map(
          serializePayment
        )
    }
  });

} catch (error) {
  console.error(
    "GET WORKER EARNINGS ERROR:",
    error
  );

  return res.status(500).json({
    success: false,
    message:
      "Unable to fetch worker earnings."
  });
}

}
);

/*

ADMIN EARNINGS SUMMARY

*/

router.get(
"/admin/summary",
requireRole("admin"),
async (req, res) => {
try {
const payments =
await Payment.find({
status: "paid"
})
.select(
"amount currency"
)
.lean();

  const totalPaise =
    payments.reduce(
      (
        total,
        payment
      ) =>
        total +
        toSafeNumber(
          payment.amount
        ),
      0
    );

  return res.status(200).json({
    success: true,

    data: {
      currency: "INR",

      totalPaise,

      totalAmount:
        formatAmount(
          totalPaise
        ),

      paidPayments:
        payments.length
    }
  });

} catch (error) {
  console.error(
    "GET ADMIN EARNINGS ERROR:",
    error
  );

  return res.status(500).json({
    success: false,
    message:
      "Unable to fetch earnings summary."
  });
}

}
);

export default router;

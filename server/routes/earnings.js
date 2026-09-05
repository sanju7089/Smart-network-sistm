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

function formatAmount(paise) {
return Number(
paise || 0
) / 100;
}

function toSafeNumber(value) {
const number = Number(value);

return Number.isFinite(number)
? number
: 0;
}

function normalizePagination(
page,
limit
) {
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

function serializeBooking(
booking
) {
if (!booking) {
return null;
}

return {
id: booking._id,

status:
  booking.status,

date:
  booking.date,

completedAt:
  booking.completedAt,

job:
  booking.jobId
    ? {
        id:
          booking.jobId._id,

        title:
          booking.jobId.title,

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

function serializePayment(
payment
) {
if (!payment) {
return null;
}

const amount =
toSafeNumber(
payment.amount
);

const booking =
payment.bookingId;

return {
id:
payment._id,

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
  formatAmount(
    amount
  ),

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
  payment.refundAmount
    ? formatAmount(
        payment.refundAmount
      )
    : 0,

booking:
  serializeBooking(
    booking
  )

};
}

/*

GET MY WORKER EARNINGS

Rules:

1. Only authenticated workers can access this endpoint.
2. Earnings are based on server-side Payment records.
3. A payment belongs to a worker through:
   Payment -> Booking -> Worker
4. Only currently paid payments count as active earnings.
5. Refunded payments do not count as available earnings.
6. Available earnings means:
   paid payment + completed booking.
7. Paid but unfinished work is pending work amount.
8. Transaction history includes paid and refunded transactions.
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
      userId:
        req.user.id
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

  /*
  --------------------------------------------------
  STEP 1: Find only this worker's bookings.
  --------------------------------------------------
  */

  const workerBookings =
    await Booking.find({
      workerId:
        worker._id
    })
      .select(
        "_id workerId jobId status date completedAt"
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

  /*
  --------------------------------------------------
  No bookings = zero earnings.
  --------------------------------------------------
  */

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

  /*
  --------------------------------------------------
  STEP 2: Load payment records connected to those
          worker bookings.
  --------------------------------------------------
  */

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

  /*
  --------------------------------------------------
  STEP 3: Keep only payments whose populated booking
          actually belongs to this worker.
  --------------------------------------------------
  */

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
  STEP 4: Active paid transactions.
  Refunded transactions are historical records and
  must NOT be counted as currently earned money.
  --------------------------------------------------
  */

  const paidPayments =
    workerPayments.filter(
      (payment) =>
        payment.status ===
        "paid"
    );

  /*
  --------------------------------------------------
  STEP 5: Gross currently paid earnings.
  --------------------------------------------------
  */

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
  STEP 6: Paid payments where the work is completed.
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
  STEP 7: Paid but work is not completed yet.
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
  STEP 8: Available earnings.
  
  Available earnings are completed + paid earnings.
  
  There is currently no separate worker payout/
  withdrawal ledger in the system, so this represents
  money earned and available based on completed,
  successfully paid bookings.
  --------------------------------------------------
  */

  const availablePaise =
    completedPaise;

  /*
  --------------------------------------------------
  STEP 9: Paginate transaction history.
  --------------------------------------------------
  */

  const historyTotal =
    workerPayments.length;

  const totalPages =
    historyTotal > 0
      ? Math.ceil(
          historyTotal /
            pagination.limit
        )
      : 0;

  const history =
    workerPayments.slice(
      pagination.skip,
      pagination.skip +
        pagination.limit
    );

  /*
  --------------------------------------------------
  STEP 10: Return complete worker earnings data.
  --------------------------------------------------
  */

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

      /*
      Existing compatibility fields.
      */

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

      totalPaidBookings:
        paidPayments.length,

      completedPaidBookings:
        completedPayments.length,

      /*
      New STEP 18 fields.
      */

      availablePaise,

      availableAmount:
        formatAmount(
          availablePaise
        ),

      completedBookingCount:
        completedPayments.length,

      /*
      Transaction history.
      */

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
        history.map(
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

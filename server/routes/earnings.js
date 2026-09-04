import express from "express";
import Payment from "../models/Payment.js";
import Worker from "../models/Worker.js";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

function formatAmount(paise) {
  return Number(paise || 0) / 100;
}

/*
========================================
WORKER EARNINGS
========================================
*/

router.get(
  "/me",
  requireRole("worker"),
  async (req, res) => {
    try {
      const worker =
        await Worker.findOne({
          userId: req.user.id
        }).select("_id name");

      if (!worker) {
        return res.status(404).json({
          success: false,
          message:
            "Worker profile not found."
        });
      }

      const payments =
        await Payment.find({
          status: "paid"
        })
          .populate(
            "bookingId",
            "workerId jobId status completedAt"
          )
          .sort({
            paidAt: -1,
            createdAt: -1
          });

      const workerPayments =
        payments.filter(
          (payment) =>
            payment.bookingId &&
            String(
              payment.bookingId.workerId
            ) ===
              String(worker._id)
        );

      const grossPaise =
        workerPayments.reduce(
          (total, payment) =>
            total +
            Number(payment.amount || 0),
          0
        );

      const completedPayments =
        workerPayments.filter(
          (payment) =>
            payment.bookingId?.status ===
            "completed"
        );

      const pendingWorkPayments =
        workerPayments.filter(
          (payment) =>
            payment.bookingId &&
            payment.bookingId.status !==
              "completed"
        );

      return res.status(200).json({
        success: true,

        data: {
          worker: {
            id: worker._id,
            name: worker.name
          },

          currency: "INR",

          grossPaise,

          grossAmount:
            formatAmount(grossPaise),

          completedAmount:
            formatAmount(
              completedPayments.reduce(
                (total, payment) =>
                  total +
                  Number(
                    payment.amount || 0
                  ),
                0
              )
            ),

          pendingWorkAmount:
            formatAmount(
              pendingWorkPayments.reduce(
                (total, payment) =>
                  total +
                  Number(
                    payment.amount || 0
                  ),
                0
              )
            ),

          totalPaidBookings:
            workerPayments.length,

          completedPaidBookings:
            completedPayments.length,

          payments:
            workerPayments.map(
              (payment) => ({
                id: payment._id,

                amount:
                  formatAmount(
                    payment.amount
                  ),

                currency:
                  payment.currency,

                status:
                  payment.status,

                paidAt:
                  payment.paidAt,

                booking:
                  payment.bookingId
                    ? {
                        id:
                          payment.bookingId
                            ._id,

                        status:
                          payment.bookingId
                            .status,

                        jobId:
                          payment.bookingId
                            .jobId
                      }
                    : null
              })
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
========================================
ADMIN EARNINGS SUMMARY
========================================
*/

router.get(
  "/admin/summary",
  requireRole("admin"),
  async (req, res) => {
    try {
      const payments =
        await Payment.find({
          status: "paid"
        });

      const totalPaise =
        payments.reduce(
          (total, payment) =>
            total +
            Number(payment.amount || 0),
          0
        );

      return res.status(200).json({
        success: true,
        data: {
          currency: "INR",
          totalPaise,
          totalAmount:
            formatAmount(totalPaise),
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

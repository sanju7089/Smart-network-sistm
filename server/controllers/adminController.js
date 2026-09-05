import mongoose from "mongoose";

import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Job from "../models/Job.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";

const JOB_STATUSES = [
  "open",
  "assigned",
  "in_progress",
  "completed",
  "cancelled"
];

const BOOKING_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled"
];

const PAYMENT_STATUSES = [
  "created",
  "pending",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "refunded"
];

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function parsePage(value, fallback = 1) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }

  return Math.min(number, 100000);
}

function parseLimit(value, fallback = 20) {
  const number = Number.parseInt(value, 10);

  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }

  return Math.min(number, 100);
}

function safeRegex(value) {
  return String(value || "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}

function pagination(page, limit, total) {
  const totalPages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

function paymentAmountPaise(payment) {
  const amount = Number(payment?.amount || 0);

  return Number.isFinite(amount) && amount > 0
    ? amount
    : 0;
}

function serializePayment(payment) {
  if (!payment) {
    return null;
  }

  return {
    id: payment._id,
    userId: payment.userId?._id || payment.userId || null,
    user: payment.userId
      ? {
          id: payment.userId._id,
          name: payment.userId.name,
          email: payment.userId.email,
          phone: payment.userId.phone
        }
      : null,

    bookingId:
      payment.bookingId?._id ||
      payment.bookingId ||
      null,

    booking: payment.bookingId
      ? {
          id: payment.bookingId._id,
          status: payment.bookingId.status,
          jobId:
            payment.bookingId.jobId?._id ||
            payment.bookingId.jobId ||
            null,
          job: payment.bookingId.jobId
            ? {
                id: payment.bookingId.jobId._id,
                title: payment.bookingId.jobId.title,
                location: payment.bookingId.jobId.location,
                budget: payment.bookingId.jobId.budget
              }
            : null
        }
      : null,

    amount: paymentAmountPaise(payment),
    amountPaise: paymentAmountPaise(payment),
    currency: payment.currency || "INR",
    method: payment.method || null,
    status: payment.status || null,

    transactionId:
      payment.transactionId ||
      payment.gatewayPaymentId ||
      null,

    gatewayPaymentId:
      payment.gatewayPaymentId || null,

    razorpayPaymentId:
      payment.gatewayPaymentId || null,

    razorpayOrderId:
      payment.razorpayOrderId || null,

    paidAt: payment.paidAt || null,
    failedAt: payment.failedAt || null,
    cancelledAt: payment.cancelledAt || null,
    refundedAt: payment.refundedAt || null,

    refundId: payment.refundId || null,
    refundAmount:
      Number(payment.refundAmount || 0),

    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

export async function getDashboard(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      customers,
      workerUsers,
      adminUsers,

      totalWorkers,
      verifiedWorkers,
      availableWorkers,

      totalJobs,
      openJobs,
      completedJobs,
      cancelledJobs,

      totalBookings,
      pendingBookings,
      acceptedBookings,
      confirmedBookings,
      inProgressBookings,
      completedBookings,
      cancelledBookings,

      paidPayments,
      refundedPayments,
      failedPayments,

      paidRevenueResult,
      refundedAmountResult
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        isActive: true
      }),

      User.countDocuments({
        role: "customer"
      }),

      User.countDocuments({
        role: "worker"
      }),

      User.countDocuments({
        role: "admin"
      }),

      Worker.countDocuments({
        isActive: true
      }),

      Worker.countDocuments({
        isActive: true,
        verified: true
      }),

      Worker.countDocuments({
        isActive: true,
        isAvailable: true
      }),

      Job.countDocuments(),

      Job.countDocuments({
        status: "open"
      }),

      Job.countDocuments({
        status: "completed"
      }),

      Job.countDocuments({
        status: "cancelled"
      }),

      Booking.countDocuments(),

      Booking.countDocuments({
        status: "pending"
      }),

      Booking.countDocuments({
        status: "accepted"
      }),

      Booking.countDocuments({
        status: "confirmed"
      }),

      Booking.countDocuments({
        status: "in_progress"
      }),

      Booking.countDocuments({
        status: "completed"
      }),

      Booking.countDocuments({
        status: "cancelled"
      }),

      Payment.countDocuments({
        status: "paid"
      }),

      Payment.countDocuments({
        status: "refunded"
      }),

      Payment.countDocuments({
        status: "failed"
      }),

      Payment.aggregate([
        {
          $match: {
            status: "paid"
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount"
            }
          }
        }
      ]),

      Payment.aggregate([
        {
          $match: {
            status: "refunded"
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$refundAmount"
            }
          }
        }
      ])
    ]);

    const paidRevenue =
      Number(
        paidRevenueResult[0]?.total || 0
      );

    const refundedAmount =
      Number(
        refundedAmountResult[0]?.total || 0
      );

    return res.status(200).json({
      success: true,

      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          customers,
          workers: workerUsers,
          admins: adminUsers
        },

        workers: {
          total: totalWorkers,
          verified: verifiedWorkers,
          available: availableWorkers
        },

        jobs: {
          total: totalJobs,
          open: openJobs,
          completed: completedJobs,
          cancelled: cancelledJobs
        },

        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          accepted: acceptedBookings,
          confirmed: confirmedBookings,
          inProgress: inProgressBookings,
          completed: completedBookings,
          cancelled: cancelledBookings
        },

        payments: {
          paid: paidPayments,
          refunded: refundedPayments,
          failed: failedPayments,
          totalRevenue: paidRevenue,
          refundedAmount,
          netRevenue: Math.max(
            0,
            paidRevenue - refundedAmount
          )
        }
      }
    });
  } catch (error) {
    console.error(
      "ADMIN DASHBOARD ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load admin dashboard."
    });
  }
}

export async function getAdminUsers(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.role) {
      const role = String(req.query.role)
        .trim()
        .toLowerCase();

      if (
        ![
          "customer",
          "worker",
          "admin"
        ].includes(role)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid user role."
        });
      }

      filter.role = role;
    }

    if (req.query.active !== undefined) {
      const active = String(
        req.query.active
      );

      if (!["true", "false"].includes(active)) {
        return res.status(400).json({
          success: false,
          message:
            "Active must be true or false."
        });
      }

      filter.isActive = active === "true";
    }

    if (req.query.search) {
      const search = String(
        req.query.search
      )
        .trim()
        .slice(0, 200);

      if (search) {
        const safe = safeRegex(search);

        filter.$or = [
          {
            name: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            email: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            phone: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            location: {
              $regex: safe,
              $options: "i"
            }
          }
        ];
      }
    }

    const [users, total] =
      await Promise.all([
        User.find(filter)
          .select(
            "name email role phone location isActive createdAt updatedAt"
          )
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit),

        User.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      pagination:
        pagination(page, limit, total),
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error(
      "ADMIN USERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load users."
    });
  }
}

export async function getAdminJobs(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      )
        .trim()
        .toLowerCase();

      if (!JOB_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid job status."
        });
      }

      filter.status = status;
    }

    if (req.query.search) {
      const search = String(
        req.query.search
      )
        .trim()
        .slice(0, 200);

      if (search) {
        const safe = safeRegex(search);

        filter.$or = [
          {
            title: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            description: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            category: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            service: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            location: {
              $regex: safe,
              $options: "i"
            }
          }
        ];
      }
    }

    const [jobs, total] =
      await Promise.all([
        Job.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "customerId",
            "name email phone"
          ),

        Job.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      pagination:
        pagination(page, limit, total),
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    console.error(
      "ADMIN JOBS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load admin jobs."
    });
  }
}

export async function getAdminWorkers(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.verified !== undefined) {
      const value = String(
        req.query.verified
      );

      if (!["true", "false"].includes(value)) {
        return res.status(400).json({
          success: false,
          message:
            "Verified must be true or false."
        });
      }

      filter.verified =
        value === "true";
    }

    if (req.query.active !== undefined) {
      const value = String(
        req.query.active
      );

      if (!["true", "false"].includes(value)) {
        return res.status(400).json({
          success: false,
          message:
            "Active must be true or false."
        });
      }

      filter.isActive =
        value === "true";
    }

    if (req.query.available !== undefined) {
      const value = String(
        req.query.available
      );

      if (!["true", "false"].includes(value)) {
        return res.status(400).json({
          success: false,
          message:
            "Available must be true or false."
        });
      }

      filter.isAvailable =
        value === "true";
    }

    if (req.query.search) {
      const search = String(
        req.query.search
      )
        .trim()
        .slice(0, 200);

      if (search) {
        const safe = safeRegex(search);

        filter.$or = [
          {
            name: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            service: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            location: {
              $regex: safe,
              $options: "i"
            }
          },
          {
            phone: {
              $regex: safe,
              $options: "i"
            }
          }
        ];
      }
    }

    const [workers, total] =
      await Promise.all([
        Worker.find(filter)
          .sort({
            verified: 1,
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "userId",
            "name email phone isActive"
          ),

        Worker.countDocuments(filter)
      ]);

    return res.status(200).json({
      success: true,
      pagination:
        pagination(page, limit, total),
      count: workers.length,
      data: workers
    });
  } catch (error) {
    console.error(
      "ADMIN WORKERS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load workers."
    });
  }
}

export async function getAdminBookings(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      )
        .trim()
        .toLowerCase();

      if (
        !BOOKING_STATUSES.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid booking status."
        });
      }

      filter.status = status;
    }

    const [bookings, total] =
      await Promise.all([
        Booking.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "customerId",
            "name email phone"
          )
          .populate({
            path: "workerId",
            populate: {
              path: "userId",
              select: "name email phone"
            }
          })
          .populate(
            "jobId",
            "title location budget status"
          ),

        Booking.countDocuments(filter)
      ]);

    const data = bookings.map(
      (booking) => ({
        id: booking._id,

        status: booking.status,

        date: booking.date || null,

        customer: booking.customerId
          ? {
              id: booking.customerId._id,
              name: booking.customerId.name,
              email: booking.customerId.email,
              phone: booking.customerId.phone
            }
          : null,

        worker: booking.workerId
          ? {
              id: booking.workerId._id,
              name:
                booking.workerId.name ||
                booking.workerId.userId?.name ||
                "Worker",
              email:
                booking.workerId.userId?.email ||
                null,
              phone:
                booking.workerId.phone ||
                booking.workerId.userId?.phone ||
                null
            }
          : null,

        job: booking.jobId
          ? {
              id: booking.jobId._id,
              title: booking.jobId.title,
              location:
                booking.jobId.location,
              budget:
                booking.jobId.budget,
              status:
                booking.jobId.status
            }
          : null,

        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,

        acceptedAt:
          booking.acceptedAt || null,
        confirmedAt:
          booking.confirmedAt || null,
        startedAt:
          booking.startedAt || null,
        completedAt:
          booking.completedAt || null,
        cancelledAt:
          booking.cancelledAt || null
      })
    );

    return res.status(200).json({
      success: true,
      pagination:
        pagination(page, limit, total),
      count: data.length,
      data
    });
  } catch (error) {
    console.error(
      "ADMIN BOOKINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load bookings."
    });
  }
}

export async function getAdminPayments(req, res) {
  try {
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      const status = String(
        req.query.status
      )
        .trim()
        .toLowerCase();

      if (
        !PAYMENT_STATUSES.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment status."
        });
      }

      filter.status = status;
    }

    const [payments, total] =
      await Promise.all([
        Payment.find(filter)
          .sort({
            createdAt: -1
          })
          .skip(skip)
          .limit(limit)
          .populate(
            "userId",
            "name email phone"
          )
          .populate({
            path: "bookingId",
            select:
              "jobId customerId workerId status date",
            populate: {
              path: "jobId",
              select:
                "title location budget"
            }
          }),

        Payment.countDocuments(filter)
      ]);

    const data = payments
      .map(serializePayment)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      pagination:
        pagination(page, limit, total),
      count: data.length,
      data
    });
  } catch (error) {
    console.error(
      "ADMIN PAYMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load payments."
    });
  }
}

export async function getAdminReport(req, res) {
  try {
    const now = new Date();

    const period =
      String(
        req.query.period || "all"
      )
        .trim()
        .toLowerCase();

    const allowedPeriods = [
      "all",
      "today",
      "7d",
      "30d",
      "90d"
    ];

    if (!allowedPeriods.includes(period)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid report period."
      });
    }

    let startDate = null;

    if (period === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    }

    if (period === "7d") {
      startDate = new Date(
        now.getTime() -
          7 * 24 * 60 * 60 * 1000
      );
    }

    if (period === "30d") {
      startDate = new Date(
        now.getTime() -
          30 * 24 * 60 * 60 * 1000
      );
    }

    if (period === "90d") {
      startDate = new Date(
        now.getTime() -
          90 * 24 * 60 * 60 * 1000
      );
    }

    const dateFilter = startDate
      ? { createdAt: { $gte: startDate } }
      : {};

    const [
      users,
      workers,
      jobs,
      bookings,
      paidPayments,
      refundedPayments,
      failedPayments,
      revenueResult,
      refundResult
    ] = await Promise.all([
      User.countDocuments(dateFilter),

      Worker.countDocuments(dateFilter),

      Job.countDocuments(dateFilter),

      Booking.countDocuments(dateFilter),

      Payment.countDocuments({
        ...dateFilter,
        status: "paid"
      }),

      Payment.countDocuments({
        ...dateFilter,
        status: "refunded"
      }),

      Payment.countDocuments({
        ...dateFilter,
        status: "failed"
      }),

      Payment.aggregate([
        {
          $match: {
            ...dateFilter,
            status: "paid"
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount"
            }
          }
        }
      ]),

      Payment.aggregate([
        {
          $match: {
            ...dateFilter,
            status: "refunded"
          }
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$refundAmount"
            }
          }
        }
      ])
    ]);

    const revenue =
      Number(
        revenueResult[0]?.total || 0
      );

    const refunds =
      Number(
        refundResult[0]?.total || 0
      );

    return res.status(200).json({
      success: true,

      data: {
        period,
        startDate,

        users,
        workers,
        jobs,
        bookings,

        payments: {
          paid: paidPayments,
          refunded: refundedPayments,
          failed: failedPayments
        },

        revenuePaise: revenue,
        refundPaise: refunds,
        netRevenuePaise: Math.max(
          0,
          revenue - refunds
        ),

        revenue,
        refunds,
        netRevenue: Math.max(
          0,
          revenue - refunds
        ),

        generatedAt:
          new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(
      "ADMIN REPORT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to generate admin report."
    });
  }
}

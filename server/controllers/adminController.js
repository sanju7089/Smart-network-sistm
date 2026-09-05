import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Job from "../models/Job.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";

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
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getDashboard(req, res) {
  try {
    const [
      totalUsers,
      activeUsers,
      totalWorkers,
      verifiedWorkers,
      totalJobs,
      openJobs,
      totalBookings,
      pendingBookings,
      paidPayments,
      revenueResult
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({
        isActive: true
      }),

      Worker.countDocuments({
        isActive: true
      }),

      Worker.countDocuments({
        isActive: true,
        verified: true
      }),

      Job.countDocuments(),

      Job.countDocuments({
        status: "open"
      }),

      Booking.countDocuments(),

      Booking.countDocuments({
        status: "pending"
      }),

      Payment.countDocuments({
        status: "paid"
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
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers
        },

        workers: {
          total: totalWorkers,
          verified: verifiedWorkers
        },

        jobs: {
          total: totalJobs,
          open: openJobs
        },

        bookings: {
          total: totalBookings,
          pending: pendingBookings
        },

        payments: {
          paid: paidPayments,
          totalRevenue: revenueResult[0]?.total || 0
        }
      }
    });
  } catch (error) {
    console.error("ADMIN DASHBOARD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load admin dashboard."
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
      const status = String(req.query.status)
        .trim()
        .toLowerCase();

      const allowed = [
        "open",
        "assigned",
        "in_progress",
        "completed",
        "cancelled"
      ];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid job status."
        });
      }

      filter.status = status;
    }

    if (req.query.search) {
      const search = String(req.query.search)
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

    const [jobs, total] = await Promise.all([
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

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(
          1,
          Math.ceil(total / limit)
        ),
        hasNextPage:
          page * limit < total,
        hasPreviousPage:
          page > 1
      },

      count: jobs.length,

      data: jobs
    });
  } catch (error) {
    console.error("ADMIN JOBS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load admin jobs."
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
      const value = String(req.query.verified);

      if (!["true", "false"].includes(value)) {
        return res.status(400).json({
          success: false,
          message: "Verified must be true or false."
        });
      }

      filter.verified = value === "true";
    }

    if (req.query.active !== undefined) {
      const value = String(req.query.active);

      if (!["true", "false"].includes(value)) {
        return res.status(400).json({
          success: false,
          message: "Active must be true or false."
        });
      }

      filter.isActive = value === "true";
    }

    if (req.query.search) {
      const search = String(req.query.search)
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

    const [workers, total] = await Promise.all([
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

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(
          1,
          Math.ceil(total / limit)
        ),
        hasNextPage:
          page * limit < total,
        hasPreviousPage:
          page > 1
      },

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
        "Unable to load worker verification list."
    });
  }
}

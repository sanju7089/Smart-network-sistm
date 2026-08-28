import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Job from "../models/Job.js";
import Booking from "../models/Booking.js";
import Payment from "../models/Payment.js";

export async function getDashboard(
  req,
  res
) {
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

    const totalRevenue =
      revenueResult[0]?.total || 0;

    return res.json({
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
          totalRevenue
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

import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Worker from "../models/Worker.js";
import Job from "../models/Job.js";

function toId(value) {
  if (!value) {
    return null;
  }

  return String(value);
}

function buildEventKey(
  recipientId,
  type,
  sourceId
) {
  return [
    String(recipientId),
    String(type),
    String(sourceId)
  ].join(":");
}

async function createNotification({
  recipientId,
  type,
  title,
  message,
  bookingId = null,
  paymentId = null,
  jobId = null,
  sourceId
}) {
  if (!recipientId) {
    return null;
  }

  if (!sourceId) {
    return null;
  }

  const eventKey =
    buildEventKey(
      recipientId,
      type,
      sourceId
    );

  try {
    return await Notification.create({
      recipientId,
      type,
      title,
      message,
      bookingId,
      paymentId,
      jobId,
      eventKey
    });
  } catch (error) {
    if (error?.code === 11000) {
      return null;
    }

    console.error(
      "CREATE NOTIFICATION ERROR:",
      error?.stack ||
        error?.message ||
        error
    );

    return null;
  }
}

async function getAdminIds() {
  try {
    const admins =
      await User.find({
        role: "admin",
        isActive: true
      })
        .select("_id")
        .lean();

    return admins.map(
      (admin) => admin._id
    );
  } catch (error) {
    console.error(
      "GET ADMIN IDS ERROR:",
      error?.stack ||
        error?.message ||
        error
    );

    return [];
  }
}

async function getWorkerUserId(
  workerId
) {
  try {
    const worker =
      await Worker.findById(
        workerId
      )
        .select("userId")
        .lean();

    return worker?.userId || null;
  } catch (error) {
    console.error(
      "GET WORKER USER ID ERROR:",
      error?.stack ||
        error?.message ||
        error
    );

    return null;
  }
}

async function getJobTitle(
  jobId
) {
  if (!jobId) {
    return "";
  }

  try {
    const job =
      await Job.findById(
        jobId
      )
        .select("title")
        .lean();

    return String(
      job?.title || "your work"
    ).trim();
  } catch (error) {
    return "your work";
  }
}

function bookingNotificationContent(
  status,
  jobTitle
) {
  const title =
    jobTitle || "your work";

  switch (status) {
    case "pending":
      return {
        type: "booking_created",
        title: "New booking request",
        message:
          `A new booking request has been created for ${title}.`
      };

    case "accepted":
      return {
        type: "booking_accepted",
        title: "Booking accepted",
        message:
          `Your booking request for ${title} has been accepted.`
      };

    case "rejected":
      return {
        type: "booking_rejected",
        title: "Booking rejected",
        message:
          `Your booking request for ${title} was rejected.`
      };

    case "confirmed":
      return {
        type: "booking_confirmed",
        title: "Booking confirmed",
        message:
          `Your booking for ${title} is now confirmed.`
      };

    case "in_progress":
      return {
        type: "work_started",
        title: "Work started",
        message:
          `Work for ${title} has started.`
      };

    case "completed":
      return {
        type: "work_completed",
        title: "Work completed",
        message:
          `Work for ${title} has been marked completed.`
      };

    case "cancelled":
      return {
        type: "booking_cancelled",
        title: "Booking cancelled",
        message:
          `The booking for ${title} has been cancelled.`
      };

    default:
      return null;
  }
}

export async function notifyBookingEvent(
  booking
) {
  try {
    if (!booking?._id) {
      return;
    }

    const jobTitle =
      await getJobTitle(
        booking.jobId
      );

    const content =
      bookingNotificationContent(
        booking.status,
        jobTitle
      );

    if (!content) {
      return;
    }

    const recipients =
      new Map();

    if (booking.customerId) {
      recipients.set(
        toId(booking.customerId),
        "customer"
      );
    }

    if (booking.workerId) {
      const workerUserId =
        await getWorkerUserId(
          booking.workerId
        );

      if (workerUserId) {
        recipients.set(
          toId(workerUserId),
          "worker"
        );
      }
    }

    const adminIds =
      await getAdminIds();

    for (const adminId of adminIds) {
      recipients.set(
        toId(adminId),
        "admin"
      );
    }

    for (
      const [recipientId, role]
      of recipients
    ) {
      let message =
        content.message;

      if (
        role === "admin"
      ) {
        message =
          `Booking update: ${content.message}`;
      }

      await createNotification({
        recipientId,
        type: content.type,
        title:
          role === "admin"
            ? `Admin: ${content.title}`
            : content.title,
        message,
        bookingId:
          booking._id,
        jobId:
          booking.jobId || null,
        sourceId:
          `${booking._id}:${booking.status}`
      });
    }
  } catch (error) {
    console.error(
      "BOOKING NOTIFICATION ERROR:",
      error?.stack ||
        error?.message ||
        error
    );
  }
}

function paymentNotificationContent(
  status
) {
  switch (status) {
    case "paid":
      return {
        type: "payment_success",
        title: "Payment successful",
        message:
          "Your payment was completed successfully."
      };

    case "failed":
      return {
        type: "payment_failure",
        title: "Payment failed",
        message:
          "Your payment could not be completed."
      };

    case "refunded":
      return {
        type: "payment_refunded",
        title: "Payment refunded",
        message:
          "Your payment has been refunded successfully."
      };

    default:
      return null;
  }
}

export async function notifyPaymentEvent(
  payment
) {
  try {
    if (!payment?._id) {
      return;
    }

    const content =
      paymentNotificationContent(
        payment.status
      );

    if (!content) {
      return;
    }

    const recipientIds =
      new Set();

    if (payment.userId) {
      recipientIds.add(
        toId(payment.userId)
      );
    }

    const adminIds =
      await getAdminIds();

    for (const adminId of adminIds) {
      recipientIds.add(
        toId(adminId)
      );
    }

    for (
      const recipientId
      of recipientIds
    ) {
      const isAdmin =
        adminIds.some(
          (id) =>
            toId(id) ===
            recipientId
        );

      await createNotification({
        recipientId,
        type: content.type,
        title:
          isAdmin
            ? `Admin: ${content.title}`
            : content.title,
        message:
          isAdmin
            ? `Payment update: ${content.message}`
            : content.message,
        paymentId:
          payment._id,
        bookingId:
          payment.bookingId || null,
        sourceId:
          `${payment._id}:${payment.status}`
      });
    }
  } catch (error) {
    console.error(
      "PAYMENT NOTIFICATION ERROR:",
      error?.stack ||
        error?.message ||
        error
    );
  }
}

export async function createAdminNotification({
  title,
  message,
  sourceId,
  bookingId = null,
  paymentId = null,
  jobId = null
}) {
  try {
    if (!sourceId) {
      return;
    }

    const adminIds =
      await getAdminIds();

    for (const adminId of adminIds) {
      await createNotification({
        recipientId: adminId,
        type: "admin_update",
        title,
        message,
        bookingId,
        paymentId,
        jobId,
        sourceId
      });
    }
  } catch (error) {
    console.error(
      "ADMIN NOTIFICATION ERROR:",
      error?.stack ||
        error?.message ||
        error
    );
  }
}

export async function listNotifications(
  userId,
  {
    unreadOnly = false,
    limit = 50
  } = {}
) {
  const safeLimit =
    Math.min(
      Math.max(
        Number(limit) || 50,
        1
      ),
      100
    );

  const filter = {
    recipientId: userId
  };

  if (unreadOnly) {
    filter.read = false;
  }

  return Notification.find(
    filter
  )
    .sort({
      createdAt: -1
    })
    .limit(safeLimit)
    .lean();
}

export async function markNotificationRead(
  userId,
  notificationId
) {
  return Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientId: userId
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    },
    {
      new: true
    }
  );
}

export async function markAllNotificationsRead(
  userId
) {
  return Notification.updateMany(
    {
      recipientId: userId,
      read: false
    },
    {
      $set: {
        read: true,
        readAt: new Date()
      }
    }
  );
}

export async function getUnreadCount(
  userId
) {
  return Notification.countDocuments({
    recipientId: userId,
    read: false
  });
  }

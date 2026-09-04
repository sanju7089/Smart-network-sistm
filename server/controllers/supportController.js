import mongoose from "mongoose";

import SupportTicket, {
  SUPPORT_TICKET_STATUSES
} from "../models/SupportTicket.js";

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function text(value, max = 5000) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function safeTicket(ticket) {
  if (!ticket) return null;

  return {
    id: ticket._id,
    userId: ticket.userId,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    adminReply: ticket.adminReply,
    resolvedAt: ticket.resolvedAt,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  };
}

/*
========================================
CREATE SUPPORT TICKET
========================================
*/

export async function createTicket(
  req,
  res
) {
  try {
    const subject =
      text(req.body?.subject, 200);

    const message =
      text(req.body?.message, 5000);

    if (
      subject.length < 3 ||
      message.length < 3
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Subject and message are required."
      });
    }

    const ticket =
      await SupportTicket.create({
        userId: req.user.id,
        subject,
        message
      });

    return res.status(201).json({
      success: true,
      message:
        "Support ticket created successfully.",
      data: safeTicket(ticket)
    });
  } catch (error) {
    console.error(
      "CREATE SUPPORT TICKET ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create support ticket."
    });
  }
}

/*
========================================
MY SUPPORT TICKETS
========================================
*/

export async function getMyTickets(
  req,
  res
) {
  try {
    const tickets =
      await SupportTicket.find({
        userId: req.user.id
      }).sort({
        createdAt: -1
      });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets.map(
        safeTicket
      )
    });
  } catch (error) {
    console.error(
      "GET MY SUPPORT TICKETS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch support tickets."
    });
  }
}

/*
========================================
ADMIN: ALL TICKETS
========================================
*/

export async function getAllTickets(
  req,
  res
) {
  try {
    const filter = {};

    if (req.query.status) {
      const status =
        text(
          req.query.status,
          50
        ).toLowerCase();

      if (
        !SUPPORT_TICKET_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid support ticket status."
        });
      }

      filter.status = status;
    }

    const tickets =
      await SupportTicket.find(
        filter
      )
        .populate(
          "userId",
          "name email phone role"
        )
        .sort({
          createdAt: -1
        });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (error) {
    console.error(
      "GET ALL SUPPORT TICKETS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch support tickets."
    });
  }
}

/*
========================================
ADMIN: UPDATE TICKET
========================================
*/

export async function updateTicket(
  req,
  res
) {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid support ticket ID."
      });
    }

    const ticket =
      await SupportTicket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message:
          "Support ticket not found."
      });
    }

    const status =
      req.body?.status !== undefined
        ? text(
            req.body.status,
            50
          ).toLowerCase()
        : null;

    const adminReply =
      req.body?.adminReply !== undefined
        ? text(
            req.body.adminReply,
            5000
          )
        : null;

    if (
      status &&
      !SUPPORT_TICKET_STATUSES.includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid support ticket status."
      });
    }

    if (status) {
      ticket.status = status;

      if (
        status === "resolved" ||
        status === "closed"
      ) {
        ticket.resolvedAt =
          ticket.resolvedAt ||
          new Date();
      }
    }

    if (adminReply !== null) {
      ticket.adminReply =
        adminReply;
    }

    await ticket.save();

    return res.status(200).json({
      success: true,
      message:
        "Support ticket updated successfully.",
      data: safeTicket(ticket)
    });
  } catch (error) {
    console.error(
      "UPDATE SUPPORT TICKET ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to update support ticket."
    });
  }
}

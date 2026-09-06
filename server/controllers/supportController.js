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
  if (!ticket) {
    return null;
  }

  const replyHistory =
    Array.isArray(
      ticket.replyHistory
    )
      ? ticket.replyHistory.map(
          function (reply) {
            return {
              id: reply._id,
              message: reply.message,
              repliedBy:
                reply.repliedBy,
              repliedAt:
                reply.repliedAt
            };
          }
        )
      : [];

  return {
    id: ticket._id,
    userId: ticket.userId,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,

    /*
     * Latest reply remains available
     * for existing frontend compatibility.
     */
    adminReply:
      ticket.adminReply || "",

    /*
     * Complete conversation history.
     */
    replyHistory,

    resolvedAt:
      ticket.resolvedAt,

    closedAt:
      ticket.closedAt,

    createdAt:
      ticket.createdAt,

    updatedAt:
      ticket.updatedAt
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
      text(
        req.body?.subject,
        200
      );

    const message =
      text(
        req.body?.message,
        5000
      );

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

    if (
      !req.user ||
      !req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    const ticket =
      await SupportTicket.create({
        userId: req.user.id,
        subject,
        message,
        status: "open"
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
CUSTOMER + WORKER
========================================
*/

export async function getMyTickets(
  req,
  res
) {
  try {
    if (
      !req.user ||
      !req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
      });
    }

    const tickets =
      await SupportTicket.find({
        userId: req.user.id
      })
        .sort({
          createdAt: -1
        })
        .lean();

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
        .populate(
          "replyHistory.repliedBy",
          "name email role"
        )
        .sort({
          createdAt: -1
        });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets.map(
        function (ticket) {
          return {
            ...safeTicket(ticket),

            user: ticket.userId
              ? {
                  id:
                    ticket.userId._id,
                  name:
                    ticket.userId.name,
                  email:
                    ticket.userId.email,
                  phone:
                    ticket.userId.phone,
                  role:
                    ticket.userId.role
                }
              : null,

            replyHistory:
              Array.isArray(
                ticket.replyHistory
              )
                ? ticket.replyHistory.map(
                    function (reply) {
                      return {
                        id: reply._id,
                        message:
                          reply.message,
                        repliedBy:
                          reply.repliedBy
                            ? {
                                id:
                                  reply
                                    .repliedBy
                                    ._id,
                                name:
                                  reply
                                    .repliedBy
                                    .name,
                                email:
                                  reply
                                    .repliedBy
                                    .email,
                                role:
                                  reply
                                    .repliedBy
                                    .role
                              }
                            : null,
                        repliedAt:
                          reply.repliedAt
                      };
                    }
                  )
                : []
          };
        }
      )
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
STATUS + REPLY
========================================
*/

export async function updateTicket(
  req,
  res
) {
  try {
    const { id } =
      req.params;

    if (!validId(id)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid support ticket ID."
      });
    }

    if (
      !req.user ||
      !req.user.id
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required."
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

    const hasStatus =
      req.body?.status !==
      undefined;

    const hasReply =
      req.body?.adminReply !==
      undefined;

    const status =
      hasStatus
        ? text(
            req.body.status,
            50
          ).toLowerCase()
        : null;

    const adminReply =
      hasReply
        ? text(
            req.body.adminReply,
            5000
          )
        : null;

    if (
      hasStatus &&
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

    if (
      !hasStatus &&
      !hasReply
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Status or admin reply is required."
      });
    }

    /*
     * Do not allow adding an empty reply
     * to the conversation history.
     */
    if (
      hasReply &&
      adminReply.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Admin reply cannot be empty."
      });
    }

    if (hasReply) {
      ticket.adminReply =
        adminReply;

      ticket.replyHistory.push({
        message: adminReply,
        repliedBy:
          req.user.id,
        repliedAt:
          new Date()
      });

      /*
       * A new reply re-opens a resolved
       * or closed ticket for active handling,
       * unless the admin explicitly sends
       * another status in the same request.
       */
      if (
        !hasStatus &&
        [
          "resolved",
          "closed"
        ].includes(
          ticket.status
        )
      ) {
        ticket.status =
          "in_progress";

        ticket.resolvedAt =
          null;

        ticket.closedAt =
          null;
      }
    }

    if (hasStatus) {
      ticket.status =
        status;

      if (
        status === "resolved"
      ) {
        ticket.resolvedAt =
          ticket.resolvedAt ||
          new Date();

        ticket.closedAt =
          null;
      }

      if (
        status === "closed"
      ) {
        ticket.resolvedAt =
          ticket.resolvedAt ||
          new Date();

        ticket.closedAt =
          new Date();
      }

      if (
        status === "open" ||
        status === "in_progress"
      ) {
        ticket.resolvedAt =
          null;

        ticket.closedAt =
          null;
      }
    }

    await ticket.save();

    const populatedTicket =
      await SupportTicket.findById(
        ticket._id
      )
        .populate(
          "userId",
          "name email phone role"
        )
        .populate(
          "replyHistory.repliedBy",
          "name email role"
        );

    return res.status(200).json({
      success: true,
      message:
        "Support ticket updated successfully.",
      data: safeTicket(
        populatedTicket
      )
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

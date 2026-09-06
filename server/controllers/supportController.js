"use strict";

import mongoose from "mongoose";
import SupportTicket, {
  SUPPORT_TICKET_STATUSES
} from "../models/SupportTicket.js";

const validId = (id) =>
  mongoose.Types.ObjectId.isValid(String(id || ""));

const isValidationError = (error) =>
  error?.name === "ValidationError";

const isDuplicateKeyError = (error) =>
  error?.code === 11000;

const isCastError = (error) =>
  error?.name === "CastError";

const getValidationErrors = (error) => {
  const errors = {};

  for (const [field, detail] of Object.entries(error?.errors || {})) {
    errors[field] = detail?.message || "Invalid value.";
  }

  return errors;
};

const isPlainObject = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value);

const getBody = (req) =>
  isPlainObject(req.body) ? req.body : {};

const safeTicket = (ticket) => {
  if (!ticket) return null;

  return {
    ...ticket,
    replyHistory: Array.isArray(ticket.replyHistory)
      ? ticket.replyHistory
      : []
  };
};

export const createTicket = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const body = getBody(req);

    if (
      body.subject !== undefined &&
      typeof body.subject !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Subject must be a text value."
      });
    }

    if (
      body.message !== undefined &&
      typeof body.message !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Message must be a text value."
      });
    }

    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (subject.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Subject must be at least 3 characters long."
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        message: "Subject must not exceed 200 characters."
      });
    }

    if (message.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 3 characters long."
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message must not exceed 5000 characters."
      });
    }

    const ticket = await SupportTicket.create({
      userId: req.user._id,
      subject,
      message,
      status: "open"
    });

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully.",
      ticket: safeTicket(ticket.toObject())
    });
  } catch (error) {
    console.error("createTicket error:", error);

    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Support ticket validation failed.",
        errors: getValidationErrors(error)
      });
    }

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message: "A duplicate support ticket already exists."
      });
    }

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support ticket data."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to create support ticket."
    });
  }
};

export const getMyTickets = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const tickets = await SupportTicket.find({
      userId: req.user._id
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      tickets: tickets.map(safeTicket)
    });
  } catch (error) {
    console.error("getMyTickets error:", error);

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user identifier."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to load support tickets."
    });
  }
};

export const getAllTickets = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const rawStatus = req.query?.status;

    if (
      rawStatus !== undefined &&
      typeof rawStatus !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status."
      });
    }

    const status =
      typeof rawStatus === "string"
        ? rawStatus.trim()
        : "";

    if (
      status &&
      !SUPPORT_TICKET_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status."
      });
    }

    const filter = status ? { status } : {};

    const tickets = await SupportTicket.find(filter)
      .populate("userId", "name email phone")
      .populate("replyHistory.repliedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      tickets: tickets.map(safeTicket)
    });
  } catch (error) {
    console.error("getAllTickets error:", error);

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support ticket data."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to load support tickets."
    });
  }
};

export const updateTicket = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const ticketId = req.params?.id;

    if (!validId(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support ticket identifier."
      });
    }

    const body = getBody(req);

    if (
      body.status !== undefined &&
      typeof body.status !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Ticket status must be a text value."
      });
    }

    if (
      body.adminReply !== undefined &&
      typeof body.adminReply !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Admin reply must be a text value."
      });
    }

    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Support ticket not found."
      });
    }

    const statusProvided = body.status !== undefined;
    const replyProvided = body.adminReply !== undefined;

    const status = statusProvided
      ? String(body.status).trim()
      : "";

    const adminReply = replyProvided
      ? String(body.adminReply).trim()
      : "";

    if (
      statusProvided &&
      !SUPPORT_TICKET_STATUSES.includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status."
      });
    }

    if (replyProvided && !adminReply) {
      return res.status(400).json({
        success: false,
        message: "Admin reply cannot be empty."
      });
    }

    if (adminReply.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Admin reply must not exceed 5000 characters."
      });
    }

    if (replyProvided) {
      if (!Array.isArray(ticket.replyHistory)) {
        ticket.replyHistory = [];
      }

      ticket.replyHistory.push({
        message: adminReply,
        repliedBy: req.user._id,
        repliedAt: new Date()
      });

      ticket.adminReply = adminReply;

      if (!statusProvided) {
        ticket.status = "in_progress";
      }
    }

    if (statusProvided) {
      ticket.status = status;
    }

    if (ticket.status === "resolved") {
      ticket.resolvedAt = ticket.resolvedAt || new Date();
      ticket.closedAt = null;
    } else if (ticket.status === "closed") {
      ticket.closedAt = ticket.closedAt || new Date();
      ticket.resolvedAt = ticket.resolvedAt || new Date();
    } else {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
    }

    await ticket.save();

    await ticket.populate([
      {
        path: "userId",
        select: "name email phone"
      },
      {
        path: "replyHistory.repliedBy",
        select: "name email role"
      }
    ]);

    return res.status(200).json({
      success: true,
      message: "Support ticket updated successfully.",
      ticket: safeTicket(ticket.toObject())
    });
  } catch (error) {
    console.error("updateTicket error:", error);

    if (isValidationError(error)) {
      return res.status(400).json({
        success: false,
        message: "Support ticket validation failed.",
        errors: getValidationErrors(error)
      });
    }

    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message: "Duplicate support ticket data."
      });
    }

    if (isCastError(error)) {
      return res.status(400).json({
        success: false,
        message: "Invalid support ticket data."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Unable to update support ticket."
    });
  }
};

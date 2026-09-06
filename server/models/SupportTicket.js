import mongoose from "mongoose";

export const SUPPORT_TICKET_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "closed"
];

const supportReplySchema =
  new mongoose.Schema(
    {
      message: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 5000
      },

      repliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },

      repliedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      _id: true
    }
  );

const supportTicketSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
      },

      subject: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 200
      },

      message: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 5000
      },

      status: {
        type: String,
        enum:
          SUPPORT_TICKET_STATUSES,
        default: "open",
        index: true
      },

      /*
       * Kept for backward compatibility.
       * It always contains the latest admin reply.
       */
      adminReply: {
        type: String,
        default: "",
        trim: true,
        maxlength: 5000
      },

      /*
       * Complete support conversation history.
       */
      replyHistory: {
        type: [supportReplySchema],
        default: []
      },

      resolvedAt: {
        type: Date,
        default: null
      },

      closedAt: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  );

supportTicketSchema.index({
  userId: 1,
  createdAt: -1
});

supportTicketSchema.index({
  status: 1,
  createdAt: -1
});

const SupportTicket =
  mongoose.model(
    "SupportTicket",
    supportTicketSchema
  );

export default SupportTicket;

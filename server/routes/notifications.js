import express from "express";
import mongoose from "mongoose";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead
} from "../services/notificationService.js";

const router =
  express.Router();

router.use(requireAuth);

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(
    id
  );
}

/*
========================================
GET NOTIFICATIONS
========================================
*/

router.get(
  "/",
  async (req, res) => {
    try {
      const unreadOnly =
        String(
          req.query.unreadOnly || ""
        ).toLowerCase() === "true";

      const limit =
        Number.parseInt(
          req.query.limit,
          10
        ) || 50;

      const data =
        await listNotifications(
          req.user.id,
          {
            unreadOnly,
            limit
          }
        );

      const unreadCount =
        await getUnreadCount(
          req.user.id
        );

      return res.status(200).json({
        success: true,
        data,
        unreadCount
      });
    } catch (error) {
      console.error(
        "GET NOTIFICATIONS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load notifications."
      });
    }
  }
);

/*
========================================
UNREAD COUNT
========================================
*/

router.get(
  "/unread-count",
  async (req, res) => {
    try {
      const unreadCount =
        await getUnreadCount(
          req.user.id
        );

      return res.status(200).json({
        success: true,
        unreadCount
      });
    } catch (error) {
      console.error(
        "GET UNREAD COUNT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load unread notification count."
      });
    }
  }
);

/*
========================================
MARK ONE READ
========================================
*/

router.patch(
  "/:id/read",
  async (req, res) => {
    try {
      const {
        id
      } = req.params;

      if (!isValidId(id)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid notification ID."
        });
      }

      const notification =
        await markNotificationRead(
          req.user.id,
          id
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found."
        });
      }

      return res.status(200).json({
        success: true,
        message:
          "Notification marked as read.",
        data:
          notification
      });
    } catch (error) {
      console.error(
        "MARK NOTIFICATION READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update notification."
      });
    }
  }
);

/*
========================================
MARK ALL READ
========================================
*/

router.patch(
  "/read-all",
  async (req, res) => {
    try {
      const result =
        await markAllNotificationsRead(
          req.user.id
        );

      return res.status(200).json({
        success: true,
        message:
          "All notifications marked as read.",
        modifiedCount:
          result.modifiedCount
      });
    } catch (error) {
      console.error(
        "MARK ALL NOTIFICATIONS READ ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update notifications."
      });
    }
  }
);

export default router;

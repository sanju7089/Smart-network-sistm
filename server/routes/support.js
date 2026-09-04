import express from "express";

import {
  requireAuth,
  requireRole
} from "../middleware/authMiddleware.js";

import {
  createTicket,
  getMyTickets,
  getAllTickets,
  updateTicket
} from "../controllers/supportController.js";

const router = express.Router();

router.use(requireAuth);

router.post(
  "/",
  createTicket
);

router.get(
  "/",
  getMyTickets
);

router.get(
  "/admin/all",
  requireRole("admin"),
  getAllTickets
);

router.patch(
  "/admin/:id",
  requireRole("admin"),
  updateTicket
);

export default router;

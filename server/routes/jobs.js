import express from "express";

import {
  requireAuth
} from "../middleware/authMiddleware.js";

import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob
} from "../controllers/jobController.js";

const router = express.Router();

router.get("/", getJobs);

router.get("/:id", getJobById);

router.post(
  "/",
  requireAuth,
  createJob
);

router.patch(
  "/:id",
  requireAuth,
  updateJob
);

router.delete(
  "/:id",
  requireAuth,
  deleteJob
);

export default router;

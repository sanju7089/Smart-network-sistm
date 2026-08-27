import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createJob,
  getJobs,
  getJobById,
  updateJob,
  deleteJob
} from "../controllers/jobController.js";

const router = express.Router();

// Public: सभी open jobs देख सकते हैं
router.get("/", getJobs);

// Public: एक specific job देख सकते हैं
router.get("/:id", getJobById);

// Protected routes
router.post("/", requireAuth, createJob);

router.patch("/:id", requireAuth, updateJob);

router.delete("/:id", requireAuth, deleteJob);

export default router;

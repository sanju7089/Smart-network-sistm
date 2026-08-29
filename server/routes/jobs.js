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

/*
  Public listing.

  Authentication middleware optional
  नहीं रखा गया है क्योंकि public users
  को open jobs देखने हैं.
*/

router.get("/", getJobs);

/*
  Public open job details.
*/

router.get("/:id", getJobById);

/*
  Protected operations.
*/

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

import express from "express";

import {
  requireAuth,
  optionalAuth
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
========================================
PUBLIC / OPTIONAL AUTH JOB LIST
========================================

Without token:
    public open jobs

With token + customerId:
    authenticated customer jobs
*/

router.get(
  "/",
  optionalAuth,
  getJobs
);

/*
========================================
SINGLE JOB
========================================
*/

router.get(
  "/:id",
  getJobById
);

/*
========================================
CREATE JOB
========================================
*/

router.post(
  "/",
  requireAuth,
  createJob
);

/*
========================================
UPDATE JOB
========================================
*/

router.patch(
  "/:id",
  requireAuth,
  updateJob
);

/*
========================================
DELETE JOB
========================================
*/

router.delete(
  "/:id",
  requireAuth,
  deleteJob
);

export default router;

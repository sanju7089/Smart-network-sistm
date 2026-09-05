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
JOB LIST
========================================

Without token:
    Only public OPEN jobs.

With token + customerId:
    Only that authenticated customer's
    own jobs, or admin jobs access.
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

Optional authentication is important
because the controller allows the owner
or admin to view non-open jobs.
*/

router.get(
  "/:id",
  optionalAuth,
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

Authentication is required.

The controller performs the actual
owner/admin authorization check.
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

Authentication is required.

The controller performs the actual
owner/admin authorization check and
blocks deletion when an active booking
exists.
*/

router.delete(
  "/:id",
  requireAuth,
  deleteJob
);


export default router;

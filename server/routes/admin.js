import express from "express";

import {
requireAuth,
requireRole
} from "../middleware/authMiddleware.js";

import {
getDashboard,
getAdminUsers,
getAdminJobs,
getAdminWorkers,
getAdminBookings,
getAdminPayments,
getAdminReport
} from "../controllers/adminController.js";

import {
updateAdminJob,
deleteAdminJob,
updateAdminWorker,
updateAdminPaymentStatus,
refundAdminPayment
} from "../controllers/adminManagementController.js";

const router = express.Router();

/*

ALL ADMIN ROUTES

*/

router.use(requireAuth);
router.use(requireRole("admin"));

/*

ADMIN API HEALTH

*/

router.get("/", (req, res) => {
return res.status(200).json({
success: true,
message: "Admin API is working.",
admin: {
id: req.user.id,
email: req.user.email,
role: req.user.role
}
});
});

/*

DASHBOARD / READ APIs

*/

router.get(
"/dashboard",
getDashboard
);

router.get(
"/users",
getAdminUsers
);

router.get(
"/jobs",
getAdminJobs
);

router.get(
"/workers",
getAdminWorkers
);

router.get(
"/bookings",
getAdminBookings
);

router.get(
"/payments",
getAdminPayments
);

router.get(
"/reports",
getAdminReport
);

/*

JOB MANAGEMENT

*/

router.patch(
"/jobs/:id",
updateAdminJob
);

router.delete(
"/jobs/:id",
deleteAdminJob
);

/*

WORKER MANAGEMENT / VERIFICATION

*/

router.patch(
"/workers/:id",
updateAdminWorker
);

/*

PAYMENT MANAGEMENT

*/

router.patch(
"/payments/:id/status",
updateAdminPaymentStatus
);

router.post(
"/payments/:id/refund",
refundAdminPayment
);

export default router;

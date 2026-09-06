import express from "express";
import rateLimit from "express-rate-limit";

import {
signup,
login,
getCurrentUser
} from "../controllers/authController.js";

import {
requireAuth
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*

AUTH RATE LIMITERS

*/

const registerLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
limit: 10,
standardHeaders: "draft-7",
legacyHeaders: false,

message: {
success: false,
message:
"Too many signup attempts. Please try again later."
}
});

const loginLimiter = rateLimit({
windowMs: 15 * 60 * 1000,
limit: 10,
standardHeaders: "draft-7",
legacyHeaders: false,

message: {
success: false,
message:
"Too many login attempts. Please try again later."
}
});

/*

PUBLIC AUTH ROUTES

*/

router.post(
"/register",
registerLimiter,
signup
);

router.post(
"/login",
loginLimiter,
login
);

/*

PROTECTED CURRENT USER

*/

router.get(
"/me",
requireAuth,
getCurrentUser
);

/*

AUTH STATUS

*/

router.get(
"/status",
(req, res) => {
return res.status(200).json({
success: true,
message:
"Auth route is working."
});
}
);

export default router;

import express from "express";

const router = express.Router();

router.post("/register", (req, res) => {
  res.status(501).json({
    success: false,
    message: "Registration API is not connected to a database yet."
  });
});

router.post("/login", (req, res) => {
  res.status(501).json({
    success: false,
    message: "Login API is not connected to a database yet."
  });
});

router.get("/status", (req, res) => {
  res.json({
    success: true,
    message: "Auth route is working."
  });
});

export default router;

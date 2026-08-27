import express from "express";

const router = express.Router();

const jobs = [];

router.get("/", (req, res) => {
  res.json({
    success: true,
    data: jobs
  });
});

router.post("/", (req, res) => {
  const { title, description, location, budget, service } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message: "Title and description are required."
    });
  }

  const job = {
    id: Date.now().toString(),
    title,
    description,
    location: location || "",
    budget: budget || "",
    service: service || "",
    status: "open",
    createdAt: new Date().toISOString()
  };

  jobs.unshift(job);

  res.status(201).json({
    success: true,
    message: "Job created successfully.",
    data: job
  });
});

router.get("/:id", (req, res) => {
  const job = jobs.find((item) => item.id === req.params.id);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: "Job not found."
    });
  }

  res.json({
    success: true,
    data: job
  });
});

export default router;

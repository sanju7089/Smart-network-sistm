const workers = [];

export function getWorkers(req, res) {
  const { service, location } = req.query;

  let data = [...workers];

  if (service) {
    data = data.filter(
      (worker) =>
        worker.service?.toLowerCase() === service.toLowerCase()
    );
  }

  if (location) {
    data = data.filter(
      (worker) =>
        worker.location?.toLowerCase().includes(location.toLowerCase())
    );
  }

  res.json({
    success: true,
    data
  });
}

export function getWorkerById(req, res) {
  const worker = workers.find(
    (item) => item.id === req.params.id
  );

  if (!worker) {
    return res.status(404).json({
      success: false,
      message: "Worker not found."
    });
  }

  res.json({
    success: true,
    data: worker
  });
}

export function createWorkerProfile(req, res) {
  const { name, service, location, phone, experience, bio } = req.body;

  if (!name || !service) {
    return res.status(400).json({
      success: false,
      message: "Name and service are required."
    });
  }

  const worker = {
    id: Date.now().toString(),
    userId: req.user?.id || null,
    name,
    service,
    location: location || "",
    phone: phone || "",
    experience: experience || "",
    bio: bio || "",
    verified: false,
    createdAt: new Date().toISOString()
  };

  workers.unshift(worker);

  res.status(201).json({
    success: true,
    message: "Worker profile created successfully.",
    data: worker
  });
}

export function updateWorkerProfile(req, res) {
  const worker = workers.find(
    (item) =>
      item.id === req.params.id ||
      item.userId === req.user?.id
  );

  if (!worker) {
    return res.status(404).json({
      success: false,
      message: "Worker profile not found."
    });
  }

  const allowedFields = [
    "name",
    "service",
    "location",
    "phone",
    "experience",
    "bio"
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      worker[field] = req.body[field];
    }
  });

  worker.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Worker profile updated successfully.",
    data: worker
  });
    }

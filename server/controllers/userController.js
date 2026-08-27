const users = [];

export function getUsers(req, res) {
  res.json({
    success: true,
    data: users.map(({ password, ...user }) => user)
  });
}

export function getUserById(req, res) {
  const user = users.find(
    (item) => item.id === req.params.id
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  const { password, ...safeUser } = user;

  res.json({
    success: true,
    data: safeUser
  });
}

export function getMyProfile(req, res) {
  const user = users.find(
    (item) => item.id === req.user?.id
  );

  if (!user) {
    return res.json({
      success: true,
      data: req.user
    });
  }

  const { password, ...safeUser } = user;

  res.json({
    success: true,
    data: safeUser
  });
}

export function updateMyProfile(req, res) {
  const user = users.find(
    (item) => item.id === req.user?.id
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User profile not found."
    });
  }

  const allowedFields = ["name", "phone", "location", "bio"];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      user[field] = req.body[field];
    }
  });

  user.updatedAt = new Date().toISOString();

  const { password, ...safeUser } = user;

  res.json({
    success: true,
    message: "Profile updated successfully.",
    data: safeUser
  });
}

export function deleteUser(req, res) {
  const index = users.findIndex(
    (item) => item.id === req.params.id
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: "User not found."
    });
  }

  users.splice(index, 1);

  res.json({
    success: true,
    message: "User deleted successfully."
  });
  }

import mongoose from "mongoose";
import User from "../models/User.js";

function isValidId(id) {
return mongoose.Types.ObjectId.isValid(id);
}

function isAdmin(user) {
return user?.role === "admin";
}

function safeUser(user) {
if (!user) {
return null;
}

return {
id: user._id,
name: user.name,
email: user.email,
role: user.role,
phone: user.phone,
location: user.location,
isActive: user.isActive,
createdAt: user.createdAt,
updatedAt: user.updatedAt
};
}

function normalizeText(value, maxLength = 500) {
if (typeof value !== "string") {
return "";
}

return value.trim().slice(0, maxLength);
}

function getValidationErrors(error) {
const errors = {};

if (!error?.errors) {
return errors;
}

for (const [field, fieldError] of Object.entries(error.errors)) {
errors[field] =
fieldError?.message ||
"Invalid value.";
}

return errors;
}

function isValidationError(error) {
return error?.name === "ValidationError";
}

function isDuplicateKeyError(error) {
return error?.code === 11000;
}

/*

ADMIN: GET ALL USERS

*/

export async function getUsers(req, res) {
try {
if (!isAdmin(req.user)) {
return res.status(403).json({
success: false,
message: "Only admins can view all users."
});
}

const users = await User.find()
  .sort({
    createdAt: -1
  });

return res.status(200).json({
  success: true,
  count: users.length,
  data: users.map(safeUser)
});

} catch (error) {
console.error(
"GET USERS ERROR:",
error
);

return res.status(500).json({
  success: false,
  message: "Unable to fetch users."
});

}
}

/*

GET MY PROFILE

*/

export async function getMyProfile(req, res) {
try {
const user = await User.findById(
req.user.id
);

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User profile not found."
  });
}

return res.status(200).json({
  success: true,
  data: safeUser(user)
});

} catch (error) {
console.error(
"GET MY PROFILE ERROR:",
error
);

return res.status(500).json({
  success: false,
  message: "Unable to fetch profile."
});

}
}

/*

UPDATE MY PROFILE

*/

export async function updateMyProfile(req, res) {
try {
const body =
req.body &&
typeof req.body === "object" &&
!Array.isArray(req.body)
? req.body
: {};

const updates = {};

/*
  Only these fields can be changed
  by the user.

  Email, password and role cannot
  be changed through this endpoint.
*/
if (body.name !== undefined) {
  if (typeof body.name !== "string") {
    return res.status(400).json({
      success: false,
      message: "Name must be a string."
    });
  }

  const name = normalizeText(
    body.name,
    100
  );

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Name must be at least 2 characters."
    });
  }

  updates.name = name;
}

if (body.phone !== undefined) {
  if (typeof body.phone !== "string") {
    return res.status(400).json({
      success: false,
      message: "Phone must be a string."
    });
  }

  updates.phone = normalizeText(
    body.phone,
    30
  );
}

if (body.location !== undefined) {
  if (typeof body.location !== "string") {
    return res.status(400).json({
      success: false,
      message: "Location must be a string."
    });
  }

  updates.location = normalizeText(
    body.location,
    200
  );
}

if (
  Object.keys(updates).length === 0
) {
  return res.status(400).json({
    success: false,
    message: "No valid fields provided for update."
  });
}

const user =
  await User.findByIdAndUpdate(
    req.user.id,
    {
      $set: updates
    },
    {
      new: true,
      runValidators: true,
      context: "query"
    }
  );

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User profile not found."
  });
}

return res.status(200).json({
  success: true,
  message: "Profile updated successfully.",
  data: safeUser(user)
});

} catch (error) {
console.error(
"UPDATE PROFILE ERROR:",
error
);

if (isValidationError(error)) {
  return res.status(400).json({
    success: false,
    message: "Profile validation failed.",
    errors: getValidationErrors(error)
  });
}

if (isDuplicateKeyError(error)) {
  return res.status(409).json({
    success: false,
    message: "A user with the submitted information already exists."
  });
}

return res.status(500).json({
  success: false,
  message: "Unable to update profile."
});

}
}

/*

GET USER BY ID

*/

export async function getUserById(req, res) {
try {
const { id } = req.params;

if (!isValidId(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid user ID."
  });
}

const isOwnProfile =
  String(req.user.id) ===
  String(id);

if (
  !isAdmin(req.user) &&
  !isOwnProfile
) {
  return res.status(403).json({
    success: false,
    message:
      "You do not have permission to view this user."
  });
}

const user =
  await User.findById(id);

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User not found."
  });
}

return res.status(200).json({
  success: true,
  data: safeUser(user)
});

} catch (error) {
console.error(
"GET USER ERROR:",
error
);

return res.status(500).json({
  success: false,
  message: "Unable to fetch user."
});

}
}

/*

ADMIN: DEACTIVATE USER

*/

export async function deleteUser(req, res) {
try {
if (!isAdmin(req.user)) {
return res.status(403).json({
success: false,
message: "Only admins can manage users."
});
}

const { id } = req.params;

if (!isValidId(id)) {
  return res.status(400).json({
    success: false,
    message: "Invalid user ID."
  });
}

if (
  String(req.user.id) ===
  String(id)
) {
  return res.status(400).json({
    success: false,
    message:
      "You cannot deactivate your own account."
  });
}

const user =
  await User.findByIdAndUpdate(
    id,
    {
      $set: {
        isActive: false
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User not found."
  });
}

return res.status(200).json({
  success: true,
  message:
    "User account deactivated successfully.",
  data: safeUser(user)
});

} catch (error) {
console.error(
"DEACTIVATE USER ERROR:",
error
);

if (isValidationError(error)) {
  return res.status(400).json({
    success: false,
    message: "User validation failed.",
    errors: getValidationErrors(error)
  });
}

if (isDuplicateKeyError(error)) {
  return res.status(409).json({
    success: false,
    message: "User data already exists."
  });
}

return res.status(500).json({
  success: false,
  message: "Unable to deactivate user."
});

}
}

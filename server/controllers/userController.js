import mongoose from "mongoose";
import User from "../models/User.js";

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function isAdmin(user) {
  return user?.role === "admin";
}

function safeUser(user) {
  if (!user) return null;

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

// Admin: सभी users
export async function getUsers(req, res) {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can view all users."
      });
    }

    const users = await User.find()
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: users.length,
      data: users.map(safeUser)
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users."
    });
  }
}

// अपना profile
export async function getMyProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found."
      });
    }

    return res.json({
      success: true,
      data: safeUser(user)
    });
  } catch (error) {
    console.error("GET MY PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch profile."
    });
  }
}

// अपना profile update
export async function updateMyProfile(req, res) {
  try {
    const allowedFields = [
      "name",
      "phone",
      "location"
    ];

    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update."
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found."
      });
    }

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      data: safeUser(user)
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update profile."
    });
  }
}

// Admin: एक specific user
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
      String(req.user.id) === String(id);

    if (!isAdmin(req.user) && !isOwnProfile) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view this user."
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      data: safeUser(user)
    });
  } catch (error) {
    console.error("GET USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch user."
    });
  }
}

// Admin: user को deactivate करना
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

    if (String(req.user.id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account."
      });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      message: "User account deactivated successfully.",
      data: safeUser(user)
    });
  } catch (error) {
    console.error("DEACTIVATE USER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to deactivate user."
    });
  }
      }

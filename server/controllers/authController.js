import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Worker from "../models/Worker.js";

const JWT_SECRET = process.env.JWT_SECRET;

function createToken(user) {
if (!JWT_SECRET) {
throw new Error("JWT_SECRET is not configured.");
}

return jwt.sign(
{
id: user._id.toString(),
email: user.email,
role: user.role
},
JWT_SECRET,
{
expiresIn: "7d"
}
);
}

export async function signup(req, res) {
try {
const {
name,
email,
password,
role,
phone,
location
} = req.body;

if (!name || !email || !password) {
  return res.status(400).json({
    success: false,
    message: "Name, email and password are required."
  });
}

if (String(name).trim().length < 2) {
  return res.status(400).json({
    success: false,
    message: "Name must be at least 2 characters."
  });
}

if (String(password).length < 8) {
  return res.status(400).json({
    success: false,
    message: "Password must be at least 8 characters."
  });
}

const normalizedEmail = String(email)
  .trim()
  .toLowerCase();

const existingUser = await User.findOne({
  email: normalizedEmail
});

if (existingUser) {
  return res.status(409).json({
    success: false,
    message: "An account with this email already exists."
  });
}

const allowedRoles = [
  "customer",
  "worker"
];

const safeRole = allowedRoles.includes(role)
  ? role
  : "customer";

const cleanName = String(name).trim();

const cleanPhone = phone
  ? String(phone).trim()
  : "";

const cleanLocation = location
  ? String(location).trim()
  : "";

const hashedPassword = await bcrypt.hash(
  password,
  12
);

const user = await User.create({
  name: cleanName,
  email: normalizedEmail,
  password: hashedPassword,
  role: safeRole,
  phone: cleanPhone,
  location: cleanLocation
});

let workerProfile = null;

/*
  Worker signup होने पर automatic
  basic Worker Profile बनाई जाएगी।

  Service बाद में Worker अपनी profile
  से complete/update कर सकता है.
*/

if (safeRole === "worker") {
  try {
    workerProfile = await Worker.create({
      userId: user._id,
      name: cleanName,

      /*
        Worker model में service required है,
        इसलिए शुरुआत में default रखा गया है.
        Worker बाद में इसे अपनी actual service
        से update करेगा.
      */
      service: "Not specified",

      location: cleanLocation,
      phone: cleanPhone,

      experience: "",
      bio: "",

      verified: false,

      /*
        Profile बनी है लेकिन service/profile
        completion के बाद worker अपनी details
        update कर सकता है.
      */
      isActive: true
    });
  } catch (workerError) {
    /*
      अगर Worker Profile creation fail हो जाए
      तो orphan User account नहीं छोड़ेंगे.
    */

    await User.findByIdAndDelete(
      user._id
    );

    console.error(
      "AUTO WORKER PROFILE ERROR:",
      workerError
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create worker profile. Account was not created."
    });
  }
}

const token = createToken(user);

return res.status(201).json({
  success: true,

  message:
    safeRole === "worker"
      ? "Worker account and profile created successfully."
      : "Account created successfully.",

  token,

  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    location: user.location
  },

  workerProfile: workerProfile
    ? {
        id: workerProfile._id,
        service: workerProfile.service,
        verified: workerProfile.verified,
        isActive: workerProfile.isActive
      }
    : null
});

} catch (error) {
console.error(
"SIGNUP ERROR:",
error
);

return res.status(500).json({
  success: false,
  message: "Unable to create account."
});

}
}

export async function login(req, res) {
try {
const {
email,
password
} = req.body;

if (!email || !password) {
  return res.status(400).json({
    success: false,
    message:
      "Email and password are required."
  });
}

const normalizedEmail = String(email)
  .trim()
  .toLowerCase();

const user = await User.findOne({
  email: normalizedEmail
}).select("+password");

if (!user) {
  return res.status(401).json({
    success: false,
    message:
      "Invalid email or password."
  });
}

if (!user.isActive) {
  return res.status(403).json({
    success: false,
    message:
      "This account is inactive."
  });
}

const passwordMatched =
  await bcrypt.compare(
    password,
    user.password
  );

if (!passwordMatched) {
  return res.status(401).json({
    success: false,
    message:
      "Invalid email or password."
  });
}

const token = createToken(user);

return res.json({
  success: true,
  message: "Login successful.",
  token,

  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    location: user.location
  }
});

} catch (error) {
console.error(
"LOGIN ERROR:",
error
);

return res.status(500).json({
  success: false,
  message: "Unable to login."
});

}
}

export async function getCurrentUser(req, res) {
try {
const user = await User.findById(
req.user.id
);

if (!user) {
  return res.status(404).json({
    success: false,
    message: "User not found."
  });
}

if (!user.isActive) {
  return res.status(403).json({
    success: false,
    message: "This account is inactive."
  });
}

return res.json({
  success: true,

  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    location: user.location
  }
});

} catch (error) {
console.error(
"CURRENT USER ERROR:",
error
);

return res.status(500).json({
  success: false,
  message:
    "Unable to get user information."
});

}
    }

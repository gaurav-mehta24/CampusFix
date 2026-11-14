
const express = require("express");
const supabase = require("./supabase");

const router = express.Router();

// Convert Supabase profile into the user format used by CampusFix.
function safeUser(profile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    department: profile.department || null
  };
}

// Get a user's profile from the profiles table.
async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, department")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

// Verify the Supabase access token and load the user's actual role.
async function authenticateToken(req, res, next) {
  try {
    const header = req.headers.authorization;

    const token =
      header && header.startsWith("Bearer ")
        ? header.slice(7)
        : null;

    if (!token) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        message: "Invalid or expired token."
      });
    }

    const profile = await getProfile(data.user.id);

    req.user = {
      sub: profile.id,
      role: profile.role,
      name: profile.name,
      email: profile.email,
      department: profile.department || null
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    res.status(500).json({
      message: "Could not verify your account."
    });
  }
}

// Check allowed roles.
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You are not authorized to perform this action."
      });
    }

    next();
  };
}

// Create a student account.
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters."
      });
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          name: name.trim()
        }
      }
    });

    if (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    let profile = null;

    if (data.user) {
      try {
        profile = await getProfile(data.user.id);
      } catch (profileError) {
        console.error("Profile creation error:", profileError.message);
      }
    }

    res.status(201).json({
      message: data.session
        ? "Student account created successfully. You can now log in."
        : "Account created. Please verify your email if confirmation is enabled, then log in.",
      token: data.session?.access_token || null,
      user: profile ? safeUser(profile) : null
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      message: "Registration failed."
    });
  }
});

// One-time initial admin setup.
router.post("/setup-admin", async (req, res) => {
  try {
    const { name, email, password, setupKey } = req.body;

    if (!process.env.ADMIN_SETUP_KEY) {
      return res.status(503).json({
        message: "Admin setup is not configured."
      });
    }

    if (
      typeof setupKey !== "string" ||
      setupKey !== process.env.ADMIN_SETUP_KEY
    ) {
      return res.status(403).json({
        message: "Invalid setup key."
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Name, email and password are required."
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        message: "Admin password must be at least 12 characters."
      });
    }

    const { data: existingAdmins, error: adminCheckError } =
      await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")
        .limit(1);

    if (adminCheckError) throw adminCheckError;

    if (existingAdmins.length > 0) {
      return res.status(409).json({
        message: "An admin account already exists."
      });
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        name: name.trim()
      }
    });

    if (error) {
      return res.status(400).json({
        message: error.message
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: "admin",
        department: null
      })
      .eq("id", data.user.id)
      .select("id, name, email, role, department")
      .single();

    if (profileError) throw profileError;

    res.status(201).json({
      message: "Initial admin account created successfully.",
      user: safeUser(profile)
    });
  } catch (error) {
    console.error("Admin setup error:", error);

    res.status(500).json({
      message: "Admin setup failed."
    });
  }
});

// Login for students, staff and admins.
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      !email.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (error || !data.session || !data.user) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    const profile = await getProfile(data.user.id);

    res.json({
      message: "Login successful.",
      token: data.session.access_token,
      user: safeUser(profile)
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      message: "Login failed."
    });
  }
});

// Current logged-in user.
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const profile = await getProfile(req.user.sub);

    res.json({
      user: safeUser(profile)
    });
  } catch (error) {
    console.error("Profile error:", error);

    res.status(404).json({
      message: "User profile not found."
    });
  }
});

// Admin creates staff accounts.
router.post(
  "/staff",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, email, password, department } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password ||
        typeof department !== "string" ||
        !department.trim()
      ) {
        return res.status(400).json({
          message: "Name, email, password and department are required."
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          message: "Staff password must be at least 8 characters."
        });
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          name: name.trim()
        }
      });

      if (error) {
        return res.status(400).json({
          message: error.message
        });
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .update({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: "staff",
          department: department.trim()
        })
        .eq("id", data.user.id)
        .select("id, name, email, role, department")
        .single();

      if (profileError) throw profileError;

      res.status(201).json({
        message: "Staff account created successfully.",
        user: safeUser(profile)
      });
    } catch (error) {
      console.error("Staff creation error:", error);

      res.status(500).json({
        message: "Staff account creation failed."
      });
    }
  }
);

// Admin views all user profiles.
router.get(
  "/users",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, role, department")
        .order("name", { ascending: true });

      if (error) throw error;

      res.json(data.map(safeUser));
    } catch (error) {
      console.error("Users fetch error:", error);

      res.status(500).json({
        message: "Could not load users."
      });
    }
  }
);

module.exports = {
  router,
  authenticateToken,
  authorizeRoles
};

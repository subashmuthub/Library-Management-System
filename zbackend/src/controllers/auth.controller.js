/**
 * Authentication Controller
 *
 * Handles user registration and login logic.
 */

const bcrypt = require("bcryptjs");
const { query } = require("../config/database");

/**
 * Convert role name to role ID
 * Maps frontend role strings to database role IDs
 */
const getRoleId = (roleName) => {
  const roleMap = {
    admin: 1,
    librarian: 2,
    student: 3,
  };
  return roleMap[roleName] || 3; // Default to student
};

/**
 * Convert role ID to role name
 * Maps database role IDs to role strings
 */
const getRoleName = (roleId) => {
  const roleMap = {
    1: "admin",
    2: "librarian",
    3: "student",
  };
  return roleMap[roleId] || "student";
};

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  try {
    console.log("🔷 Registration attempt:", req.body);

    const { email, password, name, role, student_id, phone } = req.body;

    // Check if user already exists
    const existingUser = await query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: "Registration Error",
        message: "Email already registered",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Split name into first and last name
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || nameParts[0];

    // Convert role string to role ID
    const roleId = getRoleId(role);
    console.log("🔷 Role conversion:", { role, roleId });

    // Insert new user
    const result = await query(
      `INSERT INTO users (email, password, first_name, last_name, role_id, student_id, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, passwordHash, firstName, lastName, roleId, student_id, phone],
    );

    console.log("🔷 User created with ID:", result.insertId);

    // Create server-side session.
    // regenerate() creates a fresh session ID to prevent session fixation.
    req.session.regenerate((sessionErr) => {
      if (sessionErr) return next(sessionErr);

      req.session.user = {
        id: result.insertId,
        email,
        role: role || "student",
        role_id: roleId,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        res.status(201).json({
          message: "User registered successfully",
          user: {
            id: result.insertId,
            name: name,
            first_name: firstName,
            last_name: lastName,
            email,
            role: role || "student",
            student_id,
          },
        });
      });
    });
  } catch (error) {
    console.error("🔴 Registration error:", error);
    next(error);
  }
};

/**
 * Login user and generate JWT
 */
const login = async (req, res, next) => {
  try {
    console.log("🔷 Login attempt started:", req.body);

    const { email, password } = req.body;

    // Find user
    const users = await query(
      `SELECT u.id, u.email, u.password, u.first_name, u.last_name, 
              u.role_id, r.role_name, u.student_id, u.status
       FROM users u
       JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email],
    );

    console.log("🔷 Database query result:", {
      email,
      found: users.length > 0,
      userCount: users.length,
    });

    if (users.length === 0) {
      console.log("🔴 User not found for email:", email);
      return res.status(401).json({
        error: "Authentication Error",
        message: "Invalid email or password",
      });
    }

    const user = users[0];
    console.log("🔷 User found:", {
      email: user.email,
      status: user.status,
      role: user.role_name,
      hasPassword: !!user.password,
    });

    // Check if account is active
    if (user.status !== "active") {
      console.log("🔴 Account inactive:", { email, status: user.status });
      return res.status(403).json({
        error: "Authentication Error",
        message: "Account is inactive or suspended",
      });
    }

    // Verify password
    console.log("🔷 Comparing passwords...");
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log("🔷 Password validation result:", {
      valid: isValidPassword,
      providedLength: password.length,
    });

    if (!isValidPassword) {
      console.log("🔴 Invalid password for user:", email);
      return res.status(401).json({
        error: "Authentication Error",
        message: "Invalid email or password",
      });
    }

    console.log("🔷 Login successful, generating token...");

    // Create server-side session.
    // regenerate() creates a new session ID to prevent session fixation.
    req.session.regenerate((sessionErr) => {
      if (sessionErr) return next(sessionErr);

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        console.log("🔷 Session created for:", email);
        res.json({
          message: "Login successful",
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role_name,
            student_id: user.student_id,
          },
        });
      });
    });
  } catch (error) {
    console.error("🔴 Login error:", error);
    next(error);
  }
};

/**
 * Logout user
 */
const logout = async (req, res, next) => {
  try {
    // Destroy the server-side session and clear the session cookie.
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie("library.sid");
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Return current session user (used by frontend to verify session on load)
 */
const me = (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ error: "No active session" });
};

module.exports = {
  register,
  login,
  logout,
  me,
};

/**
 * Authentication Controller
 *
 * Handles user registration and login logic.
 */

const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { OAuth2Client } = require("google-auth-library");
const { query } = require("../config/database");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getGoogleRedirectUri = (req) => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  return `${req.protocol}://localhost:${process.env.PORT || 3000}/api/v1/auth/google/callback`;
};

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
      `SELECT
          u.id,
          u.email,
          u.password,
          u.first_name,
          u.last_name,
          u.role_id,
          COALESCE(
            r.role_name,
            CASE u.role_id
              WHEN 1 THEN 'admin'
              WHEN 2 THEN 'librarian'
              WHEN 3 THEN 'student'
              ELSE 'student'
            END
          ) AS role_name,
          u.student_id,
          u.status
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
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
 * Login/Register user with Google ID token
 */
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        error: "Configuration Error",
        message: "Google Sign-In is not configured on server",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const emailVerified = payload?.email_verified;
    const givenName = payload?.given_name || "Google";
    const familyName = payload?.family_name || "User";

    if (!email || !emailVerified) {
      return res.status(401).json({
        error: "Authentication Error",
        message: "Google account email is not verified",
      });
    }

    const users = await query(
      `SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.role_id,
          COALESCE(
            r.role_name,
            CASE u.role_id
              WHEN 1 THEN 'admin'
              WHEN 2 THEN 'librarian'
              WHEN 3 THEN 'student'
              ELSE 'student'
            END
          ) AS role_name,
          u.student_id,
          u.status
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email],
    );

    let user = users[0];

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const insertResult = await query(
        `INSERT INTO users (email, password, first_name, last_name, role_id, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [email, passwordHash, givenName, familyName, 3],
      );

      const createdUsers = await query(
        `SELECT
            u.id,
            u.email,
            u.first_name,
            u.last_name,
            u.role_id,
            COALESCE(
              r.role_name,
              CASE u.role_id
                WHEN 1 THEN 'admin'
                WHEN 2 THEN 'librarian'
                WHEN 3 THEN 'student'
                ELSE 'student'
              END
            ) AS role_name,
            u.student_id,
            u.status
         FROM users u
         LEFT JOIN user_roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [insertResult.insertId],
      );

      user = createdUsers[0];
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "Authentication Error",
        message: "Account is inactive or suspended",
      });
    }

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

        res.json({
          message: "Google login successful",
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
    console.error("🔴 Google login error:", error);
    return res.status(401).json({
      error: "Authentication Error",
      message: "Invalid Google token",
    });
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
  if (req.session?.user) {
    return res.json({ user: req.session.user });
  }
  return res.status(401).json({ error: "No active session" });
};

/**
 * Step 1 of OAuth redirect flow: redirect browser to Google's consent screen.
 * Works from ANY frontend port because the browser follows the redirect to Google,
 * and Google always returns to the registered redirect_uri on port 3000.
 *
 * Query param: return_url  — where to send the user after login (optional).
 *   e.g. http://localhost:5173/dashboard  (saved in OAuth state)
 */
const googleOAuthStart = (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res
      .status(500)
      .send(
        "Google OAuth is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET).",
      );
  }

  const redirectUri = getGoogleRedirectUri(req);
  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );

  // Store return_url in the state param so the callback can redirect back to the right origin.
  const state = Buffer.from(
    JSON.stringify({
      returnUrl:
        req.query.return_url ||
        `${req.protocol}://localhost:${process.env.PORT || 3000}/`,
    }),
  ).toString("base64url");

  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account",
  });

  res.redirect(authUrl);
};

/**
 * Step 2 of OAuth redirect flow: Google sends the browser here with ?code=...&state=...
 * Exchange the code for tokens, find/create the user, set session, redirect to app.
 */
const googleOAuthCallback = async (req, res, next) => {
  const { code, state, error: oauthError } = req.query;

  // Default fallback URL
  const defaultReturn = `${req.protocol}://localhost:${process.env.PORT || 3000}/`;
  let returnUrl = defaultReturn;
  let loginPageUrl = defaultReturn;

  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      returnUrl = stateData.returnUrl || defaultReturn;
      // Login page = same origin as returnUrl but at root path
      loginPageUrl = new URL(returnUrl).origin + "/";
    }
  } catch {
    /* keep default */
  }

  if (oauthError || !code) {
    console.error("🔴 Google OAuth error:", oauthError);
    return res.redirect(
      `${loginPageUrl}?google_error=${encodeURIComponent(oauthError || "cancelled")}`,
    );
  }

  try {
    const redirectUri = getGoogleRedirectUri(req);
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify the ID token to get user info
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email;
    const emailVerified = payload?.email_verified;
    const givenName = payload?.given_name || "Google";
    const familyName = payload?.family_name || "User";

    if (!email || !emailVerified) {
      return res.redirect(`${loginPageUrl}?google_error=unverified_email`);
    }

    // Find or create user (same logic as googleLogin)
    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id,
              COALESCE(r.role_name, CASE u.role_id WHEN 1 THEN 'admin' WHEN 2 THEN 'librarian' ELSE 'student' END) AS role_name,
              u.student_id, u.status
       FROM users u LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email],
    );

    let user = users[0];

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      const insertResult = await query(
        `INSERT INTO users (email, password, first_name, last_name, role_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
        [email, passwordHash, givenName, familyName, 3],
      );
      const created = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id,
                COALESCE(r.role_name, 'student') AS role_name, u.student_id, u.status
         FROM users u LEFT JOIN user_roles r ON u.role_id = r.id WHERE u.id = ?`,
        [insertResult.insertId],
      );
      user = created[0];
    }

    if (user.status !== "active") {
      return res.redirect(`${loginPageUrl}?google_error=account_suspended`);
    }

    // Set session
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.user = {
          id: user.id,
          email: user.email,
          role: user.role_name,
          role_id: user.role_id,
        };
        req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
      });
    });

    console.log(
      `✅ Google OAuth login: ${email} → redirecting to ${returnUrl}`,
    );
    res.redirect(returnUrl);
  } catch (error) {
    console.error("🔴 Google OAuth callback error:", error);
    return res.redirect(`${loginPageUrl}?google_error=server_error`);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  googleOAuthStart,
  googleOAuthCallback,
  logout,
  me,
};

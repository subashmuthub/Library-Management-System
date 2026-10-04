/**
 * Authentication Controller
 *
 * Handles user registration and login logic.
 */

const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const passport = require("passport");
const { OAuth2Client } = require("google-auth-library");
const { query } = require("../config/database");
const EmailService = require("../services/email.service");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
let authSchemaReady = false;

const getGoogleRedirectUri = (req) => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  return `${req.protocol}://localhost:${process.env.PORT || 3000}/api/v1/auth/google/callback`;
};

const OTP_EXPIRY_MINUTES = 10;

const hashOtp = (otp) =>
  crypto.createHash("sha256").update(String(otp)).digest("hex");

const createOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const ensureAuthVerificationSchema = async () => {
  if (authSchemaReady) return;

  await query(`
    CREATE TABLE IF NOT EXISTS email_verification_otps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      is_used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_otp_email (email),
      INDEX idx_otp_user (user_id),
      INDEX idx_otp_expires (expires_at)
    ) ENGINE=InnoDB;
  `);

  const emailVerifiedColumn = await query(
    `SELECT COUNT(*) as total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified'`,
  );

  if (!emailVerifiedColumn[0]?.total) {
    await query(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE`);
  }

  const emailVerifiedAtColumn = await query(
    `SELECT COUNT(*) as total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'email_verified_at'`,
  );

  if (!emailVerifiedAtColumn[0]?.total) {
    await query(`ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL`);
  }

  const googleIdColumn = await query(
    `SELECT COUNT(*) as total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'google_id'`,
  );
  if (!googleIdColumn[0]?.total) {
    await query(`ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE`);
  }

  const authProviderColumn = await query(
    `SELECT COUNT(*) as total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'auth_provider'`,
  );
  if (!authProviderColumn[0]?.total) {
    await query(`ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local'`);
  }

  const profileImageColumn = await query(
    `SELECT COUNT(*) as total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'profile_image_url'`,
  );
  if (!profileImageColumn[0]?.total) {
    await query(`ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL`);
  }

  authSchemaReady = true;
};

const sendEmailVerificationOtp = async ({ userId, email, firstName }) => {
  const otpCode = createOtpCode();
  const otpHash = hashOtp(otpCode);

  await query(
    `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [userId, email, otpHash, OTP_EXPIRY_MINUTES],
  );

  const emailResult = await EmailService.sendOtpEmail(email, firstName, otpCode);
  if (!emailResult.success) {
    throw new Error("Unable to send OTP email. Please try again later.");
  }
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
    4: "staff",
    5: "me_student",
    6: "research_scholar",
    7: "clerk",
  };
  return roleMap[roleId] || "student";
};

const jwt = require("jsonwebtoken");
const { hasDirectResearchAccess } = require("../utils/access-control.helper");

const generateAuthToken = (user) => {
  const isStudentRole = ['student', 'me_student', 'research_scholar'].includes(
    String(user.role_name || user.role || '').toLowerCase()
  );
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role_name || user.role,
      role_id: user.role_id,
      first_name: user.first_name,
      last_name: user.last_name,
      student_id: user.student_id,
      degree_type: isStudentRole ? (user.degree_type || 'BE') : null,
      department: user.department || (isStudentRole ? 'CSE' : (user.role_name === 'admin' ? 'Administration' : 'Library')),
      academic_year: isStudentRole ? (user.academic_year || '3rd Year') : null,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );
};

/**
 * Register a new user
 */
const register = async (req, res, next) => {
  let createdUserId = null;
  try {
    console.log("🔷 Registration attempt:", req.body);
    await ensureAuthVerificationSchema();

    const { email, password, name, student_id, employee_id, staff_id, phone, role } = req.body;
    const requestedRole = String(role || 'student').toLowerCase();
    const staffEmailDomains = (process.env.STAFF_EMAIL_DOMAINS || 'nec.edu.in,college.edu,university.edu').split(',').map(d => d.trim().toLowerCase());

    // Determine role based on requested role and college staff domain
    let targetRoleId = 3;
    let assignedRole = 'student';

    if (requestedRole === 'staff') {
      const emailDomain = (email || '').split('@')[1]?.toLowerCase() || '';
      const isApprovedDomain = staffEmailDomains.some(d => emailDomain === d || emailDomain.endsWith('.' + d) || emailDomain.includes('staff') || emailDomain.includes('faculty'));

      if (!isApprovedDomain) {
        return res.status(400).json({
          error: "Registration Error",
          message: `Staff registration requires an authorized college staff email domain (e.g. ${staffEmailDomains.join(', ')}).`,
        });
      }
      targetRoleId = 4;
      assignedRole = 'staff';
    }

    // Check if user already exists
    const existingUser = await query(
      `SELECT id, role_id, status, COALESCE(email_verified, 0) AS email_verified
       FROM users
       WHERE email = ?`,
      [email],
    );

    if (existingUser.length > 0) {
      if (!Number(existingUser[0].email_verified)) {
        return res.status(409).json({
          error: "Verification Error",
          message:
            "This email is already registered but not verified. Please verify OTP or resend OTP.",
          code: "EMAIL_NOT_VERIFIED",
          email,
        });
      }

      return res.status(409).json({
        error: "Registration Error",
        message:
          "Email already exists. Please login with password or Continue with Google.",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Split name into first and last name
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || nameParts[0];

    const effectiveId = student_id || employee_id || staff_id || (assignedRole === 'staff' ? `STAFF-${Date.now().toString().slice(-4)}` : null);

    const result = await query(
      `INSERT INTO users (email, password, first_name, last_name, role_id, student_id, phone, status, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
      [email, passwordHash, firstName, lastName, targetRoleId, effectiveId, phone || null],
    );
    createdUserId = result.insertId;
    console.log("🔷 User created with ID:", createdUserId, "Role:", assignedRole);

    await sendEmailVerificationOtp({ userId: createdUserId, email, firstName });

    res.status(201).json({
      message: "Registration successful. OTP sent to email.",
      requires_verification: true,
      email,
      role: assignedRole,
    });
  } catch (error) {
    console.error("🔴 Registration error:", error);

    if (
      createdUserId &&
      String(error?.message || "").includes("Unable to send OTP email")
    ) {
      return res.status(503).json({
        error: "Registration Error",
        message:
          "Account created, but OTP email could not be sent. Please use Resend OTP after checking email configuration.",
        code: "OTP_SEND_FAILED",
        email: req.body?.email,
        requires_verification: true,
      });
    }

    if (error?.code === "ER_DUP_ENTRY") {
      const duplicateMessage = String(error?.sqlMessage || "");
      const message = duplicateMessage.includes("student_id")
        ? "Student ID already exists. Please use a different Student ID."
        : "Email already registered. Please login or use Continue with Google.";

      return res.status(400).json({
        error: "Registration Error",
        message,
      });
    }

    next(error);
  }
};

/**
 * Login user and generate JWT
 */
const login = async (req, res, next) => {
  try {
    console.log("🔷 Login attempt started:", req.body);
    await ensureAuthVerificationSchema();

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
          u.profile_image_url,
          u.degree_type,
          u.department,
          u.academic_year,
          COALESCE(
            r.role_name,
            CASE u.role_id
              WHEN 1 THEN 'admin'
              WHEN 2 THEN 'librarian'
              WHEN 4 THEN 'staff'
              WHEN 5 THEN 'me_student'
              WHEN 6 THEN 'research_scholar'
              WHEN 7 THEN 'clerk'
              ELSE 'student'
            END
          ) AS role_name,
          u.student_id,
          u.status,
          COALESCE(u.email_verified, 0) AS email_verified
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
      email,
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

      const isDirectResearchEligible = hasDirectResearchAccess(user);

      const isStudentRole = ['student', 'me_student', 'research_scholar'].includes(
        String(user.role_name || user.role || '').toLowerCase()
      );
      const degreeType = isStudentRole ? (user.degree_type || 'BE') : null;
      const academicYear = isStudentRole ? (user.academic_year || '3rd Year') : null;
      const department = user.department || (isStudentRole ? 'CSE' : (user.role_name === 'admin' ? 'Administration' : 'Library'));

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        first_name: user.first_name,
        last_name: user.last_name,
        student_id: user.student_id,
        degree_type: degreeType,
        department: department,
        academic_year: academicYear,
        is_direct_research_eligible: isDirectResearchEligible,
        profile_image_url: user.profile_image_url || null,
        email_verified: Number(user.email_verified) === 1,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        console.log("🔷 Session created for:", email);
        const token = generateAuthToken(user);
        res.json({
          message: "Login successful",
          token,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role_name,
            student_id: user.student_id,
            degree_type: degreeType,
            department: department,
            academic_year: academicYear,
            is_direct_research_eligible: isDirectResearchEligible,
            profile_image_url: user.profile_image_url || null,
            email_verified: Number(user.email_verified) === 1,
            token,
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
    await ensureAuthVerificationSchema();
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
          u.degree_type,
          u.department,
          u.academic_year,
          COALESCE(
            r.role_name,
            CASE u.role_id
              WHEN 1 THEN 'admin'
              WHEN 2 THEN 'librarian'
              WHEN 4 THEN 'staff'
              WHEN 5 THEN 'me_student'
              WHEN 6 THEN 'research_scholar'
              WHEN 7 THEN 'clerk'
              ELSE 'student'
            END
          ) AS role_name,
          u.student_id,
           u.status,
           COALESCE(u.email_verified, 0) AS email_verified
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
        `INSERT INTO users (email, password, first_name, last_name, role_id, degree_type, department, academic_year, status, email_verified, email_verified_at)
         VALUES (?, ?, ?, ?, 3, 'BE', 'CSE', '3rd Year', 'active', 1, CURRENT_TIMESTAMP)`,
        [email, passwordHash, givenName, familyName],
      );

      const createdUsers = await query(
        `SELECT
            u.id,
            u.email,
            u.first_name,
            u.last_name,
            u.role_id,
            u.degree_type,
            u.department,
            u.academic_year,
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
             u.status,
             COALESCE(u.email_verified, 0) AS email_verified
         FROM users u
         LEFT JOIN user_roles r ON u.role_id = r.id
         WHERE u.id = ?`,
        [insertResult.insertId],
      );

      user = createdUsers[0];
    } else if (!Number(user.email_verified)) {
      await query(
        `UPDATE users SET email_verified = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [user.id],
      );
      user.email_verified = 1;
    }

    if (user.status !== "active") {
      return res.status(403).json({
        error: "Authentication Error",
        message: "Account is inactive or suspended",
      });
    }

    req.session.regenerate((sessionErr) => {
      if (sessionErr) return next(sessionErr);

      const isDirectResearchEligible = hasDirectResearchAccess(user);

      const isStudentRole = ['student', 'me_student', 'research_scholar'].includes(
        String(user.role_name || user.role || '').toLowerCase()
      );
      const degreeType = isStudentRole ? (user.degree_type || 'BE') : null;
      const academicYear = isStudentRole ? (user.academic_year || '3rd Year') : null;
      const department = user.department || (isStudentRole ? 'CSE' : (user.role_name === 'admin' ? 'Administration' : 'Library'));

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        first_name: user.first_name,
        last_name: user.last_name,
        student_id: user.student_id,
        degree_type: degreeType,
        department: department,
        academic_year: academicYear,
        is_direct_research_eligible: isDirectResearchEligible,
        email_verified: true,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        const token = generateAuthToken(user);
        res.json({
          message: "Google login successful",
          token,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role_name,
            student_id: user.student_id,
            degree_type: degreeType,
            department: department,
            academic_year: academicYear,
            is_direct_research_eligible: isDirectResearchEligible,
            email_verified: true,
            token,
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
    if (req.session.user.email_verified === false) {
      return res.json({
        authenticated: false,
        user: null,
        reason: "email_not_verified",
      });
    }
    const isStudentRole = ['student', 'me_student', 'research_scholar'].includes(
      String(req.session.user.role || req.session.user.role_name || '').toLowerCase()
    );
    const sessionUser = {
      ...req.session.user,
      degree_type: isStudentRole ? (req.session.user.degree_type || 'BE') : null,
      department: req.session.user.department || (isStudentRole ? 'CSE' : (req.session.user.role === 'admin' ? 'Administration' : 'Library')),
      academic_year: isStudentRole ? (req.session.user.academic_year || '3rd Year') : null,
      is_direct_research_eligible: hasDirectResearchAccess(req.session.user),
    };
    return res.json({ authenticated: true, user: sessionUser });
  }
  return res.json({ authenticated: false, user: null, reason: "no_active_session" });
};

/**
 * Step 1 of OAuth redirect flow: redirect browser to Google's consent screen.
 * Works from ANY frontend port because the browser follows the redirect to Google,
 * and Google always returns to the registered redirect_uri on port 3000.
 *
 * Query param: return_url  — where to send the user after login (optional).
 *   e.g. http://localhost:5173/dashboard  (saved in OAuth state)
 */
const googleOAuthStart = (req, res, next) => {
  ensureAuthVerificationSchema().catch((e) => console.error("Schema setup error:", e));

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret || clientID === "your_google_client_id") {
    let loginPageUrl = "http://localhost:5173/login";
    try {
      if (req.query.return_url) {
        loginPageUrl = new URL(req.query.return_url).origin + "/login";
      }
    } catch {
      /* fallback */
    }
    return res.redirect(
      `${loginPageUrl}?google_error=${encodeURIComponent("Google OAuth is not configured on server (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env)")}`,
    );
  }

  const returnUrl = req.query.return_url || `${req.protocol}://${req.get("host")}/dashboard`;
  const state = Buffer.from(JSON.stringify({ returnUrl })).toString("base64url");

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state,
    prompt: "select_account",
  })(req, res, next);
};

/**
 * Step 2 of OAuth redirect flow: Google sends browser here with ?code=...&state=...
 * Passport authenticates code, finds/creates user, sets session, and redirects to frontend app.
 */
const googleOAuthCallback = async (req, res, next) => {
  const { state, error: oauthError } = req.query;

  let returnUrl = `http://localhost:5173/dashboard`;
  let loginPageUrl = `http://localhost:5173/login`;

  try {
    if (state) {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
      if (stateData.returnUrl) {
        returnUrl = stateData.returnUrl;
        loginPageUrl = new URL(returnUrl).origin + "/login";
      }
    }
  } catch {
    /* keep default */
  }

  if (oauthError) {
    console.error("🔴 Google OAuth error parameter:", oauthError);
    return res.redirect(
      `${loginPageUrl}?google_error=${encodeURIComponent(oauthError === "access_denied" ? "Google sign-in was cancelled." : oauthError)}`,
    );
  }

  passport.authenticate("google", { session: false }, async (err, user, info) => {
    if (err || !user) {
      const errorMessage = info?.message || err?.message || "Google authentication failed";
      console.error("🔴 Passport Google authentication failed:", errorMessage);
      return res.redirect(`${loginPageUrl}?google_error=${encodeURIComponent(errorMessage)}`);
    }

    try {
      await ensureAuthVerificationSchema();
      req.session.regenerate((sessionErr) => {
        if (sessionErr) return next(sessionErr);

        const isDirectResearchEligible = hasDirectResearchAccess(user);

        req.session.user = {
          id: user.id,
          email: user.email,
          role: user.role_name,
          role_id: user.role_id,
          first_name: user.first_name,
          last_name: user.last_name,
          student_id: user.student_id,
          degree_type: user.degree_type || 'BE',
          department: user.department || 'CSE',
          academic_year: user.academic_year || '3rd Year',
          is_direct_research_eligible: isDirectResearchEligible,
          profile_image_url: user.profile_image_url,
          email_verified: true,
        };

        req.session.save((saveErr) => {
          if (saveErr) return next(saveErr);
          console.log(`✅ Google OAuth login successful for ${user.email} -> Redirecting to ${returnUrl}`);
          res.redirect(returnUrl);
        });
      });
    } catch (sessionError) {
      console.error("🔴 Session creation error:", sessionError);
      return res.redirect(`${loginPageUrl}?google_error=session_error`);
    }
  })(req, res, next);
};

const verifyOtp = async (req, res, next) => {
  try {
    await ensureAuthVerificationSchema();
    const { email, otp } = req.body;

    const users = await query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.student_id,
              u.degree_type, u.department, u.academic_year,
              COALESCE(r.role_name, CASE u.role_id WHEN 1 THEN 'admin' WHEN 2 THEN 'librarian' WHEN 4 THEN 'staff' WHEN 5 THEN 'staff' WHEN 6 THEN 'staff' ELSE 'student' END) AS role_name,
              COALESCE(u.email_verified, 0) AS email_verified
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.id
       WHERE u.email = ?`,
      [email],
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: "Verification Error",
        message: "User not found for this email",
      });
    }

    const user = users[0];
    const isDirectResearchEligible = hasDirectResearchAccess(user);

    if (Number(user.email_verified) === 1) {
      return res.json({
        message: "Email already verified",
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role_name,
          student_id: user.student_id,
          degree_type: user.degree_type || 'BE',
          department: user.department || 'CSE',
          academic_year: user.academic_year || '3rd Year',
          is_direct_research_eligible: isDirectResearchEligible,
          email_verified: true,
        },
      });
    }

    const otpRows = await query(
      `SELECT id, otp_hash, expires_at
       FROM email_verification_otps
       WHERE email = ? AND is_used = 0
       ORDER BY created_at DESC
       LIMIT 1`,
      [email],
    );

    if (otpRows.length === 0) {
      return res.status(400).json({
        error: "Verification Error",
        message: "OTP expired or not found. Please request a new OTP.",
      });
    }

    const latestOtp = otpRows[0];
    const expiresAt = new Date(latestOtp.expires_at);
    if (Date.now() > expiresAt.getTime()) {
      return res.status(400).json({
        error: "Verification Error",
        message: "OTP expired. Please request a new OTP.",
      });
    }

    if (latestOtp.otp_hash !== hashOtp(otp)) {
      return res.status(400).json({
        error: "Verification Error",
        message: "Invalid OTP. Please try again.",
      });
    }

    await query(`UPDATE email_verification_otps SET is_used = 1 WHERE id = ?`, [
      latestOtp.id,
    ]);

    await query(
      `UPDATE users
       SET email_verified = 1, email_verified_at = CURRENT_TIMESTAMP, status = 'active'
       WHERE id = ?`,
      [user.id],
    );

    req.session.regenerate((sessionErr) => {
      if (sessionErr) return next(sessionErr);

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        first_name: user.first_name,
        last_name: user.last_name,
        student_id: user.student_id,
        degree_type: user.degree_type || 'BE',
        department: user.department || 'CSE',
        academic_year: user.academic_year || '3rd Year',
        is_direct_research_eligible: isDirectResearchEligible,
        email_verified: true,
      };

      req.session.save((saveErr) => {
        if (saveErr) return next(saveErr);

        const token = generateAuthToken(user);
        res.json({
          message: "Email verified successfully",
          token,
          user: {
            id: user.id,
            name: `${user.first_name} ${user.last_name}`,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role_name,
            student_id: user.student_id,
            degree_type: user.degree_type || 'BE',
            department: user.department || 'CSE',
            academic_year: user.academic_year || '3rd Year',
            is_direct_research_eligible: isDirectResearchEligible,
            email_verified: true,
            token,
          },
        });
      });
    });
  } catch (error) {
    console.error("🔴 OTP verification error:", error);
    next(error);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    await ensureAuthVerificationSchema();
    const { email } = req.body;

    const users = await query(
      `SELECT id, email, first_name, COALESCE(email_verified, 0) AS email_verified
       FROM users
       WHERE email = ?`,
      [email],
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: "Verification Error",
        message: "User not found for this email",
      });
    }

    const user = users[0];
    if (Number(user.email_verified) === 1) {
      return res.status(400).json({
        error: "Verification Error",
        message: "Email is already verified",
      });
    }

    const recentOtp = await query(
      `SELECT id
       FROM email_verification_otps
       WHERE email = ? AND is_used = 0 AND created_at >= DATE_SUB(NOW(), INTERVAL 60 SECOND)
       LIMIT 1`,
      [email],
    );

    if (recentOtp.length > 0) {
      return res.status(429).json({
        error: "Verification Error",
        message: "Please wait 60 seconds before requesting another OTP.",
      });
    }

    await sendEmailVerificationOtp({
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
    });

    res.json({
      message: "OTP resent successfully",
      email,
    });
  } catch (error) {
    console.error("🔴 Resend OTP error:", error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  googleLogin,
  verifyOtp,
  resendOtp,
  googleOAuthStart,
  googleOAuthCallback,
  logout,
  me,
};

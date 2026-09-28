/**
 * Passport Google OAuth 2.0 Strategy Configuration
 * 
 * Integrates Google OAuth 2.0 into the Smart Library system.
 * Handles Google user identification, account linking by email,
 * and user creation.
 */

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { query } = require("./database");

const getGoogleCallbackUrl = () => {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const port = process.env.PORT || 3001;
  return `http://localhost:${port}/auth/google/callback`;
};

/**
 * Configure Passport Google OAuth Strategy
 */
const configurePassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID || "UNCONFIGURED_GOOGLE_CLIENT_ID";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "UNCONFIGURED_GOOGLE_CLIENT_SECRET";
  const callbackURL = getGoogleCallbackUrl();

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          const fullName = profile.displayName || "";
          const nameParts = fullName.trim().split(/\s+/);
          const givenName = profile.name?.givenName || nameParts[0] || "Google";
          const familyName = profile.name?.familyName || nameParts.slice(1).join(" ") || "User";
          const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

          if (!email) {
            return done(null, false, { message: "NO_EMAIL_PROVIDED" });
          }

          // 1. Search existing user by google_id
          let users = await query(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.student_id, u.status,
                    u.google_id, u.profile_image_url, COALESCE(u.email_verified, 0) AS email_verified,
                    COALESCE(r.role_name, CASE u.role_id WHEN 1 THEN 'admin' WHEN 2 THEN 'librarian' ELSE 'student' END) AS role_name
             FROM users u LEFT JOIN user_roles r ON u.role_id = r.id
             WHERE u.google_id = ?`,
            [googleId],
          );

          let user = users[0];

          if (!user) {
            // 2. Search existing user by email
            users = await query(
              `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.student_id, u.status,
                      u.google_id, u.profile_image_url, COALESCE(u.email_verified, 0) AS email_verified,
                      COALESCE(r.role_name, CASE u.role_id WHEN 1 THEN 'admin' WHEN 2 THEN 'librarian' ELSE 'student' END) AS role_name
               FROM users u LEFT JOIN user_roles r ON u.role_id = r.id
               WHERE u.email = ?`,
              [email],
            );

            user = users[0];

            if (user) {
              // Found user by email -> Link Google account to existing user
              await query(
                `UPDATE users
                 SET google_id = ?,
                     auth_provider = IF(auth_provider IS NULL OR auth_provider = 'local', 'google', auth_provider),
                     email_verified = 1,
                     email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP),
                     profile_image_url = COALESCE(profile_image_url, ?)
                 WHERE id = ?`,
                [googleId, photo, user.id],
              );
              user.google_id = googleId;
              user.email_verified = 1;
              if (!user.profile_image_url && photo) {
                user.profile_image_url = photo;
              }
            } else {
              // User not found -> Create new user with Google profile
              const randomPassword = crypto.randomBytes(32).toString("hex");
              const passwordHash = await bcrypt.hash(randomPassword, 10);

              const insertResult = await query(
                `INSERT INTO users (email, password, first_name, last_name, role_id, status, email_verified, email_verified_at, google_id, auth_provider, profile_image_url)
                 VALUES (?, ?, ?, ?, 3, 'active', 1, CURRENT_TIMESTAMP, ?, 'google', ?)`,
                [email, passwordHash, givenName, familyName, googleId, photo],
              );

              const created = await query(
                `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.student_id, u.status,
                        u.google_id, u.profile_image_url, COALESCE(u.email_verified, 0) AS email_verified,
                        COALESCE(r.role_name, 'student') AS role_name
                 FROM users u LEFT JOIN user_roles r ON u.role_id = r.id WHERE u.id = ?`,
                [insertResult.insertId],
              );
              user = created[0];
            }
          } else if (!user.profile_image_url && photo) {
            await query(`UPDATE users SET profile_image_url = ? WHERE id = ?`, [photo, user.id]);
            user.profile_image_url = photo;
          }

          if (user.status !== "active") {
            return done(null, false, { message: "ACCOUNT_INACTIVE" });
          }

          return done(null, user);
        } catch (err) {
          console.error("🔴 Passport Google Strategy Error:", err);
          return done(err, null);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const users = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.role_id, u.student_id, u.status,
                u.google_id, u.profile_image_url, COALESCE(u.email_verified, 0) AS email_verified,
                COALESCE(r.role_name, 'student') AS role_name
         FROM users u LEFT JOIN user_roles r ON u.role_id = r.id WHERE u.id = ?`,
        [id],
      );
      done(null, users[0] || false);
    } catch (err) {
      done(err, null);
    }
  });
};

module.exports = {
  configurePassport,
  getGoogleCallbackUrl,
};

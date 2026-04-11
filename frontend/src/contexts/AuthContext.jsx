import React, { useState, useEffect, useMemo, useRef } from "react";
import PropTypes from "prop-types";
import { authService } from "../services";
import { AuthContext } from "./authContextStore";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    // On mount, ping the server to see if the session cookie is still valid.
    // If the server confirms it, use the session user (source of truth).
    // If not, clear any stale localStorage data and stay logged out.
    const verifySession = async () => {
      try {
        const { authenticated, user: sessionUser } = await authService.me();

        if (!authenticated || !sessionUser) {
          localStorage.removeItem("user");
          setUser(null);
          return;
        }

        // Build a display-friendly user object (same shape as login response)
        const storedUser = localStorage.getItem("user");
        const localUser = storedUser ? JSON.parse(storedUser) : {};
        // Merge: session data is authoritative for roles; local data fills display fields
        const merged = { ...localUser, ...sessionUser };
        setUser(merged);
        localStorage.setItem("user", JSON.stringify(merged));
      } catch {
        // 401 or network error — session is gone
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      const { user: userData } = response;

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Login failed",
        code: error.response?.data?.code,
        email: error.response?.data?.email,
      };
    }
  };

  const googleLogin = async (token) => {
    try {
      const response = await authService.googleLogin(token);
      const { user: userData } = response;

      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Google login failed",
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      if (response.user) {
        const { user: newUser } = response;
        setUser(newUser);
        localStorage.setItem("user", JSON.stringify(newUser));
      }

      return {
        success: true,
        requiresVerification: !!response.requires_verification,
        email: response.email,
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Registration failed",
        code: error.response?.data?.code,
        email: error.response?.data?.email,
      };
    }
  };

  const verifyEmailOtp = async (email, otp) => {
    try {
      const response = await authService.verifyOtp(email, otp);
      const { user: verifiedUser } = response;

      if (verifiedUser) {
        setUser(verifiedUser);
        localStorage.setItem("user", JSON.stringify(verifiedUser));
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "OTP verification failed",
      };
    }
  };

  const resendEmailOtp = async (email) => {
    try {
      await authService.resendOtp(email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || "Unable to resend OTP",
      };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.warn(
        "Logout request failed, clearing local session anyway:",
        error?.message || error,
      );
    }
    setUser(null);
    localStorage.removeItem("user");
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  };

  const value = useMemo(
    () => ({
      user,
      login,
      googleLogin,
      register,
      verifyEmailOtp,
      resendEmailOtp,
      logout,
      updateUser,
      isAuthenticated: !!user,
      isLibrarian: user?.role === "librarian" || user?.role === "admin",
      isAdmin: user?.role === "admin",
    }),
    [user],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts";
import { AlertCircle, ArrowRight, Library, Mail, Lock } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL || "/api/v1";

  const handleGoogleLogin = async () => {
    setError("");
    const base = apiBase.startsWith("http")
      ? apiBase
      : `${globalThis.location.origin}${apiBase}`;
    const oauthUrl = `${base.replace(/\/$/, "")}/auth/google?return_url=${encodeURIComponent(`${globalThis.location.origin}/dashboard`)}`;
    globalThis.location.href = oauthUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-luminosity"
        style={{ backgroundImage: 'url("/assets/library-bg.jpg")' }}
      ></div>
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-indigo-950/80 via-gray-900/90 to-black/95"></div>
      
      {/* Decorative Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 w-full max-w-6xl mx-auto p-4 lg:p-8 flex items-center justify-center">
        <div className="flex flex-col lg:flex-row w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.6)] border border-white/5 backdrop-blur-md bg-black/40">
          
          {/* Left Panel - Branding */}
          <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden bg-gradient-to-br from-indigo-600/90 to-purple-800/90 border-r border-white/5">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="relative z-10 mt-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-xl rounded-2xl mb-8 shadow-xl border border-white/20 text-white">
                <Library size={32} />
              </div>
              <h1 className="text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
                Welcome to <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-100">Smart Library</span>
              </h1>
              <p className="text-indigo-100/90 text-lg max-w-sm leading-relaxed font-medium">
                The next-generation automated library management system. Access thousands of books, journals, and resources instantly.
              </p>
            </div>

            <div className="relative z-10 mb-4">
              <div className="flex items-center gap-4 text-white/50 text-sm font-medium">
                <span>© 2026 Smart Library</span>
                <span className="w-1 h-1 bg-white/30 rounded-full"></span>
                <span>Powered by Advanced Tech</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Login Form */}
          <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 bg-white/5 backdrop-blur-2xl">
            <div className="max-w-sm mx-auto">
              <div className="lg:hidden text-center mb-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 text-white shadow-lg border border-white/10">
                  <Library size={28} />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Smart Library</h2>
              </div>

              <div className="mb-10 text-center lg:text-left">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h2>
                <p className="text-gray-400 font-medium text-sm">Please enter your credentials to login.</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Email Address</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                      <Mail size={18} />
                    </div>
                    <input
                      id="email"
                      type="email"
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                      placeholder="student@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      id="password"
                      type="password"
                      className="block w-full pl-11 pr-4 py-3.5 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end mb-2 pt-1">
                  <a href="#" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-3.5 px-4 rounded-2xl font-bold text-[15px] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98] mt-2"
                  disabled={loading}
                >
                  {loading ? "Authenticating..." : "Sign In"}
                  {!loading && <ArrowRight size={18} />}
                </button>

                <div className="relative flex items-center py-4 mt-2">
                  <div className="flex-grow border-t border-gray-700/50"></div>
                  <span className="flex-shrink-0 mx-4 text-gray-500 text-sm font-medium">or continue with</span>
                  <div className="flex-grow border-t border-gray-700/50"></div>
                </div>

                <button
                  type="button"
                  className="w-full flex items-center justify-center gap-3 bg-white/5 hover:bg-white/10 border border-gray-700/50 text-white py-3.5 px-4 rounded-2xl font-semibold transition-all active:scale-[0.98]"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm font-medium">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                    Create an account
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;


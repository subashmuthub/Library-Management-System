import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import { AlertCircle, ArrowRight, Library, Mail, Lock, User, CreditCard, CheckCircle } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    student_id: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register, verifyEmailOtp, resendEmailOtp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      student_id: formData.student_id,
      role: 'student',
    });

    if (result.success) {
      if (result.requiresVerification) {
        setPendingEmail(result.email || formData.email);
        setOtpStep(true);
        setMessage('OTP sent to your email. Verify to continue to dashboard.');
      } else {
        navigate('/dashboard');
      }
    } else {
      if (
        (result.code === 'EMAIL_NOT_VERIFIED' || result.code === 'OTP_SEND_FAILED') &&
        (result.email || formData.email)
      ) {
        setPendingEmail(result.email || formData.email);
        setOtpStep(true);
        setMessage(
          result.code === 'OTP_SEND_FAILED'
            ? 'Account created. OTP email could not be sent now. Use Resend OTP after email setup is fixed.'
            : 'This email is pending verification. Enter OTP or resend OTP to continue.'
        );
      }
      setError(result.error);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    const result = await verifyEmailOtp(pendingEmail, otp);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleResendOtp = async () => {
    setError('');
    setMessage('');
    setLoading(true);
    const result = await resendEmailOtp(pendingEmail);
    if (result.success) {
      setMessage('A new OTP has been sent to your email.');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden py-8">
      {/* Background Image with Overlay */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-30 mix-blend-luminosity"
        style={{ backgroundImage: 'url("/assets/library-bg.jpg")' }}
      ></div>
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-indigo-950/80 via-gray-900/90 to-black/95"></div>
      
      {/* Decorative Orbs */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse"></div>
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-purple-600 rounded-full mix-blend-screen filter blur-[128px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>

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
                Join <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-100">Smart Library</span>
              </h1>
              <p className="text-indigo-100/90 text-lg max-w-sm leading-relaxed font-medium mb-8">
                Create your account to start borrowing books, accessing digital journals, and managing your reading list seamlessly.
              </p>

              <div className="space-y-4">
                {[
                  "Access thousands of physical books",
                  "Read digital journals & articles",
                  "Get real-time availability alerts",
                  "Manage reservations easily"
                ].map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-indigo-100/90 font-medium">
                    <CheckCircle size={20} className="text-blue-300" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative z-10 mb-4 mt-12">
              <div className="flex items-center gap-4 text-white/50 text-sm font-medium">
                <span>© 2026 Smart Library</span>
                <span className="w-1 h-1 bg-white/30 rounded-full"></span>
                <span>Powered by Advanced Tech</span>
              </div>
            </div>
          </div>

          {/* Right Panel - Register Form */}
          <div className="w-full lg:w-1/2 p-8 sm:p-12 lg:p-16 bg-white/5 backdrop-blur-2xl">
            <div className="max-w-md mx-auto">
              <div className="lg:hidden text-center mb-10">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 text-white shadow-lg border border-white/10">
                  <Library size={28} />
                </div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Smart Library</h2>
              </div>

              <div className="mb-8 text-center lg:text-left">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                  {otpStep ? 'Verify Your Email' : 'Create Account'}
                </h2>
                <p className="text-gray-400 font-medium text-sm">
                  {otpStep 
                    ? 'We\'ve sent a code to your email. Please enter it below.'
                    : 'Fill in your details to get started.'}
                </p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200 font-medium">{error}</p>
                </div>
              )}

              {message && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <CheckCircle size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-200 font-medium">{message}</p>
                </div>
              )}

              {!otpStep ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Full Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                        <User size={18} />
                      </div>
                      <input
                        type="text"
                        name="name"
                        className="block w-full pl-11 pr-4 py-3 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Student / Teacher ID</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                        <CreditCard size={18} />
                      </div>
                      <input
                        type="text"
                        name="student_id"
                        className="block w-full pl-11 pr-4 py-3 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                        placeholder="STU001 or EMP123"
                        value={formData.student_id}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        name="email"
                        className="block w-full pl-11 pr-4 py-3 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                        placeholder="student@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                          <Lock size={18} />
                        </div>
                        <input
                          type="password"
                          name="password"
                          className="block w-full pl-11 pr-4 py-3 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                          placeholder="Password"
                          value={formData.password}
                          onChange={handleChange}
                          required
                          minLength="6"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1">Confirm Password</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
                          <Lock size={18} />
                        </div>
                        <input
                          type="password"
                          name="confirmPassword"
                          className="block w-full pl-11 pr-4 py-3 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-medium"
                          placeholder="Confirm"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-3.5 px-4 rounded-2xl font-bold text-[15px] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98] mt-6"
                    disabled={loading}
                  >
                    {loading ? "Creating Account..." : "Create Account"}
                    {!loading && <ArrowRight size={18} />}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5 mt-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2 ml-1 text-center">6-Digit Verification Code</label>
                    <input
                      type="text"
                      className="block w-full text-center tracking-[0.5em] text-2xl py-4 bg-gray-900/40 border border-gray-700/50 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all outline-none font-bold"
                      placeholder="------"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white py-3.5 px-4 rounded-2xl font-bold text-[15px] transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-[0.98] mt-2"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify OTP"}
                  </button>

                  <div className="text-center mt-4">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={loading}
                      className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm transition-colors disabled:opacity-50"
                    >
                      Didn't receive code? Resend OTP
                    </button>
                  </div>
                  
                  <div className="text-center mt-2">
                    <button
                      type="button"
                      onClick={() => setOtpStep(false)}
                      className="text-gray-400 hover:text-gray-300 font-medium text-sm transition-colors"
                    >
                      Use a different email
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm font-medium">
                  Already have an account?{" "}
                  <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                    Sign in here
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

export default Register;

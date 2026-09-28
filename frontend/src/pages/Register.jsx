import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';

const backgroundImages = ['/Images/Home.jpg', '/Images/nec-achievements.png', '/Images/NEC-Front-Mobile-Slider-scaled.webp'];

const Register = () => {
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', student_id: '', role: 'student' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [otp, setOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const { register, verifyEmailOtp, resendEmailOtp } = useAuth();
  const navigate = useNavigate();
  const isStaff = formData.role === 'staff';

  useEffect(() => { document.title = 'Register | NEC LibMS'; }, []);
  useEffect(() => {
    const timer = setInterval(() => setBackgroundIndex((index) => (index + 1) % backgroundImages.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', submit: '', terms: '' }));
  };

  const validateForm = () => {
    const next = {};
    if (formData.name.trim().length < 2) next.name = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) next.email = 'Enter a valid email address';
    if (formData.password.length < 6) next.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) next.confirmPassword = 'Passwords do not match';
    if (!isStaff && !formData.student_id.trim()) next.student_id = 'Student ID is required';
    if (!agreeToTerms) next.terms = 'You must agree to the terms and conditions';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    setErrors({});
    setMessage('');
    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        student_id: formData.student_id,
        role: formData.role || 'student',
      });
      if (result.success) {
        if (result.requiresVerification) {
          setPendingEmail(result.email || formData.email);
          setStep('otp');
          setMessage('OTP sent to your email. Verify to continue to dashboard.');
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        if ((result.code === 'EMAIL_NOT_VERIFIED' || result.code === 'OTP_SEND_FAILED') && (result.email || formData.email)) {
          setPendingEmail(result.email || formData.email);
          setStep('otp');
          setMessage(result.code === 'OTP_SEND_FAILED'
            ? 'Account created. OTP email could not be sent now. Use Resend OTP after email setup is fixed.'
            : 'This email is pending verification. Enter OTP or resend OTP to continue.');
        }
        setErrors({ submit: result.error || 'Registration failed' });
      }
    } catch {
      setErrors({ submit: 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setErrors({ otp: 'Enter a valid 6-digit OTP' });
    setLoading(true);
    setErrors({});
    setMessage('');
    try {
      const result = await verifyEmailOtp(pendingEmail, otp);
      if (result.success) navigate('/dashboard', { replace: true });
      else setErrors({ otp: result.error || 'OTP verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    setErrors({});
    setMessage('');
    try {
      const result = await resendEmailOtp(pendingEmail);
      if (result.success) setMessage('A new OTP has been sent to your email.');
      else setErrors({ otp: result.error });
    } finally {
      setLoading(false);
    }
  };

  const field = (name, label, type = 'text', placeholder = '', required = true) => (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label>
      <input type={type} name={name} value={formData[name]} onChange={handleChange} placeholder={placeholder} required={required} disabled={loading}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        className={`w-full rounded-xl border bg-gray-50/50 px-4 py-3 text-base shadow-sm outline-none transition focus:bg-white focus:ring-2 ${errors[name] ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'}`} />
      {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
    </div>
  );

  const roleBtn = (role, label) => (
    <button type="button" onClick={() => setFormData((c) => ({ ...c, role }))} disabled={loading}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${formData.role === role ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}`}>{label}</button>
  );

  const errorList = Object.values(errors).filter(Boolean);

  return (
    <div className="relative flex min-h-screen flex-col bg-cover bg-center bg-no-repeat transition-[background-image] duration-1000" style={{ backgroundImage: `url(${backgroundImages[backgroundIndex]})` }}>
      <div className="absolute inset-0 bg-slate-950/75" />
      <nav className="relative z-10 border-b border-white/10 bg-blue-950/90 shadow-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/Images/Logo.png" alt="NEC" className="h-14 w-14 rounded-full bg-white p-1 object-contain" />
            <div>
              <strong className="block text-xl text-white">NEC LibMS</strong>
              <span className="text-xs text-blue-200">Library Management System</span>
            </div>
          </Link>
          <div className="hidden text-right md:block">
            <strong className="block text-sm text-amber-300">NATIONAL ENGINEERING COLLEGE</strong>
            <span className="text-xs text-blue-200">An Autonomous Institution · Kovilpatti</span>
          </div>
          <Link to="/" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Home</Link>
        </div>
      </nav>

      <main className="relative z-10 flex flex-grow items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-lg"><span className="text-4xl">+</span></div>
            <h1 className="mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-3xl font-bold text-transparent">{step === 'otp' ? 'Verify Email' : 'Create Account'}</h1>
            <p className="text-gray-600">{step === 'otp' ? `We sent an OTP to ${pendingEmail}` : 'Join NEC Library Management System'}</p>
          </div>

          {message && <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}
          {errorList.length > 0 && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorList.map((e) => <div key={e}>{e}</div>)}</div>}

          {step === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Account Type</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                  {roleBtn('student', 'Student')}
                  {roleBtn('staff', 'Staff / Faculty')}
                </div>
                {isStaff && (
                  <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
                    <strong>Staff Onboarding:</strong> Please use your college staff email domain (e.g. <code>@nec.edu.in</code>). Staff accounts receive 60-day loan periods, 10 books limit, and fine exemption.
                  </p>
                )}
              </div>
              {field('name', 'Full Name', 'text', 'Enter your full name')}
              {field('student_id', isStaff ? 'Employee / Staff ID' : 'Student ID', 'text', isStaff ? 'e.g. EMP102 or FAC05' : 'e.g. STU001 or 21CS045', !isStaff)}
              {field('email', isStaff ? 'Staff Email Address' : 'Email Address', 'email', isStaff ? 'staff@nec.edu.in' : 'your.email@gmail.com')}
              {field('password', 'Password', 'password', 'Create a strong password')}
              <p className="-mt-2 text-xs text-gray-500">Minimum 6 characters</p>
              {field('confirmPassword', 'Confirm Password', 'password', 'Confirm your password')}
              <label className="flex items-start gap-3 py-2 text-sm text-gray-600">
                <input type="checkbox" checked={agreeToTerms} onChange={(e) => setAgreeToTerms(e.target.checked)} disabled={loading} className="mt-1 h-4 w-4" />
                <span>I agree to the <a href="#terms" className="font-medium text-purple-600">Terms of Service</a> and <a href="#privacy" className="font-medium text-purple-600">Privacy Policy</a></span>
              </label>
              <button type="submit" disabled={loading || !agreeToTerms} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" autoFocus className="w-full rounded-xl border border-gray-200 bg-gray-50 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
              <button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-semibold text-white disabled:opacity-60">{loading ? 'Verifying...' : 'Verify OTP'}</button>
              <button type="button" onClick={resend} disabled={loading} className="w-full text-sm font-semibold text-blue-600 disabled:opacity-50">Didn&apos;t receive code? Resend OTP</button>
              <button type="button" onClick={() => { setStep('form'); setMessage(''); setErrors({}); }} className="w-full text-sm text-gray-500">Use a different email</button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-gray-600">Already have an account? <Link to="/login" className="font-semibold text-blue-600">Sign in here</Link></p>
        </div>
      </main>
    </div>
  );
};

export default Register;

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';

const backgroundImages = ['/Images/Home.jpg', '/Images/nec-achievements.png', '/Images/NEC-Front-Mobile-Slider-scaled.webp'];

const Register = () => {
  const [step, setStep] = useState('form');
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', student_id: '', role: 'student' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [otp, setOtp] = useState('');
  const { register, verifyEmailOtp, resendEmailOtp } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Register | NEC LibMS'; const timer = setTimeout(() => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) node.nodeValue = node.nodeValue.replaceAll('LabMS', 'LibMS').replaceAll('Laboratory Management System', 'Library Management System').replaceAll('Lab Management System', 'Library Management System').replaceAll('Faculty', 'Admin').replaceAll('Lab Technician', 'Library Technician'); const roleSelect = document.querySelector('select[name="role"]'); if (roleSelect) { roleSelect.querySelector('option[value="faculty"]')?.setAttribute('value', 'admin'); roleSelect.querySelector('option[value="lab_technician"]')?.setAttribute('value', 'library_technician'); } }, 0); return () => clearTimeout(timer); }, []);
  useEffect(() => { const nav = document.querySelector('nav'); if (!nav) return; nav.className = 'relative z-10 border-b border-white/10 bg-blue-950/90 shadow-xl'; nav.innerHTML = '<div class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8"><a href="/" class="flex items-center gap-3"><img src="/Images/Logo.png" alt="NEC" class="h-14 w-14 rounded-full bg-white p-1 object-contain"><div><strong class="block text-xl text-white">NEC LibMS</strong><span class="text-xs text-blue-200">Library Management System</span></div></a><div class="hidden text-right md:block"><strong class="block text-sm text-amber-300">NATIONAL ENGINEERING COLLEGE</strong><span class="text-xs text-blue-200">An Autonomous Institution · Kovilpatti</span></div><a href="/" class="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Home</a></div>'; }, [step, loading]);
  useEffect(() => {
    const timer = setInterval(() => setBackgroundIndex((index) => (index + 1) % backgroundImages.length), 5000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const page = document.querySelector('[style*="/assets/library-bg.jpg"]');
    if (page) page.style.backgroundImage = `url(${backgroundImages[backgroundIndex]})`;
  }, [backgroundIndex]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '', submit: '', terms: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (formData.name.trim().length < 2) nextErrors.name = 'Full name must be at least 2 characters';
    if (!/^[^\s@]+@(?:gmail\.com|nec\.edu\.in)$/i.test(formData.email)) nextErrors.email = 'Use a valid Gmail or NEC email address';
    if (formData.password.length < 8 || !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) nextErrors.password = 'Use 8+ characters with uppercase, lowercase, and number';
    if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    if (!agreeToTerms) nextErrors.terms = 'You must agree to the terms and conditions';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;
    if (formData.role !== 'student') {
      setErrors({ submit: 'Only Student accounts can self-register. Admin and Library Technician accounts must be created by an administrator.' });
      return;
    }
    setLoading(true); setErrors({});
    try {
      const result = await register({ ...formData, student_id: formData.student_id || formData.email, role: 'student' });
      if (result.success && result.requiresVerification) setStep('otp');
      else if (result.success) navigate('/dashboard', { replace: true });
      else if (result.code === 'EMAIL_NOT_VERIFIED' || result.code === 'OTP_SEND_FAILED') { setErrors({ submit: result.error }); setStep('otp'); }
      else setErrors({ submit: result.error || 'Registration failed' });
    } catch { setErrors({ submit: 'Registration failed. Please try again.' }); }
    finally { setLoading(false); }
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setErrors({ otp: 'Enter a valid 6-digit OTP' });
    setLoading(true); setErrors({});
    try {
      const result = await verifyEmailOtp(formData.email, otp);
      if (result.success) navigate('/dashboard', { replace: true });
      else setErrors({ otp: result.error || 'OTP verification failed' });
    } finally { setLoading(false); }
  };

  const resend = async () => {
    setLoading(true); setErrors({});
    try { const result = await resendEmailOtp(formData.email); if (!result.success) setErrors({ otp: result.error }); }
    finally { setLoading(false); }
  };

  const field = (name, label, type = 'text', placeholder = '') => <div><label className="mb-2 block text-sm font-semibold text-gray-700">{label}</label><input type={type} name={name} value={formData[name]} onChange={handleChange} placeholder={placeholder} required disabled={loading} className={`w-full rounded-xl border bg-gray-50/50 px-4 py-3 text-base shadow-sm outline-none transition focus:bg-white focus:ring-2 ${errors[name] ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : 'border-gray-200 focus:border-purple-500 focus:ring-purple-200'}`} />{errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}</div>;
  return <div className="relative flex min-h-screen flex-col bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/assets/library-bg.jpg)' }}><div className="absolute inset-0 bg-black/40" /><nav className="relative z-10 bg-gradient-to-r from-blue-800 via-blue-900 to-purple-900 shadow-2xl"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><Link to="/" className="flex items-center gap-4"><img src="/pic/NEC%20LOGO.png" alt="NEC Logo" className="h-16 w-16 rounded-full bg-white p-2 object-contain shadow-lg" /><div className="text-white"><h1 className="text-xl font-bold tracking-wide md:text-2xl">NEC LabMS</h1><p className="text-sm font-medium text-blue-200">Laboratory Management System</p></div></Link><div className="hidden text-center text-white md:block"><h2 className="text-lg font-bold text-yellow-300 lg:text-xl">NATIONAL ENGINEERING COLLEGE</h2><p className="text-xs text-blue-200">An Autonomous Institution · Affiliated to Anna University, Chennai</p><p className="mt-1 text-xs text-blue-300">K.R.Nagar, Kovilpatti - 628503 · DST-FIST Sponsored Institution</p></div><Link to="/" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Home</Link></div></nav><main className="relative z-10 flex flex-grow items-center justify-center p-6"><div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/95 p-8 shadow-2xl backdrop-blur-sm"><div className="mb-8 text-center"><div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-lg"><span className="text-4xl">+</span></div><h1 className="mb-2 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-3xl font-bold text-transparent">{step === 'otp' ? 'Verify Email' : 'Create Account'}</h1><p className="text-gray-600">{step === 'otp' ? `We sent an OTP to ${formData.email}` : 'Join NEC Lab Management System'}</p></div>{Object.keys(errors).length > 0 && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{Object.values(errors).filter(Boolean).map((error) => <div key={error}>{error}</div>)}</div>}{step === 'form' ? <form onSubmit={handleSubmit} className="space-y-4">{field('name', 'Full Name', 'text', 'Enter your full name')}{field('email', 'Gmail Address', 'email', 'your.email@gmail.com')}{field('password', 'Password', 'password', 'Create a strong password')}<p className="-mt-2 text-xs text-gray-500">Min 8 chars with uppercase, lowercase & number</p>{field('confirmPassword', 'Confirm Password', 'password', 'Confirm your password')}<label className="block text-sm font-semibold text-gray-700">Account Type<select name="role" value={formData.role} onChange={handleChange} disabled={loading} className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 outline-none focus:border-purple-500"><option value="student">Student</option><option value="faculty">Faculty</option><option value="lab_technician">Lab Technician</option></select></label><label className="flex items-start gap-3 py-2 text-sm text-gray-600"><input type="checkbox" checked={agreeToTerms} onChange={(event) => setAgreeToTerms(event.target.checked)} disabled={loading} className="mt-1 h-4 w-4" /><span>I agree to the <a href="#terms" className="font-medium text-purple-600">Terms of Service</a> and <a href="#privacy" className="font-medium text-purple-600">Privacy Policy</a></span></label><button type="submit" disabled={loading || !agreeToTerms} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-semibold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating account...' : 'Send OTP to Gmail'}</button></form> : <form onSubmit={handleVerify} className="space-y-5"><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" autoFocus className="w-full rounded-xl border border-gray-200 bg-gray-50 py-4 text-center text-3xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /><button type="submit" disabled={loading || otp.length !== 6} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 py-3 font-semibold text-white disabled:opacity-60">{loading ? 'Verifying...' : 'Verify OTP'}</button><button type="button" onClick={resend} disabled={loading} className="w-full text-sm font-semibold text-blue-600">Didn&apos;t receive code? Resend OTP</button><button type="button" onClick={() => setStep('form')} className="w-full text-sm text-gray-500">Use a different email</button></form>}<p className="mt-8 text-center text-sm text-gray-600">Already have an account? <Link to="/login" className="font-semibold text-blue-600">Sign in here</Link></p></div></main></div>;
};

export default Register;
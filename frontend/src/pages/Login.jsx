import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts';

const backgroundImages = ['/Images/Home.jpg', '/Images/nec-achievements.png', '/Images/NEC-Front-Mobile-Slider-scaled.webp'];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { document.title = 'Login | NEC LibMS'; const timer = setTimeout(() => { const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node; while ((node = walker.nextNode())) node.nodeValue = node.nodeValue.replaceAll('LabMS', 'LibMS').replaceAll('Laboratory Management System', 'Library Management System').replaceAll('Lab Management System', 'Library Management System'); }, 0); return () => clearTimeout(timer); }, [location]);
  useEffect(() => {
    const timer = setInterval(() => setBackgroundIndex((index) => (index + 1) % backgroundImages.length), 5000);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleLogin = () => {
    const apiBase = import.meta.env.VITE_API_URL || '/api/v1';
    const base = apiBase.startsWith('http') ? apiBase : `${globalThis.location.origin}${apiBase}`;
    globalThis.location.href = `${base.replace(/\/$/, '')}/auth/google?return_url=${encodeURIComponent(`${globalThis.location.origin}/dashboard`)}`;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) navigate('/dashboard', { replace: true });
      else setError(result.error || 'Invalid email or password');
    } catch { setError('Login failed. Please check your credentials.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat transition-[background-image] duration-1000" style={{ backgroundImage: `url(${backgroundImages[backgroundIndex]})` }}>
      <div className="min-h-screen bg-slate-950/75">
        <header className="border-b border-white/10 bg-blue-950/90 shadow-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
            <Link to="/" className="flex items-center gap-3"><img src="/Images/Logo.png" alt="NEC" className="h-14 w-14 rounded-full bg-white p-1 object-contain" /><div><strong className="block text-xl text-white">NEC LabMS</strong><span className="text-xs text-blue-200">Laboratory Management System</span></div></Link>
            <div className="hidden text-right md:block"><strong className="block text-sm text-amber-300">NATIONAL ENGINEERING COLLEGE</strong><span className="text-xs text-blue-200">An Autonomous Institution · Kovilpatti</span></div>
            <Link to="/" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20">Home</Link>
          </div>
        </header>
        <main className="mx-auto flex max-w-7xl items-center justify-center px-5 py-12 lg:py-20">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-white/95 shadow-2xl backdrop-blur-md">
            <section className="hidden"><ShieldCheck className="text-amber-300" size={42} /><p className="mt-16 text-sm font-bold uppercase tracking-[0.2em] text-blue-200">Welcome back</p><h1 className="mt-4 text-5xl font-extrabold leading-tight text-white">Your library, <span className="text-amber-300">within reach.</span></h1><p className="mt-6 max-w-sm leading-7 text-blue-100">Sign in to discover books, manage reservations, and keep your NEC learning journey moving.</p></section>
            <section className="bg-white p-7 sm:p-10"><div className="mx-auto max-w-md"><div className="mb-8 text-center"><div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg"><ShieldCheck size={40} /></div><h2 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-3xl font-bold text-transparent">Welcome Back</h2><p className="mt-2 text-slate-500">Sign in to access NEC Lab Management System</p></div>{error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-5"><label className="block text-sm font-semibold text-slate-700">Email Address<div className="relative mt-2"><Mail className="absolute left-3 top-3.5 text-slate-400" size={19} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your.email@gmail.com" autoComplete="email" required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div></label><label className="block text-sm font-semibold text-slate-700">Password<div className="relative mt-2"><Lock className="absolute left-3 top-3.5 text-slate-400" size={19} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100" /></div></label><div className="flex justify-end"><button type="button" onClick={() => setError('Use your registered email and contact the library administrator to reset your password.')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">Forgot password?</button></div><button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 py-3.5 font-bold text-white shadow-lg transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in...' : 'Sign In'}{!loading && <ArrowRight size={18} />}</button><div className="flex items-center gap-3 py-2 text-xs uppercase tracking-widest text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div><button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full rounded-xl border border-slate-200 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">Continue with Google</button></form>
              <p className="mt-8 text-center text-sm text-slate-500">Don&apos;t have an account? <Link to="/register" className="font-bold text-blue-700 hover:text-blue-900">Create account</Link></p><Link to="/" className="mt-4 block text-center text-sm font-medium text-slate-400 hover:text-blue-700">Back to Home</Link>
            </div></section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Login;

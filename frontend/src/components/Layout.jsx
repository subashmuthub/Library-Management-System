import React, { useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import { 
  LayoutDashboard, 
  BookOpen, 
  LogIn, 
  Scan, 
  MapPin as NavigationIcon, 
  User, 
  LogOut,
  Menu,
  X,
  Settings,
  RefreshCw,
  DollarSign,
  Bookmark,
  Users,
  Search,
  CalendarDays,
  ArrowUpRight,
  BarChart3,
  PackagePlus,
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.role_name;
  const isAdmin = (roleName || '').toLowerCase() === 'admin';

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/books', label: 'Books', icon: BookOpen },
    { path: '/book-search', label: 'Book Search', icon: Search },
    { path: '/transactions', label: 'Transactions', icon: RefreshCw },
    { path: '/fines', label: 'Fines', icon: DollarSign },
    { path: '/reservations', label: 'Reservations', icon: Bookmark },
    ...(isAdmin ? [{ path: '/users', label: 'Users', icon: Users }] : []),
    { path: '/entry', label: 'Entry Log', icon: LogIn },
    { path: '/rfid', label: 'RFID Scanner', icon: Scan },
    { path: '/navigation', label: 'Navigation', icon: NavigationIcon },
    { path: '/student-visualization', label: 'Student Visualization', icon: BarChart3 },
    { path: '/book-orders', label: 'Book Orders', icon: PackagePlus },
  ];

  const currentSection = useMemo(() => {
    return navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard';
  }, [location.pathname, navItems]);

  const selectedPath = useMemo(() => {
    return navItems.some((item) => item.path === location.pathname)
      ? location.pathname
      : '/dashboard';
  }, [location.pathname, navItems]);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-primary-600 tracking-tight">Smart Library</h1>
              <span className="text-xs text-slate-500 font-medium">Modern Library Operations Suite</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon size={20} />
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User Profile */}
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
                <User size={20} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role?.role_name || user?.role}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/profile"
                onClick={() => setSidebarOpen(false)}
                className="flex-1 btn btn-secondary text-sm py-2"
              >
                <Settings size={16} className="inline mr-1" />
                Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex-1 btn btn-danger text-sm py-2"
              >
                <LogOut size={16} className="inline mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <div className="lg:ml-0 ml-12 min-w-0">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Workspace</p>
              <h2 className="text-xl font-semibold text-slate-800 tracking-tight truncate">
                {currentSection}
              </h2>
            </div>

            <div className="hidden lg:flex items-center gap-3">
              <label className="sr-only" htmlFor="quick-jump">Quick jump</label>
              <div className="relative">
                <select
                  id="quick-jump"
                  className="input py-2 pl-3 pr-10 text-sm min-w-[190px]"
                  value={selectedPath}
                  onChange={(e) => navigate(e.target.value)}
                >
                  {navItems.map((item) => (
                    <option key={item.path} value={item.path}>{item.label}</option>
                  ))}
                </select>
                <ArrowUpRight size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              <div className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 flex items-center gap-2 shadow-sm">
                <CalendarDays size={15} className="text-slate-500" />
                {todayLabel}
              </div>
            </div>

            <div className="lg:hidden w-10"></div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;

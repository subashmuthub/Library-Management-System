import React, { useMemo, useState, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import { 
  LayoutDashboard, BookOpen, LogIn, Scan, MapPin, User, LogOut,
  Menu, X, Settings, RefreshCw, DollarSign, Bookmark, Users,
  Search, CalendarDays, BarChart3, PackagePlus, FileText, ChevronDown,
  Sparkles, Clock
} from 'lucide-react';

// Reusable Dropdown Component
const DropdownMenu = ({ title, icon: Icon, items, currentPath, closeMobile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  const isActive = items.some(item => currentPath === item.path);

  return (
    <div 
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button 
        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm ${
          isActive || isOpen
            ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon size={18} />
        {title}
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Content */}
      <div 
        className={`absolute top-full left-0 mt-1 w-60 bg-white rounded-xl shadow-lg border border-slate-100 p-2 z-50 transition-all duration-200 origin-top ${
          isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'
        }`}
      >
        {items.map((item) => {
          const ItemIcon = item.icon;
          const isItemActive = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { setIsOpen(false); closeMobile && closeMobile(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                isItemActive
                  ? 'bg-slate-50 text-primary-600 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <ItemIcon size={16} className={isItemActive ? 'text-primary-500' : 'text-slate-400'} />
              {item.label}
              {item.isNew && (
                <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-700">NEW</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.role_name;
  const isAdmin = (roleName || '').toLowerCase() === 'admin';

  const todayLabel = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Modern Navigation Structure
  const navigationConfig = [
    {
      type: 'link',
      path: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      type: 'dropdown',
      title: 'Books',
      icon: BookOpen,
      items: [
        { path: '/books', label: 'All Books', icon: BookOpen },
        { path: '/book-search', label: 'Advanced Search', icon: Search },
        { path: '/recommendations', label: 'AI Recommendations', icon: Sparkles, isNew: true },
        { path: '/shelf-locator', label: 'QR Shelf Locator', icon: MapPin, isNew: true },
        { path: '/book-orders', label: 'Book Orders', icon: PackagePlus },
        { path: '/question-papers', label: 'Question Papers', icon: FileText },
      ]
    },
    {
      type: 'dropdown',
      title: 'Issue Management',
      icon: RefreshCw,
      items: [
        { path: '/transactions', label: 'Transactions', icon: RefreshCw },
        { path: '/reservations', label: 'Reservations', icon: Bookmark },
        { path: '/fines', label: 'Fine Management', icon: DollarSign },
        { path: '/rfid', label: 'RFID Scanner', icon: Scan },
      ]
    },
    ...(isAdmin ? [{
      type: 'link',
      path: '/users',
      label: 'Users',
      icon: Users,
    }] : []),
    {
      type: 'dropdown',
      title: 'Analytics & Reports',
      icon: BarChart3,
      items: [
        { path: '/student-visualization', label: 'Student Visualization', icon: BarChart3 },
        { path: '/heatmap', label: 'Library Heatmap', icon: MapPin, isNew: true },
        { path: '/overdue-prediction', label: 'Overdue Predictions', icon: Clock, isNew: true },
        { path: '/entry', label: 'Entry Log', icon: LogIn },
        { path: '/navigation', label: 'Navigation', icon: MapPin },
      ]
    },
    ...(isAdmin ? [{
      type: 'link',
      path: '/settings',
      label: 'Settings',
      icon: Settings,
    }] : []),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Top Navbar Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  L
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Smart Library</h1>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">University System</span>
                </div>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden xl:flex items-center gap-1 mx-8">
              {navigationConfig.map((item, idx) => {
                if (item.type === 'link') {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={idx}
                      to={item.path}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm ${
                        isActive
                          ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </Link>
                  );
                } else if (item.type === 'dropdown') {
                  return (
                    <DropdownMenu 
                      key={idx} 
                      title={item.title} 
                      icon={item.icon} 
                      items={item.items} 
                      currentPath={location.pathname} 
                    />
                  );
                }
                return null;
              })}
            </nav>

            {/* Right side - Profile & Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 items-center gap-2">
                <CalendarDays size={14} className="text-slate-400" />
                {todayLabel}
              </div>

              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  onBlur={() => setTimeout(() => setProfileDropdownOpen(false), 200)}
                  className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 focus:outline-none"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center border border-indigo-200">
                    {user?.profile_image_url ? (
                      <img src={user.profile_image_url} alt="avatar" className="w-9 h-9 object-cover" />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-tr from-indigo-100 to-primary-100 flex items-center justify-center">
                        <User size={18} className="text-indigo-600" />
                      </div>
                    )}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-semibold text-slate-700 leading-tight">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{user?.role?.role_name || user?.role}</p>
                  </div>
                </button>

                {profileDropdownOpen && (
                  <div onMouseDown={(e) => e.preventDefault()} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                    <button onClick={() => { setProfileDropdownOpen(false); navigate('/profile'); }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 w-full text-left">
                      <Settings size={16} className="text-slate-400" />
                      My Profile
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button onMouseDown={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full text-left">
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                className="xl:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden bg-white border-b border-slate-200 absolute top-16 left-0 w-full shadow-lg z-30 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {navigationConfig.map((item, idx) => {
              if (item.type === 'link') {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={idx}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              } else if (item.type === 'dropdown') {
                return (
                  <div key={idx} className="py-2">
                    <div className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <item.icon size={14} />
                      {item.title}
                    </div>
                    <div className="pl-6 space-y-1 mt-1 border-l-2 border-slate-100 ml-5">
                      {item.items.map((subItem) => (
                        <Link
                          key={subItem.path}
                          to={subItem.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${
                            location.pathname === subItem.path
                              ? 'text-primary-600 font-semibold bg-primary-50'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {subItem.label}
                          {subItem.isNew && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 text-primary-700">NEW</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;

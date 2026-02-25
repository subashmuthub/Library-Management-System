import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, useMode } from '../contexts';
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
  TestTube
} from 'lucide-react';

const Layout = () => {
  const { user, logout } = useAuth();
  const { isDemoMode, modeLabel } = useMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/books', label: 'Books', icon: BookOpen },
    { path: '/transactions', label: 'Transactions', icon: RefreshCw },
    { path: '/fines', label: 'Fines', icon: DollarSign },
    { path: '/reservations', label: 'Reservations', icon: Bookmark },
    { path: '/users', label: 'Users', icon: Users },
    { path: '/entry', label: 'Entry Log', icon: LogIn },
    { path: '/rfid', label: 'RFID Scanner', icon: Scan },
    { path: '/navigation', label: 'Navigation', icon: NavigationIcon },
    { path: '/api-test', label: 'API Test', icon: TestTube },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h1 className="text-xl font-bold text-primary-600">Smart Library</h1>
              <span className={`text-xs font-medium ${isDemoMode ? 'text-yellow-600' : 'text-green-600'}`}>
                {modeLabel} MODE
              </span>
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
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-primary-100 text-primary-700'
                          : 'text-gray-700 hover:bg-gray-100'
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
          <div className="border-t p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <User size={20} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role?.role_name}</p>
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
        <header className="bg-white shadow-sm">
          <div className="flex items-center justify-between p-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <Menu size={24} />
            </button>
            <div className="lg:ml-0 ml-12">
              <h2 className="text-xl font-semibold text-gray-800">
                {navItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
              </h2>
            </div>
            <div className="lg:hidden w-10"></div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
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

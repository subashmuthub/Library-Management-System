import React, { useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts';
import {
  Award, BarChart3, Bell, BookOpen, BookPlus, Bookmark, CalendarDays, ChevronDown,
  Clock3, DollarSign, FileText, LayoutDashboard, LogIn, LogOut, MapPin,
  Menu, PackagePlus, PanelLeftClose, PanelLeftOpen, RefreshCw, Search, Scan,
  Settings, Sparkles, User, Users, X, ShieldCheck
} from 'lucide-react';

const navigation = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Books', icon: BookOpen, items: [
      { label: 'All Books', path: '/books', icon: BookOpen },
      { label: 'Advanced Search', path: '/book-search', icon: Search },
      { label: 'AI Recommendations', path: '/recommendations', icon: Sparkles, tag: 'New' },
      { label: 'QR Shelf Locator', path: '/shelf-locator', icon: MapPin, tag: 'New' },
      { label: 'Suggest a Book', path: '/suggestions', icon: BookPlus },
      { label: 'Book Orders', path: '/book-orders', icon: PackagePlus, roles: ['admin'] },
      { label: 'Question Papers', path: '/question-papers', icon: FileText },
    ],
  },
  {
    label: 'Issue Management', icon: RefreshCw, items: [
      { label: 'Transactions', path: '/transactions', icon: RefreshCw },
      { label: 'Reservations', path: '/reservations', icon: Bookmark },
      { label: 'Research Approvals', path: '/reservations/pending', icon: ShieldCheck, roles: ['admin', 'librarian'] },
      { label: 'Fine Management', path: '/fines', icon: DollarSign },
      { label: 'RFID Scanner', path: '/rfid', icon: Scan },
    ],
  },
  { label: 'Users', path: '/users', icon: Users, roles: ['admin', 'librarian'] },
  {
    label: 'Analytics & Reports', icon: BarChart3, items: [
      { label: 'Student Visualization', path: '/student-visualization', icon: BarChart3, roles: ['admin', 'librarian'] },
      { label: 'Library Heatmap', path: '/heatmap', icon: MapPin, tag: 'New', roles: ['admin', 'librarian'] },
      { label: 'Overdue Predictions', path: '/overdue-prediction', icon: Clock3, tag: 'New', roles: ['admin', 'librarian'] },
      { label: 'Active User Certificate', path: '/active-user-certificate', icon: Award, tag: 'New', roles: ['admin', 'librarian'] },
      { label: 'Entry Log', path: '/entry', icon: LogIn },
      { label: 'Navigation', path: '/navigation', icon: MapPin },
    ],
  },
  { label: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'librarian'] },
];

const flattenNavigation = (items) => items.flatMap((item) => item.items || item);

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState({
    Books: true,
    'Issue Management': true,
    'Analytics & Reports': true,
    'Log & Navigation': true,
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState('');

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.role_name;
  const userRole = (roleName || '').toLowerCase();
  const isAdmin = userRole === 'admin';
  const isLibrarian = userRole === 'librarian';
  const isStaff = ['teacher', 'faculty', 'staff', 'librarian'].includes(userRole);
  const isStudent = !isAdmin && !isStaff;

  const isItemAllowed = (item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.roles && !item.roles.map((r) => r.toLowerCase()).includes(userRole)) return false;
    return true;
  };

  const visibleNavigation = useMemo(() => {
    return navigation
      .filter(isItemAllowed)
      .map((item) => {
        let label = item.label;
        if (item.label === 'Analytics & Reports' || item.label === 'Log & Activity') {
          label = userRole === 'student' ? 'Log & Navigation' : 'Analytics & Reports';
        }
        if (!item.items) return { ...item, label };
        const filteredChildren = item.items.filter(isItemAllowed);
        return { ...item, label, items: filteredChildren };
      })
      .filter((item) => !item.items || item.items.length > 0);
  }, [isAdmin, userRole]);
  const currentPage = useMemo(() => {
    const page = flattenNavigation(visibleNavigation).find((item) => location.pathname === item.path);
    return page?.label || 'Dashboard';
  }, [location.pathname, visibleNavigation]);
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const searchResults = search.trim()
    ? flattenNavigation(visibleNavigation).filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
    : [];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderNavItem = (item, isChild = false) => {
    const Icon = item.icon;
    const active = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={`app-nav-link ${active ? 'app-nav-link-active' : ''} ${isChild ? 'app-nav-link-child' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon size={18} strokeWidth={active ? 2.3 : 1.9} />
        <span className="app-nav-label">{item.label}</span>
        {item.tag && <span className="app-nav-tag">{item.tag}</span>}
      </Link>
    );
  };

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="app-sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`app-sidebar ${sidebarOpen ? 'app-sidebar-mobile-open' : ''} ${collapsed ? 'app-sidebar-collapsed' : ''}`}>
        <div className="app-brand">
          <button className="app-brand-mark" onClick={() => navigate('/dashboard')} aria-label="Go to dashboard">
            <img src="/pic/NEC%20LOGO.png" alt="NEC" />
          </button>
          <div className="app-brand-copy"><strong>Smart Library</strong><span>University System</span></div>
          <button className="app-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <nav className="app-sidebar-nav" aria-label="Primary navigation">
          {visibleNavigation.map((item) => {
            if (!item.items) return renderNavItem(item);
            const active = item.items.some((child) => location.pathname === child.path);
            const isExpanded = expanded[item.label] || active;
            const Icon = item.icon;
            return (
              <div className="app-nav-group" key={item.label}>
                <button className={`app-nav-group-button ${active ? 'app-nav-group-active' : ''}`} onClick={() => setExpanded((state) => ({ ...state, [item.label]: !isExpanded }))} aria-expanded={isExpanded}>
                  <Icon size={18} /><span className="app-nav-label">{item.label}</span><ChevronDown size={15} className={`app-nav-chevron ${isExpanded ? 'is-open' : ''}`} />
                </button>
                {isExpanded && <div className="app-nav-children">{item.items.map((child) => renderNavItem(child, true))}</div>}
              </div>
            );
          })}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-status-dot"><span />System operational</div>
          <button className="app-collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}<span className="app-nav-label">Collapse menu</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="app-header-left">
            <button className="app-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="app-breadcrumb"><span>Workspace</span><span>/</span><strong>{currentPage}</strong></div>
          </div>
          <div className="app-header-actions">
            <div className="app-search-wrap">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pages" aria-label="Search pages" />
              {searchResults.length > 0 && <div className="app-search-results">{searchResults.slice(0, 6).map((result) => <Link key={result.path} to={result.path} onClick={() => setSearch('')}>{result.label}</Link>)}</div>}
            </div>
            <div className="app-date"><CalendarDays size={16} /><span>{todayLabel}</span></div>
            <button className="app-icon-button" aria-label="Notifications"><Bell size={18} /><span className="app-notification-badge">3</span></button>
            <div className="app-profile-wrap">
              <button className="app-profile-button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}>
                <span className="app-avatar">{user?.profile_image_url ? <img src={user.profile_image_url} alt="" /> : <User size={17} />}</span>
                <span className="app-profile-copy">
                  <span className="inline-flex items-center gap-1.5">
                    <strong>{user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Library user'}</strong>
                    {isAdmin ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 uppercase">
                        Admin
                      </span>
                    ) : (isLibrarian || isStaff) ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 uppercase">
                        Staff
                      </span>
                    ) : user?.degree_type ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        ['me', 'm.tech', 'phd', 'research scholar'].includes(String(user.degree_type).toLowerCase())
                          ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
                      }`}>
                        {user.degree_type}{user.department ? ` - ${user.department}` : ''}
                      </span>
                    ) : null}
                  </span>
                  <small>{isAdmin ? 'Admin' : (isLibrarian ? 'Librarian (Staff)' : (isStaff ? 'Staff' : 'Student'))}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="app-profile-menu">
                  {isStudent && user?.degree_type ? (
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span>{user?.degree_type} - {user?.department || 'CSE'}</span>
                        {['me', 'm.tech', 'phd', 'research scholar'].includes(String(user.degree_type).toLowerCase()) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-semibold uppercase">PG Research</span>
                        )}
                      </div>
                      {user?.academic_year && <div className="text-[11px] text-gray-500 mt-0.5">{user.academic_year}</div>}
                    </div>
                  ) : (
                    <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs">
                      <div className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span className="capitalize">{isAdmin ? 'System Administrator' : (isLibrarian ? 'Librarian (Staff)' : 'Staff Member')}</span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{user?.department || (isAdmin ? 'Administration' : 'Library')}</div>
                    </div>
                  )}
                  <button onClick={() => { setProfileOpen(false); navigate('/profile'); }}><User size={16} /> My profile</button>
                  <button onClick={handleLogout} className="app-logout"><LogOut size={16} /> Sign out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="app-content"><Outlet /></main>
      </div>
    </div>
  );
};

export default Layout;

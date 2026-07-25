import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  User, Mail, Phone, MapPin, Calendar, BookOpen, 
  Clock, DollarSign, ArrowLeft, CheckCircle, XCircle 
} from 'lucide-react';

const UserDetail = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ borrowed: 0, fines: 0, reservations: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        // Note: For a real app, you'd fetch from specific endpoints. 
        // Here we simulate loading user details assuming a single unified endpoint or separate fetches.
        const res = await axios.get(`/api/v1/users/${id}`, { withCredentials: true });
        if (res.data.success) {
          setUser(res.data.user);
          // Simulated stats if not returned by backend
          setStats({
            borrowed: res.data.user.active_borrows || 0,
            fines: res.data.user.total_fines || 0,
            reservations: res.data.user.active_reservations || 0
          });
        }
      } catch (err) {
        console.error('Failed to load user:', err);
        setError('Failed to load user details.');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 bg-gray-200 rounded-xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl"></div>
          <div className="md:col-span-2 h-64 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="empty-state card">
        <XCircle size={48} className="text-red-300 mb-2" />
        <h3 className="text-lg font-bold text-gray-900">User Not Found</h3>
        <p className="text-gray-500 mb-4">{error || 'The requested user does not exist.'}</p>
        <button onClick={() => window.history.back()} className="btn btn-secondary">
          <ArrowLeft size={16} /> Go Back
        </button>
      </div>
    );
  }

  const roleName = user.role_name || (user.role && user.role.role_name) || 'Member';

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-2">
        <button onClick={() => window.history.back()} className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">User Profile</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Profile Card */}
        <div className="space-y-6">
          <div className="card text-center relative overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-800 absolute top-0 left-0 w-full rounded-t-xl" />
            <div className="relative mt-8 mb-4">
              <div className="w-24 h-24 bg-white rounded-full border-4 border-white shadow-md mx-auto flex items-center justify-center overflow-hidden">
                <div className="w-full h-full bg-amber-400 flex items-center justify-center text-amber-900 text-3xl font-bold">
                  {user.first_name?.[0]}{user.last_name?.[0]}
                </div>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide mb-1">{roleName}</p>
            <div className="flex justify-center gap-2 mb-6">
              <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                {user.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>

            <div className="space-y-4 text-left border-t border-gray-100 pt-5">
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-gray-500 text-xs">Email</p>
                  <p className="text-gray-900 font-medium break-all">{user.email}</p>
                </div>
              </div>
              
              {user.phone && (
                <div className="flex items-start gap-3">
                  <Phone size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="text-gray-500 text-xs">Phone</p>
                    <p className="text-gray-900 font-medium">{user.phone}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-start gap-3">
                <Calendar size={16} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="text-gray-500 text-xs">Member Since</p>
                  <p className="text-gray-900 font-medium">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Stats & Activity */}
        <div className="md:col-span-2 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card flex-col items-start gap-2 border-t-4 border-t-blue-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                <BookOpen size={16} className="text-blue-500" /> Currently Borrowed
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.borrowed}</div>
            </div>
            
            <div className="stat-card flex-col items-start gap-2 border-t-4 border-t-red-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                <DollarSign size={16} className="text-red-500" /> Pending Fines
              </div>
              <div className="text-3xl font-bold text-gray-900">₹{stats.fines}</div>
            </div>
            
            <div className="stat-card flex-col items-start gap-2 border-t-4 border-t-purple-500">
              <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                <Clock size={16} className="text-purple-500" /> Active Reservations
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.reservations}</div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="card h-full min-h-[400px]">
            <h3 className="section-title mb-1">Recent Activity</h3>
            <p className="section-subtitle mb-6">Latest transactions and interactions</p>
            
            <div className="empty-state py-12">
              <div className="empty-state-icon bg-gray-50">
                <Clock size={28} className="text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm max-w-sm text-center">
                Detailed activity history requires integration with the transactions endpoint.
              </p>
              <Link to={`/transactions?user=${id}`} className="btn btn-secondary mt-2">
                View All Transactions
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDetail;

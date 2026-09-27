import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts';
import { authService, entryService, transactionService } from '../services';
import { User, Mail, CreditCard, Shield, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || user?.firstName || '',
    last_name: user?.last_name || user?.lastName || '',
    email: user?.email || '',
    student_id: user?.student_id || user?.studentId || '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ borrowed: 0, visits: 0 });
  const [avatarFile, setAvatarFile] = useState(null);
  const displayName = user?.name || [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ');
  const displayRole = user?.role?.role_name || user?.role;
  const [borrowedBooks, setBorrowedBooks] = useState([]);

  // Load user stats on mount
  useEffect(() => {
    const loadStats = async () => {
      try {
        if (user?.id) {
          const [transactionsRes, entriesRes] = await Promise.all([
            transactionService.getAllTransactions({ user_id: user.id, status: 'active' }),
            entryService.getMyHistory(user.id),
          ]);

          const activeBorrowed = transactionsRes.transactions || [];
          setBorrowedBooks(activeBorrowed);

          setStats({
            borrowed: activeBorrowed.length || 0,
            visits: entriesRes.total || entriesRes.entries?.length || 0,
          });
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
        // Keep default 0/0 on error
      }
    };
    loadStats();
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      // Include userId for backend (development mode)
      const updateData = {
        ...formData,
        userId: user?.id
      };
      const response = await authService.updateProfile(updateData);
      updateUser(response.user);
      setResult({ success: true, message: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (error) {
      setResult({ 
        success: false, 
        message: error.response?.data?.message || 'Failed to update profile' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    setAvatarFile(e.target.files?.[0] || null);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return setResult({ success: false, message: 'Please select a file to upload' });
    setLoading(true);
    try {
      const response = await authService.uploadAvatar(avatarFile, user?.id);
      updateUser(response.user);
      setResult({ success: true, message: 'Avatar uploaded' });
      setAvatarFile(null);
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Upload failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user?.first_name || user?.firstName || '',
      last_name: user?.last_name || user?.lastName || '',
      email: user?.email || '',
      student_id: user?.student_id || user?.studentId || '',
    });
    setIsEditing(false);
    setResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden bg-white">
          {user?.profile_image_url ? (
            <img src={user.profile_image_url} alt="avatar" className="w-24 h-24 object-cover" />
          ) : (
            <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
              <User size={48} className="text-primary-600" />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold mb-1">{displayName || 'User'}</h1>
        <p className="text-gray-600 capitalize">{displayRole}</p>
      </div>

      {/* Profile Information */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Profile Information</h2>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="btn btn-primary">
              Edit Profile
            </button>
          )}
        </div>

        {result && (
          <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <>
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-green-700">{result.message}</p>
              </>
            ) : (
              <>
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-700">{result.message}</p>
              </>
            )}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Avatar</label>
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={handleUploadAvatar} className="btn btn-secondary">Upload Avatar</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User size={16} className="inline mr-1" />
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  className="input"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  className="input"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Mail size={16} className="inline mr-1" />
                Email Address
              </label>
              <input
                type="email"
                name="email"
                className="input"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <CreditCard size={16} className="inline mr-1" />
                Student ID
              </label>
              <input
                type="text"
                name="student_id"
                className="input"
                value={formData.student_id}
                onChange={handleChange}
                placeholder="Optional"
              />
            </div>

            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={handleCancel} className="btn btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="font-medium">{displayName || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Mail className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Email Address</p>
                <p className="font-medium">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <CreditCard className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Student ID</p>
                <p className="font-medium">{user?.student_id || user?.studentId || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <CreditCard className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Registration Number</p>
                <p className="font-medium">{user?.student_id || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <span className="badge badge-info capitalize">{displayRole || 'user'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Account Stats */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Account Statistics</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-primary-50 rounded-lg">
            <p className="text-3xl font-bold text-primary-600">{stats.borrowed}</p>
            <p className="text-sm text-gray-600 mt-1">Books Borrowed</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{stats.visits}</p>
            <p className="text-sm text-gray-600 mt-1">Library Visits</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Books Currently Taken</h2>
        {borrowedBooks.length > 0 ? (
          <div className="space-y-3">
            {borrowedBooks.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="font-semibold">{item.title || `Book #${item.book_id}`}</p>
                <p className="text-sm text-gray-600">ISBN: {item.isbn || 'N/A'}</p>
                <p className="text-sm text-gray-600">Due Date: {item.due_date || 'N/A'}</p>
                <p className="text-xs mt-1 text-orange-600">Status: {item.status || 'active'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No active borrowed books.</p>
        )}
      </div>
    </div>
  );
};

export default Profile;

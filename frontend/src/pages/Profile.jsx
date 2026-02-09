import React, { useState } from 'react';
import { useAuth } from '../contexts';
import { authService } from '../services';
import { User, Mail, CreditCard, Shield, CheckCircle, AlertCircle } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

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
      const response = await authService.updateProfile(formData);
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

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
    setIsEditing(false);
    setResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User size={48} className="text-primary-600" />
        </div>
        <h1 className="text-2xl font-bold mb-1">{user?.name}</h1>
        <p className="text-gray-600 capitalize">{user?.role}</p>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User size={16} className="inline mr-1" />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                className="input"
                value={formData.name}
                onChange={handleChange}
                required
              />
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
                <p className="font-medium">{user?.name}</p>
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
                <p className="font-medium">{user?.student_id || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <span className="badge badge-info capitalize">{user?.role}</span>
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
            <p className="text-3xl font-bold text-primary-600">0</p>
            <p className="text-sm text-gray-600 mt-1">Books Borrowed</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">0</p>
            <p className="text-sm text-gray-600 mt-1">Library Visits</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

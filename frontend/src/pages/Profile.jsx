import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts';
import { authService, entryService, transactionService } from '../services';
import { User, Mail, CreditCard, Shield, CheckCircle, AlertCircle, GraduationCap, Building, Calendar, Award } from 'lucide-react';
import DigitalLibraryCard from '../components/DigitalLibraryCard';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: user?.first_name || user?.firstName || '',
    last_name: user?.last_name || user?.lastName || '',
    email: user?.email || '',
    student_id: user?.student_id || user?.studentId || '',
    degree_type: user?.degree_type || user?.degreeType || 'BE',
    department: user?.department || 'CSE',
    academic_year: user?.academic_year || user?.academicYear || '3rd Year',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ borrowed: 0, visits: 0 });
  const [avatarFile, setAvatarFile] = useState(null);
  const displayName = user?.name || [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ');
  const displayRole = user?.role?.role_name || user?.role;
  const rawRole = String(user?.role?.role_name || user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'administrator'].includes(rawRole);
  const isLibrarian = ['librarian'].includes(rawRole);
  const isStaff = ['teacher', 'faculty', 'staff', 'librarian'].includes(rawRole);
  const isStudent = !isAdmin && !isStaff;
  const displayRoleLabel = isAdmin ? 'System Administrator' : isLibrarian ? 'Library Staff' : isStaff ? 'Faculty & Staff' : (displayRole || 'Student');
  const [borrowedBooks, setBorrowedBooks] = useState([]);

  // Sync formData when user loads
  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || user.firstName || '',
        last_name: user.last_name || user.lastName || '',
        email: user.email || '',
        student_id: user.student_id || user.studentId || '',
        degree_type: isStudent ? (user.degree_type || user.degreeType || 'BE') : '',
        department: user.department || (isAdmin ? 'Administration' : isLibrarian ? 'Library' : 'CSE'),
        academic_year: isStudent ? (user.academic_year || user.academicYear || '3rd Year') : '',
      });
    }
  }, [user, isStudent, isAdmin, isLibrarian]);

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
        userId: user?.id,
        degree_type: isStudent ? formData.degree_type : null,
        academic_year: isStudent ? formData.academic_year : null,
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
      degree_type: isStudent ? (user?.degree_type || user?.degreeType || 'BE') : '',
      department: user?.department || (isAdmin ? 'Administration' : isLibrarian ? 'Library' : 'CSE'),
      academic_year: isStudent ? (user?.academic_year || user?.academicYear || '3rd Year') : '',
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
        <p className="text-gray-600 capitalize font-medium">{displayRoleLabel}</p>
      </div>

      {/* Digital Library Card with QR Code */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Digital Library Pass</h2>
          <span className="text-[11px] text-indigo-400 font-medium">Valid for self-checkout & gate access</span>
        </div>
        <DigitalLibraryCard user={user} />
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

            {isStudent ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <CreditCard size={16} className="inline mr-1" />
                      Student / Roll ID
                    </label>
                    <input
                      type="text"
                      name="student_id"
                      className="input"
                      value={formData.student_id}
                      onChange={handleChange}
                      placeholder="e.g. 21CS101"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <GraduationCap size={16} className="inline mr-1" />
                      Degree Program
                    </label>
                    <select
                      name="degree_type"
                      className="input"
                      value={formData.degree_type}
                      onChange={handleChange}
                    >
                      <option value="BE">BE (Bachelor of Engineering)</option>
                      <option value="B.Tech">B.Tech (Bachelor of Technology)</option>
                      <option value="ME">ME (Master of Engineering)</option>
                      <option value="M.Tech">M.Tech (Master of Technology)</option>
                      <option value="PhD">PhD (Doctor of Philosophy)</option>
                      <option value="Research Scholar">Research Scholar</option>
                      <option value="MS">MS (Master of Science by Research)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Building size={16} className="inline mr-1" />
                      Department
                    </label>
                    <select
                      name="department"
                      className="input"
                      value={formData.department}
                      onChange={handleChange}
                    >
                      <option value="CSE">Computer Science & Engineering (CSE)</option>
                      <option value="ECE">Electronics & Communication (ECE)</option>
                      <option value="MECH">Mechanical Engineering (MECH)</option>
                      <option value="AIDS">Artificial Intelligence & Data Science (AIDS)</option>
                      <option value="CIVIL">Civil Engineering (CIVIL)</option>
                      <option value="IT">Information Technology (IT)</option>
                      <option value="EEE">Electrical & Electronics (EEE)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar size={16} className="inline mr-1" />
                      Academic Year
                    </label>
                    <select
                      name="academic_year"
                      className="input"
                      value={formData.academic_year}
                      onChange={handleChange}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="Final Year">Final Year</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <CreditCard size={16} className="inline mr-1" />
                    {isAdmin ? 'Admin / Staff ID' : 'Staff / Employee ID'}
                  </label>
                  <input
                    type="text"
                    name="student_id"
                    className="input"
                    value={formData.student_id}
                    onChange={handleChange}
                    placeholder="e.g. STF-01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building size={16} className="inline mr-1" />
                    Department / Division
                  </label>
                  <select
                    name="department"
                    className="input"
                    value={formData.department}
                    onChange={handleChange}
                  >
                    <option value="Administration">Administration</option>
                    <option value="Library">Library</option>
                    <option value="CSE">Computer Science & Engineering (CSE)</option>
                    <option value="ECE">Electronics & Communication (ECE)</option>
                    <option value="MECH">Mechanical Engineering (MECH)</option>
                    <option value="AIDS">Artificial Intelligence & Data Science (AIDS)</option>
                    <option value="CIVIL">Civil Engineering (CIVIL)</option>
                    <option value="IT">Information Technology (IT)</option>
                    <option value="EEE">Electrical & Electronics (EEE)</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
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

            {isStudent ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <CreditCard className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Roll / Student ID</p>
                      <p className="font-medium font-mono">{user?.student_id || user?.studentId || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <GraduationCap className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Degree Program</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-gray-900">{user?.degree_type || user?.degreeType || 'BE'}</span>
                        {['me', 'm.tech', 'phd', 'research scholar'].includes(String(user?.degree_type || user?.degreeType || '').toLowerCase()) ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            Direct Research Access Eligible
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            UG Student
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-medium">{user?.department || 'CSE'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Calendar className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Academic Year</p>
                      <p className="font-medium">{user?.academic_year || user?.academicYear || '3rd Year'}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <CreditCard className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">{isAdmin ? 'Admin / Staff ID' : 'Staff / Employee ID'}</p>
                      <p className="font-medium font-mono">{user?.student_id || user?.studentId || (isAdmin ? `ADMIN-${String(user?.id || '0000').padStart(4, '0')}` : `STAFF-${String(user?.id || '0000').padStart(4, '0')}`)}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Award className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Designation / Access Level</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-gray-900">
                          {isAdmin ? 'System Administrator' : isLibrarian ? 'Library Staff' : 'Faculty / Staff'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          isAdmin ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {isAdmin ? 'Full Root Access' : 'Librarian Desk Privileges'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Department / Division</p>
                      <p className="font-medium">{user?.department || (isAdmin ? 'Administration' : 'Library')}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Shield className="text-gray-600 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="text-sm text-gray-600">Borrowing Privileges</p>
                      <p className="font-medium">{isAdmin ? 'Unlimited Books (Administrator Pass)' : '10 Books (Staff Loan Period: 60 Days)'}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <Shield className="text-gray-600 flex-shrink-0 mt-1" size={20} />
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <span className={`badge ${isAdmin ? 'badge-primary' : isStaff ? 'badge-warning' : 'badge-info'} capitalize`}>
                  {isAdmin ? 'Admin' : isLibrarian ? 'Staff' : isStaff ? 'Staff' : 'Student'}
                </span>
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

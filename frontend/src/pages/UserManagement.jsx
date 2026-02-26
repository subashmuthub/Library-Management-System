import React, { useState, useEffect } from 'react';
import { userManagementService } from '../services';
import { Users, UserPlus, UserCheck, UserX, Lock, Activity, Edit } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, inactive
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role_id: 3 // Student by default
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role_id: 3
  });

  useEffect(() => {
    loadUsers();
  }, [filter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await userManagementService.getAllUsers(params);
      setUsers(response.users || response.data || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await userManagementService.createUser(createForm);
      alert('User created successfully!');
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role_id: 3 });
      loadUsers();
    } catch (error) {
      alert(`User creation failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const action = currentStatus === 'active' ? 'deactivate' : 'activate';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
      try {
        await userManagementService.toggleUserStatus(userId, { status: newStatus });
        alert(`User ${action}d successfully!`);
        loadUsers();
      } catch (error) {
        alert(`Status toggle failed: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const handleResetPassword = async (userId) => {
    const newPassword = prompt('Enter new password for this user:');
    if (newPassword && newPassword.length >= 6) {
      try {
        await userManagementService.resetPassword(userId, { new_password: newPassword });
        alert('Password reset successfully!');
      } catch (error) {
        alert(`Password reset failed: ${error.response?.data?.error || error.message}`);
      }
    } else if (newPassword) {
      alert('Password must be at least 6 characters long');
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      name: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role_id: user.role_id
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await userManagementService.updateUser(editingUser.id, editForm);
      alert('User updated successfully!');
      setShowEditModal(false);
      setEditingUser(null);
      setEditForm({ name: '', email: '', role_id: 3 });
      loadUsers();
    } catch (error) {
      alert(`User update failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const getStatusBadge = (status) => {
    return status === 'active' 
      ? <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">ACTIVE</span>
      : <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">INACTIVE</span>;
  };

  const getRoleBadge = (roleName) => {
    const styles = {
      'Admin': 'bg-purple-100 text-purple-700',
      'Librarian': 'bg-blue-100 text-blue-700',
      'Student': 'bg-gray-100 text-gray-700',
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[roleName] || 'bg-gray-100 text-gray-700'}`}>
      {roleName?.toUpperCase()}
    </span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-gray-600">Manage library users and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <UserPlus size={20} className="mr-2" />
          Create User
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded font-medium ${
                filter === f 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Users List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">
            <Users className="animate-pulse mx-auto mb-2" size={32} />
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{user.id}</td>
                    <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                    <td className="px-4 py-3 text-sm">{user.email}</td>
                    <td className="px-4 py-3">{getRoleBadge(user.role_name)}</td>
                    <td className="px-4 py-3">{getStatusBadge(user.status)}</td>
                    <td className="px-4 py-3 text-sm">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                          title="Edit User"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.status)}
                          className={`font-medium ${
                            user.status === 'active' 
                              ? 'text-red-600 hover:text-red-700' 
                              : 'text-green-600 hover:text-green-700'
                          }`}
                          title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {user.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                        </button>
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          className="text-orange-600 hover:text-orange-700 font-medium"
                          title="Reset Password"
                        >
                          <Lock size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create New User</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="input w-full"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="john.doe@university.edu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength="6"
                  className="input w-full"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  required
                  className="input w-full"
                  value={createForm.role_id}
                  onChange={(e) => setCreateForm({ ...createForm, role_id: parseInt(e.target.value) })}
                >
                  <option value={1}>Admin</option>
                  <option value={2}>Librarian</option>
                  <option value={3}>Student</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit User</h2>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  className="input w-full"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  required
                  className="input w-full"
                  value={editForm.role_id}
                  onChange={(e) => setEditForm({ ...editForm, role_id: parseInt(e.target.value) })}
                >
                  <option value={1}>Admin</option>
                  <option value={2}>Librarian</option>
                  <option value={3}>Student</option>
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;

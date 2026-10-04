import React, { useState, useEffect } from 'react';
import { adminService } from '../services';
import {
  Sliders,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Edit2,
  Check,
  X,
  ShieldCheck,
  BookOpen,
  Calendar,
  DollarSign,
  FileText,
  HelpCircle
} from 'lucide-react';

const AdminDepartmentSettings = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Edit modal state
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [editForm, setEditForm] = useState({
    department_code: '',
    department_name: '',
    max_borrow_limit_ug: 6,
    loan_duration_days_ug: 14,
    max_borrow_limit_pg: 10,
    loan_duration_days_pg: 60,
    allow_direct_thesis_checkout: false,
    daily_fine_rate: 2.0,
  });
  const [saving, setSaving] = useState(false);

  // Create new policy modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPolicyForm, setNewPolicyForm] = useState({
    department_code: '',
    department_name: '',
    max_borrow_limit_ug: 6,
    loan_duration_days_ug: 14,
    max_borrow_limit_pg: 10,
    loan_duration_days_pg: 60,
    allow_direct_thesis_checkout: false,
    daily_fine_rate: 2.0,
  });
  const [creating, setCreating] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.getDepartmentPolicies();
      if (res.success) {
        setPolicies(res.policies || []);
      } else {
        setError(res.error || 'Failed to load department policies');
      }
    } catch (err) {
      console.error('Error fetching department policies:', err);
      setError(err.response?.data?.message || err.message || 'Error fetching policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleOpenEdit = (policy) => {
    setEditingPolicy(policy);
    setEditForm({
      department_code: policy.department_code,
      department_name: policy.department_name || '',
      max_borrow_limit_ug: policy.max_borrow_limit_ug,
      loan_duration_days_ug: policy.loan_duration_days_ug,
      max_borrow_limit_pg: policy.max_borrow_limit_pg,
      loan_duration_days_pg: policy.loan_duration_days_pg,
      allow_direct_thesis_checkout: Boolean(policy.allow_direct_thesis_checkout),
      daily_fine_rate: policy.daily_fine_rate,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminService.updateDepartmentPolicy(editForm.department_code, editForm);
      if (res.success) {
        showToast(`Policy for ${editForm.department_code} updated successfully.`);
        setEditingPolicy(null);
        fetchPolicies();
      } else {
        showToast(res.message || 'Failed to update policy.', 'error');
      }
    } catch (err) {
      console.error('Error updating policy:', err);
      showToast(err.response?.data?.message || 'Error saving policy.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await adminService.createDepartmentPolicy(newPolicyForm);
      if (res.success) {
        showToast(`New policy for ${newPolicyForm.department_code.toUpperCase()} created.`);
        setIsCreateModalOpen(false);
        setNewPolicyForm({
          department_code: '',
          department_name: '',
          max_borrow_limit_ug: 6,
          loan_duration_days_ug: 14,
          max_borrow_limit_pg: 10,
          loan_duration_days_pg: 60,
          allow_direct_thesis_checkout: false,
          daily_fine_rate: 2.0,
        });
        fetchPolicies();
      } else {
        showToast(res.message || 'Failed to create policy.', 'error');
      }
    } catch (err) {
      console.error('Error creating policy:', err);
      showToast(err.response?.data?.message || 'Error creating policy.', 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 text-xs font-bold tracking-wide rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600" />
                ADMINISTRATIVE WORKSPACE
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                Rule Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Department-Wise Policy & Compatibility Settings
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Configure department-tailored borrowing quotas, extended loan periods for research/mechanical labs,
              direct thesis issuance permissions, and daily fine rates.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 transition-all"
            >
              <Plus size={16} />
              <span>Add Department Rule</span>
            </button>
            <button
              onClick={fetchPolicies}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all disabled:opacity-60"
              title="Refresh Policies"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Informational Policy Banner */}
        <div className="mt-6 p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
          <HelpCircle size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-indigo-900">
              Circulation Desk Dynamic Integration Active
            </p>
            <p className="text-indigo-700 leading-relaxed">
              When a clerk checks out a book or looks up a student at the counter, the system automatically resolves
              rules from this matrix matching the student's department code and degree level (Undergraduate vs
              Postgraduate/Doctoral). The <code className="px-1 py-0.5 bg-indigo-100 rounded text-indigo-800 font-bold">DEFAULT</code> rule
              applies automatically to students whose department is not individually customized.
            </p>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* POLICY MATRIX TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-base">Department Lending Rule Matrix</h2>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {policies.length} Active Rules
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">UG Lending Rules</th>
                <th className="py-3 px-4">PG / Research Rules</th>
                <th className="py-3 px-4 text-center">Direct Thesis Checkout</th>
                <th className="py-3 px-4 text-right">Daily Fine Rate</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    <span>Loading department rules...</span>
                  </td>
                </tr>
              ) : policies.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400 text-sm">
                    No department policies found. Click "Add Department Rule" to create one.
                  </td>
                </tr>
              ) : (
                policies.map((policy) => {
                  const isDefault = policy.department_code === 'DEFAULT';
                  return (
                    <tr
                      key={policy.department_code}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDefault ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs ${
                              isDefault
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            }`}
                          >
                            {policy.department_code}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{policy.department_name || policy.department_code}</p>
                            {isDefault && (
                              <p className="text-[11px] text-amber-600 font-medium">Standard Fallback Policy</p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                            <BookOpen size={13} className="text-slate-400" />
                            <span>Max {policy.max_borrow_limit_ug} Books</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{policy.loan_duration_days_ug} Days Duration</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                            <BookOpen size={13} className="text-slate-400" />
                            <span>Max {policy.max_borrow_limit_pg} Books</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Calendar size={13} className="text-slate-400" />
                            <span>{policy.loan_duration_days_pg} Days Duration</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-center">
                        {policy.allow_direct_thesis_checkout ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check size={12} />
                            <span>Permitted</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <span>Approval Req.</span>
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <span className="font-extrabold text-slate-900 text-sm">
                          ₹{Number(policy.daily_fine_rate).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-400 font-medium block">/ day overdue</span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleOpenEdit(policy)}
                          className="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition-colors"
                          title="Edit Policy"
                        >
                          <Edit2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT POLICY MODAL */}
      {editingPolicy && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Edit Lending Policy: {editingPolicy.department_code}
                </h3>
              </div>
              <button
                onClick={() => setEditingPolicy(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.department_name}
                  onChange={(e) => setEditForm({ ...editForm, department_name: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              {/* UG Rules */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Undergraduate (UG) Lending Rules
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Max Books Borrow Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={editForm.max_borrow_limit_ug}
                      onChange={(e) =>
                        setEditForm({ ...editForm, max_borrow_limit_ug: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      required
                      value={editForm.loan_duration_days_ug}
                      onChange={(e) =>
                        setEditForm({ ...editForm, loan_duration_days_ug: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* PG Rules */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Postgraduate & Research (PG) Lending Rules
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Max Books Borrow Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={editForm.max_borrow_limit_pg}
                      onChange={(e) =>
                        setEditForm({ ...editForm, max_borrow_limit_pg: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      required
                      value={editForm.loan_duration_days_pg}
                      onChange={(e) =>
                        setEditForm({ ...editForm, loan_duration_days_pg: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Thesis Checkout & Fine Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Daily Fine Rate (₹ / Day)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    max="50"
                    required
                    value={editForm.daily_fine_rate}
                    onChange={(e) =>
                      setEditForm({ ...editForm, daily_fine_rate: Number(e.target.value) })
                    }
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={editForm.allow_direct_thesis_checkout}
                      onChange={(e) =>
                        setEditForm({ ...editForm, allow_direct_thesis_checkout: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Allow Direct Thesis Checkout (No Prior Clearance)</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPolicy(null)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 disabled:opacity-60"
                >
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Save Policy Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW POLICY MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Add Department Lending Policy</h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Department Code (e.g., 'AIDS', 'BIO')
                  </label>
                  <input
                    type="text"
                    required
                    value={newPolicyForm.department_code}
                    onChange={(e) =>
                      setNewPolicyForm({ ...newPolicyForm, department_code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. MECH"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold text-slate-800 uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Department Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newPolicyForm.department_name}
                    onChange={(e) =>
                      setNewPolicyForm({ ...newPolicyForm, department_name: e.target.value })
                    }
                    placeholder="e.g. Mechanical Engineering"
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* UG Rules */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Undergraduate (UG) Lending Rules
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Max Books Borrow Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      required
                      value={newPolicyForm.max_borrow_limit_ug}
                      onChange={(e) =>
                        setNewPolicyForm({ ...newPolicyForm, max_borrow_limit_ug: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      required
                      value={newPolicyForm.loan_duration_days_ug}
                      onChange={(e) =>
                        setNewPolicyForm({ ...newPolicyForm, loan_duration_days_ug: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* PG Rules */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Postgraduate & Research (PG) Lending Rules
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Max Books Borrow Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={newPolicyForm.max_borrow_limit_pg}
                      onChange={(e) =>
                        setNewPolicyForm({ ...newPolicyForm, max_borrow_limit_pg: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Loan Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="180"
                      required
                      value={newPolicyForm.loan_duration_days_pg}
                      onChange={(e) =>
                        setNewPolicyForm({ ...newPolicyForm, loan_duration_days_pg: Number(e.target.value) })
                      }
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Thesis & Fine Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Daily Fine Rate (₹ / Day)
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    max="50"
                    required
                    value={newPolicyForm.daily_fine_rate}
                    onChange={(e) =>
                      setNewPolicyForm({ ...newPolicyForm, daily_fine_rate: Number(e.target.value) })
                    }
                    className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={newPolicyForm.allow_direct_thesis_checkout}
                      onChange={(e) =>
                        setNewPolicyForm({ ...newPolicyForm, allow_direct_thesis_checkout: e.target.checked })
                      }
                      className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                    />
                    <span>Allow Direct Thesis Checkout</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 disabled:opacity-60"
                >
                  {creating ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
                  <span>Create Policy</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepartmentSettings;

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Settings2, Bell, Shield, BookOpen, AlertCircle, RefreshCw } from 'lucide-react';

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/v1/settings', { withCredentials: true });
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: {
          ...prev[category]?.[key],
          value
        }
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const updates = [];
      // Collect unique keys to update
      const keySet = new Set();
      Object.keys(settings).forEach(cat => {
        Object.keys(settings[cat]).forEach(key => {
          if (!keySet.has(key)) {
            keySet.add(key);
            updates.push({
              key,
              value: settings[cat][key].value
            });
          }
        });
      });

      const res = await axios.put('/api/v1/settings', { settings: updates }, { withCredentials: true });
      if (res.data.success) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings2 },
    { id: 'library', label: 'Library Rules', icon: BookOpen },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  // Friendly display names for settings keys
  const getDisplayName = (key) => {
    const labels = {
      max_borrow_limit_student: 'Maximum Count of Books Can Borrow by Student (Single Month)',
      default_loan_period: 'Number of Days Limit for Return Book (Loan Period)',
      renew_days_ug: 'Renew Days Count for UG Student',
      renew_days_pg: 'Renew Days Count for PG Student',
      max_renewal_count: 'Maximum Renewal Count',
      daily_fine_rate: 'Fine Amount Option / Daily Fine Rate (₹ per day)',
      max_fine_amount: 'Maximum Fine Amount Cap (₹)',
      fine_grace_period_days: 'Fine Grace Period (Days)',
      library_name: 'Library Name',
      allow_student_self_renew: 'Allow Student Self-Renewal',
      overdue_reminder_days: 'Overdue Reminder Notice (Days Prior)',
    };
    return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Preferred display order for library rules
  const getOrderedKeys = (category) => {
    if (!settings[category]) return [];
    const keys = Object.keys(settings[category]);
    if (category === 'library') {
      const preferredOrder = [
        'max_borrow_limit_student',
        'default_loan_period',
        'renew_days_ug',
        'renew_days_pg',
        'max_renewal_count',
        'daily_fine_rate',
        'max_fine_amount',
        'fine_grace_period_days',
      ];
      return [
        ...preferredOrder.filter(k => keys.includes(k)),
        ...keys.filter(k => !preferredOrder.includes(k) && k !== 'max_checkout_limit' && k !== 'reservation_hold_days')
      ];
    }
    return keys;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">System Settings</h1>
            <p className="text-blue-100 text-sm">
              Configure library policies, fine rules, and general preferences.
            </p>
          </div>
          <Settings2 size={40} className="text-blue-200 opacity-80" />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="card-flat p-2">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="card-flat">
            <form onSubmit={handleSave}>
              <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-4">
                <h2 className="text-lg font-bold text-gray-900 capitalize">
                  {tabs.find(t => t.id === activeTab)?.label || activeTab} Settings
                </h2>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={fetchSettings}
                    className="btn btn-secondary px-3"
                    title="Reload Settings"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="btn btn-primary"
                  >
                    {saving ? 'Saving...' : (
                      <>
                        <Save size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-lg flex items-start gap-3 border border-red-200">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {success && (
                <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg flex items-start gap-3 border border-green-200">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{success}</p>
                </div>
              )}

              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="animate-pulse flex gap-4">
                      <div className="h-10 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-10 bg-gray-200 rounded flex-1"></div>
                    </div>
                  ))}
                </div>
              ) : activeTab === 'security' ? (
                <div className="py-6 text-sm text-gray-500 space-y-4">
                  <p>Security and authentication settings are configured per role and security policy.</p>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-gray-700">
                    <p className="font-semibold text-gray-900 mb-1">Active Security Protocols</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Role-Based Access Control (Admin, Librarian, Clerk, Student, Staff)</li>
                      <li>Encrypted session tokens & bcrypt password hashing</li>
                      <li>Rate limiting on sensitive endpoints enabled</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {!settings[activeTab] || Object.keys(settings[activeTab]).length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No settings available for this category.</p>
                  ) : (
                    getOrderedKeys(activeTab).map(key => {
                      const item = settings[activeTab][key];
                      if (!item) return null;

                      return (
                        <div key={key} className="form-group border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                          <label className="form-label mb-1">
                            {getDisplayName(key)}
                          </label>
                          {item.description && (
                            <p className="form-hint mb-2">{item.description}</p>
                          )}
                          
                          {item.type === 'boolean' ? (
                            <label className="relative inline-flex items-center cursor-pointer mt-1">
                              <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={item.value === 'true'}
                                onChange={(e) => handleChange(activeTab, key, e.target.checked ? 'true' : 'false')}
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          ) : key === 'daily_fine_rate' ? (
                            /* Fine Amount Option for Student (Not based on department) */
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  className="input max-w-md"
                                  value={item.value}
                                  onChange={(e) => handleChange(activeTab, key, e.target.value)}
                                />
                                <span className="text-xs text-gray-500">₹ / day</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">Fine options:</span>
                                {['1.00', '2.00', '5.00', '10.00'].map(amt => (
                                  <button
                                    key={amt}
                                    type="button"
                                    onClick={() => handleChange(activeTab, key, amt)}
                                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                      parseFloat(item.value) === parseFloat(amt)
                                        ? 'bg-blue-600 text-white border-blue-600 font-medium'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-300'
                                    }`}
                                  >
                                    ₹{parseFloat(amt)}/day
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : key === 'max_fine_amount' ? (
                            /* Max Fine Cap Options */
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  step="10"
                                  min="0"
                                  className="input max-w-md"
                                  value={item.value}
                                  onChange={(e) => handleChange(activeTab, key, e.target.value)}
                                />
                                <span className="text-xs text-gray-500">₹ Cap</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">Fine cap options:</span>
                                {[
                                  { label: '₹50', val: '50.00' },
                                  { label: '₹100', val: '100.00' },
                                  { label: '₹200', val: '200.00' },
                                  { label: 'No Cap', val: '0.00' },
                                ].map(opt => (
                                  <button
                                    key={opt.val}
                                    type="button"
                                    onClick={() => handleChange(activeTab, key, opt.val)}
                                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                      parseFloat(item.value) === parseFloat(opt.val)
                                        ? 'bg-blue-600 text-white border-blue-600 font-medium'
                                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-gray-300'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : item.type === 'number' ? (
                            <input
                              type="number"
                              className="input max-w-md"
                              value={item.value}
                              onChange={(e) => handleChange(activeTab, key, e.target.value)}
                            />
                          ) : (
                            <input
                              type="text"
                              className="input max-w-md"
                              value={item.value}
                              onChange={(e) => handleChange(activeTab, key, e.target.value)}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

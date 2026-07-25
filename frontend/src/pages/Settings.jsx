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
          ...prev[category][key],
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
      Object.keys(settings).forEach(cat => {
        Object.keys(settings[cat]).forEach(key => {
          updates.push({
            key,
            value: settings[cat][key].value
          });
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
                  {activeTab} Settings
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
              ) : (
                <div className="space-y-6">
                  {!settings[activeTab] || Object.keys(settings[activeTab]).length === 0 ? (
                    <p className="text-sm text-gray-500 py-4">No settings available for this category.</p>
                  ) : (
                    Object.keys(settings[activeTab]).map(key => {
                      const item = settings[activeTab][key];
                      return (
                        <div key={key} className="form-group border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                          <label className="form-label mb-1">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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

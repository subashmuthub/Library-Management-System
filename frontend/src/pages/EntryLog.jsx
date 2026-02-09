import React, { useState, useEffect } from 'react';
import { entryService } from '../services';
import { useAuth } from '../contexts';
import { LogIn, MapPin, Wifi, Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const EntryLog = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logData, setLogData] = useState({
    action: 'entry',
    latitude: '',
    longitude: '',
    wifi_ssid: '',
    motion_speed: '',
  });
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadHistory();
    // Get current location if available
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLogData({
            ...logData,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString(),
          });
        },
        (error) => console.error('Location error:', error)
      );
    }
  }, []);

  const loadHistory = async () => {
    try {
      const response = await entryService.getMyHistory();
      setHistory(response.entries || []);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        action: logData.action,
        gps_latitude: parseFloat(logData.latitude),
        gps_longitude: parseFloat(logData.longitude),
        wifi_ssid: logData.wifi_ssid || undefined,
        motion_speed_kmh: logData.motion_speed ? parseFloat(logData.motion_speed) : undefined,
      };

      const response = await entryService.logEntry(payload);
      setResult({ success: true, data: response });
      loadHistory();
      
      // Reset form
      setLogData({
        ...logData,
        action: 'entry',
        wifi_ssid: '',
        motion_speed: '',
      });
    } catch (error) {
      setResult({ 
        success: false, 
        error: error.response?.data?.message || 'Failed to log entry' 
      });
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceBadge = (score) => {
    if (score >= 80) return <span className="badge badge-success">High ({score}%)</span>;
    if (score >= 50) return <span className="badge badge-warning">Medium ({score}%)</span>;
    return <span className="badge badge-danger">Low ({score}%)</span>;
  };

  return (
    <div className="space-y-6">
      {/* Entry Form */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Log Entry/Exit</h2>
        
        {result && (
          <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <>
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-green-800 mb-1">Entry logged successfully!</p>
                  <p className="text-sm text-green-700">
                    Confidence Score: {result.data.confidence_score}%
                    {result.data.auto_logged && ' (Auto-logged)'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-700">{result.error}</p>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Action
            </label>
            <select
              className="input"
              value={logData.action}
              onChange={(e) => setLogData({ ...logData, action: e.target.value })}
              required
            >
              <option value="entry">Entry</option>
              <option value="exit">Exit</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-1" />
                Latitude
              </label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="37.7749"
                value={logData.latitude}
                onChange={(e) => setLogData({ ...logData, latitude: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-1" />
                Longitude
              </label>
              <input
                type="number"
                step="any"
                className="input"
                placeholder="-122.4194"
                value={logData.longitude}
                onChange={(e) => setLogData({ ...logData, longitude: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Wifi size={16} className="inline mr-1" />
              WiFi SSID (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="LibraryWiFi"
              value={logData.wifi_ssid}
              onChange={(e) => setLogData({ ...logData, wifi_ssid: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Activity size={16} className="inline mr-1" />
              Motion Speed (km/h, Optional)
            </label>
            <input
              type="number"
              step="any"
              className="input"
              placeholder="3.5"
              value={logData.motion_speed}
              onChange={(e) => setLogData({ ...logData, motion_speed: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Logging...' : 'Log Entry'}
          </button>
        </form>
      </div>

      {/* Entry History */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Your Entry History</h2>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((entry, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <LogIn size={20} className={entry.action === 'entry' ? 'text-green-600' : 'text-red-600'} />
                    <span className="font-medium capitalize">{entry.action}</span>
                  </div>
                  {getConfidenceBadge(entry.confidence_score)}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>
                    <MapPin size={14} className="inline mr-1" />
                    GPS: {entry.gps_latitude?.toFixed(4)}, {entry.gps_longitude?.toFixed(4)}
                  </p>
                  {entry.wifi_ssid && (
                    <p>
                      <Wifi size={14} className="inline mr-1" />
                      WiFi: {entry.wifi_ssid}
                    </p>
                  )}
                  {entry.motion_speed_kmh && (
                    <p>
                      <Activity size={14} className="inline mr-1" />
                      Speed: {entry.motion_speed_kmh} km/h
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {format(new Date(entry.timestamp), 'MMM dd, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No entry history available</p>
        )}
      </div>
    </div>
  );
};

export default EntryLog;

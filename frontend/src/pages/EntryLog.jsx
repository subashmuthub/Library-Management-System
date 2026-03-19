import React, { useState, useEffect } from 'react';
import { entryService } from '../services';
import { useAuth } from '../contexts';
import { LogIn, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const EntryLog = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState('entry');
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await entryService.getMyHistory(user?.id);
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
      let latitude = 0;
      let longitude = 0;

      if (navigator.geolocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
        }).catch(() => null);

        if (position?.coords) {
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        }
      }

      const payload = {
        entryType: action,
        latitude,
        longitude,
        userId: user?.id,
      };

      const response = await entryService.logEntry(payload);
      setResult({ success: true, data: response });
      loadHistory();
      setAction('entry');
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
        <h2 className="text-xl font-bold mb-4">Library Entry Confirmation</h2>
        
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
                    Confidence Score: {result.data.confidence?.total ?? result.data.entryLog?.confidenceScore ?? 0}%
                    {result.data.entryLog?.autoLogged && ' (Auto-logged)'}
                  </p>
                  <p className="text-sm text-green-700 mt-1">Came to library successfully. No manual form details required.</p>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)} required>
              <option value="entry">I came to library</option>
              <option value="exit">I left library</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Confirming...' : 'Confirm'}
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
                    <LogIn size={20} className={entry.entry_type === 'entry' ? 'text-green-600' : 'text-red-600'} />
                    <span className="font-medium capitalize">{entry.entry_type}</span>
                  </div>
                  {getConfidenceBadge(entry.confidence_score)}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p className="text-green-700">Entry success / came to library</p>
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

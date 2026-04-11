import React, { useState, useEffect } from 'react';
import { entryService } from '../services';
import { useAuth } from '../contexts';
import { LogIn, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

const EntryLog = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const policyMessage = sessionStorage.getItem('entry_policy_message');
    if (policyMessage) {
      setResult({ success: false, error: policyMessage });
      sessionStorage.removeItem('entry_policy_message');
    }
  }, []);

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

  const markLibraryEntry = async () => {
    setLoading(true);
    setResult(null);

    const submitEntry = async (latitude = 0, longitude = 0) => {
      try {
        const payload = {
          user_id: user?.id,
          entryType: 'entry',
          latitude,
          longitude,
          manualConfirm: true
        };

        const response = await entryService.logEntry(payload);
        setResult({ success: true, data: response });
        loadHistory();
      } catch (error) {
        setResult({
          success: false,
          error: error.response?.data?.message || 'Failed to log entry'
        });
      } finally {
        setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => submitEntry(position.coords.latitude, position.coords.longitude),
        () => submitEntry()
      );
    } else {
      submitEntry();
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Library Entry</h2>

        {result && (
          <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <>
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-green-800">Entry success</p>
                  <p className="text-sm text-green-700">You came to the library.</p>
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

        <button onClick={markLibraryEntry} className="btn btn-primary w-full" disabled={loading}>
          <LogIn size={18} className="inline mr-2" />
          {loading ? 'Marking entry...' : 'I Came To Library'}
        </button>
      </div>

      <div className="card">
        <h2 className="text-xl font-bold mb-4">Your Entry History</h2>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LogIn size={18} className="text-green-600" />
                    <span className="font-medium capitalize">{entry.entry_type || entry.entryType || 'entry'}</span>
                  </div>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {format(new Date(entry.timestamp), 'MMM dd, yyyy h:mm a')}
                  </span>
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

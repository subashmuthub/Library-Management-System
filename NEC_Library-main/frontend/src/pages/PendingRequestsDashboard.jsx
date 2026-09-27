import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, CheckCircle, XCircle, Search, 
  RefreshCw, Clock, User, BookOpen, AlertCircle, FileText, X
} from 'lucide-react';
import { reservationService } from '../services';
import { useAuth } from '../contexts';

const PendingRequestsDashboard = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Reject modal state
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await reservationService.getPendingRequests();
      setRequests(response.requests || response.data || []);
    } catch (error) {
      console.error('Failed to load pending research access requests:', error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || 'Failed to load requests. Please refresh.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleReview = async (id, action, reason = null) => {
    setProcessingId(id);
    setFeedback(null);
    try {
      const payload = { action };
      if (action === 'REJECT' && reason) {
        payload.rejection_reason = reason;
      }

      const res = await reservationService.reviewRequest(id, payload);
      setFeedback({
        type: 'success',
        message: res.message || `Request ${action.toLowerCase()}d successfully.`
      });

      // Remove or update the request in local state
      setRequests((prev) => prev.filter((r) => r.id !== id));
      if (rejectingRequest?.id === id) {
        setRejectingRequest(null);
        setRejectionReason('');
      }
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      setFeedback({
        type: 'error',
        message: error.response?.data?.message || `Failed to ${action.toLowerCase()} request.`
      });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const studentName = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase();
    const title = (r.title || '').toLowerCase();
    const studentId = (r.student_id || '').toLowerCase();
    const author = (r.author || '').toLowerCase();
    return (
      studentName.includes(term) ||
      title.includes(term) ||
      studentId.includes(term) ||
      author.includes(term)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-100 dark:border-gray-700/60 shadow-sm">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl border border-purple-500/20">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Research & ME Access Review
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Librarian approval gate for restricted thesis and research material borrow requests
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadRequests}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-2xl font-medium text-xs transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Advisory Banner */}
      <div className="p-4 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-2xl flex items-start space-x-3 text-purple-900 dark:text-purple-300 text-xs">
        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
        <div className="space-y-1">
          <p className="font-semibold">Institutional Research Lending Policy</p>
          <p className="text-purple-800/80 dark:text-purple-300/80">
            Titles marked "Restricted: Research & ME Paper" can be borrowed directly by Staff, ME Students, and Research Scholars. Regular UG students require verified academic justification (e.g. Capstone project, faculty-guided study) before checkout.
          </p>
        </div>
      </div>

      {/* Global feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center space-x-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle size={18} className="shrink-0" />
          ) : (
            <AlertCircle size={18} className="shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Search & Counter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by student or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Pending Approvals: <span className="text-purple-600 dark:text-purple-400 font-bold">{filteredRequests.length}</span>
        </div>
      </div>

      {/* Request Cards / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/60 text-gray-400 space-y-3">
          <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs">Loading pending requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700/60 text-center space-y-3">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-full">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            All clear!
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
            {searchTerm
              ? 'No pending requests matched your search query.'
              : 'There are currently no pending research title access requests awaiting review.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredRequests.map((req) => (
            <div
              key={req.id}
              className="bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/60 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                {/* Details */}
                <div className="flex-1 space-y-4">
                  {/* Top line badge & date */}
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                      Restricted: Research & ME Paper
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
                      <Clock size={13} className="mr-1" />
                      Requested: {new Date(req.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Student & Book info columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Student Info */}
                    <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        <User size={15} className="text-blue-500" />
                        <span>Requester (UG Student)</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {req.student_name || `${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Student'}
                        </p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {req.degree_type || 'BE'} - {req.department || 'CSE'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Student ID: <span className="font-mono text-gray-700 dark:text-gray-300">{req.student_id || 'N/A'}</span>
                        {req.academic_year && <span className="ml-2 font-medium text-slate-600 dark:text-slate-300">({req.academic_year})</span>}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Email: {req.student_email || req.email}
                      </p>
                    </div>

                    {/* Book Info */}
                    <div className="p-3.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center space-x-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                        <BookOpen size={15} className="text-purple-500" />
                        <span>Requested Title</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                        {req.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        Author: {req.author || 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        ISBN: <span className="font-mono text-gray-700 dark:text-gray-300">{req.isbn || 'N/A'}</span>
                        {req.call_number && ` • Call: ${req.call_number}`}
                      </p>
                    </div>
                  </div>

                  {/* Stated Purpose */}
                  <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
                      <FileText size={14} className="text-amber-600 dark:text-amber-400" />
                      <span>Academic Purpose / Justification:</span>
                    </div>
                    <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed italic">
                      "{req.reason || 'No justification entered.'}"
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-row lg:flex-col items-center gap-3 shrink-0 pt-2 lg:pt-0">
                  <button
                    onClick={() => handleReview(req.id, 'APPROVE')}
                    disabled={processingId === req.id}
                    className="flex-1 lg:w-36 flex items-center justify-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-semibold shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
                  >
                    {processingId === req.id ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle size={15} />
                        <span>Approve Access</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setRejectingRequest(req);
                      setRejectionReason('');
                    }}
                    disabled={processingId === req.id}
                    className="flex-1 lg:w-36 flex items-center justify-center space-x-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs font-semibold disabled:opacity-50 transition-all"
                  >
                    <XCircle size={15} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <XCircle size={20} className="text-red-500" />
                <span>Reject Access Request</span>
              </h3>
              <button
                onClick={() => setRejectingRequest(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-300">
              Rejecting request from <span className="font-semibold text-gray-900 dark:text-white">{rejectingRequest.first_name} {rejectingRequest.last_name}</span> for <span className="font-semibold text-gray-900 dark:text-white">"{rejectingRequest.title}"</span>.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Reason for Rejection (optional)
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Please consult with your departmental thesis advisor first, or title is currently under reservation for PG scholars..."
                className="w-full px-3 py-2.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReview(rejectingRequest.id, 'REJECT', rejectionReason.trim())}
                disabled={processingId === rejectingRequest.id}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-2xl shadow-md shadow-red-600/20"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRequestsDashboard;

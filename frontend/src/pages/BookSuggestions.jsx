import React, { useState, useEffect } from 'react';
import {
  BookPlus,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Search,
  BookOpen,
  User,
  Calendar,
  Sparkles,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { useAuth } from '../contexts';
import { suggestionService } from '../services';
import SuggestBookModal from '../components/SuggestBookModal';

const BookSuggestions = () => {
  const { user } = useAuth();
  const role = String(user?.role || user?.role_name || user?.role?.role_name || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isLibrarianOrAdmin = ['admin', 'librarian'].includes(role);

  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const response = await suggestionService.getSuggestions({ limit: 100 });
      setSuggestions(response.data?.suggestions || []);
    } catch (err) {
      console.error('Failed to load book suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      setActionLoadingId(id);
      await suggestionService.updateStatus(id, newStatus);
      // Optimistic update
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s))
      );
      setFeedbackMessage({
        type: 'success',
        text: `Suggestion #${id} has been marked as ${newStatus}.`,
      });
      setTimeout(() => setFeedbackMessage(null), 3500);
    } catch (err) {
      console.error('Failed to update status:', err);
      setFeedbackMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update status',
      });
      setTimeout(() => setFeedbackMessage(null), 3500);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredSuggestions = suggestions.filter((s) => {
    const statusNormalized = String(s.status || '').toUpperCase().trim();
    if (filterStatus !== 'ALL' && statusNormalized !== filterStatus) {
      return false;
    }
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      s.title?.toLowerCase().includes(query) ||
      s.author?.toLowerCase().includes(query) ||
      s.isbn?.toLowerCase().includes(query) ||
      s.requester_name?.toLowerCase().includes(query) ||
      s.student_id?.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter((s) => String(s.status || '').toUpperCase().trim() === 'PENDING').length,
    approved: suggestions.filter((s) => String(s.status || '').toUpperCase().trim() === 'APPROVED').length,
    rejected: suggestions.filter((s) => String(s.status || '').toUpperCase().trim() === 'REJECTED').length,
  };

  const getStatusBadge = (status) => {
    const normalized = String(status || '').toUpperCase().trim();
    switch (normalized) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 md:p-8 rounded-2xl shadow-sm border border-blue-500/20 text-white">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Library Procurement Pipeline</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {isLibrarianOrAdmin ? 'Book Suggestions Management' : 'Suggest a Book'}
          </h1>
          <p className="text-sm text-blue-100 max-w-2xl">
            {isLibrarianOrAdmin
              ? 'Review, approve, or reject student and staff book requests to guide upcoming library acquisitions.'
              : 'Cannot find a title in our library? Recommend books for university acquisition and track your request status.'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="self-start md:self-auto flex items-center space-x-2 px-5 py-3 bg-white hover:bg-blue-50 text-blue-700 font-semibold text-sm rounded-xl shadow-md transition-all shrink-0"
        >
          <BookPlus className="w-4 h-4" />
          <span>Suggest a Book</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`flex items-center space-x-3 p-4 rounded-xl border text-sm animate-in slide-in-from-top duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Stats Cards (For Librarian/Admin) */}
      {isLibrarianOrAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Suggestions</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-sm">
            <div className="text-xs text-amber-800 font-semibold uppercase tracking-wider">Pending Review</div>
            <div className="mt-2 text-2xl font-bold text-amber-900">{stats.pending}</div>
          </div>
          <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-sm">
            <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Approved for Purchase</div>
            <div className="mt-2 text-2xl font-bold text-emerald-900">{stats.approved}</div>
          </div>
          <div className="p-5 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-sm">
            <div className="text-xs text-rose-800 font-semibold uppercase tracking-wider">Rejected</div>
            <div className="mt-2 text-2xl font-bold text-rose-900">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, author, or student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-white transition"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                filterStatus === st
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="inline-block w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-medium">Loading book suggestions...</p>
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No suggestions found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {isLibrarianOrAdmin
              ? 'There are currently no book suggestions matching the selected filter.'
              : 'You have not submitted any book suggestions yet. Click "Suggest a Book" above to get started!'}
          </p>
        </div>
      ) : isLibrarianOrAdmin ? (
        /* Librarian Management Table */
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-sm">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-4 px-6">Book Details</th>
                <th className="py-4 px-6">Suggested By</th>
                <th className="py-4 px-6">Academic Justification</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuggestions.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{item.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">by {item.author}</div>
                    {item.isbn && (
                      <div className="text-xs font-mono text-blue-600 mt-1">ISBN: {item.isbn}</div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-800">{item.requester_name || 'Student'}</span>
                    </div>
                    {item.student_id && (
                      <div className="text-xs font-mono text-slate-500 ml-6">{item.student_id}</div>
                    )}
                    {item.requester_email && (
                      <div className="text-xs text-slate-500 ml-6">{item.requester_email}</div>
                    )}
                  </td>
                  <td className="py-4 px-6 max-w-xs">
                    <p className="text-xs text-slate-600 line-clamp-2 italic">
                      "{item.reason || 'No specific reason provided.'}"
                    </p>
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(item.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-4 px-6 whitespace-nowrap">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    {isAdmin ? (
                      String(item.status || '').toUpperCase().trim() === 'PENDING' ? (
                        <div className="inline-flex items-center space-x-2">
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'APPROVED')}
                            disabled={actionLoadingId === item.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'REJECTED')}
                            disabled={actionLoadingId === item.id}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStatusUpdate(item.id, 'PENDING')}
                          disabled={actionLoadingId === item.id}
                          className="text-xs text-slate-500 hover:text-slate-800 underline font-medium"
                        >
                          Reset to Pending
                        </button>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs">View Only (Admin Decision Required)</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Student Suggestion Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSuggestions.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between p-6 bg-white border border-slate-200 hover:border-blue-300 rounded-2xl shadow-sm hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">Author: {item.author}</p>
                  {item.isbn && (
                    <p className="text-xs font-mono text-blue-600 mt-0.5">ISBN: {item.isbn}</p>
                  )}
                </div>

                {item.reason && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">My Note: </span>
                    "{item.reason}"
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
                <span className="font-mono text-slate-400">ID #{item.id}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Suggest a Book Modal */}
      <SuggestBookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuggestionCreated={(newSuggestion) => {
          setSuggestions((prev) => [newSuggestion, ...prev]);
        }}
      />
    </div>
  );
};

export default BookSuggestions;

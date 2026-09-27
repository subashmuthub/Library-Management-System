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
  const role = String(user?.role || user?.role_name || '').toLowerCase();
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
      const params = {};
      if (filterStatus !== 'ALL') {
        params.status = filterStatus;
      }
      const response = await suggestionService.getSuggestions(params);
      setSuggestions(response.data?.suggestions || []);
    } catch (err) {
      console.error('Failed to load book suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, [filterStatus]);

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
    pending: suggestions.filter((s) => s.status === 'PENDING').length,
    approved: suggestions.filter((s) => s.status === 'APPROVED').length,
    rejected: suggestions.filter((s) => s.status === 'REJECTED').length,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5 mr-1" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-gray-900 via-indigo-950/40 to-gray-900 p-6 md:p-8 rounded-3xl border border-gray-800 shadow-xl">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Library Procurement Pipeline</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {isLibrarianOrAdmin ? 'Book Suggestions Management' : 'Suggest a Book'}
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            {isLibrarianOrAdmin
              ? 'Review, approve, or reject student and staff book requests to guide upcoming library acquisitions.'
              : 'Cannot find a title in our library? Recommend books for university acquisition and track your request status.'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="self-start md:self-auto flex items-center space-x-2 px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all"
        >
          <BookPlus className="w-4 h-4" />
          <span>Suggest a Book</span>
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMessage && (
        <div
          className={`flex items-center space-x-3 p-4 rounded-2xl border text-sm animate-in slide-in-from-top duration-200 ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Stats Cards (For Librarian/Admin) */}
      {isLibrarianOrAdmin && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-gray-900/60 border border-gray-800 rounded-2xl">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Suggestions</div>
            <div className="mt-2 text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="p-5 bg-gray-900/60 border border-amber-500/20 rounded-2xl">
            <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Pending Review</div>
            <div className="mt-2 text-2xl font-bold text-amber-300">{stats.pending}</div>
          </div>
          <div className="p-5 bg-gray-900/60 border border-emerald-500/20 rounded-2xl">
            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Approved for Purchase</div>
            <div className="mt-2 text-2xl font-bold text-emerald-300">{stats.approved}</div>
          </div>
          <div className="p-5 bg-gray-900/60 border border-rose-500/20 rounded-2xl">
            <div className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Rejected</div>
            <div className="mt-2 text-2xl font-bold text-rose-300">{stats.rejected}</div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gray-900/40 border border-gray-800/80 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search by title, author, or student..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/60 border border-gray-700/60 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">
          <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm">Loading book suggestions...</p>
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="p-12 text-center bg-gray-900/30 border border-gray-800/60 rounded-3xl">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No suggestions found</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            {isLibrarianOrAdmin
              ? 'There are currently no book suggestions matching the selected filter.'
              : 'You have not submitted any book suggestions yet. Click "Suggest a Book" above to get started!'}
          </p>
        </div>
      ) : isLibrarianOrAdmin ? (
        /* Librarian Management Table */
        <div className="overflow-x-auto bg-gray-900/60 border border-gray-800 rounded-3xl shadow-xl">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-800/50 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-800 font-semibold">
              <tr>
                <th className="py-4 px-6">Book Details</th>
                <th className="py-4 px-6">Suggested By</th>
                <th className="py-4 px-6">Academic Justification</th>
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {filteredSuggestions.map((item) => (
                <tr key={item.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-white">{item.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">by {item.author}</div>
                    {item.isbn && (
                      <div className="text-xs font-mono text-indigo-400/80 mt-1">ISBN: {item.isbn}</div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-200">{item.requester_name || 'Student'}</span>
                    </div>
                    {item.student_id && (
                      <div className="text-xs font-mono text-gray-500 ml-6">{item.student_id}</div>
                    )}
                    {item.requester_email && (
                      <div className="text-xs text-gray-500 ml-6">{item.requester_email}</div>
                    )}
                  </td>
                  <td className="py-4 px-6 max-w-xs">
                    <p className="text-xs text-gray-400 line-clamp-2 italic">
                      "{item.reason || 'No specific reason provided.'}"
                    </p>
                  </td>
                  <td className="py-4 px-6 text-xs text-gray-500 whitespace-nowrap">
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
                    {item.status === 'PENDING' ? (
                      <div className="inline-flex items-center space-x-2">
                        <button
                          onClick={() => handleStatusUpdate(item.id, 'APPROVED')}
                          disabled={actionLoadingId === item.id}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(item.id, 'REJECTED')}
                          disabled={actionLoadingId === item.id}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStatusUpdate(item.id, 'PENDING')}
                        disabled={actionLoadingId === item.id}
                        className="text-xs text-gray-500 hover:text-gray-300 underline"
                      >
                        Reset to Pending
                      </button>
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
              className="flex flex-col justify-between p-6 bg-gray-900/60 border border-gray-800 hover:border-gray-700/80 rounded-3xl shadow-lg transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <div>
                  <h3 className="text-base font-bold text-white leading-snug">{item.title}</h3>
                  <p className="text-xs text-gray-400 mt-1">Author: {item.author}</p>
                  {item.isbn && (
                    <p className="text-xs font-mono text-indigo-400/80 mt-0.5">ISBN: {item.isbn}</p>
                  )}
                </div>

                {item.reason && (
                  <div className="p-3 bg-gray-800/40 border border-gray-700/40 rounded-xl text-xs text-gray-300">
                    <span className="font-semibold text-gray-400">My Note: </span>
                    "{item.reason}"
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800/80 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
                <span className="font-mono text-gray-600">ID #{item.id}</span>
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

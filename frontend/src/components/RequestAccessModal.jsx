import React, { useState } from 'react';
import { ShieldAlert, X, Send, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { reservationService } from '../services';

const RequestAccessModal = ({ isOpen, onClose, book, onSuccess }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen || !book) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide your academic purpose or research justification.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await reservationService.requestAccess({
        book_id: book.id,
        reason: reason.trim(),
      });
      setSuccess(true);
      if (onSuccess) {
        onSuccess(response);
      }
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Error submitting research access request:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to submit access request. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Request Research Title Access
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Librarian approval gate for UG students
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Advisory Banner */}
        <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start space-x-3">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
            Restricted: This title is reserved for Research Scholars and ME Students. Normal students require prior Librarian approval.
          </p>
        </div>

        {/* Book Information Summary */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-2xl flex items-center space-x-3">
          <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {book.title}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              Author: {book.author || 'N/A'} {book.isbn ? `• ISBN: ${book.isbn}` : ''}
            </p>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Research / ME
          </span>
        </div>

        {/* Feedback states */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center space-x-3 text-red-600 dark:text-red-400 text-xs">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center space-x-3 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Your request has been submitted for Librarian review!</span>
          </div>
        )}

        {/* Request Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Academic Purpose / Research Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              placeholder="State your project topic, thesis subject, course module, or faculty recommendation justifying access to this restricted thesis / paper..."
              className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none"
              disabled={submitting || success}
              required
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Provide specific details. Submissions with clear academic justification are typically approved within 24 hours.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || success || !reason.trim()}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-semibold rounded-2xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Submitted</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Submit Access Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RequestAccessModal;

import React, { useState } from 'react';
import { BookPlus, X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { suggestionService } from '../services';

const SuggestBookModal = ({ isOpen, onClose, onSuggestionCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    isbn: '',
    reason: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.author.trim()) {
      setError('Please provide both the book title and author.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await suggestionService.createSuggestion(formData);
      setSuccess(true);
      setFormData({ title: '', author: '', isbn: '', reason: '' });
      if (onSuggestionCreated) {
        onSuggestionCreated(response.data);
      }
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error submitting book suggestion:', err);
      setError(
        err.response?.data?.message || 'Failed to submit suggestion. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl">
              <BookPlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Suggest a Book</h3>
              <p className="text-xs text-gray-400">Request a new addition to the campus library catalog</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-4 flex items-center space-x-2 p-3 bg-red-900/30 border border-red-500/30 text-red-300 rounded-xl text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-4 flex items-center space-x-2 p-3 bg-emerald-900/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>Suggestion submitted! Librarians will review your request.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Book Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Designing Data-Intensive Applications"
              required
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Author(s) <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              name="author"
              value={formData.author}
              onChange={handleChange}
              placeholder="e.g. Martin Kleppmann"
              required
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              ISBN (Optional)
            </label>
            <input
              type="text"
              name="isbn"
              value={formData.isbn}
              onChange={handleChange}
              placeholder="e.g. 9781449373320"
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm font-medium font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
              Reason / Academic Need (Optional)
            </label>
            <textarea
              name="reason"
              rows={3}
              value={formData.reason}
              onChange={handleChange}
              placeholder="e.g. Essential reference book for 3rd year Distributed Systems course..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700/60 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm resize-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting...' : 'Submit Suggestion'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuggestBookModal;

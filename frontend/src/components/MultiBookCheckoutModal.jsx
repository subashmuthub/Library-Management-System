import React, { useState, useMemo, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import {
  X,
  BookOpen,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  User,
  ShoppingBag,
} from 'lucide-react';
import { bookService, transactionService } from '../services';

const MultiBookCheckoutModal = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  isAdminOrLibrarian,
  initialBook = null,
  initialLoanDays = 14,
}) => {
  const [userId, setUserId] = useState('');
  const [bookInput, setBookInput] = useState('');
  const [cart, setCart] = useState([]);
  const [loanDays, setLoanDays] = useState(14);

  const [loadingBook, setLoadingBook] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Initialize or reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      const defaultId = currentUser?.id ? String(currentUser.id) : '';
      setUserId(defaultId);
      setBookInput('');
      if (initialBook && initialBook.id) {
        setCart([
          {
            id: initialBook.id,
            title: initialBook.title,
            author: initialBook.author || 'Unknown Author',
            isbn: initialBook.isbn || 'N/A',
            category: initialBook.category || '',
            is_restricted: Boolean(initialBook.is_restricted_research),
          },
        ]);
      } else {
        setCart([]);
      }
      setLoanDays(initialLoanDays || 14);
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, currentUser, initialBook, initialLoanDays]);

  // Real-time calculation of Return Due Date based on Loan Days
  const calculatedDueDate = useMemo(() => {
    const days = parseInt(loanDays, 10);
    const validDays = isNaN(days) || days < 1 ? 0 : days;
    const target = addDays(new Date(), validDays);
    return format(target, 'dd MMM yyyy');
  }, [loanDays]);

  if (!isOpen) return null;

  // Add book to checkout cart
  const handleAddBook = async (e) => {
    if (e) e.preventDefault();
    const identifier = bookInput.trim();
    if (!identifier) {
      setErrorMsg('Please enter a Book ID or Accession / ISBN number.');
      return;
    }

    setErrorMsg('');
    setLoadingBook(true);

    try {
      const res = await bookService.getBookById(identifier);
      const book = res?.book || res;

      if (!book || !book.id) {
        setErrorMsg(`Book #${identifier} not found in catalog.`);
        return;
      }

      // Check if already in current cart
      if (cart.some((item) => item.id === book.id)) {
        setErrorMsg(`"${book.title}" (ID: ${book.id}) is already in your checkout list.`);
        return;
      }

      // Check availability status
      if (book.status === 'checked_out' || book.is_available === false) {
        setErrorMsg(`"${book.title}" is currently checked out or unavailable.`);
        return;
      }

      // Add to cart
      setCart((prev) => [
        ...prev,
        {
          id: book.id,
          title: book.title,
          author: book.author || 'Unknown Author',
          isbn: book.isbn || 'N/A',
          category: book.category || '',
          is_restricted: Boolean(book.is_restricted_research),
        },
      ]);
      setBookInput('');
    } catch (err) {
      console.error('Failed to fetch book details:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        `Book #${identifier} could not be found or verified.`;
      setErrorMsg(msg);
    } finally {
      setLoadingBook(false);
    }
  };

  // Remove a book from the cart
  const handleRemoveBook = (bookId) => {
    setCart((prev) => prev.filter((item) => item.id !== bookId));
    setErrorMsg('');
  };

  // Execute batch checkout
  const handleProceedCheckout = async () => {
    const trimmedUserId = String(userId).trim();
    if (!trimmedUserId) {
      setErrorMsg('Please enter a valid User ID / Borrower ID.');
      return;
    }

    if (cart.length === 0) {
      setErrorMsg('Checkout list is empty. Add at least one book.');
      return;
    }

    const days = parseInt(loanDays, 10);
    if (isNaN(days) || days < 1) {
      setErrorMsg('Please specify a valid loan period in days (minimum 1 day).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        userId: trimmedUserId,
        bookIds: cart.map((b) => b.id),
        loanDays: days,
      };

      const res = await transactionService.checkoutBatch(payload);
      setSuccessMsg(
        res.message ||
          `Successfully checked out ${cart.length} book(s)! Return Due Date: ${calculatedDueDate}`
      );

      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Batch checkout failed:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Batch checkout failed. Please check borrowing limits and availability.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Multi-Book Checkout</h2>
              <p className="text-xs text-blue-100">
                Issue multiple books in a single batch transaction
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* User ID Field */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Borrower User ID / Student ID <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Enter User ID, Student ID, or Email"
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-800"
              />
            </div>
          </div>

          {/* Book Input & Add Button */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Book ID / Accession Number / ISBN <span className="text-red-500">*</span>
            </label>
            <form onSubmit={handleAddBook} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={bookInput}
                  onChange={(e) => {
                    setBookInput(e.target.value);
                    setErrorMsg('');
                  }}
                  placeholder="e.g. 1, 14, 978-0132350884"
                  className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-gray-800"
                  disabled={loadingBook || submitting}
                />
              </div>
              <button
                type="submit"
                disabled={loadingBook || submitting || !bookInput.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
              >
                {loadingBook ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add Book</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Books Cart Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Books to Checkout ({cart.length})
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length > 0 ? (
              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Book ID</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-3">Author</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {cart.map((book) => (
                        <tr key={book.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 text-xs">
                            #{book.id}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-gray-900 max-w-[200px] truncate" title={book.title}>
                            {book.title}
                            {book.is_restricted && (
                              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded font-medium">
                                Restricted
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[150px] truncate" title={book.author}>
                            {book.author}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveBook(book.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg inline-flex items-center gap-1 transition-colors"
                              title="Remove book from checkout list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center bg-gray-50/50">
                <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-1.5" />
                <p className="text-sm font-medium text-gray-500">
                  No books added yet
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enter a Book ID or Accession Number above to add books to this checkout session.
                </p>
              </div>
            )}
          </div>

          {/* Loan Days Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Loan Period (Days)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="180"
                  required
                  value={loanDays}
                  onChange={(e) => setLoanDays(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Quick Select
              </label>
              <div className="flex gap-2">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setLoanDays(d)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                      Number(loanDays) === d
                        ? 'bg-blue-50 border-blue-400 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic Prominent RED ALERT BOX for Return Due Date */}
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 shadow-sm flex items-center justify-between text-red-800 transition-all">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 rounded-lg text-red-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs uppercase font-extrabold tracking-wider text-red-600">
                  Return Due Date
                </div>
                <div className="text-base font-bold text-red-900 mt-0.5">
                  {calculatedDueDate}
                </div>
              </div>
            </div>
            <div className="text-xs font-semibold bg-red-100/80 text-red-700 px-2.5 py-1 rounded-full">
              {Number(loanDays) || 0} Days Loan
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
              <div className="font-medium">{errorMsg}</div>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-500" />
              <div className="font-semibold">{successMsg}</div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Total Books: <span className="font-bold text-gray-800">{cart.length}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProceedCheckout}
              disabled={submitting || cart.length === 0 || !String(userId).trim()}
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Proceed Checkout ({cart.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiBookCheckoutModal;

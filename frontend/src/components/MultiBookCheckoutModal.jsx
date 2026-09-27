import React, { useState, useEffect, useMemo } from 'react';
import { bookService } from '../services';
import { 
  BookOpen, 
  Calendar, 
  Plus, 
  Trash2, 
  X, 
  ShoppingCart, 
  AlertCircle, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';

const MultiBookCheckoutModal = ({
  isOpen,
  onClose,
  onSuccess,
  initialUserId = '',
  initialBook = null
}) => {
  const [userId, setUserId] = useState(initialUserId || '');
  const [bookInput, setBookInput] = useState('');
  const [loanDays, setLoanDays] = useState(14);
  const [cart, setCart] = useState([]);
  const [loadingBook, setLoadingBook] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Synchronize initial values when modal opens
  useEffect(() => {
    if (isOpen) {
      setUserId(initialUserId || '');
      setBookInput('');
      setLoanDays(14);
      setWarningMessage('');
      setSuccessMessage('');
      if (initialBook && initialBook.id) {
        setCart([initialBook]);
      } else {
        setCart([]);
      }
    }
  }, [isOpen, initialUserId, initialBook]);

  // Real-time calculated return due date (Current Date + Loan Days)
  const calculatedDueDate = useMemo(() => {
    const days = parseInt(loanDays, 10);
    const validDays = Number.isFinite(days) && days > 0 ? days : 14;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + validDays);
    return targetDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }, [loanDays]);

  if (!isOpen) return null;

  // Add book to cart by ID / Accession Number
  const handleAddBook = async (e) => {
    if (e) e.preventDefault();
    setWarningMessage('');
    setSuccessMessage('');

    const trimmedInput = bookInput.trim();
    if (!trimmedInput) {
      setWarningMessage('Please enter a Book ID or Accession Number.');
      return;
    }

    // Check if book already added to cart
    const isAlreadyAdded = cart.some(
      (b) => String(b.id) === trimmedInput || String(b.isbn) === trimmedInput
    );
    if (isAlreadyAdded) {
      setWarningMessage(`Book ID/Accession "${trimmedInput}" is already in your checkout cart.`);
      return;
    }

    setLoadingBook(true);
    try {
      let bookData = null;

      // 1. Try direct fetch by ID
      try {
        const response = await bookService.getBookById(trimmedInput);
        bookData = response?.book || response?.data?.book || response;
      } catch (err) {
        // 2. If not found by direct ID, search by ISBN / Title
        const searchRes = await bookService.getAllBooks({ search: trimmedInput, limit: 1 });
        const list = searchRes?.books || searchRes?.data || [];
        if (list.length > 0) {
          bookData = list[0];
        }
      }

      if (!bookData || !bookData.id) {
        setWarningMessage(`Invalid Book ID: "${trimmedInput}" was not found in library catalog.`);
        return;
      }

      // Check current availability
      const isAvailable = bookData.is_available === true || bookData.is_available === 1 || bookData.status === 'available';
      if (!isAvailable) {
        setWarningMessage(`Book "${bookData.title}" (ID: ${bookData.id}) is currently checked out or unavailable.`);
        return;
      }

      // Check if duplicate with resolved ID
      if (cart.some((b) => b.id === bookData.id)) {
        setWarningMessage(`Book "${bookData.title}" (ID: ${bookData.id}) is already in your cart.`);
        return;
      }

      setCart((prev) => [...prev, {
        id: bookData.id,
        title: bookData.title,
        author: bookData.author || 'Unknown Author',
        isbn: bookData.isbn || '',
        category: bookData.category || ''
      }]);
      setBookInput('');
      setWarningMessage('');
    } catch (error) {
      console.error('Failed to lookup book:', error);
      setWarningMessage('Failed to fetch book details. Please check the ID and try again.');
    } finally {
      setLoadingBook(false);
    }
  };

  // Remove a book from cart
  const handleRemoveBook = (bookId) => {
    setCart((prev) => prev.filter((b) => b.id !== bookId));
    setWarningMessage('');
  };

  // Batch checkout submission
  const handleProceedCheckout = async () => {
    setWarningMessage('');
    setSuccessMessage('');

    if (!userId.trim()) {
      setWarningMessage('Please enter a valid User ID to checkout books.');
      return;
    }

    if (cart.length === 0) {
      setWarningMessage('Please add at least one book to the cart.');
      return;
    }

    const parsedLoanDays = parseInt(loanDays, 10);
    if (!parsedLoanDays || parsedLoanDays <= 0) {
      setWarningMessage('Please provide a valid loan duration in days.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        userId: userId.trim(),
        bookIds: cart.map((b) => b.id),
        loanDays: parsedLoanDays
      };

      const result = await bookService.checkoutBatch(payload);

      if (result.success || result.status === 'success' || result.transactions) {
        setSuccessMessage(`Checkout completed successfully! ${cart.length} book(s) issued.`);
        if (onSuccess) {
          onSuccess(result);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setWarningMessage(result.message || result.error || 'Failed to complete checkout');
      }
    } catch (error) {
      console.error('Batch checkout error:', error);
      const errMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Batch checkout failed. Please verify user eligibility and try again.';
      setWarningMessage(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <ShoppingCart size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Multi-Book Cart Checkout</h2>
              <p className="text-xs text-blue-100">Add multiple items and issue together in one transaction</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
            aria-label="Close checkout modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          
          {/* Success Banner */}
          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Warning Banner */}
          {warningMessage && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-900 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-medium">{warningMessage}</span>
              </div>
            </div>
          )}

          {/* 1. User ID Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              User ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="input w-full border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter student or staff User ID (e.g. 4, UID-102)"
            />
          </div>

          {/* 2. Add Book Cart Input Workflow */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Book ID / Accession Number
            </label>
            <form onSubmit={handleAddBook} className="flex gap-2">
              <input
                type="text"
                className="input flex-1 border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm"
                value={bookInput}
                onChange={(e) => setBookInput(e.target.value)}
                placeholder="Enter Book ID or Accession (e.g. 101, 2)"
              />
              <button
                type="submit"
                disabled={loadingBook || !bookInput.trim()}
                className="btn bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors text-sm shadow-sm"
              >
                {loadingBook ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
                )}
                <span>Add Book</span>
              </button>
            </form>
          </div>

          {/* Cart Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="text-gray-500" />
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Checkout Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-xs text-gray-500 hover:text-red-600 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {cart.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-gray-500">Cart is empty</p>
                <p className="text-xs text-gray-400 mt-0.5">Enter a Book ID or Accession Number above to add items</p>
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100/75 text-gray-600 text-xs font-semibold uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-4 py-2.5">Book ID</th>
                      <th className="px-4 py-2.5">Title</th>
                      <th className="px-4 py-2.5">Author</th>
                      <th className="px-4 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cart.map((book) => (
                      <tr key={book.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded border border-gray-200">
                            #{book.id}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900 line-clamp-1">{book.title}</p>
                          {book.category && (
                            <span className="text-[11px] text-gray-400">{book.category}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                          <span className="line-clamp-1 text-sm">{book.author}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveBook(book.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded transition-colors"
                            title="Remove book from cart"
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Loan Days & Dynamic Red Return Date Alert */}
          <div className="space-y-2 pt-1">
            <label className="block text-sm font-semibold text-gray-700">
              Loan Days
            </label>
            <input
              type="number"
              min="1"
              max="90"
              required
              className="input w-full border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3 py-2 text-sm"
              value={loanDays}
              onChange={(e) => setLoanDays(e.target.value)}
              placeholder="14"
            />

            {/* Dynamic Prominent Red Alert Box */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 text-red-700 font-medium flex items-center justify-between shadow-sm transition-all">
              <div className="flex items-center gap-2">
                <Calendar className="text-red-600 flex-shrink-0" size={19} />
                <span className="text-sm font-bold text-red-800">Return Due Date:</span>
              </div>
              <span className="text-red-700 font-extrabold text-base tracking-wide bg-red-100/90 border border-red-200 px-3 py-1 rounded shadow-inner">
                {calculatedDueDate}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer / Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {cart.length} book(s) ready to checkout
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="btn bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || cart.length === 0 || !userId.trim()}
              onClick={handleProceedCheckout}
              className="btn bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg text-sm flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing Checkout...</span>
                </>
              ) : (
                <>
                  <ShoppingCart size={16} />
                  <span>Proceed Checkout</span>
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

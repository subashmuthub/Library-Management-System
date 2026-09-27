import React, { useState, useEffect, useRef } from 'react';
import { transactionService, bookService, userManagementService } from '../services';
import { useAuth } from '../contexts';
import { BookOpen, User, Calendar, CheckCircle, XCircle, Clock, RefreshCw, Scan, Zap, CheckCheck, Trash2, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const Transactions = () => {
  const { user } = useAuth();
  const userRole = String(user?.role || user?.role_name || user?.role?.role_name || '').toLowerCase();
  const normalizedRole = ['faculty', 'teacher', 'staff'].includes(userRole) ? 'staff' : userRole;
  const isAdminOrLibrarian = userRole === 'admin' || userRole === 'librarian';
  const studentIdentifier = user?.student_id || user?.studentId || (user?.id ? `UID-${user.id}` : 'N/A');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, issued, returned, overdue
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerInput, setScannerInput] = useState('');
  const [scannedReturns, setScannedReturns] = useState([]);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerSuccessMsg, setScannerSuccessMsg] = useState('');
  const scannerInputRef = useRef(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [renewDays, setRenewDays] = useState(14);
  const [returnForm, setReturnForm] = useState({
    condition: 'good',
    notes: ''
  });
  const [checkoutForm, setCheckoutForm] = useState({
    user_id: '',
    book_id: '',
    loan_days: 14
  });

  useEffect(() => {
    loadTransactions();
  }, [filter]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter === 'issued' ? 'issued' : filter } : {};
      if (userRole === 'student' && user?.id) {
        params.user_id = user.id;
      }
      const response = await transactionService.getAllTransactions(params);
      let data = response.transactions || response.data || response;
      if (!Array.isArray(data)) {
        data = [];
      }
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showScannerModal) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showScannerModal]);

  const handleScanSubmit = async (e) => {
    if (e) e.preventDefault();
    const identifier = scannerInput.trim();
    if (!identifier) return;

    setScannerLoading(true);
    setScannerError('');
    setScannerSuccessMsg('');

    try {
      const response = await transactionService.quickReturn({ identifier });
      const returnedBook = response.returned_book || {
        title: response.book_title || `Item ${identifier}`,
        return_date: new Date().toISOString(),
        fine_amount: response.fine_amount || 0,
        borrower_name: response.borrower_name || 'Borrower',
        is_fine_exempt: response.is_staff || false,
      };

      setScannedReturns((prev) => [returnedBook, ...prev]);
      setScannerSuccessMsg(`"${returnedBook.title}" returned successfully!`);
      setScannerInput('');
      loadTransactions();
    } catch (err) {
      console.error('Scan return failed:', err);
      setScannerError(
        err.response?.data?.message || err.response?.data?.error || `No active checkout found for "${identifier}"`
      );
      setScannerInput('');
    } finally {
      setScannerLoading(false);
      setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 50);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    try {
      await transactionService.checkoutBook({
        ...checkoutForm,
        user_id: !isAdminOrLibrarian ? user?.id : checkoutForm.user_id
      });
      alert('Book checked out successfully!');
      setShowCheckoutModal(false);
      setCheckoutForm({ user_id: user?.id ? String(user.id) : '', book_id: '', loan_days: 14 });
      loadTransactions();
    } catch (error) {
      alert(`Checkout failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`);
    }
  };

  const handleReturn = (transaction) => {
    setSelectedTransaction(transaction);
    setReturnForm({
      condition: 'good',
      notes: ''
    });
    setShowReturnModal(true);
  };

  const confirmReturn = async () => {
    if (!isAdminOrLibrarian) {
      alert('You have read-only access to transactions.');
      return;
    }
    try {
      const result = await transactionService.returnBook(selectedTransaction.id, returnForm);
      if (result.fine_amount > 0) {
        alert(`Book returned! Fine amount: $${result.fine_amount}`);
      } else {
        alert('Book returned successfully!');
      }
      setShowReturnModal(false);
      setSelectedTransaction(null);
      loadTransactions();
    } catch (error) {
      alert(`Return failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleRenew = (transaction) => {
    setSelectedTransaction(transaction);
    setRenewDays(14);
    setShowRenewModal(true);
  };

  const confirmRenew = async () => {
    if (!isAdminOrLibrarian) {
      alert('You have read-only access to transactions.');
      return;
    }
    try {
      await transactionService.renewBook(selectedTransaction.id, { renewDays: renewDays });
      alert('Book renewed successfully!');
      setShowRenewModal(false);
      setSelectedTransaction(null);
      loadTransactions();
    } catch (error) {
      alert(`Renewal failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const getNewDueDate = () => {
    if (!selectedTransaction?.due_date) return '';
    const currentDue = new Date(selectedTransaction.due_date);
    const newDue = new Date(currentDue);
    newDue.setDate(newDue.getDate() + parseInt(renewDays));
    return format(newDue, 'yyyy-MM-dd');
  };

  const getDaysOverdue = () => {
    if (!selectedTransaction?.due_date) return 0;
    const dueDate = new Date(selectedTransaction.due_date);
    const today = new Date();
    const diffTime = today - dueDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-blue-100 text-blue-700',
      returned: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
    };
    
    const labels = {
      active: 'ISSUED',
      returned: 'RETURNED',
      overdue: 'OVERDUE'
    };
    
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status?.toUpperCase()}
    </span>;
  };

  const parseDateValue = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDateDisplay = (value) => {
    const parsed = parseDateValue(value);
    return parsed ? format(parsed, 'dd MMM yyyy') : 'N/A';
  };

  const formatTimeDisplay = (value) => {
    const parsed = parseDateValue(value);
    return parsed ? format(parsed, 'hh:mm a') : '--';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{userRole === 'student' ? 'My Borrowing History' : 'Transactions'}</h1>
          <p className="text-gray-600">
            {userRole === 'student' ? 'Track your borrowed books, return dates, and fine statuses' : 'Manage book checkouts and returns'}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isAdminOrLibrarian && (
            <button
              onClick={() => {
                setShowScannerModal(true);
                setScannerError('');
                setScannerSuccessMsg('');
              }}
              className="btn bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex items-center shadow-lg shadow-emerald-500/20"
              title="Continuous Return Scanner Mode"
            >
              <Scan size={18} className="mr-2" />
              Continuous Return Scanner
            </button>
          )}
          {(isAdminOrLibrarian || normalizedRole === 'student' || normalizedRole === 'staff') && (
            <button
              onClick={() => {
                setCheckoutForm({ user_id: user?.id ? String(user.id) : '', book_id: '', loan_days: 14 });
                setShowCheckoutModal(true);
              }}
              className="btn btn-primary"
              title="Checkout a book"
            >
              <BookOpen size={20} className="mr-2" />
              Checkout Book
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2">
          {['all', 'issued', 'returned', 'overdue'].map(f => {
            const filterLabels = {
              all: 'All',
              issued: 'Issued',
              returned: 'Returned',
              overdue: 'Overdue'
            };
            
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded font-medium ${
                  filter === f 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filterLabels[f]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transactions List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">
            <Clock className="animate-spin mx-auto mb-2" size={32} />
            <p className="text-gray-500">Loading transactions...</p>
          </div>
        ) : transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  {isAdminOrLibrarian && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checkout Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  {!isAdminOrLibrarian && (
                    <>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fines</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  {isAdminOrLibrarian && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{transaction.id}</td>
                    {isAdminOrLibrarian && (
                      <td className="px-4 py-3 text-sm">{transaction.user_name || `User #${transaction.user_id}`}</td>
                    )}
                    <td className="px-4 py-3 text-sm">{transaction.title || `Book #${transaction.book_id}`}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="leading-tight">
                        <p className="font-medium text-slate-800">{formatDateDisplay(transaction.checkout_date)}</p>
                        <p className="text-xs text-slate-500">{formatTimeDisplay(transaction.checkout_date)}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="leading-tight">
                        <p className="font-medium text-slate-800">{formatDateDisplay(transaction.due_date)}</p>
                        <p className="text-xs text-slate-500">{formatTimeDisplay(transaction.due_date)}</p>
                      </div>
                    </td>
                    {!isAdminOrLibrarian && (
                      <>
                        <td className="px-4 py-3 text-sm">
                          {transaction.return_date ? (
                            <div className="leading-tight">
                              <p className="font-medium text-slate-800">{formatDateDisplay(transaction.return_date)}</p>
                              <p className="text-xs text-slate-500">{formatTimeDisplay(transaction.return_date)}</p>
                            </div>
                          ) : (
                            <span className="text-slate-400">Not returned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {Number(transaction.pending_fine) > 0 ? (
                            <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              ₹{transaction.pending_fine} Pending
                            </span>
                          ) : Number(transaction.paid_fine) > 0 ? (
                            <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ₹{transaction.paid_fine} Paid
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">{getStatusBadge(transaction.status)}</td>
                    {isAdminOrLibrarian && (
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {transaction.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleReturn(transaction)}
                                className="text-green-600 hover:text-green-700 font-medium"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => handleRenew(transaction)}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Renew
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No transactions found</p>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Checkout Book</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={checkoutForm.user_id}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, user_id: e.target.value })}
                  placeholder="Enter user ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Book ID</label>
                <input
                  type="number"
                  required
                  className="input w-full"
                  value={checkoutForm.book_id}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, book_id: e.target.value })}
                  placeholder="Enter book ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Loan Days</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="30"
                  className="input w-full"
                  value={checkoutForm.loan_days}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, loan_days: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Checkout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <RefreshCw size={24} className="mr-2 text-blue-500" />
              Renew Book
            </h2>
            
            <div className="space-y-4">
              {/* Transaction Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-start">
                  <BookOpen size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Book</p>
                    <p className="font-semibold">{selectedTransaction.title || `Book #${selectedTransaction.book_id}`}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <User size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Borrower</p>
                    <p className="font-semibold">{selectedTransaction.user_name || `User #${selectedTransaction.user_id}`}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Current Due Date</p>
                    <p className="font-semibold">{formatDateDisplay(selectedTransaction.due_date)}</p>
                    <p className="text-xs text-gray-500">{formatTimeDisplay(selectedTransaction.due_date)}</p>
                  </div>
                </div>
              </div>

              {/* Renewal Options */}
              <div>
                <label className="block text-sm font-medium mb-2">Extend by (days)</label>
                <select
                  className="input w-full"
                  value={renewDays}
                  onChange={(e) => setRenewDays(parseInt(e.target.value))}
                >
                  <option value="7">7 days</option>
                  <option value="14">14 days (Standard)</option>
                  <option value="21">21 days</option>
                  <option value="30">30 days</option>
                </select>
              </div>

              {/* New Due Date */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-sm text-blue-600 mb-1">New Due Date</p>
                <p className="text-lg font-bold text-blue-700">{getNewDueDate()}</p>
              </div>

              {/* Renewal Info */}
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                <p className="font-medium mb-1">⚠️ Renewal Policy</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Maximum 2 renewals per transaction</li>
                  <li>Cannot renew if book is reserved by others</li>
                  <li>Late fees must be cleared before renewal</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowRenewModal(false);
                    setSelectedTransaction(null);
                  }}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmRenew} 
                  className="btn btn-primary flex items-center"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Confirm Renewal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <CheckCircle size={24} className="mr-2 text-green-500" />
              Return Book
            </h2>
            
            <div className="space-y-4">
              {/* Transaction Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-start">
                  <BookOpen size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Book</p>
                    <p className="font-semibold">{selectedTransaction.title || `Book #${selectedTransaction.book_id}`}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <User size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Borrower</p>
                    <p className="font-semibold">{selectedTransaction.user_name || `User #${selectedTransaction.user_id}`}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Checkout Date</p>
                    <p className="font-semibold">{formatDateDisplay(selectedTransaction.checkout_date)}</p>
                    <p className="text-xs text-gray-500">{formatTimeDisplay(selectedTransaction.checkout_date)}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Calendar size={18} className="mr-2 mt-0.5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-600">Due Date</p>
                    <p className="font-semibold">{formatDateDisplay(selectedTransaction.due_date)}</p>
                    <p className="text-xs text-gray-500">{formatTimeDisplay(selectedTransaction.due_date)}</p>
                  </div>
                </div>
              </div>

              {/* Overdue Warning */}
              {getDaysOverdue() > 0 && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
                  <p className="text-sm text-red-600 mb-1">⚠️ Overdue by {getDaysOverdue()} day(s)</p>
                  <p className="text-xs text-red-600">Late fees may apply</p>
                </div>
              )}

              {/* Book Condition */}
              <div>
                <label className="block text-sm font-medium mb-2">Book Condition</label>
                <select
                  className="input w-full"
                  value={returnForm.condition}
                  onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                >
                  <option value="excellent">Excellent - Like new</option>
                  <option value="good">Good - Normal wear</option>
                  <option value="fair">Fair - Visible wear</option>
                  <option value="poor">Poor - Damaged</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  className="input w-full"
                  rows="3"
                  placeholder="Add any notes about the return..."
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                />
              </div>

              {/* Return Info */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-blue-800">
                <p className="font-medium mb-1">ℹ️ Return Information</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Book will be marked as available</li>
                  <li>Outstanding fines will be calculated</li>
                  <li>Return date: {format(new Date(), 'yyyy-MM-dd')}</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReturnModal(false);
                    setSelectedTransaction(null);
                  }}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmReturn} 
                  className="btn bg-green-600 hover:bg-green-700 text-white flex items-center"
                >
                  <CheckCircle size={18} className="mr-2" />
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Continuous Return Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Scanner Header */}
            <div className="p-6 bg-gradient-to-r from-gray-900 via-emerald-950/40 to-gray-900 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl animate-pulse">
                  <Scan className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-bold text-white">Bulk Continuous Return Scanner</h3>
                    <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1" />
                      Live Mode
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Scan RFID tag, ISBN, or Transaction ID. The scanner auto-processes on Enter and stays focused.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scanner Input Form */}
            <div className="p-6 space-y-4 border-b border-gray-800 bg-gray-950/50">
              <form onSubmit={handleScanSubmit} className="relative">
                <div className="relative">
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    placeholder="Scan barcode / RFID or type ISBN & hit Enter..."
                    disabled={scannerLoading}
                    className="w-full pl-5 pr-28 py-4 bg-gray-900/90 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-lg font-mono tracking-wider transition-all"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={scannerLoading || !scannerInput.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-sm transition-all disabled:opacity-50 flex items-center space-x-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <Zap className="w-4 h-4" />
                    <span>{scannerLoading ? 'Returning...' : 'Return'}</span>
                  </button>
                </div>
              </form>

              {/* Status Alerts */}
              {scannerError && (
                <div className="flex items-center space-x-2 p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 rounded-xl text-sm animate-in slide-in-from-top-1">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{scannerError}</span>
                </div>
              )}

              {scannerSuccessMsg && (
                <div className="flex items-center space-x-2 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm animate-in slide-in-from-top-1">
                  <CheckCheck className="w-5 h-5 flex-shrink-0" />
                  <span>{scannerSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Scanned Returns History */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                    Scanned in this Session
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {scannedReturns.length}
                  </span>
                </div>
                {scannedReturns.length > 0 && (
                  <button
                    onClick={() => setScannedReturns([])}
                    className="flex items-center space-x-1 text-xs text-gray-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear History</span>
                  </button>
                )}
              </div>

              {scannedReturns.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-gray-800 rounded-2xl text-gray-500 text-sm">
                  Ready to scan. Present a book barcode or RFID tag to begin continuous return.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {scannedReturns.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 bg-gray-800/40 border border-gray-700/50 rounded-2xl hover:border-gray-600 transition-all"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{item.title}</p>
                          <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <span>Borrower: <strong className="text-gray-300">{item.borrower_name}</strong></span>
                            {item.isbn && <span>• ISBN: <span className="font-mono">{item.isbn}</span></span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        {item.is_fine_exempt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Staff (Exempt)
                          </span>
                        ) : item.fine_amount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Fine: ₹{item.fine_amount}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            No Fine
                          </span>
                        )}
                        <p className="text-[10px] text-gray-500 mt-1">
                          {format(new Date(item.return_date), 'hh:mm:ss a')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setShowScannerModal(false)}
                className="btn bg-gray-800 hover:bg-gray-700 text-white text-sm px-6 py-2 rounded-xl"
              >
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;

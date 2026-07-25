import React, { useState, useEffect } from 'react';
import { transactionService, bookService, userManagementService } from '../services';
import { useAuth } from '../contexts';
import { BookOpen, User, Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const Transactions = () => {
  const { user } = useAuth();
  const userRole = String(user?.role || user?.role_name || user?.role?.role_name || '').toLowerCase();
  const isAdminOrLibrarian = userRole === 'admin' || userRole === 'librarian';
  const studentIdentifier = user?.student_id || user?.studentId || (user?.id ? `UID-${user.id}` : 'N/A');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, issued, returned, overdue
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
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
      alert(`Checkout failed: ${error.response?.data?.error || error.message}`);
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
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-gray-600">Manage book checkouts and returns</p>
        </div>
        {isAdminOrLibrarian && (
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checkout Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map(transaction => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{transaction.id}</td>
                    <td className="px-4 py-3 text-sm">{transaction.user_name || `User #${transaction.user_id}`}</td>
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
                    <td className="px-4 py-3">{getStatusBadge(transaction.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {transaction.status === 'active' && isAdminOrLibrarian && (
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
    </div>
  );
};

export default Transactions;

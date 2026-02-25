import React, { useState, useEffect } from 'react';
import { transactionService, bookService, userManagementService } from '../services';
import { BookOpen, User, Calendar, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all'); // all, active, returned, overdue
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
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
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await transactionService.getAllTransactions(params);
      setTransactions(response.transactions || response.data || []);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    try {
      await transactionService.checkoutBook(checkoutForm);
      alert('Book checked out successfully!');
      setShowCheckoutModal(false);
      setCheckoutForm({ user_id: '', book_id: '', loan_days: 14 });
      loadTransactions();
    } catch (error) {
      alert(`Checkout failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleReturn = async (transactionId) => {
    if (confirm('Are you sure you want to return this book?')) {
      try {
        const result = await transactionService.returnBook(transactionId, {
          condition: 'good',
          notes: 'Returned via web interface'
        });
        if (result.fine_amount > 0) {
          alert(`Book returned! Fine amount: $${result.fine_amount}`);
        } else {
          alert('Book returned successfully!');
        }
        loadTransactions();
      } catch (error) {
        alert(`Return failed: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const handleRenew = async (transactionId) => {
    try {
      await transactionService.renewBook(transactionId, { renew_days: 14 });
      alert('Book renewed successfully!');
      loadTransactions();
    } catch (error) {
      alert(`Renewal failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-blue-100 text-blue-700',
      returned: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.toUpperCase()}
    </span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-gray-600">Manage book checkouts and returns</p>
        </div>
        <button
          onClick={() => setShowCheckoutModal(true)}
          className="btn btn-primary"
        >
          <BookOpen size={20} className="mr-2" />
          Checkout Book
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2">
          {['all', 'active', 'returned', 'overdue'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded font-medium ${
                filter === f 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
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
                    <td className="px-4 py-3 text-sm">{transaction.checkout_date}</td>
                    <td className="px-4 py-3 text-sm">{transaction.due_date}</td>
                    <td className="px-4 py-3">{getStatusBadge(transaction.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {transaction.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleReturn(transaction.id)}
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              Return
                            </button>
                            <button
                              onClick={() => handleRenew(transaction.id)}
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
                  type="number"
                  required
                  className="input w-full"
                  value={checkoutForm.user_id}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, user_id: e.target.value })}
                  placeholder="Enter user ID (4-8 for test students)"
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
                  placeholder="Enter book ID (1-25 available)"
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
    </div>
  );
};

export default Transactions;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { transactionService, circulationService } from '../services';
import { useAuth } from '../contexts';
import {
  BookOpen,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Scan,
  AlertCircle,
  Search,
  Building2,
  Tag,
  ArrowUpDown,
  Filter,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCheck,
  Barcode
} from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';
import MultiBookCheckoutModal from '../components/MultiBookCheckoutModal';

const CirculationReturns = () => {
  const { user } = useAuth();
  const userRole = String(user?.role || user?.role_name || user?.role?.role_name || '').toLowerCase();
  const normalizedRole = ['faculty', 'teacher', 'staff'].includes(userRole) ? 'staff' : userRole;
  
  // Circulation desk staff check: admin, librarian, clerk, staff have global desk visibility
  const isCirculationStaff = ['admin', 'librarian', 'clerk', 'staff'].includes(userRole);
  const isStudent = userRole === 'student' || (!isCirculationStaff && userRole !== 'admin');

  // Transactions state
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Active Tab Filter: 'ALL' | 'ISSUED' | 'RETURNED' | 'OVERDUE'
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Scanner state
  const [scannerInput, setScannerInput] = useState('');
  const [scannedReturns, setScannedReturns] = useState([]);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scannerSuccessMsg, setScannerSuccessMsg] = useState('');
  const scannerInputRef = useRef(null);

  // Active selected transaction for actions
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [renewDays, setRenewDays] = useState(14);
  const [actionLoading, setActionLoading] = useState(false);
  const [returnForm, setReturnForm] = useState({
    condition: 'good',
    notes: '',
  });

  // Re-fetch transactions on mount and tab changes
  useEffect(() => {
    loadTransactions();
  }, [activeTab]);

  // Focus scanner input when modal opens
  useEffect(() => {
    if (showScannerModal) {
      const timer = setTimeout(() => {
        scannerInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showScannerModal]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== 'ALL') {
        params.status = activeTab.toLowerCase();
      }
      if (isStudent && user?.id) {
        params.user_id = user.id;
      }
      
      const response = await transactionService.getAllTransactions(params);
      let data = response.transactions || response.data || response;
      if (!Array.isArray(data)) {
        data = [];
      }
      setTransactions(data);
    } catch (error) {
      console.error('Failed to load circulation transactions:', error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Continuous barcode/RFID return scan
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
      await loadTransactions();
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

  // Open return modal
  const handleOpenReturnModal = (tx) => {
    setSelectedTransaction(tx);
    setReturnForm({
      condition: 'good',
      notes: '',
    });
    setShowReturnModal(true);
  };

  // Submit book return
  const confirmReturn = async () => {
    if (!selectedTransaction) return;
    if (!isCirculationStaff) {
      alert('You have read-only access to transactions.');
      return;
    }

    setActionLoading(true);
    try {
      const result = await transactionService.returnBook(selectedTransaction.id, returnForm);
      if (result.fine_amount > 0) {
        alert(`Book returned! An overdue fine of ₹${result.fine_amount} has been logged.`);
      } else {
        alert('Book returned successfully!');
      }
      setShowReturnModal(false);
      setSelectedTransaction(null);
      await loadTransactions();
    } catch (error) {
      alert(`Return failed: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Open renew modal
  const handleOpenRenewModal = (tx) => {
    setSelectedTransaction(tx);
    setRenewDays(14);
    setShowRenewModal(true);
  };

  // Submit book renewal
  const confirmRenew = async () => {
    if (!selectedTransaction) return;
    if (!isCirculationStaff) {
      alert('You have read-only access to transactions.');
      return;
    }

    setActionLoading(true);
    try {
      await transactionService.renewBook(selectedTransaction.id, { renewDays: Number(renewDays) });
      alert('Book loan successfully renewed!');
      setShowRenewModal(false);
      setSelectedTransaction(null);
      await loadTransactions();
    } catch (error) {
      alert(`Renewal failed: ${error.response?.data?.error || error.response?.data?.message || error.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper date parsing and formatting
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

  // Client-side search filtering across multiple fields
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const q = searchQuery.toLowerCase().trim();
    return transactions.filter((t) => {
      const titleMatch = t.title?.toLowerCase().includes(q);
      const authorMatch = t.author?.toLowerCase().includes(q);
      const userMatch = (t.user_name || t.name)?.toLowerCase().includes(q);
      const studentIdMatch = (t.student_id || t.roll_no)?.toLowerCase().includes(q);
      const emailMatch = t.email?.toLowerCase().includes(q);
      const accMatch = t.accession_no?.toLowerCase().includes(q);
      const deptMatch = t.department?.toLowerCase().includes(q);
      const idMatch = String(t.id).includes(q);
      return (
        titleMatch ||
        authorMatch ||
        userMatch ||
        studentIdMatch ||
        emailMatch ||
        accMatch ||
        deptMatch ||
        idMatch
      );
    });
  }, [transactions, searchQuery]);

  // Statistics calculation for summary cards
  const stats = useMemo(() => {
    const total = transactions.length;
    const issued = transactions.filter((t) => !t.return_date).length;
    const returned = transactions.filter((t) => Boolean(t.return_date)).length;
    const overdue = transactions.filter(
      (t) => !t.return_date && new Date(t.due_date) < new Date()
    ).length;
    return { total, issued, returned, overdue };
  }, [transactions]);

  // Status Badge Helper
  const getStatusBadge = (transaction) => {
    const isReturned = Boolean(transaction.return_date);
    const isOverdue = !isReturned && new Date(transaction.due_date) < new Date();

    if (isReturned) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle size={12} className="mr-1" />
          RETURNED
        </span>
      );
    }
    if (isOverdue) {
      const daysOverdue = Math.max(1, differenceInCalendarDays(new Date(), new Date(transaction.due_date)));
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
          <AlertCircle size={12} className="mr-1" />
          OVERDUE ({daysOverdue}d)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
        <Clock size={12} className="mr-1" />
        ISSUED
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isStudent ? 'My Borrowing & Circulation History' : 'Circulation & Returns Desk'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
              {userRole} view
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isStudent
              ? 'Review your checked out titles, return countdowns, and historical borrowing receipts'
              : 'Global circulation ledger, real-time book checkout tracking, and instant returns processing'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadTransactions}
            className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            title="Refresh Transactions"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          {isCirculationStaff && (
            <button
              onClick={() => {
                setShowScannerModal(true);
                setScannerError('');
                setScannerSuccessMsg('');
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium rounded-xl text-sm shadow-sm flex items-center transition"
              title="Continuous Barcode / RFID Return Scanner"
            >
              <Scan size={18} className="mr-2" />
              Return Scanner
            </button>
          )}

          {isCirculationStaff && (
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm shadow-sm flex items-center transition"
            >
              <BookOpen size={18} className="mr-2" />
              New Checkout
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Records</p>
            <h3 className="text-2xl font-bold text-slate-900">{stats.total}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Currently Issued</p>
            <h3 className="text-2xl font-bold text-indigo-600">{stats.issued}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Items</p>
            <h3 className="text-2xl font-bold text-rose-600">{stats.overdue}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Returned</p>
            <h3 className="text-2xl font-bold text-emerald-600">{stats.returned}</h3>
          </div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Transactions', count: stats.total },
            { id: 'ISSUED', label: 'Issued (Active)', count: stats.issued },
            { id: 'OVERDUE', label: 'Overdue Books', count: stats.overdue },
            { id: 'RETURNED', label: 'Returned', count: stats.returned },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input Box */}
        <div className="relative min-w-[280px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student, book, accession #..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Clock className="animate-spin mx-auto text-indigo-600 mb-3" size={32} />
            <p className="text-slate-500 text-sm font-medium">Loading circulation records...</p>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Tx ID</th>
                  {isCirculationStaff && <th className="px-5 py-3.5">Patron / Student</th>}
                  <th className="px-5 py-3.5">Book Title & Details</th>
                  <th className="px-5 py-3.5">Checkout Date</th>
                  <th className="px-5 py-3.5">Due Date</th>
                  <th className="px-5 py-3.5">Return Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  {isCirculationStaff && <th className="px-5 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTransactions.map((tx) => {
                  const isReturned = Boolean(tx.return_date);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition">
                      {/* TX ID */}
                      <td className="px-5 py-4 whitespace-nowrap font-mono text-xs text-slate-500">
                        #{tx.id}
                      </td>

                      {/* Patron Info (Circulation Staff only) */}
                      {isCirculationStaff && (
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-900">
                            {tx.user_name || tx.name || `User #${tx.user_id}`}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500">
                            {tx.roll_no || tx.student_id ? (
                              <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {tx.roll_no || tx.student_id}
                              </span>
                            ) : null}
                            {tx.department && (
                              <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[11px] font-medium border border-indigo-100">
                                {tx.department}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Book Details */}
                      <td className="px-5 py-4 max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1">
                          {tx.title || `Book #${tx.book_id}`}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{tx.author || 'Author N/A'}</span>
                          {tx.accession_no && (
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono border border-slate-200 text-[11px]">
                              {tx.accession_no}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Checkout Date */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">
                          {formatDateDisplay(tx.issued_date || tx.checkout_date)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatTimeDisplay(tx.issued_date || tx.checkout_date)}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{formatDateDisplay(tx.due_date)}</div>
                        <div className="text-xs text-slate-400">{formatTimeDisplay(tx.due_date)}</div>
                      </td>

                      {/* Return Date */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {tx.return_date ? (
                          <div>
                            <div className="font-medium text-slate-800">{formatDateDisplay(tx.return_date)}</div>
                            <div className="text-xs text-slate-400">{formatTimeDisplay(tx.return_date)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Pending Return</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">{getStatusBadge(tx)}</td>

                      {/* Actions for Staff */}
                      {isCirculationStaff && (
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          {!isReturned ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenReturnModal(tx)}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => handleOpenRenewModal(tx)}
                                className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                              >
                                Renew
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Settled</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center">
            <BookOpen size={48} className="mx-auto text-slate-300 mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No circulation records found</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No transactions match "${searchQuery}" under the selected tab filter.`
                : 'No book checkout or return activity recorded in this category yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Return Modal */}
      {showReturnModal && selectedTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <CheckCircle className="text-emerald-600" size={20} />
                <h3 className="font-bold text-slate-900 text-lg">Process Book Return</h3>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <p className="font-semibold text-slate-900">{selectedTransaction.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Borrower: {selectedTransaction.user_name || selectedTransaction.name}
                </p>
                <p className="text-xs text-slate-500">
                  Due: {formatDateDisplay(selectedTransaction.due_date)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Physical Condition
                </label>
                <select
                  value={returnForm.condition}
                  onChange={(e) => setReturnForm({ ...returnForm, condition: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="good">Good (Ready for shelf)</option>
                  <option value="fair">Fair (Normal wear)</option>
                  <option value="damaged">Damaged (Needs repair/fee)</option>
                  <option value="lost">Lost Item</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Desk Notes (Optional)
                </label>
                <textarea
                  value={returnForm.notes}
                  onChange={(e) => setReturnForm({ ...returnForm, notes: e.target.value })}
                  placeholder="e.g., Returned at counter with all pages intact"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmReturn}
                  className="px-5 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Confirm Return & Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && selectedTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <RefreshCw className="text-blue-600" size={20} />
                <h3 className="font-bold text-slate-900 text-lg">Extend Loan Duration</h3>
              </div>
              <button
                onClick={() => setShowRenewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">
                <p className="font-semibold text-slate-900">{selectedTransaction.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Current Due: {formatDateDisplay(selectedTransaction.due_date)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Extension Days
                </label>
                <select
                  value={renewDays}
                  onChange={(e) => setRenewDays(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7 Days Extension</option>
                  <option value={14}>14 Days Extension (Standard)</option>
                  <option value={21}>21 Days Extension</option>
                  <option value={30}>30 Days Extension</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRenewModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={confirmRenew}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {actionLoading ? 'Renewing...' : 'Extend Loan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continuous Return Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Scan className="text-emerald-600" size={22} />
                <h3 className="font-bold text-slate-900 text-lg">Continuous Return Scanner</h3>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleScanSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Scan Barcode / RFID Tag / ISBN
                </label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    placeholder="Scan or enter book barcode..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              {scannerLoading && (
                <div className="p-3 bg-blue-50 text-blue-700 text-xs font-medium rounded-xl flex items-center">
                  <Clock size={14} className="animate-spin mr-2" />
                  Processing scan...
                </div>
              )}

              {scannerSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200">
                  {scannerSuccessMsg}
                </div>
              )}

              {scannerError && (
                <div className="p-3 bg-rose-50 text-rose-800 text-xs font-semibold rounded-xl border border-rose-200">
                  {scannerError}
                </div>
              )}

              {scannedReturns.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-2">
                    Scanned in this session ({scannedReturns.length})
                  </p>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50">
                    {scannedReturns.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-white rounded-lg border border-slate-200 text-xs flex items-center justify-between"
                      >
                        <span className="font-medium text-slate-900 truncate max-w-[240px]">
                          {item.title}
                        </span>
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                          Returned
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Done Scanning
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MultiBook Checkout Modal */}
      <MultiBookCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onSuccess={() => {
          setShowCheckoutModal(false);
          loadTransactions();
        }}
        currentUser={user}
        isAdminOrLibrarian={isCirculationStaff}
      />
    </div>
  );
};

export default CirculationReturns;

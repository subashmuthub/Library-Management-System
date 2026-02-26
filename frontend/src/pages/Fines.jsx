import React, { useState, useEffect } from 'react';
import { fineService } from '../services';
import { DollarSign, CheckCircle, XCircle, Clock, AlertCircle, Receipt, Download } from 'lucide-react';
import PaymentModal from '../components/PaymentModal';

const Fines = () => {
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('pending'); // pending, paid, waived, all
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_paid: 0,
    total_waived: 0,
    pending_count: 0
  });

  useEffect(() => {
    loadFines();
    loadStats();
    loadPaymentHistory();
  }, [filter]);

  const loadFines = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await fineService.getPendingFines(params);
      setFines(response.fines || response.data || []);
    } catch (error) {
      console.error('Failed to load fines:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fineService.getStatistics();
      const statsData = response.overall_statistics || response.data?.overall_statistics || {};
      setStats({
        total_pending: parseFloat(statsData.pending_amount || 0),
        total_paid: parseFloat(statsData.collected_amount || 0),
        total_waived: parseFloat(statsData.waived_amount || 0),
        pending_count: statsData.pending_count || 0
      });
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/v1/fines/payments/history?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      console.log('Payment history response:', data);
      if (data.success) {
        setPaymentHistory(data.receipts || data.data || []);
      } else if (data.receipts) {
        setPaymentHistory(data.receipts);
      }
    } catch (error) {
      console.error('Failed to load payment history:', error);
      setPaymentHistory([]);
    }
  };

  const handlePayFine = (fine) => {
    setSelectedFine(fine);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (paymentData) => {
    setShowPaymentModal(false);
    setSelectedFine(null);
    loadFines();
    loadStats();
    loadPaymentHistory();
    alert('Payment successful! Receipt generated.');
  };

  const handleWaiveFine = async (fineId) => {
    const reason = prompt('Enter reason for waiving this fine:');
    if (reason) {
      try {
        await fineService.waiveFine(fineId, { reason });
        alert('Fine waived successfully!');
        loadFines();
        loadStats();
      } catch (error) {
        alert(`Waiver failed: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
      waived: 'bg-blue-100 text-blue-700',
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.toUpperCase()}
    </span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Fines Management</h1>
        <p className="text-gray-600">Track and manage library fines</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-medium">Pending</p>
              <p className="text-2xl font-bold text-yellow-800 mt-1">${stats.total_pending || 0}</p>
              <p className="text-yellow-600 text-xs mt-1">{stats.pending_count || 0} fines</p>
            </div>
            <div className="p-2 bg-yellow-200 rounded-lg">
              <AlertCircle className="text-yellow-700" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-green-50 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-700 text-sm font-medium">Paid</p>
              <p className="text-2xl font-bold text-green-800 mt-1">${stats.total_paid || 0}</p>
            </div>
            <div className="p-2 bg-green-200 rounded-lg">
              <CheckCircle className="text-green-700" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-700 text-sm font-medium">Waived</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">${stats.total_waived || 0}</p>
            </div>
            <div className="p-2 bg-blue-200 rounded-lg">
              <XCircle className="text-blue-700" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-purple-50 border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-purple-700 text-sm font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-purple-800 mt-1">${(stats.total_paid || 0) + (stats.total_pending || 0)}</p>
            </div>
            <div className="p-2 bg-purple-200 rounded-lg">
              <DollarSign className="text-purple-700" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2 flex-wrap">
          {['pending', 'paid', 'waived', 'all'].map(f => (
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
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`px-4 py-2 rounded font-medium ml-auto ${
              showHistory
                ? 'bg-purple-500 text-white' 
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            <Receipt className="inline-block mr-2" size={18} />
            Payment History
          </button>
        </div>
      </div>

      {/* Fines List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">
            <Clock className="animate-spin mx-auto mb-2" size={32} />
            <p className="text-gray-500">Loading fines...</p>
          </div>
        ) : fines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Overdue</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {fines.map(fine => (
                  <tr key={fine.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{fine.id}</td>
                    <td className="px-4 py-3 text-sm">{fine.user_name || `User #${fine.user_id}`}</td>
                    <td className="px-4 py-3 text-sm">Transaction #{fine.transaction_id}</td>
                    <td className="px-4 py-3 text-sm font-semibold">${fine.amount}</td>
                    <td className="px-4 py-3 text-sm">{fine.days_overdue || 'N/A'}</td>
                    <td className="px-4 py-3">{getStatusBadge(fine.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {fine.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handlePayFine(fine)}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
                            >
                              Pay Now
                            </button>
                            <button
                              onClick={() => handleWaiveFine(fine.id)}
                              className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Waive
                            </button>
                          </>
                        )}
                        {fine.status === 'paid' && (
                          <span className="text-green-600 text-xs">✓ Paid</span>
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
            <DollarSign size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No fines found</p>
          </div>
        )}
      </div>

      {/* Payment History Section */}
      {showHistory && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Receipt size={24} />
            Payment History
          </h2>
          
          {paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paymentHistory.map(receipt => (
                    <tr key={receipt.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-blue-600">{receipt.receipt_id}</td>
                      <td className="px-4 py-3 text-sm">{receipt.user_name}</td>
                      <td className="px-4 py-3 text-sm">{receipt.book_title || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">${receipt.amount}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">
                          {receipt.payment_gateway || receipt.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{new Date(receipt.payment_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            const data = receipt.receipt_data || receipt;
                            const receiptText = `
LIBRARY FINE PAYMENT RECEIPT
=============================

Receipt ID: ${data.receipt_id || receipt.receipt_id}
Date: ${new Date(receipt.payment_date).toLocaleString()}

Fine ID: #${receipt.fine_id}
Transaction: #${receipt.transaction_id}
User: ${receipt.user_name}
Book: ${receipt.book_title || 'N/A'}

Amount Paid: $${receipt.amount}
Payment Method: ${receipt.payment_gateway || receipt.payment_method}
Reference: ${receipt.payment_reference || 'N/A'}

Status: Success

Thank you for your payment!
=============================
                            `.trim();
                            
                            const blob = new Blob([receiptText], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `receipt_${receipt.receipt_id}.txt`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                        >
                          <Download size={16} />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Receipt size={48} className="mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500">No payment history found</p>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedFine && (
        <PaymentModal
          fine={selectedFine}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedFine(null);
          }}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Fines;

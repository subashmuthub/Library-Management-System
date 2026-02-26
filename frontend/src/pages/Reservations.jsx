import React, { useState, useEffect } from 'react';
import { reservationService } from '../services';
import { Bookmark, User, Book, Clock, CheckCircle, XCircle } from 'lucide-react';

const Reservations = () => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active'); // active, ready, fulfilled, cancelled, expired, all
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveForm, setReserveForm] = useState({
    user_id: '',
    book_id: ''
  });

  useEffect(() => {
    loadReservations();
  }, [filter]);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await reservationService.getAllReservations(params);
      setReservations(response.reservations || response.data || []);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReserve = async (e) => {
    e.preventDefault();
    try {
      await reservationService.reserveBook(reserveForm);
      alert('Book reserved successfully!');
      setShowReserveModal(false);
      setReserveForm({ user_id: '', book_id: '' });
      loadReservations();
    } catch (error) {
      alert(`Reservation failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleFulfill = async (reservationId) => {
    if (confirm('Mark this reservation as fulfilled? The book will be checked out.')) {
      try {
        await reservationService.fulfillReservation(reservationId);
        alert('Reservation fulfilled successfully!');
        loadReservations();
      } catch (error) {
        alert(`Fulfillment failed: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const handleCancel = async (reservationId) => {
    if (confirm('Cancel this reservation?')) {
      try {
        await reservationService.cancelReservation(reservationId);
        alert('Reservation cancelled successfully!');
        loadReservations();
      } catch (error) {
        alert(`Cancellation failed: ${error.response?.data?.error || error.message}`);
      }
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-blue-100 text-blue-700',
      ready: 'bg-green-100 text-green-700',
      fulfilled: 'bg-gray-100 text-gray-700',
      cancelled: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.toUpperCase()}
    </span>;
  };

  const getPriorityBadge = (position) => {
    if (position === 1) return <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">HIGH</span>;
    if (position <= 3) return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700">MEDIUM</span>;
    return <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">NORMAL</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="text-gray-600">Manage book reservations and queue</p>
        </div>
        <button
          onClick={() => setShowReserveModal(true)}
          className="btn btn-primary"
        >
          <Bookmark size={20} className="mr-2" />
          Reserve Book
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex gap-2">
          {['active', 'ready', 'fulfilled', 'cancelled', 'expired', 'all'].map(f => (
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

      {/* Reservations List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-12">
            <Clock className="animate-spin mx-auto mb-2" size={32} />
            <p className="text-gray-500">Loading reservations...</p>
          </div>
        ) : reservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Queue Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reserved Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reservations.map(reservation => (
                  <tr key={reservation.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{reservation.id}</td>
                    <td className="px-4 py-3 text-sm">{reservation.user_name || `User #${reservation.user_id}`}</td>
                    <td className="px-4 py-3 text-sm">{reservation.book_title || `Book #${reservation.book_id}`}</td>
                    <td className="px-4 py-3 text-sm font-semibold">#{reservation.queue_position || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{reservation.reservation_date}</td>
                    <td className="px-4 py-3 text-sm">{reservation.expiry_date || 'N/A'}</td>
                    <td className="px-4 py-3">{getPriorityBadge(reservation.queue_position || 99)}</td>
                    <td className="px-4 py-3">{getStatusBadge(reservation.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        {(reservation.status === 'active' || reservation.status === 'ready') && (
                          <>
                            <button
                              onClick={() => handleFulfill(reservation.id)}
                              className="text-green-600 hover:text-green-700 font-medium"
                            >
                              Fulfill
                            </button>
                            <button
                              onClick={() => handleCancel(reservation.id)}
                              className="text-red-600 hover:text-red-700 font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {!reservation.status || reservation.status === 'cancelled' || reservation.status === 'fulfilled' || reservation.status === 'expired' ? (
                          <span className="text-gray-400 text-xs">No actions</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Bookmark size={48} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No reservations found</p>
          </div>
        )}
      </div>

      {/* Reserve Modal */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Reserve Book</h2>
            <form onSubmit={handleReserve} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">User ID</label>
                <input
                  type="number"
                  required
                  className="input w-full"
                  value={reserveForm.user_id}
                  onChange={(e) => setReserveForm({ ...reserveForm, user_id: e.target.value })}
                  placeholder="Enter user ID (4-8 for test students)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Book ID</label>
                <input
                  type="number"
                  required
                  className="input w-full"
                  value={reserveForm.book_id}
                  onChange={(e) => setReserveForm({ ...reserveForm, book_id: e.target.value })}
                  placeholder="Enter book ID (1-25 available)"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowReserveModal(false)}
                  className="btn bg-gray-200 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Reserve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;

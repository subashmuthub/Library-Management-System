import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { reservationService, bookService } from '../services';
import { useAuth } from '../contexts';
import {
  Bookmark, User, Clock, CheckCircle, XCircle, Search,
  AlertTriangle, ArrowRight, Bell, Calendar,
  RefreshCw, ShoppingCart, Info
} from 'lucide-react';

const Reservations = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active');

  // Reserve modal state
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveStep, setReserveStep] = useState('form'); // form | checking | available | confirm | success
  const [reserveForm, setReserveForm] = useState({ user_id: '', book_id: '' });
  const [bookInfo, setBookInfo] = useState(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  const [reserveResult, setReserveResult] = useState(null);

  useEffect(() => { loadReservations(); }, [filter]);

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

  // Step 1 — check book availability before reserving
  const handleCheckAndReserve = async (e) => {
    e.preventDefault();
    if (!reserveForm.book_id) return;
    setReserveStep('checking');
    setBookInfo(null);
    try {
      const response = await bookService.getBookById(reserveForm.book_id);
      const book = response.book;
      setBookInfo(book);
      setReserveStep(book.is_available ? 'available' : 'confirm');
    } catch (error) {
      alert(`Book not found: ${error.response?.data?.error || error.message}`);
      setReserveStep('form');
    }
  };

  // Step 2 — confirm and submit reservation
  const handleReserveConfirm = async () => {
    setReserveLoading(true);
    try {
      const response = await reservationService.reserveBook({
        user_id: reserveForm.user_id || user?.id,
        book_id: reserveForm.book_id
      });
      setReserveResult(response);
      setReserveStep('success');
      loadReservations();
    } catch (error) {
      const errData = error.response?.data;
      if (errData?.redirect_to_checkout) {
        setReserveStep('available');
      } else {
        alert(`Reservation failed: ${errData?.error || error.message}`);
        setReserveStep('form');
      }
    } finally {
      setReserveLoading(false);
    }
  };

  const closeReserveModal = () => {
    setShowReserveModal(false);
    setReserveStep('form');
    setReserveForm({ user_id: '', book_id: '' });
    setBookInfo(null);
    setReserveResult(null);
  };

  const handleFulfill = async (reservationId) => {
    if (!confirm('Mark as fulfilled? The book will be checked out.')) return;
    try {
      await reservationService.fulfillReservation(reservationId);
      alert('Reservation fulfilled!');
      loadReservations();
    } catch (error) {
      alert(`Failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleCancel = async (reservationId) => {
    if (!confirm('Cancel this reservation?')) return;
    try {
      await reservationService.cancelReservation(reservationId);
      alert('Reservation cancelled.');
      loadReservations();
    } catch (error) {
      alert(`Failed: ${error.response?.data?.error || error.message}`);
    }
  };

  const statusBadge = (status) => {
    const map = {
      active:    'bg-blue-100 text-blue-700 border border-blue-200',
      ready:     'bg-green-100 text-green-700 border border-green-200',
      fulfilled: 'bg-gray-100 text-gray-600 border border-gray-200',
      cancelled: 'bg-red-100 text-red-600 border border-red-200',
      expired:   'bg-orange-100 text-orange-600 border border-orange-200',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status?.toUpperCase()}
      </span>
    );
  };

  const queueBadge = (pos) => {
    if (!pos) return null;
    if (pos === 1) return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">#{pos} · HIGH</span>;
    if (pos <= 3) return <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">#{pos} · MED</span>;
    return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">#{pos} · NORMAL</span>;
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">Reservations</h1>
            <p className="text-indigo-100">Manage book reservation queue · Get notified by email when available</p>
          </div>
          <button
            onClick={() => { setShowReserveModal(true); setReserveStep('form'); }}
            className="btn bg-white text-indigo-700 hover:bg-indigo-50 font-semibold shadow"
          >
            <Bookmark size={18} className="mr-2" />
            Reserve Book
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 text-sm text-blue-800">
        <Info size={18} className="mt-0.5 shrink-0 text-blue-500" />
        <p>
          <strong>How it works:</strong> You can only reserve a book that is currently <em>checked out</em>.
          If the book is available, you'll be redirected to checkout.
          Once returned, you'll receive a <strong>Gmail notification</strong> and your reservation moves to <em>Ready</em> status.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="card">
        <div className="flex gap-2 flex-wrap">
          {['active', 'ready', 'fulfilled', 'cancelled', 'expired', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                filter === f ? 'bg-indigo-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <RefreshCw className="animate-spin mx-auto mb-3 text-indigo-500" size={36} />
            <p className="text-gray-500">Loading reservations...</p>
          </div>
        ) : reservations.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['ID', 'Reserved By', 'Book', 'Currently With', 'Expected Return', 'Queue', 'Reserved On', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">#{r.id}</td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                          <User size={12} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{r.user_name || `User #${r.user_id}`}</p>
                          {r.student_id && <p className="text-xs text-gray-500">{r.student_id}</p>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900 max-w-[180px] truncate">{r.title || `Book #${r.book_id}`}</p>
                      {r.author && <p className="text-xs text-gray-500">by {r.author}</p>}
                    </td>

                    <td className="px-4 py-3">
                      {r.current_holder ? (
                        <div className="flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 w-fit">
                          <User size={11} />
                          <span className="text-xs font-medium">{r.current_holder}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.expected_return_date ? (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Calendar size={12} />
                          <span className="text-xs">
                            {new Date(r.expected_return_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">{queueBadge(r.queue_position)}</td>

                    <td className="px-4 py-3 text-xs text-gray-500">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>

                    <td className="px-4 py-3">{statusBadge(r.status)}</td>

                    <td className="px-4 py-3">
                      {(r.status === 'active' || r.status === 'ready') ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleFulfill(r.id)} className="text-xs text-green-600 hover:text-green-800 font-semibold hover:underline">Fulfill</button>
                          <button onClick={() => handleCancel(r.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <Bookmark size={40} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">No reservations found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different filter or reserve a checked-out book</p>
          </div>
        )}
      </div>

      {/* ── Reserve Modal ── */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">

            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-xl p-5 text-white">
              <div className="flex items-center gap-3">
                <Bookmark size={22} />
                <div>
                  <h2 className="text-xl font-bold">Reserve a Book</h2>
                  <p className="text-indigo-100 text-sm">Only for books currently checked out</p>
                </div>
              </div>
            </div>

            <div className="p-6">

              {/* STEP: form */}
              {reserveStep === 'form' && (
                <form onSubmit={handleCheckAndReserve} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID <span className="text-red-500">*</span></label>
                    <input type="number" required className="input w-full" value={reserveForm.user_id}
                      onChange={e => setReserveForm({ ...reserveForm, user_id: e.target.value })}
                      placeholder="Enter student / user ID" autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Book ID <span className="text-red-500">*</span></label>
                    <input type="number" required className="input w-full" value={reserveForm.book_id}
                      onChange={e => setReserveForm({ ...reserveForm, book_id: e.target.value })}
                      placeholder="Enter book ID" />
                    <p className="text-xs text-gray-500 mt-1">Find book IDs via the Book Search page</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={closeReserveModal} className="flex-1 btn btn-outline">Cancel</button>
                    <button type="submit" className="flex-1 btn bg-indigo-600 hover:bg-indigo-700 text-white">Check Availability</button>
                  </div>
                </form>
              )}

              {/* STEP: checking */}
              {reserveStep === 'checking' && (
                <div className="text-center py-10">
                  <Search className="animate-spin mx-auto mb-3 text-indigo-500" size={40} />
                  <p className="text-gray-600 font-medium">Checking book availability...</p>
                </div>
              )}

              {/* STEP: available — redirect to checkout */}
              {reserveStep === 'available' && bookInfo && (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                    <CheckCircle size={22} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-green-800">Book is Available on the Shelf!</p>
                      <p className="text-sm text-green-700 mt-1">No need to reserve — proceed to checkout directly.</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 border rounded-lg p-3 text-sm">
                    <p className="font-semibold text-gray-900">{bookInfo.title}</p>
                    <p className="text-gray-500 text-xs mt-1">by {bookInfo.author}</p>
                    {bookInfo.current_shelf && <p className="text-blue-600 text-xs mt-1">📍 {bookInfo.current_shelf}</p>}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={closeReserveModal} className="flex-1 btn btn-outline">Close</button>
                    <button onClick={() => { closeReserveModal(); navigate('/transactions'); }}
                      className="flex-1 btn bg-green-600 hover:bg-green-700 text-white">
                      <ShoppingCart size={15} className="mr-2" /> Go to Checkout <ArrowRight size={15} className="ml-2" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP: confirm — show who has the book */}
              {reserveStep === 'confirm' && bookInfo && (
                <div className="space-y-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex gap-3">
                    <AlertTriangle size={22} className="text-orange-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-orange-800">Book is Currently Checked Out</p>
                      <p className="text-sm text-orange-700 mt-1">Reserve your spot — you'll be notified by email when it's returned.</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2">
                    <p className="font-semibold text-gray-900">{bookInfo.title}</p>
                    <p className="text-gray-500 text-xs">by {bookInfo.author}</p>
                    {bookInfo.borrower_name && (
                      <div className="flex items-center gap-2 text-orange-700 mt-2 pt-2 border-t border-gray-200">
                        <User size={14} className="shrink-0" />
                        <span>Currently with: <strong>{bookInfo.borrower_name}</strong></span>
                      </div>
                    )}
                    {bookInfo.due_date && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock size={14} className="shrink-0" />
                        <span>Expected return: <strong>{new Date(bookInfo.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
                    <Bell size={14} className="mt-0.5 shrink-0" />
                    <span>You'll receive a <strong>Gmail notification</strong> once this book is returned and your slot is ready.</span>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setReserveStep('form')} className="flex-1 btn btn-outline">Back</button>
                    <button onClick={handleReserveConfirm} disabled={reserveLoading}
                      className="flex-1 btn bg-indigo-600 hover:bg-indigo-700 text-white">
                      {reserveLoading ? 'Reserving...' : <><Bell size={15} className="mr-2" />Confirm & Reserve</>}
                    </button>
                  </div>
                </div>
              )}

              {/* STEP: success */}
              {reserveStep === 'success' && reserveResult && (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <CheckCircle size={36} className="text-green-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Reservation Confirmed!</h3>
                    <p className="text-gray-500 text-sm mt-1">{reserveResult.message}</p>
                  </div>

                  {reserveResult.reservation && (
                    <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reservation ID</span>
                        <span className="font-semibold">#{reserveResult.reservation.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Queue Position</span>
                        <span className="font-semibold">#{reserveResult.reservation.queue_position}</span>
                      </div>
                    </div>
                  )}

                  {reserveResult.current_holder && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 text-orange-700">
                        <User size={13} />
                        <span>Currently with: <strong>{reserveResult.current_holder.name}</strong></span>
                      </div>
                      {reserveResult.current_holder.due_date && (
                        <div className="flex items-center gap-2 text-orange-600 mt-1">
                          <Clock size={13} />
                          <span>Due: {new Date(reserveResult.current_holder.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
                    <Bell size={14} className="mt-0.5 shrink-0" />
                    <span>A <strong>Gmail notification</strong> will be sent to the registered email when this book becomes available.</span>
                  </div>

                  <button onClick={closeReserveModal} className="w-full btn bg-indigo-600 hover:bg-indigo-700 text-white">Done</button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservations;

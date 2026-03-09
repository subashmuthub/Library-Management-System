import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService, navigationService, transactionService, reservationService } from '../services';
import { ArrowLeft, BookOpen, MapPin, Compass, Clock, Tag, CheckCircle, XCircle, User, Calendar, AlertCircle, BookmarkPlus, Users } from 'lucide-react';
import { format } from 'date-fns';

const BookDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [reservationQueue, setReservationQueue] = useState([]);
  const [navigation, setNavigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    loadBookDetails();
  }, [id]);

  const loadBookDetails = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const [bookData, historyData] = await Promise.all([
        bookService.getBookById(id),
        bookService.getBookLocationHistory(id).catch(() => ({ history: [] })),
      ]);
      
      const bookInfo = bookData.book || bookData.data || bookData;
      setBook(bookInfo);
      setLocationHistory(historyData.history || historyData.data || []);
      
      // Load transaction history
      loadTransactionHistory();
      
      // Load reservation queue if book is not available
      if (!bookInfo.is_available || bookInfo.status !== 'available') {
        loadReservationQueue();
      }
    } catch (error) {
      console.error('Failed to load book details:', error);
      setBook(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionHistory = async () => {
    try {
      const response = await transactionService.getAllTransactions({ book_id: id, limit: 10 });
      setTransactionHistory(response.transactions || response.data || []);
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  };

  const loadReservationQueue = async () => {
    try {
      const response = await reservationService.getBookQueue(id);
      setReservationQueue(response.queue || response.data || []);
    } catch (error) {
      console.error('Failed to load reservation queue:', error);
    }
  };

  const handleReserveBook = async () => {
    if (!currentUser.id) {
      alert('Please login to reserve books');
      navigate('/login');
      return;
    }

    setReserving(true);
    try {
      await reservationService.reserveBook({
        book_id: id,
        user_id: currentUser.id
      });
      alert('Book reserved successfully! You will be notified when it becomes available.');
      loadReservationQueue();
    } catch (error) {
      console.error('Reservation failed:', error);
      alert(error.response?.data?.error || 'Failed to reserve book');
    } finally {
      setReserving(false);
    }
  };

  const handleNavigate = async () => {
    try {
      const navData = await navigationService.findBook(id);
      setNavigation(navData);
    } catch (error) {
      console.error('Failed to get navigation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading book details...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Book not found</p>
        <button onClick={() => navigate('/books')} className="btn btn-primary mt-4">
          Back to Books
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <button onClick={() => navigate('/books')} className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} />
        Back to Books
      </button>

      {/* Book Info */}
      <div className="card">
        <div className="flex gap-6">
          <div className="w-32 h-48 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen size={48} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <h1 className="text-3xl font-bold">{book.title}</h1>
              {/* Availability Badge */}
              {book.is_available || book.status === 'available' ? (
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                  <CheckCircle size={18} className="mr-2" />
                  Available
                </span>
              ) : (
                <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                  <XCircle size={18} className="mr-2" />
                  In Use
                </span>
              )}
            </div>
            <p className="text-xl text-gray-600 mb-4">{book.author}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">ISBN</p>
                <p className="font-medium">{book.isbn}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <span className="badge badge-info">{book.category}</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Publisher</p>
                <p className="font-medium">{book.publisher || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Year</p>
                <p className="font-medium">{book.publication_year || 'N/A'}</p>
              </div>
              {book.type && (
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  <p className="font-medium capitalize">{book.type}</p>
                </div>
              )}
              {book.total_copies && (
                <div>
                  <p className="text-sm text-gray-600">Total Copies</p>
                  <p className="font-medium">{book.total_copies}</p>
                </div>
              )}
            </div>

            {/* Current Borrower Info */}
            {(book.borrower_name || book.checked_out_by) && (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
                <div className="flex items-start gap-3">
                  <User className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-900 mb-1">Currently Borrowed</p>
                    {book.borrower_name && (
                      <p className="text-sm text-yellow-800">
                        <span className="font-medium">Borrower:</span> {book.borrower_name}
                      </p>
                    )}
                    {book.due_date && (
                      <p className="text-sm text-yellow-800">
                        <span className="font-medium">Due Date:</span> {format(new Date(book.due_date), 'MMM dd, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {book.current_shelf && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                <MapPin className="text-green-600" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Current Location</p>
                  <p className="font-semibold text-green-700">Shelf {book.current_shelf}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {book.is_available || book.status === 'available' ? (
                <button onClick={handleNavigate} className="btn btn-primary">
                  <Compass size={20} className="inline mr-2" />
                  Get Directions
                </button>
              ) : (
                <button 
                  onClick={handleReserveBook} 
                  disabled={reserving}
                  className="btn btn-primary"
                >
                  <BookmarkPlus size={20} className="inline mr-2" />
                  {reserving ? 'Reserving...' : 'Reserve This Book'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Instructions */}
      {navigation && (
        <div className="card bg-primary-50 border border-primary-200">
          <div className="flex items-start gap-3">
            <Compass className="text-primary-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-lg mb-2">Navigation Instructions</h3>
              <p className="text-gray-700 mb-3">{navigation.directions}</p>
              {navigation.beacon && (
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Beacon UUID</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{navigation.beacon.uuid}</code>
                  <p className="text-xs text-gray-500 mt-2">Zone: {navigation.beacon.zone}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RFID Tag */}
      {book.rfid_tag && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold">RFID Tag</h2>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tag ID</p>
            <code className="text-sm bg-white px-3 py-2 rounded border">{book.rfid_tag}</code>
          </div>
        </div>
      )}

      {/* Reservation Queue */}
      {reservationQueue.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-orange-600" size={20} />
            <h2 className="text-xl font-bold">Reservation Queue</h2>
          </div>
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-3">
            <AlertCircle className="inline mr-2 text-orange-600" size={18} />
            <span className="text-orange-800 font-medium">
              {reservationQueue.length} {reservationQueue.length === 1 ? 'person is' : 'people are'} waiting for this book
            </span>
          </div>
          <div className="space-y-2">
            {reservationQueue.map((reservation, index) => (
              <div key={reservation.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-700">#{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{reservation.user_name || 'Student'}</p>
                  <p className="text-sm text-gray-600">
                    Reserved on {format(new Date(reservation.reserved_date || reservation.created_at), 'MMM dd, yyyy')}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  reservation.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  reservation.status === 'ready' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {reservation.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {transactionHistory.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-blue-600" size={20} />
            <h2 className="text-xl font-bold">Borrowing History</h2>
          </div>
          <div className="space-y-3">
            {transactionHistory.map((transaction) => (
              <div key={transaction.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="font-medium">{transaction.user_name || 'Unknown User'}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">Borrowed:</span>{' '}
                      {format(new Date(transaction.checkout_date || transaction.issue_date), 'MMM dd, yyyy')}
                    </p>
                    {transaction.return_date ? (
                      <p>
                        <span className="font-medium">Returned:</span>{' '}
                        {format(new Date(transaction.return_date), 'MMM dd, yyyy')}
                      </p>
                    ) : (
                      <p className="text-orange-600 font-medium">
                        Currently borrowed - Due: {transaction.due_date ? format(new Date(transaction.due_date), 'MMM dd, yyyy') : 'N/A'}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  transaction.return_date ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {transaction.return_date ? 'Returned' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location History */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-primary-600" size={20} />
          <h2 className="text-xl font-bold">Location History</h2>
        </div>
        {locationHistory.length > 0 ? (
          <div className="space-y-3">
            {locationHistory.map((entry, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Shelf {entry.shelf_code}</p>
                  <p className="text-sm text-gray-600">Scanned by: {entry.scanner_type} reader</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{format(new Date(entry.timestamp), 'MMM dd, yyyy')}</p>
                  <p className="text-xs text-gray-500">{format(new Date(entry.timestamp), 'h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No location history available</p>
        )}
      </div>
    </div>
  );
};

export default BookDetails;

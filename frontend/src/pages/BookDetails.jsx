import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService, navigationService, transactionService, reservationService } from '../services';
import RequestAccessModal from '../components/RequestAccessModal';
import MultiBookCheckoutModal from '../components/MultiBookCheckoutModal';
import { ArrowLeft, BookOpen, MapPin, Compass, Clock, Tag, CheckCircle, XCircle, User, Calendar, AlertCircle, BookmarkPlus, Users, ShoppingCart, Star, MessageSquare, Send, ShieldAlert, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

const BookDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [isbnCopies, setIsbnCopies] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [reservationQueue, setReservationQueue] = useState([]);
  const [navigation, setNavigation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reserving, setReserving] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState(null);

  const currentUserRole = String(currentUser?.role || currentUser?.role_name || '').toLowerCase();
  const isStudent = !currentUserRole || currentUserRole === 'student';
  const isAdminOrLibrarian = ['admin', 'librarian'].includes(currentUserRole);

  const degreeType = String(currentUser?.degree_type || currentUser?.degreeType || '').trim();
  const DIRECT_RESEARCH_DEGREES = ['me', 'm.tech', 'mtech', 'phd', 'ph.d', 'research scholar', 'ms', 'm.s', 'm.phil'];
  const isEligibleDegree = DIRECT_RESEARCH_DEGREES.includes(degreeType.toLowerCase());

  const isDirectAccess = ['admin', 'librarian', 'staff', 'faculty', 'teacher', 'me_student', 'research_scholar'].includes(currentUserRole) || isEligibleDegree;
  const isRestrictedResearch = Boolean(book?.is_restricted_research);

  const safeFormatDate = (dateVal, formatStr = 'MMM dd, yyyy') => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return 'N/A';
      return format(d, formatStr);
    } catch {
      return 'N/A';
    }
  };

  // Access request state for UG students
  const [accessStatus, setAccessStatus] = useState(null); // 'PENDING' | 'APPROVED' | 'REJECTED' | null
  const [accessRequest, setAccessRequest] = useState(null);
  const [showRequestAccessModal, setShowRequestAccessModal] = useState(false);

  const checkAccessStatus = async (bookId) => {
    if (!currentUser?.id) return;
    try {
      const res = await reservationService.getMyRequestStatus(bookId);
      if (res && res.has_request) {
        setAccessStatus(res.status);
        setAccessRequest(res.request);
      } else {
        setAccessStatus(null);
        setAccessRequest(null);
      }
    } catch (err) {
      console.error('Failed to fetch request status:', err);
    }
  };

  useEffect(() => {
    loadBookDetails();
  }, [id]);

  const loadBookDetails = async () => {
    if (!id) {
      setLoading(false);
      setError('Invalid book ID');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const [bookData, historyData] = await Promise.all([
        bookService.getBookById(id),
        bookService.getBookLocationHistory(id).catch(() => ({ history: [] })),
      ]);
      
      const bookInfo = bookData?.book || bookData?.data || bookData;
      if (!bookInfo || !bookInfo.id) {
        setBook(null);
        setError('Book not found or failed to load.');
        return;
      }

      setBook(bookInfo);
      setReviews(Array.isArray(bookInfo?.reviews) ? bookInfo.reviews : (Array.isArray(bookData?.reviews) ? bookData.reviews : []));
      setIsbnCopies(bookData?.isbnCopies || []);
      setLocationHistory(historyData?.history || historyData?.data || []);
      
      // Load transaction history
      loadTransactionHistory();
      
      // Load reservation queue if book is not available
      if (!bookInfo.is_available || bookInfo.status !== 'available') {
        loadReservationQueue();
      }

      // Check access request status for restricted research titles
      if (bookInfo.is_restricted_research && !isDirectAccess) {
        checkAccessStatus(bookInfo.id);
      }
    } catch (err) {
      console.error('Failed to load book details:', err);
      setBook(null);
      setError(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Book not found or failed to load.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!currentUser.id) {
      alert('Please log in to submit a review');
      return;
    }
    setSubmittingReview(true);
    setReviewMessage(null);
    try {
      await bookService.addReview(id, {
        rating: newRating,
        review_text: newReviewText.trim(),
      });
      setReviewMessage({ type: 'success', text: 'Review submitted successfully!' });
      setNewReviewText('');
      await loadBookDetails();
    } catch (err) {
      setReviewMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to submit review',
      });
    } finally {
      setSubmittingReview(false);
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
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="text-gray-500 font-medium text-lg">Loading book details...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12 card max-w-lg mx-auto mt-8">
        <p className="text-gray-600 font-medium text-lg mb-4">{error || 'Book not found or failed to load.'}</p>
        <button onClick={() => navigate('/books')} className="btn btn-primary">
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
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-bold">{book.title}</h1>
                  {book.is_restricted_research && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-sm">
                      Restricted: Research & ME Paper
                    </span>
                  )}
                </div>
                {/* Average Rating */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={16}
                        className={
                          (book?.average_rating || 0) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : (book?.average_rating || 0) >= star - 0.5
                            ? 'fill-amber-200 text-amber-400'
                            : 'text-gray-300'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-700">
                    {book?.average_rating ? Number(book.average_rating).toFixed(1) : '0.0'}
                  </span>
                  <span className="text-xs text-gray-400">
                    ({(book?.reviews || reviews || []).length} {(book?.reviews || reviews || []).length === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              </div>
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
              {book.isbn_copy_count && (
                <div>
                  <p className="text-sm text-gray-600">Copies With Same ISBN</p>
                  <p className="font-medium">{book.available_isbn_copies || 0} available / {book.isbn_copy_count} total</p>
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
                        <span className="font-medium">Due Date:</span> {safeFormatDate(book.due_date)}
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

            {/* Restricted Research & ME Access Banner */}
            {isRestrictedResearch && (
              <div className="mb-4">
                {isDirectAccess ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                    <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300">
                          Eligible for Direct Research Access (ME Student)
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 uppercase">
                          {degreeType ? `${degreeType} Scholar` : (currentUserRole || 'Authorized Scholar')}
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1.5 font-medium">
                        You have direct checkout privileges for institutional research and postgraduate thesis materials.
                      </p>
                    </div>
                  </div>
                ) : accessStatus === 'APPROVED' ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                    <CheckCircle className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
                          Librarian Approval Granted
                        </p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 uppercase">
                          Approved
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
                        Your request for this research paper has been approved by the library administration. You can proceed with borrowing.
                      </p>
                    </div>
                  </div>
                ) : accessStatus === 'PENDING' ? (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                    <Clock className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                          Access Request Under Review
                        </p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 uppercase">
                          Pending
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                        Your access request is currently pending Librarian review. You will be able to checkout this title once approved.
                      </p>
                    </div>
                  </div>
                ) : accessStatus === 'REJECTED' ? (
                  <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                    <ShieldAlert className="text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-rose-950 dark:text-rose-200 text-sm">
                          Access Request Declined
                        </p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 uppercase">
                          Rejected
                        </span>
                      </div>
                      <p className="text-xs text-rose-800 dark:text-rose-300 mt-1">
                        Reason: {accessRequest?.rejection_reason || 'Academic justification did not meet the departmental lending criteria.'}
                      </p>
                      <button
                        onClick={() => setShowRequestAccessModal(true)}
                        className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300 underline hover:text-rose-900"
                      >
                        Submit a new request with updated justification
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                    <ShieldAlert className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
                          UG Student - Request Approval Required
                        </span>
                        {degreeType && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 uppercase">
                            {degreeType} - {currentUser?.department || 'CSE'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-1.5 font-medium">
                        Restricted: This title is reserved for Research Scholars and ME Students. Normal students require prior Librarian approval.
                      </p>
                      <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1">
                        Click "Request Access to Borrow" below to submit your academic purpose or project justification.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              {book.is_available || book.status === 'available' ? (
                <>
                  <button onClick={handleNavigate} className="btn btn-primary">
                    <Compass size={20} className="inline mr-2" />
                    Get Directions
                  </button>

                  {isRestrictedResearch && !isDirectAccess && accessStatus !== 'APPROVED' ? (
                    accessStatus === 'PENDING' ? (
                      <button
                        disabled
                        className="btn bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-80"
                      >
                        <Clock size={18} className="inline mr-2" />
                        Access Request Pending Review
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRequestAccessModal(true)}
                        className="btn bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                      >
                        <ShieldAlert size={18} className="inline mr-2" />
                        Request Access to Borrow
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => setShowCheckoutModal(true)}
                      className="btn btn-success"
                    >
                      <ShoppingCart size={18} className="inline mr-2" />
                      Checkout This Book
                    </button>
                  )}
                </>
              ) : (
                isRestrictedResearch && !isDirectAccess && accessStatus !== 'APPROVED' ? (
                  accessStatus === 'PENDING' ? (
                    <button
                      disabled
                      className="btn bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-80"
                    >
                      <Clock size={18} className="inline mr-2" />
                      Access Request Pending Review
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowRequestAccessModal(true)}
                      className="btn bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    >
                      <ShieldAlert size={18} className="inline mr-2" />
                      Request Access to Reserve
                    </button>
                  )
                ) : (
                  <button 
                    onClick={handleReserveBook} 
                    disabled={reserving}
                    className="btn btn-primary"
                  >
                    <BookmarkPlus size={20} className="inline mr-2" />
                    {reserving ? 'Reserving...' : 'Reserve This Book'}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Book Cart Checkout Modal */}
      <MultiBookCheckoutModal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        onSuccess={() => {
          setShowCheckoutModal(false);
          loadBookDetails();
        }}
        currentUser={currentUser}
        isAdminOrLibrarian={isAdminOrLibrarian}
        initialBook={book}
        initialLoanDays={isRestrictedResearch ? 60 : (currentUserRole === 'staff' ? 60 : 14)}
      />

      {/* Navigation Instructions */}
      {navigation && (
        <div className="card bg-primary-50 border border-primary-200">
          <div className="flex items-start gap-3">
            <Compass className="text-primary-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-lg mb-2">Navigation Instructions</h3>
              <div className="space-y-2 text-gray-700 mb-3">
                {(navigation.navigation?.instructions || []).map((instruction, index) => (
                  <p key={`${instruction}-${index}`}>{instruction}</p>
                ))}
              </div>
              {navigation.navigation?.beacon && (
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Beacon UUID</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{navigation.navigation.beacon.uuid}</code>
                  <p className="text-xs text-gray-500 mt-2">Zone: {navigation.navigation.beacon.zone}</p>
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
      {(reservationQueue || []).length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="text-orange-600" size={20} />
            <h2 className="text-xl font-bold">Reservation Queue</h2>
          </div>
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-3">
            <AlertCircle className="inline mr-2 text-orange-600" size={18} />
            <span className="text-orange-800 font-medium">
              {(reservationQueue || []).length} {(reservationQueue || []).length === 1 ? 'person is' : 'people are'} waiting for this book
            </span>
          </div>
          <div className="space-y-2">
            {(reservationQueue || []).map((reservation, index) => (
              <div key={reservation?.id || index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-orange-700">#{index + 1}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{reservation?.user_name || 'Student'}</p>
                  <p className="text-sm text-gray-600">
                    Reserved on {safeFormatDate(reservation?.reserved_date || reservation?.created_at)}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  reservation?.status === 'active' ? 'bg-blue-100 text-blue-700' :
                  reservation?.status === 'ready' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {reservation?.status || 'active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      {(transactionHistory || []).length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="text-blue-600" size={20} />
            <h2 className="text-xl font-bold">Borrowing History</h2>
          </div>
          <div className="space-y-3">
            {(transactionHistory || []).map((transaction, idx) => (
              <div key={transaction?.id || idx} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="font-medium">{transaction?.user_name || 'Unknown User'}</p>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium">Borrowed:</span>{' '}
                      {safeFormatDate(transaction?.checkout_date || transaction?.issue_date)}
                    </p>
                    {transaction?.return_date ? (
                      <p>
                        <span className="font-medium">Returned:</span>{' '}
                        {safeFormatDate(transaction?.return_date)}
                      </p>
                    ) : (
                      <p className="text-orange-600 font-medium">
                        Currently borrowed - Due: {safeFormatDate(transaction?.due_date)}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  transaction?.return_date ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {transaction?.return_date ? 'Returned' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ISBN Copy Locations */}
      {(isbnCopies || []).length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="text-indigo-600" size={20} />
            <h2 className="text-xl font-bold">Same ISBN Copy Locations</h2>
          </div>
          <div className="space-y-2">
            {(isbnCopies || []).map((copy, idx) => (
              <div key={`${copy?.id || idx}-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Copy ID #{copy?.id}</p>
                  <p className="text-sm text-gray-600">Location: {copy?.location || 'Unassigned'}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${copy?.copy_status === 'available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {copy?.copy_status === 'available' ? 'Available' : 'In Use'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location History */}
      {!isStudent && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold">Location History</h2>
          </div>
          {(locationHistory || []).length > 0 ? (
            <div className="space-y-3">
              {(locationHistory || []).map((entry, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                  <div className="flex-1">
                    <p className="font-medium">Shelf {entry?.shelf_code || entry?.shelfCode || 'N/A'}</p>
                    <p className="text-sm text-gray-600">Location event captured</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{safeFormatDate(entry?.timestamp, 'MMM dd, yyyy')}</p>
                    <p className="text-xs text-gray-500">{safeFormatDate(entry?.timestamp, 'h:mm a')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No location history available</p>
          )}
        </div>
      )}

      {/* Reviews & Student Ratings Section */}
      <div className="card space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Student Reviews & Ratings</h2>
              <p className="text-xs text-gray-500">Peer feedback and academic rating</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-amber-50 px-3.5 py-1.5 rounded-2xl border border-amber-200">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span className="font-extrabold text-amber-900 text-base">
              {book?.average_rating ? Number(book.average_rating).toFixed(1) : '0.0'}
            </span>
            <span className="text-xs text-amber-700 font-medium">/ 5.0</span>
          </div>
        </div>

        {/* Submit Review Form */}
        <form onSubmit={handleAddReview} className="bg-gray-50 p-4 sm:p-5 rounded-2xl border border-gray-200 space-y-3">
          <h3 className="text-sm font-bold text-gray-800">Leave a Review</h3>
          
          {reviewMessage && (
            <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
              reviewMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              <AlertCircle size={15} />
              <span>{reviewMessage.text}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Rating (1 to 5 Stars)</label>
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setNewRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    size={22}
                    className={newRating >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
                  />
                </button>
              ))}
              <span className="text-xs font-bold text-gray-600 ml-2">{newRating} Stars</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Your Thoughts / Notes</label>
            <textarea
              rows={2}
              value={newReviewText}
              onChange={(e) => setNewReviewText(e.target.value)}
              placeholder="What did you think of the explanations, exercises, or relevancy for coursework?"
              className="w-full p-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submittingReview}
              className="btn btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <Send size={14} />
              <span>{submittingReview ? 'Submitting...' : 'Post Review'}</span>
            </button>
          </div>
        </form>

        {/* Existing Reviews List */}
        <div className="space-y-3">
          {(book?.reviews || reviews || []).length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No reviews yet for this title. Be the first to share your rating!
            </div>
          ) : (
            (book?.reviews || reviews || []).map((r, rIdx) => (
              <div key={r?.id || rIdx} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs">
                      {(r?.user_name || 'S')[0]}
                    </div>
                    <span className="font-semibold text-sm text-gray-800">{r?.user_name || 'Student'}</span>
                  </div>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={st}
                        size={14}
                        className={(r?.rating || 0) >= st ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
                      />
                    ))}
                  </div>
                </div>
                {r?.review_text && <p className="text-xs text-gray-600 pl-9">{r.review_text}</p>}
                <div className="text-[10px] text-gray-400 pl-9">
                  {safeFormatDate(r?.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Request Access Modal */}
      {showRequestAccessModal && (
        <RequestAccessModal
          isOpen={showRequestAccessModal}
          onClose={() => setShowRequestAccessModal(false)}
          book={book}
          onSuccess={() => {
            setAccessStatus('PENDING');
          }}
        />
      )}
    </div>
  );
};

export default BookDetails;

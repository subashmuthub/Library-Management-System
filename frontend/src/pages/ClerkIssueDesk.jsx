import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { circulationService } from '../services';
import {
  Search,
  QrCode,
  User,
  BookOpen,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  X,
  Bookmark,
  Sparkles,
  Barcode,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  GraduationCap
} from 'lucide-react';
import { format, addDays } from 'date-fns';

const ClerkIssueDesk = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState(searchParams.get('student') || searchParams.get('search') || '');
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [lookupError, setLookupError] = useState(null);

  // Active Desk Tab: 'reservations' | 'direct'
  const [activeTab, setActiveTab] = useState('reservations');

  // Direct Issue state
  const [directIdentifier, setDirectIdentifier] = useState('');
  const [searchingBook, setSearchingBook] = useState(false);
  const [matchedBooks, setMatchedBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);

  // Loan period state
  const [loanDays, setLoanDays] = useState(14);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState(null);

  // Receipt Modal state
  const [receipt, setReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // QR / Barcode Scanner Simulation Modal
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Current logged in clerk/user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  // Compute calculated due date
  const calculatedDueDate = useMemo(() => {
    const targetDate = addDays(new Date(), Number(loanDays) || 14);
    return format(targetDate, 'EEEE, MMMM dd, yyyy');
  }, [loanDays]);

  // If initial search query provided via URL, look up immediately
  useEffect(() => {
    const initialQuery = searchParams.get('student') || searchParams.get('search');
    if (initialQuery) {
      handleLookup(initialQuery);
    }
  }, [searchParams]);

  // Look up student by query
  const handleLookup = async (queryToSearch) => {
    const query = String(queryToSearch || searchQuery).trim();
    if (!query) {
      setLookupError('Please enter a Student ID, Roll No, or Email.');
      return;
    }

    setLoadingStudent(true);
    setLookupError(null);
    setSelectedBook(null);

    try {
      const data = await circulationService.studentLookup(query);
      if (data.success && data.student) {
        setStudentData(data);
        // Default loan period based on student/staff role
        setLoanDays(data.stats?.default_loan_days || 14);
      } else {
        setStudentData(null);
        setLookupError(data.message || 'Student not found.');
      }
    } catch (err) {
      console.error('Lookup failed:', err);
      setStudentData(null);
      setLookupError(err.response?.data?.message || err.message || 'Patron record not found.');
    } finally {
      setLoadingStudent(false);
    }
  };

  // Quick book autocomplete for Direct Issue
  useEffect(() => {
    if (activeTab !== 'direct' || !directIdentifier || directIdentifier.length < 2) {
      setMatchedBooks([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingBook(true);
      try {
        const res = await circulationService.searchBooks({ q: directIdentifier });
        setMatchedBooks(res.books || []);
      } catch (err) {
        console.error('Book search error:', err);
      } finally {
        setSearchingBook(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [directIdentifier, activeTab]);

  // Issue reserved book
  const handleIssueReserved = async (resv) => {
    if (!studentData?.student?.id) return;
    setIssuing(true);
    setIssueError(null);

    try {
      const response = await circulationService.issueReserved({
        reservation_id: resv.reservation_id,
        source: resv.source,
        barcode_or_accession_no: resv.accession_no || resv.barcode,
        loan_days: loanDays
      });

      if (response.success && response.receipt) {
        setReceipt(response.receipt);
        setShowReceiptModal(true);
        // Refresh student data to update reservation list and loan counts
        await handleLookup(studentData.student.student_id || studentData.student.id);
      } else {
        setIssueError(response.message || 'Failed to issue reserved book.');
      }
    } catch (err) {
      console.error('Issue reserved failed:', err);
      setIssueError(err.response?.data?.message || err.response?.data?.error || 'Failed to issue book.');
    } finally {
      setIssuing(false);
    }
  };

  // Direct Counter Issue
  const handleDirectIssue = async () => {
    if (!studentData?.student?.id) {
      setIssueError('Please look up and select an active student first.');
      return;
    }

    const targetIdentifier = selectedBook?.accession_no || selectedBook?.barcode || selectedBook?.id || directIdentifier;

    if (!targetIdentifier) {
      setIssueError('Please scan or specify a Book Accession Number or Barcode.');
      return;
    }

    setIssuing(true);
    setIssueError(null);

    try {
      const response = await circulationService.directIssue({
        user_id: studentData.student.id,
        identifier: targetIdentifier,
        loan_days: loanDays
      });

      if (response.success && response.receipt) {
        setReceipt(response.receipt);
        setShowReceiptModal(true);
        setDirectIdentifier('');
        setSelectedBook(null);
        // Refresh student data
        await handleLookup(studentData.student.student_id || studentData.student.id);
      } else {
        setIssueError(response.message || 'Direct issue failed.');
      }
    } catch (err) {
      console.error('Direct issue failed:', err);
      setIssueError(err.response?.data?.message || err.response?.data?.error || 'Direct issue failed.');
    } finally {
      setIssuing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleResetDesk = () => {
    setShowReceiptModal(false);
    setReceipt(null);
    setSearchQuery('');
    setStudentData(null);
    setSelectedBook(null);
    setDirectIdentifier('');
    setIssueError(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Print-Only Style Definition */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #circulation-receipt-print, #circulation-receipt-print * {
            visibility: visible;
          }
          #circulation-receipt-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 uppercase tracking-wider">
              Circulation Desk
            </span>
            <span className="text-xs text-slate-500 font-medium">Physical Book Issuance Module</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Book Issue Counter</h1>
          <p className="text-sm text-slate-600">
            Process reserved book pickups and direct counter checkouts with automated due date calculation and printable slips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => handleLookup(searchQuery)}
            disabled={loadingStudent || !studentData}
            className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs flex items-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 transition-colors"
          >
            <RefreshCw size={14} className={loadingStudent ? 'animate-spin' : ''} />
            Refresh Patron
          </button>
          <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 text-right">
            <p className="text-xs text-slate-500">Desk Officer</p>
            <p className="text-sm font-bold text-slate-800">
              {currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : 'Desk Clerk'}
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Student Lookup Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <User className="text-indigo-600" size={18} />
          Step 1: Student / Patron Identification
        </h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup(searchQuery);
          }}
          className="flex flex-col sm:flex-row items-stretch gap-3"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter Student ID / Roll No (e.g. STU001, 24104119) or Email..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loadingStudent}
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Search size={16} />
            {loadingStudent ? 'Locating...' : 'Identify Student'}
          </button>

          <button
            type="button"
            onClick={() => setShowScannerModal(true)}
            className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-300 transition-colors"
          >
            <QrCode size={18} className="text-indigo-600" />
            <span>Scan Student Card</span>
          </button>
        </form>

        {/* Quick Sample Presets */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Quick Test Accounts:</span>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('STU001');
              handleLookup('STU001');
            }}
            className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1 rounded-lg font-semibold transition-colors border border-indigo-200"
          >
            Student STU001 (UG)
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('student1@university.edu');
              handleLookup('student1@university.edu');
            }}
            className="text-xs bg-slate-100 text-slate-700 hover:bg-slate-200 px-2.5 py-1 rounded-lg font-medium transition-colors"
          >
            student1@university.edu
          </button>
        </div>

        {lookupError && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
            <AlertTriangle className="text-rose-600 flex-shrink-0" size={16} />
            <span>{lookupError}</span>
          </div>
        )}
      </div>

      {/* Patron Summary & Eligibility Banner */}
      {studentData?.student && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0 font-bold text-xl border border-indigo-200 shadow-sm">
                {studentData.student.first_name?.[0] || 'S'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{studentData.student.name}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 uppercase">
                    {studentData.student.role}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                    studentData.student.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {studentData.student.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-1 gap-x-4 mt-2 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <GraduationCap size={14} className="text-slate-400" />
                    <strong>ID / Roll:</strong> {studentData.student.student_id || `User #${studentData.student.id}`}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 size={14} className="text-slate-400" />
                    <strong>Dept:</strong> {studentData.student.department || 'CSE'} ({studentData.student.degree_type || 'BE'})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail size={14} className="text-slate-400" />
                    {studentData.student.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Quota & Fine Badges */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center min-w-[100px]">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Active Loans</p>
                <p className="text-lg font-bold text-slate-800">
                  {studentData.stats?.active_loans_count} / {studentData.stats?.max_limit}
                </p>
              </div>

              <div className={`px-4 py-2.5 border rounded-xl text-center min-w-[100px] ${
                studentData.stats?.overdue_count > 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <p className="text-[11px] font-semibold uppercase">Overdue</p>
                <p className="text-lg font-bold">
                  {studentData.stats?.overdue_count}
                </p>
              </div>

              <div className={`px-4 py-2.5 border rounded-xl text-center min-w-[110px] ${
                studentData.stats?.unpaid_fines > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <p className="text-[11px] font-semibold uppercase">Unpaid Fines</p>
                <p className="text-lg font-bold">
                  ₹{Number(studentData.stats?.unpaid_fines || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Overdue / Fine Alert Warnings */}
          {studentData.stats?.overdue_count > 0 && (
            <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle className="text-rose-600 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="font-bold">Overdue Books Warning</p>
                <p className="mt-0.5">
                  Patron currently has {studentData.stats.overdue_count} overdue book(s). Company library regulations require outstanding overdue items to be returned or cleared prior to issuing new materials.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 & 3: Issue Tabs & Loan Configuration */}
          <div className="mt-6">
            <div className="flex items-center justify-between border-b border-slate-200 mb-6 flex-wrap gap-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('reservations')}
                  className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                    activeTab === 'reservations'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Bookmark size={16} />
                  <span>Reserved by Student</span>
                  <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                    {studentData.reservations?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('direct')}
                  className={`pb-3 px-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                    activeTab === 'direct'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Barcode size={16} />
                  <span>Direct Accession Issue</span>
                </button>
              </div>

              {/* Loan Days Configuration */}
              <div className="flex items-center gap-3 pb-2">
                <span className="text-xs font-bold text-slate-700">Loan Period:</span>
                <div className="flex items-center gap-1.5">
                  {[7, 14, 21, 30, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setLoanDays(days)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all border ${
                        Number(loanDays) === days
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Live Due Date Banner */}
            <div className="mb-6 p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900">
              <span className="flex items-center gap-2">
                <Calendar size={15} className="text-teal-700" />
                <span>Calculated Due Date:</span>
                <strong className="text-teal-950 font-bold">{calculatedDueDate}</strong>
                <span>({loanDays} days tenure)</span>
              </span>
              <span className="text-[11px] text-teal-700 font-medium">Standard Daily Overdue Fine: ₹1.00/day</span>
            </div>

            {issueError && (
              <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2.5">
                <AlertTriangle className="text-rose-600 flex-shrink-0" size={16} />
                <span>{issueError}</span>
              </div>
            )}

            {/* TAB CONTENT A: Reservations Queue */}
            {activeTab === 'reservations' && (
              <div className="space-y-4">
                {studentData.reservations && studentData.reservations.length > 0 ? (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                    {studentData.reservations.map((resv) => (
                      <div
                        key={`${resv.source}-${resv.reservation_id}`}
                        className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center flex-shrink-0 font-bold">
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 text-sm">{resv.title}</h4>
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                resv.status === 'ready' || resv.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border-amber-300'
                              }`}>
                                {resv.status === 'ready' ? 'READY FOR PICKUP' : (resv.status === 'APPROVED' ? 'APPROVED RESEARCH' : `WAITING QUEUE #${resv.queue_position}`)}
                              </span>
                              {resv.source === 'research' && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                                  Research Thesis
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              By {resv.author} • ISBN: {resv.isbn || 'N/A'} • Accession: <strong>{resv.accession_no || `ACC-${resv.book_id}`}</strong>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Reserved: {format(new Date(resv.created_at), 'MMM dd, yyyy, hh:mm a')} • Shelf Copies: {resv.available_copies || 1} available
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleIssueReserved(resv)}
                            disabled={issuing}
                            className="btn bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                          >
                            <CheckCircle2 size={16} />
                            {issuing ? 'Processing...' : 'Confirm & Issue Book'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                    <Bookmark size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No Active Reservations for this Student</p>
                    <p className="text-xs text-slate-500 mt-1">
                      The patron has not placed any pending book reservations. You can directly issue a book from the shelf using the "Direct Accession Issue" tab.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT B: Direct Accession Counter Issue */}
            {activeTab === 'direct' && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Scan or Type Book Identifier (Accession No, Barcode, ISBN, or RFID Tag):
                  </label>
                  <div className="relative">
                    <Barcode className="absolute left-3.5 top-3.5 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={directIdentifier}
                      onChange={(e) => {
                        setDirectIdentifier(e.target.value);
                        setSelectedBook(null);
                      }}
                      placeholder="e.g. ACC-00001, BC-000001, 978-0132350884, or Book Title..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    />
                    {searchingBook && (
                      <RefreshCw size={16} className="absolute right-3.5 top-3.5 text-indigo-600 animate-spin" />
                    )}
                  </div>

                  {/* Autocomplete suggestions */}
                  {matchedBooks.length > 0 && !selectedBook && (
                    <div className="mt-2 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                      {matchedBooks.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedBook(b);
                            setDirectIdentifier(b.accession_no || b.barcode || String(b.id));
                            setMatchedBooks([]);
                          }}
                          className="p-3 hover:bg-indigo-50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{b.title}</p>
                            <p className="text-slate-500">
                              By {b.author} • Accession: {b.accession_no || `ACC-${b.id}`} • Barcode: {b.barcode || `BC-${b.id}`}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.available_copies > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {b.available_copies > 0 ? `${b.available_copies} available` : 'Checked out'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Book Card */}
                  {selectedBook && (
                    <div className="mt-4 p-4 bg-white border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                          Ready for Issuance
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{selectedBook.title}</h4>
                        <p className="text-xs text-slate-600">
                          Author: {selectedBook.author} • Accession: <strong>{selectedBook.accession_no}</strong> • Barcode: {selectedBook.barcode}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedBook(null)}
                        className="text-xs text-slate-400 hover:text-slate-600"
                      >
                        Change
                      </button>
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleDirectIssue}
                      disabled={issuing || (!selectedBook && !directIdentifier)}
                      className="btn bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2.5 px-6 rounded-xl flex items-center gap-2 shadow-sm transition-all"
                    >
                      <CheckCircle2 size={16} />
                      {issuing ? 'Issuing...' : 'Complete Direct Counter Issue'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction Printable Receipt Modal */}
      {showReceiptModal && receipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in duration-150">
            {/* Action Bar (Not Printed) */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 no-print">
              <div className="flex items-center gap-2 text-teal-700">
                <CheckCircle2 size={20} />
                <h3 className="font-bold text-base text-slate-900">Book Issued Successfully</h3>
              </div>
              <button
                type="button"
                onClick={handleResetDesk}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            {/* Official Printable Receipt Slip */}
            <div id="circulation-receipt-print" className="py-4 space-y-4 text-slate-800">
              <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
                <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">Automated Library System</p>
                <h2 className="text-lg font-black tracking-tight text-slate-900 uppercase">Circulation Issue Receipt</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Campus Central Library • Counter Circulation Desk</p>
              </div>

              <div className="grid grid-cols-2 text-xs gap-y-1.5 py-1">
                <div>
                  <span className="text-slate-500">Receipt No:</span>
                  <p className="font-mono font-bold text-slate-900">{receipt.receipt_no}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Issue Date:</span>
                  <p className="font-bold text-slate-900">{receipt.issue_date}</p>
                </div>
                <div>
                  <span className="text-slate-500">Student Name:</span>
                  <p className="font-bold text-slate-900">{receipt.student?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Student Roll / ID:</span>
                  <p className="font-mono font-bold text-slate-900">{receipt.student?.student_id || receipt.student?.id}</p>
                </div>
                <div>
                  <span className="text-slate-500">Department:</span>
                  <p className="font-medium text-slate-800">{receipt.student?.department || 'CSE'} ({receipt.student?.degree_type || 'BE'})</p>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Loan Tenure:</span>
                  <p className="font-bold text-indigo-700">{receipt.loan_days} Days</p>
                </div>
              </div>

              {/* Book Details Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Issued Book Details</p>
                <p className="font-bold text-slate-900 text-sm leading-snug">{receipt.book?.title}</p>
                <p className="text-slate-600">Author: {receipt.book?.author}</p>
                <div className="flex justify-between pt-1 font-mono text-[11px] text-slate-700">
                  <span>Accession: <strong>{receipt.book?.accession_no}</strong></span>
                  <span>Barcode: {receipt.book?.barcode}</span>
                </div>
              </div>

              {/* Due Date Notice Box */}
              <div className="p-3 bg-rose-50 border-2 border-rose-200 rounded-xl text-center">
                <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Mandatory Return Due Date</p>
                <p className="text-lg font-black text-rose-950 mt-0.5">{receipt.due_date}</p>
                <p className="text-[10px] text-rose-700 mt-0.5">
                  Overdue fine: ₹1.00/day after this date. Please return or renew on time.
                </p>
              </div>

              <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-center text-[10px] text-slate-500">
                <span>Issued by: {receipt.issuer?.name} ({receipt.issuer?.role})</span>
                <span>Thank you for using the library!</span>
              </div>
            </div>

            {/* Modal Buttons (Not Printed) */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-3 no-print">
              <button
                type="button"
                onClick={handlePrintReceipt}
                className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Printer size={16} />
                <span>Print Official Receipt</span>
              </button>

              <button
                type="button"
                onClick={handleResetDesk}
                className="btn bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs py-2.5 px-4 rounded-xl transition-colors"
              >
                Next Patron / Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student QR Card Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <QrCode size={20} />
                <span>Scan Digital Student Card</span>
              </div>
              <button
                type="button"
                onClick={() => setShowScannerModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="py-6 text-center">
              <div className="w-48 h-48 mx-auto border-4 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center bg-indigo-50/50 p-4 relative overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500 animate-pulse" />
                <QrCode size={64} className="text-indigo-600 mb-2" />
                <span className="text-xs font-semibold text-indigo-900">Position Student QR Here</span>
                <span className="text-[10px] text-indigo-600/80 mt-1">Automatic Barcode/QR recognition</span>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Scan the barcode on the physical library ID card or the digital QR from the student's mobile dashboard.
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-slate-200">
              <p className="text-xs font-bold text-slate-700">Simulate Hardware Scanner Input:</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowScannerModal(false);
                    setSearchQuery('STU001');
                    handleLookup('STU001');
                  }}
                  className="flex-1 btn bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold py-2 rounded-xl border border-indigo-200"
                >
                  Scan STU001 (UG Student)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClerkIssueDesk;

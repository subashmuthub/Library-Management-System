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
  GraduationCap,
  DollarSign,
  FileText,
  AlertOctagon,
  UserCheck,
  UserX,
  CreditCard,
  ArrowLeftRight,
  Layers,
  Lock,
  Unlock,
  Send,
  Archive,
  Compass
} from 'lucide-react';
import { format, addDays } from 'date-fns';

const ClerkIssueDesk = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Current logged in clerk/user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }, []);

  // Primary Suite Tabs: 'issue' | 'return' | 'holds' | 'cash' | 'inventory' | 'passes'
  const [suiteTab, setSuiteTab] = useState('issue');

  // Shift Statistics & Status
  const [shiftSummary, setShiftSummary] = useState(null);
  const [loadingShift, setLoadingShift] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [handoverReceipt, setHandoverReceipt] = useState(null);

  // ---------------------------------------------------------------------------
  // TAB 1: STUDENT ISSUE & RESERVATION DESK STATE
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState(searchParams.get('student') || searchParams.get('search') || '');
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [issueDeskSubTab, setIssueDeskSubTab] = useState('reservations'); // 'reservations' | 'direct'
  const [directIdentifier, setDirectIdentifier] = useState('');
  const [searchingBook, setSearchingBook] = useState(false);
  const [matchedBooks, setMatchedBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [loanDays, setLoanDays] = useState(14);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState(null);

  // Desk Hold modal state
  const [showDeskHoldModal, setShowDeskHoldModal] = useState(false);
  const [deskHoldReasonInput, setDeskHoldReasonInput] = useState('');
  const [updatingDeskHold, setUpdatingDeskHold] = useState(false);

  // Issue Receipt Modal state
  const [receipt, setReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 2: MANUAL FALLBACK & QUICK RETURN STATE
  // ---------------------------------------------------------------------------
  const [returnIdentifier, setReturnIdentifier] = useState('');
  const [returnCondition, setReturnCondition] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [applyReplacementFee, setApplyReplacementFee] = useState(false);
  const [replacementFeeAmount, setReplacementFeeAmount] = useState(250);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnResult, setReturnResult] = useState(null);
  const [returnError, setReturnError] = useState(null);

  // ---------------------------------------------------------------------------
  // TAB 3: HOLD SHELF STATE
  // ---------------------------------------------------------------------------
  const [holdShelfItems, setHoldShelfItems] = useState([]);
  const [loadingHoldShelf, setLoadingHoldShelf] = useState(false);
  const [holdAuditMessage, setHoldAuditMessage] = useState(null);

  // ---------------------------------------------------------------------------
  // TAB 4: CASH DESK & FINE DISPUTES STATE
  // ---------------------------------------------------------------------------
  const [cashDeskSubTab, setCashDeskSubTab] = useState('collect'); // 'collect' | 'disputes'
  const [fineLookupQuery, setFineLookupQuery] = useState('');
  const [fineLookupResult, setFineLookupResult] = useState(null);
  const [selectedFineForCash, setSelectedFineForCash] = useState(null);
  const [cashAmountInput, setCashAmountInput] = useState('');
  const [cashNotesInput, setCashNotesInput] = useState('');
  const [collectingCash, setCollectingCash] = useState(false);
  const [cashReceipt, setCashReceipt] = useState(null);
  const [showCashReceiptModal, setShowCashReceiptModal] = useState(false);

  // Fine dispute modal
  const [selectedFineForDispute, setSelectedFineForDispute] = useState(null);
  const [disputeCategory, setDisputeCategory] = useState('System Error');
  const [disputeReasonText, setDisputeReasonText] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeList, setDisputeList] = useState([]);
  const [loadingDisputes, setLoadingDisputes] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 5: INVENTORY & MISPLACED STATE
  // ---------------------------------------------------------------------------
  const [flaggedInventory, setFlaggedInventory] = useState([]);
  const [loadingFlagged, setLoadingFlagged] = useState(false);
  const [misplacedIdentifier, setMisplacedIdentifier] = useState('');
  const [misplacedNotesInput, setMisplacedNotesInput] = useState('');
  const [flaggingMisplaced, setFlaggingMisplaced] = useState(false);
  const [inventoryMessage, setInventoryMessage] = useState(null);

  // ---------------------------------------------------------------------------
  // TAB 6: GUEST PASSES STATE
  // ---------------------------------------------------------------------------
  const [guestPasses, setGuestPasses] = useState([]);
  const [loadingPasses, setLoadingPasses] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestType, setGuestType] = useState('VISITOR');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestInstitution, setGuestInstitution] = useState('');
  const [guestPurpose, setGuestPurpose] = useState('');
  const [guestRfidBadge, setGuestRfidBadge] = useState('');
  const [guestValidHours, setGuestValidHours] = useState(12);
  const [issuingPass, setIssuingPass] = useState(false);
  const [passMessage, setPassMessage] = useState(null);

  // ---------------------------------------------------------------------------
  // INITIAL LOAD & SHIFT REFRESH
  // ---------------------------------------------------------------------------
  const fetchShiftSummary = async () => {
    setLoadingShift(true);
    try {
      const res = await circulationService.getShiftSummary();
      if (res.success) {
        setShiftSummary(res);
      }
    } catch (err) {
      console.error('Failed to load shift summary:', err);
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    fetchShiftSummary();
  }, []);

  // Compute calculated due date for issue desk
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

  // Tab switch effect: fetch respective tab datasets
  useEffect(() => {
    if (suiteTab === 'holds') {
      fetchHoldShelf();
    } else if (suiteTab === 'cash') {
      fetchDisputes();
    } else if (suiteTab === 'inventory') {
      fetchFlaggedInventory();
    } else if (suiteTab === 'passes') {
      fetchGuestPasses();
    }
  }, [suiteTab]);

  // ---------------------------------------------------------------------------
  // MODULE 1 METHODS: STUDENT ISSUE & DESK HOLD
  // ---------------------------------------------------------------------------
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

  // Direct issue autocomplete
  useEffect(() => {
    if (issueDeskSubTab !== 'direct' || !directIdentifier || directIdentifier.length < 2) {
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
  }, [directIdentifier, issueDeskSubTab]);

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
        fetchShiftSummary();
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
        fetchShiftSummary();
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

  const handleToggleDeskHold = async (applyHold) => {
    if (!studentData?.student?.id) return;
    setUpdatingDeskHold(true);
    try {
      const res = await circulationService.setDeskHold({
        user_id: studentData.student.id,
        has_desk_hold: applyHold,
        reason: applyHold ? (deskHoldReasonInput || 'Account blocked by circulation desk') : null
      });
      if (res.success) {
        setShowDeskHoldModal(false);
        setDeskHoldReasonInput('');
        await handleLookup(studentData.student.student_id || studentData.student.id);
      }
    } catch (err) {
      console.error('Desk hold toggle failed:', err);
      alert(err.response?.data?.message || 'Failed to update desk hold.');
    } finally {
      setUpdatingDeskHold(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 2 METHODS: MANUAL HARDWARE FALLBACK RETURN
  // ---------------------------------------------------------------------------
  const handleManualReturn = async (e) => {
    e.preventDefault();
    if (!returnIdentifier.trim()) {
      setReturnError('Please enter a Barcode, Accession No, or Book ID.');
      return;
    }

    setProcessingReturn(true);
    setReturnError(null);
    setReturnResult(null);

    try {
      const res = await circulationService.manualReturn({
        identifier: returnIdentifier.trim(),
        condition: returnCondition,
        notes: returnNotes,
        apply_replacement_fee: applyReplacementFee,
        fee_amount: Number(replacementFeeAmount) || 0
      });

      if (res.success) {
        setReturnResult(res);
        setReturnIdentifier('');
        setReturnNotes('');
        setApplyReplacementFee(false);
        fetchShiftSummary();
      } else {
        setReturnError(res.message || 'Book return failed.');
      }
    } catch (err) {
      console.error('Manual return failed:', err);
      setReturnError(err.response?.data?.message || err.response?.data?.error || 'Manual return failed.');
    } finally {
      setProcessingReturn(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 3 METHODS: HOLD SHELF
  // ---------------------------------------------------------------------------
  const fetchHoldShelf = async () => {
    setLoadingHoldShelf(true);
    try {
      const res = await circulationService.getHoldShelf();
      if (res.success) {
        setHoldShelfItems(res.items || []);
      }
    } catch (err) {
      console.error('Failed to load hold shelf:', err);
    } finally {
      setLoadingHoldShelf(false);
    }
  };

  const handleExpireHoldCheck = async () => {
    try {
      const res = await circulationService.expireHoldShelfCheck();
      if (res.success) {
        setHoldAuditMessage(res.message);
        fetchHoldShelf();
      }
    } catch (err) {
      console.error('Expire hold check error:', err);
      alert('Failed to run hold expiration check.');
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 4 METHODS: CASH DESK & FINE DISPUTES
  // ---------------------------------------------------------------------------
  const handleFindFinesForStudent = async () => {
    if (!fineLookupQuery.trim()) return;
    try {
      const res = await circulationService.studentLookup(fineLookupQuery.trim());
      if (res.success && res.student) {
        setFineLookupResult(res);
      } else {
        setFineLookupResult(null);
        alert('Student not found.');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to lookup student fines.');
    }
  };

  const handleOpenCashModal = (fine) => {
    setSelectedFineForCash(fine);
    setCashAmountInput(fine.amount);
    setCashNotesInput(`Settlement for fine #${fine.id} (${fine.fine_type || 'overdue'})`);
  };

  const handleConfirmCashCollection = async () => {
    if (!selectedFineForCash) return;
    setCollectingCash(true);
    try {
      const res = await circulationService.collectCash({
        fine_id: selectedFineForCash.id,
        student_id: fineLookupResult?.student?.id || selectedFineForCash.user_id,
        amount_received: Number(cashAmountInput) || Number(selectedFineForCash.amount),
        receipt_notes: cashNotesInput
      });

      if (res.success && res.receipt) {
        setCashReceipt(res.receipt);
        setShowCashReceiptModal(true);
        setSelectedFineForCash(null);
        fetchShiftSummary();
        if (fineLookupResult?.student?.id) {
          handleFindFinesForStudent();
        }
      }
    } catch (err) {
      console.error('Cash collection error:', err);
      alert(err.response?.data?.message || 'Cash collection failed.');
    } finally {
      setCollectingCash(false);
    }
  };

  const handleOpenDisputeModal = (fine) => {
    setSelectedFineForDispute(fine);
    setDisputeCategory('System Error');
    setDisputeReasonText('');
  };

  const handleConfirmDispute = async () => {
    if (!selectedFineForDispute) return;
    setSubmittingDispute(true);
    try {
      const res = await circulationService.disputeFine({
        fine_id: selectedFineForDispute.id,
        reason_category: disputeCategory,
        reason_text: disputeReasonText
      });

      if (res.success) {
        alert(res.message);
        setSelectedFineForDispute(null);
        fetchShiftSummary();
        fetchDisputes();
        if (fineLookupResult?.student?.id) {
          handleFindFinesForStudent();
        }
      }
    } catch (err) {
      console.error('Dispute submission error:', err);
      alert(err.response?.data?.message || 'Failed to submit fine dispute.');
    } finally {
      setSubmittingDispute(false);
    }
  };

  const fetchDisputes = async () => {
    setLoadingDisputes(true);
    try {
      const res = await circulationService.getFineDisputes();
      if (res.success) {
        setDisputeList(res.disputes || []);
      }
    } catch (err) {
      console.error('Failed to load fine disputes:', err);
    } finally {
      setLoadingDisputes(false);
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 5 METHODS: INVENTORY & MISPLACED
  // ---------------------------------------------------------------------------
  const fetchFlaggedInventory = async () => {
    setLoadingFlagged(true);
    try {
      const res = await circulationService.getFlaggedInventory();
      if (res.success) {
        setFlaggedInventory(res.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch flagged inventory:', err);
    } finally {
      setLoadingFlagged(false);
    }
  };

  const handleFlagMisplaced = async (e) => {
    e.preventDefault();
    if (!misplacedIdentifier.trim()) {
      alert('Please enter Book Barcode or Accession Number.');
      return;
    }
    setFlaggingMisplaced(true);
    setInventoryMessage(null);
    try {
      const res = await circulationService.flagMisplaced({
        identifier: misplacedIdentifier.trim(),
        misplaced_notes: misplacedNotesInput.trim()
      });
      if (res.success) {
        setInventoryMessage(res.message);
        setMisplacedIdentifier('');
        setMisplacedNotesInput('');
        fetchFlaggedInventory();
      }
    } catch (err) {
      console.error('Flag misplaced error:', err);
      alert(err.response?.data?.message || 'Failed to flag book as misplaced.');
    } finally {
      setFlaggingMisplaced(false);
    }
  };

  const handleResolveMisplaced = async (identifier) => {
    try {
      const res = await circulationService.resolveMisplaced({ identifier });
      if (res.success) {
        alert(res.message);
        fetchFlaggedInventory();
      }
    } catch (err) {
      console.error('Resolve misplaced error:', err);
      alert(err.response?.data?.message || 'Failed to restore book.');
    }
  };

  // ---------------------------------------------------------------------------
  // MODULE 6 METHODS: GUEST PASSES
  // ---------------------------------------------------------------------------
  const fetchGuestPasses = async () => {
    setLoadingPasses(true);
    try {
      const res = await circulationService.getGuestPasses();
      if (res.success) {
        setGuestPasses(res.passes || []);
      }
    } catch (err) {
      console.error('Failed to load guest passes:', err);
    } finally {
      setLoadingPasses(false);
    }
  };

  const handleIssueGuestPass = async (e) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim()) {
      alert('Guest name and contact phone number are required.');
      return;
    }
    setIssuingPass(true);
    setPassMessage(null);
    try {
      const res = await circulationService.issueGuestPass({
        guest_name: guestName.trim(),
        guest_type: guestType,
        phone: guestPhone.trim(),
        email: guestEmail.trim(),
        institution: guestInstitution.trim(),
        purpose: guestPurpose.trim(),
        assigned_rfid_card_id: guestRfidBadge.trim(),
        valid_hours: Number(guestValidHours) || 12
      });

      if (res.success) {
        setPassMessage(res.message);
        setGuestName('');
        setGuestPhone('');
        setGuestEmail('');
        setGuestInstitution('');
        setGuestPurpose('');
        setGuestRfidBadge('');
        fetchGuestPasses();
        fetchShiftSummary();
      }
    } catch (err) {
      console.error('Issue pass error:', err);
      alert(err.response?.data?.message || 'Failed to issue guest pass.');
    } finally {
      setIssuingPass(false);
    }
  };

  const handleReturnGuestPass = async (id) => {
    try {
      const res = await circulationService.returnGuestPass(id);
      if (res.success) {
        fetchGuestPasses();
      }
    } catch (err) {
      console.error('Return pass error:', err);
      alert('Failed to mark pass returned.');
    }
  };

  // ---------------------------------------------------------------------------
  // SHIFT HANDOVER SUBMISSION
  // ---------------------------------------------------------------------------
  const handleSubmitHandover = async () => {
    setSubmittingHandover(true);
    try {
      const metrics = shiftSummary?.metrics || {};
      const res = await circulationService.submitShiftHandover({
        shift_start: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        shift_end: new Date().toISOString(),
        books_issued_count: metrics.books_issued_count || 0,
        books_returned_count: metrics.books_returned_count || 0,
        cash_collected: metrics.cash_collected || 0,
        damaged_books_count: metrics.damaged_books_count || 0,
        handover_notes: handoverNotes
      });

      if (res.success) {
        setHandoverReceipt({
          id: res.handover_id,
          submitted_at: res.submitted_at,
          clerk: currentUser,
          metrics,
          notes: handoverNotes
        });
        setHandoverNotes('');
      }
    } catch (err) {
      console.error('Handover error:', err);
      alert('Failed to submit shift handover report.');
    } finally {
      setSubmittingHandover(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 text-slate-800">
      {/* Print-Only Style Definition */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            padding: 24px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HEADER & LIVE SHIFT STATUS BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700">
              <Compass className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Advanced Circulation Desk Suite</h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Counter Active
                </span>
              </div>
              <p className="text-sm text-slate-500">
                Logged in: <span className="font-semibold text-slate-700">{currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : 'Circulation Clerk'}</span> ({currentUser.email || 'clerk@library.edu'})
              </p>
            </div>
          </div>

          {/* Real-Time Shift Statistics Counters */}
          <div className="flex items-center flex-wrap gap-2 lg:gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[90px]">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Issued Today</p>
              <p className="text-lg font-bold text-indigo-700">{shiftSummary?.metrics?.books_issued_count ?? '0'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[90px]">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Returned Today</p>
              <p className="text-lg font-bold text-emerald-700">{shiftSummary?.metrics?.books_returned_count ?? '0'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[110px]">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Cash Collected</p>
              <p className="text-lg font-bold text-amber-700">₹{shiftSummary?.metrics?.cash_collected ?? '0'}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-center min-w-[90px]">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Damaged</p>
              <p className="text-lg font-bold text-rose-700">{shiftSummary?.metrics?.damaged_books_count ?? '0'}</p>
            </div>

            <button
              onClick={() => {
                fetchShiftSummary();
                setShowShiftModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              <ArrowLeftRight className="h-4 w-4 text-amber-400" />
              <span>Shift Handover</span>
            </button>
          </div>
        </div>

        {/* SUITE NAVIGATION TABS */}
        <div className="flex items-center gap-1 sm:gap-2 mt-5 pt-4 border-t border-slate-100 overflow-x-auto">
          {[
            { id: 'issue', label: 'Student Issue Desk', icon: BookOpen },
            { id: 'return', label: 'Hardware Fallback Return', icon: Barcode },
            { id: 'holds', label: 'Hold Shelf Queue', icon: Clock },
            { id: 'cash', label: 'Cash Desk & Disputes', icon: DollarSign },
            { id: 'inventory', label: 'Inventory & Misplaced', icon: Layers },
            { id: 'passes', label: 'Guest & Alumni Passes', icon: CreditCard },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = suiteTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSuiteTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200'
                    : 'bg-slate-100/70 hover:bg-slate-200/80 text-slate-600'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: STUDENT ISSUE & RESERVATION DESK */}
      {/* ===================================================================== */}
      {suiteTab === 'issue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Student Lookup & Account Status */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                Patron Identification
              </h2>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Scan Card or Enter Student ID</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                      placeholder="e.g. STU001 or roll no"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    onClick={() => handleLookup()}
                    disabled={loadingStudent}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
                  >
                    {loadingStudent ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Find'}
                  </button>
                </div>
              </div>

              {lookupError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{lookupError}</span>
                </div>
              )}

              {/* Student Profile Card */}
              {studentData?.student && (
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  {/* Desk Hold Banner If Active */}
                  {studentData.student.has_desk_hold && (
                    <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-900 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5 text-rose-700">
                          <Lock className="h-4 w-4" /> Account Blocked
                        </span>
                        <button
                          onClick={() => handleToggleDeskHold(false)}
                          disabled={updatingDeskHold}
                          className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 rounded-lg font-bold hover:bg-rose-100 transition"
                        >
                          Lift Hold
                        </button>
                      </div>
                      <p className="font-semibold text-rose-800">Account Blocked: Please see the Circulation Desk.</p>
                      {studentData.student.desk_hold_reason && (
                        <p className="text-[11px] text-rose-600">Reason: {studentData.student.desk_hold_reason}</p>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{studentData.student.name}</h3>
                      <p className="text-xs text-slate-500">{studentData.student.email}</p>
                      <p className="text-xs font-mono text-indigo-700 mt-0.5">ID: {studentData.student.student_id || `#${studentData.student.id}`}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs font-bold uppercase rounded-md bg-slate-100 text-slate-700">
                      {studentData.student.role}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500 block">Department</span>
                      <span className="font-semibold text-slate-800">{studentData.student.department || 'General'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg">
                      <span className="text-slate-500 block">Program</span>
                      <span className="font-semibold text-slate-800">{studentData.student.degree_type || 'BE'} - {studentData.student.academic_year || 'Year 1'}</span>
                    </div>
                  </div>

                  {/* Quota & Fine Indicator */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg">
                      <span className="text-slate-500 block text-[10px]">Active Loans</span>
                      <span className="font-bold text-indigo-700 text-sm">{studentData.stats?.active_loans_count || 0} / {studentData.stats?.max_limit || 6}</span>
                    </div>
                    <div className={`p-2 rounded-lg border ${studentData.stats?.overdue_count > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-slate-500 block text-[10px]">Overdue</span>
                      <span className={`font-bold text-sm ${studentData.stats?.overdue_count > 0 ? 'text-rose-700' : 'text-slate-700'}`}>{studentData.stats?.overdue_count || 0}</span>
                    </div>
                    <div className={`p-2 rounded-lg border ${studentData.stats?.unpaid_fines > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                      <span className="text-slate-500 block text-[10px]">Fines</span>
                      <span className={`font-bold text-sm ${studentData.stats?.unpaid_fines > 0 ? 'text-amber-700' : 'text-slate-700'}`}>₹{studentData.stats?.unpaid_fines || 0}</span>
                    </div>
                  </div>

                  {/* Desk Hold Action Button */}
                  {!studentData.student.has_desk_hold && (
                    <button
                      onClick={() => setShowDeskHoldModal(true)}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Lock className="h-3.5 w-3.5 text-rose-600" />
                      <span>Place Circulation Desk Hold</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick Pending Fines Section for this student */}
            {studentData?.pending_fines?.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-amber-600" />
                    Unpaid Fines ({studentData.pending_fines.length})
                  </h4>
                  <button
                    onClick={() => {
                      setFineLookupQuery(studentData.student.student_id || studentData.student.email);
                      setFineLookupResult(studentData);
                      setSuiteTab('cash');
                    }}
                    className="text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    Cash Desk
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {studentData.pending_fines.map((f) => (
                    <div key={f.id} className="p-2.5 bg-white border border-amber-100 rounded-xl text-xs flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-800">₹{f.amount} - {f.fine_type}</p>
                        <p className="text-[11px] text-slate-500">{f.book_title || f.reason}</p>
                      </div>
                      <button
                        onClick={() => {
                          setFineLookupResult(studentData);
                          handleOpenCashModal(f);
                          setSuiteTab('cash');
                        }}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold"
                      >
                        Collect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Physical Issue Console */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Tab Selector: Reservations Queue vs Direct Accession Scan */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setIssueDeskSubTab('reservations')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      issueDeskSubTab === 'reservations'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Approved Reservations Queue ({studentData?.reservations?.length || 0})
                  </button>
                  <button
                    onClick={() => setIssueDeskSubTab('direct')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      issueDeskSubTab === 'direct'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Direct On-Shelf Issue
                  </button>
                </div>

                {/* Loan Duration Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <span className="font-semibold text-slate-600">Loan Days:</span>
                  <select
                    value={loanDays}
                    onChange={(e) => setLoanDays(e.target.value)}
                    className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={7}>7 Days (Reserve)</option>
                    <option value={14}>14 Days (Standard)</option>
                    <option value={30}>30 Days (ME / Scholar)</option>
                    <option value={60}>60 Days (Faculty)</option>
                  </select>
                </div>
              </div>

              {issueError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertOctagon className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Cannot Issue Book</p>
                    <p>{issueError}</p>
                  </div>
                </div>
              )}

              {/* Sub-View A: Reservations Queue */}
              {issueDeskSubTab === 'reservations' && (
                <div className="space-y-4">
                  {!studentData ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                      <User className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-600">Look up a student to view active reservations</p>
                      <p className="text-xs text-slate-400">Scan student library card or enter student roll number on the left</p>
                    </div>
                  ) : studentData.reservations?.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
                      <Bookmark className="h-8 w-8 text-slate-300 mx-auto" />
                      <p className="text-sm font-semibold text-slate-600">No active or approved reservations for this student</p>
                      <p className="text-xs text-slate-400">Switch to "Direct On-Shelf Issue" to scan and issue an available book</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {studentData.reservations.map((resv) => (
                        <div
                          key={resv.reservation_id}
                          className="p-4 bg-slate-50/70 border border-slate-200 hover:border-indigo-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase ${
                                resv.source === 'research' ? 'bg-purple-100 text-purple-700' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                {resv.source === 'research' ? 'Research Paper' : 'Book Reservation'}
                              </span>
                              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                {resv.status}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{resv.title}</h4>
                            <p className="text-xs text-slate-500">By {resv.author} • ISBN: {resv.isbn || 'N/A'}</p>
                            <p className="text-[11px] font-mono text-indigo-600">Accession: {resv.accession_no || `ACC-${String(resv.book_id).padStart(5, '0')}`}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleIssueReserved(resv)}
                              disabled={issuing || studentData.student.has_desk_hold}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                studentData.student.has_desk_hold
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                              }`}
                            >
                              <BookOpen className="h-3.5 w-3.5" />
                              <span>{issuing ? 'Processing...' : 'Handover & Issue'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-View B: Direct On-Shelf Issue */}
              {issueDeskSubTab === 'direct' && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">Scan Barcode / Enter Accession Number</label>
                    <div className="relative">
                      <Barcode className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={directIdentifier}
                        onChange={(e) => setDirectIdentifier(e.target.value)}
                        placeholder="Scan book barcode, accession no (e.g. ACC-00001), or search title"
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Matched book autocomplete dropdown */}
                  {matchedBooks.length > 0 && !selectedBook && (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto bg-white shadow-md">
                      {matchedBooks.map((b) => (
                        <div
                          key={b.id}
                          onClick={() => {
                            setSelectedBook(b);
                            setDirectIdentifier(b.accession_no || b.barcode || b.title);
                            setMatchedBooks([]);
                          }}
                          className="p-3 hover:bg-indigo-50/50 cursor-pointer flex items-center justify-between text-xs transition"
                        >
                          <div>
                            <p className="font-bold text-slate-800">{b.title}</p>
                            <p className="text-slate-500">By {b.author} • Acc: {b.accession_no || b.barcode}</p>
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

                  {/* Selected Book Confirmation Box */}
                  {selectedBook && (
                    <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-indigo-700 tracking-wider">Ready for Handover</span>
                        <h4 className="text-sm font-bold text-slate-900 mt-0.5">{selectedBook.title}</h4>
                        <p className="text-xs text-slate-600">Accession No: {selectedBook.accession_no || selectedBook.barcode || 'N/A'}</p>
                      </div>
                      <button
                        onClick={() => setSelectedBook(null)}
                        className="p-1 hover:bg-indigo-100 rounded-lg text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Calculated Due Date: <span className="font-semibold text-slate-800">{calculatedDueDate}</span>
                    </p>
                    <button
                      onClick={handleDirectIssue}
                      disabled={issuing || !studentData?.student?.id || studentData.student.has_desk_hold}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                        studentData?.student?.has_desk_hold
                          ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{issuing ? 'Processing...' : 'Complete Physical Issuance'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: MANUAL HARDWARE FALLBACK & QUICK RETURN */}
      {/* ===================================================================== */}
      {suiteTab === 'return' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Offline Hardware Fallback
                </span>
                <h2 className="text-base font-bold text-slate-900">Manual Book Return & Condition Inspection</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Process book returns manually via Barcode, ISBN, or Accession Number when RFID gates/scanners are offline.
              </p>
            </div>

            <form onSubmit={handleManualReturn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Book Identifier (Barcode / Accession No / ISBN / ID)</label>
                <div className="relative">
                  <Barcode className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={returnIdentifier}
                    onChange={(e) => setReturnIdentifier(e.target.value)}
                    placeholder="e.g. BC-000001 or ACC-00001 or 978-0131103627"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Physical Condition Inspection Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Physical Condition of Returned Book</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'good', label: 'Good / Normal', color: 'border-emerald-300 text-emerald-700 bg-emerald-50/50' },
                    { id: 'damaged', label: 'Damaged / Torn', color: 'border-amber-300 text-amber-700 bg-amber-50/50' },
                    { id: 'lost', label: 'Reported Lost', color: 'border-rose-300 text-rose-700 bg-rose-50/50' },
                  ].map((cond) => (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setReturnCondition(cond.id)}
                      className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                        returnCondition === cond.id
                          ? `${cond.color} ring-2 ring-indigo-500`
                          : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Inspection & Locator Notes (Optional)</label>
                <input
                  type="text"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="e.g. Spine wear, missing page 45, or normal counter check"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Optional Replacement Fee for Damaged/Lost books */}
              {returnCondition !== 'good' && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="applyFee"
                      checked={applyReplacementFee}
                      onChange={(e) => setApplyReplacementFee(e.target.checked)}
                      className="rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <label htmlFor="applyFee" className="text-xs font-bold text-amber-900">
                      Charge Student Replacement Fee to Ledger
                    </label>
                  </div>
                  {applyReplacementFee && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-600">Fee Amount (₹):</span>
                      <input
                        type="number"
                        value={replacementFeeAmount}
                        onChange={(e) => setReplacementFeeAmount(e.target.value)}
                        className="w-28 px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {returnError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
                  {returnError}
                </div>
              )}

              <button
                type="submit"
                disabled={processingReturn}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                {processingReturn ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                <span>Process Return & Update Shelf Integrity</span>
              </button>
            </form>
          </div>

          {/* Right Column: Return Output & Hold Shelf Promotion Card */}
          <div className="lg:col-span-5 space-y-4">
            {returnResult ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <span>Return Successfully Logged</span>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <p className="font-bold text-slate-900 text-sm">{returnResult.book?.title}</p>
                  <p className="text-slate-500">Accession No: {returnResult.book?.accession_no || 'N/A'}</p>
                  <p className="text-slate-500">Condition: <span className="font-semibold uppercase">{returnResult.book?.condition}</span></p>
                  {returnResult.transaction && (
                    <p className="text-slate-500">Patron: <span className="font-semibold">{returnResult.transaction.patron_name}</span> ({returnResult.transaction.student_id})</p>
                  )}
                  {returnResult.fine_created && (
                    <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 font-semibold">
                      Fee Assessed: ₹{returnResult.fine_created.amount} ({returnResult.fine_created.type})
                    </div>
                  )}
                </div>

                {/* Hold Shelf Notification Banner */}
                {returnResult.on_hold_shelf && returnResult.hold_reservation && (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-900">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      <span>Promoted to Hold Shelf!</span>
                    </div>
                    <p>
                      This book was on reservation queue. It is now reserved for <span className="font-bold">{returnResult.hold_reservation.patron_name}</span>.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 rounded font-bold">
                        Pickup Window: 72 Hours
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-xs text-slate-500 space-y-2">
                <Archive className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Hardware Fallback Lifecycle Rules</p>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  When a book is returned in good condition and has an active reservation, the system automatically routes it to the <strong>Hold Shelf</strong> and starts a 72-hour countdown for the student.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: HOLD SHELF QUEUE */}
      {/* ===================================================================== */}
      {suiteTab === 'holds' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Hold Shelf Engine
                </span>
                <h2 className="text-base font-bold text-slate-900">Items Awaiting Physical Patron Pickup</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Books held behind the circulation counter for students with confirmed ready reservations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchHoldShelf}
                disabled={loadingHoldShelf}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingHoldShelf ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleExpireHoldCheck}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Run Expiration Audit</span>
              </button>
            </div>
          </div>

          {holdAuditMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
              <span>{holdAuditMessage}</span>
              <button onClick={() => setHoldAuditMessage(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loadingHoldShelf ? (
            <div className="py-12 text-center text-xs text-slate-500">Loading hold shelf...</div>
          ) : holdShelfItems.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No items currently on hold shelf</p>
              <p className="text-xs text-slate-400">Returned books with queued reservations will appear here automatically</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Book Title / Accession</th>
                    <th className="px-4 py-3">Reserving Patron</th>
                    <th className="px-4 py-3">Pickup Expiry</th>
                    <th className="px-4 py-3">Time Remaining</th>
                    <th className="px-4 py-3 text-right">Counter Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {holdShelfItems.map((item) => {
                    const hours = item.remaining_hours || 0;
                    const isUrgent = hours <= 24;
                    const isExpired = item.is_expired;

                    return (
                      <tr key={item.reservation_id} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-500">By {item.author} • Acc: {item.accession_no || item.barcode || 'N/A'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{item.patron_name}</p>
                          <p className="text-[11px] text-slate-500">{item.patron_student_id} • {item.patron_phone || item.patron_email}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {item.hold_expiry_date ? format(new Date(item.hold_expiry_date), 'MMM dd, yyyy HH:mm') : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                              Expired
                            </span>
                          ) : isUrgent ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px] animate-pulse">
                              {hours} hrs remaining (Urgent)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                              {hours} hrs remaining
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              setSearchQuery(item.patron_student_id || item.patron_name);
                              handleLookup(item.patron_student_id || item.patron_name);
                              setSuiteTab('issue');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                          >
                            Issue to Patron
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: CASH DESK & FINE DISPUTES */}
      {/* ===================================================================== */}
      {suiteTab === 'cash' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Circulation Cash Desk & Fine Disputes</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Collect cash payments with printable receipts, or process waivers under the ₹50 clerk threshold.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCashDeskSubTab('collect')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    cashDeskSubTab === 'collect'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Offline Cash Collection
                </button>
                <button
                  onClick={() => setCashDeskSubTab('disputes')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                    cashDeskSubTab === 'disputes'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Fine Disputes Log ({disputeList.length})
                </button>
              </div>
            </div>

            {/* Sub-View: Cash Collection & Fine Lookup */}
            {cashDeskSubTab === 'collect' && (
              <div className="space-y-6">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <label className="text-xs font-bold text-slate-700">Lookup Student for Fine Settlement</label>
                  <div className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      value={fineLookupQuery}
                      onChange={(e) => setFineLookupQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleFindFinesForStudent()}
                      placeholder="Student ID, Roll No, or Email"
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      onClick={handleFindFinesForStudent}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {fineLookupResult && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        Pending Fines for {fineLookupResult.student?.name} ({fineLookupResult.student?.student_id})
                      </h3>
                      <span className="text-xs font-bold text-amber-700">
                        Total Unpaid: ₹{fineLookupResult.stats?.unpaid_fines || 0}
                      </span>
                    </div>

                    {fineLookupResult.pending_fines?.length === 0 ? (
                      <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                        No pending fines on record for this student.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {fineLookupResult.pending_fines?.map((fine) => (
                          <div key={fine.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-amber-100 text-amber-800">
                                  {fine.fine_type || 'overdue'}
                                </span>
                                <h4 className="text-base font-bold text-slate-900 mt-1">₹{fine.amount}</h4>
                                <p className="text-xs text-slate-600">{fine.book_title || fine.reason}</p>
                              </div>
                              <span className="text-[11px] text-slate-400">ID #{fine.id}</span>
                            </div>

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleOpenCashModal(fine)}
                                className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                              >
                                Collect Cash
                              </button>
                              <button
                                onClick={() => handleOpenDisputeModal(fine)}
                                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                              >
                                Waive / Dispute
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sub-View: Disputes Log */}
            {cashDeskSubTab === 'disputes' && (
              <div className="space-y-4">
                {loadingDisputes ? (
                  <div className="py-8 text-center text-xs text-slate-500">Loading fine disputes...</div>
                ) : disputeList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500">No fine disputes recorded.</div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="px-4 py-3">Fine / Patron</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Resolved By</th>
                          <th className="px-4 py-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {disputeList.map((d) => (
                          <tr key={d.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{d.patron_name}</p>
                              <p className="text-[11px] text-slate-500">{d.patron_student_id} • {d.book_title || 'General Fine'}</p>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800">₹{d.amount}</td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-slate-700">{d.reason_category}</span>
                              {d.reason_text && <p className="text-[11px] text-slate-400">{d.reason_text}</p>}
                            </td>
                            <td className="px-4 py-3">
                              {d.status === 'WAIVED' ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                                  Waived (Direct)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                  Escalated to Chief Librarian
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{d.resolver_name || 'Pending Review'}</td>
                            <td className="px-4 py-3 text-slate-500">{format(new Date(d.created_at), 'MMM dd, yyyy')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: INVENTORY & MISPLACED */}
      {/* ===================================================================== */}
      {suiteTab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Flag Misplaced Book</h2>
              <p className="text-xs text-slate-500 mt-1">
                Instantly hides book from student catalog search with locator notes until restored by shelf audit.
              </p>
            </div>

            <form onSubmit={handleFlagMisplaced} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Book Identifier (Barcode / Accession No / ISBN / ID)</label>
                <input
                  type="text"
                  value={misplacedIdentifier}
                  onChange={(e) => setMisplacedIdentifier(e.target.value)}
                  placeholder="e.g. BC-000001 or ACC-00001"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Shelf Locator Notes</label>
                <textarea
                  rows={3}
                  value={misplacedNotesInput}
                  onChange={(e) => setMisplacedNotesInput(e.target.value)}
                  placeholder="e.g. Missing from Section C2. Suspected left in Reading Hall 2."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {inventoryMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  {inventoryMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={flaggingMisplaced}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {flaggingMisplaced ? 'Updating...' : 'Flag as Misplaced (Hide from Students)'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Damaged, Lost & Misplaced Items</h2>
                <p className="text-xs text-slate-500 mt-1">Audit log of titles removed from active circulation.</p>
              </div>
              <button
                onClick={fetchFlaggedInventory}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingFlagged ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading flagged inventory...</div>
            ) : flaggedInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No damaged, lost, or misplaced books found.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Book Details</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-right">Audit Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {flaggedInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-500">By {item.author} • Acc: {item.accession_no || item.barcode}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.status === 'misplaced' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-[11px]">
                          {item.misplaced_notes || 'Condition penalty assessed'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {item.status === 'misplaced' && (
                            <button
                              onClick={() => handleResolveMisplaced(item.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm"
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: GUEST & ALUMNI PASSES */}
      {/* ===================================================================== */}
      {suiteTab === 'passes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Issue Temporary Day Pass</h2>
              <p className="text-xs text-slate-500 mt-1">Register visitors, alumni, or researchers with temporary RFID badges.</p>
            </div>

            <form onSubmit={handleIssueGuestPass} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Guest Full Name *</label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Visitor Type</label>
                  <select
                    value={guestType}
                    onChange={(e) => setGuestType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="VISITOR">Visitor</option>
                    <option value="ALUMNI">Alumni</option>
                    <option value="RESEARCHER">External Researcher</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Institution / Organization</label>
                <input
                  type="text"
                  value={guestInstitution}
                  onChange={(e) => setGuestInstitution(e.target.value)}
                  placeholder="e.g. IIT Madras, Alumni 2020 Batch"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Assigned RFID Badge ID</label>
                  <input
                    type="text"
                    value={guestRfidBadge}
                    onChange={(e) => setGuestRfidBadge(e.target.value)}
                    placeholder="e.g. RFID-VIS-04"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Valid Hours</label>
                  <select
                    value={guestValidHours}
                    onChange={(e) => setGuestValidHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <option value={4}>4 Hours</option>
                    <option value={8}>8 Hours</option>
                    <option value={12}>12 Hours (Full Day)</option>
                  </select>
                </div>
              </div>

              {passMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                  {passMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={issuingPass}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {issuingPass ? 'Issuing Pass...' : 'Issue Day Pass Badge'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Active Day Passes</h2>
                <p className="text-xs text-slate-500 mt-1">Track visitor badges and check them back in.</p>
              </div>
              <button
                onClick={fetchGuestPasses}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {loadingPasses ? (
              <div className="py-8 text-center text-xs text-slate-500">Loading guest passes...</div>
            ) : guestPasses.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">No active guest passes found.</div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs divide-y divide-slate-200">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Pass No / Guest</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">RFID Badge</th>
                      <th className="px-4 py-3">Valid Until</th>
                      <th className="px-4 py-3 text-right">Badge Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {guestPasses.map((pass) => (
                      <tr key={pass.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{pass.guest_name}</p>
                          <p className="text-[11px] text-slate-500">{pass.pass_number} • {pass.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {pass.guest_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-indigo-700 text-xs">{pass.assigned_rfid_card_id || 'Physical Pass'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {format(new Date(pass.valid_until), 'MMM dd, HH:mm')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pass.status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleReturnGuestPass(pass.id)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
                            >
                              Return Badge
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-400">Returned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: PHYSICAL ISSUE RECEIPT */}
      {/* ===================================================================== */}
      {showReceiptModal && receipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div id="print-section" className="space-y-4">
              <div className="text-center border-b border-slate-200 pb-4">
                <h3 className="text-lg font-bold text-slate-900">SMART UNIVERSITY LIBRARY</h3>
                <p className="text-xs text-slate-500">Official Physical Loan Circulation Receipt</p>
                <p className="text-xs font-mono font-bold text-indigo-600 mt-1">{receipt.receipt_no}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Patron Name:</span>
                  <span className="font-bold text-slate-800">{receipt.student?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Student Roll / ID:</span>
                  <span className="font-bold text-slate-800">{receipt.student?.student_id || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Issue Date:</span>
                  <span className="font-bold text-slate-800">{receipt.issue_date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Due Date:</span>
                  <span className="font-bold text-rose-700">{receipt.due_date}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                <span className="text-slate-400 block">Book Title:</span>
                <span className="font-bold text-slate-900">{receipt.book?.title}</span>
                <p className="text-[11px] text-slate-500">Author: {receipt.book?.author} • Acc No: {receipt.book?.accession_no}</p>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 text-center">
                Issued by {receipt.issuer?.name} ({receipt.issuer?.role}) • Smart Circulation Desk
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: CASH COLLECTION MODAL & PRINTABLE RECEIPT */}
      {/* ===================================================================== */}
      {selectedFineForCash && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Collect Cash Fine Payment
              </h3>
              <button onClick={() => setSelectedFineForCash(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">Fine Assessment</span>
                  <span className="font-bold text-slate-900">{selectedFineForCash.book_title || selectedFineForCash.reason}</span>
                </div>
                <span className="text-base font-bold text-emerald-700">₹{selectedFineForCash.amount}</span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Cash Amount Received (₹)</label>
                <input
                  type="number"
                  value={cashAmountInput}
                  onChange={(e) => setCashAmountInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Receipt Notes</label>
                <input
                  type="text"
                  value={cashNotesInput}
                  onChange={(e) => setCashNotesInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleConfirmCashCollection}
                disabled={collectingCash}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{collectingCash ? 'Recording...' : 'Confirm Cash Received & Print Slip'}</span>
              </button>
              <button
                onClick={() => setSelectedFineForCash(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cash Receipt Printable Modal */}
      {showCashReceiptModal && cashReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div id="print-section" className="space-y-3 font-mono text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <h4 className="font-bold text-sm text-slate-900">SMART UNIVERSITY LIBRARY</h4>
                <p className="text-[10px] text-slate-500">Official Cash Collection Slip</p>
                <p className="font-bold text-indigo-700 mt-1">{cashReceipt.receipt_no}</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Patron:</span>
                  <span className="font-bold text-slate-800">{cashReceipt.student?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Student ID:</span>
                  <span className="font-bold text-slate-800">{cashReceipt.student?.student_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-bold text-emerald-700">CASH DESK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Amount Received:</span>
                  <span className="font-bold text-slate-900 text-sm">₹{cashReceipt.amount_received}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cashier / Clerk:</span>
                  <span className="font-bold text-slate-700">{cashReceipt.collector?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-600 text-[10px]">{format(new Date(cashReceipt.collected_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
              </div>

              <div className="text-center border-t border-slate-200 pt-3 text-[10px] text-slate-400">
                Thank you for settling your library dues.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 no-print">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Slip</span>
              </button>
              <button
                onClick={() => setShowCashReceiptModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: FINE DISPUTE / WAIVER (WITH 50 INR THRESHOLD WARNING) */}
      {/* ===================================================================== */}
      {selectedFineForDispute && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                Process Fine Dispute & Waiver
              </h3>
              <button onClick={() => setSelectedFineForDispute(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block">Fine Amount</span>
                  <span className="text-base font-bold text-slate-900">₹{selectedFineForDispute.amount}</span>
                </div>
                {Number(selectedFineForDispute.amount) <= 50 ? (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[10px] border border-emerald-200">
                    ≤ ₹50: Direct Clerk Waiver Allowed
                  </span>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[10px] border border-amber-200">
                    &gt; ₹50: Escalates to Chief Librarian
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Mandatory Reason Category *</label>
                <select
                  value={disputeCategory}
                  onChange={(e) => setDisputeCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="System Error">System Error (e.g. Scanner Glitch / Sync Delay)</option>
                  <option value="Medical Exemption">Medical Exemption (Medical Certificate)</option>
                  <option value="Desk Discretion">Desk Discretion (Circulation Discretion)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Dispute Justification Notes *</label>
                <textarea
                  rows={3}
                  value={disputeReasonText}
                  onChange={(e) => setDisputeReasonText(e.target.value)}
                  placeholder="Explain why this fine should be waived or escalated..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleConfirmDispute}
                disabled={submittingDispute}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {Number(selectedFineForDispute.amount) <= 50 ? 'Waive Fine Directly' : 'Escalate to Chief Librarian'}
                </span>
              </button>
              <button
                onClick={() => setSelectedFineForDispute(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: DESK HOLD CONFIRMATION */}
      {/* ===================================================================== */}
      {showDeskHoldModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-rose-700 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Place Circulation Desk Hold
              </h3>
              <button onClick={() => setShowDeskHoldModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Placing a Desk Hold blocks the student from campus library gate entry and reservations with message:
                <br />
                <span className="font-bold text-rose-700 mt-1 block">"Account Blocked: Please see the Circulation Desk."</span>
              </p>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Reason for Desk Hold *</label>
                <textarea
                  rows={3}
                  value={deskHoldReasonInput}
                  onChange={(e) => setDeskHoldReasonInput(e.target.value)}
                  placeholder="e.g. Unreturned reserve textbook, discipline notice, ID verification required..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => handleToggleDeskHold(true)}
                disabled={updatingDeskHold}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Confirm & Block Student Account</span>
              </button>
              <button
                onClick={() => setShowDeskHoldModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: END-OF-SHIFT HANDOVER REPORT & PRINT SLIP */}
      {/* ===================================================================== */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
                End-of-Shift Handover Console
              </h3>
              <button onClick={() => setShowShiftModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Active Shift Clerk</span>
                  <span className="font-bold text-slate-800">{currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}` : 'Clerk'}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <span className="text-slate-400 block text-[10px]">Shift Handover Time</span>
                  <span className="font-bold text-slate-800">{format(new Date(), 'HH:mm • MMM dd, yyyy')}</span>
                </div>
              </div>

              {/* Aggregated Live Shift Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <span className="text-[10px] text-indigo-600 font-bold block">Issued</span>
                  <span className="text-base font-bold text-indigo-900">{shiftSummary?.metrics?.books_issued_count || 0}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] text-emerald-600 font-bold block">Returned</span>
                  <span className="text-base font-bold text-emerald-900">{shiftSummary?.metrics?.books_returned_count || 0}</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                  <span className="text-[10px] text-amber-600 font-bold block">Cash (₹)</span>
                  <span className="text-base font-bold text-amber-900">₹{shiftSummary?.metrics?.cash_collected || 0}</span>
                </div>
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                  <span className="text-[10px] text-rose-600 font-bold block">Damaged</span>
                  <span className="text-base font-bold text-rose-900">{shiftSummary?.metrics?.damaged_books_count || 0}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Handover Notes for Next Shift Clerk</label>
                <textarea
                  rows={3}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  placeholder="Record cash drawer count, pending hold pickups, or shelf inspection notes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {handoverReceipt && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Handover Recorded Successfully (Log #{handoverReceipt.id})
                  </p>
                  <p className="text-[11px]">Submitted at {format(new Date(handoverReceipt.submitted_at), 'HH:mm:ss')}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={handleSubmitHandover}
                disabled={submittingHandover}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{submittingHandover ? 'Recording...' : 'Submit Handover Report'}</span>
              </button>
              {handoverReceipt && (
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print</span>
                </button>
              )}
              <button
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClerkIssueDesk;

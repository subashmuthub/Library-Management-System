import React, { useState, useEffect } from 'react';
import {
  X,
  IndianRupee,
  Smartphone,
  CreditCard,
  Banknote,
  CheckCircle2,
  Printer,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  BookOpen
} from 'lucide-react';
import { fineService } from '../services';

const FinePaymentModal = ({
  fine,
  student,
  userRole = 'clerk',
  onClose,
  onPaymentSuccess
}) => {
  const [paymentMethod, setPaymentMethod] = useState(userRole === 'student' ? 'UPI' : 'CASH'); // 'CASH' | 'UPI' | 'RUPAY'
  const [cashAmount, setCashAmount] = useState(fine ? String(fine.amount) : '');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // UPI State
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [upiSecondsRemaining, setUpiSecondsRemaining] = useState(600);
  const [upiUtr, setUpiUtr] = useState('');
  const [paymentIntent, setPaymentIntent] = useState(null);

  // RuPay Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState(student?.name || fine?.user_name || '');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Succeeded Receipt State
  const [receipt, setReceipt] = useState(null);

  const fineAmount = parseFloat(fine?.amount || 0);
  const fineDaysOverdue = fine?.days_overdue || fine?.actual_days_overdue || 1;
  const fineTitle = fine?.book_title || fine?.title || fine?.reason || 'Library Overdue / Resource Fine';
  const patronName = student?.name || fine?.user_name || 'Library Patron';
  const patronId = student?.student_id || fine?.student_id || student?.id || fine?.user_id || 'N/A';

  // 10-Minute Countdown timer for online intents
  useEffect(() => {
    if (paymentMethod === 'CASH' || receipt) return;

    setUpiSecondsRemaining(600);
    const interval = setInterval(() => {
      setUpiSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paymentMethod, receipt]);

  // Request or reset payment intent when switching to UPI or RuPay
  useEffect(() => {
    if (['UPI', 'RUPAY'].includes(paymentMethod) && fine?.id && !receipt) {
      fineService.createPaymentIntent({
        fineId: fine.id,
        amount: fineAmount,
        paymentMethod
      }).then(res => {
        if (res.success && res.intent) {
          setPaymentIntent(res.intent);
        }
      }).catch(err => {
        console.warn('Intent init notice:', err.message);
      });
    }
  }, [paymentMethod, fine?.id, receipt]);

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleCopyVpa = () => {
    const vpa = paymentIntent?.merchant_vpa || 'library@nec.edu.in';
    navigator.clipboard?.writeText(vpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  // Card input formatters
  const handleCardNumberChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 2) {
      setCardExpiry(`${val.slice(0, 2)}/${val.slice(2)}`);
    } else {
      setCardExpiry(val);
    }
  };

  // Form submission handler
  const handleProcessPayment = async (overrideMethod, simulatedRef) => {
    setLoading(true);
    setErrorMessage(null);

    const activeMethod = overrideMethod || paymentMethod;
    const effectiveAmount = activeMethod === 'CASH'
      ? (parseFloat(cashAmount) || fineAmount)
      : fineAmount;

    let transactionRef = simulatedRef || (activeMethod === 'UPI' ? upiUtr.trim() : null);

    if (activeMethod === 'RUPAY' && !transactionRef) {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        setErrorMessage('Please enter a valid 16-digit RuPay card number.');
        setLoading(false);
        return;
      }
      if (!cardExpiry || cardExpiry.length < 5) {
        setErrorMessage('Please enter card expiry date (MM/YY).');
        setLoading(false);
        return;
      }
      if (!cardCvv || cardCvv.length < 3) {
        setErrorMessage('Please enter 3-digit CVV.');
        setLoading(false);
        return;
      }
      transactionRef = `RUP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    try {
      const payload = {
        fineId: fine.id,
        studentId: student?.id || fine.user_id,
        amount: effectiveAmount,
        paymentMethod: activeMethod,
        receiptNotes: receiptNotes || `${activeMethod} settlement at Circulation Desk`,
        transactionRef: transactionRef
      };

      const res = await fineService.collectFine(payload);

      if (res.success && res.receipt) {
        setReceipt(res.receipt);
        if (onPaymentSuccess) {
          onPaymentSuccess(res.receipt);
        }
      } else {
        throw new Error(res.message || 'Payment processing failed');
      }
    } catch (err) {
      console.error('Fine payment error:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Payment could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-100 max-h-[95vh] overflow-y-auto">
        
        {/* Modal Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Settle Fine Payment</h3>
              <p className="text-xs text-slate-500">Patron: <span className="font-semibold text-slate-700">{patronName}</span> ({patronId})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* =================================================================== */}
        {/* SUCCESS RECEIPT VIEW */}
        {/* =================================================================== */}
        {receipt ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto" />
              <h4 className="text-base font-bold text-emerald-950">Payment Settled Successfully!</h4>
              <p className="text-xs text-emerald-700">Official library payment receipt has been issued and stored.</p>
            </div>

            <div id="fine-receipt-print" className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 font-mono text-xs">
              <div className="text-center border-b border-slate-200 pb-3">
                <p className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">SMART CENTRAL LIBRARY</p>
                <p className="text-[10px] text-slate-500">Fine Clearance & Settle Slip</p>
                <p className="font-bold text-indigo-700 mt-1 text-xs">{receipt.receipt_no}</p>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Patron Name:</span>
                  <span className="font-bold text-slate-800">{patronName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student / Roll ID:</span>
                  <span className="font-bold text-slate-800">{patronId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assessment:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[200px]">{fineTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method:</span>
                  <span className="font-bold text-indigo-700">{receipt.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction Ref:</span>
                  <span className="font-bold text-slate-700">{receipt.transaction_reference}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500 font-bold">Amount Paid:</span>
                  <span className="font-extrabold text-slate-900 text-sm">₹{Number(receipt.amount_received || fineAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-slate-500 text-[10px]">{new Date().toLocaleString()}</span>
                </div>
              </div>

              <div className="text-center border-t border-slate-200 pt-2 text-[10px] text-slate-400">
                This is a computer generated library receipt.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
              >
                <Printer className="h-4 w-4" />
                <span>Print Official Slip</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* =================================================================== */
          /* PAYMENT FORM & METHOD SELECTOR VIEW */
          /* =================================================================== */
          <div className="space-y-4">
            
            {/* Fine Assessment Summary Banner */}
            <div className="p-3.5 bg-gradient-to-r from-indigo-50/80 to-slate-50 border border-indigo-100 rounded-2xl flex items-center justify-between">
              <div className="space-y-0.5 max-w-[70%]">
                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> Fine Assessment
                </span>
                <p className="font-bold text-slate-900 text-xs truncate">{fineTitle}</p>
                <p className="text-[11px] text-slate-500">Overdue for <span className="font-bold text-rose-600">{fineDaysOverdue} day{fineDaysOverdue > 1 ? 's' : ''}</span></p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-semibold">Total Due</span>
                <span className="text-lg font-extrabold text-slate-900">₹{fineAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector Pills (3 Cards) */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2.5">
                
                {/* 1. Cash Card */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Banknote className={`h-5 w-5 ${paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold block">Cash</span>
                  <span className="text-[10px] text-slate-400 block">Desk Handover</span>
                </button>

                {/* 2. UPI Card */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                    paymentMethod === 'UPI'
                      ? 'border-indigo-500 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <Smartphone className={`h-5 w-5 ${paymentMethod === 'UPI' ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold block">UPI</span>
                  <span className="text-[10px] text-slate-400 block">GPay / PhonePe</span>
                </button>

                {/* 3. RuPay Card */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('RUPAY')}
                  className={`p-3 rounded-2xl border text-center transition flex flex-col items-center justify-center gap-1.5 ${
                    paymentMethod === 'RUPAY'
                      ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <CreditCard className={`h-5 w-5 ${paymentMethod === 'RUPAY' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold block">RuPay</span>
                  <span className="text-[10px] text-slate-400 block">Debit / Credit</span>
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* =============================================================== */}
            {/* DYNAMIC BODY: CASE A (CASH) */}
            {/* =============================================================== */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Cash Amount Received (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      step="0.5"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  {parseFloat(cashAmount) > fineAmount && (
                    <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                      Change to return: ₹{(parseFloat(cashAmount) - fineAmount).toFixed(2)}
                    </p>
                  )}
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Receipt Notes / Remarks</label>
                  <input
                    type="text"
                    value={receiptNotes}
                    onChange={(e) => setReceiptNotes(e.target.value)}
                    placeholder="e.g. Settle at Issue Counter by Clerk"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* DYNAMIC BODY: CASE B (UPI) */}
            {/* =============================================================== */}
            {paymentMethod === 'UPI' && (
              <div className="space-y-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
                
                {/* UPI QR Display & Countdown */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  {/* Dynamic Scalable Stylized QR Code */}
                  <div className="h-32 w-32 bg-slate-900 rounded-2xl p-2.5 flex flex-col items-center justify-center shrink-0 relative overflow-hidden shadow-inner">
                    <div className="grid grid-cols-4 gap-1 w-full h-full p-1 bg-white rounded-lg">
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-300 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-indigo-600 rounded-sm"></div>
                      <div className="bg-slate-400 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-200 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-100 rounded-sm"></div>
                      <div className="bg-indigo-600 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-300 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-900 rounded-sm"></div>
                      <div className="bg-slate-400 rounded-sm"></div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-indigo-600/90 py-0.5 text-center text-[8px] font-bold text-white tracking-widest uppercase">
                      Scan UPI
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-indigo-700 font-bold text-xs">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Session Expiry: {formatTimer(upiSecondsRemaining)}</span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[11px] text-slate-500 block">Merchant UPI VPA</span>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-lg font-mono text-xs font-semibold text-slate-800 border border-slate-200">
                        <span>{paymentIntent?.merchant_vpa || 'library@nec.edu.in'}</span>
                        <button
                          type="button"
                          onClick={handleCopyVpa}
                          className="text-slate-400 hover:text-indigo-600 transition"
                          title="Copy UPI ID"
                        >
                          {copiedVpa ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Supports Google Pay, PhonePe, Paytm, or BHIM.
                    </p>
                  </div>
                </div>

                {/* Live Waiting Animation & Manual UTR input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Waiting for UPI payment confirmation...
                    </span>
                    <button
                      type="button"
                      onClick={() => handleProcessPayment('UPI', `UPI-MOCK-${Date.now().toString().slice(-6)}`)}
                      className="text-[11px] text-indigo-600 font-bold hover:underline"
                    >
                      [Simulate UPI Success]
                    </button>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Optional UPI Ref / UTR No.</label>
                    <input
                      type="text"
                      value={upiUtr}
                      onChange={(e) => setUpiUtr(e.target.value)}
                      placeholder="e.g. 423985721980"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* DYNAMIC BODY: CASE C (RUPAY / CARDS) */}
            {/* =============================================================== */}
            {paymentMethod === 'RUPAY' && (
              <div className="space-y-3.5 p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs">
                
                {/* RuPay Card Mock Preview */}
                <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-blue-900 text-white p-4 rounded-2xl shadow-md space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-widest text-slate-300 uppercase font-semibold">Smart Library Card Gateway</span>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-white/10 rounded-md border border-white/20">
                      <span className="text-[11px] font-black tracking-wider text-orange-400">Ru</span>
                      <span className="text-[11px] font-black tracking-wider text-emerald-400">Pay</span>
                    </div>
                  </div>

                  <p className="font-mono text-sm tracking-widest font-semibold pt-1">
                    {cardNumber || '•••• •••• •••• ••••'}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <div>
                      <span className="block text-[8px] text-slate-400 uppercase">Card Holder</span>
                      <span className="font-semibold">{cardHolder || 'LIBRARY PATRON'}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] text-slate-400 uppercase">Expires</span>
                      <span className="font-semibold">{cardExpiry || 'MM/YY'}</span>
                    </div>
                  </div>
                </div>

                {/* Card Fields Form */}
                <div className="space-y-2.5">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">RuPay Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      placeholder="6071 0000 0000 0000"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={handleExpiryChange}
                        placeholder="MM/YY"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">CVV (3 Digits)</label>
                      <input
                        type="password"
                        maxLength={3}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        placeholder="•••"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>256-bit encrypted RuPay National Payment Network.</span>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* ACTION BUTTONS */}
            {/* =============================================================== */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {paymentMethod === 'CASH' ? (
                <button
                  type="button"
                  onClick={() => handleProcessPayment('CASH')}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>Confirm Cash Received & Print Slip</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleProcessPayment(paymentMethod)}
                  disabled={loading}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  <span>Pay ₹{fineAmount.toFixed(2)} via {paymentMethod}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinePaymentModal;

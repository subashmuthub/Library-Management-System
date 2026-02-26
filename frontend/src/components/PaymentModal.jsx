import React, { useState } from 'react';
import { X, CreditCard, Smartphone, Wallet, DollarSign, CheckCircle, Printer, Download, Lock, Shield } from 'lucide-react';

const PaymentModal = ({ fine, onClose, onPaymentSuccess }) => {
  const [step, setStep] = useState('select'); // 'select', 'processing', 'receipt'
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState('');

  const paymentGateways = [
    { 
      id: 'gpay', 
      name: 'Google Pay', 
      icon: Smartphone, 
      color: 'blue',
      description: 'Pay by any UPI app'
    },
    { 
      id: 'phonepe', 
      name: 'PhonePe', 
      icon: Smartphone, 
      color: 'purple',
      description: 'UPI & Wallets'
    },
    { 
      id: 'paytm', 
      name: 'Paytm', 
      icon: Wallet, 
      color: 'indigo',
      description: 'Paytm & UPI'
    },
    { 
      id: 'card', 
      name: 'Credit / Debit Card', 
      icon: CreditCard, 
      color: 'green',
      description: 'Add and secure cards as per RBI guidelines'
    },
    { 
      id: 'cash', 
      name: 'Cash', 
      icon: DollarSign, 
      color: 'orange',
      description: 'Pay in cash at library'
    },
  ];

  // Check if selected gateway requires UPI ID
  const isUpiGateway = (gateway) => {
    return gateway && ['gpay', 'phonepe', 'paytm'].includes(gateway.id);
  };

  // Validate UPI ID format
  const validateUpiId = (upi) => {
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;
    return upiRegex.test(upi);
  };

  const handleGatewaySelect = (gateway) => {
    setSelectedGateway(gateway);
    setUpiError('');
    // Clear UPI ID if switching to non-UPI gateway
    if (!isUpiGateway(gateway)) {
      setUpiId('');
    }
  };

  const handleUpiChange = (e) => {
    const value = e.target.value;
    setUpiId(value);
    setUpiError('');
  };

  const handlePayment = async () => {
    // Validate UPI ID if UPI gateway is selected
    if (isUpiGateway(selectedGateway)) {
      if (!upiId.trim()) {
        setUpiError('Please enter your UPI ID');
        return;
      }
      if (!validateUpiId(upiId)) {
        setUpiError('Please enter a valid UPI ID (e.g., yourname@paytm)');
        return;
      }
    }

    // Handle cash payment (no online processing needed)
    if (selectedGateway.id === 'cash') {
      await processCashPayment();
      return;
    }

    setStep('processing');

    try {
      // Check if Razorpay is configured
      const statusResponse = await fetch('http://localhost:3001/api/v1/payments/status');
      const statusData = await statusResponse.json();

      if (!statusData.configured) {
        // Fall back to demo mode
        await processDemoPayment();
        return;
      }

      // Create Razorpay order
      const orderResponse = await fetch(`http://localhost:3001/api/v1/payments/order/${fine.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          paymentMethod: isUpiGateway(selectedGateway) ? 'upi' : 'card'
        })
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.message || 'Failed to create payment order');
      }

      // Open Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.order.amount,
        currency: orderData.order.currency,
        name: 'Smart Library System',
        description: `Fine Payment - Transaction #${fine.transaction_id}`,
        order_id: orderData.order.id,
        prefill: {
          name: orderData.fine.user_name,
        },
        theme: {
          color: '#3b82f6'
        },
        handler: async function (response) {
          // Payment successful, verify on backend
          await verifyRazorpayPayment(response);
        },
        modal: {
          ondismiss: function() {
            setStep('select');
          }
        }
      };

      // Add UPI-specific options
      if (isUpiGateway(selectedGateway) && upiId) {
        options.method = 'upi';
        options.prefill.vpa = upiId; // Pre-fill UPI ID
      }

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed: ' + error.message);
      setStep('select');
    }
  };

  // Verify Razorpay payment
  const verifyRazorpayPayment = async (razorpayResponse) => {
    try {
      const response = await fetch('http://localhost:3001/api/v1/payments/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          razorpay_order_id: razorpayResponse.razorpay_order_id,
          razorpay_payment_id: razorpayResponse.razorpay_payment_id,
          razorpay_signature: razorpayResponse.razorpay_signature,
          fine_id: fine.id,
          upi_id: isUpiGateway(selectedGateway) ? upiId : null
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Show receipt
        setReceiptData({
          receipt_id: data.receipt.receipt_id,
          fine_id: fine.id,
          transaction_id: fine.transaction_id,
          user_name: data.receipt.user_name,
          amount: data.payment.amount,
          payment_method: selectedGateway.name,
          payment_reference: data.payment.id,
          payment_date: new Date().toLocaleString(),
          status: 'Success',
        });
        setStep('receipt');
        
        if (onPaymentSuccess) {
          onPaymentSuccess();
        }
      } else {
        throw new Error(data.message || 'Payment verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      alert('Payment verification failed: ' + error.message);
      setStep('select');
    }
  };

  // Process demo payment (when Razorpay not configured)
  const processDemoPayment = async () => {
    setTimeout(async () => {
      try {
        const paymentData = {
          payment_method: 'online',
          payment_gateway: selectedGateway.id,
          amount_paid: parseFloat(fine.amount),
          payment_reference: `DEMO-${selectedGateway.id.toUpperCase()}-${Date.now()}`,
          notes: `[DEMO] Paid via ${selectedGateway.name}`
        };

        if (isUpiGateway(selectedGateway) && upiId) {
          paymentData.upi_id = upiId;
          paymentData.notes += ` (UPI: ${upiId})`;
        }

        const response = await fetch(`http://localhost:3001/api/v1/fines/${fine.id}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(paymentData)
        });

        const data = await response.json();

        if (response.ok) {
          setReceiptData({
            receipt_id: data.payment.receipt_id || `REC-${Date.now()}`,
            fine_id: fine.id,
            transaction_id: fine.transaction_id,
            user_name: fine.user_name || `User #${fine.user_id}`,
            amount: data.payment.amount,
            payment_method: selectedGateway.name + ' (Demo)',
            payment_reference: data.payment.reference,
            payment_date: new Date().toLocaleString(),
            status: 'Success',
          });
          setStep('receipt');
          
          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
        } else {
          throw new Error(data.message || 'Payment failed');
        }
      } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
        setStep('select');
      }
    }, 2000);
  };

  // Process cash payment
  const processCashPayment = async () => {
    setStep('processing');
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/v1/fines/${fine.id}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            payment_method: 'cash',
            payment_gateway: 'cash',
            amount_paid: parseFloat(fine.amount),
            payment_reference: `CASH-${Date.now()}`,
            notes: 'Paid in cash at library'
          })
        });

        const data = await response.json();

        if (response.ok) {
          setReceiptData({
            receipt_id: data.payment.receipt_id || `REC-${Date.now()}`,
            fine_id: fine.id,
            transaction_id: fine.transaction_id,
            user_name: fine.user_name || `User #${fine.user_id}`,
            amount: data.payment.amount,
            payment_method: 'Cash',
            payment_reference: data.payment.reference,
            payment_date: new Date().toLocaleString(),
            status: 'Success',
          });
          setStep('receipt');

          if (onPaymentSuccess) {
            onPaymentSuccess();
          }
        } else {
          alert(`Payment failed: ${data.error || data.message}`);
          setStep('select');
        }
      } catch (error) {
        alert(`Payment failed: ${error.message}`);
        setStep('select');
      }
    }, 1500);
  };

  const printReceipt = () => {
    window.print();
  };

  const downloadReceipt = () => {
    const receiptText = `
LIBRARY FINE PAYMENT RECEIPT
=============================

Receipt ID: ${receiptData.receipt_id}
Date: ${receiptData.payment_date}

Fine ID: #${receiptData.fine_id}
Transaction: #${receiptData.transaction_id}
User: ${receiptData.user_name}

Amount Paid: $${receiptData.amount}
Payment Method: ${receiptData.payment_method}
Reference: ${receiptData.payment_reference}

Status: ${receiptData.status}

Thank you for your payment!
=============================
    `;

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${receiptData.receipt_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:bg-white p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={24} />
            </button>
            <h2 className="text-xl font-bold">Complete Payment</h2>
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <Shield size={18} />
            <span className="text-sm font-semibold">100% Secure</span>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {step === 'select' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[500px]">
              {/* Left Side - Payment Methods */}
              <div className="lg:col-span-2 border-r">
                <div className="p-6 space-y-3">
                  {paymentGateways.map((gateway, index) => {
                    const Icon = gateway.icon;
                    const isSelected = selectedGateway?.id === gateway.id;
                    
                    return (
                      <div
                        key={gateway.id}
                        onClick={() => handleGatewaySelect(gateway)}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-blue-500' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                              )}
                            </div>
                            <Icon size={22} className="text-gray-700" />
                            <div>
                              <div className="font-semibold text-gray-900">{gateway.name}</div>
                              <div className="text-xs text-gray-500">{gateway.description}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* UPI ID Input Section (shows when UPI gateway is selected) */}
                {selectedGateway && isUpiGateway(selectedGateway) && (
                  <div className="px-6 pb-6 border-t pt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Enter UPI ID</h3>
                      <p className="text-xs text-gray-600 mb-3">
                        Please ensure your UPI ID is correct for seamless payment
                      </p>
                      
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          UPI ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={handleUpiChange}
                          placeholder="yourname@paytm / yourname@ybl"
                          className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 ${
                            upiError 
                              ? 'border-red-500 focus:ring-red-200' 
                              : 'border-gray-300 focus:ring-blue-200'
                          }`}
                        />
                        {upiError && (
                          <p className="text-red-500 text-xs mt-1">{upiError}</p>
                        )}
                      </div>

                      <div className="flex items-start gap-2 text-xs text-gray-600">
                        <div className="mt-0.5">ℹ️</div>
                        <div>
                          <p className="font-medium mb-1">How to find UPI ID?</p>
                          <p>Open Google Pay/PhonePe → Profile → UPI ID will be shown</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side - Payment Details & Summary */}
              <div className="bg-gray-50 p-6">
                <div className="sticky top-0">
                  {/* Price Breakdown */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">PRICE DETAILS</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fine Amount</span>
                        <span className="font-semibold">${fine.amount}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Platform Fee</span>
                        <span className="font-semibold">$0</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between text-base font-bold">
                          <span>Total Amount</span>
                          <span className="text-blue-600">${fine.amount}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">TRANSACTION DETAILS</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fine ID</span>
                        <span className="font-mono text-xs">#{fine.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Transaction</span>
                        <span className="font-mono text-xs">#{fine.transaction_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">User</span>
                        <span className="text-xs">{fine.user_name || `User #${fine.user_id}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Button */}
                  {selectedGateway ? (
                    <button
                      onClick={handlePayment}
                      disabled={isUpiGateway(selectedGateway) && !upiId.trim()}
                      className={`w-full font-semibold py-3 rounded-lg transition-colors shadow-lg ${
                        isUpiGateway(selectedGateway) && !upiId.trim()
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {isUpiGateway(selectedGateway) && !upiId.trim() 
                        ? 'Enter UPI ID to Continue' 
                        : `Pay $${fine.amount}`
                      }
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full bg-gray-300 text-gray-500 font-semibold py-3 rounded-lg cursor-not-allowed"
                    >
                      Select Payment Method
                    </button>
                  )}

                  {/* Security Info */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <Lock size={14} />
                    <span>Secure payment using industry standard encryption</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-20 px-6">
              <div className="animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 mx-auto mb-6"></div>
              <h3 className="text-2xl font-bold mb-3">Processing Payment...</h3>
              <p className="text-gray-600 mb-2">Connecting to {selectedGateway?.name}</p>
              {isUpiGateway(selectedGateway) && upiId ? (
                <>
                  <p className="text-sm text-gray-500 mb-2">Sending notification to <span className="font-semibold text-blue-600">{upiId}</span></p>
                  <p className="text-xs text-gray-400">Please approve the payment request on your UPI app</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Please wait while we securely process your payment</p>
              )}
              <div className="mt-8 inline-flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-full">
                <Lock size={16} />
                <span>Secured by 256-bit encryption</span>
              </div>
            </div>
          )}

          {step === 'receipt' && receiptData && (
            <div className="print:text-black p-6">
              {/* Success Icon */}
              <div className="text-center mb-8 print:hidden">
                <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="text-green-600" size={48} />
                </div>
                <h3 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">Your payment has been processed successfully</p>
              </div>

              {/* Receipt */}
              <div className="max-w-2xl mx-auto border-2 border-gray-200 rounded-xl p-8 bg-white print:border-black">
                <div className="text-center mb-6 pb-6 border-b print:mb-8">
                  <h4 className="font-bold text-2xl mb-1 print:text-3xl">PAYMENT RECEIPT</h4>
                  <p className="text-sm text-gray-600 print:text-black">Smart Library Management System</p>
                  <p className="text-xs text-gray-500 mt-1 print:text-black">Receipt ID: {receiptData.receipt_id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <div className="text-gray-500 text-xs mb-1 print:text-black">Date & Time</div>
                    <div className="font-semibold">{receiptData.payment_date}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1 print:text-black">Payment Method</div>
                    <div className="font-semibold">{receiptData.payment_method}</div>
                  </div>
                  {upiId && isUpiGateway(selectedGateway) && (
                    <div>
                      <div className="text-gray-500 text-xs mb-1 print:text-black">UPI ID</div>
                      <div className="font-mono text-sm text-blue-600 print:text-black">{upiId}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-gray-500 text-xs mb-1 print:text-black">Fine ID</div>
                    <div className="font-mono text-sm">#{receiptData.fine_id}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs mb-1 print:text-black">Transaction ID</div>
                    <div className="font-mono text-sm">#{receiptData.transaction_id}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 text-xs mb-1 print:text-black">User Name</div>
                    <div className="font-semibold">{receiptData.user_name}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-gray-500 text-xs mb-1 print:text-black">Payment Reference</div>
                    <div className="font-mono text-xs">{receiptData.payment_reference}</div>
                  </div>
                </div>

                <div className="border-t border-b py-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Amount Paid</span>
                    <span className="text-3xl font-bold text-green-600 print:text-black">${receiptData.amount}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-sm text-gray-600 print:text-black">Status</span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 print:text-black">
                      <CheckCircle size={16} /> {receiptData.status}
                    </span>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-600 print:text-black">
                  <p className="mb-2">Thank you for your payment!</p>
                  <p className="text-xs">For any queries, please contact library administration</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 mt-8 max-w-2xl mx-auto print:hidden">
                <button
                  onClick={printReceipt}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Printer size={20} />
                  Print Receipt
                </button>
                <button
                  onClick={downloadReceipt}
                  className="flex-1 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-300 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={20} />
                  Download
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-full max-w-2xl mx-auto block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg mt-4 print:hidden transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;

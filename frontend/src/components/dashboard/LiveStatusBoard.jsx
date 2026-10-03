import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Archive,
  Clock,
  Inbox,
  TrendingUp,
  DollarSign,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  FileText
} from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

export default function LiveStatusBoard() {
  const [liveStatus, setLiveStatus] = useState(null);
  const [procurement, setProcurement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Purchase Form State
  const [formVendor, setFormVendor] = useState('');
  const [formInvoice, setFormInvoice] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formItems, setFormItems] = useState([
    { item_title: '', resource_type: 'BOOK', quantity: 1, unit_price: '' },
  ]);
  const [vendorsList, setVendorsList] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [statusRes, procRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/live-status`, { withCredentials: true }).catch(() => null),
        axios.get(`${API_BASE}/procurement/analytics`, { withCredentials: true }).catch(() => null),
      ]);

      if (statusRes?.data?.metrics) {
        setLiveStatus(statusRes.data);
      }
      if (procRes?.data?.budget) {
        setProcurement(procRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch live board data:', err);
      setError('Unable to load live operational status.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchVendors = async () => {
    try {
      const res = await axios.get(`${API_BASE}/procurement/vendors`, { withCredentials: true });
      if (res.data?.vendors) {
        setVendorsList(res.data.vendors);
        if (res.data.vendors.length > 0 && !formVendor) {
          setFormVendor(res.data.vendors[0].id);
        }
      }
    } catch (e) {
      console.warn('Could not fetch vendors:', e.message);
    }
  };

  useEffect(() => {
    fetchData();
    fetchVendors();
    // Poll every 30 seconds for live operational status
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAddItem = () => {
    setFormItems([
      ...formItems,
      { item_title: '', resource_type: 'BOOK', quantity: 1, unit_price: '' },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...formItems];
    updated[index][field] = value;
    setFormItems(updated);
  };

  const calculateFormTotal = () => {
    return formItems.reduce((sum, item) => {
      const q = parseInt(item.quantity, 10) || 0;
      const p = parseFloat(item.unit_price) || 0;
      return sum + q * p;
    }, 0);
  };

  const handleCreatePurchase = async (e) => {
    e.preventDefault();
    if (!formVendor || !formInvoice || !formDate) {
      alert('Please fill out all required fields.');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(
        `${API_BASE}/procurement/purchases`,
        {
          vendor_id: parseInt(formVendor, 10),
          invoice_no: formInvoice,
          purchase_date: formDate,
          allocated_year: procurement?.financial_year || '2026-2027',
          payment_status: 'PAID',
          items: formItems.map((item) => ({
            item_title: item.item_title,
            resource_type: item.resource_type,
            quantity: parseInt(item.quantity, 10),
            unit_price: parseFloat(item.unit_price),
          })),
        },
        { withCredentials: true }
      );

      setIsModalOpen(false);
      setFormInvoice('');
      setFormItems([{ item_title: '', resource_type: 'BOOK', quantity: 1, unit_price: '' }]);
      fetchData();
    } catch (err) {
      console.error('Purchase submission failed:', err);
      alert(err.response?.data?.message || 'Failed to record purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
          ))}
        </div>
        <div className="h-44 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
      </div>
    );
  }

  const metrics = liveStatus?.metrics || {
    total_active_catalog_items: 0,
    archived_damaged_items: 0,
    overdue_checkouts: 0,
    pending_requests: 0,
  };

  const budget = procurement?.budget || {
    allocated_budget: 0,
    spent_budget: 0,
    remaining_balance: 0,
    utilization_percentage: 0,
  };

  const utilizationRate = Math.min(100, Math.max(0, budget.utilization_percentage || 0));
  const progressColor =
    utilizationRate > 90
      ? 'bg-rose-500'
      : utilizationRate > 75
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="space-y-6">
      {/* ── TOP BAR: Status & Action ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Operational Status & Procurement
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real-time telemetry updated every 30 seconds
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm shadow-blue-500/20 transition"
          >
            <PlusCircle className="w-4 h-4" />
            New Purchase Order
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* ── 1. LIVE OPERATIONAL METRICS CARDS ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Active Catalog Items */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active Resources
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.total_active_catalog_items.toLocaleString()}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Books: {liveStatus?.breakdown?.resources?.books || 0}</span>
              <span>•</span>
              <span>Papers: {liveStatus?.breakdown?.resources?.research_papers || 0}</span>
              <span>•</span>
              <span>Journals: {liveStatus?.breakdown?.resources?.journals || 0}</span>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
        </div>

        {/* Card 2: Archived / Damaged Items */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Archived / Damaged
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Archive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.archived_damaged_items.toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
              Requires repair or withdrawal review
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-amber-600" />
        </div>

        {/* Card 3: Overdue Returns */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overdue Loans
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.overdue_checkouts.toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
              Overdue checked-out materials
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600" />
        </div>

        {/* Card 4: Pending Requests */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 shadow-sm relative overflow-hidden group hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending Approvals
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {metrics.pending_requests.toLocaleString()}
            </div>
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
              {liveStatus?.breakdown?.pending_reservations || 0} holds +{' '}
              {liveStatus?.breakdown?.pending_suggestions || 0} suggestions
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-600" />
        </div>
      </div>

      {/* ── 2. BUDGET PROGRESS & PROCUREMENT LEDGER ──────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-700/80 shadow-sm space-y-6">
        {/* Budget Bar Header */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Library Procurement Budget ({procurement?.financial_year || 'FY 2026-2027'})
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {utilizationRate}% Utilized
              </span>
            </div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Remaining Balance:{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                ₹{budget.remaining_balance.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${utilizationRate}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mt-2">
            <span>Spent: ₹{budget.spent_budget.toLocaleString()}</span>
            <span>Allocated: ₹{budget.allocated_budget.toLocaleString()}</span>
          </div>
        </div>

        {/* Procurement Ledger Table */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              Recent Procurement Orders
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Auto-increments spent funds on recording
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-4">Invoice No</th>
                  <th className="py-2.5 px-4">Vendor</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-center">Items</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {procurement?.recent_purchases && procurement.recent_purchases.length > 0 ? (
                  procurement.recent_purchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        {purchase.invoice_no}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-slate-900 dark:text-white">{purchase.vendor_name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                        {new Date(purchase.purchase_date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                          {purchase.total_items}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        ₹{purchase.total_amount.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          {purchase.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No procurement orders recorded for this fiscal year yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── 3. MODAL: RECORD NEW PROCUREMENT PURCHASE ────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Record Procurement Order
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adds order items and increments library budget expenditure automatically.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Vendor
                  </label>
                  <select
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Vendor...</option>
                    {vendorsList.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Invoice No
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. INV-2026-901"
                    value={formInvoice}
                    onChange={(e) => setFormInvoice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    Order Line Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {formItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-12 gap-2 items-center"
                  >
                    <div className="col-span-5">
                      <input
                        type="text"
                        placeholder="Title / Material Name"
                        required
                        value={item.item_title}
                        onChange={(e) => handleItemChange(idx, 'item_title', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="col-span-3">
                      <select
                        value={item.resource_type}
                        onChange={(e) => handleItemChange(idx, 'resource_type', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white"
                      >
                        <option value="BOOK">Book</option>
                        <option value="RESEARCH_PAPER">Research Paper</option>
                        <option value="JOURNAL">Journal</option>
                      </select>
                    </div>

                    <div className="col-span-1">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        required
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-center"
                      />
                    </div>

                    <div className="col-span-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Price ₹"
                        required
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        className="w-full px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-900 dark:text-white text-right"
                      />
                    </div>

                    <div className="col-span-1 text-center">
                      {formItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Order Value:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    ₹{calculateFormTotal().toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  {submitting ? 'Recording...' : 'Record Order & Update Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

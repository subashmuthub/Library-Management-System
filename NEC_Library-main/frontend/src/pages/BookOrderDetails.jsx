import React, { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services';
import { PackagePlus, Search, Truck } from 'lucide-react';

const priorityClass = {
  High: 'bg-rose-100 text-rose-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-emerald-100 text-emerald-700',
};

const BookOrderDetails = () => {
  const [payload, setPayload] = useState({ summary: {}, orders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getBookOrderDetails({ limit: 500 });
      setPayload({
        summary: response.summary || {},
        orders: response.orders || [],
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load book order details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return payload.orders;
    return payload.orders.filter((item) =>
      [item.title, item.author, item.isbn, item.publisher, item.agent_name].some((value) =>
        String(value || '').toLowerCase().includes(text),
      ),
    );
  }, [payload.orders, query]);

  return (
    <div className="space-y-6">
      <div className="card border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Book Order & Agent Details</h1>
            <p className="text-sm text-slate-600">Live procurement planning for all books with assigned agent contacts.</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={fetchOrders}>Refresh</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Books</p>
            <p className="text-2xl font-bold">{payload.summary.total_books || 0}</p>
          </div>
          <div className="rounded-xl border border-rose-200 p-4 bg-rose-50">
            <p className="text-xs uppercase tracking-wide text-rose-600">High Priority</p>
            <p className="text-2xl font-bold text-rose-700">{payload.summary.high_priority || 0}</p>
          </div>
          <div className="rounded-xl border border-amber-200 p-4 bg-amber-50">
            <p className="text-xs uppercase tracking-wide text-amber-600">Medium Priority</p>
            <p className="text-2xl font-bold text-amber-700">{payload.summary.medium_priority || 0}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 p-4 bg-emerald-50">
            <p className="text-xs uppercase tracking-wide text-emerald-600">Suggested Qty</p>
            <p className="text-2xl font-bold text-emerald-700">{payload.summary.total_suggested_qty || 0}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><PackagePlus size={18} /> Order Pipeline</h2>
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, isbn, publisher, agent"
            />
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500">Loading order data...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Purchase Source</th>
                  <th>Demand</th>
                  <th>Order Plan</th>
                  <th>Priority</th>
                  <th>Agent Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <p className="font-semibold text-slate-800">{row.title}</p>
                      <p className="text-xs text-slate-500">{row.author} | ISBN: {row.isbn}</p>
                      <p className="text-xs text-slate-500">Publisher: {row.publisher}</p>
                    </td>
                    <td>
                      <p className="text-sm font-medium text-slate-800">{row.purchase_source}</p>
                      <p className="text-xs text-slate-600">Vendor: {row.purchase_vendor}</p>
                      <p className="text-xs text-slate-600">Invoice: {row.purchase_invoice_no}</p>
                      <p className="text-xs text-slate-600">Price: Rs {Number(row.purchase_price || 0).toFixed(2)}</p>
                    </td>
                    <td>
                      <p className="text-sm">Active Loans: <strong>{row.active_loans}</strong></p>
                      <p className="text-sm">Reservations: <strong>{row.active_reservations}</strong></p>
                      <p className="text-sm">Available: <strong>{row.available_now}</strong></p>
                    </td>
                    <td>
                      <p className="text-sm">Suggested Qty: <strong>{row.suggested_order_qty}</strong></p>
                      <p className="text-sm flex items-center gap-1 text-slate-600"><Truck size={14} /> ETA: {row.estimated_delivery_days} days</p>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${priorityClass[row.priority] || priorityClass.Low}`}>{row.priority}</span>
                    </td>
                    <td>
                      <p className="font-medium text-slate-800">{row.agent_name}</p>
                      <p className="text-xs text-slate-600">{row.agent_email}</p>
                      <p className="text-xs text-slate-600">{row.agent_phone}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <div className="p-4 text-sm text-slate-500">No books matched your search.</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookOrderDetails;

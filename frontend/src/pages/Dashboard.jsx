import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  BookOpen,
  Bookmark,
  Clock,
  DollarSign,
  RefreshCw,
  Scan,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  subDays,
} from "date-fns";
import { useAuth } from "../contexts";
import {
  dashboardService,
  fineService,
  reservationService,
  transactionService,
} from "../services";

const AnalyticsSections = lazy(
  () => import("../components/dashboard/AnalyticsSections"),
);

const buildCsv = (rows, headers) => {
  const escape = (value) => {
    const normalized = value == null ? "" : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const head = headers.map((header) => escape(header.label)).join(",");
  const body = rows
    .map((row) => headers.map((header) => escape(row[header.key])).join(","))
    .join("\n");

  return `${head}\n${body}`;
};

const downloadCsv = (filename, rows, headers) => {
  const csv = buildCsv(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roleName =
    typeof user?.role === "string" ? user.role : user?.role?.role_name;
  const canManageCirculation = ["admin", "librarian"].includes(
    (roleName || "").toLowerCase(),
  );

  const [period, setPeriod] = useState(30);
  const [dateMode, setDateMode] = useState("preset");
  const [customFrom, setCustomFrom] = useState(
    format(subDays(new Date(), 29), "yyyy-MM-dd"),
  );
  const [customTo, setCustomTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filterError, setFilterError] = useState("");
  const [appliedFilter, setAppliedFilter] = useState({
    mode: "preset",
    period: 30,
    from: null,
    to: null,
  });
  const [dashboardStats, setDashboardStats] = useState(null);
  const [libraryStatus, setLibraryStatus] = useState(null);
  const [bookAnalytics, setBookAnalytics] = useState(null);
  const [userInsights, setUserInsights] = useState(null);
  const [transactionStats, setTransactionStats] = useState(null);
  const [fineStats, setFineStats] = useState(null);
  const [reservationStats, setReservationStats] = useState(null);
  const [topPendingFines, setTopPendingFines] = useState([]);
  const [readyReservations, setReadyReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const effectivePeriod = useMemo(() => {
    if (appliedFilter.mode === "custom" && appliedFilter.from && appliedFilter.to) {
      const from = new Date(appliedFilter.from);
      const to = new Date(appliedFilter.to);
      const diff = differenceInCalendarDays(to, from) + 1;
      return Math.min(365, Math.max(1, diff));
    }
    return Number(appliedFilter.period || 30);
  }, [appliedFilter]);

  useEffect(() => {
    loadDashboardData();
  }, [effectivePeriod, user?.id]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, statusData, analyticsData, insightsData, txData, fineData, reservationData, pendingFinesData, readyReservationsData] = await Promise.all([
        dashboardService.getStats({ period: effectivePeriod }).catch(() => null),
        dashboardService.getStatus().catch(() => null),
        dashboardService.getBookAnalytics({ period: effectivePeriod }).catch(() => null),
        dashboardService.getUserInsights({ period: effectivePeriod }).catch(() => null),
        transactionService.getStatistics({ period: effectivePeriod }).catch(() => null),
        fineService.getStatistics({ period: effectivePeriod }).catch(() => null),
        reservationService.getStatistics({ period: effectivePeriod }).catch(() => null),
        fineService.getPendingFines({ status: "pending", limit: 5 }).catch(() => ({ fines: [] })),
        reservationService.getAllReservations({ status: "ready", limit: 5 }).catch(() => ({ reservations: [] })),
      ]);

      setDashboardStats(statsData);
      setLibraryStatus(statusData);
      setBookAnalytics(analyticsData);
      setUserInsights(insightsData);
      setTransactionStats(txData);
      setFineStats(fineData);
      setReservationStats(reservationData);
      setTopPendingFines(pendingFinesData?.fines || pendingFinesData?.data || []);
      setReadyReservations(
        readyReservationsData?.reservations || readyReservationsData?.data || [],
      );
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const applyFilters = () => {
    if (dateMode === "preset") {
      setFilterError("");
      setAppliedFilter({ mode: "preset", period, from: null, to: null });
      return;
    }

    if (!customFrom || !customTo) {
      setFilterError("Please select both From and To dates.");
      return;
    }

    const fromDate = new Date(customFrom);
    const toDate = new Date(customTo);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      setFilterError("Invalid date range selected.");
      return;
    }

    if (fromDate > toDate) {
      setFilterError("From date cannot be after To date.");
      return;
    }

    const span = differenceInCalendarDays(toDate, fromDate) + 1;
    if (span > 365) {
      setFilterError("Please select a range up to 365 days.");
      return;
    }

    setFilterError("");
    setAppliedFilter({
      mode: "custom",
      period: span,
      from: customFrom,
      to: customTo,
    });
  };

  const statCards = useMemo(() => {
    const overall = dashboardStats?.overall_statistics || {};
    const statusOccupancy = libraryStatus?.occupancy || {};

    return [
      {
        icon: Users,
        label: "Current Occupancy",
        value: Number(statusOccupancy.current_occupancy || 0),
        color: "bg-blue-500",
      },
      {
        icon: BookOpen,
        label: "Total Books",
        value: Number(overall.total_books || 0),
        color: "bg-emerald-500",
      },
      {
        icon: RefreshCw,
        label: "Active Checkouts",
        value: Number(overall.current_checkouts || 0),
        color: "bg-indigo-500",
      },
      {
        icon: Bookmark,
        label: "Active Reservations",
        value: Number(overall.active_reservations || 0),
        color: "bg-amber-500",
      },
      {
        icon: DollarSign,
        label: "Pending Fines",
        value: `$${Number(overall.total_outstanding_fines || 0).toFixed(2)}`,
        color: "bg-rose-500",
      },
      {
        icon: TrendingUp,
        label: "Overdue Books",
        value: Number(
          dashboardStats?.circulation_metrics?.overdue_books ||
            transactionStats?.overall_statistics?.overdue_books ||
            0,
        ),
        color: "bg-orange-500",
      },
    ];
  }, [dashboardStats, libraryStatus, transactionStats]);

  const todayCards = useMemo(() => {
    const today = dashboardStats?.today_metrics || {};
    return [
      {
        label: "Entries Today",
        value: Number(today.todays_entries || 0),
      },
      {
        label: "Checkouts Today",
        value: Number(today.todays_checkouts || 0),
      },
      {
        label: "Returns Today",
        value: Number(today.todays_returns || 0),
      },
      {
        label: "Reservations Today",
        value: Number(today.todays_reservations || 0),
      },
    ];
  }, [dashboardStats]);

  const chartSeries = useMemo(() => {
    const txTrend = [...(transactionStats?.daily_trends || [])]
      .reverse()
      .slice(-14)
      .map((item) => ({
        label: item.transaction_date || "",
        value: Number(item.checkouts || 0),
      }));

    const activityTrend = [...(dashboardStats?.activity_trends || [])]
      .reverse()
      .slice(-14)
      .map((item) => ({
        label: item.activity_date || "",
        value: Number(item.daily_returns || 0) + Number(item.unique_entries || 0),
      }));

    const fineTrend = [...(fineStats?.daily_statistics || [])]
      .reverse()
      .slice(-14)
      .map((item) => ({
        label: item.payment_date || "",
        value: Number(item.amount_collected || 0),
      }));

    return {
      txTrend,
      activityTrend,
      fineTrend,
    };
  }, [dashboardStats, fineStats, transactionStats]);

  const trendSummary = useMemo(() => {
    const summarize = (points) => {
      if (!points?.length) {
        return { latest: 0, previous: 0, diff: 0, direction: "flat" };
      }
      const latest = Number(points[points.length - 1]?.value || 0);
      const previous = Number(points[points.length - 2]?.value || 0);
      const diff = latest - previous;
      const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      return { latest, previous, diff, direction };
    };

    return {
      tx: summarize(chartSeries.txTrend),
      activity: summarize(chartSeries.activityTrend),
      fine: summarize(chartSeries.fineTrend),
    };
  }, [chartSeries]);

  const peakHours = useMemo(() => {
    return [...(userInsights?.hourly_usage_pattern || [])]
      .map((item) => ({
        hour: Number(item.hour_of_day || 0),
        traffic: Number(item.entries || 0) + Number(item.checkouts || 0),
        entries: Number(item.entries || 0),
        checkouts: Number(item.checkouts || 0),
      }))
      .sort((a, b) => b.traffic - a.traffic)
      .slice(0, 5);
  }, [userInsights]);

  const topShelfUtilization = useMemo(() => {
    return [...(bookAnalytics?.shelf_utilization || [])]
      .map((item) => ({
        ...item,
        utilization_percent: Number(item.utilization_percent || 0),
      }))
      .sort((a, b) => b.utilization_percent - a.utilization_percent)
      .slice(0, 6);
  }, [bookAnalytics]);

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shadow-sm`}
        >
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );

  const formatDateTime = (value) => {
    if (!value) {
      return "N/A";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "N/A";
    }
    return `${format(parsed, "MMM dd, yyyy")}, ${format(parsed, "h:mm a")}`;
  };

  const renderAlertTone = (type) => {
    if (type === "overdue") {
      return "bg-red-50 border-red-200 text-red-800";
    }
    if (type === "expired_reservations") {
      return "bg-orange-50 border-orange-200 text-orange-800";
    }
    return "bg-amber-50 border-amber-200 text-amber-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 text-white border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2 tracking-tight">
              Welcome back, {user?.name || "User"}!
            </h1>
            <p className="text-primary-100 text-sm md:text-base">
              Structured operations dashboard for live library health, circulation,
              reservations, and fines.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={dateMode}
              onChange={(event) => setDateMode(event.target.value)}
              className="input py-2 px-3 text-sm bg-white/95 text-slate-800"
            >
              <option value="preset">Preset</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateMode === "preset" ? (
              <select
                value={period}
                onChange={(event) => setPeriod(Number(event.target.value))}
                className="input py-2 px-3 text-sm bg-white/95 text-slate-800"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            ) : (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(event) => setCustomFrom(event.target.value)}
                  className="input py-2 px-3 text-sm bg-white/95 text-slate-800"
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={(event) => setCustomTo(event.target.value)}
                  className="input py-2 px-3 text-sm bg-white/95 text-slate-800"
                />
              </>
            )}

            <button
              type="button"
              onClick={applyFilters}
              className="btn bg-primary-800 text-white hover:bg-primary-900"
            >
              Apply
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              className="btn bg-white text-primary-700 hover:bg-primary-50"
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={`mr-2 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-3 text-xs text-primary-100">
          Active window: {appliedFilter.mode === "custom" && appliedFilter.from && appliedFilter.to
            ? `${appliedFilter.from} to ${appliedFilter.to}`
            : `Last ${effectivePeriod} days`}
          {filterError ? ` | ${filterError}` : ""}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Key Metrics</h2>
        <button
          type="button"
          className="btn btn-secondary py-2 px-3 text-sm"
          onClick={() =>
            downloadCsv(
              "dashboard-kpis.csv",
              statCards.map((card) => ({ metric: card.label, value: card.value })),
              [
                { key: "metric", label: "Metric" },
                { key: "value", label: "Value" },
              ],
            )
          }
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            color={card.color}
          />
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Today Snapshot</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-secondary py-2 px-3 text-sm"
              onClick={() =>
                downloadCsv(
                  "today-snapshot.csv",
                  todayCards.map((item) => ({ metric: item.label, value: item.value })),
                  [
                    { key: "metric", label: "Metric" },
                    { key: "value", label: "Value" },
                  ],
                )
              }
            >
              Export CSV
            </button>
            <span className="text-sm text-slate-500">Daily operational metrics</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {todayCards.map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BadgeAlert className="text-primary-600" size={20} />
              <h2 className="text-xl font-bold tracking-tight">System Alerts</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary py-2 px-3 text-sm"
              onClick={() =>
                downloadCsv(
                  "system-alerts.csv",
                  (libraryStatus?.alerts || []).map((alert) => ({
                    alert_type: alert.alert_type,
                    message: alert.message,
                    count: alert.count,
                  })),
                  [
                    { key: "alert_type", label: "Type" },
                    { key: "message", label: "Message" },
                    { key: "count", label: "Count" },
                  ],
                )
              }
            >
              Export CSV
            </button>
          </div>

          {libraryStatus?.alerts?.length ? (
            <div className="space-y-3">
              {libraryStatus.alerts.map((alert) => (
                <div
                  key={alert.alert_type}
                  className={`p-3 border rounded-xl ${renderAlertTone(alert.alert_type)}`}
                >
                  <p className="text-sm font-semibold">
                    {alert.message} : {alert.count}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No active alerts</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold tracking-tight">Live Status</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600">Current Occupancy</span>
              <span className="font-semibold text-slate-900">
                {libraryStatus?.occupancy?.current_occupancy || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600">Books Checked Out</span>
              <span className="font-semibold text-slate-900">
                {libraryStatus?.circulation?.books_checked_out || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600">Ready Reservations</span>
              <span className="font-semibold text-slate-900">
                {libraryStatus?.reservations?.ready_for_pickup || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600">Overdue Books</span>
              <span className="font-semibold text-slate-900">
                {libraryStatus?.circulation?.overdue_books || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
          </div>

          {libraryStatus?.recent_activity?.length ? (
            <div className="space-y-3">
              {libraryStatus.recent_activity.slice(0, 6).map((activity, index) => (
                <div
                  key={`${activity.activity_type}-${index}`}
                  className="p-3 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <p className="font-medium capitalize text-slate-800">
                    {activity.activity_type} - {activity.user_name || "Unknown user"}
                  </p>
                  <p className="text-sm text-slate-600 truncate">
                    {activity.book_title || "No book title"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDateTime(activity.activity_time)}
                  </p>
                  {activity.activity_time && (
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDistanceToNowStrict(new Date(activity.activity_time), {
                        addSuffix: true,
                      })}
                    </p>
                  )}
                  <div className="text-xs text-slate-500 mt-1">
                    {activity.description || "Library activity"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Popular Books</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary py-2 px-3 text-sm"
                onClick={() =>
                  downloadCsv(
                    "popular-books.csv",
                    (dashboardStats?.popular_books || []).map((book) => ({
                      title: book.title,
                      author: book.author,
                      demand: Number(book.total_demand || 0),
                      checkouts: Number(book.checkout_count || 0),
                      reservations: Number(book.reservation_count || 0),
                    })),
                    [
                      { key: "title", label: "Title" },
                      { key: "author", label: "Author" },
                      { key: "demand", label: "Total Demand" },
                      { key: "checkouts", label: "Checkout Count" },
                      { key: "reservations", label: "Reservation Count" },
                    ],
                  )
                }
              >
                Export CSV
              </button>
              <button
                type="button"
                className="text-primary-700 text-sm font-medium hover:underline"
                onClick={() => navigate("/books")}
              >
                View all
              </button>
            </div>
          </div>

          {dashboardStats?.popular_books?.length ? (
            <div className="space-y-2">
              {dashboardStats.popular_books.slice(0, 6).map((book) => (
                <div
                  key={book.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{book.title}</p>
                    <p className="text-xs text-slate-500 truncate">{book.author}</p>
                  </div>
                  <span className="text-xs bg-primary-100 text-primary-700 rounded-full px-2 py-1">
                    {book.total_demand || 0} demand
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No demand data available</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">High Demand Titles</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary py-2 px-3 text-sm"
                onClick={() =>
                  downloadCsv(
                    "high-demand-books.csv",
                    (bookAnalytics?.high_demand_books || []).map((book) => ({
                      title: book.title,
                      author: book.author,
                      total_demand: Number(book.total_demand || 0),
                      total_copies: Number(book.total_copies || 0),
                      demand_ratio: Number(book.demand_ratio || 0),
                    })),
                    [
                      { key: "title", label: "Title" },
                      { key: "author", label: "Author" },
                      { key: "total_demand", label: "Total Demand" },
                      { key: "total_copies", label: "Total Copies" },
                      { key: "demand_ratio", label: "Demand Ratio" },
                    ],
                  )
                }
              >
                Export CSV
              </button>
              <button
                type="button"
                className="text-primary-700 text-sm font-medium hover:underline"
                onClick={() => navigate("/book-search")}
              >
                Search books
              </button>
            </div>
          </div>

          {bookAnalytics?.high_demand_books?.length ? (
            <div className="space-y-2">
              {bookAnalytics.high_demand_books.slice(0, 6).map((book) => (
                <div
                  key={book.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <p className="font-medium text-slate-900 truncate">{book.title}</p>
                  <div className="text-xs text-slate-600 mt-1 flex items-center justify-between">
                    <span>Demand ratio: {book.demand_ratio || 0}</span>
                    <span>
                      {book.total_demand || 0} requests / {book.total_copies || 0} copies
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No demand insights available</p>
          )}
        </div>
      </div>

      {canManageCirculation && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Pending Fine Queue</h2>
              <button
                type="button"
                className="btn btn-secondary py-2 px-3 text-sm"
                onClick={() =>
                  downloadCsv(
                    "pending-fine-queue.csv",
                    topPendingFines.map((fine) => ({
                      fine_id: fine.id,
                      user: fine.user_name || `User #${fine.user_id}`,
                      amount: Number(fine.amount || 0).toFixed(2),
                      transaction_id: fine.transaction_id || "",
                      status: fine.status || "pending",
                    })),
                    [
                      { key: "fine_id", label: "Fine ID" },
                      { key: "user", label: "User" },
                      { key: "amount", label: "Amount" },
                      { key: "transaction_id", label: "Transaction ID" },
                      { key: "status", label: "Status" },
                    ],
                  )
                }
              >
                Export CSV
              </button>
            </div>
            {topPendingFines.length ? (
              <div className="space-y-2">
                {topPendingFines.map((fine) => (
                  <div
                    key={fine.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        {fine.user_name || `User #${fine.user_id}`}
                      </p>
                      <span className="text-sm font-bold text-rose-700">
                        ${Number(fine.amount || 0).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Transaction #{fine.transaction_id || "N/A"} | Status {fine.status || "pending"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No pending fines found</p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold tracking-tight">Ready Reservations</h2>
              <button
                type="button"
                className="btn btn-secondary py-2 px-3 text-sm"
                onClick={() =>
                  downloadCsv(
                    "ready-reservations.csv",
                    readyReservations.map((reservation) => ({
                      reservation_id: reservation.id,
                      title: reservation.title || `Book #${reservation.book_id}`,
                      user: reservation.user_name || `User #${reservation.user_id}`,
                      status: reservation.status || "ready",
                    })),
                    [
                      { key: "reservation_id", label: "Reservation ID" },
                      { key: "title", label: "Book" },
                      { key: "user", label: "User" },
                      { key: "status", label: "Status" },
                    ],
                  )
                }
              >
                Export CSV
              </button>
            </div>
            {readyReservations.length ? (
              <div className="space-y-2">
                {readyReservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 truncate pr-3">
                        {reservation.title || `Book #${reservation.book_id}`}
                      </p>
                      <span className="text-xs rounded-full bg-emerald-100 text-emerald-700 px-2 py-1">
                        READY
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {reservation.user_name || `User #${reservation.user_id}`}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No ready reservations</p>
            )}
          </div>
        </div>
      )}

      {!canManageCirculation && (
        <div className="card">
          <h2 className="text-xl font-bold tracking-tight mb-2">Student Focus View</h2>
          <p className="text-sm text-slate-600">
            Advanced operational queues are available for librarian and admin roles.
            You can still access books, transactions, fines, and reservations from quick actions.
          </p>
        </div>
      )}

      <Suspense
        fallback={
          <div className="card">
            <p className="text-slate-500">Loading analytics modules...</p>
          </div>
        }
      >
        <AnalyticsSections
          chartSeries={chartSeries}
          trendSummary={trendSummary}
          peakHours={peakHours}
          userInsights={userInsights}
          topShelfUtilization={topShelfUtilization}
          roleName={roleName}
        />
      </Suspense>

      <div className="card">
        <h2 className="text-xl font-bold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            className="btn btn-primary py-4"
            onClick={() => navigate("/book-search")}
          >
            <BookOpen size={20} className="inline mb-1" />
            <br />
            Search Books
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/transactions")}
          >
            <RefreshCw size={20} className="inline mb-1" />
            <br />
            Transactions
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/fines")}
          >
            <DollarSign size={20} className="inline mb-1" />
            <br />
            Fines
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/reservations")}
          >
            <Bookmark size={20} className="inline mb-1" />
            <br />
            Reservations
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/rfid")}
          >
            <Scan size={20} className="inline mb-1" />
            <br />
            Scan RFID
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/navigation")}
          >
            <ArrowRight size={20} className="inline mb-1" />
            <br />
            Navigate
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="text-base font-semibold mb-1">Transaction Metrics</h3>
          <p className="text-sm text-slate-600">
            Active {transactionStats?.overall_statistics?.active_checkouts || 0} | Completed {transactionStats?.overall_statistics?.completed_returns || 0}
          </p>
        </div>
        <div className="card">
          <h3 className="text-base font-semibold mb-1">Fine Metrics</h3>
          <p className="text-sm text-slate-600">
            Pending {fineStats?.overall_statistics?.pending_count || 0} | Collected ${Number(fineStats?.overall_statistics?.collected_amount || 0).toFixed(2)}
          </p>
        </div>
        <div className="card">
          <h3 className="text-base font-semibold mb-1">Reservation Metrics</h3>
          <p className="text-sm text-slate-600">
            Active {reservationStats?.overall_statistics?.active_reservations || 0} | Ready {reservationStats?.overall_statistics?.ready_reservations || 0}
          </p>
        </div>
      </div>

      {libraryStatus?.timestamp && (
        <p className="text-xs text-slate-500 flex items-center gap-2">
          <AlertTriangle size={14} className="text-slate-400" />
          Last status sync: {formatDateTime(libraryStatus.timestamp)}
        </p>
      )}
    </div>
  );
};

export default Dashboard;

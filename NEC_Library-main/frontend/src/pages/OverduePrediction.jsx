import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle, Clock, Shield, RefreshCw, Bell,
  CheckCircle, XCircle, Info, Calendar, User,
  BookOpen, TrendingUp, BarChart2, Filter, Zap,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts';
import { format, parseISO, isValid } from 'date-fns';


// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK = {
  critical: { label: 'Critical', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-800',    dot: 'bg-red-500',    bar: 'bg-red-500'    },
  high    : { label: 'High',     color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', bar: 'bg-orange-500' },
  medium  : { label: 'Medium',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-400',  bar: 'bg-amber-400'  },
  low     : { label: 'Low',      color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-800',  dot: 'bg-green-500',  bar: 'bg-green-500'  },
};

const classifyRisk = (daysOverdue, renewedCount = 0, prevOverdues = 0) => {
  let score = 0;
  if (daysOverdue < 0)    score += 50;
  else if (daysOverdue <= 1) score += 40;
  else if (daysOverdue <= 3) score += 25;
  else if (daysOverdue <= 7) score += 10;
  if (renewedCount >= 2) score += 25; else if (renewedCount >= 1) score += 10;
  if (prevOverdues >= 3) score += 25; else if (prevOverdues >= 1) score += 10;
  if (score >= 60) return 'critical';
  if (score >= 35) return 'high';
  if (score >= 15) return 'medium';
  return 'low';
};

const fmtDate = (d) => {
  if (!d) return '—';
  const p = parseISO(d);
  return isValid(p) ? format(p, 'dd MMM yyyy') : '—';
};

const SkeletonRow = () => (
  <div className="card animate-pulse flex gap-4">
    <div className="w-3 h-3 rounded-full bg-slate-200 mt-1.5 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 rounded w-1/3" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
      <div className="h-2.5 bg-slate-200 rounded w-full" />
    </div>
  </div>
);

// ── Alert Card ────────────────────────────────────────────────────────────────
const AlertCard = ({ row, onNotify }) => {
  const daysOverdue = parseInt(row.days_overdue, 10);
  const risk = classifyRisk(daysOverdue, row.renewed_count || 0, 0);
  const cfg = RISK[risk];
  const [notified, setNotified] = useState(false);

  const dueLabel = daysOverdue <= 0
    ? `${Math.abs(daysOverdue)} day(s) overdue`
    : `Due in ${daysOverdue} day(s)`;

  const scoreWidth = risk === 'critical' ? 95 : risk === 'high' ? 72 : risk === 'medium' ? 45 : 15;

  const handleNotify = () => {
    setNotified(true);
    onNotify?.(row);
  };

  return (
    <div className={`card border ${cfg.border} ${cfg.bg} transition-all duration-300`}>
      <div className="flex items-start gap-4">
        <div className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${cfg.dot} ${risk === 'critical' ? 'animate-pulse' : ''}`} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-start gap-2 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900">{row.user_name}</span>
                {row.student_id && <span className="text-xs text-slate-500">({row.student_id})</span>}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label} Risk</span>
              </div>
              <p className="text-sm text-slate-700 font-medium mt-0.5 truncate">
                <BookOpen size={13} className="inline mr-1 text-slate-400" />
                {row.book_title}
                {row.book_author && <span className="text-slate-400 font-normal"> — {row.book_author}</span>}
              </p>
            </div>
            {!notified ? (
              <button onClick={handleNotify} className="btn btn-secondary text-xs py-1 px-3 flex-shrink-0">
                <Bell size={12} className="inline mr-1" />Notify
              </button>
            ) : (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle size={13} /> Notified
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-3 text-xs">
            <span className={`flex items-center gap-1 font-semibold ${daysOverdue >= 0 ? 'text-red-600' : 'text-slate-600'}`}>
              <Calendar size={12} />{dueLabel}
            </span>
            <span className="flex items-center gap-1 text-slate-500"><Clock size={12} />Due: {fmtDate(row.due_date)}</span>
            <span className="flex items-center gap-1 text-slate-500"><User size={12} />{row.email || '—'}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white rounded-full overflow-hidden border border-slate-200">
              <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${scoreWidth}%` }} />
            </div>
            <span className={`text-xs font-bold w-10 text-right ${cfg.color}`}>{scoreWidth}%</span>
          </div>

          <p className="text-sm font-bold text-rose-700">
            Fine: ₹{parseFloat(row.fine_amount || 0).toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const OverduePrediction = () => {
  const { user } = useAuth();
  const [overdueList, setOverdueList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterRisk, setFilterRisk] = useState('all');
  const [showAlgoInfo, setShowAlgoInfo] = useState(false);

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.role_name;
  const isLibrarian = ['admin', 'librarian'].includes((roleName || '').toLowerCase());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = isLibrarian ? {} : { userId: user?.id };
      const [listRes, sumRes, trendRes] = await Promise.all([
        api.get('/overdue/list', { params: { ...params, limit: 50 } }).catch(() => ({ data: { overdue: [] } })),
        api.get('/overdue/summary').catch(() => ({ data: { summary: {} } })),
        api.get('/overdue/trend/weekly').catch(() => ({ data: { trend: [] } })),
      ]);
      setOverdueList(listRes.data?.overdue || []);
      setSummary(sumRes.data?.summary || {});
      setWeeklyTrend(trendRes.data?.trend || []);
    } catch {
      setOverdueList([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isLibrarian]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRunCheck = async () => {
    try {
      await api.post('/overdue/run-check');
      await loadData();
    } catch {/* ignore */}
  };

  // Enrich with risk level
  const enriched = useMemo(() =>
    overdueList.map(row => ({
      ...row,
      risk: classifyRisk(parseInt(row.days_overdue, 10)),
    })),
    [overdueList]
  );

  const filtered = useMemo(() =>
    filterRisk === 'all' ? enriched : enriched.filter(r => r.risk === filterRisk),
    [enriched, filterRisk]
  );

  const counts = useMemo(() => ({
    critical: enriched.filter(r => r.risk === 'critical').length,
    high    : enriched.filter(r => r.risk === 'high').length,
    medium  : enriched.filter(r => r.risk === 'medium').length,
    low     : enriched.filter(r => r.risk === 'low').length,
  }), [enriched]);

  const FILTER_TABS = [
    { id: 'all',      label: `All (${enriched.length})` },
    { id: 'critical', label: `Critical (${counts.critical})` },
    { id: 'high',     label: `High (${counts.high})` },
    { id: 'medium',   label: `Medium (${counts.medium})` },
    { id: 'low',      label: `Low (${counts.low})` },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="card bg-gradient-to-r from-rose-600 via-red-600 to-orange-600 text-white border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={22} />
              <h1 className="text-2xl font-bold tracking-tight">Overdue Alert System</h1>
            </div>
            <p className="text-rose-100 text-sm">
              Live detection of overdue books with rule-based risk scoring. Background check runs every hour.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAlgoInfo(p => !p)} className="btn bg-white/20 hover:bg-white/30 text-white text-sm backdrop-blur-sm">
              <Info size={15} className="mr-1.5 inline" />Scoring rules
            </button>
            {isLibrarian && (
              <button onClick={handleRunCheck} className="btn bg-white/20 hover:bg-white/30 text-white text-sm backdrop-blur-sm">
                <Zap size={15} className="mr-1.5 inline" />Run Check Now
              </button>
            )}
            <button onClick={handleRefresh} disabled={refreshing} className="btn bg-white text-rose-700 hover:bg-rose-50 text-sm">
              <RefreshCw size={15} className={`mr-1.5 inline ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>
        {showAlgoInfo && (
          <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl p-4 text-sm text-rose-50 space-y-1">
            <p className="font-bold text-white">⚙️ Risk Scoring Rules</p>
            <p>Already overdue → <span className="font-bold">+50 pts</span> · Due in 1 day → +40 · 3 days → +25 · 7 days → +10</p>
            <p>2+ renewals → <span className="font-bold">+25 pts</span> · 1 renewal → +10</p>
            <p>3+ prior overdues → <span className="font-bold">+25 pts</span> · 1–2 prior → +10</p>
            <p className="text-rose-200 text-xs pt-1">Critical ≥60 · High ≥35 · Medium ≥15 · Low &lt;15</p>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Overdue',    value: summary?.total_overdue || 0,          icon: AlertTriangle, cfg: RISK.critical },
          { label: 'Highest Fine',     value: `₹${parseFloat(summary?.highest_fine || 0).toFixed(2)}`, icon: TrendingUp, cfg: RISK.high },
          { label: 'Longest Overdue',  value: `${summary?.max_days_overdue || 0} days`, icon: Clock,  cfg: RISK.medium },
          { label: 'Total Fine Accrued', value: `₹${parseFloat(summary?.total_fine_accrued || 0).toFixed(2)}`, icon: BarChart2, cfg: RISK.low },
        ].map(s => (
          <div key={s.label} className={`card border ${s.cfg.border} ${s.cfg.bg}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${s.cfg.color}`}>{s.label}</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{s.value}</p>
              </div>
              <s.icon size={20} className={s.cfg.color} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Risk Summary Tiles (clickable filters) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['critical','high','medium','low']).map(level => {
          const cfg = RISK[level];
          return (
            <button key={level} onClick={() => setFilterRisk(filterRisk === level ? 'all' : level)}
              className={`card text-left border transition-all duration-200 cursor-pointer hover:shadow-md ${filterRisk === level ? `${cfg.border} ${cfg.bg} ring-2 ring-offset-1 ${cfg.border.replace('border-','ring-')}` : 'border-slate-200'}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>{cfg.label}</p>
              <p className="text-3xl font-black text-slate-900 mt-1">{counts[level]}</p>
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full ${cfg.bar} rounded-full`} style={{ width: enriched.length ? `${(counts[level] / enriched.length) * 100}%` : '0%' }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {FILTER_TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setFilterRisk(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 ${filterRisk === id ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >{label}</button>
        ))}
      </div>

      {/* ── Alert List ── */}
      {loading ? (
        <div className="space-y-3">{Array(4).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
          <Shield size={36} />
          <p className="text-lg font-semibold text-slate-600">No overdue records in this category.</p>
          <p className="text-sm">All monitored checkouts are within safe parameters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered
            .sort((a, b) => {
              const order = { critical:0, high:1, medium:2, low:3 };
              return order[a.risk] - order[b.risk];
            })
            .map(row => (
              <AlertCard key={row.transaction_id} row={row} onNotify={() => {}} />
            ))}
        </div>
      )}

      {/* ── Scoring Rules Reference ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={20} className="text-rose-500" />
          <h2 className="text-xl font-bold tracking-tight">Scoring Rules Reference</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {[
            { title: 'Due Date Pattern', icon: Calendar, color: 'text-blue-500',
              rules: [['Already overdue','text-red-600','+50 pts'],['Due within 1 day','text-orange-600','+40 pts'],['Due within 3 days','text-amber-600','+25 pts'],['Due within 7 days','text-slate-600','+10 pts']] },
            { title: 'Renewal Behaviour', icon: RefreshCw, color: 'text-purple-500',
              rules: [['2+ renewals','text-red-600','+25 pts'],['1 renewal','text-amber-600','+10 pts'],['No renewals','text-slate-400','+0 pts']] },
            { title: 'Historical Overdues', icon: User, color: 'text-rose-500',
              rules: [['3+ prior overdues','text-red-600','+25 pts'],['1–2 prior overdues','text-amber-600','+10 pts'],['No history','text-slate-400','+0 pts']] },
          ].map(section => (
            <div key={section.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <section.icon size={16} className={section.color} />
                <span className="font-semibold text-slate-800">{section.title}</span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {section.rules.map(([label, cls, pts]) => (
                  <li key={label} className="flex justify-between">
                    <span className="text-slate-600">{label}</span>
                    <span className={`font-bold ${cls}`}>{pts}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// patch missing Zap import

export default OverduePrediction;


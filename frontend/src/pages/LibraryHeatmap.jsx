import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart2, TrendingUp, Clock, Filter, RefreshCw,
  Layers, Download, Calendar, Info,
} from 'lucide-react';
import api from '../services/api';

// ── Heat level config ─────────────────────────────────────────────────────────
const HEAT = {
  very_high: { label: 'Very High', bg: 'bg-red-500',    text: 'text-white',      border: 'border-red-600',    legend: '#ef4444' },
  high     : { label: 'High',      bg: 'bg-orange-400', text: 'text-white',      border: 'border-orange-500', legend: '#fb923c' },
  medium   : { label: 'Medium',    bg: 'bg-yellow-300', text: 'text-yellow-900', border: 'border-yellow-400', legend: '#fde047' },
  low      : { label: 'Low',       bg: 'bg-green-200',  text: 'text-green-900',  border: 'border-green-300',  legend: '#86efac' },
};

const heatBg = (level) => HEAT[level]?.bg || HEAT.low.bg;
const heatText = (level) => HEAT[level]?.text || HEAT.low.text;
const heatBorder = (level) => HEAT[level]?.border || HEAT.low.border;

// ── Sparkline (mini bar chart, pure SVG) ──────────────────────────────────────
const Sparkline = ({ data, color = '#7c3aed', height = 40 }) => {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value || 0), 1);
  const w = 300; const barW = Math.floor(w / data.length) - 1;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const bh = Math.max(2, ((d.value || 0) / max) * (height - 4));
        return (
          <rect key={i} x={i * (barW + 1)} y={height - bh} width={barW} height={bh}
            fill={color} rx="1" opacity="0.85" />
        );
      })}
    </svg>
  );
};

// ── Heatmap SVG Grid ──────────────────────────────────────────────────────────
const HeatmapGrid = ({ heatmap, hoveredShelf, setHoveredShelf }) => {
  if (!heatmap.length) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      No heatmap data available yet.
    </div>
  );

  return (
    <svg viewBox="0 0 120 100" className="w-full" style={{ maxHeight: 380 }} aria-label="Library heatmap">
      <rect x="0" y="0" width="120" height="100" rx="3" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.3" />
      <text x="4" y="7" fontSize="3" fill="#64748b" fontWeight="600">Library Activity Heatmap</text>

      {heatmap.map((shelf) => {
        const x = parseFloat(shelf.coord_x) || 20;
        const y = parseFloat(shelf.coord_y) || 20;
        const hl = shelf.heat_level || 'low';
        const isHovered = hoveredShelf?.shelf_code === shelf.shelf_code;
        const fillColor = hl === 'very_high' ? '#ef4444'
          : hl === 'high'    ? '#fb923c'
          : hl === 'medium'  ? '#fde047'
          : '#86efac';

        return (
          <g key={shelf.shelf_code} className="cursor-pointer"
            onMouseEnter={() => setHoveredShelf(shelf)}
            onMouseLeave={() => setHoveredShelf(null)}
          >
            <rect x={x - 7} y={y - 6} width={14} height={12} rx={2}
              fill={fillColor}
              stroke={isHovered ? '#1e293b' : '#cbd5e1'}
              strokeWidth={isHovered ? 0.8 : 0.3}
              style={isHovered ? { filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.3))' } : {}}
            />
            <text x={x} y={y + 0.5} textAnchor="middle" fontSize="3"
              fontWeight={isHovered ? '800' : '600'} fill="#1e293b"
            >
              {shelf.shelf_code}
            </text>
            <text x={x} y={y + 4} textAnchor="middle" fontSize="1.8" fill="#475569">
              {parseInt(shelf.popularity_score, 10) || 0}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      {Object.entries(HEAT).map(([key, cfg], i) => (
        <g key={key}>
          <rect x={8 + i * 28} y={90} width={8} height={4} rx="1" fill={cfg.legend} />
          <text x={17 + i * 28} y={93.5} fontSize="2.2" fill="#64748b">{cfg.label}</text>
        </g>
      ))}
    </svg>
  );
};

// ── Tooltip ───────────────────────────────────────────────────────────────────
const ShelfTooltip = ({ shelf }) => {
  if (!shelf) return null;
  const cfg = HEAT[shelf.heat_level] || HEAT.low;
  return (
    <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl z-10 min-w-[160px]">
      <p className="font-bold text-base">{shelf.shelf_code}</p>
      <p className="text-slate-400">{shelf.section}</p>
      <div className="mt-2 space-y-1">
        <p>Borrows: <span className="font-bold text-emerald-400">{shelf.total_borrows}</span></p>
        <p>Scans: <span className="font-bold text-blue-400">{shelf.total_scans}</span></p>
        <p>Returns: <span className="font-bold text-amber-400">{shelf.total_returns}</span></p>
        <p>Score: <span className="font-bold text-violet-400">{shelf.popularity_score}</span></p>
      </div>
      <div className={`mt-2 px-2 py-0.5 rounded-full text-center text-white text-xs ${cfg.bg}`}>
        {cfg.label} Activity
      </div>
    </div>
  );
};

// ── CSV export ────────────────────────────────────────────────────────────────
const exportCSV = (data) => {
  const header = 'Shelf,Section,Floor,Borrows,Scans,Returns,Score,Heat Level';
  const rows = data.map(d =>
    `${d.shelf_code},${d.section || ''},${d.floor || 1},${d.total_borrows},${d.total_scans},${d.total_returns},${d.popularity_score},${d.heat_level}`
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'heatmap-export.csv'; a.click();
  URL.revokeObjectURL(url);
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton = ({ h = 'h-16' }) => (
  <div className={`card animate-pulse ${h} bg-slate-100`} />
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const LibraryHeatmap = () => {
  const [heatmap, setHeatmap]           = useState([]);
  const [popularShelves, setPopularShelves] = useState([]);
  const [hourly, setHourly]             = useState([]);
  const [dailyTrend, setDailyTrend]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [period, setPeriod]             = useState('30');
  const [hoveredShelf, setHoveredShelf] = useState(null);
  const [activeTab, setActiveTab]       = useState('heatmap');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hmRes, popRes, hrRes, trendRes] = await Promise.all([
        api.get('/heatmap',              { params: { period } }).catch(() => ({ data: { heatmap: [] } })),
        api.get('/heatmap/popular-shelves', { params: { period, limit: 10 } }).catch(() => ({ data: { shelves: [] } })),
        api.get('/heatmap/hourly').catch(() => ({ data: { hourly: [] } })),
        api.get('/heatmap/daily-trend', { params: { period } }).catch(() => ({ data: { trend: [] } })),
      ]);
      setHeatmap(hmRes.data?.heatmap || []);
      setPopularShelves(popRes.data?.shelves || []);
      setHourly(hrRes.data?.hourly || []);
      setDailyTrend(trendRes.data?.trend || []);
    } catch {
      setHeatmap([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  // Summary stats
  const totalBorrows   = heatmap.reduce((s, h) => s + (parseInt(h.total_borrows, 10) || 0), 0);
  const totalScans     = heatmap.reduce((s, h) => s + (parseInt(h.total_scans,   10) || 0), 0);
  const criticalShelves= heatmap.filter(h => h.heat_level === 'very_high').length;
  const quietShelves   = heatmap.filter(h => h.heat_level === 'low').length;

  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    return hourly.reduce((max, h) => (h.count > max.count ? h : max), hourly[0]);
  }, [hourly]);

  const maxHourly = useMemo(() => Math.max(...hourly.map(h => h.count), 1), [hourly]);
  const maxDaily  = useMemo(() => Math.max(...dailyTrend.map(d => parseInt(d.borrows, 10) || 0), 1), [dailyTrend]);

  const TABS = [
    { id: 'heatmap',  label: 'Heatmap',      icon: Layers    },
    { id: 'shelves',  label: 'Top Shelves',  icon: BarChart2 },
    { id: 'hourly',   label: 'Peak Hours',   icon: Clock     },
    { id: 'trend',    label: 'Daily Trend',  icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="card bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 text-white border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={22} />
              <h1 className="text-2xl font-bold tracking-tight">Library Heatmap Analytics</h1>
            </div>
            <p className="text-indigo-100 text-sm">
              Real-time shelf activity — borrows, scans, and returns visualized as an interactive floor heatmap.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="input py-2 px-3 text-sm bg-white/95 text-slate-800 min-w-[130px]"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button onClick={() => exportCSV(heatmap)} className="btn bg-white/20 hover:bg-white/30 text-white text-sm backdrop-blur-sm">
              <Download size={15} className="mr-1.5 inline" />Export CSV
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="btn bg-white text-indigo-700 hover:bg-indigo-50 text-sm">
              <RefreshCw size={15} className={`mr-1.5 inline ${refreshing ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Borrows',      value: totalBorrows,   color: 'bg-violet-500', icon: BarChart2  },
          { label: 'Total Scans',        value: totalScans,     color: 'bg-blue-500',   icon: Layers     },
          { label: 'Hot Shelves',        value: criticalShelves, color: 'bg-red-500',   icon: TrendingUp },
          { label: 'Quiet Shelves',      value: quietShelves,   color: 'bg-emerald-500', icon: Calendar  },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
              <s.icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Peak hour summary */}
      {peakHour && (
        <div className="card bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 flex items-center gap-3">
          <Clock size={20} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <span className="font-bold">Peak Hour:</span> {peakHour.label} — {peakHour.count} activities.
            Plan staffing around this window.
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── Heatmap Tab ── */}
      {activeTab === 'heatmap' && (
        <div className="card relative overflow-visible">
          {hoveredShelf && <ShelfTooltip shelf={hoveredShelf} />}
          {loading ? <Skeleton h="h-96" /> : (
            <HeatmapGrid heatmap={heatmap} hoveredShelf={hoveredShelf} setHoveredShelf={setHoveredShelf} />
          )}
          <p className="text-xs text-slate-500 text-center mt-2">Hover a shelf to see activity details</p>
        </div>
      )}

      {/* ── Top Shelves Tab ── */}
      {activeTab === 'shelves' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Most Popular Shelves</h2>
            {loading ? <Skeleton /> : popularShelves.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {popularShelves.slice(0, 10).map((s, i) => (
                  <div key={s.shelf_code} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">{s.shelf_code}</p>
                      <p className="text-xs text-slate-500">{s.section}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-violet-600">{s.borrows}</p>
                      <p className="text-xs text-slate-500">borrows</p>
                    </div>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                        style={{ width: popularShelves[0]?.borrows ? `${(s.borrows / popularShelves[0].borrows) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-bold mb-4">All Shelves — Activity Grid</h2>
            {loading ? <Skeleton h="h-48" /> : (
              <div className="grid grid-cols-3 gap-2">
                {heatmap.map(shelf => (
                  <div key={shelf.shelf_code}
                    className={`p-2.5 rounded-xl border text-center transition-all duration-200 cursor-default ${heatBg(shelf.heat_level)} ${heatBorder(shelf.heat_level)} border`}
                  >
                    <p className={`font-bold text-sm ${heatText(shelf.heat_level)}`}>{shelf.shelf_code}</p>
                    <p className={`text-xs ${heatText(shelf.heat_level)} opacity-80`}>{shelf.popularity_score}</p>
                    <p className={`text-[10px] ${heatText(shelf.heat_level)} opacity-70 mt-0.5`}>{HEAT[shelf.heat_level]?.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hourly Tab ── */}
      {activeTab === 'hourly' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Clock size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold">Hourly Traffic Distribution</h2>
            <span className="text-xs text-slate-500 ml-auto">Book location activity · Last 30 days</span>
          </div>
          {loading ? <Skeleton h="h-48" /> : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {hourly.map(h => (
                <div key={h.hour} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12 flex-shrink-0 text-right">{h.label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${h.count >= maxHourly * 0.8 ? 'bg-red-400' : h.count >= maxHourly * 0.5 ? 'bg-orange-400' : h.count >= maxHourly * 0.25 ? 'bg-amber-300' : 'bg-green-300'}`}
                      style={{ width: `${Math.max(2, (h.count / maxHourly) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-8 flex-shrink-0 ${h.count === peakHour?.count ? 'text-red-600' : 'text-slate-600'}`}>{h.count}</span>
                  {h.count === peakHour?.count && <span className="text-xs text-red-500 font-bold">← Peak</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Daily Trend Tab ── */}
      {activeTab === 'trend' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={20} className="text-violet-600" />
            <h2 className="text-lg font-bold">Daily Activity Trend</h2>
            <span className="text-xs text-slate-500 ml-auto">Last {period} days</span>
          </div>

          {loading ? <Skeleton h="h-48" /> : dailyTrend.length === 0 ? (
            <p className="text-slate-500 text-center py-12">No trend data available for this period.</p>
          ) : (
            <>
              {/* Mini sparkline */}
              <div className="mb-4">
                <Sparkline
                  data={dailyTrend.map(d => ({ value: parseInt(d.borrows, 10) || 0 }))}
                  color="#7c3aed"
                  height={60}
                />
              </div>

              {/* Table */}
              <div className="table-shell max-h-72 overflow-y-auto">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Borrows</th>
                      <th>Returns</th>
                      <th>Scans</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyTrend.slice().reverse().map(d => (
                      <tr key={d.activity_date}>
                        <td className="font-medium">{d.activity_date}</td>
                        <td className="font-bold text-violet-600">{d.borrows}</td>
                        <td>{d.returns}</td>
                        <td>{d.scans}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-400 rounded-full"
                                style={{ width: `${(parseInt(d.borrows, 10) / maxDaily) * 100}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default LibraryHeatmap;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, BookOpen, Users, Star, RefreshCw, Search,
  Heart, Tag, Clock, BarChart2, Zap, Info, TrendingUp,
  ExternalLink, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../contexts';
import api from '../services/api';

// ── helpers ───────────────────────────────────────────────────────────────────
const COVER_GRADIENTS = [
  'from-emerald-400 to-teal-600',
  'from-blue-400 to-indigo-600',
  'from-purple-400 to-violet-600',
  'from-amber-400 to-orange-600',
  'from-rose-400 to-pink-600',
  'from-cyan-400 to-sky-600',
  'from-lime-400 to-green-600',
  'from-fuchsia-400 to-purple-600',
  'from-red-400 to-rose-600',
  'from-teal-400 to-cyan-600',
];
const coverGradient = (id) => COVER_GRADIENTS[(id || 0) % COVER_GRADIENTS.length];

const ScoreBadge = ({ score }) => {
  const color =
    score >= 60 ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : score >= 35 ? 'bg-blue-100 text-blue-800 border-blue-200'
    : 'bg-amber-100 text-amber-800 border-amber-200';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score} pts
    </span>
  );
};

const SkeletonCard = () => (
  <div className="card flex gap-4 items-start animate-pulse">
    <div className="w-14 h-20 rounded-lg bg-slate-200 flex-shrink-0" />
    <div className="flex-1 space-y-2 pt-1">
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-3 bg-slate-200 rounded w-1/2" />
      <div className="h-3 bg-slate-200 rounded w-full" />
      <div className="h-3 bg-slate-200 rounded w-2/3" />
    </div>
  </div>
);

const BookCover = ({ bookId, title }) => (
  <div className={`w-14 h-20 rounded-lg bg-gradient-to-br ${coverGradient(bookId)} flex items-end p-1.5 shadow-md flex-shrink-0`}>
    <span className="text-white text-[8px] font-bold leading-tight line-clamp-3">{title}</span>
  </div>
);

const RecommendationCard = ({ rec }) => {
  const [liked, setLiked] = useState(false);

  return (
    <div className="card group flex gap-4 items-start hover:shadow-md transition-all duration-200">
      <BookCover bookId={rec.bookId} title={rec.title} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-slate-900 truncate">{rec.title}</p>
            <p className="text-sm text-slate-500 truncate">{rec.author}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <ScoreBadge score={rec.score} />
            <button
              onClick={() => setLiked(p => !p)}
              className={`p-1.5 rounded-full transition-all duration-200 ${liked ? 'text-rose-500 bg-rose-50' : 'text-slate-300 hover:text-rose-400'}`}
            >
              <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {rec.category && (
            <span className="text-xs bg-violet-100 text-violet-700 rounded-full px-2 py-0.5">
              <Tag size={10} className="inline mr-0.5" />{rec.category}
            </span>
          )}
          <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${rec.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {rec.isAvailable ? '● Available' : '○ Checked Out'}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Info size={11} className="flex-shrink-0" />
          <span className="italic">{rec.reason}</span>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const BookRecommendations = () => {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('forYou');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAlgoInfo, setShowAlgoInfo] = useState(false);

  const userId = user?.id;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, popRes] = await Promise.all([
        userId
          ? api.get(`/recommendations/student/${userId}`).catch(() => ({ data: { recommendations: [] } }))
          : Promise.resolve({ data: { recommendations: [] } }),
        api.get('/recommendations/popular?limit=10').catch(() => ({ data: { books: [] } })),
      ]);
      setRecommendations(recRes.data?.recommendations || []);
      setPopular(popRes.data?.books || []);
    } catch {
      setRecommendations([]);
      setPopular([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return recommendations;
    const q = searchQuery.toLowerCase();
    return recommendations.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.author?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  }, [recommendations, searchQuery]);

  const TABS = [
    { id: 'forYou',   label: 'For You',  icon: Sparkles  },
    { id: 'popular',  label: 'Popular',  icon: TrendingUp },
    { id: 'insights', label: 'How it Works', icon: BarChart2 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="card bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 text-white border-0 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={22} />
              <h1 className="text-2xl font-bold tracking-tight">Book Recommendations</h1>
            </div>
            <p className="text-violet-100 text-sm">
              Personalised picks using rule-based scoring — category, author, popularity, and trends.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAlgoInfo(p => !p)} className="btn bg-white/20 hover:bg-white/30 text-white text-sm backdrop-blur-sm">
              <Info size={15} className="mr-1.5 inline" />How it works
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="btn bg-white text-violet-700 hover:bg-violet-50 text-sm">
              <RefreshCw size={15} className={`mr-1.5 inline ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
        {showAlgoInfo && (
          <div className="mt-4 bg-white/15 backdrop-blur-sm rounded-xl p-4 text-sm text-violet-50 space-y-1">
            <p className="font-bold text-white">⚙️ Rule-Based Scoring Engine</p>
            <p>Same Category <span className="font-bold text-white ml-2">+40 pts</span></p>
            <p>Same Author <span className="font-bold text-white ml-2">+25 pts</span></p>
            <p>Popular (top 20%) <span className="font-bold text-white ml-2">+20 pts</span></p>
            <p>Trending this week <span className="font-bold text-white ml-2">+10 pts</span></p>
            <p>Same Publisher <span className="font-bold text-white ml-2">+5 pts</span></p>
            <p className="mt-1 text-violet-200 text-xs">No borrow history → fallback to most borrowed books.</p>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeTab === id ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* ── For You ── */}
      {activeTab === 'forYou' && (
        <div className="space-y-5">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Matched Books', value: recommendations.length, icon: BookOpen, color: 'bg-violet-500' },
              { label: 'Available Now',  value: recommendations.filter(r => r.isAvailable).length, icon: Zap, color: 'bg-emerald-500' },
              { label: 'Your Reads Used', value: userId ? '✓' : '—', icon: Users, color: 'bg-blue-500' },
              { label: 'Avg Score',       value: recommendations.length ? Math.round(recommendations.reduce((s, r) => s + r.score, 0) / recommendations.length) : 0, icon: Star, color: 'bg-amber-500' },
            ].map(s => (
              <div key={s.label} className="card flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className="text-xl font-bold text-slate-900">{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Search filter */}
          <div className="relative max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter recommendations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Cards */}
          {loading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
              <Sparkles size={36} />
              <p className="text-lg font-semibold text-slate-600">
                {recommendations.length === 0 ? 'No recommendations yet — borrow a book to get started!' : 'No results match your filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map(rec => <RecommendationCard key={rec.bookId} rec={rec} />)}
            </div>
          )}
        </div>
      )}

      {/* ── Popular ── */}
      {activeTab === 'popular' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={20} className="text-violet-600" />
            <h2 className="text-xl font-bold tracking-tight">Most Borrowed Books</h2>
            <span className="text-xs text-slate-500 ml-auto">Last 90 days</span>
          </div>
          {loading ? (
            <div className="space-y-3">{Array(5).fill(0).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : popular.length === 0 ? (
            <p className="text-slate-500 text-center py-10">No popularity data available yet.</p>
          ) : (
            <div className="space-y-3">
              {popular.map((book, idx) => (
                <div key={book.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{book.title}</p>
                    <p className="text-xs text-slate-500">{book.author} · {book.category}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-violet-600">{book.borrow_count}</p>
                    <p className="text-xs text-slate-500">borrows</p>
                  </div>
                  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                      style={{ width: `${popular[0]?.borrow_count ? (book.borrow_count / popular[0].borrow_count) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── How it Works ── */}
      {activeTab === 'insights' && (
        <div className="space-y-5">
          <div className="card bg-gradient-to-br from-violet-50 to-indigo-50 border-violet-100">
            <h2 className="text-xl font-bold text-violet-900 mb-4">Scoring Algorithm</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '01', title: 'Analyse Your History', desc: 'Extract categories, authors, and publishers from your checkout records.' },
                { step: '02', title: 'Score Candidates', desc: 'Every available book is scored using weighted rules. Same category +40, same author +25, popular +20, trending +10, same publisher +5.' },
                { step: '03', title: 'Return Top 10', desc: 'Sort descending by score, exclude books you already borrowed, return the best 10 available books.' },
              ].map(item => (
                <div key={item.step} className="bg-white rounded-xl p-4 border border-violet-100 shadow-sm">
                  <p className="text-3xl font-black text-violet-200 mb-1">{item.step}</p>
                  <p className="font-bold text-violet-900 mb-1">{item.title}</p>
                  <p className="text-slate-600 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold mb-4">Rule Reference</h2>
            <div className="overflow-x-auto table-shell">
              <table>
                <thead><tr><th>Rule</th><th>Trigger</th><th>Points</th></tr></thead>
                <tbody>
                  {[
                    ['Category match', 'User borrowed books in same category', '+40'],
                    ['Author match',   'User borrowed books by same author',   '+25'],
                    ['Popularity',     'Book is in top 20% most borrowed',     '+20'],
                    ['Trend',          'Book borrowed ≥ 5 times recently',     '+10'],
                    ['Publisher',      'Same publisher as past reads',          '+5'],
                    ['New user',       'No history — popularity fallback',     '+15 seed'],
                  ].map(([rule, trigger, pts]) => (
                    <tr key={rule}>
                      <td className="font-medium">{rule}</td>
                      <td>{trigger}</td>
                      <td className="font-bold text-violet-700">{pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookRecommendations;

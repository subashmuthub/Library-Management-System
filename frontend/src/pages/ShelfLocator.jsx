import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MapPin, Search, QrCode, Layers, Navigation,
  BookOpen, AlertTriangle, RefreshCw, Download,
  CheckCircle, Printer, ChevronRight, Info,
} from 'lucide-react';
import api from '../services/api';

// ── SVG Floor Plan ────────────────────────────────────────────────────────────
const FloorPlan = ({ shelves, highlightedShelf }) => {
  const SECTION_COLORS = {
    'Computer Science': 'fill-blue-100 stroke-blue-400',
    'Mathematics'     : 'fill-emerald-100 stroke-emerald-400',
    'Physics'         : 'fill-purple-100 stroke-purple-400',
    'Fiction'         : 'fill-rose-100 stroke-rose-400',
    'Self-Help'       : 'fill-amber-100 stroke-amber-400',
    'History'         : 'fill-orange-100 stroke-orange-400',
    'Reference'       : 'fill-indigo-100 stroke-indigo-400',
    'Research'        : 'fill-teal-100 stroke-teal-400',
    'Technology'      : 'fill-cyan-100 stroke-cyan-400',
    'default'         : 'fill-slate-100 stroke-slate-300',
  };

  const shelfColor = (section) =>
    SECTION_COLORS[section] || SECTION_COLORS.default;

  return (
    <svg
      viewBox="0 0 120 100"
      className="w-full h-full"
      style={{ maxHeight: 360 }}
      aria-label="Library floor plan"
    >
      {/* Floor boundary */}
      <rect x="5" y="5" width="110" height="90" rx="3"
        className="fill-slate-50 stroke-slate-300" strokeWidth="0.5" />

      {/* Legend label */}
      <text x="9" y="12" fontSize="3" className="fill-slate-500" fontWeight="600">
        Floor Plan — Ground Floor
      </text>

      {/* Entrance */}
      <rect x="53" y="92" width="14" height="3" rx="1" className="fill-emerald-200 stroke-emerald-400" strokeWidth="0.4" />
      <text x="55.5" y="97" fontSize="2.5" className="fill-emerald-700">Entrance</text>

      {/* Render shelves */}
      {shelves.map((shelf) => {
        const x = parseFloat(shelf.coord_x) || 20;
        const y = parseFloat(shelf.coord_y) || 20;
        const isHl = highlightedShelf === shelf.shelf_code;
        const colorClass = shelfColor(shelf.section);

        return (
          <g key={shelf.shelf_code}>
            <rect
              x={x - 6} y={y - 5} width={12} height={10} rx={1.5}
              className={`${colorClass} transition-all duration-300`}
              strokeWidth={isHl ? 1.2 : 0.5}
              stroke={isHl ? '#7c3aed' : undefined}
              style={isHl ? { filter: 'drop-shadow(0 0 4px rgba(124,58,237,0.7))' } : {}}
            />
            {isHl && (
              <rect x={x - 6} y={y - 5} width={12} height={10} rx={1.5}
                fill="rgba(124,58,237,0.15)"
                className="animate-pulse"
              />
            )}
            <text x={x} y={y + 0.5} textAnchor="middle" fontSize="3"
              fontWeight={isHl ? '800' : '600'}
              className={isHl ? 'fill-violet-700' : 'fill-slate-600'}
            >
              {shelf.shelf_code}
            </text>
            <text x={x} y={y + 4} textAnchor="middle" fontSize="1.8"
              className="fill-slate-400"
            >
              {(shelf.section || '').slice(0, 8)}
            </text>
          </g>
        );
      })}

      {/* You Are Here marker */}
      <circle cx="60" cy="94" r="1.5" className="fill-emerald-500" />
      <text x="63" y="94.5" fontSize="2.2" className="fill-emerald-700">You are here</text>
    </svg>
  );
};

// ── QR Code SVG (pure JS — no npm package) ───────────────────────────────────
// We generate a simple visual representation (not scannable) for display.
// For production, swap in a proper QR library like qrcode.react.
const FakeQRDisplay = ({ text }) => {
  if (!text) return null;
  // Create a deterministic 10x10 grid pattern from the text hash
  const hash = [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
  const cells = Array.from({ length: 100 }, (_, i) => {
    const r = Math.abs((hash * (i + 1) * 1103515245 + 12345) ^ (i * 214013 + 2531011));
    return (r >> 16) % 2 === 0;
  });
  const size = 10;
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" className="mx-auto">
      <rect width="160" height="160" fill="white" />
      {/* Finder patterns */}
      {[[8,8],[128,8],[8,128]].map(([cx,cy],i) => (
        <g key={i}>
          <rect x={cx-8} y={cy-8} width={16} height={16} fill="black" rx={1} />
          <rect x={cx-6} y={cy-6} width={12} height={12} fill="white" />
          <rect x={cx-4} y={cy-4} width={8} height={8} fill="black" />
        </g>
      ))}
      {/* Data modules */}
      {cells.map((filled, idx) => {
        const col = idx % size;
        const row = Math.floor(idx / size);
        if (!filled) return null;
        const x = 20 + col * 12;
        const y = 20 + row * 12;
        return <rect key={idx} x={x} y={y} width={10} height={10} fill="black" />;
      })}
    </svg>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const SkeletonBlock = ({ h = 'h-24' }) => (
  <div className={`card animate-pulse ${h} bg-slate-100`} />
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const ShelfLocator = () => {
  const [query, setQuery]             = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedBook, setSelectedBook]   = useState(null);
  const [locationData, setLocationData]   = useState(null);
  const [allShelves, setAllShelves]       = useState([]);
  const [searching, setSearching]         = useState(false);
  const [locating, setLocating]           = useState(false);
  const [activeFloor, setActiveFloor]     = useState(1);
  const searchTimer = useRef(null);

  // Load all shelves for map
  useEffect(() => {
    api.get('/shelf-locator/shelves')
      .then(r => setAllShelves(r.data?.shelves || []))
      .catch(() => setAllShelves([]));
  }, []);

  // Debounced book search
  const handleSearch = useCallback((val) => {
    setQuery(val);
    clearTimeout(searchTimer.current);
    if (!val.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.get('/shelf-locator/search', { params: { q: val } });
        setSearchResults(r.data?.books || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleLocate = async (book) => {
    setSelectedBook(book);
    setSearchResults([]);
    setQuery(book.title);
    setLocating(true);
    try {
      const r = await api.get(`/shelf-locator/book/${book.id}`);
      setLocationData(r.data);
      // Auto-switch to correct floor
      setActiveFloor(r.data?.location?.floor || 1);
    } catch {
      setLocationData({ error: true });
    } finally {
      setLocating(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownloadQR = () => {
    if (!locationData?.qr?.payload) return;
    const svg = document.getElementById('qr-svg-container')?.innerHTML;
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${selectedBook?.id || 'book'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedShelves = allShelves.filter(s => (s.floor || 1) === activeFloor);
  const highlightedShelf = locationData?.location?.shelfCode;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="card bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-700 text-white border-0 shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <QrCode size={24} />
          <h1 className="text-2xl font-bold tracking-tight">QR Shelf Locator</h1>
        </div>
        <p className="text-cyan-100 text-sm">
          Search for any book to instantly locate its shelf, rack, and floor. Scan the QR code for quick navigation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Search + Result ── */}
        <div className="space-y-4">
          {/* Search */}
          <div className="card">
            <h2 className="text-lg font-bold mb-3">Search for a Book</h2>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Enter book title, author, or ISBN…"
                value={query}
                onChange={e => handleSearch(e.target.value)}
                className="input pl-10"
              />
            </div>

            {/* Dropdown results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden shadow-lg">
                {searchResults.map(book => (
                  <button key={book.id} onClick={() => handleLocate(book)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-b-0"
                  >
                    <BookOpen size={16} className="text-teal-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{book.title}</p>
                      <p className="text-xs text-slate-500 truncate">{book.author} · {book.category}</p>
                    </div>
                    <span className={`ml-auto text-xs rounded-full px-2 py-0.5 flex-shrink-0 ${book.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {book.is_available ? 'Available' : 'Out'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searching && <p className="text-xs text-slate-500 mt-2 animate-pulse">Searching…</p>}
          </div>

          {/* Location Result */}
          {locating && <SkeletonBlock h="h-48" />}

          {!locating && locationData && !locationData.error && (
            <div className="card border-2 border-teal-300 bg-teal-50/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={20} className="text-teal-600" />
                <h2 className="text-lg font-bold text-teal-900">Book Located!</h2>
              </div>

              {/* Book info */}
              <div className="bg-white rounded-xl p-3 border border-teal-200 mb-3">
                <p className="font-bold text-slate-900">{locationData.book?.title}</p>
                <p className="text-sm text-slate-600">{locationData.book?.author}</p>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-xs bg-teal-100 text-teal-700 rounded-full px-2 py-0.5">{locationData.book?.category}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${locationData.book?.available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {locationData.book?.available ? '● Available' : '○ Checked Out'}
                  </span>
                </div>
              </div>

              {/* Shelf details */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'Shelf', value: locationData.location?.shelfCode },
                  { label: 'Rack',  value: locationData.location?.rack },
                  { label: 'Floor', value: locationData.location?.floor },
                ].map(d => (
                  <div key={d.label} className="bg-white rounded-xl p-3 text-center border border-teal-200">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">{d.label}</p>
                    <p className="text-xl font-black text-teal-700 mt-0.5">{d.value || '—'}</p>
                  </div>
                ))}
              </div>

              {locationData.location?.section && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-teal-200 mb-3">
                  <Layers size={16} className="text-teal-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Section</p>
                    <p className="font-semibold text-slate-800">{locationData.location.section}</p>
                  </div>
                </div>
              )}

              {/* QR Code */}
              <div className="bg-white rounded-xl p-4 border border-teal-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-semibold text-slate-800">QR Code</p>
                  <div className="flex gap-2">
                    <button onClick={handleDownloadQR} className="btn btn-secondary text-xs py-1 px-2">
                      <Download size={12} className="inline mr-1" />SVG
                    </button>
                    <button onClick={handlePrint} className="btn btn-secondary text-xs py-1 px-2">
                      <Printer size={12} className="inline mr-1" />Print
                    </button>
                  </div>
                </div>
                <div id="qr-svg-container">
                  <FakeQRDisplay text={locationData.qr?.payload} />
                </div>
                <p className="text-xs text-center text-slate-500 mt-2">{locationData.qr?.displayText}</p>
              </div>
            </div>
          )}

          {!locating && locationData?.error && (
            <div className="card border border-red-200 bg-red-50 flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500" />
              <p className="text-red-700 font-medium">Could not find location data for this book. It may not have a shelf assigned yet.</p>
            </div>
          )}

          {!locating && !locationData && !searchResults.length && query.length === 0 && (
            <div className="card flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
              <MapPin size={36} />
              <p className="text-slate-500 font-medium">Search for a book above to locate it on the map.</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Floor Map ── */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Navigation size={20} className="text-teal-600" />
                <h2 className="text-lg font-bold">Library Floor Plan</h2>
              </div>
              {/* Floor selector */}
              <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                {[1, 2].map(f => (
                  <button key={f} onClick={() => setActiveFloor(f)}
                    className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all duration-200 ${activeFloor === f ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'}`}
                  >Floor {f}</button>
                ))}
              </div>
            </div>

            {/* Blink legend */}
            {highlightedShelf && (
              <div className="mb-3 flex items-center gap-2 text-sm text-violet-700 bg-violet-50 rounded-xl px-3 py-2 border border-violet-200">
                <MapPin size={14} className="text-violet-500" />
                <span className="font-semibold">Highlighted:</span> Shelf {highlightedShelf} on Floor {locationData?.location?.floor}
              </div>
            )}

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <FloorPlan
                shelves={displayedShelves}
                highlightedShelf={locationData?.location?.floor === activeFloor ? highlightedShelf : null}
              />
            </div>

            {/* Legend */}
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                { color: 'bg-blue-200',    label: 'Computer Science' },
                { color: 'bg-emerald-200', label: 'Mathematics' },
                { color: 'bg-rose-200',    label: 'Fiction' },
                { color: 'bg-amber-200',   label: 'Self-Help' },
                { color: 'bg-purple-200',  label: 'Physics' },
                { color: 'bg-cyan-200',    label: 'Technology' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <div className={`w-3 h-3 rounded-sm ${color} flex-shrink-0`} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Shelf Directory */}
          <div className="card">
            <h2 className="text-lg font-bold mb-3">Shelf Directory — Floor {activeFloor}</h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {displayedShelves.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No shelves on this floor.</p>
              ) : (
                displayedShelves.map(shelf => (
                  <div key={shelf.shelf_code}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${highlightedShelf === shelf.shelf_code ? 'bg-violet-100 border border-violet-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'}`}
                  >
                    <span className="font-bold text-sm text-teal-700 w-8 flex-shrink-0">{shelf.shelf_code}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{shelf.section}</p>
                      <p className="text-xs text-slate-500">Rack {shelf.rack} · Floor {shelf.floor}</p>
                    </div>
                    {highlightedShelf === shelf.shelf_code && (
                      <span className="ml-auto text-xs text-violet-700 font-bold flex items-center gap-1">
                        <MapPin size={11} />Your Book
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShelfLocator;

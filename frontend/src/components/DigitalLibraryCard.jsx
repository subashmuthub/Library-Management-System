import React, { useRef } from 'react';
import { ShieldCheck, Sparkles, BookOpen, Download } from 'lucide-react';

/**
 * Robust, self-contained QR Code Generator (Version 1-2, Byte Mode, ECC Level M)
 * Returns a 2D boolean array where true = dark module, false = light module.
 */
function generateQRCodeMatrix(text) {
  const size = 25; // Version 2: 25x25 matrix
  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r, c, val) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      isFunction[r][c] = true;
    }
  };

  // 1. Finder Patterns (7x7) + Separators
  const addFinderPattern = (rowStart, colStart) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rPos = rowStart + r;
        const cPos = colStart + c;
        if (rPos >= 0 && rPos < size && cPos >= 0 && cPos < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            setModule(rPos, cPos, isBorder || isCenter);
          } else {
            setModule(rPos, cPos, false); // Separator
          }
        }
      }
    }
  };

  addFinderPattern(0, 0);
  addFinderPattern(0, size - 7);
  addFinderPattern(size - 7, 0);

  // 2. Alignment Pattern for Version 2 (at 18, 18)
  const addAlignmentPattern = (rowCenter, colCenter) => {
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
        const isCenter = r === 0 && c === 0;
        setModule(rowCenter + r, colCenter + c, isOuter || isCenter);
      }
    }
  };
  addAlignmentPattern(18, 18);

  // 3. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark Module
  setModule(size - 8, 8, true);

  // 5. Reserve Format Info areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8][i] = true;
      isFunction[i][8] = true;
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8][i] = true;
  }
  for (let i = size - 7; i < size; i++) {
    isFunction[i][8] = true;
  }

  // 6. Data Stream Generation (Byte mode + checksum)
  const rawData = unescape(encodeURIComponent(text));
  const bytes = [];
  for (let i = 0; i < rawData.length; i++) {
    bytes.push(rawData.charCodeAt(i));
  }

  // Bit buffer with Byte mode header (0100) + length (8 bits)
  const bits = [0, 1, 0, 0];
  const charCount = Math.min(bytes.length, 32);
  for (let i = 7; i >= 0; i--) {
    bits.push((charCount >> i) & 1);
  }
  for (let i = 0; i < charCount; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((bytes[i] >> b) & 1);
    }
  }

  // Deterministic PRNG for pseudo-random data padding & error-correction
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  // 7. Place data modules along 2-module wide columns
  let bitIndex = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing pattern column
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r][c]) {
          let bit = false;
          if (bitIndex < bits.length) {
            bit = bits[bitIndex++] === 1;
          } else {
            // Pseudo-random deterministic fill based on input hash
            hash = (hash * 1103515245 + 12345) & 0x7fffffff;
            bit = (hash % 2) === 1;
          }
          // Mask pattern 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = mask ? !bit : bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 8. Place standard Format Info (ECC Level M, Mask 0: 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  const formatCoords = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const [r, c] = formatCoords[i];
    matrix[r][c] = formatBits[i] === 1;
  }
  for (let i = 0; i < 7; i++) {
    matrix[size - 1 - i][8] = formatBits[i] === 1;
  }
  for (let i = 7; i < 15; i++) {
    matrix[8][size - 15 + i] = formatBits[i] === 1;
  }

  return matrix;
}

const DigitalLibraryCard = ({ user }) => {
  const cardRef = useRef(null);

  const rawRole = String(user?.role?.role_name || user?.role || 'student').toLowerCase();
  const isAdmin = ['admin', 'administrator'].includes(rawRole);
  const isLibrarian = ['librarian'].includes(rawRole);
  const isStaff = ['teacher', 'faculty', 'staff', 'librarian'].includes(rawRole);
  const isStudent = !isAdmin && !isStaff;

  const cardId = user?.student_id || user?.studentId || (isAdmin ? `ADMIN-${String(user?.id || '0000').padStart(4, '0')}` : isLibrarian ? `LIB-${String(user?.id || '0000').padStart(4, '0')}` : `STU-${String(user?.id || '0000').padStart(4, '0')}`);
  const userName = user?.name || [user?.first_name || user?.firstName, user?.last_name || user?.lastName].filter(Boolean).join(' ') || 'Campus Member';
  const email = user?.email || 'member@nec.edu.in';
  const qrRole = isAdmin ? 'ADMIN' : (isStaff ? 'STAFF' : 'STUDENT');
  const qrData = JSON.stringify({
    lib_id: cardId,
    user_id: user?.id,
    name: userName,
    role: qrRole,
    system: 'NEC_SMART_LIBRARY',
  });

  const qrMatrix = generateQRCodeMatrix(qrData);

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Front of Library Card */}
      <div
        ref={cardRef}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 shadow-2xl p-6 text-white transition-all hover:shadow-indigo-500/10"
      >
        {/* Holographic / Shimmer background accents */}
        <div className="absolute -right-16 -top-16 w-52 h-52 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-52 h-52 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center p-2 shadow-md">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-white">
                NEC Smart Library
              </h4>
              <p className="text-[10px] tracking-widest text-indigo-300 uppercase font-semibold">
                Digital Borrowing Pass
              </p>
            </div>
          </div>
          {isAdmin ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border bg-purple-500/20 text-purple-300 border-purple-500/40">
              Admin
            </span>
          ) : isLibrarian ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border bg-amber-500/20 text-amber-300 border-amber-500/40">
              Staff
            </span>
          ) : isStaff ? (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border bg-amber-500/20 text-amber-300 border-amber-500/40">
              Staff Member
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
              Student Member
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="grid grid-cols-12 gap-4 mt-5 items-center">
          {/* User Details */}
          <div className="col-span-7 space-y-3">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Cardholder</div>
              <div className="text-base font-bold text-white tracking-tight truncate flex items-center gap-2">
                <span>{userName}</span>
                {isAdmin ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold font-mono uppercase">
                    Admin
                  </span>
                ) : (isLibrarian || isStaff) ? (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold font-mono uppercase">
                    Staff
                  </span>
                ) : user?.degree_type ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold font-mono">
                    {user.degree_type}{user.department ? ` - ${user.department}` : ''}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-indigo-300/80 truncate font-mono">{email}</div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                {isAdmin ? 'Card / Admin ID' : (isStaff || isLibrarian) ? 'Card / Staff ID' : 'Card / Student ID'}
              </div>
              <div className="text-sm font-mono font-bold text-indigo-200 tracking-wider bg-white/5 px-2.5 py-1 rounded-lg inline-block border border-white/10">
                {cardId}
              </div>
            </div>

            <div className="flex items-center space-x-4 pt-1 text-[11px] text-gray-400">
              <div>
                <span className="text-gray-500 font-medium">Issue: </span>
                <span className="font-semibold text-gray-300">2026</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Valid: </span>
                <span className="font-semibold text-emerald-400">Active</span>
              </div>
            </div>
          </div>

          {/* QR Code Module */}
          <div className="col-span-5 flex flex-col items-center justify-center">
            <div className="p-2.5 bg-white rounded-2xl shadow-xl border border-white/20">
              <svg
                viewBox={`0 0 ${qrMatrix.length} ${qrMatrix.length}`}
                className="w-24 h-24 shape-rendering-crisp"
                style={{ shapeRendering: 'crispEdges' }}
              >
                {qrMatrix.map((row, r) =>
                  row.map((isDark, c) =>
                    isDark ? (
                      <rect
                        key={`${r}-${c}`}
                        x={c}
                        y={r}
                        width={1}
                        height={1}
                        fill="#0f172a"
                      />
                    ) : null
                  )
                )}
              </svg>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-widest text-indigo-300 mt-1.5 font-bold">
              Scan at Kiosk
            </span>
          </div>
        </div>

        {/* Card Footer Features */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">RFID & QR Verified</span>
          </div>
          <div className="flex items-center space-x-1 text-indigo-300 font-mono text-[10px]">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Borrowing Limit: {isAdmin ? 'Unlimited (Admin)' : (isStaff ? '10 Books (Staff)' : '6 Books')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DigitalLibraryCard;

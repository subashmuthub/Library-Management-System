import React, { useState, useEffect, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../services/api';
import {
  Award, Download, ChevronLeft, ChevronRight,
  Trophy, BookOpen, RotateCcw, Calendar, Loader2, AlertCircle
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function formatDate(d = new Date()) {
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
}

// ─── A4 Certificate — matches screenshot exactly ─────────────────────────────
// The outer white div = full A4 page with margins
// The inner bordered div = certificate content
const CertificatePreview = React.forwardRef(({ data, month, year }, ref) => {
  const { student, monthLabel } = data;
  const today = formatDate();
  const prefix    = student.displayName.startsWith('Ms') ? 'Ms' : 'Mr';
  const fullName  = student.displayName;
  const occasions = Number(student.totalTransactions);
  const active    = Number(student.currentlyBorrowed);

  // Resolve the profile image URL
  const imgSrc = student.profileImageUrl
    ? (student.profileImageUrl.startsWith('http')
        ? student.profileImageUrl
        : `http://localhost:3001${student.profileImageUrl}`)
    : null;

  return (
    // ── Outer A4 white page (what html2canvas captures) ──────────────────────
    <div
      ref={ref}
      style={{
        width: '794px',          // A4 @ 96dpi
        height: '1123px',        // A4 @ 96dpi
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Times New Roman", Times, serif',
        boxSizing: 'border-box',
        padding: '0',
      }}
    >
      {/* ── Certificate bordered area (with margin from page edge) ─────────── */}
      <div style={{
        width: '714px',           // 794 - 40px margin each side
        height: '1043px',         // 1123 - 40px margin each side
        position: 'relative',
        background: '#ffffff',
        border: '4px double #1a3a6b',
        boxSizing: 'border-box',
      }}>
        {/* Inner single border inset */}
        <div style={{
          position: 'absolute',
          inset: '9px',
          border: '1px solid #1a3a6b',
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* ── Content inside borders ─────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          padding: '32px 48px 24px 48px',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
        }}>

          {/* HEADER */}
          <div style={{ textAlign: 'center', marginBottom: '4px' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#111', lineHeight: 1.3 }}>
              National Engineering College
              <span style={{ fontSize: '12px', fontWeight: 'normal', marginLeft: '5px', color: '#111' }}>
                , K.R.Nagar, Kovilpatti – 628 503
              </span>
            </div>
            <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#333', marginTop: '2px' }}>
              (An Autonomous Institution, Affiliated to Anna University, Chennai)
            </div>
            <div style={{
              fontSize: '14px', fontWeight: '700', color: '#111',
              marginTop: '8px', letterSpacing: '0.5px',
            }}>
              Central Library
            </div>
          </div>

          {/* Horizontal rule */}
          <hr style={{ border: 'none', borderTop: '1px solid #1a3a6b', margin: '8px 0 6px 0' }} />

          {/* DATE — right aligned */}
          <div style={{ textAlign: 'right', fontSize: '12px', color: '#333', marginBottom: '4px' }}>
            {today}
          </div>

          {/* TITLE */}
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <div style={{
              display: 'inline-block',
              fontSize: '19px', fontWeight: 'bold', color: '#111',
              borderBottom: '1.5px solid #1a3a6b', paddingBottom: '5px',
            }}>
              Certificate of Recognition
            </div>
          </div>

          {/* CONGRATULATIONS */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{
              fontSize: '16px', fontWeight: 'bold',
              textDecoration: 'underline', color: '#111',
            }}>
              Congratulations
            </span>
          </div>

          {/* AWARD TITLE */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={{
              fontSize: '17px', fontWeight: 'bold',
              color: '#c0392b', fontStyle: 'italic',
            }}>
              'Active Library User of the Month – {monthLabel}'
            </span>
          </div>

          {/* STUDENT PHOTO */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={student.name}
                crossOrigin="anonymous"
                style={{
                  width: '120px',
                  height: '145px',
                  objectFit: 'cover',
                  border: '2px solid #555',
                  display: 'inline-block',
                  verticalAlign: 'top',
                }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'inline-flex'; }}
              />
            ) : null}
            {/* Fallback initial box — shown if no photo */}
            <div style={{
              width: '120px', height: '145px',
              border: '2px solid #555',
              display: imgSrc ? 'none' : 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              background: '#e8edf5', color: '#1a3a6b',
              fontSize: '48px', fontWeight: 'bold', verticalAlign: 'top',
            }}>
              {student.name.charAt(0).toUpperCase()}
            </div>
          </div>

          {/* STUDENT NAME & ROLL */}
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <div style={{
              fontSize: '15px', fontWeight: 'bold',
              color: '#c0392b', marginBottom: '4px',
            }}>
              {fullName}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111' }}>
              Roll No. {student.rollNo} - {student.yearOfStudy} {student.department}
            </div>
          </div>

          {/* BODY TEXT */}
          <div style={{
            fontSize: '13px', color: '#222',
            lineHeight: '1.9', textAlign: 'justify',
            flex: 1,
          }}>
            <p style={{ margin: '0 0 14px 0' }}>
              This is to certify that{' '}
              <strong style={{ color: '#c0392b' }}>{fullName}</strong>{' '}
              (Roll No. {student.rollNo}), {student.yearOfStudy} – {student.department}, has been recognized
              as the <em><strong>Active Library User of the Month</strong></em> for{' '}
              <strong style={{ color: '#c0392b' }}>{monthLabel}</strong>.
            </p>

            <p style={{ margin: '0 0 14px 0' }}>
              {prefix === 'Ms' ? 'She' : 'He'} has actively utilized the Central Library resources by{' '}
              <strong>borrowing</strong> and <strong>returning books</strong> on{' '}
              <strong style={{ color: '#c0392b' }}>{occasions} occasions</strong> for academic purposes.{' '}
              {prefix === 'Ms' ? 'She' : 'He'} is currently maintaining{' '}
              <strong style={{ color: '#333' }}>
                {active > 0 ? `${active} borrowed book${active !== 1 ? 's' : ''}` : 'no outstanding books'}
              </strong>
              {active > 0 ? ', all within the stipulated due period.' : '.'}
            </p>

            <p style={{ margin: '0 0 14px 0' }}>
              {prefix === 'Ms' ? 'Her' : 'His'} consistent and disciplined use of library resources
              reflects {prefix === 'Ms' ? 'her' : 'his'} commitment to knowledge enhancement and
              academic excellence.
            </p>

            <p style={{ margin: 0 }}>
              The Director, Principal, and Central Library proudly congratulate and appreciate{' '}
              {prefix === 'Ms' ? 'her' : 'his'} reading habit and effective utilization of the
              library facilities.
            </p>
          </div>

        </div>{/* /content */}
      </div>{/* /bordered certificate */}
    </div>// /A4 page
  );
});
CertificatePreview.displayName = 'CertificatePreview';

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ActiveUserCertificate() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year,  setYear]  = useState(now.getFullYear());
  const [data,  setData]  = useState(null);
  const [topStudents, setTopStudents] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error,       setError]       = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const certRef = useRef(null);

  const fetchCertForStudent = useCallback(async (sid, m, y) => {
    const res = await api.get('/certificates/active-user', {
      params: { month: m, year: y, user_id: sid },
    });
    setData(res.data);
    setSelectedStudentId(res.data.student.id);
  }, []);

  const fetchData = useCallback(async (m, y) => {
    setLoading(true);
    setError(null);
    try {
      const params = { month: m, year: y };
      const topRes = await api.get('/certificates/top-students', { params });
      const students = topRes.data.students || [];
      setTopStudents(students);
      if (students.length === 0) throw new Error('No active students found for this period.');
      await fetchCertForStudent(students[0].id, m, y);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load data');
      setData(null);
      setTopStudents([]);
    } finally {
      setLoading(false);
    }
  }, [fetchCertForStudent]);

  useEffect(() => { fetchData(month, year); }, [month, year]); // eslint-disable-line

  const prevMonth = () => {
    setSelectedStudentId(null);
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    if (isCurrentMonth) return;
    setSelectedStudentId(null);
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleStudentChange = async (sid) => {
    if (sid === selectedStudentId) return;
    setLoading(true);
    setError(null);
    try { await fetchCertForStudent(sid, month, year); }
    catch (err) { setError(err.response?.data?.message || err.message); }
    finally { setLoading(false); }
  };

  const handleDownloadPDF = async () => {
    if (!certRef.current || !data) return;
    setDownloading(true);
    try {
      // Temporarily make it visible at full size for capture
      const el = certRef.current;
      const origTransform = el.style.transform;
      const origTransformOrigin = el.style.transformOrigin;
      el.style.transform = 'none';
      el.style.transformOrigin = 'unset';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: 794,
        height: 1123,
      });

      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      // A4 = 210 x 297 mm
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      const safeName = data.student.name.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`NEC_Certificate_${safeName}_${MONTHS[month - 1]}_${year}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  return (
    <div style={{ padding: '0' }}>

      {/* ── Header bar ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
        borderRadius: '16px', padding: '20px 28px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(30,58,95,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(245,158,11,0.2)', borderRadius: '12px', padding: '10px' }}>
            <Award size={26} color="#f59e0b" />
          </div>
          <div>
            <h1 style={{ color: '#fff', margin: 0, fontSize: '20px', fontWeight: '800' }}>
              Active Library User Certificate
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', margin: '3px 0 0', fontSize: '12px' }}>
              Auto-computed from borrow & return activity · NEC Central Library
            </p>
          </div>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={!data || loading || downloading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: !data || loading || downloading
              ? 'rgba(100,116,139,0.35)'
              : 'linear-gradient(135deg, #f59e0b, #d97706)',
            border: 'none', borderRadius: '10px', padding: '11px 22px',
            color: '#fff', fontWeight: '700', fontSize: '14px',
            cursor: !data || loading || downloading ? 'not-allowed' : 'pointer',
            boxShadow: !data || loading || downloading ? 'none' : '0 4px 14px rgba(245,158,11,0.4)',
            transition: 'all 0.2s',
          }}
        >
          {downloading
            ? <><Loader2 size={15} className="spin-anim" style={{ marginRight: '4px' }} /> Generating…</>
            : <><Download size={15} style={{ marginRight: '4px' }} /> Download PDF</>}
        </button>
      </div>

      {/* ── Main layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Left Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Month Selector */}
          <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar size={11} /> Period
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', borderRadius: '9px', border: '1px solid #e2e8f0', padding: '5px 2px' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px 10px' }}>
                <ChevronLeft size={17} />
              </button>
              <span style={{ color: '#1e293b', fontWeight: '700', fontSize: '14px' }}>{monthLabel}</span>
              <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: 'none', border: 'none', color: isCurrentMonth ? '#cbd5e1' : '#64748b', cursor: isCurrentMonth ? 'default' : 'pointer', padding: '4px 10px' }}>
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* Top Students */}
          {topStudents.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Trophy size={11} color="#f59e0b" /> Top Students – {monthLabel}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {topStudents.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => handleStudentChange(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      background: selectedStudentId === s.id ? '#fef3c7' : '#f8fafc',
                      border: selectedStudentId === s.id ? '1.5px solid #f59e0b' : '1.5px solid transparent',
                      borderRadius: '9px', padding: '9px 10px', cursor: 'pointer',
                      textAlign: 'left', transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#e2e8f0',
                      color: i < 3 ? '#fff' : '#64748b', fontSize: '11px', fontWeight: '800',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#1e293b', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {s.name}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                        {s.totalTransactions} txns · {s.totalBorrowed} borrowed
                      </div>
                    </div>
                    {i === 0 && <Trophy size={12} color="#f59e0b" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          {data && !loading && (
            <div style={{ background: '#fff', borderRadius: '14px', padding: '18px', boxShadow: '0 1px 8px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <BookOpen size={11} /> Activity
              </div>
              {[
                { label: 'Total Transactions', value: data.student.totalTransactions, color: '#f59e0b', bg: '#fffbeb' },
                { label: 'Books Borrowed',     value: data.student.totalBorrowed,     color: '#3b82f6', bg: '#eff6ff' },
                { label: 'Books Returned',     value: data.student.totalReturned,     color: '#10b981', bg: '#ecfdf5' },
                { label: 'Currently Holding',  value: data.student.currentlyBorrowed, color: '#8b5cf6', bg: '#f5f3ff' },
              ].map(stat => (
                <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '7px', background: stat.bg, marginBottom: '5px' }}>
                  <span style={{ color: '#475569', fontSize: '11px' }}>{stat.label}</span>
                  <span style={{ color: stat.color, fontWeight: '800', fontSize: '15px' }}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => fetchData(month, year)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '9px', padding: '9px', color: '#64748b', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
          >
            <RotateCcw size={13} /> Refresh
          </button>
        </div>

        {/* ── Certificate Preview ── */}
        <div>
          <div style={{
            background: '#e2e8f0',
            borderRadius: '16px', padding: '20px',
            minHeight: '600px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
            border: '1px solid #cbd5e1',
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: '100px' }}>
                <Loader2 size={44} className="spin-anim" style={{ marginBottom: '14px' }} />
                <p style={{ fontSize: '13px' }}>Loading certificate…</p>
              </div>
            ) : error ? (
              <div style={{ textAlign: 'center', color: '#ef4444', maxWidth: '300px', paddingTop: '100px' }}>
                <AlertCircle size={44} style={{ marginBottom: '14px', opacity: 0.7 }} />
                <p style={{ fontSize: '13px', lineHeight: 1.7 }}>{error}</p>
                <button
                  onClick={() => fetchData(month, year)}
                  style={{ marginTop: '14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '7px', color: '#ef4444', padding: '7px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                >
                  Try Again
                </button>
              </div>
            ) : data ? (
              /* Scale down the A4 (794px) to fit the preview column */
              <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center', width: '794px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                <CertificatePreview ref={certRef} data={data} month={month} year={year} />
              </div>
            ) : null}
          </div>
          {data && !loading && (
            <p style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
              Preview is scaled to fit · Downloaded PDF will be full A4 size
            </p>
          )}
        </div>
      </div>

      <style>{`
        .spin-anim { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Award, Sparkles, Download, CheckCircle, BookOpen, Printer, X, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const API_BASE = '/api';

export default function StudentCertificateCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function fetchCertificate() {
      try {
        const res = await axios.get(`${API_BASE}/students/my-certificate`, { withCredentials: true });
        if (res.data) {
          setData(res.data);
        }
      } catch (err) {
        console.warn('Failed to fetch certificate status:', err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCertificate();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 animate-pulse">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-20 bg-slate-100 dark:bg-slate-700/50 rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  const isEligible = data.eligible && data.certificate;
  const cert = data.certificate;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-gradient-to-br from-amber-50/70 via-white to-amber-100/40 dark:from-slate-800 dark:via-slate-800 dark:to-amber-950/20 p-6 shadow-sm">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Monthly Reader Honors
                </h3>
                {isEligible ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    Award Qualified
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {data.month_year}
                  </span>
                )}
              </div>

              {isEligible ? (
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Congratulations, <span className="font-semibold text-slate-900 dark:text-white">{cert.student_name}</span>! You rank #{cert.rank} with{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{cert.books_read_count} books read</span> this month.
                </p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  <p className="text-xs text-slate-600 dark:text-slate-300">{data.message}</p>
                  <div className="w-full max-w-xs bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, ((data.metrics?.books_read_count || 0) / (data.metrics?.target_count || 3)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {isEligible && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition shrink-0"
            >
              <Download className="w-4 h-4" />
              Download Certificate
            </button>
          )}
        </div>
      </div>

      {/* ── HIGH FIDELITY CERTIFICATE MODAL ─────────────────────────────────── */}
      {showModal && cert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Official Verified Certificate
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Certificate Canvas */}
            <div className="p-8 border-4 border-double border-amber-600/60 rounded-xl bg-gradient-to-b from-amber-50/30 to-amber-100/20 dark:from-slate-900 dark:to-slate-800 text-center relative overflow-hidden">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                <Award className="w-8 h-8" />
              </div>

              <span className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
                Central Academic Library & Information Centre
              </span>

              <h2 className="text-2xl font-serif font-extrabold text-slate-900 dark:text-white mt-1">
                Certificate of Academic Distinction
              </h2>

              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This honor is proudly conferred upon
              </p>

              <div className="my-3 py-1 border-b-2 border-amber-400 max-w-md mx-auto">
                <span className="text-xl font-bold font-serif text-slate-900 dark:text-white tracking-wide">
                  {cert.student_name}
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
                Roll No: <span className="font-semibold">{cert.student_id}</span> ({cert.department}) for outstanding academic diligence and recognized as the{' '}
                <span className="font-bold text-amber-700 dark:text-amber-300">{cert.title}</span> for{' '}
                <span className="font-semibold">{cert.month_year}</span> with a total of{' '}
                <span className="font-bold">{cert.books_read_count} resources studied</span>.
              </p>

              <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-end text-xs text-slate-500">
                <div className="text-left font-mono text-[10px]">
                  <div>Certificate ID: {cert.certificate_id}</div>
                  <div>Issued: {new Date(cert.issued_at).toLocaleDateString()}</div>
                </div>

                <div className="text-center">
                  <div className="font-serif italic font-semibold text-slate-800 dark:text-slate-200">
                    Chief Librarian
                  </div>
                  <div className="text-[10px] text-slate-400">Authorized Signature</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { dashboardService } from '../services';
import { Award, BarChart3, BookOpen, Download, Mail, Radar, TrendingUp, UserCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAuth } from '../contexts';

const tierClass = {
  Platinum: 'bg-indigo-100 text-indigo-700',
  Gold: 'bg-amber-100 text-amber-700',
  Silver: 'bg-slate-100 text-slate-700',
  Bronze: 'bg-orange-100 text-orange-700',
};

const StudentVisualization = () => {
  const { user } = useAuth();
  const userRole = String(user?.role || user?.role_name || user?.role?.role_name || '').toLowerCase();
  const isStudent = userRole === 'student';
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState({ leaderboard: [], highlights: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mailStatus, setMailStatus] = useState('');

  const fetchData = async (days) => {
    setLoading(true);
    setError('');
    try {
      const response = await dashboardService.getTopStudents({ period: days, limit: 25 });
      setData({
        leaderboard: response.leaderboard || [],
        highlights: response.highlights || {},
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load student activity insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  const maxPoints = useMemo(() => {
    return Math.max(1, ...data.leaderboard.map((item) => Number(item.score_points || 0)));
  }, [data.leaderboard]);

  const topStudents = useMemo(() => data.leaderboard.slice(0, 6), [data.leaderboard]);

  const chartTotals = useMemo(() => {
    return topStudents.reduce(
      (acc, student) => {
        acc.points += Number(student.score_points || 0);
        acc.visits += Number(student.visit_count || 0);
        acc.borrows += Number(student.borrow_count || 0);
        return acc;
      },
      { points: 0, visits: 0, borrows: 0 },
    );
  }, [topStudents]);

  const ringSegments = useMemo(() => {
    if (!topStudents.length || chartTotals.points <= 0) {
      return 'conic-gradient(#e2e8f0 0deg 360deg)';
    }

    const colors = ['#0f766e', '#0284c7', '#7c3aed', '#ea580c', '#16a34a', '#dc2626'];
    let current = 0;
    const parts = topStudents.map((student, index) => {
      const value = Number(student.score_points || 0);
      const angle = (value / chartTotals.points) * 360;
      const start = current;
      const end = Math.min(360, start + angle);
      current = end;
      return `${colors[index % colors.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
    });

    return `conic-gradient(${parts.join(', ')})`;
  }, [topStudents, chartTotals.points]);

  const winner = data.leaderboard[0] || null;

  const reportContent = useMemo(() => {
    if (!winner) return [];
    const monthLabel = new Date().toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return [
      'National Engineering College, Kovilpatti - Central Library',
      `Certificate of Recognition - ${monthLabel}`,
      '',
      `Active Library User of the Month: ${winner.student_name}`,
      `Student ID: ${winner.student_id || 'N/A'}`,
      `Email: ${winner.email || 'N/A'}`,
      `Rank: #1`,
      `Borrow/Return Transactions: ${winner.borrow_count}`,
      `Library Visits: ${winner.visit_count}`,
      `Points: ${winner.score_points}`,
      `Tier: ${winner.points_tier}`,
      '',
      'This report is generated from Smart Library system analytics.',
      `Generated on: ${new Date().toLocaleString()}`,
    ];
  }, [winner]);

  const downloadPdfReport = () => {
    if (!winner || !reportContent.length) return;

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const left = 56;
    let y = 70;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Central Library Student Recognition Report', left, y);
    y += 24;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    reportContent.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 480);
      doc.text(wrapped, left, y);
      y += wrapped.length * 16;
      if (y > 760) {
        doc.addPage();
        y = 70;
      }
    });

    doc.save(`active-library-user-${winner.student_name.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  };

  const notifyWinnerByMail = async () => {
    setMailStatus('Sending recognition email...');
    try {
      const response = await dashboardService.notifyTopStudentAward({ period });
      setMailStatus(response.message || 'Recognition email sent successfully');
    } catch (err) {
      setMailStatus(err.response?.data?.message || err.response?.data?.error || 'Failed to send recognition email');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold">Student Performance Visualization</h1>
            <p className="text-sm text-slate-600">Most frequent library visitors and top borrowers from database activity logs.</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="input w-44"
              value={period}
              onChange={(e) => setPeriod(Number(e.target.value))}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              type="button"
              className="btn btn-secondary inline-flex items-center gap-1"
              onClick={notifyWinnerByMail}
              disabled={loading || !winner || isStudent}
              title={isStudent ? 'Students are read-only' : 'Send recognition email'}
            >
              <Mail size={14} /> Send Mail to #1
            </button>
            {winner && (
              <button
                type="button"
                className="btn btn-primary inline-flex items-center gap-1"
                onClick={downloadPdfReport}
              >
                <Download size={14} /> Download Report
              </button>
            )}
          </div>
        </div>

        {mailStatus && <p className="text-sm text-slate-600 mb-3">{mailStatus}</p>}

        {loading ? (
          <p className="text-slate-500">Loading visualization data...</p>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1 text-emerald-700"><UserCheck size={16} /> Most Visits</div>
              <p className="font-bold text-lg">{data.highlights.top_visitor?.student_name || 'N/A'}</p>
              <p className="text-sm text-slate-600">{data.highlights.top_visitor?.visit_count || 0} library entries</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-cyan-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1 text-cyan-700"><BookOpen size={16} /> Most Borrowed</div>
              <p className="font-bold text-lg">{data.highlights.top_borrower?.student_name || 'N/A'}</p>
              <p className="text-sm text-slate-600">{data.highlights.top_borrower?.borrow_count || 0} books borrowed</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-4">
              <div className="flex items-center gap-2 mb-1 text-violet-700"><Award size={16} /> Top Points</div>
              <p className="font-bold text-lg">{data.leaderboard[0]?.student_name || 'N/A'}</p>
              <p className="text-sm text-slate-600">{data.leaderboard[0]?.score_points || 0} points</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Radar size={18} /> Contribution Ring</h2>
          {loading ? (
            <p className="text-slate-500">Preparing ring chart...</p>
          ) : !topStudents.length ? (
            <p className="text-slate-500">No activity found for selected period.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-5 items-center">
              <div className="mx-auto relative w-44 h-44 rounded-full" style={{ background: ringSegments }}>
                <div className="absolute inset-6 rounded-full bg-white border border-slate-200 flex flex-col items-center justify-center text-center">
                  <p className="text-xs uppercase tracking-wider text-slate-500">Total Points</p>
                  <p className="text-2xl font-black text-slate-900">{chartTotals.points}</p>
                </div>
              </div>
              <div className="space-y-2">
                {topStudents.map((student, index) => {
                  const palette = ['bg-teal-700', 'bg-sky-600', 'bg-violet-600', 'bg-orange-600', 'bg-emerald-600', 'bg-rose-600'];
                  const contribution = chartTotals.points ? ((Number(student.score_points || 0) / chartTotals.points) * 100).toFixed(1) : '0.0';
                  return (
                    <div key={student.id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2.5 h-2.5 rounded-full ${palette[index % palette.length]}`} />
                        <p className="truncate font-medium">{student.student_name}</p>
                      </div>
                      <p className="text-slate-600 font-semibold">{contribution}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="card border border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><BarChart3 size={18} /> Activity Matrix</h2>
          {loading ? (
            <p className="text-slate-500">Building activity matrix...</p>
          ) : !topStudents.length ? (
            <p className="text-slate-500">No matrix data available.</p>
          ) : (
            <div className="space-y-3">
              {topStudents.map((student, index) => {
                const visits = Number(student.visit_count || 0);
                const borrows = Number(student.borrow_count || 0);
                const intensity = Math.max(8, Math.round((Number(student.score_points || 0) / maxPoints) * 100));
                const borrowEfficiency = visits > 0 ? ((borrows / visits) * 100).toFixed(0) : '0';

                return (
                  <div key={student.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">#{index + 1} {student.student_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierClass[student.points_tier] || tierClass.Bronze}`}>{student.points_tier}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mb-2">
                      <div className="h-full bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600" style={{ width: `${intensity}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <p>Visits: <span className="font-semibold text-slate-800">{visits}</span></p>
                      <p>Borrowed: <span className="font-semibold text-slate-800">{borrows}</span></p>
                      <p>Borrow/Visit: <span className="font-semibold text-slate-800">{borrowEfficiency}%</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card border border-slate-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} /> Ranked Performance Timeline</h2>
        {loading ? (
          <p className="text-slate-500">Preparing ranked timeline...</p>
        ) : (
          <div className="space-y-3">
            {data.leaderboard.map((student, index) => {
              const width = Math.max(6, Math.round((Number(student.score_points || 0) / maxPoints) * 100));
              return (
                <div key={student.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <p className="font-semibold">#{index + 1} {student.student_name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tierClass[student.points_tier] || tierClass.Bronze}`}>{student.points_tier}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500" style={{ width: `${width}%` }} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1">Visits: {student.visit_count} | Active Days: {student.active_days} | Borrowed: {student.borrow_count} | Points: {student.score_points}</p>
                </div>
              );
            })}
            {!data.leaderboard.length && <p className="text-slate-500">No activity found for selected period.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentVisualization;

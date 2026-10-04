import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../services';
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  Sliders,
  Users,
  BookOpen,
  CheckCircle2,
  Clock,
  DollarSign,
  Building2,
  Award,
  AlertTriangle,
  GraduationCap,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
  X,
  FileCheck
} from 'lucide-react';

const AdminReportsView = () => {
  // Filter states
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [selectedDegree, setSelectedDegree] = useState('all');

  // Data states
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Template settings modal state
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(1);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    template_name: 'Standard Institutional Report',
    header_title: 'Central Library - Active Student Circulation & Analytics Report',
    institution_name: 'National Engineering College',
    show_department_breakdown: true,
    show_fine_summary: true,
    custom_footer_notes:
      'This official report is generated dynamically by the Central Library Information Management System for institutional review, academic council auditing, and NAAC/NBA criteria documentation.'
  });

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const res = await adminService.getReportTemplates();
      if (res.success && res.templates.length > 0) {
        setTemplates(res.templates);
        const activeTpl = res.templates[0];
        setSelectedTemplateId(activeTpl.id);
        setTemplateForm({
          template_name: activeTpl.template_name,
          header_title: activeTpl.header_title,
          institution_name: activeTpl.institution_name,
          show_department_breakdown: activeTpl.show_department_breakdown,
          show_fine_summary: activeTpl.show_fine_summary,
          custom_footer_notes: activeTpl.custom_footer_notes || ''
        });
      }
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  // Fetch analytics
  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        month: selectedMonth,
        year: selectedYear,
        department: selectedDepartment,
        degreeType: selectedDegree
      };
      const res = await adminService.getActiveStudentsAnalytics(params);
      if (res.success) {
        setAnalytics(res);
      } else {
        setError(res.error || 'Failed to fetch analytics');
      }
    } catch (err) {
      console.error('Error fetching active students analytics:', err);
      setError(err.response?.data?.message || err.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedMonth, selectedYear, selectedDepartment, selectedDegree]);

  // Handle PDF Download
  const handleDownloadPDF = async () => {
    setDownloadingPdf(true);
    try {
      const payload = {
        templateId: selectedTemplateId,
        month: selectedMonth,
        year: selectedYear,
        department: selectedDepartment,
        degreeType: selectedDegree
      };
      const blobData = await adminService.downloadActiveStudentsPDF(payload);
      
      // Create browser blob URL and trigger download
      const blob = new Blob([blobData], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const monthLabel = selectedMonth === 'all' ? 'All_Months' : `Month_${selectedMonth}`;
      link.setAttribute('download', `Active_Students_Report_${monthLabel}_${selectedYear}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast('Official PDF Report generated and downloaded successfully!');
    } catch (err) {
      console.error('Error downloading PDF report:', err);
      showToast('Failed to generate PDF. Please try again.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Save template configuration
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      if (selectedTemplateId) {
        await adminService.updateReportTemplate(selectedTemplateId, templateForm);
        showToast('Report template updated successfully.');
      } else {
        const res = await adminService.saveReportTemplate(templateForm);
        setSelectedTemplateId(res.template_id);
        showToast('New report template created.');
      }
      setIsTemplateModalOpen(false);
      fetchTemplates();
    } catch (err) {
      console.error('Error saving template:', err);
      showToast('Error saving template.', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const summary = analytics?.summary || {};
  const financials = analytics?.financials || {};
  const departmentBreakdown = analytics?.department_breakdown || [];
  const degreeDistribution = analytics?.degree_distribution || [];
  const topBorrowers = analytics?.top_borrowers || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 text-xs font-bold tracking-wide rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-indigo-600" />
                ADMINISTRATIVE WORKSPACE
              </span>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                Institutional Audits
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Active Students Analytics & PDF Report Generator
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl">
              Aggregate circulation metrics across academic departments, monitor on-time returns, and dynamically
              render official compliance PDFs for NAAC, NBA, and Academic Council documentation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsTemplateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm transition-all"
            >
              <Sliders size={16} className="text-slate-500" />
              <span>Configure Template</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || loading}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {downloadingPdf ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Rendering PDF...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>Download Official PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Month Period
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">Whole Year (All Months)</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Calendar Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="2027">2027</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">All Departments</option>
              <option value="CSE">Computer Science (CSE)</option>
              <option value="MECH">Mechanical Engg (MECH)</option>
              <option value="ECE">Electronics (ECE)</option>
              <option value="CIVIL">Civil Engineering (CIVIL)</option>
              <option value="AIDS">AI & Data Science (AIDS)</option>
              <option value="IT">Information Tech (IT)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Degree Program
            </label>
            <select
              value={selectedDegree}
              onChange={(e) => setSelectedDegree(e.target.value)}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="all">All Academic Programs</option>
              <option value="BE">Undergraduate (B.E. / B.Tech)</option>
              <option value="ME">Postgraduate (M.E. / M.Tech)</option>
              <option value="PhD">Doctoral (Ph.D. / Scholar)</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-all disabled:opacity-60"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertTriangle size={20} className="text-rose-600 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Borrowers */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Borrowers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.active_borrowers || 0}</span>
            <span className="text-xs font-semibold text-slate-500">
              of {summary.total_registered_students || 0} students
            </span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full rounded-full transition-all duration-500"
              style={{
                width: `${
                  summary.total_registered_students
                    ? Math.min(100, (summary.active_borrowers / summary.total_registered_students) * 100)
                    : 0
                }%`
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <span className="font-semibold text-slate-700">
              {summary.total_registered_students
                ? ((summary.active_borrowers / summary.total_registered_students) * 100).toFixed(1)
                : 0}
              %
            </span>{' '}
            campus participation
          </p>
        </div>

        {/* Books Circulated */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Books Circulated</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.total_issues || 0}</span>
            <span className="text-xs font-semibold text-slate-500">total transactions</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
              {summary.total_returned || 0} Returned
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
              {summary.currently_issued || 0} In Hand
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Recorded for period: {analytics?.period?.label}</p>
        </div>

        {/* On-Time Return Rate */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">On-Time Return %</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{summary.on_time_return_rate || 100}%</span>
            <span className="text-xs font-semibold text-emerald-600">Institutional KPI</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.on_time_return_rate || 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {summary.on_time_returns || 0} on-time out of {summary.total_returned || 0} returns
          </p>
        </div>

        {/* Overdues & Desk Holds */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overdue & Holds</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-600">{summary.overdue_items || 0}</span>
            <span className="text-xs font-semibold text-slate-500">overdue items</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-semibold">
              {summary.desk_holds_count || 0} Accounts Blocked
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Auto-blocked at Circulation Desk</p>
        </div>
      </div>

      {/* FINANCIAL OVERVIEW STRIP */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <DollarSign size={15} />
            <span>Fines & Financial Recovery Status</span>
          </div>
          <h2 className="text-xl font-bold">Circulation Desk Penalty Audit</h2>
          <p className="text-xs text-slate-300 max-w-md">
            Aggregated fines assessed, cash desk collections, and desk discretion waivers for active students.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Assessed</p>
            <p className="text-lg font-black text-white mt-0.5">₹{(financials.fines_assessed || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Cash Collected</p>
            <p className="text-lg font-black text-emerald-300 mt-0.5">₹{(financials.fines_collected || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Directly Waived</p>
            <p className="text-lg font-black text-amber-300 mt-0.5">₹{(financials.fines_waived || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Pending Balance</p>
            <p className="text-lg font-black text-rose-300 mt-0.5">₹{(financials.pending_fines || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* TWO-COLUMN DETAILS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Department Breakdown Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Department Circulation Breakdown</h3>
                <p className="text-xs text-slate-500">Student borrower volumes and return performance by department</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                {departmentBreakdown.length} Departments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-right">Registered</th>
                    <th className="py-3 px-4 text-right">Active Borrowers</th>
                    <th className="py-3 px-4 text-right">Books Issued</th>
                    <th className="py-3 px-4 text-right">On-Time %</th>
                    <th className="py-3 px-4 text-right">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {departmentBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                        No circulation transactions recorded for the selected period/department.
                      </td>
                    </tr>
                  ) : (
                    departmentBreakdown.map((dept, index) => (
                      <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center">
                              {dept.department.slice(0, 3)}
                            </span>
                            <span className="font-semibold text-slate-800">{dept.department}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-600 font-medium">{dept.total_students}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-semibold text-slate-900">{dept.active_borrowers}</span>
                          <span className="text-xs text-slate-400 ml-1">
                            ({dept.total_students ? ((dept.active_borrowers / dept.total_students) * 100).toFixed(0) : 0}%)
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-indigo-600">{dept.total_issues}</td>
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`font-semibold text-xs px-2 py-0.5 rounded-full ${
                              dept.on_time_rate >= 90
                                ? 'bg-emerald-50 text-emerald-700'
                                : dept.on_time_rate >= 75
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {dept.on_time_rate}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {dept.overdue_count > 0 ? (
                            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                              {dept.overdue_count}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Degree Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-900 text-base mb-1">Academic Degree Program Distribution</h3>
            <p className="text-xs text-slate-500 mb-4">Undergraduate vs Postgraduate circulation activity</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {degreeDistribution.map((deg, i) => (
                <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-indigo-700 px-2 py-0.5 rounded bg-indigo-50">
                      {deg.degree_type}
                    </span>
                    <GraduationCap size={16} className="text-slate-400" />
                  </div>
                  <div className="text-xl font-black text-slate-900">{deg.total_issues} Issues</div>
                  <p className="text-xs text-slate-500 mt-1">
                    {deg.active_borrowers} active out of {deg.student_count} students
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Top Borrowers & Document Verification */}
        <div className="space-y-6">
          {/* Top Active Borrowers Leaderboard */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Top Active Students</h3>
                <p className="text-xs text-slate-500">Highest circulation activity in selected period</p>
              </div>
              <Award size={18} className="text-amber-500" />
            </div>

            <div className="space-y-3">
              {topBorrowers.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No borrower records in this period.</p>
              ) : (
                topBorrowers.slice(0, 5).map((b, i) => (
                  <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          i === 0
                            ? 'bg-amber-100 text-amber-800'
                            : i === 1
                            ? 'bg-slate-200 text-slate-800'
                            : i === 2
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 leading-tight">{b.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {b.roll_number} • {b.department}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-indigo-600">{b.books_borrowed}</span>
                      <p className="text-[10px] text-slate-400 font-medium">books</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Institutional PDF Specifications Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck size={18} className="text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Official PDF Specifications</h3>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Institution:</span>
                <span className="font-semibold text-slate-800 text-right">{templateForm.institution_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Header Title:</span>
                <span className="font-semibold text-slate-800 text-right truncate max-w-[180px]">
                  {templateForm.header_title}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Dept. Breakdown:</span>
                <span className="font-semibold text-slate-800">
                  {templateForm.show_department_breakdown ? 'Enabled' : 'Hidden'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Fine Summary:</span>
                <span className="font-semibold text-slate-800">
                  {templateForm.show_fine_summary ? 'Enabled' : 'Hidden'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Signatures:</span>
                <span className="font-semibold text-emerald-600">Dual In-Charge + Dean</span>
              </div>
            </div>

            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPdf || loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm"
            >
              <Download size={14} />
              <span>Generate PDF Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* TEMPLATE CUSTOMIZATION MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-indigo-600" />
                <h3 className="text-lg font-bold text-slate-900">Configure Report Template</h3>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  value={templateForm.template_name}
                  onChange={(e) => setTemplateForm({ ...templateForm, template_name: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Institution Name (Printed on Header)
                </label>
                <input
                  type="text"
                  required
                  value={templateForm.institution_name}
                  onChange={(e) => setTemplateForm({ ...templateForm, institution_name: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Report Document Title
                </label>
                <input
                  type="text"
                  required
                  value={templateForm.header_title}
                  onChange={(e) => setTemplateForm({ ...templateForm, header_title: e.target.value })}
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.show_department_breakdown}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, show_department_breakdown: e.target.checked })
                    }
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-medium">Include Department-Wise Circulation Breakdown Table</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.show_fine_summary}
                    onChange={(e) => setTemplateForm({ ...templateForm, show_fine_summary: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-medium">Include Fines & Penalty Fiscal Recovery Summary</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Custom Institutional Footer Notes
                </label>
                <textarea
                  rows="3"
                  value={templateForm.custom_footer_notes}
                  onChange={(e) => setTemplateForm({ ...templateForm, custom_footer_notes: e.target.value })}
                  placeholder="Enter custom accreditation or audit verification text for the document footer..."
                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 disabled:opacity-60"
                >
                  {savingTemplate ? <RefreshCw size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Save Template</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReportsView;

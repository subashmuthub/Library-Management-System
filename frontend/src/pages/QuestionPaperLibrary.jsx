import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Search,
  Layers3,
} from 'lucide-react';

const questionPapers = [
  {
    id: 1,
    subjectName: 'Data Structures',
    department: 'Computer Science & Engineering',
    year: '2025',
    semester: 'Semester 4',
    examType: 'Internal',
    uploadDate: '2026-04-12',
  },
  {
    id: 2,
    subjectName: 'Computer Networks',
    department: 'Electronics & Communication Engineering',
    year: '2024',
    semester: 'Semester 5',
    examType: 'External',
    uploadDate: '2026-03-22',
  },
  {
    id: 3,
    subjectName: 'DBMS',
    department: 'Computer Science & Engineering',
    year: '2023',
    semester: 'Semester 6',
    examType: 'Internal',
    uploadDate: '2026-03-18',
  },
  {
    id: 4,
    subjectName: 'Operating Systems',
    department: 'Artificial Intelligence & Data Science',
    year: '2022',
    semester: 'Semester 3',
    examType: 'External',
    uploadDate: '2026-02-10',
  },
  {
    id: 5,
    subjectName: 'Software Engineering',
    department: 'Computer Science & Engineering',
    year: '2021',
    semester: 'Semester 7',
    examType: 'External',
    uploadDate: '2026-01-28',
  },
  {
    id: 6,
    subjectName: 'Microprocessors',
    department: 'Electrical & Electronics Engineering',
    year: '2020',
    semester: 'Semester 6',
    examType: 'Internal',
    uploadDate: '2025-12-15',
  },
];

const departmentOptions = [
  'All Departments',
  'Computer Science & Engineering',
  'Electronics & Communication Engineering',
  'Electrical & Electronics Engineering',
  'Mechanical Engineering',
  'Artificial Intelligence & Data Science',
];

const yearOptions = ['All Years', '2025', '2024', '2023', '2022', '2021', '2020'];
const semesterOptions = ['All Semesters', 'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8'];

const formatDate = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const QuestionPaperLibrary = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [year, setYear] = useState('All Years');
  const [semester, setSemester] = useState('All Semesters');

  const filteredPapers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return questionPapers.filter((paper) => {
      const matchesSearch = !query || paper.subjectName.toLowerCase().includes(query);
      const matchesDepartment = department === 'All Departments' || paper.department === department;
      const matchesYear = year === 'All Years' || paper.year === year;
      const matchesSemester = semester === 'All Semesters' || paper.semester === semester;

      return matchesSearch && matchesDepartment && matchesYear && matchesSemester;
    });
  }, [searchTerm, department, year, semester]);

  const handleDownload = (paper) => {
    const fileName = `${paper.subjectName.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${paper.year}_${paper.semester.replace(/\s+/g, '')}.pdf`;
    const content = [
      'Digital Question Paper Library',
      `Subject: ${paper.subjectName}`,
      `Department: ${paper.department}`,
      `Year: ${paper.year}`,
      `Semester: ${paper.semester}`,
      `Exam Type: ${paper.examType}`,
      `Upload Date: ${formatDate(paper.uploadDate)}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.08),transparent_28%)] pointer-events-none" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <FileText size={14} />
              Digital Question Paper Library
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Search, filter, and download previous year question papers.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Papers are grouped by department, subject, year, and semester so students can quickly
              find the exact exam paper they need during preparation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total papers</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{questionPapers.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visible now</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{filteredPapers.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Years covered</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">2020-2025</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exam types</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">2</p>
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-sky-600" />
          <h2 className="text-lg font-semibold text-slate-900">Search and filters</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <label className="lg:col-span-4">
            <span className="mb-2 block text-sm font-medium text-slate-700">Subject Name</span>
            <div className="relative">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by subject name"
                className="input pl-11"
              />
            </div>
          </label>

          <label className="lg:col-span-3">
            <span className="mb-2 block text-sm font-medium text-slate-700">Department</span>
            <div className="relative">
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className="input appearance-none pr-10"
              >
                {departmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </label>

          <label className="lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-700">Year</span>
            <div className="relative">
              <select
                value={year}
                onChange={(event) => setYear(event.target.value)}
                className="input appearance-none pr-10"
              >
                {yearOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </label>

          <label className="lg:col-span-3">
            <span className="mb-2 block text-sm font-medium text-slate-700">Semester</span>
            <div className="relative">
              <select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="input appearance-none pr-10"
              >
                {semesterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Question Papers</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Available downloads</h2>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm sm:flex">
            <Layers3 size={16} className="text-sky-600" />
            Organized by department, year, and semester
          </div>
        </div>

        {filteredPapers.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPapers.map((paper) => (
              <article key={paper.id} className="card flex h-full flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                        <GraduationCap size={13} />
                        {paper.department}
                      </p>
                      <h3 className="mt-3 text-xl font-bold text-slate-900">{paper.subjectName}</h3>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        paper.examType === 'Internal'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      {paper.examType}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{paper.year}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semester</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{paper.semester}</dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload Date</dt>
                      <dd className="mt-1 inline-flex items-center gap-2 font-semibold text-slate-900">
                        <CalendarDays size={14} className="text-slate-500" />
                        {formatDate(paper.uploadDate)}
                      </dd>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exam Type</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{paper.examType}</dd>
                    </div>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownload(paper)}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  <Download size={16} />
                  Download PDF
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="card border-dashed text-center">
            <FileText size={34} className="mx-auto text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">No question papers match your filters</h3>
            <p className="mt-2 text-sm text-slate-600">Try changing the subject name, department, year, or semester filters.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default QuestionPaperLibrary;
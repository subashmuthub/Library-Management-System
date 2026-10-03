import React from 'react';
import { BookOpen, FileText, Bookmark, Layers } from 'lucide-react';

const TABS = [
  { id: 'ALL', label: 'All Resources', icon: Layers, description: 'Complete catalog' },
  { id: 'BOOK', label: 'Books', icon: BookOpen, description: 'Textbooks, fiction & reference' },
  { id: 'RESEARCH_PAPER', label: 'Research Papers', icon: FileText, description: 'Theses & conference papers' },
  { id: 'JOURNAL', label: 'Journals', icon: Bookmark, description: 'Peer-reviewed periodicals' },
];

/**
 * ResourceTypeTabs
 * Category tab bar filtering catalog items by resource_type ('BOOK', 'RESEARCH_PAPER', 'JOURNAL').
 *
 * @param {string} activeType - Currently active filter ('ALL', 'BOOK', 'RESEARCH_PAPER', 'JOURNAL')
 * @param {function} onChange - Callback triggered with selected type
 * @param {object} counts - Optional counts per category { ALL: 150, BOOK: 110, RESEARCH_PAPER: 25, JOURNAL: 15 }
 */
export default function ResourceTypeTabs({ activeType = 'ALL', onChange, counts = {} }) {
  return (
    <div className="w-full bg-white dark:bg-slate-800 rounded-xl p-1.5 shadow-sm border border-slate-200 dark:border-slate-700">
      <nav className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="tablist" aria-label="Catalog Resource Filters">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeType.toUpperCase() === tab.id;
          const count = counts[tab.id];

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange && onChange(tab.id)}
              className={`flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/60'
              }`}
            >
              <Icon
                className={`w-4 h-4 transition-transform duration-200 ${
                  isActive ? 'scale-110 text-white' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span className="truncate">{tab.label}</span>

              {typeof count === 'number' && (
                <span
                  className={`inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

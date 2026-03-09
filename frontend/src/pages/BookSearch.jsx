import React, { useState, useEffect } from 'react';
import { Search, Book, FileText, User, MapPin, CheckCircle, XCircle, Clock, Grid, List, Download, Bookmark, Copy, ExternalLink, Filter, X, History, TrendingUp, BarChart3, ShoppingCart, AlertCircle, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookService, transactionService, reservationService } from '../services';
import { useAuth } from '../contexts';

const BookSearch = () => {
  const { user: currentUser } = useAuth();
  const [searchType, setSearchType] = useState('title'); // title, isbn, author
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, book, journal
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // all, available, in-use
  const [rawResults, setRawResults] = useState([]); // unfiltered API results
  const [results, setResults] = useState([]);        // filtered + sorted display results
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [sortBy, setSortBy] = useState('relevance'); // relevance, title, author, year
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchStats, setSearchStats] = useState({ total: 0, available: 0, inUse: 0 });
  const [checkoutModal, setCheckoutModal] = useState(null); // book object or null
  const [checkoutForm, setCheckoutForm] = useState({ user_id: '', loan_days: 14 });
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [reserveModal, setReserveModal] = useState(null);
  const [reserveLoading, setReserveLoading] = useState(false);
  
  const [departments] = useState([
    'Computer Science',
    'Electronics',
    'Mechanical',
    'Civil',
    'Electrical',
    'Information Technology',
    'General'
  ]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save recent searches
  const saveRecentSearch = (query, type) => {
    if (!query.trim()) return;
    const newSearch = { query, type, timestamp: Date.now() };
    const updated = [newSearch, ...recentSearches.filter(s => s.query !== query || s.type !== type)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  // Reactively re-filter whenever filters or sort change
  useEffect(() => {
    if (rawResults.length === 0) return;

    let filtered = [...rawResults];

    if (typeFilter !== 'all') {
      filtered = filtered.filter(b => (b.type || 'book') === typeFilter);
    }
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(b => b.department === departmentFilter);
    }
    if (availabilityFilter === 'available') {
      filtered = filtered.filter(b => b.is_available === 1 || b.is_available === true || !b.current_borrower);
    } else if (availabilityFilter === 'in-use') {
      filtered = filtered.filter(b => b.is_available === 0 || b.is_available === false || b.current_borrower);
    }

    filtered = sortResults(filtered, sortBy);
    setResults(filtered);

    const available = filtered.filter(b => b.is_available === 1 || b.is_available === true || !b.current_borrower).length;
    setSearchStats({ total: filtered.length, available, inUse: filtered.length - available });
  }, [rawResults, typeFilter, departmentFilter, availabilityFilter, sortBy]);

  // Auto-search as user types (debounced 400ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setRawResults([]);
      setResults([]);
      setSearchStats({ total: 0, available: 0, inUse: 0 });
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = {};
        if (searchType === 'isbn') params.isbn = searchQuery;
        else if (searchType === 'title') params.title = searchQuery;
        else if (searchType === 'author') params.author = searchQuery;
        const response = await bookService.searchBooks(params);
        const booksData = response.books || response.data || [];
        setRawResults(booksData);
      } catch (error) {
        console.error('Auto-search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchType]);

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    saveRecentSearch(searchQuery, searchType);
    
    try {
      const params = {};
      
      // Add search parameters only — filters applied client-side reactively
      if (searchType === 'isbn') {
        params.isbn = searchQuery;
      } else if (searchType === 'title') {
        params.title = searchQuery;
      } else if (searchType === 'author') {
        params.author = searchQuery;
      }

      const response = await bookService.searchBooks(params);
      const booksData = response.books || response.data || [];
      // Store raw results — the useEffect will apply filters + sort automatically
      setRawResults(booksData);
    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Sort results
  const sortResults = (data, sortType) => {
    const sorted = [...data];
    switch (sortType) {
      case 'title':
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case 'author':
        return sorted.sort((a, b) => a.author.localeCompare(b.author));
      case 'year':
        return sorted.sort((a, b) => (b.publication_year || 0) - (a.publication_year || 0));
      default:
        return sorted;
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setTypeFilter('all');
    setDepartmentFilter('all');
    setAvailabilityFilter('all');
    setSortBy('relevance');
  };

  // Export results to CSV
  const exportResults = () => {
    if (results.length === 0) {
      alert('No results to export');
      return;
    }

    const csvContent = [
      ['Title', 'Author', 'ISBN', 'Type', 'Department', 'Category', 'Year', 'Availability', 'Location'].join(','),
      ...results.map(book => [
        `"${book.title}"`,
        `"${book.author}"`,
        book.isbn,
        book.type || 'book',
        book.department || 'General',
        book.category || 'N/A',
        book.publication_year || 'N/A',
        book.is_available || !book.current_borrower ? 'Returned' : 'In Use',
        `"${book.shelf_location || 'N/A'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `search_results_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  // Load recent search
  const loadRecentSearch = (search) => {
    setSearchType(search.type);
    setSearchQuery(search.query);
  };

  // Open reserve modal
  const openReserve = (book) => {
    setReserveModal(book);
  };

  // Perform reservation
  const handleReserve = async (book) => {
    if (!currentUser?.id) { alert('Please log in to reserve a book.'); return; }
    setReserveLoading(true);
    try {
      await reservationService.reserveBook({ book_id: book.id, user_id: currentUser.id });
      alert(`"${book.title}" reserved! You'll be notified when it becomes available.`);
      setReserveModal(null);
    } catch (error) {
      alert(`Reservation failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setReserveLoading(false);
    }
  };

  // Open checkout modal
  const openCheckout = (book) => {
    setCheckoutForm({ user_id: '', loan_days: 14 });
    setCheckoutModal(book);
  };

  // Perform checkout
  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!checkoutForm.user_id) { alert('Please enter a User ID'); return; }
    setCheckoutLoading(true);
    try {
      await transactionService.checkoutBook({
        book_id: checkoutModal.id,
        user_id: checkoutForm.user_id,
        loan_days: checkoutForm.loan_days
      });
      alert(`"${checkoutModal.title}" checked out successfully!`);
      setCheckoutModal(null);
      // Update the book in rawResults to reflect new status
      setRawResults(prev => prev.map(b =>
        b.id === checkoutModal.id ? { ...b, is_available: false } : b
      ));
    } catch (error) {
      alert(`Checkout failed: ${error.response?.data?.message || error.response?.data?.error || error.message}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getAvailabilityBadge = (book) => {
    const available = book.is_available === 1 || book.is_available === true || !book.current_borrower;
    if (available) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
          <CheckCircle size={16} className="mr-1" />
          Available
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700">
          <XCircle size={16} className="mr-1" />
          Checked Out
        </span>
      );
    }
  };

  const getTypeBadge = (type) => {
    return type === 'journal' ? (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-700">
        <FileText size={14} className="mr-1" />
        Journal
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700">
        <Book size={14} className="mr-1" />
        Book
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Professional Header with Gradient */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Book & Journal Search</h1>
            <p className="text-purple-100">Search library catalog by ISBN, title, or author</p>
          </div>
          <div className="hidden md:block">
            <Search size={64} className="opacity-20" />
          </div>
        </div>
      </div>

      {/* Search Form with Professional Design */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Search Type Tabs */}
          <div className="flex gap-2 border-b pb-4">
            {[
              { value: 'title', label: 'Title', icon: Book },
              { value: 'isbn', label: 'ISBN', icon: BarChart3 },
              { value: 'author', label: 'Author', icon: User }
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSearchType(value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  searchType === value
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </div>

          {/* Main Search Bar */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search by ${searchType}...`}
                className="input pl-10 w-full text-lg"
                autoFocus
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary px-8"
              disabled={loading}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Inline Filters Row — always visible, each filter applies instantly */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
            <span className="flex items-center gap-1 text-sm font-medium text-gray-500">
              <Filter size={16} />
              Filters:
            </span>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`input py-1.5 text-sm w-40 ${typeFilter !== 'all' ? 'border-blue-500 ring-1 ring-blue-400' : ''}`}
            >
              <option value="all">All Types</option>
              <option value="book">📚 Books</option>
              <option value="journal">📰 Journals</option>
            </select>

            {/* Department Filter */}
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className={`input py-1.5 text-sm w-52 ${departmentFilter !== 'all' ? 'border-blue-500 ring-1 ring-blue-400' : ''}`}
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {/* Availability Filter */}
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className={`input py-1.5 text-sm w-44 ${availabilityFilter !== 'all' ? 'border-blue-500 ring-1 ring-blue-400' : ''}`}
            >
              <option value="all">All Status</option>
              <option value="available">✅ Returned</option>
              <option value="in-use">🔴 In Use</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input py-1.5 text-sm w-44"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="title">Sort: Title (A–Z)</option>
              <option value="author">Sort: Author (A–Z)</option>
              <option value="year">Sort: Year (Newest)</option>
            </select>

            {/* Active filter count + Clear */}
            {(typeFilter !== 'all' || departmentFilter !== 'all' || availabilityFilter !== 'all') && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium border border-red-200"
              >
                <X size={14} />
                Clear Filters
                <span className="bg-red-600 text-white rounded-full px-1.5 py-0.5 text-xs ml-1">
                  {[typeFilter !== 'all', departmentFilter !== 'all', availabilityFilter !== 'all'].filter(Boolean).length}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && rawResults.length === 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <History size={18} />
              Recent Searches
            </h3>
            <button
              onClick={clearRecentSearches}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((search, index) => (
              <button
                key={index}
                onClick={() => loadRecentSearch(search)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                <Search size={14} />
                <span className="font-medium">{search.query}</span>
                <span className="text-gray-500">({search.type})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results with Stats and Controls */}
      {results.length > 0 && (
        <>
          {/* Results Header with Stats */}
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  Search Results
                </h2>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp size={16} className="text-blue-500" />
                    <span className="font-semibold">{searchStats.total}</span>
                    <span className="text-gray-600">Total Found</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} className="text-green-500" />
                    <span className="font-semibold">{searchStats.available}</span>
                    <span className="text-gray-600">Returned</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <XCircle size={16} className="text-red-500" />
                    <span className="font-semibold">{searchStats.inUse}</span>
                    <span className="text-gray-600">In Use</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* View Toggle */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : 'text-gray-600'}`}
                    title="Grid View"
                  >
                    <Grid size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : 'text-gray-600'}`}
                    title="List View"
                  >
                    <List size={18} />
                  </button>
                </div>
                
                {/* Export Button */}
                <button
                  onClick={exportResults}
                  className="btn bg-green-600 hover:bg-green-700 text-white"
                  title="Export Results"
                >
                  <Download size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Results - Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((book) => (
                <div
                  key={book.id}
                  className="card hover:shadow-xl transition-all duration-200 border-l-4 border-blue-500"
                >
                  <div className="flex items-center justify-between mb-3">
                    {getTypeBadge(book.type)}
                    {getAvailabilityBadge(book)}
                  </div>
                  
                  <Link to={`/books/${book.id}`}>
                    <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600 mb-1 line-clamp-2">
                      {book.title}
                    </h3>
                  </Link>
                  
                  <p className="text-gray-600 text-sm mb-3 flex items-center gap-1">
                    <User size={14} />
                    {book.author}
                  </p>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span className="font-medium">ISBN:</span>
                      <button
                        onClick={() => copyToClipboard(book.isbn, 'ISBN')}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        {book.isbn}
                        <Copy size={12} />
                      </button>
                    </div>
                    {book.category && (
                      <div className="flex justify-between">
                        <span className="font-medium">Category:</span>
                        <span className="badge badge-info text-xs">{book.category}</span>
                      </div>
                    )}
                    {book.publication_year && (
                      <div className="flex justify-between">
                        <span className="font-medium">Year:</span>
                        <span>{book.publication_year}</span>
                      </div>
                    )}
                    {book.shelf_location && (
                      <div className="flex items-center gap-1 text-blue-600">
                        <MapPin size={14} />
                        <span className="text-xs">{book.shelf_location}</span>
                      </div>
                    )}
                  </div>

                  {book.current_borrower && (
                    <div className="bg-yellow-50 border border-yellow-200 p-2 rounded mb-3">
                      <div className="text-xs text-yellow-800">
                        <div className="flex items-center gap-1 mb-1">
                          <User size={12} />
                          <span className="font-medium">Borrowed by: {book.current_borrower}</span>
                        </div>
                        {book.due_date && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>Due: {book.due_date}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Link
                      to={`/books/${book.id}`}
                      className="flex-1 btn btn-primary text-sm py-2"
                    >
                      <ExternalLink size={14} className="mr-1" />
                      View Details
                    </Link>
                    {(book.is_available === 1 || book.is_available === true) ? (
                      <button
                        onClick={() => openCheckout(book)}
                        className="btn bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3"
                        title="Checkout Book"
                      >
                        <ShoppingCart size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => openReserve(book)}
                        className="btn bg-amber-500 hover:bg-amber-600 text-white text-sm py-2 px-3"
                        title="Reserve – get notified when available"
                      >
                        <Bell size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results - List View */}
          {viewMode === 'list' && (
            <div className="card">
              <div className="space-y-3">
                {results.map((book) => (
                  <div
                    key={book.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all hover:border-blue-300"
                  >
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeBadge(book.type)}
                          {getAvailabilityBadge(book)}
                        </div>
                        
                        <Link to={`/books/${book.id}`}>
                          <h3 className="text-lg font-bold text-gray-900 hover:text-blue-600 mb-1">
                            {book.title}
                          </h3>
                        </Link>
                        
                        <p className="text-gray-600 mb-3 flex items-center gap-1">
                          <User size={16} />
                          by {book.author}
                        </p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                          <div>
                            <span className="font-medium">ISBN:</span>
                            <button
                              onClick={() => copyToClipboard(book.isbn, 'ISBN')}
                              className="ml-1 text-blue-600 hover:text-blue-700"
                            >
                              {book.isbn} <Copy size={12} className="inline" />
                            </button>
                          </div>
                          <div>
                            <span className="font-medium">Publisher:</span> {book.publisher || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Category:</span> {book.category || 'N/A'}
                          </div>
                          <div>
                            <span className="font-medium">Department:</span> {book.department || 'General'}
                          </div>
                          {book.publication_year && (
                            <div>
                              <span className="font-medium">Year:</span> {book.publication_year}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Copies:</span> {book.total_copies || 1}
                          </div>
                          {book.shelf_location && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <MapPin size={14} />
                              <span>{book.shelf_location}</span>
                            </div>
                          )}
                        </div>

                        {book.current_borrower && (
                          <div className="mt-3 bg-yellow-50 border border-yellow-200 p-3 rounded">
                            <div className="flex items-center text-sm">
                              <User size={16} className="mr-2 text-yellow-600" />
                              <span className="font-medium text-yellow-800">
                                Currently borrowed by: {book.current_borrower}
                              </span>
                            </div>
                            {book.due_date && (
                              <div className="flex items-center text-sm mt-1">
                                <Clock size={16} className="mr-2 text-yellow-600" />
                                <span className="text-yellow-700">Due date: {book.due_date}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {book.description && (
                          <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                            {book.description}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col gap-2">
                        <Link
                          to={`/books/${book.id}`}
                          className="btn btn-primary text-sm whitespace-nowrap"
                        >
                          <ExternalLink size={14} className="mr-1" />
                          View Details
                        </Link>
                        {(book.is_available === 1 || book.is_available === true) ? (
                          <button
                            onClick={() => openCheckout(book)}
                            className="btn bg-green-600 hover:bg-green-700 text-white text-sm whitespace-nowrap"
                          >
                            <ShoppingCart size={14} className="mr-1" />
                            Checkout
                          </button>
                        ) : (
                          <button
                            onClick={() => openReserve(book)}
                            className="btn bg-amber-500 hover:bg-amber-600 text-white text-sm whitespace-nowrap"
                          >
                            <Bell size={14} className="mr-1" />
                            Reserve
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* No Results — API returned nothing */}
      {!loading && rawResults.length === 0 && searchQuery && (
        <div className="card text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
              <Search size={48} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600 mb-4">
              We couldn't find any books or journals matching "<span className="font-semibold">{searchQuery}</span>"
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-2">Search Tips:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Check your spelling</li>
                <li>• Try different keywords</li>
                <li>• Use broader search terms</li>
                <li>• Remove some filters</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* No Results — filters narrowed to zero */}
      {!loading && rawResults.length > 0 && results.length === 0 && (
        <div className="card text-center py-10">
          <Filter size={40} className="mx-auto mb-3 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">No items match the current filters</h3>
          <p className="text-sm text-gray-500 mb-4">{rawResults.length} result{rawResults.length !== 1 ? 's' : ''} found — adjust or clear filters to see them</p>
          <button onClick={clearFilters} className="btn btn-primary">
            <X size={16} className="mr-1" /> Clear Filters
          </button>
        </div>
      )}

      {/* Initial State - No Search Yet */}
      {!searchQuery && rawResults.length === 0 && (
        <div className="card text-center py-16">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Book size={48} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Discover Your Next Read</h3>
            <p className="text-gray-600 mb-6">
              Enter a search term above to find books and journals in our library
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="bg-blue-50 p-4 rounded-lg">
                <Book className="text-blue-600 mb-2" size={24} />
                <h4 className="font-semibold text-gray-900 mb-1">Search by Title</h4>
                <p className="text-sm text-gray-600">Find books by their exact or partial title</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <User className="text-purple-600 mb-2" size={24} />
                <h4 className="font-semibold text-gray-900 mb-1">Search by Author</h4>
                <p className="text-sm text-gray-600">Discover all works by your favorite authors</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <BarChart3 className="text-green-600 mb-2" size={24} />
                <h4 className="font-semibold text-gray-900 mb-1">Search by ISBN</h4>
                <p className="text-sm text-gray-600">Find specific editions using ISBN numbers</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card text-center py-16">
          <div className="animate-pulse">
            <Search className="animate-spin mx-auto mb-4 text-blue-500" size={48} />
            <p className="text-gray-600 font-medium">Searching library catalog...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we find matching items</p>
          </div>
        </div>
      )}

      {/* ── Checkout Modal ── */}
      {checkoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-t-xl p-5 text-white">
              <div className="flex items-center gap-3">
                <ShoppingCart size={24} />
                <div>
                  <h2 className="text-xl font-bold">Checkout Book</h2>
                  <p className="text-green-100 text-sm">Issue this book to a student</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleCheckout} className="p-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="font-semibold text-gray-900 text-sm">{checkoutModal.title}</p>
                <p className="text-xs text-gray-500">by {checkoutModal.author}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student / User ID <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={checkoutForm.user_id}
                  onChange={e => setCheckoutForm(f => ({ ...f, user_id: e.target.value }))}
                  placeholder="Enter user ID or roll number"
                  className="input w-full"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loan Period</label>
                <select
                  value={checkoutForm.loan_days}
                  onChange={e => setCheckoutForm(f => ({ ...f, loan_days: parseInt(e.target.value) }))}
                  className="input w-full"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={21}>21 days</option>
                  <option value={30}>30 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Due back by: <span className="font-medium text-gray-700">
                    {new Date(Date.now() + checkoutForm.loan_days * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModal(null)}
                  className="flex-1 btn btn-outline"
                  disabled={checkoutLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn bg-green-600 hover:bg-green-700 text-white"
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? 'Processing...' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reserve Modal ── */}
      {reserveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-xl p-5 text-white">
              <div className="flex items-center gap-3">
                <Bell size={24} />
                <div>
                  <h2 className="text-xl font-bold">Reserve Book</h2>
                  <p className="text-amber-100 text-sm">Book is currently checked out</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="font-semibold text-gray-900 text-sm">{reserveModal.title}</p>
                <p className="text-xs text-gray-500">by {reserveModal.author}</p>
              </div>

              {(reserveModal.current_borrower || reserveModal.due_date) && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm">
                  {reserveModal.current_borrower && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <User size={16} className="text-gray-400" />
                      <span>Currently with: <span className="font-medium">{reserveModal.current_borrower}</span></span>
                    </div>
                  )}
                  {reserveModal.due_date && (
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock size={16} className="text-amber-500" />
                      <span>Expected return: <span className="font-medium text-amber-700">{new Date(reserveModal.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></span>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <Bell size={14} className="inline mr-1" />
                You'll be placed in the queue and notified when this book becomes available.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setReserveModal(null)}
                  className="flex-1 btn btn-outline"
                  disabled={reserveLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReserve(reserveModal)}
                  className="flex-1 btn bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={reserveLoading}
                >
                  {reserveLoading ? 'Reserving...' : 'Reserve & Notify Me'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookSearch;

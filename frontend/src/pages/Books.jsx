import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { bookService } from '../services';
import { Search, BookOpen, Filter, MapPin } from 'lucide-react';

const Books = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    available: '',
  });

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params = {
        query: searchTerm || undefined,
        category: filters.category || undefined,
        limit: 50,
      };
      const response = await bookService.searchBooks(params);
      setBooks(response.books || []);
    } catch (error) {
      console.error('Failed to load books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadBooks();
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by title, author, or ISBN..."
                  className="input pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary px-6">
              Search
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-4 items-center">
            <Filter size={20} className="text-gray-600" />
            <select
              className="input"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">All Categories</option>
              <option value="Fiction">Fiction</option>
              <option value="Non-Fiction">Non-Fiction</option>
              <option value="Science">Science</option>
              <option value="Technology">Technology</option>
              <option value="History">History</option>
              <option value="Academic">Academic</option>
            </select>
          </div>
        </form>
      </div>

      {/* Results */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {searchTerm ? `Search Results for "${searchTerm}"` : 'All Books'}
          </h2>
          <span className="text-sm text-gray-600">{books.length} books found</span>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading books...</div>
          </div>
        ) : books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <Link
                key={book.book_id}
                to={`/books/${book.book_id}`}
                className="block p-4 border border-gray-200 rounded-lg hover:shadow-md hover:border-primary-300 transition-all"
              >
                <div className="flex gap-3">
                  <div className="w-16 h-20 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                    <BookOpen size={24} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate mb-1">
                      {book.title}
                    </h3>
                    <p className="text-sm text-gray-600 truncate mb-2">{book.author}</p>
                    <div className="flex items-center gap-2">
                      <span className="badge badge-info text-xs">{book.category}</span>
                      {book.current_shelf && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPin size={12} />
                          {book.current_shelf}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {searchTerm ? 'No books found matching your search' : 'No books available'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Books;

import React, { useState } from 'react';
import { bookService, navigationService } from '../services';
import { Compass as NavigationIcon, MapPin, Radio, Search, ArrowRight } from 'lucide-react';

const Navigation = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [navigation, setNavigation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const response = await bookService.searchBooks({ query: searchTerm, limit: 10 });
      setBooks(response.books || []);
      setSelectedBook(null);
      setNavigation(null);
    } catch (error) {
      console.error('Failed to search books:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = async (book) => {
    setSelectedBook(book);
    setLoading(true);
    try {
      const navData = await navigationService.findBook(book.book_id);
      setNavigation(navData);
    } catch (error) {
      console.error('Failed to get navigation:', error);
      setNavigation({ error: 'Navigation data not available' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <div className="card bg-primary-50 border border-primary-200">
        <div className="flex items-start gap-3">
          <NavigationIcon className="text-primary-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold mb-1">Indoor Navigation</h3>
            <p className="text-sm text-gray-700">
              Search for a book and get turn-by-turn directions using BLE beacon technology. 
              The system will guide you to the exact shelf location.
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Search for a Book</h2>
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                className="input pl-10"
                placeholder="Enter book title, author, or ISBN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary px-6" disabled={loading}>
            Search
          </button>
        </form>
      </div>

      {/* Search Results */}
      {books.length > 0 && (
        <div className="card">
          <h3 className="font-bold mb-3">Search Results</h3>
          <div className="space-y-2">
            {books.map((book) => (
              <button
                key={book.book_id}
                onClick={() => handleNavigate(book)}
                className="w-full p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all text-left flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{book.title}</p>
                  <p className="text-sm text-gray-600">{book.author}</p>
                  {book.current_shelf && (
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin size={14} className="text-gray-500" />
                      <span className="text-sm text-gray-600">Shelf {book.current_shelf}</span>
                    </div>
                  )}
                </div>
                <ArrowRight size={20} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Instructions */}
      {selectedBook && navigation && !navigation.error && (
        <div className="card bg-green-50 border border-green-200">
          <div className="mb-4">
            <h3 className="font-bold text-lg mb-1">Navigating to:</h3>
            <p className="text-xl font-semibold text-gray-900">{selectedBook.title}</p>
            <p className="text-gray-600">{selectedBook.author}</p>
          </div>

          <div className="space-y-4">
            {/* Location */}
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="text-green-600" size={20} />
                <p className="font-medium">Location</p>
              </div>
              <p className="text-2xl font-bold text-green-700">
                Shelf {navigation.shelf?.shelf_code}
              </p>
              <p className="text-sm text-gray-600">
                {navigation.shelf?.section} - {navigation.shelf?.floor}
              </p>
            </div>

            {/* Directions */}
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <NavigationIcon className="text-blue-600" size={20} />
                <p className="font-medium">Directions</p>
              </div>
              <p className="text-gray-700">{navigation.directions}</p>
            </div>

            {/* Beacon Info */}
            {navigation.beacon && (
              <div className="bg-white p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Radio className="text-purple-600" size={20} />
                  <p className="font-medium">BLE Beacon</p>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">UUID</p>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
                      {navigation.beacon.uuid}
                    </code>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Zone</p>
                    <span className="badge badge-info">{navigation.beacon.zone}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Use your phone's BLE scanner to detect this beacon
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {navigation?.error && (
        <div className="card bg-red-50 border border-red-200">
          <p className="text-red-700">{navigation.error}</p>
        </div>
      )}

      {/* Empty State */}
      {books.length === 0 && !selectedBook && (
        <div className="card text-center py-12">
          <NavigationIcon size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">Search for a book to get started</p>
        </div>
      )}
    </div>
  );
};

export default Navigation;

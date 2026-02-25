import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService, navigationService } from '../services';
import { ArrowLeft, BookOpen, MapPin, Compass, Clock, Tag } from 'lucide-react';
import { format } from 'date-fns';

const BookDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [navigation, setNavigation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookDetails();
  }, [id]);

  const loadBookDetails = async () => {
    if (!id || id === 'undefined') {
      console.error('Invalid book ID:', id);
      return;
    }
    
    setLoading(true);
    try {
      const [bookData, historyData] = await Promise.all([
        bookService.getBookById(id),
        bookService.getBookLocationHistory(id),
      ]);
      setBook(bookData.book || bookData.data);
      setLocationHistory(historyData.history || historyData.data || []);
    } catch (error) {
      console.error('Failed to load book details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = async () => {
    try {
      const navData = await navigationService.findBook(id);
      setNavigation(navData);
    } catch (error) {
      console.error('Failed to get navigation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading book details...</div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Book not found</p>
        <button onClick={() => navigate('/books')} className="btn btn-primary mt-4">
          Back to Books
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <button onClick={() => navigate('/books')} className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
        <ArrowLeft size={20} />
        Back to Books
      </button>

      {/* Book Info */}
      <div className="card">
        <div className="flex gap-6">
          <div className="w-32 h-48 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen size={48} className="text-primary-600" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
            <p className="text-xl text-gray-600 mb-4">{book.author}</p>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">ISBN</p>
                <p className="font-medium">{book.isbn}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Category</p>
                <span className="badge badge-info">{book.category}</span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Publisher</p>
                <p className="font-medium">{book.publisher || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Year</p>
                <p className="font-medium">{book.publication_year || 'N/A'}</p>
              </div>
            </div>

            {book.current_shelf && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
                <MapPin className="text-green-600" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Current Location</p>
                  <p className="font-semibold text-green-700">Shelf {book.current_shelf}</p>
                </div>
              </div>
            )}

            <button onClick={handleNavigate} className="btn btn-primary">
              <Compass size={20} className="inline mr-2" />
              Get Directions
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Instructions */}
      {navigation && (
        <div className="card bg-primary-50 border border-primary-200">
          <div className="flex items-start gap-3">
            <Compass className="text-primary-600 flex-shrink-0 mt-1" size={24} />
            <div>
              <h3 className="font-bold text-lg mb-2">Navigation Instructions</h3>
              <p className="text-gray-700 mb-3">{navigation.directions}</p>
              {navigation.beacon && (
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Beacon UUID</p>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">{navigation.beacon.uuid}</code>
                  <p className="text-xs text-gray-500 mt-2">Zone: {navigation.beacon.zone}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RFID Tag */}
      {book.rfid_tag && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold">RFID Tag</h2>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Tag ID</p>
            <code className="text-sm bg-white px-3 py-2 rounded border">{book.rfid_tag}</code>
          </div>
        </div>
      )}

      {/* Location History */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="text-primary-600" size={20} />
          <h2 className="text-xl font-bold">Location History</h2>
        </div>
        {locationHistory.length > 0 ? (
          <div className="space-y-3">
            {locationHistory.map((entry, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                <div className="flex-1">
                  <p className="font-medium">Shelf {entry.shelf_code}</p>
                  <p className="text-sm text-gray-600">Scanned by: {entry.scanner_type} reader</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{format(new Date(entry.timestamp), 'MMM dd, yyyy')}</p>
                  <p className="text-xs text-gray-500">{format(new Date(entry.timestamp), 'h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No location history available</p>
        )}
      </div>
    </div>
  );
};

export default BookDetails;

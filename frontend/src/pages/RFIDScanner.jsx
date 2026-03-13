import React, { useState, useEffect } from 'react';
import { rfidService, shelfService } from '../services';
import { useMode } from '../contexts';
import { Scan, Tag, MapPin, CheckCircle, AlertCircle } from 'lucide-react';

const RFIDScanner = () => {
  const { isDemoMode } = useMode();
  const [shelves, setShelves] = useState([]);
  const [scanData, setScanData] = useState({
    tagId: '',
    readerId: '',
    shelfId: '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadShelves();
  }, []);

  const loadShelves = async () => {
    try {
      const response = await shelfService.listShelves();
      setShelves(response.shelves || []);
    } catch (error) {
      console.error('Failed to load shelves:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        tagId: scanData.tagId,
      };

      if (isDemoMode) {
        payload.shelfId = parseInt(scanData.shelfId, 10);
      } else {
        payload.readerId = parseInt(scanData.readerId, 10);
      }

      const response = await rfidService.scanTag(payload);
      setResult({ success: true, data: response });
      
      // Reset tag_id but keep reader/shelf selection
      setScanData({
        ...scanData,
        tagId: '',
      });
    } catch (error) {
      setResult({ 
        success: false, 
        error: error.response?.data?.message || 'Failed to scan tag' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Info */}
      <div className={`card ${isDemoMode ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-start gap-3">
          <Scan className={isDemoMode ? 'text-yellow-600' : 'text-green-600'} size={24} />
          <div>
            <h3 className="font-bold mb-1">
              {isDemoMode ? 'DEMO Mode - Handheld Reader' : 'PRODUCTION Mode - Fixed Reader'}
            </h3>
            <p className="text-sm text-gray-700">
              {isDemoMode
                ? 'In DEMO mode, you manually select the shelf where the book is located after scanning the RFID tag.'
                : 'In PRODUCTION mode, the system automatically determines the book location based on which fixed reader detected the tag.'}
            </p>
          </div>
        </div>
      </div>

      {/* Scanner Form */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">RFID Tag Scanner</h2>

        {result && (
          <div className={`mb-4 p-4 rounded-lg flex items-start gap-3 ${
            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {result.success ? (
              <>
                <CheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-green-800 mb-1">Scan successful!</p>
                  <p className="text-sm text-green-700">
                    Book: <strong>{result.data.book?.title}</strong>
                  </p>
                  <p className="text-sm text-green-700">
                    Location: <strong>Shelf {result.data.location?.shelfCode}</strong>
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-red-700">{result.error}</p>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Tag size={16} className="inline mr-1" />
              RFID Tag ID
            </label>
            <input
              type="text"
              className="input"
              placeholder="RFID-000001"
              value={scanData.tagId}
              onChange={(e) => setScanData({ ...scanData, tagId: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Sample IDs: RFID-000001, RFID-000002, RFID-000003
            </p>
          </div>

          {isDemoMode ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin size={16} className="inline mr-1" />
                Select Shelf Location
              </label>
              <select
                className="input"
                value={scanData.shelfId}
                onChange={(e) => setScanData({ ...scanData, shelfId: e.target.value })}
                required
              >
                <option value="">Choose a shelf...</option>
                {shelves.map((shelf) => (
                  <option key={shelf.id} value={shelf.id}>
                    {shelf.shelfCode} - {shelf.section} ({shelf.floor})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Manually specify where you found the book
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Scan size={16} className="inline mr-1" />
                Reader ID
              </label>
              <input
                type="number"
                className="input"
                placeholder="2"
                value={scanData.readerId}
                onChange={(e) => setScanData({ ...scanData, readerId: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Fixed reader IDs: 2-16 (Reader 1 is handheld)
              </p>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            <Scan size={20} className="inline mr-2" />
            {loading ? 'Scanning...' : 'Scan Tag'}
          </button>
        </form>
      </div>

      {/* Quick Reference */}
      <div className="card bg-gray-50">
        <h3 className="font-bold mb-3">Quick Reference</h3>
        <div className="space-y-2 text-sm">
          <p><strong>Sample RFID Tags:</strong></p>
          <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
              <li>RFID-000001 → "The Great Gatsby"</li>
              <li>RFID-000002 → "To Kill a Mockingbird"</li>
              <li>RFID-000003 → "1984"</li>
              <li>RFID-000004 → "Pride and Prejudice"</li>
          </ul>
          {!isDemoMode && (
            <>
              <p className="mt-3"><strong>Sample Reader IDs:</strong></p>
              <ul className="list-disc list-inside text-gray-700 space-y-1 ml-2">
                <li>Reader 2 → Shelf A1</li>
                <li>Reader 3 → Shelf A2</li>
                <li>Reader 4 → Shelf A3</li>
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RFIDScanner;

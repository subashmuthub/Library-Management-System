import React, { useState } from 'react';
import { 
  bookService, 
  transactionService, 
  fineService, 
  reservationService,
  userManagementService 
} from '../services';

const APITest = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const testEndpoint = async (name, testFn) => {
    setLoading(prev => ({ ...prev, [name]: true }));
    try {
      const result = await testFn();
      setResults(prev => ({ ...prev, [name]: { success: true, data: result } }));
    } catch (error) {
      setResults(prev => ({ ...prev, [name]: { success: false, error: error.message } }));
    } finally {
      setLoading(prev => ({ ...prev, [name]: false }));
    }
  };

  const tests = [
    {
      category: 'Books',
      items: [
        { name: 'Get All Books', fn: () => bookService.getAllBooks({ limit: 5 }) },
        { name: 'Search Books', fn: () => bookService.searchBooks({ q: 'Harry', limit: 5 }) },
        { name: 'Get Book by ID', fn: () => bookService.getBookById(1) },
        { name: 'Get Categories', fn: () => bookService.getCategories() },
      ]
    },
    {
      category: 'Transactions',
      items: [
        { name: 'Checkout Book', fn: () => transactionService.checkoutBook({ user_id: 4, book_id: 3, loan_days: 14 }) },
        { name: 'Get All Transactions', fn: () => transactionService.getAllTransactions({ limit: 5 }) },
        { name: 'Get User Checkouts', fn: () => transactionService.getUserCheckouts(4) },
        { name: 'Get Overdue Books', fn: () => transactionService.getOverdueBooks() },
      ]
    },
    {
      category: 'Fines',
      items: [
        { name: 'Get Pending Fines', fn: () => fineService.getPendingFines({ limit: 5 }) },
        { name: 'Get User Fines', fn: () => fineService.getPendingFines({ user_id: 4 }) },
      ]
    },
    {
      category: 'Reservations',
      items: [
        { name: 'Get All Reservations', fn: () => reservationService.getAllReservations({ limit: 5 }) },
        { name: 'Get User Reservations', fn: () => reservationService.getUserReservations(4) },
      ]
    },
    {
      category: 'Users',
      items: [
        { name: 'Get All Users', fn: () => userManagementService.getAllUsers({ limit: 5 }) },
        { name: 'Get User Details', fn: () => userManagementService.getUserDetails(4) },
      ]
    }
  ];

  const TestButton = ({ test }) => (
    <button
      onClick={() => testEndpoint(test.name, test.fn)}
      disabled={loading[test.name]}
      className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
        results[test.name]?.success 
          ? 'bg-green-100 text-green-700 hover:bg-green-200'
          : results[test.name]?.success === false
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
      }`}
    >
      {loading[test.name] ? '⏳ Testing...' : test.name}
      {results[test.name]?.success && ' ✅'}
      {results[test.name]?.success === false && ' ❌'}
    </button>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="card">
        <h1 className="text-2xl font-bold mb-4">🧪 API Testing Dashboard</h1>
        <p className="text-gray-600 mb-6">
          Test all library CRUD operations. Click any button to test that endpoint.
        </p>

        {tests.map(category => (
          <div key={category.category} className="mb-6">
            <h2 className="text-xl font-semibold mb-3">{category.category}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {category.items.map(test => (
                <TestButton key={test.name} test={test} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Results Display */}
      <div className="card">
        <h2 className="text-xl font-bold mb-4">Test Results</h2>
        <div className="space-y-4">
          {Object.entries(results).map(([name, result]) => (
            <div key={name} className="border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{name}</h3>
                <span className={`text-sm px-2 py-1 rounded ${
                  result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {result.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(result.success ? result.data : result.error, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default APITest;

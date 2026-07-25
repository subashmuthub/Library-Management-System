import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Search size={40} className="text-blue-600" />
        </div>
        
        <h1 className="text-6xl font-black text-gray-900 mb-4 tracking-tight">404</h1>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-3">
          Page not found
        </h2>
        
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you are looking for might have been removed, had its name changed,
          or is temporarily unavailable.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button 
            onClick={() => window.history.back()}
            className="btn btn-secondary w-full sm:w-auto"
          >
            <ArrowLeft size={16} />
            Go Back
          </button>
          
          <Link to="/dashboard" className="btn btn-primary w-full sm:w-auto">
            <Home size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

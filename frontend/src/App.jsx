import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, ModeProvider } from './contexts';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookDetails from './pages/BookDetails';
import EntryLog from './pages/EntryLog';
import RFIDScanner from './pages/RFIDScanner';
import Navigation from './pages/Navigation';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ModeProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Layout />
                </PrivateRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="books" element={<Books />} />
              <Route path="books/:id" element={<BookDetails />} />
              <Route path="entry" element={<EntryLog />} />
              <Route path="rfid" element={<RFIDScanner />} />
              <Route path="navigation" element={<Navigation />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ModeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;

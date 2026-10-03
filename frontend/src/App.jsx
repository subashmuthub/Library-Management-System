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
import BookSearch from './pages/BookSearch';
import Transactions from './pages/Transactions';
import Fines from './pages/Fines';
import Reservations from './pages/Reservations';
import UserManagement from './pages/UserManagement';
import EntryLog from './pages/EntryLog';
import RFIDScanner from './pages/RFIDScanner';
import Navigation from './pages/Navigation';
import Profile from './pages/Profile';
import StudentVisualization from './pages/StudentVisualization';
import BookOrderDetails from './pages/BookOrderDetails';
import QuestionPaperLibrary from './pages/QuestionPaperLibrary';
import Settings from './pages/Settings';
import BookRecommendations from './pages/BookRecommendations';
import LibraryHeatmap from './pages/LibraryHeatmap';
import OverduePrediction from './pages/OverduePrediction';
import ShelfLocator from './pages/ShelfLocator';
import ActiveUserCertificate from './pages/ActiveUserCertificate';
import BookSuggestions from './pages/BookSuggestions';
import PendingRequestsDashboard from './pages/PendingRequestsDashboard';
import ClerkIssueDesk from './pages/ClerkIssueDesk';
import HomePage from './pages/HomePage';

function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <AuthProvider>
        <ModeProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="books" element={<Books />} />
              <Route path="books/:id" element={<BookDetails />} />
              <Route path="book-search" element={<BookSearch />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="issue-desk" element={<PrivateRoute roles={["admin", "librarian", "clerk"]}><ClerkIssueDesk /></PrivateRoute>} />
              <Route path="fines" element={<Fines />} />
              <Route path="reservations" element={<Reservations />} />
              <Route path="reservations/pending" element={<PrivateRoute roles={["admin", "librarian"]}><PendingRequestsDashboard /></PrivateRoute>} />
              <Route path="users" element={<PrivateRoute roles={["admin", "librarian"]}><UserManagement /></PrivateRoute>} />
              <Route path="entry" element={<EntryLog />} />
              <Route path="rfid" element={<RFIDScanner />} />
              <Route path="navigation" element={<Navigation />} />
              <Route path="student-visualization" element={<PrivateRoute roles={["admin", "librarian"]}><StudentVisualization /></PrivateRoute>} />
              <Route path="book-orders" element={<PrivateRoute roles={["admin"]}><BookOrderDetails /></PrivateRoute>} />
              <Route path="question-papers" element={<QuestionPaperLibrary />} />
              <Route path="recommendations" element={<BookRecommendations />} />
              <Route path="heatmap" element={<PrivateRoute roles={["admin", "librarian"]}><LibraryHeatmap /></PrivateRoute>} />
              <Route path="overdue-prediction" element={<PrivateRoute roles={["admin", "librarian"]}><OverduePrediction /></PrivateRoute>} />
              <Route path="shelf-locator" element={<ShelfLocator />} />
              <Route path="suggestions" element={<BookSuggestions />} />
              <Route path="settings" element={<PrivateRoute roles={["admin", "librarian"]}><Settings /></PrivateRoute>} />
              <Route path="profile" element={<Profile />} />
              <Route path="active-user-certificate" element={<PrivateRoute roles={["admin", "librarian"]}><ActiveUserCertificate /></PrivateRoute>} />
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

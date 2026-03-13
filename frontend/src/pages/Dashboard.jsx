import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts";
import { entryService, bookService } from "../services";
import { Users, BookOpen, Clock, TrendingUp, Activity } from "lucide-react";
import { format } from "date-fns";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    occupancy: 0,
    recentEntries: [],
    recentBooks: [],
    totalBooks: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      const [occupancyData, historyData, booksData] = await Promise.all([
        entryService.getCurrentOccupancy().catch((err) => {
          return { current_occupancy: 0 };
        }),
        entryService.getMyHistory(user?.id || 4).catch((err) => {
          return { entries: [] };
        }),
        bookService.getAllBooks({ limit: 5 }).catch((err) => {
          return { data: { books: [] } };
        }),
      ]);

      setStats({
        occupancy: occupancyData.current_occupancy || 0,
        recentEntries: historyData.entries?.slice(0, 5) || [],
        recentBooks: booksData.data?.books || booksData.books || [],
        totalBooks:
          booksData.data?.pagination?.totalBooks ||
          booksData.data?.books?.length ||
          0,
      });
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="card hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${color} shadow-sm`}
        >
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="card bg-gradient-to-r from-primary-500 via-primary-600 to-primary-700 text-white border-0 shadow-lg">
        <h1 className="text-2xl font-bold mb-2 tracking-tight">Welcome back, {user?.name}!</h1>
        <p className="text-primary-100 text-sm md:text-base">
          {user?.role === "student"
            ? "Ready to explore our library collection?"
            : "Here's your library overview for today."}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Current Occupancy"
          value={stats.occupancy}
          color="bg-blue-500"
        />
        <StatCard
          icon={BookOpen}
          label="Books in Library"
          value={stats.totalBooks.toLocaleString()}
          color="bg-green-500"
        />
        <StatCard
          icon={Clock}
          label="Your Visits"
          value={stats.recentEntries.length}
          color="bg-purple-500"
        />
        <StatCard
          icon={TrendingUp}
          label="Active Today"
          value={stats.occupancy}
          color="bg-orange-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Entry History */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold tracking-tight">Recent Activity</h2>
          </div>
          {stats.recentEntries.length > 0 ? (
            <div className="space-y-3">
              {stats.recentEntries.map((entry, index) => (
                <div
                  key={entry.id || index}
                  className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl"
                >
                  <div>
                    <p className="font-medium capitalize">
                      {entry.entry_type || "Activity"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {entry.confidence_score
                        ? `Confidence: ${entry.confidence_score}%`
                        : entry.auto_logged
                          ? "Auto-logged"
                          : "Manual"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-600">
                      {format(new Date(entry.timestamp), "MMM dd, yyyy")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(entry.timestamp), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No recent activity</p>
          )}
        </div>

        {/* Recently Added Books */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="text-primary-600" size={20} />
            <h2 className="text-xl font-bold tracking-tight">Available Books</h2>
          </div>
          {stats.recentBooks.length > 0 ? (
            <div className="space-y-3">
              {stats.recentBooks.map((book) => (
                <div
                  key={book.id}
                  className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-12 h-16 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                    <BookOpen size={20} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{book.title}</p>
                    <p className="text-sm text-slate-600 truncate">
                      {book.author}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded">
                      {book.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No books available</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-bold tracking-tight mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            className="btn btn-primary py-4"
            onClick={() => navigate("/book-search")}
          >
            <BookOpen size={20} className="inline mb-1" />
            <br />
            Search Books
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/entry")}
          >
            <Clock size={20} className="inline mb-1" />
            <br />
            Log Entry
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/rfid")}
          >
            <Activity size={20} className="inline mb-1" />
            <br />
            Scan RFID
          </button>
          <button
            className="btn btn-secondary py-4"
            onClick={() => navigate("/navigation")}
          >
            <TrendingUp size={20} className="inline mb-1" />
            <br />
            Navigate
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { bookService } from "../services";
import {
  Search,
  BookOpen,
  Filter,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Upload,
  Download,
  SortAsc,
  SortDesc,
  Eye,
  Star,
  Clock,
  TrendingUp,
  Grid,
  List,
  CheckCircle,
  XCircle,
} from "lucide-react";
import ExcelJS from "exceljs";

const downloadBufferAsFile = (buffer, filename) => {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const parseCsvRows = (text) => {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((item) => item.some((cell) => String(cell).trim() !== ""));
};

const rowsToObjects = (rows) => {
  if (!rows.length) return [];

  const [headers, ...bodyRows] = rows;
  const normalizedHeaders = headers.map((header) =>
    String(header || "").trim(),
  );

  return bodyRows
    .map((values) => {
      const record = {};
      normalizedHeaders.forEach((header, headerIndex) => {
        if (!header) return;
        record[header] = values[headerIndex] ?? "";
      });
      return record;
    })
    .filter((record) =>
      Object.values(record).some((value) => String(value).trim() !== ""),
    );
};

const Books = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryStats, setCategoryStats] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({
    category: "",
    available: "",
  });

  // Department categories
  const departmentCategories = [
    { code: "CSE", name: "Computer Science & Engineering" },
    { code: "EEE", name: "Electrical & Electronics Engineering" },
    { code: "ECE", name: "Electronics & Communication Engineering" },
    { code: "MECH", name: "Mechanical Engineering" },
    { code: "AIDS", name: "Artificial Intelligence & Data Science" },
    { code: "S&H", name: "Science & Humanities" },
  ];

  // Modal states for CRUD operations
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    type: "book", // book or journal
    category: "",
    publisher: "",
    publication_year: "",
    total_copies: 1,
  });

  // Import states
  const [importFile, setImportFile] = useState(null);
  const [importData, setImportData] = useState([]);
  const [importResults, setImportResults] = useState(null);

  // New feature states - persist viewMode in localStorage
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem("booksViewMode");
    return saved || "grid";
  }); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState("title");
  const [sortOrder, setSortOrder] = useState("asc");
  const [favorites, setFavorites] = useState(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  // Save viewMode preference
  useEffect(() => {
    localStorage.setItem("booksViewMode", viewMode);
    console.log("View mode changed to:", viewMode);
  }, [viewMode]);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      author: "",
      isbn: "",
      type: "book",
      category: "",
      publisher: "",
      publication_year: "",
      total_copies: 1,
    });
    setEditingBook(null);
  };

  useEffect(() => {
    loadBooks();
    loadCategoryStats();
  }, []);

  useEffect(() => {
    loadBooks();
  }, [searchTerm, filters.category, filters.available, sortBy, sortOrder]);

  const loadBooks = async () => {
    setLoading(true);
    try {
      const params = {
        q: searchTerm || undefined,
        category: filters.category || undefined,
        availability: filters.available || undefined,
        limit: 100,
        sortBy: sortBy,
        sortOrder: sortOrder,
      };
      const response = await bookService.getAllBooks(params);
      let booksData = response.data?.books || response.books || [];

      // Client-side filtering for availability if not filtered by backend
      if (filters.available) {
        if (filters.available === "available") {
          booksData = booksData.filter(
            (book) => book.is_available === 1 || book.is_available === true,
          );
        } else if (filters.available === "in-use") {
          booksData = booksData.filter(
            (book) => book.is_available === 0 || book.is_available === false,
          );
        }
      }

      // Apply client-side sorting if needed
      booksData.sort((a, b) => {
        let aVal = a[sortBy]?.toString().toLowerCase() || "";
        let bVal = b[sortBy]?.toString().toLowerCase() || "";

        if (sortBy === "publication_year") {
          aVal = parseInt(a[sortBy]) || 0;
          bVal = parseInt(b[sortBy]) || 0;
        }

        if (sortOrder === "desc") {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      });

      setBooks(booksData);
      setTotalCount(response.data?.pagination?.totalBooks || booksData.length);
    } catch (error) {
      console.error("Failed to load books:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryStats = async () => {
    try {
      const response = await bookService.getCategories();
      setCategoryStats(response);
    } catch (error) {
      console.error("Failed to load category stats:", error);
    }
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    loadBooks();
  };

  // Quick search as user types (debounced)
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm || filters.category) {
        loadBooks();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, filters.category]);

  // Toggle favorite
  const toggleFavorite = (bookId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(bookId)) {
      newFavorites.delete(bookId);
    } else {
      newFavorites.add(bookId);
    }
    setFavorites(newFavorites);
    localStorage.setItem("bookFavorites", JSON.stringify([...newFavorites]));
  };

  // Add to recently viewed
  const addToRecentlyViewed = (book) => {
    const updated = [
      book,
      ...recentlyViewed.filter((b) => b.id !== book.id),
    ].slice(0, 5);
    setRecentlyViewed(updated);
    localStorage.setItem("recentlyViewed", JSON.stringify(updated));
  };

  // Load saved data on mount
  useEffect(() => {
    const savedFavorites = localStorage.getItem("bookFavorites");
    const savedRecentlyViewed = localStorage.getItem("recentlyViewed");

    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
    if (savedRecentlyViewed) {
      setRecentlyViewed(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Export books to Excel
  const handleExportBooks = async () => {
    const exportData = books.map((book) => ({
      Title: book.title,
      Author: book.author,
      ISBN: book.isbn,
      Category: book.category,
      Publisher: book.publisher || "",
      "Publication Year": book.publication_year || "",
      "Total Copies": book.total_copies || 1,
      Status: book.is_available ? "Available" : "In Use",
    }));

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Books Export");

      worksheet.columns = [
        { header: "Title", key: "Title", width: 30 },
        { header: "Author", key: "Author", width: 24 },
        { header: "ISBN", key: "ISBN", width: 20 },
        { header: "Category", key: "Category", width: 18 },
        { header: "Publisher", key: "Publisher", width: 24 },
        { header: "Publication Year", key: "Publication Year", width: 18 },
        { header: "Total Copies", key: "Total Copies", width: 14 },
        { header: "Status", key: "Status", width: 14 },
      ];

      exportData.forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBufferAsFile(
        buffer,
        `books_export_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (error) {
      alert(`Failed to export books: ${error.message}`);
    }
  };

  // CRUD Operations
  const handleAddBook = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditBook = (book) => {
    setFormData({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      type: book.type || "book",
      category: book.category,
      publisher: book.publisher || "",
      publication_year: book.publication_year || "",
      total_copies: book.total_copies || 1,
    });
    setEditingBook(book);
    setShowModal(true);
  };

  const handleDeleteBook = async (bookId) => {
    if (!window.confirm("Are you sure you want to delete this book?")) return;

    try {
      await bookService.deleteBook(bookId);
      alert("Book deleted successfully!");
      loadBooks();
    } catch (error) {
      console.error("Failed to delete book:", error);
      alert(
        "Failed to delete book: " +
          (error.response?.data?.message || error.message),
      );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingBook) {
        await bookService.updateBook(editingBook.id, formData);
        alert("Book updated successfully!");
      } else {
        await bookService.addBook(formData);
        alert("Book added successfully!");
      }
      setShowModal(false);
      resetForm();
      loadBooks();
    } catch (error) {
      console.error("Failed to save book:", error);
      alert(
        "Failed to save book: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  // Download template for bulk import
  const handleDownloadTemplate = async () => {
    const template = [
      {
        title: "Example Book Title",
        author: "Author Name",
        isbn: "978-0123456789",
        category: "CSE",
        publisher: "Publisher Name",
        publication_year: "2024",
        total_copies: "1",
        edition: "1st Edition",
        language: "English",
        pages: "250",
        description: "Book description here",
        cover_image_url: "https://example.com/image.jpg",
      },
    ];

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Books Template");

      worksheet.columns = [
        { header: "title", key: "title", width: 30 },
        { header: "author", key: "author", width: 20 },
        { header: "isbn", key: "isbn", width: 18 },
        { header: "category", key: "category", width: 16 },
        { header: "publisher", key: "publisher", width: 22 },
        { header: "publication_year", key: "publication_year", width: 16 },
        { header: "total_copies", key: "total_copies", width: 14 },
        { header: "edition", key: "edition", width: 16 },
        { header: "language", key: "language", width: 12 },
        { header: "pages", key: "pages", width: 10 },
        { header: "description", key: "description", width: 40 },
        { header: "cover_image_url", key: "cover_image_url", width: 40 },
      ];

      template.forEach((row) => worksheet.addRow(row));

      const buffer = await workbook.xlsx.writeBuffer();
      downloadBufferAsFile(buffer, "books_import_template.xlsx");
    } catch (error) {
      alert(`Failed to download template: ${error.message}`);
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const extension = file.name.split(".").pop()?.toLowerCase();

        if (extension === "csv") {
          const text = evt.target.result;
          const rows = parseCsvRows(String(text || ""));
          const parsed = rowsToObjects(rows);
          setImportData(parsed);
          return;
        }

        if (extension !== "xlsx") {
          throw new Error("Only .xlsx and .csv files are supported.");
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(evt.target.result);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          throw new Error("No worksheet found in file.");
        }

        const rows = [];
        worksheet.eachRow((row) => {
          rows.push(row.values.slice(1));
        });

        const parsed = rowsToObjects(rows);
        setImportData(parsed);
      } catch (error) {
        alert(`Error reading file: ${error.message}`);
      }
    };

    if (file.name.toLowerCase().endsWith(".csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  // Handle bulk import
  const handleBulkImport = async () => {
    if (!importData || importData.length === 0) {
      alert("Please select a valid file with book data");
      return;
    }

    setLoading(true);
    try {
      const sanitizedImportData = importData.map((row) => {
        const sanitized = { ...row };
        delete sanitized.id;
        delete sanitized.ID;
        delete sanitized.book_id;
        delete sanitized.transaction_id;
        return sanitized;
      });

      const response = await bookService.bulkImportBooks(sanitizedImportData);
      setImportResults(response);

      if (response.summary.failed === 0) {
        alert(`Successfully imported ${response.summary.success} books!`);
        setShowImportModal(false);
        setImportFile(null);
        setImportData([]);
        loadBooks();
      } else {
        alert(
          `Import completed: ${response.summary.success} successful, ${response.summary.failed} failed. Check details below.`,
        );
      }
    } catch (error) {
      console.error("Failed to import books:", error);
      alert(
        "Failed to import books: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm("");
    setFilters({ category: "", available: "" });
  };

  const handleOpenImportModal = () => {
    setShowImportModal(true);
    setImportFile(null);
    setImportData([]);
    setImportResults(null);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="card bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Books Management</h1>
            <p className="text-blue-100 text-sm">
              Manage your library collection, search books, and track
              availability
            </p>
          </div>
          <BookOpen size={40} className="text-blue-200 opacity-80" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="flex gap-3 items-start">
          {/* Search Input */}
          <div className="flex-1">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search by title, author, or description..."
                className="input pl-10 pr-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch(e)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Filter Dropdowns */}
          <select
            className="input w-64"
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
          >
            <option value="">All Departments</option>
            {departmentCategories.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.code} - {dept.name}
              </option>
            ))}
          </select>

          <select
            className="input w-48"
            value={filters.available}
            onChange={(e) =>
              setFilters({ ...filters, available: e.target.value })
            }
          >
            <option value="">All Status</option>
            <option value="available">✅ Available Only</option>
            <option value="in-use">🔴 In Use Only</option>
          </select>

          {/* Clear Button */}
          {(searchTerm || filters.category || filters.available) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-secondary px-4 whitespace-nowrap"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Category Statistics */}
      <div className="card">
        <h3 className="text-base font-semibold mb-3 text-gray-900">
          Books by Department
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2">
          <div className="bg-blue-50 rounded-lg p-3 text-center min-w-[100px] flex-shrink-0 border border-blue-100">
            <div className="text-2xl font-bold text-blue-900">{totalCount}</div>
            <div className="text-xs text-blue-700 font-medium">Total Books</div>
          </div>
          {departmentCategories.map((dept) => {
            const stat = categoryStats.find((s) => s.name === dept.code);
            const count = stat?.count || 0;
            return (
              <div
                key={dept.code}
                className={`rounded-lg p-3 text-center cursor-pointer transition-all min-w-[100px] flex-shrink-0 border ${
                  filters.category === dept.code
                    ? "bg-primary-100 border-2 border-primary-500 shadow-md"
                    : "bg-gray-50 hover:bg-gray-100 border-gray-200 hover:border-gray-300"
                }`}
                onClick={() =>
                  setFilters({
                    ...filters,
                    category: filters.category === dept.code ? "" : dept.code,
                  })
                }
              >
                <div className="text-xl font-bold text-gray-900">{count}</div>
                <div className="text-xs font-semibold text-gray-700">
                  {dept.code}
                </div>
                <div className="text-[10px] text-gray-500 leading-tight mt-0.5">
                  {dept.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Results */}
      <div className="card">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {searchTerm
                ? `Search Results for "${searchTerm}"`
                : filters.category
                  ? `${filters.category} Department Books`
                  : "All Books"}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {books.length} books displayed{" "}
              {totalCount !== books.length && `of ${totalCount} total`}
            </p>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handleAddBook}
            className="btn btn-primary flex items-center gap-2 px-6 py-2.5 shadow-md hover:shadow-lg transition-shadow"
          >
            <Plus size={18} />
            Add Book
          </button>
        </div>

        {/* Controls Bar */}
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          {/* Left Side - View Controls */}
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden shadow-sm bg-white">
              <button
                onClick={() => {
                  console.log("Switching to grid view");
                  setViewMode("grid");
                }}
                className={`p-2 transition-all duration-200 ${
                  viewMode === "grid"
                    ? "bg-primary-500 text-white shadow-inner"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                title="Grid View"
              >
                <Grid size={18} strokeWidth={viewMode === "grid" ? 2.5 : 2} />
              </button>
              <button
                onClick={() => {
                  console.log("Switching to list view");
                  setViewMode("list");
                }}
                className={`p-2 border-l border-gray-300 transition-all duration-200 ${
                  viewMode === "list"
                    ? "bg-primary-500 text-white shadow-inner"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
                title="List View"
              >
                <List size={18} strokeWidth={viewMode === "list" ? 2.5 : 2} />
              </button>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg overflow-hidden bg-white">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 text-sm border-0 outline-none focus:ring-0 bg-transparent cursor-pointer"
              >
                <option value="title">Sort by Title</option>
                <option value="author">Sort by Author</option>
                <option value="category">Sort by Department</option>
                <option value="publication_year">Sort by Year</option>
                <option value="created_at">Sort by Added Date</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="px-3 py-2 border-l border-gray-300 hover:bg-gray-50 transition-colors"
                title={`Sort ${sortOrder === "asc" ? "Descending" : "Ascending"}`}
              >
                {sortOrder === "asc" ? (
                  <SortAsc size={16} />
                ) : (
                  <SortDesc size={16} />
                )}
              </button>
            </div>
          </div>

          {/* Right Side - Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportBooks}
              className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2 px-4 py-2"
              title="Export to Excel"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={handleOpenImportModal}
              className="btn bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 px-4 py-2"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading books...</div>
          </div>
        ) : books.length > 0 ? (
          <>
            {/* Recently Viewed Section */}
            {recentlyViewed.length > 0 && (
              <div className="mb-5 pb-5 border-b border-gray-200">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-gray-600" />
                  <h3 className="text-sm font-semibold text-gray-900">
                    Recently Viewed
                  </h3>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {recentlyViewed.map((book) => (
                    <div
                      key={`recent-${book.id}`}
                      className="min-w-[180px] bg-gray-50 rounded-lg p-2.5 flex-shrink-0 border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                    >
                      <h4 className="font-semibold text-sm truncate text-gray-900">
                        {book.title}
                      </h4>
                      <p className="text-xs text-gray-600 truncate mt-0.5">
                        {book.author}
                      </p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded font-medium">
                        {book.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Books Grid/List */}
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="block p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all relative"
                  >
                    {/* Favorite Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFavorite(book.id);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <Star
                        size={16}
                        className={
                          favorites.has(book.id)
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-gray-400"
                        }
                      />
                    </button>

                    <Link
                      to={`/books/${book.id}`}
                      className="block mb-3"
                      onClick={() => addToRecentlyViewed(book)}
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-20 bg-primary-100 rounded flex items-center justify-center flex-shrink-0">
                          <BookOpen size={24} className="text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 truncate mb-1">
                            {book.title}
                          </h3>
                          <p className="text-sm text-gray-600 truncate mb-2">
                            {book.author}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-info text-xs">
                              {book.category}
                            </span>
                            {book.is_available ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                <CheckCircle size={12} className="mr-1" />
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                <XCircle size={12} className="mr-1" />
                                In Use
                              </span>
                            )}
                            {book.current_shelf && (
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                <MapPin size={12} />
                                {book.current_shelf}
                              </span>
                            )}
                          </div>
                          {book.publication_year && (
                            <div className="text-xs text-gray-500 mt-1">
                              Published: {book.publication_year}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleEditBook(book);
                        }}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center gap-1 text-xs px-3 py-1 rounded border border-blue-200"
                      >
                        <Edit size={14} />
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          handleDeleteBook(book.id);
                        }}
                        className="bg-red-50 hover:bg-red-100 text-red-600 flex items-center gap-1 text-xs px-3 py-1 rounded border border-red-200"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="py-4 flex items-center justify-between hover:bg-gray-50 px-4 rounded transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-16 bg-primary-100 rounded flex items-center justify-center">
                        <BookOpen size={20} className="text-primary-600" />
                      </div>
                      <div className="flex-1">
                        <Link
                          to={`/books/${book.id}`}
                          onClick={() => addToRecentlyViewed(book)}
                          className="block"
                        >
                          <h3 className="font-semibold text-gray-900 hover:text-primary-600">
                            {book.title}
                          </h3>
                          <p className="text-sm text-gray-600">{book.author}</p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="badge badge-info text-xs">
                              {book.category}
                            </span>
                            {book.is_available ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                <CheckCircle size={12} className="mr-1" />
                                Available
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                <XCircle size={12} className="mr-1" />
                                In Use
                              </span>
                            )}
                            {book.publication_year && (
                              <span className="text-xs text-gray-500">
                                Published: {book.publication_year}
                              </span>
                            )}
                            {book.isbn && (
                              <span className="text-xs text-gray-500">
                                ISBN: {book.isbn}
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFavorite(book.id)}
                        className="p-2 rounded-full hover:bg-gray-100"
                      >
                        <Star
                          size={16}
                          className={
                            favorites.has(book.id)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-400"
                          }
                        />
                      </button>
                      <button
                        onClick={() => handleEditBook(book)}
                        className="p-2 rounded-full hover:bg-blue-100 text-blue-600"
                        title="Edit Book"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="p-2 rounded-full hover:bg-red-100 text-red-600"
                        title="Delete Book"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">
              {searchTerm
                ? "No books found matching your search"
                : "No books available"}
            </p>
          </div>
        )}
      </div>

      {/* Add/Edit Book Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-xl font-bold mb-4">
              {editingBook ? "Edit Book/Journal" : "Add New Book/Journal"}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({ ...formData, type: e.target.value })
                    }
                    className="input"
                    required
                  >
                    <option value="book">📚 Book</option>
                    <option value="journal">📰 Journal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Author *
                  </label>
                  <input
                    type="text"
                    value={formData.author}
                    onChange={(e) =>
                      setFormData({ ...formData, author: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ISBN *
                  </label>
                  <input
                    type="text"
                    value={formData.isbn}
                    onChange={(e) =>
                      setFormData({ ...formData, isbn: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="input"
                    required
                  >
                    <option value="">Select Department</option>
                    {departmentCategories.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.code} - {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publisher
                  </label>
                  <input
                    type="text"
                    value={formData.publisher}
                    onChange={(e) =>
                      setFormData({ ...formData, publisher: e.target.value })
                    }
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Publication Year
                  </label>
                  <input
                    type="number"
                    value={formData.publication_year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        publication_year: e.target.value,
                      })
                    }
                    className="input"
                    min="1800"
                    max={new Date().getFullYear()}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Copies *
                  </label>
                  <input
                    type="number"
                    value={formData.total_copies}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        total_copies: parseInt(e.target.value),
                      })
                    }
                    className="input"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary flex-1"
                >
                  {loading
                    ? "Saving..."
                    : editingBook
                      ? "Update Book"
                      : "Add Book"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Books Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">
              Import Books from Spreadsheet
            </h3>

            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">
                  Instructions:
                </h4>
                <ul className="list-disc list-inside text-sm text-blue-800 space-y-1">
                  <li>Download the template file to see the required format</li>
                  <li>
                    Fill in your book data (required fields: title, author,
                    isbn, category, total_copies)
                  </li>
                  <li>Department categories: CSE, EEE, ECE, MECH, AIDS, S&H</li>
                  <li>
                    Optional fields: publisher, publication_year, edition,
                    language, pages, description, cover_image_url
                  </li>
                  <li>
                    Upload the completed file (Excel .xlsx or .xls, or CSV)
                  </li>
                  <li>Review the results and check for any errors</li>
                </ul>
              </div>

              {/* Download Template Button */}
              <div>
                <button
                  onClick={handleDownloadTemplate}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                >
                  <Download size={18} />
                  Download Template
                </button>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File to Import
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
                {importFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {importFile.name} ({importData.length} rows)
                  </p>
                )}
              </div>

              {/* Preview Data */}
              {importData.length > 0 && !importResults && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">
                    Preview ({importData.length} books)
                  </h4>
                  <div className="overflow-x-auto max-h-60 overflow-y-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">#</th>
                          <th className="px-3 py-2 text-left">Title</th>
                          <th className="px-3 py-2 text-left">Author</th>
                          <th className="px-3 py-2 text-left">ISBN</th>
                          <th className="px-3 py-2 text-left">Category</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importData.slice(0, 10).map((book, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">{book.title || "-"}</td>
                            <td className="px-3 py-2">{book.author || "-"}</td>
                            <td className="px-3 py-2">{book.isbn || "-"}</td>
                            <td className="px-3 py-2">
                              {book.category || "-"}
                            </td>
                          </tr>
                        ))}
                        {importData.length > 10 && (
                          <tr>
                            <td
                              colSpan="5"
                              className="px-3 py-2 text-center text-gray-500"
                            >
                              ... and {importData.length - 10} more
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Results */}
              {importResults && (
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">Import Results</h4>

                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-blue-50 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-blue-900">
                        {importResults.summary.total}
                      </div>
                      <div className="text-sm text-blue-700">Total</div>
                    </div>
                    <div className="bg-green-50 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-green-900">
                        {importResults.summary.success}
                      </div>
                      <div className="text-sm text-green-700">Success</div>
                    </div>
                    <div className="bg-red-50 rounded p-3 text-center">
                      <div className="text-2xl font-bold text-red-900">
                        {importResults.summary.failed}
                      </div>
                      <div className="text-sm text-red-700">Failed</div>
                    </div>
                  </div>

                  {/* Failed Records */}
                  {importResults.results.failed.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-semibold text-red-700 mb-2">
                        Failed Records:
                      </h5>
                      <div className="max-h-60 overflow-y-auto">
                        {importResults.results.failed.map((fail, idx) => (
                          <div
                            key={idx}
                            className="bg-red-50 border border-red-200 rounded p-2 mb-2 text-sm"
                          >
                            <div className="font-semibold">
                              Row {fail.row}: {fail.data?.title || "Unknown"}
                            </div>
                            <div className="text-red-700">{fail.error}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Success Records */}
                  {importResults.results.success.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-semibold text-green-700 mb-2">
                        Successfully Imported:
                      </h5>
                      <div className="max-h-40 overflow-y-auto text-sm">
                        {importResults.results.success
                          .slice(0, 5)
                          .map((success, idx) => (
                            <div key={idx} className="text-green-700">
                              ✓ {success.title} (ISBN: {success.isbn})
                            </div>
                          ))}
                        {importResults.results.success.length > 5 && (
                          <div className="text-green-600 mt-1">
                            ... and {importResults.results.success.length - 5}{" "}
                            more
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                {!importResults ? (
                  <>
                    <button
                      onClick={handleBulkImport}
                      disabled={loading || importData.length === 0}
                      className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading
                        ? "Importing..."
                        : `Import ${importData.length} Books`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                      setImportData([]);
                      setImportResults(null);
                    }}
                    className="btn btn-primary w-full"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Books;

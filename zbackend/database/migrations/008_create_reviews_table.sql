-- Migration: 008_create_reviews_table.sql
-- Create reviews table for student ratings and feedback

CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  user_id INT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  INDEX idx_reviews_book (book_id),
  INDEX idx_reviews_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

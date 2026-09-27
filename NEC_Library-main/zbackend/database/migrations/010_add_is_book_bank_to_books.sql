-- Migration: 010_add_is_book_bank_to_books.sql
-- Add is_book_bank column to books table for Book Bank scheme

ALTER TABLE books
ADD COLUMN is_book_bank BOOLEAN NOT NULL DEFAULT FALSE;

-- Migration: 011_book_bank_scheme.sql
-- Add Book Bank scheme support: community reservation, scheme naming, and loan tracking

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS community_category VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS is_book_bank_eligible BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE books 
  ADD COLUMN IF NOT EXISTS book_bank_scheme_name VARCHAR(100) NULL DEFAULT 'SC/ST Welfare Book Bank Scheme';

ALTER TABLE book_transactions 
  ADD COLUMN IF NOT EXISTS is_book_bank_loan BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE otp_challenges ADD COLUMN purpose TEXT NOT NULL DEFAULT 'customer' CHECK (purpose IN ('customer','staff'));

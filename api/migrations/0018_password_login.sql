-- Email + password sign-in (owner decision, 22 Nov 2026). The mobile number is still confirmed once on WhatsApp at registration.
-- password_hash: PBKDF2-SHA256 ("pbkdf2$<iterations>$<salt b64>$<hash b64>"); the password itself is never stored.
-- email_hash: HMAC of the lower-cased email with the server PEPPER, so an account can be found by email while the email stays encrypted.
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_set_at INTEGER;
ALTER TABLE users ADD COLUMN email_hash TEXT;
CREATE UNIQUE INDEX idx_users_email_hash ON users(email_hash) WHERE email_hash IS NOT NULL AND deleted_at IS NULL;

-- A retried upload (the response was lost on a bad connection) must not store the file twice.
-- The app sends its local file id as x-client-key; the same key on the same request returns the stored file.
ALTER TABLE request_files ADD COLUMN client_key TEXT;
CREATE UNIQUE INDEX idx_request_files_client_key ON request_files(request_id, client_key) WHERE client_key IS NOT NULL;

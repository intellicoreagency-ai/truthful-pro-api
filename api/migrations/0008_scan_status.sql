-- A missing scan result means "pending", never "clean". Only an explicit scanner verdict makes a file usable.
ALTER TABLE request_files ADD COLUMN scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected','error'));
ALTER TABLE request_files ADD COLUMN scan_engine TEXT;
ALTER TABLE request_files ADD COLUMN scanned_at INTEGER;

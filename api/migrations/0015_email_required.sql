-- The customer's email is essential contact data. The account row is created at the WhatsApp verification, before the email is
-- entered, so the column itself must stay nullable; the rule is enforced here at the database level instead:
-- 1) a request cannot leave "draft" (be submitted) for a customer who has no email,
-- 2) an email cannot be removed from a live account (only deleting the account clears it).
CREATE TRIGGER requests_need_email_update BEFORE UPDATE OF status ON requests
  WHEN OLD.status = 'draft' AND NEW.status != 'draft'
    AND (SELECT email_enc FROM users WHERE id = NEW.user_id) IS NULL
  BEGIN SELECT RAISE(ABORT, 'email_required'); END;
CREATE TRIGGER requests_need_email_insert BEFORE INSERT ON requests
  WHEN NEW.status != 'draft'
    AND (SELECT email_enc FROM users WHERE id = NEW.user_id) IS NULL
  BEGIN SELECT RAISE(ABORT, 'email_required'); END;
CREATE TRIGGER users_keep_email BEFORE UPDATE OF email_enc ON users
  WHEN OLD.email_enc IS NOT NULL AND NEW.email_enc IS NULL AND NEW.deleted_at IS NULL
  BEGIN SELECT RAISE(ABORT, 'email_required'); END;

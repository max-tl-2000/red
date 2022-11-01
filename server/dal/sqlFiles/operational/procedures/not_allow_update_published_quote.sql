CREATE OR REPLACE FUNCTION db_namespace.not_allow_update_published_quote()
RETURNS TRIGGER
AS $$
BEGIN
  IF OLD."publishDate" IS NOT NULL THEN
    RAISE EXCEPTION 'cannot update a published quote: %', NEW."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

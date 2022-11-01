CREATE OR REPLACE FUNCTION public.count_rows (p_schemaname TEXT, p_tablename TEXT) RETURNS INTEGER
AS
$body$
DECLARE
  result INTEGER;
  query VARCHAR;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = p_schemaname AND tablename = p_tablename) THEN
    BEGIN
      query := 'SELECT count(1) FROM "' || p_schemaname || '"."' || p_tablename || '"';
      EXECUTE query INTO result;
    RETURN result;
  END;
ELSE
  BEGIN
    SELECT -1 INTO RESULT;
    RETURN result;
  END;
END IF;
END;
$body$
LANGUAGE plpgsql;
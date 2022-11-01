DO $$
DECLARE tn text;
DECLARE trn text;
DECLARE stn text;
BEGIN
  FOR tn IN (SELECT DISTINCT(tables.table_name)
             FROM information_schema.tables tables
             INNER JOIN information_schema.columns columns on columns.table_name=tables.table_name
             WHERE tables.table_schema = REPLACE('db_namespace', '"', '')
             AND columns.column_name='updated_at'
             AND NOT EXISTS (SELECT 1
                             FROM pg_trigger
                             WHERE tgname = 'update_' || lower(tables.table_name) || '_updated_at_trg'
                             AND tgrelid = format('%s.%I', 'db_namespace', tables.table_name)::regclass
                            )
            )
  LOOP
    trn := 'update_' || lower(tn) || '_updated_at_trg';
    stn := format('%s.%I', 'db_namespace', tn);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();', trn, stn);
  END LOOP;
END$$;

CREATE OR REPLACE VIEW public.table_size_and_count
AS
SELECT
  t1.schemaname AS "SchemaName",
  t1.relname as "Table",
  pg_total_relation_size(relid) AS "RawSize",
  pg_total_relation_size(relid) - pg_relation_size(relid) as "RawExternalSize",
  count_rows(t1.schemaname, t1.relname) AS "RowCount",
  pg_size_pretty(pg_total_relation_size(relid)) As "Size",
  pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) as "ExternalSize"
FROM pg_catalog.pg_statio_user_tables as t1
  JOIN pg_catalog.pg_tables AS t2 ON t1.SCHEMANAME = t2.schemaname AND t1.relname = t2.tablename
WHERE t1.SCHEMANAME NOT IN ('pg_catalog','public','information_schema');
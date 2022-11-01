CREATE OR REPLACE FUNCTION db_namespace.update_last_load_date(tableName text, resultPrevInstr text, step text)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
IF step = 'intermediary' THEN
-- cancel all table loadings depending on d_Property
UPDATE db_namespace."s_LastLoadDate" AS upd
  SET "needToLoad" = FALSE
FROM db_namespace."s_LoadDependency" ld
WHERE ld."tableName" = upd."tableName"
  AND (ld."dependsOnTable" = tableName OR ld."tableName" = tableName) AND resultPrevInstr = 'Failure';
ELSE
-- set d_ContactInfo as loaded or cancel all table loadings depending on d_ContactInfo
UPDATE db_namespace."s_LastLoadDate" AS upd
  SET "needToLoad" =
        CASE
          WHEN resultPrevInstr = 'Failure' THEN FALSE
          WHEN resultPrevInstr = 'Success' AND upd."tableName" = tableName AND "needToLoad" = TRUE THEN FALSE
          ELSE TRUE
        END,
      "loadDate" =
        CASE
          WHEN resultPrevInstr = 'Success' AND upd."tableName" = tableName THEN now()
          ELSE "loadDate"
        END
FROM db_namespace."s_LoadDependency" ld
WHERE ld."tableName" = upd."tableName"
  AND (ld."dependsOnTable" = tableName OR ld."tableName" = tableName)
  AND upd."needToLoad" = TRUE;
END IF;
END;
$$;
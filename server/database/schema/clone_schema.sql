CREATE OR REPLACE FUNCTION admin.clone_schema_first_step(
    source_schema text,
    dest_schema text,
    include_recs boolean)
  RETURNS SETOF json AS
$BODY$

--  This function will clone all sequences, tables, data, views & functions from any existing schema to a new one
-- SAMPLE CALL:
-- SELECT clone_schema_step1('public', 'new_schema', TRUE);

DECLARE
  src_oid          oid;
  type_oid         oid;
  object           text;
  buffer           text;
  dst_schema_table text;
  srctbl           text;
  qry              text;
  name             text;
  v_def            text;
  seqval           bigint;
  sq_last_value    bigint;
  sq_max_value     bigint;
  sq_start_value   bigint;
  sq_increment_by  bigint;
  sq_min_value     bigint;
  sq_cache_value   bigint;
  sq_log_cnt       bigint;
  sq_is_called     boolean;
  sq_is_cycled     boolean;
  sq_cycled        char(10);
  extension_name   text;
  seq_object       record;
  server_version   text;

BEGIN

-- Check that source_schema exists
  SELECT oid INTO src_oid
    FROM pg_namespace
   WHERE nspname = quote_ident(source_schema);
  IF NOT FOUND
    THEN
    RAISE NOTICE 'source schema % does not exist!', source_schema;
    RETURN ;
  END IF;

  -- Check that dest_schema does not yet exist
  PERFORM nspname
    FROM pg_namespace
   WHERE nspname = quote_ident(dest_schema);
  IF FOUND
    THEN
    RAISE NOTICE 'dest schema % already exists!', dest_schema;
    RETURN ;
  END IF;

  EXECUTE 'CREATE SCHEMA ' || quote_ident(dest_schema) ;

  -- Grant rights for revareplication on the destination schema
  EXECUTE 'GRANT USAGE ON SCHEMA "' || dest_schema || '" TO revareplication;';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA "' || dest_schema || '" GRANT SELECT ON TABLES TO revareplication;';

  -- Create sequences
  -- We need to support both postgres 9.6 and 10.4.
  -- Until we migrate prod to 10.4 we will have both ways of creating sequences.
  -- PostgreSQL 9.6 / PostgreSQL 10.4
  SELECT version() INTO server_version;

  IF server_version like 'PostgreSQL 9.%' THEN
    FOR object IN
      SELECT sequence_name::text
        FROM information_schema.sequences
      WHERE sequence_schema = quote_ident(source_schema)
    LOOP
      EXECUTE 'CREATE SEQUENCE ' || quote_ident(dest_schema) || '.' || quote_ident(object);
      srctbl := quote_ident(source_schema) || '.' || quote_ident(object);

      EXECUTE 'SELECT last_value, max_value, start_value, increment_by, min_value, cache_value, log_cnt, is_cycled, is_called
                FROM ' || quote_ident(source_schema) || '.' || quote_ident(object) || ';'
                INTO sq_last_value, sq_max_value, sq_start_value, sq_increment_by, sq_min_value, sq_cache_value, sq_log_cnt, sq_is_cycled, sq_is_called ;

      IF sq_is_cycled
        THEN
          sq_cycled := 'CYCLE';
      ELSE
          sq_cycled := 'NO CYCLE';
      END IF;

      EXECUTE 'ALTER SEQUENCE '   || quote_ident(dest_schema) || '.' || quote_ident(object)
              || ' INCREMENT BY ' || sq_increment_by
              || ' MINVALUE '     || sq_min_value
              || ' MAXVALUE '     || sq_max_value
              || ' START WITH '   || sq_start_value
              || ' RESTART '      || sq_min_value
              || ' CACHE '        || sq_cache_value
              || sq_cycled || ' ;' ;

      dst_schema_table := quote_ident(dest_schema) || '.' || quote_ident(object);
      IF include_recs
          THEN
              EXECUTE 'SELECT setval( ''' || dst_schema_table || ''', ' || sq_last_value || ', ' || sq_is_called || ');' ;
      ELSE
              EXECUTE 'SELECT setval( ''' || dst_schema_table || ''', ' || sq_start_value || ', ' || sq_is_called || ');' ;
      END IF;

    END LOOP;

  ELSE
    FOR seq_object IN
      SELECT relname, ps.seqmax, ps.seqstart, ps.seqincrement, ps.seqmin, ps.seqcache, ps.seqcycle
        FROM pg_class pc
        INNER JOIN pg_sequence ps ON pc.relfilenode = ps.seqrelid
        INNER JOIN pg_namespace pn ON pc.relnamespace = pn.oid
      WHERE pn.oid = src_oid
    LOOP
      EXECUTE 'CREATE SEQUENCE ' || quote_ident(dest_schema) || '.' || quote_ident(seq_object.relname);
      srctbl := quote_ident(source_schema) || '.' || quote_ident(seq_object.relname);

      EXECUTE 'SELECT last_value, is_called FROM ' || quote_ident(source_schema) || '.' || quote_ident(seq_object.relname) || ';'
      INTO sq_last_value, sq_is_called ;

      IF seq_object.seqcycle
        THEN
          sq_cycled := 'CYCLE';
      ELSE
          sq_cycled := 'NO CYCLE';
      END IF;

      EXECUTE 'ALTER SEQUENCE '   || quote_ident(dest_schema) || '.' || quote_ident(seq_object.relname)
              || ' INCREMENT BY ' || seq_object.seqincrement
              || ' MINVALUE '     || seq_object.seqmin
              || ' MAXVALUE '     || seq_object.seqmax
              || ' START WITH '   || seq_object.seqstart
              || ' RESTART '      || seq_object.seqmin
              || ' CACHE '        || seq_object.seqcache
              || sq_cycled || ' ;' ;

      dst_schema_table := quote_ident(dest_schema) || '.' || quote_ident(seq_object.relname);
      IF include_recs
          THEN
              EXECUTE 'SELECT setval( ''' || dst_schema_table || ''', ' || sq_last_value || ', ' || sq_is_called || ');' ;
      ELSE
              EXECUTE 'SELECT setval( ''' || dst_schema_table || ''', ' || seq_object.seqstart || ', ' || sq_is_called || ');' ;
      END IF;

    END LOOP;
  END IF;

  -- Create USER DEFINED TYPES
  FOR type_oid IN
    SELECT t.oid
      FROM pg_type t
      LEFT JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE (t.typrelid = 0 OR (SELECT c.relkind = 'c' FROM pg_catalog.pg_class c WHERE c.oid = t.typrelid))
      AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_type el WHERE el.oid = t.typelem AND el.typarray = t.oid)
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname = quote_ident(source_schema)
  LOOP
    select string_agg(attname ||' '|| format_type(atttypid, atttypmod), ', ') INTO qry
    from pg_type tp
       join pg_class on pg_class.oid = tp.typrelid
       join pg_attribute on pg_attribute.attrelid = pg_class.oid
    where tp.oid = type_oid;

    SELECT typname INTO name from pg_type where oid = type_oid;
    buffer := quote_ident(dest_schema) || '.' || quote_ident(name);

    EXECUTE 'CREATE TYPE ' || buffer || ' AS ' || '(' || qry || ')' || ';';
  END LOOP;

  -- Create extensions
  FOR extension_name IN
    Select extname from pg_extension
  LOOP
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS ' || quote_ident(extension_name) || ' SCHEMA ' || quote_ident(dest_schema) || ';';
   END LOOP;

  --  Return table cloning queries: 0  (Returning a json array, therefore queries executed in parallel)
  RETURN QUERY EXECUTE
     format('SELECT array_to_json (ARRAY (SELECT ''SELECT admin.clone_table(''%L'', ''%L'', '''''' || TABLE_NAME::text || '''''', TRUE);''
        FROM information_schema.tables
        WHERE table_schema = %L
           AND table_type = ''BASE TABLE''));', source_schema, dest_schema, source_schema);

  --  Return FK constraint queries: 1  (Returning a string, therefore queries executed sequentially)
  RETURN QUERY EXECUTE
        format('SELECT to_json (array_to_string (ARRAY (SELECT string_agg( ''ALTER TABLE %I'' || ''.'' || quote_ident(rn.relname)
                  || '' ADD CONSTRAINT "'' || ct.conname || ''" '' || REPLACE(pg_get_constraintdef(ct.oid), %L, quote_ident(%L)) || '';'', '' '' )
        FROM pg_constraint ct
             JOIN pg_class rn ON rn.oid = ct.conrelid
        WHERE connamespace = %L
          AND ct.confrelid > 0
          AND rn.relkind = ''r''
          AND (ct.contype = ''f'' OR ct.contype = ''u'')
        GROUP BY rn.relname), '' ''));', dest_schema, source_schema, dest_schema, src_oid);

  -- Create MATERIALIZED views: 2
  RETURN QUERY EXECUTE
      format('SELECT to_json (array_to_string (ARRAY (SELECT ''CREATE MATERIALIZED VIEW %I'' || ''.'' || quote_ident((c.relname)::information_schema.sql_identifier) || '' AS ''
                       || REPLACE((pg_get_viewdef(c.oid))::information_schema.character_data, %L, quote_ident(%L)) || '';''
          FROM pg_namespace nc,
               pg_class c
          WHERE c.relnamespace = nc.oid
             AND nc.nspname = quote_ident(%L)
             AND c.relkind = ''m''::"char"
            ), '' ''))', dest_schema, source_schema, dest_schema, source_schema);

  END

  $BODY$
    LANGUAGE plpgsql VOLATILE
    COST 100;


CREATE OR REPLACE FUNCTION admin.clone_table(
          source_schema text,
          dest_schema text,
          table_name_ text,
          include_recs boolean)
        RETURNS void AS
      $BODY$

      --  This function will clone all sequences, tables, data, views & functions from any existing schema to a new one
      -- SAMPLE CALL:
      -- SELECT clone_schema('public', 'new_schema', TRUE);

      DECLARE
        src_schema_table text;
        dst_schema_table text;
        default_         text;
        column_          text;

      BEGIN

      src_schema_table := quote_ident(source_schema) || '.' || quote_ident(table_name_);
      dst_schema_table := quote_ident(dest_schema) || '.' || quote_ident(table_name_);
      EXECUTE 'CREATE TABLE ' || dst_schema_table || ' (LIKE ' || src_schema_table || ' INCLUDING ALL)';

      IF include_recs
        THEN
        -- Insert records from source table
        EXECUTE 'INSERT INTO ' || dst_schema_table || ' SELECT * FROM ' || src_schema_table || ';';
      END IF;

      FOR column_, default_ IN
        SELECT column_name::text,
               REPLACE(column_default::text, source_schema, quote_ident(dest_schema))
          FROM information_schema.COLUMNS
         WHERE table_schema = dest_schema
           AND TABLE_NAME = table_name_
           AND column_default LIKE 'nextval(%' || quote_ident(source_schema) || '%::regclass)'
      LOOP
        EXECUTE 'ALTER TABLE ' || dst_schema_table || ' ALTER COLUMN ' || column_ || ' SET DEFAULT ' || default_;
      END LOOP;

     END;

$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

CREATE OR REPLACE FUNCTION admin.fix_check_constraints(
    source_schema text,
    dest_schema text)
  RETURNS void AS
$BODY$
        DECLARE
          src_oid oid;
          chkconstraint record;
          tableName text;
          newConstraintDefinition text;
        BEGIN

        SELECT oid INTO src_oid
          FROM pg_namespace
         WHERE nspname = quote_ident(source_schema);

        FOR chkconstraint IN
          SELECT conname, pg_get_constraintdef(c.oid) AS definition, rn.relname
          FROM pg_constraint c
          JOIN pg_class rn ON rn.oid = c.conrelid
          WHERE c.connamespace = src_oid
            AND contype = 'c'
        LOOP
          tableName := quote_ident(dest_schema) || '.' || quote_ident(chkconstraint.relname);
          newConstraintDefinition := REPLACE(chkconstraint.definition, source_schema, quote_ident(dest_schema));

          EXECUTE 'ALTER TABLE ' || tableName || ' DROP CONSTRAINT ' || quote_ident(chkconstraint.conname) || ';';
          EXECUTE 'ALTER TABLE ' || tableName || ' ADD CONSTRAINT ' || quote_ident(chkconstraint.conname) || ' ' || newConstraintDefinition || ';';
        END LOOP;
        END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;

CREATE OR REPLACE FUNCTION admin.clone_schema_last_step(
    source_schema text,
    dest_schema text)
  RETURNS void AS
$BODY$

        --  This function will clone all sequences, tables, data, views & functions from any existing schema to a new one
        -- SAMPLE CALL:
        -- SELECT clone_schema('public', 'new_schema', TRUE);

        DECLARE
          src_oid          oid;
          func_oid         oid;
          object           text;
          buffer           text;
          qry              text;
          name             text;
          dest_qry         text;
          v_def            text;
          indexDefinition  text;
          triggers         RECORD;
          dst_trigger      text;
          tg_stmt          text;
          sql_stmt         text;

        BEGIN

        SELECT oid INTO src_oid
          FROM pg_namespace
         WHERE nspname = quote_ident(source_schema);


    -- Create views
      FOR object IN
        SELECT table_name::text,
               view_definition
          FROM information_schema.views
         WHERE table_schema = quote_ident(source_schema)

      LOOP
        buffer := quote_ident(dest_schema) || '.' || quote_ident(object);
        SELECT view_definition INTO v_def
          FROM information_schema.views
         WHERE table_schema = quote_ident(source_schema)
           AND table_name = quote_ident(object);

        EXECUTE 'CREATE OR REPLACE VIEW ' || buffer || ' AS ' || REPLACE(v_def, quote_ident(source_schema), quote_ident(dest_schema)) || ';' ;

      END LOOP;


      -- Create functions
        FOR func_oid IN
          SELECT oid
            FROM pg_proc
           WHERE pronamespace = src_oid
           ORDER BY array_position(array['getpersondisplayname', 'getinventoryfullqualifiedname', 'getparentpartyinventoryfullqualifiedname', 'getpartysearchrows','getpersonsearchrows', 'bedrooms', 'insertorupdatepartysearchdata', 'insertorupdatepersonsearchdata', 'buildaggregatedpartydocument', 'getinventoryfullqualifiedname'], proname::text)

        LOOP
          SELECT pg_get_functiondef(func_oid) INTO qry;
          SELECT replace(qry, source_schema, quote_ident(dest_schema)) INTO dest_qry;
          EXECUTE dest_qry;

        END LOOP;

      -- Create triggers: 4
        FOR triggers IN
          SELECT
            pg_get_triggerdef(t.oid) AS trigger_def
          FROM pg_namespace n,
            pg_class c,
            pg_trigger t
        WHERE n.oid = c.relnamespace
          AND c.oid = t.tgrelid
          AND n.nspname = quote_ident(source_schema)
          AND NOT t.tgisinternal
        LOOP
          dst_trigger := REPLACE(triggers.trigger_def, quote_ident(source_schema), quote_ident(dest_schema));
          EXECUTE dst_trigger;
        END LOOP;

    -- Create unique materialized views indexes
      FOR indexDefinition IN
        SELECT indexdef FROM pg_indexes
          WHERE schemaname=quote_ident(source_schema)
          AND tablename IN (
            SELECT (c.relname)::information_schema.sql_identifier AS table_name
            FROM pg_namespace nc,
                pg_class c
            WHERE c.relnamespace = nc.oid
            AND nc.nspname = quote_ident(source_schema)
            AND c.relkind = 'm'::"char")
      LOOP
        EXECUTE REPLACE(indexDefinition, quote_ident(source_schema), quote_ident(dest_schema)) || ';';

      END LOOP;

    -- set REPLICA IDENTITY for tables with composed PK
      FOR sql_stmt IN
        SELECT 'ALTER TABLE "' || t.table_schema || '"."' || t.table_name || '" REPLICA IDENTITY USING INDEX "' || tcu.constraint_name || '";'
        FROM information_schema.tables t
          LEFT JOIN information_schema.table_constraints tc ON t.table_schema = tc.table_schema AND t.table_name = tc.table_name AND tc.constraint_type = 'PRIMARY KEY'
          LEFT JOIN information_schema.table_constraints tcu ON t.table_schema = tcu.table_schema AND t.table_name = tcu.table_name AND tcu.constraint_type = 'UNIQUE'
        WHERE t.table_schema = dest_schema
          AND tc.constraint_name IS NULL
          AND t.table_name NOT IN ('knex_migrations_lock')
      LOOP
          EXECUTE sql_stmt;
        END LOOP;
      RETURN;

    END;

    $BODY$
      LANGUAGE plpgsql VOLATILE
      COST 100;

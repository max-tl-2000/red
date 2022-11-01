/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../../common/schemaConstants';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
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

              `,
      tenantId,
    ),
  );
};

exports.down = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      CREATE OR REPLACE FUNCTION admin.clone_schema_last_step(source_schema text, dest_schema text)
      RETURNS void
      LANGUAGE plpgsql
     AS $function$

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
                         ORDER BY array_position(array['getpersondisplayname', 'getinventoryfullqualifiedname', 'getparentpartyinventoryfullqualifiedname', 'getpartysearchrows','getpersonsearchrows',
                          'bedrooms', 'insertorupdatepartysearchdata', 'insertorupdatepersonsearchdata'], proname::text)

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

                  $function$;
        `,
      tenantId,
    ),
  );
};

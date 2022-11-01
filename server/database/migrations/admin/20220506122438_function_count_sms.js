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
      CREATE OR REPLACE FUNCTION admin.count_sms(last_days int)
        RETURNS TABLE(tenant_id text, tenant_name text, outgoing_number text, cnt bigint)
        --sample run counts the SMSs from the last 60 days: SELECT * FROM admin.count_sms(60);
        LANGUAGE plpgsql
        AS $function$
          DECLARE sql_txt text;
          BEGIN
            FOR sql_txt IN
              SELECT 'SELECT ''' || id::text || ''', ''' || name::text || ''', message ->> ''from'' as "outgoingNumber", count(id) as count FROM "' || id::text || '"."Communication" where type = ''Sms'' and direction = ''out'' and created_at > now() - interval ''' || last_days::text || ''' day  group by 1,2,3 '
              FROM admin."Tenant"
            LOOP
              RETURN QUERY EXECUTE FORMAT(sql_txt);
            END LOOP;
          END
        $function$;
      `,
      tenantId,
    ),
  );
};

exports.down = async () => {};

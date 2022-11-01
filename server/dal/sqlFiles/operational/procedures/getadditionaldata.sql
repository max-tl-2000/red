CREATE OR REPLACE FUNCTION db_namespace.getadditionaldata(p_partyids character varying[], p_userids character varying[], p_strongmatch character varying)
 RETURNS TABLE(c_details json)
 LANGUAGE plpgsql
AS $function$
  DECLARE sql_stmt text;
      BEGIN
        sql_stmt := '
        WITH parties AS (
        SELECT UNNEST(''' || p_partyids::text || '''::uuid[]) AS "partyId"
        )';
        IF p_strongMatch IS NOT NULL THEN
          sql_stmt := sql_stmt || '(' || '
            SELECT json_agg(json_build_object(''partyMember'', row_to_json(pm),
                           ''partyId'', pm."partyId",
                           ''person'', row_to_json(person),
                           ''contactInfo'', "contactInfo".c,
                           ''company'', row_to_json(com),
                           ''strongMatchCount'', "personStrongMatch".strongMatchCount))
          FROM parties
            INNER JOIN db_namespace."PartyMember" pm on parties."partyId" = pm."partyId"
            INNER JOIN db_namespace."Person" person ON pm."personId" = person."id"
            LEFT JOIN db_namespace."Company" com ON com.id = pm."companyId"
            LEFT JOIN LATERAL (SELECT json_agg(contact) AS c
                       FROM db_namespace."ContactInfo" contact
                       WHERE contact."personId" = person.id) "contactInfo" ON true
            LEFT JOIN LATERAL (SELECT count(*) AS strongMatchCount
                       FROM db_namespace."PersonStrongMatches" psm
                       WHERE (psm."firstPersonId" = person.id OR psm."secondPersonId" = person.id)
                        AND psm."status" = ''' || p_strongMatch || ''') "personStrongMatch" ON true';
        ELSE
          sql_stmt := sql_stmt || '(' || '
          SELECT json_agg(json_build_object(''partyMember'', row_to_json(pm),
                           ''partyId'', pm."partyId",
                           ''person'', row_to_json(person),
                           ''company'', row_to_json(com),
                           ''contactInfo'', "contactInfo".c))
          FROM parties
            INNER JOIN db_namespace."PartyMember" pm on parties."partyId" = pm."partyId"
            INNER JOIN db_namespace."Person" person ON pm."personId" = person."id"
            LEFT JOIN db_namespace."Company" com ON com.id = pm."companyId"
            LEFT JOIN LATERAL (SELECT json_agg(contact) AS c
                       FROM db_namespace."ContactInfo" contact
                       WHERE contact."personId" = person.id) "contactInfo" ON true
          WHERE pm."endDate" IS NULL';
        END IF;
        sql_stmt := sql_stmt || ')
         UNION ALL
        (SELECT json_agg(task)
         FROM parties
            INNER JOIN db_namespace."Tasks" task on parties."partyId" = task."partyId"
         WHERE task.state <> ''Canceled'' AND task.state <> ''Completed''
          AND task."userIds" && ''' || p_userids::text || ''')
         UNION ALL
        (SELECT json_agg(promotion)
         FROM parties
            INNER JOIN db_namespace."PartyQuotePromotions" promotion on parties."partyId" = promotion."partyId")
         UNION ALL
        (SELECT json_agg(jsonb_build_object(''partyId'', pa."partyId",
                        ''personApplication'', row_to_json(pa),
                        ''privateDocumentsCount'', pad."privateDocumentsCount"))
         FROM parties
            INNER JOIN db_namespace."rentapp_PersonApplication" pa on (parties."partyId" = pa."partyId" AND pa."endedAsMergedAt" IS NULL)
            LEFT JOIN LATERAL (SELECT count (*) AS "privateDocumentsCount"
                  FROM db_namespace."rentapp_personApplicationDocuments" pad
                  WHERE pa."id" = pad."personApplicationId") pad ON true)
         UNION ALL
        (SELECT json_agg(json_build_object(''id'', id, ''partyId'', lease."partyId", ''quoteId'', "quoteId", ''leaseTermId'', "leaseTermId", ''leaseTerm'', "baselineData"->''publishedLease''->>''termLength'',
                                           ''leaseTemplateId'', "leaseTemplateId", ''status'', "status", ''leaseStartDate'', "baselineData"->''publishedLease''->>''leaseStartDate'', ''created_at'', "created_at",
                                           ''updated_at'', "updated_at", ''signDate'', "signDate", ''signatures'', leaseSignatures.signatures))
         FROM parties
            INNER JOIN db_namespace."Lease" lease on parties."partyId" = lease."partyId"
            LEFT JOIN LATERAL (SELECT json_agg(ls) AS signatures
                  FROM db_namespace."LeaseSignatureStatus" ls
                  WHERE ls."leaseId" = lease.id) leaseSignatures ON true
         );';
        RETURN QUERY EXECUTE sql_stmt;
        END;
$function$

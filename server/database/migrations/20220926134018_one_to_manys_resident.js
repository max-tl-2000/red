/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { prepareRawQuery } from '../../common/schemaConstants';

exports.up = async (knex, { tenantId }) => {
  await knex.raw(
    prepareRawQuery(
      `
      CREATE OR REPLACE FUNCTION db_namespace.generate_one_to_manys_data()
        RETURNS TABLE("Table_Name" text, "Entity_Record_Code" character varying, "Field_Name1" text, "Field_Value1" text, "Field_Name2" text, "Field_Value2" text, "Field_Name3" text, "Field_Value3" text, "Field_Name4" text, "Field_Value4" text, "Field_Name5" text, "Field_Value5" text, "Field_Name6" text, "Field_Value6" text, "Field_Name7" text, "Field_Value7" character varying, "Field_Name8" text, "Field_Value8" text, "Field_Name9" text, "Field_Value9" text, "Field_Name10" text, "Field_Value10" character varying, "assignedPropertyId" uuid)
        LANGUAGE plpgsql
        AS $function$
        BEGIN
        RETURN QUERY
        SELECT 'propbut_bidetails' AS "Table_Name",
                prop.name AS "Entity_Record_Code",
                'Type' AS "Field_Name1",
                'Contact' AS "Field_Value1",
                'Rating' AS "Field_Name2",
                CASE WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date > (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified' ELSE 'bronze' END
                WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date <= (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND "qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'gold'
                        ELSE 'silver'
                        END
                WHEN LSTour."TourStartDate" IS NULL THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'silver'
                        WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                        WHEN (p."qualificationQuestions" ->> 'moveInTime' <> 'NEXT_4_WEEKS'
                                AND COALESCE(NULLIF(p."qualificationQuestions" ->> 'moveInTime', ''), 'I_DONT_KNOW') <> 'I_DONT_KNOW'
                                AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'bronze'
                        ELSE 'prospect'
                        END
                WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                ELSE 'prospect'
                END as "Field_Value2",
                'pCode' AS "Field_Name3",
                pm."externalProspectId"::text AS "Field_Value3",
                'Date' AS "Field_Name4",
                to_char((p."created_at" AT TIME ZONE prop.timezone)::date, 'mm/dd/yyyy') AS "Field_Value4",
                'ContactType' AS "Field_Name5",
                CASE p.metadata ->> 'firstContactChannel'
                        WHEN 'ContactEvent' THEN 'Walk-In'
                        WHEN 'Sms' THEN 'Sms'
                        WHEN 'Email' THEN 'Email'
                        WHEN 'Call' THEN 'Call'
                        WHEN 'Web' THEN 'Web'
                        WHEN 'Walk-in' THEN 'Walk-In'
                        ELSE 'Other'
                END AS "Field_Value5",
                'Source' AS "Field_Name6",
                CASE COALESCE(p."qualificationQuestions"->>'groupProfile', s."name")
                        WHEN 'corporateHousing' THEN 'Corporate Housing'
                        WHEN 'CORPORATE' THEN 'Corporate Housing'
                ELSE COALESCE(NULLIF(s."displayName", ''), p.metadata ->> 'source', 'Reva')
                END AS "Field_Value6",
                'Agent' AS "Field_Name7",
                u."fullName" AS "Field_Value7",
                'LeaseType' AS "Field_Name8",
                CASE p."qualificationQuestions"->>'groupProfile'
                        WHEN 'INDIVIDUAL' THEN 'Traditional'
                        WHEN 'ROOMMATES' THEN 'Traditional'
                        WHEN 'COUPLE_OR_FAMILY' THEN 'Traditional'
                        WHEN 'CORPORATE' THEN 'Corporate'
                        WHEN 'STUDENTS' THEN 'Student'
                        WHEN 'EMPLOYEE' THEN 'Employee'
                        WHEN 'SECTION8' THEN 'Section8'
                        WHEN 'GOOD_SAMARITAN' THEN 'GoodSam'
                        WHEN '' THEN 'NOT_YET_DETERMINED'
                        ELSE COALESCE(p."qualificationQuestions"->>'groupProfile', 'NOT_YET_DETERMINED')
                END AS "Field_Value8",
                'PrefBeds' AS "Field_Name9",
                CASE p."qualificationQuestions"#>>'{numBedrooms,0}'
                WHEN 'STUDIO' THEN '0'
                WHEN 'ONE_BED' THEN '1'
                WHEN 'TWO_BEDS' THEN '2'
                WHEN 'THREE_BEDS' THEN '3'
                WHEN 'FOUR_PLUS_BEDS' THEN '4'
                END AS "Field_Value9",
                'partyId' AS "Field_Name10",
                CAST(p."id" AS varchar) AS "Field_Value10",
                CAST(p."assignedPropertyId" AS uuid) AS "assignedPropertyId"
        FROM db_namespace."Party" p
        INNER JOIN db_namespace."Property" prop ON prop."id" = p."assignedPropertyId"
        INNER JOIN db_namespace."Users" u ON u."id" = p."userId" AND u."fullName" NOT LIKE '%Resident%'
        LEFT OUTER JOIN
                (SELECT ei."externalProspectId", pm."partyId",
                        ROW_NUMBER() OVER (PARTITION BY pm."partyId" ORDER BY COALESCE(ei."endDate", '2200-01-01') DESC, ei."startDate" DESC) AS "theRank"
                FROM db_namespace."PartyMember" pm
                        LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id
                WHERE ei."isPrimary" = 'true'
                ) pm ON pm."partyId" = p.id and pm."theRank" = 1
        LEFT OUTER JOIN
                (SELECT "partyId",
                        CAST(metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                        row_number() OVER (PARTITION BY "partyId" ORDER BY created_at, metadata ->> 'startDate' asc) "rowNum"
                FROM db_namespace."Tasks"
                WHERE name = 'APPOINTMENT'
                ) AS LSTour ON LSTour."partyId" = p."id" AND LSTour."rowNum" = 1
        LEFT OUTER JOIN db_namespace."TeamPropertyProgram" tpc on tpc.id = p."teamPropertyProgramId"
        LEFT OUTER JOIN db_namespace."Programs" camp on camp.id = tpc."programId"
        LEFT OUTER JOIN db_namespace."Sources" s on s.id = camp."sourceId"
        WHERE   coalesce(pm."externalProspectId", '') NOT LIKE 'p%'
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MARKED_AS_SPAM' OR p."id" IN ('172b4817-7907-4c0e-967c-cfeef7296041', 'a16df251-469a-4e43-bfdb-d42cb62018b5'))
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MERGED_WITH_ANOTHER_PARTY' OR p."id" = '0040dc91-3b53-439b-9ca2-1d576e23c086')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'ALREADY_A_RESIDENT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NO_MEMBERS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_FOR_LEASING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'INITIAL_HANGUP')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'REVA_TESTING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_LEASING_BUSINESS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'CLOSED_DURING_IMPORT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'BLOCKED_CONTACT')
                AND (p.metadata->>'archiveReasonId' IS NULL OR p.metadata->>'archiveReasonId' != 'MERGED_WITH_ANOTHER_PARTY')
                AND p."workflowName" = 'newLease'
                AND p."created_at" > NOW() - INTERVAL '14 months'
        UNION ALL
        SELECT  'propbut_bidetails' AS "Table_Name",
                prop.name AS "Entity_Record_Code",
                'Type' AS "Field_Name1",
                'Show' AS "Field_Value1",
                'Rating' AS "Field_Name2",
                CASE WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date > (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified' ELSE 'bronze' END
                WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date <= (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND "qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'gold'
                        ELSE 'silver'
                        END
                WHEN LSTour."TourStartDate" IS NULL THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'silver'
                        WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                        WHEN (p."qualificationQuestions" ->> 'moveInTime' <> 'NEXT_4_WEEKS'
                                AND COALESCE(NULLIF(p."qualificationQuestions" ->> 'moveInTime', ''), 'I_DONT_KNOW') <> 'I_DONT_KNOW'
                                AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'bronze'
                        ELSE 'prospect'
                        END
                WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                ELSE 'prospect'
                END as "Field_Value2",
                'pCode' AS "Field_Name3",
                pm."externalProspectId"::text AS "Field_Value3",
                'Date' AS "Field_Name4",
                to_char((tour."eventDate" AT TIME ZONE prop.timezone)::date, 'mm/dd/yyyy') AS "Field_Value4",
                'ContactType' AS "Field_Name5",
                CASE p.metadata ->> 'firstContactChannel'
                        WHEN 'ContactEvent' THEN 'Walk-In'
                        WHEN 'Sms' THEN 'Sms'
                        WHEN 'Email' THEN 'Email'
                        WHEN 'Call' THEN 'Call'
                        WHEN 'Web' THEN 'Web'
                        WHEN 'Walk-in' THEN 'Walk-In'
                        ELSE 'Other'
                END AS "Field_Value5",
                'Source' AS "Field_Name6",
                CASE COALESCE(p."qualificationQuestions"->>'groupProfile', s."name")
                        WHEN 'corporateHousing' THEN 'Corporate Housing'
                        WHEN 'CORPORATE' THEN 'Corporate Housing'
                ELSE COALESCE(NULLIF(s."displayName", ''), p.metadata ->> 'source', 'Reva')
                END AS "Field_Value6",
                'Agent' AS "Field_Name7",
                u."fullName" AS "Field_Value7",
                'LeaseType' AS "Field_Name8",
                CASE p."qualificationQuestions"->>'groupProfile'
                        WHEN 'INDIVIDUAL' THEN 'Traditional'
                        WHEN 'ROOMMATES' THEN 'Traditional'
                        WHEN 'COUPLE_OR_FAMILY' THEN 'Traditional'
                        WHEN 'CORPORATE' THEN 'Corporate'
                        WHEN 'STUDENTS' THEN 'Student'
                        WHEN 'EMPLOYEE' THEN 'Employee'
                        WHEN 'SECTION8' THEN 'Section8'
                        WHEN 'GOOD_SAMARITAN' THEN 'GoodSam'
                        WHEN '' THEN 'NOT_YET_DETERMINED'
                        ELSE COALESCE(p."qualificationQuestions"->>'groupProfile', 'NOT_YET_DETERMINED')
                END AS "Field_Value8",
                'PrefBeds' AS "Field_Name9",
                CAST(CASE p."qualificationQuestions"#>>'{numBedrooms,0}'
                WHEN 'STUDIO' THEN 0
                WHEN 'ONE_BED' THEN 1
                WHEN 'TWO_BEDS' THEN 2
                WHEN 'THREE_BEDS' THEN 3
                WHEN 'FOUR_PLUS_BEDS' THEN 4
                END AS varchar) AS "Field_Value9",
                'partyId' AS "Field_Name10",
                CAST(p."id" AS varchar) AS "Field_Value10",
                CAST(p."assignedPropertyId" AS uuid) AS "assignedPropertyId"
        FROM db_namespace."Party" p
        INNER JOIN db_namespace."Property" prop ON prop."id" = p."assignedPropertyId"
        INNER JOIN db_namespace."Users" u ON u."id" = p."userId" AND u."fullName" NOT LIKE '%Resident%'
        INNER JOIN
                (SELECT "partyId",
                        MIN(CAST(metadata ->> 'endDate' AS TIMESTAMPTZ)) AS "eventDate"
                FROM db_namespace."Tasks"
                WHERE  name = 'APPOINTMENT'
                        AND state = 'Completed'
                        AND metadata ->> 'appointmentResult' = 'COMPLETE'
                GROUP BY "partyId" ) AS tour ON tour."partyId" = p."id"
        LEFT OUTER JOIN
        (SELECT ei."externalProspectId", pm."partyId",
                        ROW_NUMBER() OVER (PARTITION BY pm."partyId" ORDER BY COALESCE(ei."endDate", '2200-01-01') DESC, ei."startDate" DESC) AS "theRank"
                FROM db_namespace."PartyMember" pm
                        LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id
                WHERE ei."isPrimary" = 'true'
                ) pm ON pm."partyId" = p.id and pm."theRank" = 1
        LEFT OUTER JOIN
                (SELECT "partyId",
                        CAST(metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                        row_number() OVER (PARTITION BY "partyId" ORDER BY created_at, metadata ->> 'startDate' asc) "rowNum"
                FROM db_namespace."Tasks"
                WHERE name = 'APPOINTMENT'
                ) AS LSTour ON LSTour."partyId" = p."id" AND LSTour."rowNum" = 1
        LEFT OUTER JOIN db_namespace."TeamPropertyProgram" tpc on tpc.id = p."teamPropertyProgramId"
        LEFT OUTER JOIN db_namespace."Programs" camp on camp.id = tpc."programId"
        LEFT OUTER JOIN db_namespace."Sources" s on s.id = camp."sourceId"
        WHERE tour."eventDate" >= CASE prop."id"
                                        WHEN '0029b50a-9261-4668-9f28-2f7b7816fe5d' /*lark*/ THEN '2017-05-17' /*Serenity go-live date*/
                                        WHEN 'e3340e0a-91a6-4f1c-9cc0-465c2454930f' /*cove*/ THEN '2017-07-10' /*Cove go-live date*/
                                        WHEN 'b09dea3e-d9f9-46ba-9dfa-fd3bf013e53e' /*wood*/ THEN '2017-08-29' /*Woodchase go-live date*/
                                        WHEN '2e241615-3873-4101-825f-8f87500207d1' /*swparkme*/ THEN '2017-09-28' /*Parkmerced go-live date*/
                                        ELSE tour."eventDate"
                        END
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MARKED_AS_SPAM' OR p."id" IN ('172b4817-7907-4c0e-967c-cfeef7296041', 'a16df251-469a-4e43-bfdb-d42cb62018b5'))
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MERGED_WITH_ANOTHER_PARTY' OR p."id" = '0040dc91-3b53-439b-9ca2-1d576e23c086')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'ALREADY_A_RESIDENT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NO_MEMBERS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_FOR_LEASING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'INITIAL_HANGUP')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'REVA_TESTING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_LEASING_BUSINESS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'CLOSED_DURING_IMPORT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'BLOCKED_CONTACT')
                AND (p.metadata->>'archiveReasonId' IS NULL OR p.metadata->>'archiveReasonId' != 'MERGED_WITH_ANOTHER_PARTY')
                AND tour."eventDate" > NOW() - INTERVAL '14 months'
        UNION
        SELECT 'propbut_bidetails' AS "Table_Name",
                prop.name AS "Entity_Record_Code",
                'Type' AS "Field_Name1",
                'Sale' AS "Field_Value1",
                'Rating' AS "Field_Name2",
                CASE WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date > (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified' ELSE 'bronze' END
                WHEN (LSTour."TourStartDate" AT TIME ZONE prop.timezone)::date <= (p.created_at AT TIME ZONE prop.timezone + interval '28 days')::date THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND "qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'gold'
                        ELSE 'silver'
                        END
                WHEN LSTour."TourStartDate" IS NULL THEN
                        CASE WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'silver'
                        WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                        WHEN (p."qualificationQuestions" ->> 'moveInTime' <> 'NEXT_4_WEEKS'
                                AND COALESCE(NULLIF(p."qualificationQuestions" ->> 'moveInTime', ''), 'I_DONT_KNOW') <> 'I_DONT_KNOW'
                                AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'bronze'
                        ELSE 'prospect'
                        END
                WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
                ELSE 'prospect'
                END as "Field_Value2",
                'pCode' AS "Field_Name3",
                pm."externalProspectId"::text AS "Field_Value3",
                'Date' AS "Field_Name4",
                to_char((sale."eventDate"AT TIME ZONE prop.timezone)::date, 'mm/dd/yyyy') AS "Field_Value4",
                'ContactType' AS "Field_Name5",
                CASE p.metadata ->> 'firstContactChannel'
                        WHEN 'ContactEvent' THEN 'Walk-In'
                        WHEN 'Sms' THEN 'Sms'
                        WHEN 'Email' THEN 'Email'
                        WHEN 'Call' THEN 'Call'
                        WHEN 'Web' THEN 'Web'
                        WHEN 'Walk-in' THEN 'Walk-In'
                        ELSE 'Other'
                END AS "Field_Value5",
                'Source' AS "Field_Name6",
                CASE COALESCE(p."qualificationQuestions"->>'groupProfile', s."name")
                        WHEN 'corporateHousing' THEN 'Corporate Housing'
                        WHEN 'CORPORATE' THEN 'Corporate Housing'
                ELSE COALESCE(NULLIF(s."displayName", ''), p.metadata ->> 'source', 'Reva')
                END AS "Field_Value6",
                'Agent' AS "Field_Name7",
                u."fullName" AS "Field_Value7",
                'LeaseType' AS "Field_Name8",
                CASE p."qualificationQuestions"->>'groupProfile'
                        WHEN 'INDIVIDUAL' THEN 'Traditional'
                        WHEN 'ROOMMATES' THEN 'Traditional'
                        WHEN 'COUPLE_OR_FAMILY' THEN 'Traditional'
                        WHEN 'CORPORATE' THEN 'Corporate'
                        WHEN 'STUDENTS' THEN 'Student'
                        WHEN 'EMPLOYEE' THEN 'Employee'
                        WHEN 'SECTION8' THEN 'Section8'
                        WHEN 'GOOD_SAMARITAN' THEN 'GoodSam'
                        WHEN '' THEN 'NOT_YET_DETERMINED'
                        ELSE COALESCE(p."qualificationQuestions"->>'groupProfile', 'NOT_YET_DETERMINED')
                END AS "Field_Value8",
                'PrefBeds' AS "Field_Name9",
                CAST(CASE p."qualificationQuestions"#>>'{numBedrooms,0}'
                WHEN 'STUDIO' THEN 0
                WHEN 'ONE_BED' THEN 1
                WHEN 'TWO_BEDS' THEN 2
                WHEN 'THREE_BEDS' THEN 3
                WHEN 'FOUR_PLUS_BEDS' THEN 4
                END AS varchar) AS "Field_Value9",
                'partyId' AS "Field_Name10",
                CAST(p."id" AS varchar) AS "Field_Value10",
                CAST(p."assignedPropertyId" AS uuid) AS "assignedPropertyId"
        FROM db_namespace."Party" p
        INNER JOIN db_namespace."Property" prop ON prop."id" = p."assignedPropertyId"
        INNER JOIN db_namespace."Users" u ON u."id" = p."userId" AND u."fullName" NOT LIKE '%Resident%'
        INNER JOIN
                (select  "partyId",
                        "signDate" as "eventDate"
                from db_namespace."Lease"
                where status = 'executed'
                        AND "signDate" > NOW() - INTERVAL '14 months') AS sale ON sale."partyId" = p."id"
        LEFT OUTER JOIN
                (SELECT ei."externalProspectId", pm."partyId",
                        ROW_NUMBER() OVER (PARTITION BY pm."partyId" ORDER BY COALESCE(ei."endDate", '2200-01-01') DESC, ei."startDate" DESC) AS "theRank"
                FROM db_namespace."PartyMember" pm
                        LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id
                WHERE ei."isPrimary" = 'true'
                ) pm ON pm."partyId" = p.id and pm."theRank" = 1
        LEFT OUTER JOIN
                (SELECT "partyId",
                        CAST(metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                        row_number() OVER (PARTITION BY "partyId" ORDER BY created_at, metadata ->> 'startDate' asc) "rowNum"
                FROM db_namespace."Tasks"
                WHERE name = 'APPOINTMENT'
                ) AS LSTour ON LSTour."partyId" = p."id" AND LSTour."rowNum" = 1
        LEFT OUTER JOIN db_namespace."TeamPropertyProgram" tpc on tpc.id = p."teamPropertyProgramId"
        LEFT OUTER JOIN db_namespace."Programs" camp on camp.id = tpc."programId"
        LEFT OUTER JOIN db_namespace."Sources" s on s.id = camp."sourceId"
        WHERE   (p.state = 'FutureResident' OR p.state = 'Resident')
                AND p."endDate" IS NULL
                AND p."workflowName" = 'newLease'
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MARKED_AS_SPAM' OR p."id" IN ('172b4817-7907-4c0e-967c-cfeef7296041', 'a16df251-469a-4e43-bfdb-d42cb62018b5'))
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'MERGED_WITH_ANOTHER_PARTY' OR p."id" = '0040dc91-3b53-439b-9ca2-1d576e23c086')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'ALREADY_A_RESIDENT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NO_MEMBERS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_FOR_LEASING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'INITIAL_HANGUP')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'REVA_TESTING')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'NOT_LEASING_BUSINESS')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'CLOSED_DURING_IMPORT')
                AND (p.metadata->>'closeReasonId' IS NULL OR p.metadata->>'closeReasonId' != 'BLOCKED_CONTACT')
                AND (p.metadata->>'archiveReasonId' IS NULL OR p.metadata->>'archiveReasonId' != 'MERGED_WITH_ANOTHER_PARTY');
        END;
        $function$
        ;
        `,
      tenantId,
    ),
  );
};

exports.down = () => {};

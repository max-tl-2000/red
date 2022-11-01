CREATE OR REPLACE FUNCTION db_namespace.getpartysearchrows(entityid uuid)
 RETURNS SETOF record
 LANGUAGE sql
AS $function$
WITH parties_to_update AS (
    SELECT id AS "partyId"
    FROM db_namespace."Party" AS p
    WHERE entityid IS NULL -- for all parties
        OR id = entityid -- for a specific party
    UNION
    SELECT "partyId"
    FROM db_namespace."PartyMember" AS pm
    WHERE pm."personId" = entityid -- for a specific person
    UNION
    SELECT "partyId"
    FROM db_namespace."PartyMember" AS pm
        JOIN db_namespace."ContactInfo" ci ON pm."personId" = ci."personId"
    WHERE ci.id = entityid -- for a specific contact info
), agg_data AS (
    SELECT
        p.id,
        string_agg(DISTINCT db_namespace.getpersondisplayname(pers."id"), ', ') as "pmFullNames",
        COALESCE(string_agg(pers."preferredName", ', '), '') as "pmPreferredNames",
        COALESCE(string_agg("contactInfo"."pmContactInfos", ', '), '') as "pmContactInfos",
        COALESCE(string_agg("contactInfo"."phoneContactInfo", ', '), '') AS "phoneContactInfo",
        u."fullName" as "partyOwner",
        p.state,
        p."workflowState",
        p."workflowName",
        p.teams,
        p.created_at,
        p."qualificationQuestions"->>'moveInTime' as "moveInTime",
        p."partyGroupId",
        p."archiveDate",
        p.metadata->>'archiveReasonId' as "archiveReason",
        p."leaseType",
        CASE
          WHEN (p."leaseType" ='corporate') THEN
        (
            string_agg(DISTINCT comp."displayName", ', ')
        )
        ELSE ''
        END AS "companyName",
        CASE
    WHEN (p."workflowName" = 'activeLease')
        THEN coalesce(string_agg(ac."leaseData"->>'leaseStartDate'::text , ' '))
    ELSE ''
    END AS "leaseStartDate",
    CASE
        WHEN (p."workflowName" = 'renewal')
        AND (p."workflowState" = 'active') THEN (
        SELECT c_fullqualifiedname
        FROM db_namespace.getparentpartyinventoryfullqualifiedname(p.id)
        )
            WHEN (p."workflowName" = 'newLease') AND (p."workflowState" = 'active') THEN
            COALESCE(string_agg("unitInfo"."unitName", ', '), '') || ' ' ||
            COALESCE(string_agg("unitInfo"."buildingInventoryName", ', '), '') || ' ' ||
            COALESCE(string_agg("unitInfo"."propertyBuildingName", ', '), '')
        WHEN (p."workflowState" = 'active') THEN (
        SELECT c_fullqualifiedname from db_namespace.getinventoryfullqualifiedname(
                    (string_to_array(ac."leaseData"->>'inventoryId', ',')))
                    )
        ELSE ''
        END AS "fullQualifiedName",
        (SELECT string_agg(name, ', ') FROM db_namespace."Inventory" where ARRAY(SELECT (jsonb_array_elements_text(p.metadata -> 'favoriteUnits')::uuid )) @> ARRAY[id]) as "favoriteUnits"
    FROM db_namespace."Party" p
        INNER JOIN parties_to_update AS ptu ON p.id = ptu."partyId"
        INNER JOIN db_namespace."PartyMember" pm on pm."partyId" = p.id AND pm."endDate" IS NULL
        INNER JOIN db_namespace."Person" pers ON pers.id = pm."personId"
        LEFT JOIN db_namespace."Company" comp on pm."companyId" = comp.id
        LEFT JOIN db_namespace."Users" u on u.id = p."userId"
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" ac ON ac."partyId" = p.id
        LEFT JOIN LATERAL (
        SELECT
                    string_agg(
                        CASE WHEN ci.type = 'phone' THEN ''
                        ELSE ci.value
                        END, ', ') AS "pmContactInfos",
                    string_agg( CASE WHEN ci.type = 'phone'
                    THEN concat(ci.value, ' ', substring(ci.value, 2), ' ', substring(ci.value, 5), ' ', RIGHT (ci.value, 4))
                        ELSE ''
                        END, ',') AS "phoneContactInfo"
            FROM db_namespace."ContactInfo" ci
            WHERE ci."personId" = pers.id
            GROUP BY ci.type) "contactInfo" ON TRUE
        LEFT JOIN LATERAL (
            SELECT
                (string_agg(concat(prop."name", '-', b."name", '-', i."name"), ' ')) AS "unitName",
                (string_agg(concat(b."name",  '-', i."name"), ' ')) AS "buildingInventoryName",
                (string_agg(concat(prop."name",  '-', b."name"), ' ')) AS "propertyBuildingName",
                COALESCE(string_agg(q."leaseStartDate"::text , ', '), '') as "leaseStartDate"
        FROM
            db_namespace."Lease" l
            LEFT JOIN db_namespace."Quote" q ON q.id = l."quoteId"
            LEFT JOIN db_namespace."Inventory" i ON i.id = q."inventoryId"
            LEFT JOIN db_namespace."Building" b ON b.id = i."buildingId"
            LEFT JOIN db_namespace."Property" prop ON prop.id = i."propertyId"
        WHERE
            l."partyId" = p.id
            AND l.status != 'voided') "unitInfo" ON TRUE
    GROUP BY  p.id, u."fullName", ac."leaseData"
                )
    SELECT
    r.id AS "partyId",
    json_build_object(
        'id', r.id,
        'partyOwner', r."partyOwner",
        'partyMembersFullNames', r."pmFullNames",
            'partyMembersPrefNames', r."pmPreferredNames",
            'partyMembersContactInfos', r."pmContactInfos",
            'createdAt', r.created_at,
            'phoneContactInfo', r."phoneContactInfo",
            'partyState', r.state,
            'moveInTime', r."moveInTime",
            'favoriteUnits', r."favoriteUnits",
            'type', 'party',
            'workflowState', r."workflowState",
            'workflowName', r."workflowName",
            'fullQualifiedName', r."fullQualifiedName",
            'teams', r.teams,
            'partyGroupId', r."partyGroupId",
            'archiveDate', r."archiveDate",
            'archiveReason', r."archiveReason",
            'activeLeaseStartDate', r."leaseStartDate",
            'leaseType', r."leaseType",
            'companyName', r."companyName") AS "partyObject",
    (setweight(to_tsvector('english'::regconfig, r."pmFullNames"), 'A') ||
    setweight(to_tsvector('english'::regconfig, r."pmPreferredNames"), 'A') ||
        CASE WHEN r."fullQualifiedName" IS NOT NULL THEN
        (setweight(to_tsvector('english'::regconfig, replace(r."fullQualifiedName", '-', '')), 'A') ||
        setweight(to_tsvector('english'::regconfig, replace(r."fullQualifiedName", '-', ' ')),'A') ||
            setweight(to_tsvector('english'::regconfig, r."fullQualifiedName"), 'A'))
    ELSE ('') END ||
        setweight(to_tsvector('simple'::regconfig, r."pmContactInfos"), 'A')
        || setweight(to_tsvector('simple' :: regconfig, coalesce(r."companyName", '')),'A')) AS "searchVector",
    setweight(to_tsvector('simple'::regconfig, r."phoneContactInfo"), 'A') AS "phoneSearchVector"
    FROM
    agg_data r
    $function$;

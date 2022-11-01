SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

/********************************************************** TYPES **********************************************************/

CREATE TYPE db_namespace.bedroom_weights AS (
	bednum integer,
	bedfactor double precision
);

/********************************************************** FUNCTIONS **********************************************************/

CREATE FUNCTION db_namespace.bedrooms(bednums integer[]) RETURNS SETOF db_namespace.bedroom_weights
LANGUAGE plpgsql
AS $$
    declare
        r db_namespace."bedroom_weights"%rowtype;
        i int;
        j int;
    begin
        foreach i in array bedNums loop
        r.bedNum := i;
        r.bedfactor := 1;
        return next r;
        for j in 1 .. 2 loop
            r.bedNum := i-j;
            r.bedfactor := .5;
            return next r;
        end loop;
        for j in 1 .. 2 loop
            r.bedNum := i+j;
            r.bedfactor := .5;
            return next r;
        end loop;
        end loop;
        -- final return
        return;
    end
$$;

CREATE FUNCTION db_namespace.generatepartysearchdata()
RETURNS void
LANGUAGE plpgsql
AS $function$
    DECLARE curs record;
    BEGIN
        DELETE FROM db_namespace."PartySearch";

        FOR curs in
            -- here we run getpartysearchrows with NULL as a param which means we'll get back all the records and regenerate all the data in the partySearch table.
            SELECT * FROM db_namespace.getpartysearchrows(NULL)
            AS f("partyId" uuid, "partyObject" json, "searchVector" tsvector, "phoneSearchVector" tsvector)
        LOOP
            INSERT INTO db_namespace."PartySearch" (id, "partyId", "partyObject", "searchVector", created_at, updated_at, "phoneSearchVector")
            VALUES ("public".gen_random_uuid(), curs."partyId", curs."partyObject", curs."searchVector", now(), now(), curs."phoneSearchVector")
            ON CONFLICT ("partyId") DO
            UPDATE SET ("partyObject", "searchVector", "phoneSearchVector") = (EXCLUDED."partyObject", EXCLUDED."searchVector", EXCLUDED."phoneSearchVector");
        END LOOP;
    END;
$function$;


CREATE FUNCTION db_namespace.generatepersonsearchdata()
RETURNS void
LANGUAGE plpgsql
AS $function$
/*
    Function that when called regenerates all the data from the PersonSearch table.
*/
    DECLARE curs record;
    BEGIN
        DELETE FROM db_namespace."PersonSearch";
        FOR curs in
            -- here we run getpersonsearchrows with NULL as a param which means we'll get back all the records and regenerate all the data in the personSearch table.
            SELECT * FROM db_namespace.getpersonsearchrows(NULL) as f("personId" uuid, "personObject" json, "searchVector" tsvector,  "phoneSearchVector" tsvector,
            "fullName" varchar, "firstName" varchar, "lastName" varchar)
        LOOP

            INSERT INTO db_namespace."PersonSearch" (id, "personId", "personObject",
            "searchVector", "fullName", "firstName", "lastName", created_at, updated_at,  "phoneSearchVector")
            Values ("public".gen_random_uuid(), curs."personId", curs."personObject", curs."searchVector",
            curs."fullName", curs."firstName", curs."lastName", now(), now(), curs."phoneSearchVector");
        END LOOP;

    END;
$function$;


CREATE FUNCTION db_namespace.getlayoutscore(inventoryid uuid, params character varying) RETURNS double precision
LANGUAGE plpgsql
AS $$
    begin
    if params = '' then
    return 0;
    else

    RETURN (select ts_rank_cd(setweight(to_tsvector(l.name), 'A'), to_tsquery(params))
            FROM db_namespace."Inventory" AS i
            LEFT OUTER JOIN db_namespace."Layout" AS l ON i."layoutId" = l."id"
            where i.id = inventoryId);
        end if;
    end;
$$;


CREATE FUNCTION db_namespace.getpersondisplayname(person_id uuid)
RETURNS character varying
LANGUAGE plpgsql
AS $function$
    BEGIN
    RETURN (SELECT
                CASE WHEN COALESCE(p."fullName", '') = '' THEN ci.value
                ELSE p."fullName"
                END
            FROM db_namespace."Person" p
            LEFT JOIN db_namespace."ContactInfo" ci ON (ci."personId" = p.id and ci."isPrimary")
            WHERE p.id = person_id
            ORDER BY type DESC
            LIMIT 1);
    END;
$function$;

CREATE FUNCTION db_namespace.getparentpartyinventoryfullqualifiedname (partyid uuid)
RETURNS TABLE (
    c_partyid uuid,
    c_activeLeaseworkflowid uuid,
    c_fullqualifiedname text)
LANGUAGE sql
AS $FUNCTION$
    WITH RECURSIVE parentpartyinventoryqualifiedname (
      id,
      seed_party_id
    ) AS (
    SELECT
        p.id AS "partyId",
        p."seedPartyId",
        ac.id as "ActiveLeaseWorkflowDataId",
        (SELECT c_fullqualifiedname from db_namespace.getinventoryfullqualifiedname((string_to_array(ac."leaseData"->>'inventoryId', ',')))) AS "fullQualifiedName"
    FROM db_namespace."Party" p
        LEFT JOIN db_namespace."Lease" l ON l."partyId" = p.id
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" ac on ac."partyId" = p.id
    WHERE
        p.id = partyid
    UNION
    SELECT
        party.id,
        party."seedPartyId",
        alwd.id as "ActiveLeaseWorkflowDataId",
        (SELECT c_fullqualifiedname from db_namespace.getinventoryfullqualifiedname((string_to_array(alwd."leaseData"->>'inventoryId', ',')))) AS "fullQualifiedName"
    FROM
        db_namespace."Party" party
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" alwd on alwd."partyId" = party.id,
        parentpartyinventoryqualifiedname
    WHERE
        parentpartyinventoryqualifiedname.seed_party_id = party.id
    ),
    parentinfo AS (
        SELECT * FROM parentpartyinventoryqualifiedname
    )
  SELECT id, "ActiveLeaseWorkflowDataId", "fullQualifiedName"
  FROM parentinfo pinfo
  WHERE "ActiveLeaseWorkflowDataId" IS NOT NULL
  LIMIT 1
$FUNCTION$;

CREATE FUNCTION db_namespace.getpartysearchrows(entityid uuid)
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

CREATE FUNCTION db_namespace.getpersonsearchrows (entityid uuid)
RETURNS SETOF record
LANGUAGE sql
AS $FUNCTION$
  /*
   Returns a record or a set of records of the "PersonSearch" table type.
   If the entityid is NULL it means we want to regenerate all the data from the PersonSearch table, otherwise only one record.
   */
  SELECT
      p.id,
      json_build_object('id', p.id,
      'fullName', db_namespace.getpersondisplayname (p."id"),
        'preferredName', p."preferredName",
        'memberState', ( SELECT "memberState" FROM db_namespace."PartyMember" WHERE "personId" = p.id LIMIT 1),
        'partyId', ( SELECT "partyId" FROM db_namespace."PartyMember" WHERE "personId" = p.id LIMIT 1),
        'type', 'person',
        'personType', 'Contact',
        'contactInfo',
        json_agg(
            json_build_object(
                          'id', ci.id,
                            'type', ci.type,
                            'value', ci.value,
                            'metadata', ci.metadata,
                            'isPrimary', ci."isPrimary",
                            'personId', ci."personId",
                            'isSpam', ci."isSpam")
          ) filter (where ci.id is not null)
        ) AS "personObject",
      ( setweight(to_tsvector('english'::regconfig, COALESCE(p."fullName", '')), 'A') ||
        setweight(to_tsvector('english'::regconfig, COALESCE(p."preferredName", '')), 'A') ||
        setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(CASE WHEN ci."type" != 'phone' THEN ci.value
        ELSE NULL END, ''), '')), 'A')) AS "searchVector",
        setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(
                      CASE WHEN ci."type" = 'phone' THEN concat(ci.value, ' ', substring(ci.value, 2), ' ', substring(ci.value, 5), ' ', right(ci.value, 4))
                      ELSE NULL END, ' '), '')), 'A') AS "phoneSearchVector",
      p."fullName" AS "fullName",
      split_part(split_part(p."fullName", ',', 1), ' ', 1) AS "firstName",
      CASE WHEN ( SELECT DISTINCT
              TRUE
          FROM
              regexp_matches(p."fullName", ' ', 'g')) THEN
          split_part(split_part(p."fullName", ',', 1), ' ', (length(split_part(p."fullName", ',', 1)) - length(replace(split_part(p."fullName", ',', 1), ' ', ''))::integer + 1))
      ELSE
          NULL
      END AS "lastName"
  FROM  db_namespace."Person" p
      LEFT JOIN db_namespace."ContactInfo" ci ON ci."personId" = p.id
  WHERE (entityId IS NULL
      OR (p.id = entityId
          OR p.id IN ( SELECT "personId" FROM db_namespace."PartyMember" WHERE "id" = entityId)
          OR p.id IN ( SELECT "personId" FROM db_namespace."ContactInfo" WHERE "id" = entityId)))
      AND p."mergedWith" IS NULL
  GROUP BY p.id
  UNION ALL
  SELECT
      u.id,
      json_build_object('id', u.id,
      'fullName', u."fullName",
      'preferredName', u."preferredName",
      'memberState',
      string_agg(array_to_string(tm."mainRoles", ', '), ' '), 'personType', 'Employee', 'type', 'person') AS "personObject",
      (setweight(to_tsvector('english'::regconfig, u."fullName"), 'A') ||
       setweight(to_tsvector('english'::regconfig, u."preferredName"), 'A') ||
        setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(u.email, ' '), '')), 'A')) AS "searchVector",
      setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(tm."directPhoneIdentifier", ''), '')), 'A') AS "phoneSearchVector",
      u."fullName" AS "fullName",
      split_part(split_part(u."fullName", ',', 1), ' ', 1) AS "firstName",
      CASE WHEN ( SELECT DISTINCT
              TRUE
          FROM
              regexp_matches(u."fullName", ' ', 'g')) THEN
          split_part(split_part(u."fullName", ',', 1), ' ', (length(split_part(u."fullName", ',', 1)) - length(replace(split_part(u."fullName", ',', 1), ' ', ''))::integer + 1))
      ELSE
          NULL
      END AS "lastName"
  FROM
      db_namespace."Users" u
      LEFT JOIN db_namespace."TeamMembers" tm ON tm."userId" = u."id"
  WHERE
      entityId IS NULL
  GROUP BY
      u.id;
$FUNCTION$;

CREATE FUNCTION db_namespace.not_allow_update_published_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
    BEGIN
        IF OLD."publishDate" IS NOT NULL THEN
        RAISE EXCEPTION 'cannot update a published quote: %', NEW."id";
        END IF;
        RETURN NEW;
    END;
$$;

CREATE FUNCTION db_namespace.updatepartysearchtbl()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
    /*
    Trigger function that is called when one of the triggers dealing with the Party Search are fired.
    It will update a specified record in the Party Search table based on what type of trigger was fired.
    */
    BEGIN
        IF (TG_OP = 'DELETE' AND TG_NAME = 'partymembertrgondeleteforpartysearch') THEN
        -- this can be raised by a delete in "PartyMember" table
        PERFORM db_namespace.insertorupdatepartysearchdata(OLD."partyId");

        ELSIF (TG_OP = 'UPDATE' AND TG_NAME = 'partymemberenddatecompanyidtrgonupdate') THEN
        -- this can be raised by an update in the party members endDate
        PERFORM db_namespace.insertorupdatepartysearchdata(OLD."partyId");
        ELSIF (TG_OP = 'UPDATE') THEN
        -- this can be raised by an update in either one of "Person", "ContactInfo" or "Party" tables
        PERFORM db_namespace.insertorupdatepartysearchdata(OLD."id");

        ELSIF (TG_OP = 'INSERT') THEN
        -- this can be raised by an insert in "PartyMember" table
        PERFORM db_namespace.insertorupdatepartysearchdata(NEW."partyId");

    END IF;
    RETURN NULL;
    END;
$function$;


CREATE FUNCTION db_namespace.updatepersonsearchtbl()
RETURNS trigger
LANGUAGE plpgsql AS
$function$
    /*
    Trigger function that is called when one of the triggers dealing with the Person Search are fired.
    It will update a specified record in the Person Search table based on what type of trigger was fired.
    */
    BEGIN
    IF (TG_OP = 'DELETE' AND TG_NAME = 'contactinfotrgondeleteforperssearch') THEN
        -- this can be raised by a delete in the "ContactInfo" table
        PERFORM db_namespace.insertorupdatepersonsearchdata(OLD."personId");

    ELSIF (TG_OP = 'DELETE') THEN
        -- this can be raised by a delete in the "Person" table
        DELETE FROM db_namespace."PersonSearch" WHERE "personId" = OLD."id";

    ELSIF (TG_OP = 'UPDATE') THEN
        -- this can be raised by an update in either one of "Person" or "ContactInfo", "PartyMember" tables
        PERFORM db_namespace.insertorupdatepersonsearchdata(OLD."id");

    ELSIF (TG_OP = 'INSERT') THEN
        -- this can be raised by an insert in "Person" or "ContactInfo", "PartyMember" tables
        PERFORM db_namespace.insertorupdatepersonsearchdata(NEW."id");

    END IF;
    RETURN NULL;
    END;
$function$;


CREATE FUNCTION db_namespace.getStartOfToday(timezone character varying)
RETURNS date
LANGUAGE plpgsql
AS $function$
    begin
        return (now() at TIME ZONE timezone)::date;
    end
$function$;


CREATE FUNCTION db_namespace.insertorupdatepartysearchdata (entityid uuid)
RETURNS void
LANGUAGE plpgsql
AS $FUNCTION$
    BEGIN
        INSERT INTO db_namespace."PartySearch" (id, "partyId", "partyObject", "searchVector", created_at, updated_at, "phoneSearchVector")
        SELECT
            "public".gen_random_uuid (),
            f."partyId",
            f."partyObject",
            f."searchVector",
            now(),
            now(),
            f."phoneSearchVector"
        FROM
            db_namespace.getpartysearchrows (entityid) AS f ("partyId" uuid,
            "partyObject" json,
            "searchVector" tsvector,
            "phoneSearchVector" tsvector)
    ON CONFLICT ("partyId")
        DO UPDATE SET
            "partyObject" = EXCLUDED."partyObject",
            "searchVector" = EXCLUDED."searchVector",
            "phoneSearchVector" = EXCLUDED."phoneSearchVector",
            "updated_at" = now();
    END;
$FUNCTION$;

CREATE FUNCTION db_namespace.insertorupdatepersonsearchdata (enitityid uuid)
RETURNS void
LANGUAGE plpgsql
AS $FUNCTION$
    DECLARE
        curs record;
    BEGIN
        FOR curs IN
        SELECT
            *
        FROM
            db_namespace.getpersonsearchrows (enitityid) AS f ("personId" uuid,
            "personObject" json,
            "searchVector" tsvector,
            "phoneSearchVector" tsvector,
            "fullName" varchar,
            "firstName" varchar,
            "lastName" varchar)
            LOOP
                INSERT INTO db_namespace."PersonSearch"
                (id, "personId", "personObject", "searchVector", "fullName", "firstName",
                "lastName", created_at, updated_at, "phoneSearchVector")
                    VALUES ("public".gen_random_uuid (), curs."personId", curs."personObject",
                    curs."searchVector", curs."fullName", curs."firstName", curs."lastName", now(), now(), curs."phoneSearchVector")
                ON CONFLICT ("personId")
                    DO UPDATE SET
                        "personObject" = curs."personObject", "searchVector" = curs."searchVector",
                        "fullName" = curs."fullName", "firstName" = curs."firstName", "lastName" = curs."lastName",
                        "updated_at" = now(), "phoneSearchVector" = curs."phoneSearchVector"
                    WHERE
                        db_namespace."PersonSearch"."personId" = curs."personId";
    END LOOP;
    END;
$FUNCTION$;

CREATE FUNCTION db_namespace.getWeakMatches("firstNameParam" varchar, "lastNameParam" varchar)
RETURNS TABLE( "id" uuid, "person" jsonb, rank float ) AS
$BODY$
    BEGIN
    IF "lastNameParam" IS NULL OR "lastNameParam" = '' THEN
        RETURN QUERY
        SELECT "personId", "personObject", GREATEST(public.similarity("firstNameParam", "firstName")::float, public.similarity("firstNameParam", "lastName")::float) AS rank
            FROM db_namespace."PersonSearch"
        WHERE "personObject"->>'personType' <> 'employee'
        AND COALESCE("personObject"->>'mergedWith', '') = ''
        AND (public.similarity("firstNameParam", "firstName") >= 0.5 OR public.similarity("firstNameParam", "lastName") >= 0.5);
    ELSE
        RETURN QUERY
        SELECT "personId", "personObject",
            CASE WHEN ((lower("firstNameParam") = lower("firstName") and lower("lastNameParam") = lower("lastName")) OR
                        (lower("firstNameParam") = lower("lastName") and lower("lastNameParam") = lower("firstName"))) THEN 10
            -- as per PM request exact matches should appear on top of the list, hence the greater number
            else public.similarity("firstNameParam", "firstName")::float
            end AS rank
            FROM db_namespace."PersonSearch"
        WHERE "personObject"->>'personType' <> 'employee'
        AND COALESCE("personObject"->>'mergedWith', '') = ''
        AND ((public.similarity("firstNameParam", "firstName") >= 0.5 AND public.difference("lastNameParam", "lastName") = 4) OR
                (public.similarity("lastNameParam", "firstName") >= 0.5 AND public.difference("firstNameParam", "lastName") = 4));
        --  The difference function converts two strings to their Soundex codes and then reports the number of matching code positions.
        --  Since Soundex codes have four characters, the result ranges from zero to four, with zero being no match and four being an exact match.
        END IF;
        END;
$BODY$
LANGUAGE plpgsql;

CREATE FUNCTION db_namespace.overlaps_inventory_hold(inventoryid UUID, reason TEXT, startdate timestamptz, enddate timestamptz, id UUID)
RETURNS BOOLEAN AS $$
    DECLARE overlap BOOLEAN;
    BEGIN
        IF $3 > $4 OR $3 IS NULL THEN
        overlap := TRUE;
        ELSE
        SELECT 1 INTO overlap
        FROM db_namespace."InventoryOnHold" ih
        WHERE ih."inventoryId" = $1 AND ih.reason = $2 AND tstzrange($3, $4) && tstzrange(ih."startDate", ih."endDate") AND ($5 IS NULL OR $5 <> ih.id);
        END IF;

        RETURN overlap;
    END;
$$ LANGUAGE plpgsql;


CREATE FUNCTION db_namespace.hasGuarantees(id UUID)
RETURNS BOOLEAN AS $$
DECLARE hasGuarantees BOOLEAN;
    BEGIN
        IF EXISTS (SELECT pm.id FROM db_namespace."PartyMember" pm WHERE pm."guaranteedBy" = $1 AND pm."endDate" IS NULL)
        THEN
        hasGuarantees := TRUE;
        ELSE
        hasGuarantees := FALSE;
        END IF;
        RETURN hasGuarantees;
    END;
$$ LANGUAGE plpgsql;


CREATE FUNCTION db_namespace.get_application_first_submitted_date("partyapplicationid" uuid, "createdat" timestamp with time zone)
RETURNS timestamp with time zone AS
$BODY$
    BEGIN
    RETURN (SELECT MAX(r.created_at) created_at
            FROM db_namespace."rentapp_SubmissionRequest" r
            WHERE r."partyApplicationId" = partyapplicationid
            AND r.created_at <= createdat
            AND r."requestType" = 'New');
    END;
$BODY$
LANGUAGE plpgsql;

CREATE FUNCTION db_namespace.buildAggregatedPartyDocument(party_id uuid)
RETURNS SETOF record
LANGUAGE sql
AS $function$
    SELECT (row_to_json(party)::jsonb ||
        json_build_object(
            'members', "members",
            'children', "children",
            'pets', "pets",
            'vehicles', "vehicles",
            'comms', "comms",
            'tasks', "tasks",
            'invOnHolds', "invOnHolds",
            'quotes', "quotes",
            'promotions', "promotions",
            'partyApplications', "partyApplications",
            'personApplications', "personApplications",
            'invoices', "invoices",
            'transactions', "transactions",
            'leases', "leases",
            'events', "events",
            'screeningResults', "screeningResults",
            'activeLeaseData', "activeLeaseData",
            'property', "property",
            'ownerTeamData', "ownerTeamData"
        )::jsonb) AS result
    FROM db_namespace."Party" party
    LEFT JOIN LATERAL (SELECT json_agg(json_build_object('partyMember', row_to_json(pm),
                                                        'person', row_to_json(person),
                                                        'contactInfo', "contactInfo".c,
                                                        'company', row_to_json(company))) AS "members"
                    FROM db_namespace."PartyMember" pm
                    INNER JOIN db_namespace."Person" person ON pm."personId" = person."id"
                    LEFT JOIN db_namespace."Company" company ON pm."companyId" = company."id"
                    LEFT JOIN LATERAL (SELECT json_agg(contact) AS c
                                        FROM db_namespace."ContactInfo" contact
                                        WHERE contact."personId" = person.id) "contactInfo" ON true
                    WHERE pm."partyId" = party.id) pm ON true
    LEFT JOIN LATERAL (SELECT json_agg(pai) as children FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='child') child ON true
    LEFT JOIN LATERAL (SELECT json_agg(pai) as pets FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='pet') pet ON true
    LEFT JOIN LATERAL (SELECT json_agg(pai) as vehicles FROM db_namespace."Party_AdditionalInfo" pai
                            WHERE pai."partyId" = party_id AND type='car') vehicle ON true
    LEFT JOIN LATERAL (SELECT json_agg(jsonb_build_object('created_at', "created_at", 'id', "id", 'parties', "parties", 'persons', "persons",
                                                        'direction', "direction", 'type', "type", 'userId', "userId", 'messageId', "messageId",
                                                        'message', "message" - 'rawMessage', 'status', "status", 'threadId', "threadId",
                                                        'teams', "teams", 'category', "category", 'unread', "unread")) as comms
                        FROM db_namespace."Communication" comm
                        WHERE ARRAY[party.id::varchar(36)] <@ comm.parties) comm ON true
    LEFT JOIN LATERAL (SELECT json_agg(task) AS tasks
                        FROM db_namespace."Tasks" task
                        WHERE task."partyId" = party.id
                        AND (task.state <> 'Canceled' OR task.name = 'APPOINTMENT')
                    ) task ON true
    LEFT JOIN LATERAL (SELECT json_agg(invOnHold) AS "invOnHolds"
                        FROM db_namespace."InventoryOnHold" invOnHold
                        WHERE invOnHold."partyId" = party.id) invOnHold ON true
    LEFT JOIN LATERAL (SELECT json_agg(quote) AS quotes
                        FROM db_namespace."Quote" quote
                        WHERE quote."partyId" = party.id) quote ON true
    LEFT JOIN LATERAL (SELECT json_agg(activeLease) AS "activeLeaseData"
                        FROM db_namespace."ActiveLeaseWorkflowData" activeLease
                        WHERE (
                            (party."workflowName" = 'activeLease' AND activeLease."partyId" = party.id) OR
                            (party."workflowName" = 'renewal' AND activeLease."partyId" = party."seedPartyId")
                        )) activeLease ON true
    LEFT JOIN LATERAL (SELECT json_agg(promotion) AS "promotions"
                        FROM db_namespace."PartyQuotePromotions" promotion
                        WHERE promotion."partyId" = party.id) promotion ON true
    LEFT JOIN LATERAL (SELECT json_agg(partyApp) AS "partyApplications"
                        FROM db_namespace."rentapp_PartyApplication" partyApp
                        WHERE partyApp."partyId" = party.id) partyApp ON true
    LEFT JOIN LATERAL (SELECT json_agg(personApp) AS "personApplications"
                        FROM db_namespace."rentapp_PersonApplication" personApp
                        WHERE personApp."partyId" = party.id) personApp ON true
    LEFT JOIN LATERAL (SELECT json_agg(invoice) AS "invoices"
                        FROM db_namespace."rentapp_ApplicationInvoices" invoice
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
                        WHERE partyApp."partyId" = party.id) invoice ON true
    LEFT JOIN LATERAL (SELECT json_agg(transaction) AS "transactions"
                        FROM db_namespace."rentapp_ApplicationTransactions" transaction
                        INNER JOIN db_namespace."rentapp_ApplicationInvoices" invoice ON transaction."invoiceId" = invoice.id
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApp ON invoice."partyApplicationId" = partyApp.id
                        WHERE partyApp."partyId" = party.id) transaction ON true
    LEFT JOIN LATERAL (SELECT json_agg(events) AS "events"
                        FROM db_namespace."PartyEvents" events
                        WHERE events."partyId" = party.id
                        AND events.transaction_id = txid_current()) events ON true
    LEFT JOIN LATERAL (SELECT json_build_object('submissionResponses', json_agg(jsonb_build_object('id', submissionResponse."id", 'status', submissionResponse."status", 'submissionRequestId', submissionResponse."submissionRequestId")),
                                                'submissionRequests', json_agg(json_build_object('id', submissionRequest."id", 'rentData', submissionRequest."rentData"))) AS "screeningResults"
                        FROM db_namespace."rentapp_SubmissionResponse" submissionResponse
                        INNER JOIN db_namespace."rentapp_SubmissionRequest" submissionRequest ON submissionResponse."submissionRequestId" = submissionRequest.id
                        INNER JOIN db_namespace."rentapp_PartyApplication" partyApplication ON submissionRequest."partyApplicationId" = partyApplication.id
                        WHERE partyApplication."partyId" = party.id AND submissionRequest."isObsolete" = false AND submissionRequest."requestType" <> 'ResetCredit') screening ON true
    LEFT JOIN LATERAL (SELECT json_agg(json_build_object('id', id, 'partyId', "partyId", 'quoteId', "quoteId", 'leaseTermId', "leaseTermId",
                                    'leaseTemplateId', "leaseTemplateId", 'status', "status", 'external', "external", 'externalLeaseId', "externalLeaseId",
                                    'created_at', created_at, 'updated_at', updated_at, 'signDate', "signDate", 'baselineData',
                                    "baselineData", 'signatures', leaseSignatures.signatures))
                                    AS "leases"
                        FROM db_namespace."Lease" lease
                        LEFT JOIN LATERAL (
                            SELECT json_agg(ls) AS signatures
                            FROM db_namespace."LeaseSignatureStatus" ls
                            WHERE ls."leaseId" = lease.id) leaseSignatures ON true
                        WHERE lease."partyId" = party_id) lease ON true
    LEFT JOIN LATERAL (SELECT json_agg(jsonb_build_object('id', id, 'name', name, 'propertyLegalName', "propertyLegalName", 'displayName', "displayName", 'timeZone', timezone, 'settings', settings->'residentservices', 'app', settings -> 'rxp' -> 'app')) AS "property"
                            FROM db_namespace."Property" property
                            WHERE property.id = party."assignedPropertyId") property ON true
    LEFT JOIN LATERAL (SELECT json_agg(ownerTeam) AS "ownerTeamData"
                            FROM db_namespace."Teams" ownerTeam
                            WHERE ownerTeam."id" = party."ownerTeam") ownerTeam ON true
    WHERE party."id" = party_id;
$function$;

CREATE FUNCTION db_namespace.notify_party_events_table_changes()
    RETURNS trigger AS $$
    DECLARE current_row RECORD;
    DECLARE party_id UUID;
    DECLARE trx_id BIGINT;
    DECLARE begin_time BIGINT;
    DECLARE end_time BIGINT;
    BEGIN
        begin_time := extract(epoch from clock_timestamp()) * 1000;
        IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        current_row := NEW;
        ELSE
        current_row := OLD;
        END IF;
        FOR party_id IN (SELECT ev."partyId" FROM db_namespace."PartyEvents" ev WHERE ev.id = current_row.id)
        LOOP
        IF party_id IS NOT NULL THEN
        -- the trigger is deffered until the end of transaction so we should generate the updated document only once
        SELECT transaction_id FROM db_namespace."PartyDocumentHistory" pdh
        WHERE pdh."partyId"=party_id
        AND pdh.transaction_id = txid_current()
        ORDER BY pdh.created_at DESC
        LIMIT 1
        INTO trx_id;
        IF trx_id IS NOT NULL THEN
            RAISE WARNING 'SKIPPING PartyDocumentHistory generation, document already generated in TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
        ELSE
            INSERT INTO db_namespace."PartyDocumentHistory"
            (id, "partyId", "document", transaction_id, triggered_by, status, created_at, updated_at)
            VALUES("public".gen_random_uuid(),
                    party_id,
                    (row_to_json(db_namespace.buildAggregatedPartyDocument(party_id))::jsonb)->'result',
                    txid_current(),
                    json_build_object('table', TG_TABLE_NAME,
                            'type', TG_OP,
                            'entity_id', current_row.id),
                    'Pending',
                    now(), now());
        END IF;
        ELSE
        RAISE WARNING 'party_id is not defined, SKIPPING PartyDocumentHistory generation TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
        END IF;
        END LOOP;
        end_time := extract(epoch from clock_timestamp()) * 1000;
        RAISE WARNING 'trigger for PartyDocumentHistory generation took TX=% OP=% TABLE=% ID=% MS=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id, (end_time - begin_time);
        RETURN current_row;
    END;
    $$ LANGUAGE plpgsql;


CREATE FUNCTION db_namespace.notify_party_history_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
    DECLARE
        current_row RECORD;
    BEGIN
        IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        current_row := NEW;
        ELSE
        current_row := OLD;
        END IF;
        PERFORM pg_notify(
        'party_updated',
        json_build_object(
            'tenantId', replace('db_namespace', '"', ''),
            'table', TG_TABLE_NAME,
            'type', TG_OP,
            'id', current_row.id
        )::text
        );
        RETURN current_row;
    END;
$function$;


CREATE FUNCTION db_namespace.getdashboarddata (p_startindex int, p_endindex int, p_ranks int[], p_teamids varchar(36)[], p_userids varchar(36)[], p_taskname varchar(50))
RETURNS TABLE (c_state varchar(50), c_total INT8, c_today INT8, c_tomorrow INT8, c_allPartyIds JSON, c_groupedParties JSON)
LANGUAGE plpgsql
AS $function$
    BEGIN
    RETURN QUERY
    WITH unread_comms AS
    (
    select "partyId", "communicationData" as comm, "communicationCreatedAt",
            row_number() OVER (PARTITION BY "partyId" ORDER BY "communicationCreatedAt" ASC) AS "ordComms",
            row_number() OVER (PARTITION BY "partyId" ORDER BY "communicationCreatedAt" DESC) AS "ordParties"
    from db_namespace."UnreadCommunication"
    ), tasks AS
    (
    SELECT
        task."partyId",
        (CASE WHEN (task.name = p_taskname) THEN 0
                -- overdue tasks
                WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) < date_trunc('day', ((NOW() - interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 1
                -- appointments for today
                WHEN task.category = 'Appointment' AND (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) <= date_trunc('day', (NOW() at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 2
                -- tasks for today
                WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) <= date_trunc('day', (NOW() at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 3
                -- appointments for tomorrow
                WHEN task.category = 'Appointment' AND (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) = date_trunc('day', ((NOW() + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 4
                -- tasks for tomorrow
                WHEN (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles'))) = date_trunc('day', ((NOW() + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) THEN 5
                -- tasks for later
                ELSE 6
            END) AS taskrank,
        (CASE WHEN task.category = 'Appointment' THEN 0 ELSE 1 END) AS is_appointment,
        (date_trunc('day', (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')))) AS task_due_day,
        (CASE WHEN task.category = 'Appointment' THEN (task."dueDate" at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) ELSE ((task."dueDate" + interval '1 day') at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) END) AS appointment_time,
        (task.created_at at TIME ZONE COALESCE(property.timezone,team."timeZone",first_team."timeZone",'America/Los_Angeles')) AS task_created_at
    FROM db_namespace."Tasks" task
        INNER JOIN db_namespace."Party" party ON task."partyId" = party.id
        LEFT JOIN db_namespace."Teams" team ON team.id = party."ownerTeam"::uuid
        LEFT JOIN db_namespace."Property" property ON property.id = party."assignedPropertyId"::uuid
        LEFT JOIN db_namespace."Teams" first_team ON first_team.id = party."teams"[0]::uuid
    WHERE
        task."userIds" && p_userids
        AND task.state <> 'Canceled' AND task.state <> 'Completed'
    ), toptasks AS
    (
    SELECT *,
        row_number() OVER (PARTITION BY "partyId" ORDER BY taskrank ASC, task_due_day ASC, is_appointment ASC, appointment_time ASC, task_created_at ASC) AS ord
    FROM tasks
    )
    SELECT
    ranked.state AS state,
    count(ranked) AS total,
    sum(CASE WHEN ranked.rank IN (0, 1, 2, 3, 4) THEN 1 ELSE 0 END) AS today,
    sum(CASE WHEN ranked.rank IN (5, 6) THEN 1 ELSE 0 END) AS tomorrow,
    json_agg(ranked.id) AS "allPartyIds",
    json_agg(row_to_json(ranked.*) ORDER BY ranked.rn ASC)
        FILTER (WHERE ranked.rn >= p_startindex
                AND ranked.rn <= p_endindex
                AND ranked.rank = ANY(p_ranks)
            ) AS "groupedParties"
    FROM (
    SELECT parties.*,
        row_number() OVER (PARTITION BY parties.state ORDER BY parties.rank, "unreadCommCreatedAt" DESC, task_due_day ASC, is_appointment ASC, appointment_time ASC, task_created_at ASC, parties.created_at DESC) AS rn
    FROM (
        SELECT
        p.id,
        CASE  WHEN (p.state = 'Resident' AND p."workflowName" = 'activeLease' AND c.comm is not null) THEN 'Lead'
                WHEN (p.state = 'Resident' AND p."workflowName" = 'activeLease' AND task.taskrank IS NOT NULL) THEN 'Prospect'

        ELSE p.state END AS state,
        (CASE WHEN (property.timezone IS NOT NULL) THEN property.timezone
                WHEN (team."timeZone" IS NOT NULL) THEN team."timeZone"
                WHEN (first_team."timeZone" IS NOT NULL) THEN first_team."timeZone"
                ELSE 'America/Los_Angeles'
        END) AS timezone,
        p.created_at,
        (CASE WHEN (task.taskrank = 0) THEN 0 --CALL_BACK tasks
            WHEN (c.comm is not null) THEN 1 --comms for today
            WHEN (task.taskrank = 1) THEN 2 --overdue tasks
            WHEN (task.taskrank = 2) THEN 3 --appointments for today
            WHEN (task.taskrank = 3) THEN 4 --tasks for today
            WHEN (task.taskrank = 4) THEN 5 --appointments for tomorrow
            WHEN (task.taskrank = 5) THEN 6 --tasks for tomorrow
            ELSE 7 --later
        END) AS rank,
        prg."displayName" as program,
        task.task_due_day,
        task.is_appointment,
        task.appointment_time,
        task.task_created_at,
        row_to_json(p) AS party,
        c2.comm AS communication,
        c."communicationCreatedAt" AS "unreadCommCreatedAt",
        alwf."leaseData" AS "activeLeaseWorkflowData",
        alwf."metadata" ->> 'vacateDate' AS "movingOutDate"
        FROM db_namespace."Party" p
        LEFT JOIN db_namespace."Teams" team ON team.id = p."ownerTeam"::uuid
        LEFT JOIN db_namespace."Property" property ON property.id = p."assignedPropertyId"::uuid
        LEFT JOIN db_namespace."Teams" first_team ON first_team.id = p."teams"[0]::uuid
        LEFT JOIN db_namespace."TeamPropertyProgram" tpc ON p."teamPropertyProgramId" = tpc.id
        LEFT JOIN db_namespace."Programs" prg ON tpc."programId" = prg.id
        LEFT JOIN toptasks task ON p.id = task."partyId" AND task.ord = 1
        LEFT JOIN unread_comms AS c ON p.id = c."partyId" AND c."ordParties" = 1
        LEFT JOIN unread_comms AS c2 ON p.id = c2."partyId" AND c2."ordComms" = 1
        LEFT JOIN db_namespace."ActiveLeaseWorkflowData" alwf ON
            (CASE WHEN (p."workflowName" = 'activeLease') THEN p.id
                ELSE p."seedPartyId"
                END
            ) = alwf."partyId"
        WHERE p."teams" && p_teamids
        AND (ARRAY[p."userId"::varchar(36)] <@ p_userids
            OR p."id" IN (SELECT "partyId"
                            FROM toptasks WHERE ord = 1)
            )
        AND (p."workflowState" = 'active'
            OR ((p."workflowState" = 'closed' or p."workflowState" = 'archived')
            AND c."partyId" IS NOT NULL)
            )
        ORDER BY taskrank ASC, p.created_at DESC
        ) AS parties
    ORDER BY rn
    ) AS ranked
    GROUP BY GROUPING SETS ((ranked.state));
    END;
$function$;


CREATE FUNCTION db_namespace.getadditionaldata(p_partyids character varying[], p_userids character varying[], p_strongmatch character varying)
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
$function$;

CREATE FUNCTION db_namespace.cleanuppartydocumenthistory(p_batchsize integer, p_versionstokeep integer, p_noofdaysfullhistory integer)
RETURNS void
LANGUAGE plpgsql
AS $function$
    DECLARE rowCount int;
    DECLARE referenceDate timestamptz;
    BEGIN
    SELECT TO_CHAR(NOW(),'YYYY-MM-DD')::timestamptz - (p_noOfDaysFullHistory || ' days')::INTERVAL INTO referenceDate; -- substract X days from today
    IF p_versionsToKeep > 0 THEN
    WITH pdhOrder AS
    (
    SELECT id,
        RANK() OVER (PARTITION BY "partyId" ORDER BY transaction_id DESC) AS ord, --keep all versions with the same last transaction_id
        updated_at
    FROM db_namespace."PartyDocumentHistory"
    )
    DELETE FROM db_namespace."PartyDocumentHistory" pdh
    USING pdhOrder
    WHERE pdhOrder.id = pdh.id
        AND pdhOrder.ord > p_versionsToKeep
        AND pdh.updated_at < referenceDate
    AND pdh.Id IN
        (
        SELECT Id FROM pdhOrder AS po WHERE po.ord > p_versionsToKeep ORDER BY po.updated_at ASC LIMIT p_batchSize
        );

    --deleting data from PartyEvents with no correspondent data in PartyDocumentHistory
    delete from db_namespace."PartyEvents" del
    using db_namespace."PartyEvents" pe
    left join db_namespace."PartyDocumentHistory" ph
    on ph."partyId"  = pe."partyId"
        and ph.transaction_id = pe.transaction_id
    where
    ph.id is null
    and del.id = pe.id
    ;

    -- get no of rows deleted
    GET DIAGNOSTICS rowCount = ROW_COUNT;
    RAISE NOTICE
    'Function cleanuppartydocumenthistory removed % PartyDocumentHistory versions for parties that were not changed in the last % day/s, keeping % version/s'
    , rowCount, p_noOfDaysFullHistory, p_versionsToKeep;
    ELSE
    RAISE NOTICE
    'Given p_versionsToKeep parameter is less than 1. If you want to delete all from PartyDocumentHistory use TRUNCATE TABLE';
    END IF;
    END;
$function$;


CREATE FUNCTION db_namespace.getinventoryfullqualifiedname(p_inventoryids varchar(36)[])
RETURNS TABLE (c_inventoryId uuid, c_fullQualifiedName text)
LANGUAGE plpgsql
AS $function$
    BEGIN
    RETURN QUERY
    WITH inventory_ids AS
    (
    SELECT UNNEST(p_inventoryids)::uuid AS "inventoryId"
    )
    SELECT i.id,
        CASE
            WHEN b.name IS NULL THEN (p.name::text || '-'::text) || i.name::text
            ELSE (((p.name::text || '-'::text) || b.name::text) || '-'::text) || i.name::text
        END AS "fullQualifiedName"
    FROM inventory_ids AS ii
        INNER JOIN db_namespace."Inventory" i ON ii."inventoryId" = i.id
        INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
        LEFT JOIN db_namespace."Building" b ON i."buildingId" = b.id;
    END;
$function$;


CREATE FUNCTION db_namespace.is_inventory_reserved(inventoryid uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
    DECLARE is_reserved BOOLEAN;
    BEGIN
    SELECT 1 INTO is_reserved
    FROM db_namespace."Inventory" i
    WHERE i."id" = $1 AND i.state IN ('occupiedNoticeReserved',
                                      'vacantMakeReadyReserved',
                                      'vacantReadyReserved',
                                      'occupied');
    END;
$function$;

CREATE FUNCTION db_namespace.cleanupleasesubmissiontracking(lst_batchSize integer, lst_versionsToKeep integer, lst_noOfDaysFullHistory integer)
/* USAGE: Delete the oldest 1000 rows with "type"='GetEnvelopeStatus', but keeping 1 version for each 'enevelopeId'; the rows updated in the last 14 days are not deleted
** SELECT db_namespace.cleanupleasesubmissiontracking(1000, 1, 14); */
RETURNS void
LANGUAGE plpgsql
AS $function$
    DECLARE rowCount int;
    DECLARE referenceDate timestamptz;
    BEGIN
    SELECT TO_CHAR(NOW(),'YYYY-MM-DD')::timestamptz - (lst_noOfDaysFullHistory || ' days')::INTERVAL INTO referenceDate; -- substract X days from today
    IF lst_versionsToKeep > 0 THEN
        WITH lstOrder AS
        (
        SELECT id,
        RANK() OVER (PARTITION BY "envelopeId" ORDER BY updated_at DESC) AS ord,
        updated_at
        FROM db_namespace."LeaseSubmissionTracking"
        WHERE type = 'GetEnvelopeStatus'
        )
        DELETE FROM db_namespace."LeaseSubmissionTracking" lst
        USING lstOrder
        WHERE lstOrder.id = lst.id
        AND lst.updated_at < referenceDate
        AND lstOrder.ord > lst_versionsToKeep;
        GET DIAGNOSTICS rowCount = ROW_COUNT;
        RAISE NOTICE 'Function cleanupleasesubmissiontracking removed % LeaseSubmissionTracking rows that were not changed in the last % day/s, keeping % version/s', rowCount, lst_noOfDaysFullHistory, lst_versionsToKeep;
    ELSE
        RAISE NOTICE 'Given lst_versionsToKeep parameter is less than 1. If you want to delete all from LeaseSubmissionTracking use TRUNCATE TABLE';
    END IF;
    END;
$function$;

CREATE FUNCTION db_namespace.update_ds_backend(ds_backend character varying = 'reva')
/* use reva ds backend: select update_ds_backend('reva');
** use corticon ds backend: select update_ds_backend('corticon'); */
RETURNS void
LANGUAGE plpgsql
AS $function$
    begin
        if lower(ds_backend) = 'reva' then
        update db_namespace."RecurringJobs" set "inactiveSince" = null where name = 'TasksFollowupParty';
        update db_namespace."Subscriptions" set "inactiveSince" = now() where decision_name = 'corticon';
        update db_namespace."Subscriptions" set "inactiveSince" = null where decision_name <> 'corticon';
        else
        update db_namespace."RecurringJobs" set "inactiveSince" = now() where name = 'TasksFollowupParty';
        update db_namespace."Subscriptions" set "inactiveSince" = null where decision_name = 'corticon';
        update db_namespace."Subscriptions" set "inactiveSince" = now() WHERE decision_name = any('{
            task:introduce_yourself,
            task:contact_back,
            task:complete_contact_info,
            task:removeAnonymousEmail,
            task:send_renewal_quote,
            task:send_renewal_reminder
        }');
        end if;
    end;
$function$;

CREATE FUNCTION db_namespace.cleanuppublicapirequesttracking(part_keepNumOfDays integer)
/* USAGE: Delete the oldest public api request tracking data and keep 1 full day of history
** SELECT db_namespace.cleanuppublicapirequesttracking(1); */
RETURNS void
LANGUAGE plpgsql
AS $function$
    DECLARE rowCount int;
    DECLARE referenceDate timestamptz;
    BEGIN
    SELECT TO_CHAR(NOW(),'YYYY-MM-DD')::timestamptz - (part_keepNumOfDays || ' days')::INTERVAL INTO referenceDate; -- substract X days from today
    DELETE FROM db_namespace."PublicApiRequestTracking" request
    WHERE request.created_at < referenceDate;
    GET DIAGNOSTICS rowCount = ROW_COUNT;
    RAISE NOTICE 'Function cleanuppublicapirequesttracking removed % PublicApiRequestTracking rows older than % day/s', rowCount, part_keepNumOfDays;
    END;
$function$;

CREATE FUNCTION db_namespace.generate_one_to_manys_data()
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
    INNER JOIN db_namespace."Users" u ON u."id" = p."userId"
    LEFT OUTER JOIN
            (SELECT ei."externalId" AS "externalId", ei."externalProspectId", pm."partyId", pm."personId"
                    FROM db_namespace."PartyMember" pm
                    LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id AND ei."endDate" IS NULL
                    WHERE pm."endDate" IS NULL AND (ei."isPrimary" = 'true')
            ) pm ON pm."partyId" = p.id
    LEFT OUTER JOIN
            (SELECT c.type AS "firstConType",
            *
            FROM
                    (SELECT unnest(parties)::uuid AS "partyId",
                            *
                    FROM db_namespace."Communication") c
            INNER JOIN
                    (SELECT unnest(parties)::uuid AS "Party",
                            min(created_at) AS "dtCreated"
                    FROM db_namespace."Communication"
                    GROUP BY unnest(parties)) minCom ON minCom."Party" = c."partyId" AND minCom."dtCreated" = c.created_at) firstCon ON firstCon."partyId" = p."id"
    LEFT OUTER JOIN
    (select * from (
                    select  t1."partyId",
                            t1.created_at as "created_at",
                            CAST(t1.metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                            CAST(t1.metadata ->> 'endDate' as TIMESTAMPTZ) as "TourEndDate",
                            t1.metadata ->> 'appointmentResult' as "tourResult",
                            row_number() over (partition by t1."partyId" order by t1.metadata ->> 'startDate', t1.created_at) as "rowNum"
                    from db_namespace."Tasks" t1
                    inner join (
                                    select  "partyId",
                                            MIN(created_at) as "created_at"
                                    from db_namespace."Tasks"
                                    where   name = 'APPOINTMENT'
                                    group by "partyId"
                            ) firstTour on firstTour."partyId" = t1."partyId" and firstTour.created_at = t1.created_at
                            ) rows
            where rows."rowNum" = 1
            ) AS LSTour ON LSTour."partyId" = p."id"
    LEFT OUTER JOIN
            (SELECT  p."id" AS "partyId",
                    con.created_at AS "contactDate"
            FROM db_namespace."Party" p
            left outer join
                    (SELECT c."partyId",
                            MIN(c.created_at) as "created_at"
                    FROM
                            (SELECT unnest(parties)::uuid AS "partyId",
                                    *
                            FROM db_namespace."Communication" ) c
                    where  c.type = 'ContactEvent' OR
                            (c.type = 'Call' AND c.direction = 'out') OR
                            (c.type = 'Call' AND c.direction = 'in' AND c.message ->> 'isMissed' <> 'true' AND c.message ->> 'isVoiceMail' <> 'true') OR
                            (c.type = 'Email' AND c.direction = 'out') OR
                            (c.type = 'Sms' AND c.direction = 'out') OR
                            (c.type = 'Web' AND c.direction = 'out') /*Not sure if this is possible*/
                    group by c."partyId" ) con on con."partyId" = p."id" ) agentCon on agentCon."partyId" = p."id"
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
    INNER JOIN db_namespace."Users" u ON u."id" = p."userId"
    INNER JOIN
            (SELECT "partyId",
                    MIN(CAST(metadata ->> 'endDate' AS TIMESTAMPTZ)) AS "eventDate"
            FROM db_namespace."Tasks"
            WHERE  name = 'APPOINTMENT'
                    AND state = 'Completed'
                    AND metadata ->> 'appointmentResult' = 'COMPLETE'
            GROUP BY "partyId" ) AS tour ON tour."partyId" = p."id"
    LEFT OUTER JOIN
            (SELECT ei."externalId" AS "externalId", ei."externalProspectId", pm."partyId", pm."personId"
                    FROM db_namespace."PartyMember" pm
                    LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id AND ei."endDate" IS NULL
                    WHERE pm."endDate" IS NULL AND (ei."isPrimary" = 'true')
            ) pm ON pm."partyId" = p.id
    LEFT OUTER JOIN
            (SELECT c.type AS "firstConType",
            *
            FROM
            (SELECT unnest(parties)::uuid AS "partyId",
                    *
            FROM db_namespace."Communication") c
            INNER JOIN
            (SELECT unnest(parties)::uuid AS "Party",
                    min(created_at) AS "dtCreated"
            FROM db_namespace."Communication"
            GROUP BY unnest(parties)) minCom ON minCom."Party" = c."partyId"
            AND minCom."dtCreated" = c.created_at) firstCon ON firstCon."partyId" = p."id"
    LEFT OUTER JOIN
    (select * from (
                    select  t1."partyId",
                            t1.created_at as "created_at",
                            CAST(t1.metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                            CAST(t1.metadata ->> 'endDate' as TIMESTAMPTZ) as "TourEndDate",
                            t1.metadata ->> 'appointmentResult' as "tourResult",
                            row_number() over (partition by t1."partyId" order by t1.metadata ->> 'startDate', t1.created_at) as "rowNum"
                    from db_namespace."Tasks" t1
                    inner join (
                                    select  "partyId",
                                            MIN(created_at) as "created_at"
                                    from db_namespace."Tasks"
                                    where   name = 'APPOINTMENT'
                                    group by "partyId"
                            ) firstTour on firstTour."partyId" = t1."partyId" and firstTour.created_at = t1.created_at
                            ) rows
            where rows."rowNum" = 1
            ) AS LSTour ON LSTour."partyId" = p."id"
    LEFT OUTER JOIN
            (SELECT  p."id" AS "partyId",
                    con.created_at AS "contactDate"
            FROM db_namespace."Party" p
            left outer join
                    (SELECT c."partyId",
                            MIN(c.created_at) as "created_at"
                    FROM
                            (SELECT unnest(parties)::uuid AS "partyId",
                                    *
                            FROM db_namespace."Communication" ) c
                    where  c.type = 'ContactEvent' OR
                            (c.type = 'Call' AND c.direction = 'out') OR
                            (c.type = 'Call' AND c.direction = 'in' AND c.message ->> 'isMissed' <> 'true' AND c.message ->> 'isVoiceMail' <> 'true') OR
                            (c.type = 'Email' AND c.direction = 'out') OR
                            (c.type = 'Sms' AND c.direction = 'out') OR
                            (c.type = 'Web' AND c.direction = 'out') /*Not sure if this is possible*/
                    group by c."partyId" ) con on con."partyId" = p."id" ) agentCon on agentCon."partyId" = p."id"
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
            --AND p."workflowName" = 'newLease'
    UNION ALL
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
    INNER JOIN db_namespace."Users" u ON u."id" = p."userId"
    LEFT OUTER JOIN
            (select  "partyId",
                    "signDate" as "eventDate"
            from db_namespace."Lease"
            where status = 'executed' ) AS sale ON sale."partyId" = p."id"
    LEFT OUTER JOIN
            (SELECT ei."externalId" AS "externalId", ei."externalProspectId", pm."partyId", pm."personId"
                    FROM db_namespace."PartyMember" pm
                    LEFT OUTER JOIN db_namespace."ExternalPartyMemberInfo" ei ON ei."partyMemberId" = pm.id AND ei."endDate" IS NULL
                    WHERE pm."endDate" IS NULL AND (ei."isPrimary" = 'true')
            ) pm ON pm."partyId" = p.id
    LEFT OUTER JOIN
            (SELECT c.type AS "firstConType",
                    *
            FROM
                    (SELECT unnest(parties)::uuid AS "partyId",
                            *
                    FROM db_namespace."Communication") c
            INNER JOIN
                    (SELECT unnest(parties)::uuid AS "Party",
                            min(created_at) AS "dtCreated"
                    FROM db_namespace."Communication"
                    GROUP BY unnest(parties)) minCom ON minCom."Party" = c."partyId"
                    AND minCom."dtCreated" = c.created_at) firstCon ON firstCon."partyId" = p."id"
    LEFT OUTER JOIN
    (select * from (
                    select  t1."partyId",
                            t1.created_at as "created_at",
                            CAST(t1.metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate",
                            CAST(t1.metadata ->> 'endDate' as TIMESTAMPTZ) as "TourEndDate",
                            t1.metadata ->> 'appointmentResult' as "tourResult",
                            row_number() over (partition by t1."partyId" order by t1.metadata ->> 'startDate', t1.created_at) as "rowNum"
                    from db_namespace."Tasks" t1
                    inner join (
                                    select  "partyId",
                                            MIN(created_at) as "created_at"
                                    from db_namespace."Tasks"
                                    where   name = 'APPOINTMENT'
                                    group by "partyId"
                            ) firstTour on firstTour."partyId" = t1."partyId" and firstTour.created_at = t1.created_at
                            ) rows
            where rows."rowNum" = 1
            ) AS LSTour ON LSTour."partyId" = p."id"
    LEFT OUTER JOIN
            (SELECT  p."id" AS "partyId",
                    con.created_at AS "contactDate"
            FROM db_namespace."Party" p
            left outer join
                    (SELECT c."partyId",
                            MIN(c.created_at) as "created_at"
                    FROM
                            (SELECT unnest(parties)::uuid AS "partyId",
                                    *
                            FROM db_namespace."Communication" ) c
                    where  c.type = 'ContactEvent' OR
                            (c.type = 'Call' AND c.direction = 'out') OR
                            (c.type = 'Call' AND c.direction = 'in' AND c.message ->> 'isMissed' <> 'true' AND c.message ->> 'isVoiceMail' <> 'true') OR
                            (c.type = 'Email' AND c.direction = 'out') OR
                            (c.type = 'Sms' AND c.direction = 'out') OR
                            (c.type = 'Web' AND c.direction = 'out') /*Not sure if this is possible*/
                    group by c."partyId" ) con on con."partyId" = p."id" ) agentCon on agentCon."partyId" = p."id"
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
            AND (p.metadata->>'archiveReasonId' IS NULL OR p.metadata->>'archiveReasonId' != 'MERGED_WITH_ANOTHER_PARTY')
            AND sale."eventDate" > NOW() - INTERVAL '14 months';
    END;
$function$;

CREATE FUNCTION db_namespace.insert_user_status_history()
    RETURNS trigger
    LANGUAGE plpgsql
AS $function$
    BEGIN
        IF NEW.metadata ->> 'status' <> OLD.metadata ->>'status' THEN
        INSERT INTO db_namespace."UserStatusHistory"(id, "userId", status, pid)
        VALUES("public".gen_random_uuid(), NEW.id, NEW.metadata ->> 'status', pg_backend_pid());
    ELSE
        RETURN NULL;
    END IF;
        RETURN NULL;
    END;
$function$;

/********************************************************** TABLES **********************************************************/

SET default_tablespace = '';
SET default_with_oids = false;

CREATE TABLE db_namespace."ActiveLeaseWorkflowData" (
      	id uuid NOT NULL,
      	"leaseId" uuid,
        "partyId" uuid NOT NULL,
        "leaseData" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "recurringCharges" jsonb NOT NULL DEFAULT '[]',
        "isImported" boolean NOT NULL DEFAULT 'false',
      	created_at timestamptz NOT NULL DEFAULT now(),
      	updated_at timestamptz NOT NULL DEFAULT now(),
        "rentableItems" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "state" text DEFAULT 'none',
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "rolloverPeriod" text DEFAULT 'none',
        "externalLeaseId" text NULL,
        "isExtension" bool DEFAULT FALSE,
        "concessions" jsonb NOT NULL DEFAULT '[]'::jsonb
      );

CREATE TABLE db_namespace."ActivityLog" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    component character varying(255) NOT NULL,
    details jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    "subComponent" character varying(255) NULL
);

CREATE TABLE db_namespace."Address" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "addressLine1" character varying(256) NOT NULL,
    "addressLine2" character varying(256),
    city character varying(128) NOT NULL,
    state character varying(2),
    "postalCode" character varying(10) NOT NULL,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone
);

CREATE TABLE db_namespace."Amenity" (
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now(),
	id uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	category varchar(80) NOT NULL,
	"subCategory" varchar(80) NOT NULL,
	description text NULL,
	hidden bool NULL DEFAULT false,
	"propertyId" uuid NULL,
	"displayName" varchar(200) NOT NULL,
	"highValue" bool NULL DEFAULT false,
	"relativePrice" numeric(7, 2) NULL DEFAULT '0'::numeric,
	"absolutePrice" numeric(7, 2) NULL DEFAULT '0'::numeric,
	"targetUnit" bool NULL DEFAULT false,
	"infographicName" varchar(200) NULL,
	"order" int4 NULL DEFAULT 0,
	"externalId" varchar(255) NULL,
	"endDate" timestamptz NULL
);

CREATE TABLE db_namespace."AnalyticsLog" (
    id uuid NOT NULL,
    type character varying(255) NOT NULL,
    component character varying(255) NOT NULL,
    "activityDetails" jsonb DEFAULT '{}'::jsonb NOT NULL,
    entity jsonb DEFAULT '{}'::jsonb NOT NULL,
    context jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "subComponent" character varying(255) NULL
);

CREATE TABLE db_namespace."AppSettings" (
    id uuid NOT NULL,
    category varchar(255) NULL,
    description varchar(255) NULL,
    "datatype" varchar(255) NOT NULL,
    key varchar NOT NULL,
    value varchar NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE db_namespace."ApplicantData" (
	"id" UUID NOT NULL,
	"personId" UUID NOT NULL,
	"propertyId" UUID NOT NULL,
	"applicationData" JSONB NOT NULL DEFAULT '{}',
	"applicationDataTimestamps" JSONB NULL,
	"applicationDataDiff" JSONB NULL,
	"startDate" TIMESTAMPTZ NOT NULL,
	"endDate" TIMESTAMPTZ NULL,
	"validUntil" TIMESTAMPTZ NULL,
	"updatedByUserId" UUID NULL,
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE db_namespace."ApplicantDataNotCommitted" (
	"id" UUID NOT NULL,
	"personId" UUID NOT NULL,
	"partyId" UUID NOT NULL,
	"partyApplicationId" UUID NOT NULL,
	"applicationData" JSONB NOT NULL DEFAULT '{}',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"paymentCompleted" BOOLEAN DEFAULT FALSE
);

CREATE TABLE db_namespace."ApplicantReport" (
	"id" UUID NOT NULL,
	"personId" UUID NOT NULL,
	"reportName" VARCHAR(255) NOT NULL,
	"applicantDataId" UUID NOT NULL,
	"status" VARCHAR(255) NOT NULL,
	"serviceStatus" JSONB NULL,
	"completedAt" TIMESTAMPTZ NULL,
	"mergedAt" TIMESTAMPTZ NULL,
	"validUntil" TIMESTAMPTZ NULL,
	"obsoletedBy" UUID NULL,
	"creditBureau" VARCHAR(255) NULL,
	"reportData" JSONB NOT NULL DEFAULT '{}',
	"reportDocument" TEXT NULL,
	"isAlerted" BOOLEAN NOT NULL DEFAULT '0',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE db_namespace."ApplicantReportRequestTracking" (
	"id" UUID NOT NULL,
	"applicantReportId" UUID NOT NULL,
	"personId" UUID NOT NULL,
	"reportName" VARCHAR(255) NOT NULL,
	"requestApplicantId" UUID NOT NULL,
	"propertyId" UUID NOT NULL,
	"requestType" VARCHAR(255) NOT NULL,
	"forcedNew" BOOLEAN NOT NULL DEFAULT '0',
	"rawRequest" TEXT NULL,
	"externalReportId" VARCHAR(255) NULL,
	"isAlerted" BOOLEAN NOT NULL DEFAULT '0',
	"isObsolete" BOOLEAN NOT NULL DEFAULT '0',
	"requestEndedAt" TIMESTAMPTZ NULL,
    "hasTimedOut" BOOLEAN DEFAULT '0',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE db_namespace."ApplicantReportResponseTracking" (
	"id" UUID NOT NULL,
	"screeningRequestId" UUID NOT NULL,
	"status" VARCHAR(255) NULL,
	"blockedReason" VARCHAR(255) NULL,
	"serviceStatus" JSONB NULL,
	"serviceBlockedStatus" TEXT NULL,
	"rawResponse" TEXT NULL,
    "origin" VARCHAR(80) DEFAULT 'http',
	"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ApplicantReportResponseTracking_origin_check" CHECK (origin = 'http' OR origin = 'push' OR origin = 'poll')
);

CREATE TABLE db_namespace."Assets" (
    uuid uuid NOT NULL,
    path character varying(255),
    entity jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "physicalAssetId" uuid NULL
);

CREATE TABLE db_namespace."Associated_Fee" (
    "primaryFee" uuid NOT NULL,
    "associatedFee" uuid NOT NULL,
    "isAdditional" boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."Building" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "displayName" character varying(200) NOT NULL,
    type character varying(80) NOT NULL,
    "propertyId" uuid NOT NULL,
    description text,
    "addressId" uuid NOT NULL,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "floorCount" integer DEFAULT 1,
    "surfaceArea" numeric(7,2),
	"externalId" character varying(255) NULL,
    inactive bool NULL DEFAULT false
);

CREATE TABLE db_namespace."Building_Amenity" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "buildingId" uuid NOT NULL,
    "amenityId" uuid NOT NULL
);

CREATE TABLE db_namespace."BusinessEntity" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    type character varying(80) NOT NULL,
    expertise character varying(200),
    description text,
    "addressId" uuid NOT NULL,
    website character varying(200)
);

CREATE TABLE db_namespace."CallDetails" (
	id uuid NOT NULL,
	"commId" uuid NOT NULL,
	details jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."CallQueue" (
	id uuid NOT NULL,
	"commId" uuid NOT NULL,
	"teamId" uuid NOT NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now(),
	"lockedForDequeue" bool NOT NULL DEFAULT false,
	"declinedByUserIds" character varying[] NOT NULL DEFAULT '{}'::character varying[],
	"firedCallsToAgents" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."CallQueueStatistics" (
	id uuid NOT NULL,
	"communicationId" uuid NOT NULL,
	"entryTime" timestamptz NOT NULL,
	"exitTime" timestamptz,
	"hangUp" bool,
	"userId" uuid,
	"callBackTime" timestamptz,
	"transferredToVoiceMail" bool,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"callBackCommunicationId" uuid,
	"callerRequestedAction" text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."Campaigns" (
    "id"          UUID NOT NULL,
    "name"        TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."CommsTemplate" (
	id uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"displayName" varchar(255) NOT NULL,
	description text NULL,
	"emailSubject" text NULL,
	"emailTemplate" text NOT NULL,
	"smsTemplate" text NOT NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS db_namespace."CommsTemplateSettings"(
    id UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    section TEXT NOT NULL,
    action TEXT NOT NULL,
    "templateId" UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE db_namespace."Communication" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    parties character varying[],
    persons character varying[],
    direction character varying(255),
    type character varying(255),
    "userId" uuid,
    "messageId" character varying(500),
    message jsonb,
    status jsonb,
    "threadId" text,
    teams uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    category character varying(255),
    unread bool NULL DEFAULT false,
	"teamPropertyProgramId" uuid NULL,
	"transferredFromCommId" uuid NULL,
    "readBy" uuid NULL,
	"readAt" timestamptz NULL,
    "calledTeam" UUID,
    "partyOwner" UUID,
    "partyOwnerTeam" UUID,
    "fallbackTeamPropertyProgramId" UUID NULL,
    CONSTRAINT "Communication_type_category_check" CHECK ((((type)::text <> 'Email'::text) OR (category IS NOT NULL)))
);
COMMENT ON COLUMN db_namespace."Communication".status IS '{[{status: Delivery/Bounce, address: recipient1}, {status: Delivery/Bounce, address: recipient2}]}';
COMMENT ON COLUMN db_namespace."Communication"."threadId" IS 'Will be of the form $type_$routedTo_$[persons]';

CREATE TABLE db_namespace."CommunicationDrafts" (
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	id uuid NOT NULL,
	"partyId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"threadId" text,
	"type" character varying(255) NOT NULL,
	recipients jsonb NOT NULL DEFAULT '{}'::jsonb,
	"data" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."CommunicationSpam" (
    id uuid NOT NULL,
    "from" character varying(255) NOT NULL,
    type text NOT NULL,
    message jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT "CommunicationSpam_type_check" CHECK ((type = ANY (ARRAY['Email'::text, 'Sms'::text, 'Call'::text, 'Web'::text, 'Walk-in'::text])))
);

CREATE TABLE db_namespace."Company" (
	id uuid NOT NULL,
	"displayName" varchar(255) NOT NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."Concession" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyId" uuid NOT NULL,
    description text,
    "relativeAdjustment" numeric(7,2) DEFAULT '0'::numeric,
    "absoluteAdjustment" numeric(7,2) DEFAULT '0'::numeric,
    "variableAdjustment" boolean DEFAULT false,
    optional boolean DEFAULT false,
    recurring boolean DEFAULT false,
    "recurringCount" integer DEFAULT 0,
    "nonRecurringAppliedAt" character varying(200),
    "matchingCriteria" text,
    "leaseState" character varying(80),
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    account integer DEFAULT 0,
    "subAccount" integer DEFAULT 0,
    taxable boolean DEFAULT false,
    "hideInSelfService" boolean,
    "displayName" character varying(200) NOT NULL,
    "excludeFromRentFlag" boolean DEFAULT false NOT NULL,
    "externalChargeCode" character varying(255),
    "bakedIntoAppliedFeeFlag" boolean DEFAULT false NOT NULL,
    "relativeDefaultAdjustment" numeric(8,2) NULL,
	"absoluteDefaultAdjustment" numeric(8,2) NULL,
    "adjustmentFloorCeiling" text NULL,
    CONSTRAINT "Concession_relativeAdjustment_absoluteAdjustment_check" CHECK ((("relativeAdjustment" IS NOT NULL) OR ("absoluteAdjustment" IS NOT NULL))),
    CONSTRAINT "Concession_adjustmentFloorCeiling_check" CHECK (("adjustmentFloorCeiling" = ANY (ARRAY['floor'::text, 'ceiling'::text])))
);
COMMENT ON COLUMN db_namespace."Concession"."relativeAdjustment" IS 'Values represent percentaje (%)';
COMMENT ON COLUMN db_namespace."Concession"."absoluteAdjustment" IS 'Values represent amount ($)';

CREATE TABLE db_namespace."Concession_Fee" (
    id uuid NOT NULL,
    "concessionId" uuid NOT NULL,
    "feeId" uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."ContactInfo" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    type text NOT NULL,
    value character varying(255) NOT NULL,
    imported boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "personId" uuid NOT NULL,
    "isSpam" boolean DEFAULT false,
    "markedAsSpamBy" uuid,
    "isPrimary" bool DEFAULT false,
    CONSTRAINT "ContactInfo_type_check" CHECK ((type = ANY (ARRAY['phone'::text, 'email'::text, 'other'::text]))),
    CONSTRAINT "ContactInfo_value_check" CHECK (((value)::text <> ''::text)),
    CONSTRAINT "ContactInfo_value_lowercase_check" CHECK (value = lower(value)),
    CONSTRAINT "ContactInfo_email_check" CHECK (type != 'email' OR (type = 'email' AND value ~ '^[-!#$%&''*+\/0-9=\?A-Z^_a-z{|}~](\.\?[-!#$%&''*+\/0-9=\?A-Z^_a-z\`{|}~])*@[a-zA-Z0-9](-\?\.\?[a-zA-Z0-9])*\.[a-zA-Z](-\?[a-zA-Z0-9])+$')),
    CONSTRAINT "ContactInfo_phone_check" CHECK (type != 'phone' OR (type = 'phone' AND value ~ '^\d+$'))
);

CREATE TABLE db_namespace."DirectMessageNotification" (
	id uuid NOT NULL,
	"communicationId" uuid NOT NULL,
	message text NULL,
	status text NULL,
	"errorReason" text NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"propertyId" uuid NOT NULL
);

CREATE TABLE db_namespace."DelayedMessages" (
          id uuid NOT NULL,
          message jsonb NULL,
          status varchar(30) NULL,
          created_at timestamptz NULL DEFAULT now(),
          updated_at timestamptz NULL DEFAULT now(),
          "partyId" uuid NULL
        );

CREATE TABLE db_namespace."Disclosure" (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    "displayName" character varying(255) NOT NULL,
    "displayOrder" integer,
    "displayHelp" character varying(255),
    "descriptionHelper" character varying(255) NOT NULL,
    "requireApplicationReview" boolean DEFAULT false,
    "showInApplication" boolean DEFAULT false,
    "showInParty" boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."Documents" (
    uuid uuid NOT NULL,
    "accessType" character varying(255),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    context text
);

CREATE TABLE db_namespace."ExceptionReport" (
    id uuid NOT NULL,
    "externalId" text,
    "residentImportTrackingId" uuid,
    "conflictingRule" varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    "reportData" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "ruleId" VARCHAR(80) NOT NULL,
    "exceptionType" VARCHAR(255) NOT NULL,
    "unit" VARCHAR(80),
    "ignore" BOOLEAN NOT NULL DEFAULT FALSE,
    "ignoreReason" JSONB
);

CREATE TABLE db_namespace."ExistingResidents" (
	id uuid NOT NULL,
	"personId" uuid NOT NULL,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."ExportLog" (
	id uuid NOT NULL,
	"type" text NOT NULL,
	"partyId" uuid NOT NULL,
	"data" jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	"leaseId" uuid,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    processed timestamptz NULL,
	"externalId" varchar(50) NULL,
	entries text NULL,
    "status" varchar NOT NULL DEFAULT 'pending',
    "propertyId" UUID
);

CREATE TABLE db_namespace."ExternalPartyMemberInfo" (
	id uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"partyId" uuid NOT NULL,
	"partyMemberId" uuid NULL,
	"childId" uuid NULL,
	"leaseId" uuid NULL,
	"startDate" timestamptz NOT NULL DEFAULT now(),
	"endDate" timestamptz NULL,
	"externalId" varchar(255) NULL,
	"externalProspectId" varchar(255) NULL,
	"externalRoommateId" varchar(255) NULL,
	"isPrimary" bool NOT NULL DEFAULT false,
	"metadata" jsonb NULL DEFAULT '{}'::jsonb,
    "propertyId" uuid NOT NULL
);

CREATE TABLE db_namespace."ExternalPhones" (
	id uuid NOT NULL,
	"number" character varying(255) NOT NULL,
	"displayName" character varying(255) NOT NULL,
	"propertyId" uuid,
	"teamIds" uuid[] NOT NULL DEFAULT '{}'::uuid[],
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."Fee" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyId" uuid NOT NULL,
    "displayName" character varying(200) NOT NULL,
    description text,
    "feeType" character varying(80) NOT NULL,
    "quoteSectionName" character varying(80),
    "maxQuantityInQuote" integer,
    "servicePeriod" character varying(80),
    "variableAdjustment" boolean DEFAULT false,
    estimated boolean DEFAULT false,
    "relativePrice" numeric(7,2),
    "absolutePrice" numeric(7,2),
    "depositInterest" boolean DEFAULT false NOT NULL,
    "externalChargeCode" character varying(255),
    "externalChargeAccount" character varying(255) NULL,
	"externalChargeAccrualAccount" character varying(255) NULL,
	"externalChargeNotes" character varying(255) NULL,
	"externalChargeRef" character varying(255) NULL,
	"externalReceiptAccount" character varying(255) NULL,
	"externalReceiptAccrualAccount" character varying(255) NULL,
	"externalReceiptOffset" character varying(255) NULL,
	"externalReceiptNotes" character varying(255) NULL,
	"externalReceiptRef" character varying(255) NULL,
	"externalWaiverAccount" character varying(255) NULL,
	"externalWaiverAccrualAccount" character varying(255) NULL,
	"externalWaiverOffset" character varying(255) NULL,
	"externalWaiverNotes" character varying(255) NULL,
	"externalWaiverRef" character varying(255) NULL,
	"relativeDefaultPrice" numeric(8,2) NULL,
	"absoluteDefaultPrice" numeric(8,2) NULL,
    "priceFloorCeiling" text NULL,
    "marketingQuestionId" uuid NULL,
    "quotePaymentScheduleFlag" BOOLEAN,
    "leaseState" VARCHAR(80),
    "renewalLetterDisplayFlag" BOOLEAN DEFAULT FALSE,
    CONSTRAINT "Fee_priceFloorCeiling_check" CHECK (("priceFloorCeiling" = ANY (ARRAY['floor'::text, 'ceiling'::text]))),
    CONSTRAINT "Fee_leaseState_check" CHECK (("leaseState" = ANY (ARRAY['new', 'renewal'])))
);

 CREATE TABLE db_namespace."FloatingMemberAvailability" (
    id uuid NOT NULL,
    "teamMemberId" uuid NOT NULL,
    "day" date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    "modifiedBy" uuid NOT NULL
);

 CREATE TABLE db_namespace."ForwardedCommunications" (
	id uuid NOT NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now(),
	type varchar(255) NOT NULL,
	"messageId" varchar(255) NOT NULL,
	"programContactData" varchar(255) NOT NULL,
	message jsonb NOT NULL,
    "forwardedTo" varchar(255) NOT NULL,
    "receivedFrom" varchar(255) NOT NULL,
    status jsonb NOT NULL,
    "programId" uuid NOT NULL
);

CREATE TABLE db_namespace."ImportFilesChecksums" (
    id uuid NOT NULL,
    fileName varchar(255) NOT NULL,
    checksum varchar(255) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE db_namespace."Inventory" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyId" uuid NOT NULL,
    "multipleItemTotal" integer DEFAULT 0,
    description text,
    type character varying(80) NOT NULL,
    floor integer DEFAULT 1,
    "layoutId" uuid,
    "inventoryGroupId" uuid NOT NULL,
    "buildingId" uuid,
    "parentInventory" uuid,
    state character varying(255) DEFAULT 'vacantReady'::character varying NOT NULL,
    "stateStartDate" timestamp with time zone DEFAULT now() NOT NULL,
    "externalId" character varying(255),
    address character varying(255) NULL,
	"rmsExternalId" character varying(255) NULL,
    "availabilityDate" timestamptz NULL,
    inactive bool NULL DEFAULT false,
    "lossLeaderUnit" timestamptz NULL
);

CREATE TABLE db_namespace."InventoryGroup" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyId" uuid NOT NULL,
    "displayName" character varying(200) NOT NULL,
    description text,
    "leaseNameId" uuid,
    "basePriceMonthly" numeric(7,2) DEFAULT '0'::numeric,
    "basePriceWeekly" numeric(7,2) DEFAULT '0'::numeric,
    "basePriceDaily" numeric(7,2) DEFAULT '0'::numeric,
    "basePriceHourly" numeric(7,2) DEFAULT '0'::numeric,
    "primaryRentable" boolean DEFAULT false,
    "economicStatus" character varying(80),
    "rentControl" boolean DEFAULT false,
    affordable boolean DEFAULT false,
    "feeId" uuid,
    "inventoryType" character varying(255) DEFAULT ''::character varying NOT NULL,
	"externalId" character varying(255) NULL,
    inactive bool NULL DEFAULT false
);

CREATE TABLE db_namespace."InventoryGroup_Amenity" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "inventoryGroupId" uuid NOT NULL,
    "amenityId" uuid NOT NULL
);

CREATE TABLE db_namespace."InventoryOnHold" (
	"inventoryId" uuid NOT NULL,
	"partyId" uuid NOT NULL,
	"startDate" timestamptz NOT NULL,
	"endDate" timestamptz,
	reason text NOT NULL,
	quotable bool NOT NULL,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	"heldBy" uuid,
	"releasedBy" uuid,
	id uuid NOT NULL DEFAULT gen_random_uuid(),
    "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
	CONSTRAINT "InventoryOnHold_unique_hold_check" CHECK ((db_namespace.overlaps_inventory_hold("inventoryId", reason, "startDate", "endDate", id) = false)),
    CONSTRAINT "InventoryOnHold_inventoryId_check" CHECK ((db_namespace.is_inventory_reserved("inventoryId") = null))
);

CREATE TABLE db_namespace."Inventory_Amenity" (
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now(),
	id uuid NOT NULL,
	"inventoryId" uuid NOT NULL,
	"amenityId" uuid NOT NULL,
	"endDate" timestamptz NULL
);

CREATE TABLE db_namespace."Jobs" (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "createdBy" uuid,
    steps jsonb DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	category text NULL
);

CREATE TABLE db_namespace."Layout" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    "propertyId" uuid NOT NULL,
    "numBedrooms" numeric(6,1) DEFAULT '0'::numeric NOT NULL,
    "numBathrooms" numeric(6,1) DEFAULT '0'::numeric NOT NULL,
    "surfaceArea" numeric(7,2),
    "displayName" character varying(200) NOT NULL,
    "floorCount" integer DEFAULT 1,
    "inventoryType" character varying(255) DEFAULT ''::character varying NOT NULL,
    "inactive" bool NULL DEFAULT false,
    "marketingLayoutId" uuid,
    "marketingVideoAssets" VARCHAR[] NULL DEFAULT '{}'::CHARACTER VARYING[],
    "marketing3DAssets" VARCHAR[] NULL DEFAULT '{}'::CHARACTER VARYING[]
);
COMMENT ON COLUMN db_namespace."Layout"."surfaceArea" IS 'Represents the area size';

CREATE TABLE db_namespace."Layout_Amenity" (
    id uuid NOT NULL,
    "layoutId" uuid NOT NULL,
    "amenityId" uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."Lease" (
    id uuid NOT NULL,
    "partyId" uuid NOT NULL,
    "quoteId" uuid NOT NULL,
    "leaseTermId" uuid NOT NULL,
    "leaseTemplateId" uuid NOT NULL,
    "leaseData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    versions jsonb DEFAULT '{}'::jsonb,
    status character varying(255) DEFAULT 'DRAFT'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "baselineData" jsonb DEFAULT '{}'::jsonb,
    "signDate" timestamp with time zone,
    "external" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "externalLeaseId" text NULL,
	modified_by uuid NULL
);

CREATE TABLE db_namespace."LeaseDocumentTemplate" (
	id uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"displayName" varchar(255) NOT NULL,
	category varchar(80) NOT NULL,
	"manuallySelectedFlag" bool NULL,
	"sandboxTemplateId" varchar(255) NULL,
	"prodTemplateId" varchar(255) NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."LeaseName" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyId" uuid NOT NULL,
    description text,
    "inventoryType" character varying(255) DEFAULT ''::character varying NOT NULL,
    inactive bool NULL DEFAULT false
);

CREATE TABLE db_namespace."LeaseSignatureStatus" (
    id uuid NOT NULL,
    "leaseId" uuid NOT NULL,
    "partyMemberId" uuid,
    "userId" uuid,
    status character varying(255) DEFAULT 'not_sent'::character varying,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "envelopeId" text DEFAULT ''::text NOT NULL,
    "signUrl" text,
    "clientUserId" VARCHAR(30)
);

CREATE TABLE db_namespace."LeaseSubmissionTracking" (
    id uuid NOT NULL,
    "leaseId" uuid NOT NULL,
    request text NOT NULL,
    response text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    type character varying(255) DEFAULT ''::character varying NOT NULL,
    parsed_response jsonb,
    "envelopeId" text,
    "clientUserId" VARCHAR(30)
);

CREATE TABLE db_namespace."LeaseTemplate" (
    id uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "templateData" jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    request text DEFAULT ''::text NOT NULL,
    response text
);

CREATE TABLE db_namespace."LeaseTerm" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "termLength" integer NOT NULL,
    "showOnQuote" boolean,
    "leaseNameId" uuid NOT NULL,
    period character varying(20),
    "relativeAdjustment" numeric(7,2) DEFAULT '0'::numeric,
    "absoluteAdjustment" numeric(7,2) DEFAULT '0'::numeric,
    state character varying(80),
    inactive bool NULL DEFAULT false,
    CONSTRAINT "LeaseTerm_relativeAdjustment_absoluteAdjustment_check" CHECK ((("relativeAdjustment" IS NOT NULL) OR ("absoluteAdjustment" IS NOT NULL)))
);
COMMENT ON COLUMN db_namespace."LeaseTerm"."relativeAdjustment" IS 'Values represent percentaje (%)';
COMMENT ON COLUMN db_namespace."LeaseTerm"."absoluteAdjustment" IS 'Values represent amount ($)';

CREATE TABLE db_namespace."MRIExportQueue" (
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	id uuid NOT NULL,
	"partyId" uuid NOT NULL,
	"exportData" jsonb NOT NULL DEFAULT '{}'::jsonb,
	response jsonb NULL,
	status varchar(80) NOT NULL DEFAULT 'pending'::character varying,
	count int4 NULL DEFAULT 0
);

CREATE TABLE db_namespace."MRIExportTracking" (
	id uuid NOT NULL,
	"partyId" uuid NOT NULL,
	request text NOT NULL,
	response text NULL,
	url text NOT NULL,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	api text NULL,
    "requestBody" text NULL,
    "sessionStartTime" timestamptz
);

 CREATE TABLE db_namespace."MarketingAsset" (
        "id" UUID NOT NULL,
        "name" VARCHAR(200) NOT NULL,
        "type" TEXT NOT NULL,
        "url" VARCHAR(200) NOT NULL,
        "displayName" VARCHAR(200) NOT NULL,
        "displayDescription" TEXT,
        "altTag" TEXT,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "MarketingAsset_type_check" CHECK ((type = ANY (ARRAY['3D'::text, 'video'::text])))
      );

CREATE TABLE db_namespace."MarketingContactData" (
	id uuid NOT NULL,
	"marketingSessionId" uuid NOT NULL,
	contact jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"programId" uuid
);

CREATE TABLE db_namespace."MarketingContactHistory" (
	id uuid NOT NULL,
	"marketingSessionId" uuid NULL,
	"requestData" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"marketingSessionResolution" character varying(255) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."MarketingLayout" (
        "id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "propertyId" UUID NOT NULL,
        "marketingLayoutGroupId" UUID NOT NULL,
        "displayName" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "order" INT DEFAULT 0,
        "inactive" BOOLEAN DEFAULT FALSE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
 );

CREATE TABLE db_namespace."MarketingLayoutGroup" (
        "id" UUID NOT NULL,
        "name" TEXT NOT NULL,
        "order" INT DEFAULT 0,
        "displayName" VARCHAR(200) NOT NULL,
        "shortDisplayName" VARCHAR(200) NOT NULL,
        "description" TEXT,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."MarketingSearch" (
        "id" UUID NOT NULL,
        "order" INT NOT NULL,
        "entryMatch" VARCHAR(200) NOT NULL,
        "scope" TEXT NOT NULL,
        "url" VARCHAR(200),
        "queryStringFlag" boolean,
        "inactiveFlag" boolean,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "stateScope" TEXT,
        "cityScope" TEXT,
	    CONSTRAINT "MarketingSearch_scope_check" CHECK ((scope = ANY (ARRAY['region'::text, 'state'::text, 'city'::text, 'neighborhood'::text, 'all'::text])))
      );

CREATE TABLE db_namespace."MarketingQuestions" (
          id uuid NOT NULL,
          name varchar(255) NOT NULL,
          "displaySectionQuestion" text,
          "displayPrimaryQuestion" text ,
          "displayPrimaryQuestionDescription" text,
          "displayFollowupQuestion" text,
          "inputTypeForFollowupQuestion" varchar(80),
          "enumValues" varchar[] NOT NULL DEFAULT '{}'::varchar[],
          "inactive" boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          "displayOrder" INTEGER,
          CONSTRAINT "MarketingQuestions_inputTypeForFollowupQuestion_check" CHECK (("inputTypeForFollowupQuestion" = ANY (ARRAY['count', 'binery', 'enum', 'text', 'date'])))
        );

CREATE TABLE db_namespace."MergePartyMatches" (
	id uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	"firstPartyId" uuid NOT NULL,
	"secondPartyId" uuid NOT NULL,
	"resultPartyId" uuid NULL,
	response text NOT NULL DEFAULT 'none'::text,
	"resolvedBy" uuid NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now(),
	"dataBeforeMerge" jsonb NULL,
	"exportData" jsonb NULL,
	"mergeChanges" jsonb NULL,
	CONSTRAINT "MergePartyMatches_response_check" CHECK ((response = ANY (ARRAY['none'::text, 'merge'::text, 'dont merge'::text])))
);

CREATE TABLE db_namespace."MergePartySessions" (
	id uuid NOT NULL,
	context jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."NavigationHistory" (
	id uuid NOT NULL,
	"userId" uuid NOT NULL,
	entity_type character varying(255) NOT NULL,
	entity_id uuid NOT NULL,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
	visited_at timestamptz
);

CREATE TABLE db_namespace."Notification" (
	id uuid NOT NULL,
	"postRecipientId" uuid NOT NULL,
	"type" varchar(80) NOT NULL DEFAULT 'email'::character varying,
	status varchar(80) NOT NULL DEFAULT 'not-delivered'::character varying,
	resolution text NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"openAt" timestamptz NULL,
	"messageParams" jsonb NULL,
	"notificationTemplateId" uuid NULL
);

CREATE TABLE db_namespace."NotificationTemplate" (
	id uuid NOT NULL,
	"templateBody" text NULL,
	"templateSubject" text NULL,
	"postRecipientSessionId" uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."NotificationUnsubscription" (
	id uuid NOT NULL,
	"personId" uuid NOT NULL,
	"commsTemplateSettingsId" uuid NOT NULL,
	"notificationId" uuid NULL,
	"directMessageNotificationId" uuid NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."Party" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    state character varying(255) NOT NULL,
    "storedUnitsFilters" jsonb NOT NULL,
    "userId" uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    score character varying(255),
    "qualificationQuestions" jsonb DEFAULT '{}'::jsonb NOT NULL,
    teams character varying[] DEFAULT '{}'::uuid[], -- ISSUE WITH DEFAULT
    collaborators uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    "assignedPropertyId" uuid,
    "startDate" timestamp with time zone DEFAULT now() NOT NULL,
    "endDate" timestamp with time zone,
    "ownerTeam" uuid NULL,
	"mergedWith" uuid NULL,
	"leaseType" text NOT NULL DEFAULT 'traditional'::text,
	"emailIdentifier" text NOT NULL,
	modified_by uuid NULL,
	"teamPropertyProgramId" uuid NULL,
    "workflowName" varchar(80) NOT NULL DEFAULT 'newLease',
    "workflowState" varchar(80) NOT NULL DEFAULT 'active',
    "partyGroupId" UUID NOT NULL,
    "isTransferLease" BOOLEAN DEFAULT FALSE,
    "seedPartyId" uuid,
    "archiveDate" timestamptz,
    "createdFromCommId" UUID NULL,
    "fallbackTeamPropertyProgramId" UUID NULL,
    CONSTRAINT "Party_leaseType_check" CHECK (("leaseType" = ANY (ARRAY['traditional'::text, 'corporate'::text])))
);

CREATE TABLE db_namespace."PartyCohort" (
	id uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	description varchar(500) NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."PartyDocumentHistory" (
	id uuid NOT NULL,
	"partyId" uuid NOT NULL,
	document jsonb NOT NULL,
	transaction_id int8 NOT NULL,
	triggered_by jsonb NOT NULL,
	status character varying(255) NOT NULL DEFAULT 'Pending'::character varying,
	acquired_at timestamptz,
	completed_at timestamptz,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"deliveryStatus" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."PartyEvents" (
	id uuid NOT NULL,
	"partyId" uuid NOT NULL,
	event character varying(255) NOT NULL DEFAULT 'party_updated'::character varying,
	"userId" uuid,
	"partyMemberId" uuid NULL,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	transaction_id int8 NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
    "requestIds" uuid[]
);

CREATE TABLE db_namespace."PartyGroup" (
    "id" UUID NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
 );

CREATE TABLE db_namespace."PartyMember" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "partyId" uuid,
    "memberState" character varying(255) NOT NULL,
    "memberType" character varying(255) NOT NULL,
    "personId" uuid NOT NULL,
    "isSpam" boolean DEFAULT false NOT NULL,
    "guaranteedBy" uuid,
    "endDate" timestamp with time zone,
    "startDate" timestamp with time zone DEFAULT now() NOT NULL,
	modified_by uuid NULL,
    "vacateDate" timestamptz,
    "companyId" uuid,
    CONSTRAINT "PartyMember_memberType_guaranteedBy_check" CHECK ("memberType" != 'Guarantor' OR "guaranteedBy" IS NULL),
    CONSTRAINT "PartyMember_memberType_hasguarantees_check" CHECK("memberType" = 'Guarantor' OR db_namespace.hasGuarantees(id) = FALSE)
);

CREATE TABLE db_namespace."PartyQuotePromotions" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "partyId" uuid NOT NULL,
    "quoteId" uuid NOT NULL,
    "leaseTermId" uuid NOT NULL,
    "promotionStatus" text,
    "modified_by" uuid NULL,
    "approvedBy" uuid,
    "approvalDate"	timestamptz,
    CONSTRAINT "PartyQuotePromotions_promotionStatus_check" CHECK (("promotionStatus" = ANY (ARRAY['pending_approval'::text, 'canceled'::text, 'approved'::text, 'requires_work'::text])))
);

CREATE TABLE db_namespace."PartySearch" (
    id uuid NOT NULL,
    "partyId" uuid NOT NULL,
    "partyObject" jsonb,
    "searchVector" text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "phoneSearchVector" text NULL
);

CREATE TABLE db_namespace."Party_AdditionalInfo" (
    id uuid NOT NULL,
    "partyId" uuid NOT NULL,
    type character varying(255),
    info jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "externalRoommateId" character varying(255) NULL,
    "endDate" timestamptz NULL
);


CREATE TABLE db_namespace."Person" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "fullName" character varying(255),
    "preferredName" character varying(255),
    dob timestamp with time zone,
    "idType" character varying(255) NOT NULL,
    "idValue" character varying(255),
    "idState" character varying(255),
    "idProvince" character varying(255),
    "idCountry" character varying(255),
    "mergedWith" uuid NULL,
	modified_by uuid NULL,
	"isSuspiciousContent" bool NULL,
    CONSTRAINT "Person_id_mergedWith_check" CHECK ((id <> "mergedWith"))
);
COMMENT ON COLUMN db_namespace."Person".dob IS 'Date of birth';

CREATE TABLE db_namespace."PersonMessage" (
    id uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    body text NOT NULL,
    "from" uuid NOT NULL,
    "to" uuid[] NOT NULL,
    status text NOT NULL,
    type text NOT NULL,
    "appName" character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT "PersonMessage_status_check" CHECK ((status = ANY (ARRAY['sent'::text, 'pending'::text, 'rejected'::text, 'permanentFailure'::text, 'success'::text]))),
    CONSTRAINT "PersonMessage_type_check" CHECK ((type = ANY (ARRAY['sms'::text, 'email'::text])))
);

CREATE TABLE db_namespace."PersonRelationship" (
    id uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    "from" uuid NOT NULL,
    "to" uuid NOT NULL,
    status text,
    "blockedStatus" text,
    "appName" character varying(255) NOT NULL,
    favorited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT "PersonRelationship_blockedStatus_check" CHECK (("blockedStatus" = ANY (ARRAY['spam'::text, 'inappropriate'::text, 'solicitation'::text]))),
    CONSTRAINT "PersonRelationship_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'pending'::text])))
);

CREATE TABLE db_namespace."PersonSearch" (
    id uuid NOT NULL,
    "personId" uuid NOT NULL,
    "personObject" jsonb,
    "searchVector" text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "fullName" character varying(255),
	"firstName" character varying(255),
	"lastName" character varying(255),
    "phoneSearchVector" text NULL
);

CREATE TABLE db_namespace."PersonStrongMatches" (
	id uuid NOT NULL,
	"firstPersonId" uuid NOT NULL,
	"firstPersonContactInfoId" uuid NOT NULL,
	"secondPersonId" uuid NOT NULL,
	"secondPersonContactInfoId" uuid NOT NULL,
	value text NOT NULL,
	status text NOT NULL DEFAULT 'none'::text,
	"resolvedBy" uuid,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT "PersonStrongMatches_status_check" CHECK ((status = ANY (ARRAY['none'::text, 'confirmed'::text, 'dismissed'::text])))
);

CREATE TABLE db_namespace."PersonToPersonCommunication" (
    id uuid NOT NULL,
    "from" uuid NOT NULL,
    "to" uuid NOT NULL,
    "messageId" character varying(255) NOT NULL,
    message jsonb DEFAULT '{}'::jsonb,
    status jsonb DEFAULT '{}'::jsonb,
    "threadId" text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "forwardMessageId" character varying(255)
);

CREATE TABLE db_namespace."PhysicalAsset" (
    id uuid PRIMARY KEY NOT NULL,
    checksum varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."PhysicalPublicDocument" (
	id uuid NOT NULL,
	checksum varchar(255) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."Post" (
	id uuid NOT NULL,
	category varchar(80) NOT NULL,
	title varchar(200) NULL,
	message text NULL,
	"sentAt" timestamptz NULL,
	"sentBy" uuid NULL,
	"createdBy" uuid NOT NULL,
	"updatedBy" uuid NOT NULL,
	"retractedAt" timestamptz NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"messageDetails" text NULL,
	"publicDocumentId" uuid NULL,
	"rawMessage" text NULL,
	"rawMessageDetails" text NULL,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE db_namespace."PostMonthLog" (
	id uuid NOT NULL,
	"propertyId" uuid NOT NULL,
	"postMonth" timestamptz NOT NULL,
	"startDate" timestamptz NOT NULL,
	"endDate" timestamptz,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

CREATE TABLE db_namespace."PostRecipient" (
	id uuid NOT NULL,
	"postId" uuid NOT NULL,
	"personId" uuid NULL,
	"propertyId" uuid NULL,
	"partyGroupId" uuid NULL,
	"partyIds" _uuid NULL DEFAULT '{}'::uuid[],
	"personExternalId" varchar(255) NULL,
	"unitExternalId" varchar(255) NULL,
	"postRecipientFileId" uuid NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	unread bool NULL DEFAULT true,
	"sessionId" uuid NULL,
	status text NULL DEFAULT 'sent'::text,
	reason text NULL,
	"postClicked" bool NULL DEFAULT false,
	"visitedLinksInPost" _text NULL DEFAULT '{}'::text[],
	CONSTRAINT "PostRecipient_status_type_key" CHECK (((status = 'sent'::text) OR (status = 'not sent'::text)))
);

CREATE TABLE db_namespace."ProgramReferences" (
	"parentProgramId" uuid NOT NULL,
	"referenceProgramId" uuid NOT NULL,
	"referenceProgramPropertyId" uuid NOT NULL,
    created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

CREATE TABLE db_namespace."ProgramReferrers" (
	id uuid NOT NULL,
	"order" numeric(8,2) NOT NULL,
	"programId" uuid NOT NULL,
	"currentUrl" character varying(255) NOT NULL,
	"referrerUrl" character varying(255) NOT NULL,
	description character varying(255) NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"isDefault" bool NULL DEFAULT false,
    inactive bool NULL DEFAULT false
);

CREATE TABLE db_namespace."Programs" (
	id uuid NOT NULL,
	"name" character varying(255) NOT NULL,
	"displayName" character varying(255) NOT NULL,
	description text,
	"sourceId" uuid NOT NULL,
	"directEmailIdentifier" character varying(255),
	"outsideDedicatedEmails" text[],
	"displayEmail" character varying(255),
	"directPhoneIdentifier" character varying(255),
	"displayPhoneNumber" character varying(255),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
    "onSiteLeasingTeamId" uuid NULL,
	"voiceMessageId" uuid NULL,
    "campaignId" UUID,
    "reportingDisplayName" TEXT,
    "path" TEXT,
    "metadata" jsonb NOT NULL,
    "endDate" date,
    "endDateSetOn" timestamptz,
    "displayUrl" VARCHAR(2048),
    "enableBotResponseOnCommunications" BOOLEAN DEFAULT FALSE,
    "programFallbackId" uuid NULL,
    "selectedProperties" uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

CREATE TABLE db_namespace."Property" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "propertyLegalName" character varying(200) NOT NULL,
    owner uuid,
    operator uuid,
    "propertyGroupId" uuid,
    "addressId" uuid NOT NULL,
    "startDate" timestamp with time zone,
    "endDate" timestamp with time zone,
    "APN" character varying(40),
    "MSANumber" smallint,
    "MSAName" character varying(60),
    description text,
    website character varying(200),
    "displayName" character varying(200) NOT NULL,
    timezone text,
    settings jsonb,
    "paymentProvider" jsonb DEFAULT '{"aptexx": {"holdAccount": "12007954", "applicationAccount": "12007959"}}'::jsonb,
    "postMonth" timestamptz NULL,
	"externalId" character varying(255) NULL,
	"rmsExternalId" character varying(255) NULL,
	"displayPhone" character varying(20) NULL,
	"leasingOfficeAddress" character varying(255) NULL,
    "inactive" bool NULL DEFAULT false,
    "geoLocation" JSONB NOT NULL DEFAULT '{}',
    "websiteDomain" VARCHAR(2048),
    "partyCohortId" UUID,
    "daughterProperties" _varchar DEFAULT '{}'::varchar[] NULL,
    CONSTRAINT "Property_owner_operator_propertyGroupId_check" CHECK (((owner IS NOT NULL) OR (operator IS NOT NULL) OR ("propertyGroupId" IS NOT NULL)))
);

CREATE TABLE db_namespace."PropertyCloseSchedule" (
	id uuid NOT NULL,
	"propertyId" uuid NOT NULL,
	"month" character varying(255) NOT NULL,
	"year" character varying(255) NOT NULL,
	"rollForwardDate" timestamptz NOT NULL,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now()
);

CREATE TABLE db_namespace."PropertyGroup" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    owner uuid,
    operator uuid,
    "parentGroup" uuid,
    "displayName" character varying(200) NOT NULL
);

CREATE TABLE db_namespace."PropertyPartySettings" (
    "id"                                      UUID NOT NULL,
    "propertyId"                              UUID NOT NULL,
    "screeningCriteriaId"                     UUID NOT NULL,
    "partyType"                               VARCHAR(50) NOT NULL,
    "inactive"                                BOOLEAN DEFAULT false,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."PublicApiRequestTracking" (
	id uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"partyId" uuid NOT NULL,
	"documentVersion" uuid NOT NULL,
	"sessionId" uuid NOT NULL,
	payload text NOT NULL,
	"urlPath" varchar(255) NOT NULL,
	checksum varchar(255) NOT NULL
);

CREATE TABLE db_namespace."PublicDocument" (
	uuid uuid NOT NULL,
	"physicalPublicDocumentId" uuid NOT NULL,
	context text NULL,
	metadata jsonb NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."Quote" (
    id uuid NOT NULL,
    "inventoryId" uuid NOT NULL,
    "partyId" uuid NOT NULL,
    "publishDate" timestamp with time zone,
    "expirationDate" timestamp with time zone,
    "leaseStartDate" timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    selections jsonb DEFAULT '{}'::jsonb,
    "confirmationNumber" uuid,
    "publishedQuoteData" jsonb,
    modified_by uuid NULL,
	"propertyTimezone" text NULL,
    "createdFromCommId" UUID NULL,
    "leaseState" VARCHAR(80) NOT NULL DEFAULT 'new'
);

CREATE TABLE db_namespace."RecurringJobs" (
	id uuid NOT NULL,
	"name" text NOT NULL,
	"lastRunAt" timestamptz,
	metadata jsonb DEFAULT '{}'::jsonb,
	created_at timestamptz DEFAULT now(),
	updated_at timestamptz DEFAULT now(),
    schedule text NOT NULL DEFAULT '0 0 * * * *'::text,
	timezone text NOT NULL DEFAULT 'America/Los_Angeles'::text,
	"startDate" timestamptz NULL,
	"endDate" timestamptz NULL,
	notes text NULL,
    status varchar(255) NOT NULL DEFAULT 'Idle',
    "inactiveSince" TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE db_namespace."ResidentImportTracking" (
	id uuid NOT NULL,
	"rawData" jsonb NOT NULL,
	"primaryExternalId" text NOT NULL,
	"propertyExternalId" text NOT NULL,
	status text NOT NULL,
	"importResult" jsonb NOT NULL DEFAULT '{}'::jsonb,
	processed_at timestamp NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"lastSyncDate" timestamptz NULL,
	"wasAddedToExceptionReport" bool NULL DEFAULT false,
	CONSTRAINT "ResidentImportTracking_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'processed'::text, 'failed'::text, 'skipped'::text])))
);

CREATE TABLE db_namespace."RingCentralEvents" (
    id uuid NOT NULL,
    "eventType" text,
    body text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."RmsPricing" (
	id uuid NOT NULL,
	"inventoryId" uuid NOT NULL,
	"fileName" character varying(255) NOT NULL,
	"rmsProvider" character varying(255) NOT NULL,
	"minRent" numeric(8,2) NOT NULL,
	"minRentStartDate" timestamptz NOT NULL,
	"minRentEndDate" timestamptz NOT NULL,
	"minRentLeaseLength" int4 NOT NULL,
	"standardLeaseLength" int4 NULL,
	"standardRent" numeric(8,2) NULL,
	"availDate" timestamptz NULL,
	status character varying(255) NULL,
	"amenityValue" numeric(8,2) NULL,
	"rentMatrix" jsonb NULL,
    "renewalDate" timestamptz NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
    amenities text NULL,
    "propertyId" uuid NOT NULL,
    "type" varchar(80) NOT NULL,
    "pricingType" varchar(80) NOT NULL
);

CREATE TABLE db_namespace."Sources" (
    name character varying(200) NOT NULL,
    "displayName" character varying(200) NOT NULL,
    description character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    type TEXT NOT NULL
);

CREATE TABLE db_namespace."ScreeningCriteria" (
	"id" UUID NOT NULL,
	"name" VARCHAR(50) NOT NULL,
	"monthlyResidentIncomeDebtMultiple" NUMERIC NOT NULL,
	"monthlyGuarantorIncomeDebtMultiple" NUMERIC NOT NULL,
	"monthlyResidentIncomeMultiple" NUMERIC NOT NULL,
	"monthlyGuarantorIncomeMultiple" NUMERIC NOT NULL,
	"excessiveIssuesCount" NUMERIC NOT NULL,
	"hasGroupResidentIncomes" BOOLEAN DEFAULT false,
	"hasGroupGuarantorIncomes" BOOLEAN DEFAULT false,
	"hasGroupResidentCreditScores" BOOLEAN DEFAULT false,
	"hasGroupGuarantorCreditScores" BOOLEAN DEFAULT false,
	"fullLeaseLiquidAssetMultiple" NUMERIC NOT NULL,
	"approvedResidentCreditScore" NUMERIC NOT NULL,
	"declinedResidentCreditScore" NUMERIC NOT NULL,
	"approvedGuarantorCreditScore" NUMERIC NOT NULL,
	"declinedGuarantorCreditScore" NUMERIC NOT NULL,
	"defaultResidentCreditScore" NUMERIC NOT NULL,
	"defaultGuarantorCreditScore" NUMERIC NOT NULL,
	"drugsFelony" VARCHAR(50) NOT NULL,
	"drugsMisdemeanor" VARCHAR(50) NOT NULL,
	"duiFelony" VARCHAR(50) NOT NULL,
	"duiMisdemeanor" VARCHAR(50) NOT NULL,
	"unclassifiedFelony" VARCHAR(50) NOT NULL,
	"unclassifiedMisdemeanor" VARCHAR(50) NOT NULL,
	"propertyFelony" VARCHAR(50) NOT NULL,
	"propertyMisdemeanor" VARCHAR(50) NOT NULL,
	"sexFelony" VARCHAR(50) NOT NULL,
	"sexMisdemeanor" VARCHAR(50) NOT NULL,
	"theftFelony" VARCHAR(50) NOT NULL,
	"theftMisdemeanor" VARCHAR(50) NOT NULL,
	"theftByCheckFelony" VARCHAR(50) NOT NULL,
	"theftByCheckMisdemeanor" VARCHAR(50) NOT NULL,
	"trafficFelony" VARCHAR(50) NOT NULL,
	"trafficMisdemeanor" VARCHAR(50) NOT NULL,
	"violentCrimeFelony" VARCHAR(50) NOT NULL,
	"violentCrimeMisdemeanor" VARCHAR(50) NOT NULL,
	"weaponsFelony" VARCHAR(50) NOT NULL,
	"weaponsMisdemeanor" VARCHAR(50) NOT NULL,
	"registeredSexOffender" VARCHAR(50) NOT NULL,
	"globalSanctions" VARCHAR(50) NOT NULL,
	"applicantsInsufficientIncome" VARCHAR(50) NOT NULL,
	"applicantsCreditScoreApproved" VARCHAR(50) NOT NULL,
	"applicantsCreditScoreDeclined" VARCHAR(50) NOT NULL,
	"applicantsCreditScoreBetween" VARCHAR(50) NOT NULL,
	"applicantsNoEstablishedCredit" VARCHAR(50) NOT NULL,
	"applicantsBankruptcy" VARCHAR(50) NOT NULL,
	"applicantsForeclosure" VARCHAR(50) NOT NULL,
	"applicantsLegalItem" VARCHAR(50) NOT NULL,
	"applicantsTaxLien" VARCHAR(50) NOT NULL,
	"applicantsPropertyDebt" VARCHAR(50) NOT NULL,
	"applicantsMortgageDebt" VARCHAR(50) NOT NULL,
	"applicantsUtilityDebt" VARCHAR(50) NOT NULL,
	"applicantsEvictionOrEvictionFiling" VARCHAR(50) NOT NULL,
	"applicantsExcessiveIssues" VARCHAR(50) NOT NULL,
	"applicantsSsnSuspicious" VARCHAR(50) NOT NULL,
	"guarantorsInsufficientIncome" VARCHAR(50) NOT NULL,
	"guarantorsCreditScoreApproved" VARCHAR(50) NOT NULL,
	"guarantorsCreditScoreDeclined" VARCHAR(50) NOT NULL,
	"guarantorsCreditScoreBetween" VARCHAR(50) NOT NULL,
	"guarantorsNoEstablishedCredit" VARCHAR(50) NOT NULL,
	"guarantorsBankruptcy" VARCHAR(50) NOT NULL,
	"guarantorsForeclosure" VARCHAR(50) NOT NULL,
	"guarantorsLegalItem" VARCHAR(50) NOT NULL,
	"guarantorsTaxLien" VARCHAR(50) NOT NULL,
	"guarantorsPropertyDebt" VARCHAR(50) NOT NULL,
	"guarantorsMortgageDebt" VARCHAR(50) NOT NULL,
	"guarantorsUtilityDebt" VARCHAR(50) NOT NULL,
	"guarantorsEvictionOrEvictionFiling" VARCHAR(50) NOT NULL,
	"guarantorsExcessiveIssues" VARCHAR(50) NOT NULL,
	"guarantorsSsnSuspicious" VARCHAR(50) NOT NULL,
	"created_at" TIMESTAMPTZ DEFAULT now(),
	"updated_at" TIMESTAMPTZ DEFAULT now()
	);

CREATE TABLE db_namespace."Subscriptions" (
	id uuid NOT NULL,
	decision_name character varying(255) NOT NULL,
	url character varying(255) NOT NULL,
	auth_token text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"activeForEvents" character varying[] NOT NULL DEFAULT '{*}'::character varying[],
    "inactiveSince" TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE db_namespace."Tasks" (
    id uuid NOT NULL,
    name character varying(255),
    "partyId" uuid NOT NULL,
    state text,
    "userIds" character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    "dueDate" timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    category character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "completionDate" timestamptz NULL,
	modified_by uuid,
    "createdFromCommId" UUID NULL,
    CONSTRAINT "Tasks_state_check" CHECK ((state = ANY (ARRAY['Active'::text, 'Completed'::text, 'Snoozed'::text, 'Canceled'::text])))
);

CREATE TABLE db_namespace."TeamCalendarEvents" (
    id uuid NOT NULL,
    "teamId" uuid NOT NULL,
    "startDate" timestamptz NOT NULL,
    "endDate" timestamptz NOT NULL,
    "externalId" varchar(50) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."TeamMemberSalesTargets" (
    id uuid NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "salesTarget" integer,
    "contactsToSalesConv" numeric(8,2),
    "leadsToSalesConv" numeric(8,2),
    "prospectsToSalesConv" numeric(8,2),
    "applicantsToSalesConv" numeric(8,2),
    "leasesToSalesConv" numeric(8,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."TeamMembers" (
    id uuid NOT NULL,
    "teamId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    inactive boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    "mainRoles" character varying(255)[] DEFAULT '{}'::character varying[],
    "functionalRoles" character varying(255)[] DEFAULT '{}'::character varying[],
    "directPhoneIdentifier" character varying(255) NULL,
	"directEmailIdentifier" character varying(255) NULL,
	"outsideDedicatedEmails" character varying[] NULL,
    "voiceMessageId" uuid NULL,
    "externalId" VARCHAR(255),
    "laaAccessLevels" _varchar DEFAULT '{}'::varchar[] NULL
);

CREATE TABLE db_namespace."TeamProperties" (
    "teamId" uuid NOT NULL,
    "propertyId" uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."TeamPropertyProgram" (
	"teamId" uuid NOT NULL,
	"propertyId" uuid NOT NULL,
	"programId" uuid NOT NULL,
	"commDirection" character varying(255) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	id uuid NOT NULL,
    CONSTRAINT "TeamPropertyProgram_commDirection_check" CHECK ((("commDirection")::text = ANY (ARRAY['in'::text, 'out'::text])))
);

CREATE TABLE db_namespace."TeamSalesTargets" (
    id uuid NOT NULL,
    "teamId" uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    "salesTarget" integer,
    "salesCycleDays" integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE db_namespace."Teams" (
    id uuid NOT NULL,
    name character varying(200) NOT NULL,
    "displayName" character varying(200) NOT NULL,
    module text NOT NULL,
    description character varying(500),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "timeZone" text NOT NULL,
    "officeHours" jsonb DEFAULT '{}'::jsonb,
	"callCenterPhoneNumber" character varying(255),
    "externalCalendars" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "voiceMessageId" uuid,
    "endDate" timestamptz DEFAULT NULL,
    CONSTRAINT "Teams_module_check" CHECK ((module = ANY (ARRAY['leasing'::text, 'residentServices'::text, 'accounting'::text, 'maintenance'::text, 'marketing'::text, 'security'::text, 'callCenter'::text, 'propertyManager'::text])))
);

CREATE TABLE db_namespace."TemplateShortCode" (
	id uuid NOT NULL,
	"propertyId" uuid NOT NULL,
	"shortCode" varchar(255) NOT NULL,
	"templateId" uuid NOT NULL,
	created_at timestamptz NULL DEFAULT now(),
	updated_at timestamptz NULL DEFAULT now()
);

CREATE TABLE db_namespace."UnreadCommunication" (
    id uuid NOT NULL,
    "communicationCreatedAt" timestamptz NOT NULL,
    "partyId" uuid NOT NULL,
    "communicationData" jsonb NOT NULL,
    "communicationId" uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE db_namespace."UserCalendarEvents" (
     id uuid NOT NULL,
     "userId" uuid NOT NULL,
     "startDate" timestamptz NOT NULL,
     "endDate" timestamptz NOT NULL,
     metadata jsonb DEFAULT '{}'::jsonb,
     created_at timestamptz NOT NULL DEFAULT now(),
     updated_at timestamptz NOT NULL DEFAULT now(),
     "isDeleted" bool NOT NULL DEFAULT false
);

CREATE TABLE db_namespace."Users" (
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    id uuid NOT NULL,
    "externalUniqueId" character varying(255) NOT NULL,
    "fullName" character varying(255) NOT NULL,
    "preferredName" character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NULL,
    "employmentType" character varying(255) DEFAULT 'permanent'::character varying NOT NULL,
    "loginAttempts" integer DEFAULT 0 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    "displayPhoneNumber" character varying(20),
    "ringPhones" character varying(100)[] DEFAULT ARRAY[]::character varying[],
    "displayEmail" character varying(255),
    "lastLoginAttempt" timestamp with time zone,
    "sipEndpoints" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "externalCalendars" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "lockedForCallQueueRouting" bool NULL,
    CONSTRAINT "Users_email_lowercase_check" CHECK (email = lower(email))
);
COMMENT ON COLUMN db_namespace."Users"."employmentType" IS 'Valid values are: permanent, partTime, contractor';
COMMENT ON COLUMN db_namespace."Users".metadata IS 'Stores: sipCredentials, searchHistory, businessTitle, outsideDedicatedEmails, directAccessPhones';

CREATE TABLE db_namespace."UserStatusHistory" (
    id uuid NOT NULL,
    created_at timestamptz NULL DEFAULT now(),
    "userId" uuid NOT NULL,
    "status" varchar(100) NOT NULL,
    pid int NOT NULL
);

CREATE TABLE db_namespace."VoiceMenuItems" (
	id uuid NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	"name" text NOT NULL,
	"key" int4 NOT NULL,
	"action" text NOT NULL,
	"number" text NULL,
	"displayName" text NULL,
	CONSTRAINT "VoiceMenuItems_action_check" CHECK ((action = ANY (ARRAY['request callback'::text, 'transfer to voicemail'::text, 'transfer to phone number'::text]))),
	CONSTRAINT "VoiceMenuItems_key_check" CHECK (((key >= 0) AND (key <= 9)))
);

CREATE TABLE db_namespace."VoiceMessages" (
    "id" uuid NOT NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "name" text NOT NULL,
    "afterHours" text NOT NULL,
    "voicemail" text NOT NULL,
    "unavailable" text NOT NULL,
    "callBackRequestAck" text NOT NULL,
    "callQueueWelcome" text NOT NULL,
    "callQueueUnavailable" text NOT NULL,
    "callQueueClosing" text NOT NULL,
    "callRecordingNotice" text NOT NULL,
    "holdingMusic" text NOT NULL
  );

/********************************************************** VIEWS **********************************************************/

CREATE MATERIALIZED VIEW db_namespace."UnitSearch" AS
WITH "withInventoryObj" AS (
SELECT invobj.id,
        invobj.name AS "inventoryName",
    invobj."buildingDisplayName" as "buildingName",
    invobj."propertyName",
    invobj."fullQualifiedName",
    invobj."layoutDisplayName" AS "layoutName",
    jsonb_build_object('id', invobj.id, 'name', invobj.name, 'description',
    invobj.description, 'floor', invobj.floor, 'type', invobj.type, 'unitType',
    invobj."unitType", 'address', invobj.address, 'id', invobj.id, 'amenities',
    invobj.amenities, 'updated_at', invobj.updated_at, 'buildingShorthand',
    invobj."buildingName", 'buildingName', invobj."buildingDisplayName",
    'layoutName', invobj."layoutName", 'layoutDisplayName', invobj."layoutDisplayName",
    'layoutNoBathrooms', invobj."layoutNoBathrooms", 'layoutNoBedrooms',
    invobj."layoutNoBedrooms", 'layoutSurfaceArea', invobj."layoutSurfaceArea",
    'floorCount', invobj."floorCount", 'buildingDescription',
    invobj."buildingDescription", 'propertyId', invobj."propertyId", 'propertyName',
    invobj."propertyName", 'propertyDisplayName', invobj."propertyDisplayName",
    'propertyDescription', invobj."propertyDescription", 'propertyLegalName',
        invobj."propertyLegalName", 'fullQualifiedName', invobj."fullQualifiedName") AS inventory_object
    FROM ( SELECT i.id,
            i.name,
            i.description,
            i.floor,
            i.type,
            i.type AS "unitType",
            ( SELECT btrim(("Address"."addressLine1"::text || ' '::text) || "Address"."addressLine2"::text) AS btrim
                    FROM db_namespace."Address"
                WHERE "Address".id =
                        CASE
                            WHEN i."buildingId" IS NULL THEN p."addressId"
                            ELSE b."addressId"
                        END) AS address,
            ly.name AS "layoutName",
            ly."displayName" AS "layoutDisplayName",
            ly."numBathrooms" AS "layoutNoBathrooms",
            ly."numBedrooms" AS "layoutNoBedrooms",
            ly."surfaceArea" AS "layoutSurfaceArea",
            b.name AS "buildingName",
            b."displayName" AS "buildingDisplayName",
            b."floorCount",
            b.description AS "buildingDescription",
            p.id AS "propertyId",
            p.name AS "propertyName",
            p."displayName" AS "propertyDisplayName",
            p.description AS "propertyDescription",
            p."propertyLegalName",
            array_to_json(COALESCE(array(SELECT DISTINCT UNNEST(iam_agg_name || bam_agg_name)), '{}'::character varying[]))::jsonb AS amenities,
            i.updated_at,
            CASE
            WHEN b.name IS NULL THEN (p.name::text || '-'::text) || i.name::text
            ELSE (((p.name::text || '-'::text) || b.name::text) || '-'::text) || i.name::text
            END AS "fullQualifiedName"
            FROM db_namespace."Inventory" i
            JOIN db_namespace."Property" p ON p.id = i."propertyId"
            LEFT JOIN db_namespace."Building" b ON b.id = i."buildingId"
            LEFT JOIN db_namespace."Layout" ly ON ly.id = i."layoutId"
            LEFT JOIN
                (
                SELECT ia."inventoryId", array_agg(a.name) AS iam_agg_name
                FROM db_namespace."Inventory_Amenity" ia
                JOIN db_namespace."Amenity" a ON ia."amenityId" = a.id
                WHERE a."endDate" IS NULL
                AND ia."endDate" IS NULL
                GROUP BY ia."inventoryId"
                ) iam ON i.id = iam."inventoryId"
            LEFT JOIN
                (
                SELECT ba."buildingId", array_agg(a.name) AS bam_agg_name
                FROM db_namespace."Building_Amenity" ba
                JOIN db_namespace."Amenity" a ON ba."amenityId" = a.id
                WHERE a."endDate" IS NULL
                GROUP BY ba."buildingId"
                ) bam ON i."buildingId" = bam."buildingId"
        ) invobj
)
SELECT inv.id,
inv.inventory_object,
inv."inventoryName",
inv."buildingName",
inv."propertyName",
inv."fullQualifiedName",
inv."layoutName",
((setweight(to_tsvector('simple'::regconfig, COALESCE(inv."inventoryName", ''::character varying)
::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(inv."layoutName",
    ''::character varying)::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig,
    COALESCE(inv."buildingName", ''::character varying)::text), 'C'::"char")) || setweight(to_tsvector
    ('simple'::regconfig, COALESCE(inv."fullQualifiedName", ''::character varying::text)),
        'A'::"char") ||
setweight(to_tsvector('english'::regconfig, CONCAT(inv."propertyName", inv."buildingName",
inv."inventoryName") :: character varying::text), 'C'::"char") ||
setweight(to_tsvector('english'::regconfig, CONCAT(inv."buildingName", inv."inventoryName") :: character varying::text), 'C'::"char") AS "globalSearchVector"
FROM "withInventoryObj" inv
WITH DATA;

/********************************************************** SEQUENCES **********************************************************/

CREATE SEQUENCE db_namespace."partyMemberExternalIdSeq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE SEQUENCE db_namespace."partyMemberExternalRoommateIdSeq";

CREATE SEQUENCE db_namespace."partyMemberExternalProspectIdSeq" START WITH 1000;

CREATE SEQUENCE db_namespace."activityLogDisplayNoSeq"
    AS int
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


/********************************************************** PRIMARY KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."ActiveLeaseWorkflowData"
    ADD CONSTRAINT "ActiveLeaseWorkflowData_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ActivityLog"
    ADD CONSTRAINT "ActivityLog_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Address"
    ADD CONSTRAINT "Address_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Amenity"
    ADD CONSTRAINT "Amenity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."AnalyticsLog"
    ADD CONSTRAINT "AnalyticsLog_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."AppSettings"
    ADD CONSTRAINT "AppSettings_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ApplicantData"
  ADD CONSTRAINT "ApplicantData_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."ApplicantDataNotCommitted"
  ADD CONSTRAINT "ApplicantDataNotCommitted_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."ApplicantReport"
  ADD CONSTRAINT "ApplicantReport_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportRequestTracking"
  ADD CONSTRAINT "ApplicantReportRequestTracking_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportResponseTracking"
  ADD CONSTRAINT "ApplicantReportResponseTracking_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."Assets"
    ADD CONSTRAINT "Assets_pkey" PRIMARY KEY (uuid);

ALTER TABLE ONLY db_namespace."Building"
    ADD CONSTRAINT "Building_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Building_Amenity"
    ADD CONSTRAINT "Building_Amenity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."BusinessEntity"
    ADD CONSTRAINT "BusinessEntity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CallDetails"
	ADD CONSTRAINT "CallDetails_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CallQueue"
    ADD CONSTRAINT "CallQueue_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CallQueueStatistics"
	ADD CONSTRAINT "CallQueueStatistics_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Campaigns"
	ADD CONSTRAINT "Campaigns_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CommsTemplate"
	ADD CONSTRAINT "CommsTemplate_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CommsTemplateSettings"
    ADD CONSTRAINT "CommsTemplateSettings_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CommunicationDrafts"
    ADD CONSTRAINT "CommunicationDrafts_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."CommunicationSpam"
    ADD CONSTRAINT "CommunicationSpam_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Company"
    ADD CONSTRAINT "Company_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Concession"
    ADD CONSTRAINT "Concession_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Concession_Fee"
    ADD CONSTRAINT "Concession_Fee_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ContactInfo"
    ADD CONSTRAINT "ContactInfo_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."DelayedMessages"
    ADD CONSTRAINT "DelayedMessages_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."DirectMessageNotification"
    ADD CONSTRAINT "DirectMessageNotification_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Disclosure"
    ADD CONSTRAINT "Disclosure_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Documents"
    ADD CONSTRAINT "Documents_pkey" PRIMARY KEY (uuid);

ALTER TABLE ONLY db_namespace."ExistingResidents"
    ADD CONSTRAINT "ExistingResidents_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ExceptionReport"
    ADD CONSTRAINT "ExceptionReport_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ExportLog"
    ADD CONSTRAINT "ExportLog_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ExternalPartyMemberInfo"
	ADD CONSTRAINT "ExternalPartyMemberInfo_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ExternalPhones"
    ADD CONSTRAINT "ExternalPhones_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Fee"
    ADD CONSTRAINT "Fee_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."FloatingMemberAvailability"
    ADD CONSTRAINT "FloatingMemberAvailability_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ForwardedCommunications"
   ADD CONSTRAINT "ForwardedCommunications_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ImportFilesChecksums"
    ADD CONSTRAINT "ImportFilesChecksums_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."InventoryGroup"
    ADD CONSTRAINT "InventoryGroup_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."InventoryGroup_Amenity"
    ADD CONSTRAINT "InventoryGroup_Amenity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."InventoryOnHold"
    ADD CONSTRAINT "InventoryOnHold_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Inventory_Amenity"
    ADD CONSTRAINT "Inventory_Amenity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Jobs"
    ADD CONSTRAINT "Jobs_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Layout"
    ADD CONSTRAINT "Layout_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Layout_Amenity"
    ADD CONSTRAINT "Layout_Amenity_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseDocumentTemplate"
    ADD CONSTRAINT "LeaseDocumentTemplate_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseName"
    ADD CONSTRAINT "LeaseName_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseSignatureStatus"
    ADD CONSTRAINT "LeaseSignatureStatus_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseSubmissionTracking"
    ADD CONSTRAINT "LeaseSubmissionTracking_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseTemplate"
    ADD CONSTRAINT "LeaseTemplate_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."LeaseTerm"
    ADD CONSTRAINT "LeaseTerm_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MRIExportQueue"
	ADD CONSTRAINT "MRIExportQueue_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MRIExportTracking"
    ADD CONSTRAINT "MRIExportTracking_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingAsset"
    ADD CONSTRAINT "MarketingAsset_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingContactData"
    ADD CONSTRAINT "MarketingContactData_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingContactHistory"
    ADD CONSTRAINT "MarketingContactHistory_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingLayout"
    ADD CONSTRAINT "MarketingLayout_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingLayoutGroup"
    ADD CONSTRAINT "MarketingLayoutGroup_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingSearch"
    ADD CONSTRAINT "MarketingSearch_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MarketingQuestions"
    ADD CONSTRAINT "MarketingQuestions_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
    ADD CONSTRAINT "MergePartyMatches_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."MergePartySessions"
    ADD CONSTRAINT "MergePartySessions_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."NavigationHistory"
    ADD CONSTRAINT "NavigationHistory_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."NotificationTemplate"
    ADD CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."NotificationUnsubscription"
    ADD CONSTRAINT "NotificationUnsubscription_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyCohort"
    ADD CONSTRAINT "PartyCohort_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyDocumentHistory"
    ADD CONSTRAINT "PartyDocumentHistory_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyEvents"
    ADD CONSTRAINT "PartyEvents_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyGroup"
  ADD CONSTRAINT "PartyGroup_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
    ADD CONSTRAINT "PartyQuotePromotions_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PartySearch"
    ADD CONSTRAINT "PartySearch_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Party_AdditionalInfo"
    ADD CONSTRAINT "Party_AdditionalInfo_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Person"
    ADD CONSTRAINT "Person_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PersonMessage"
    ADD CONSTRAINT "PersonMessage_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PersonRelationship"
    ADD CONSTRAINT "PersonRelationship_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PersonSearch"
    ADD CONSTRAINT "PersonSearch_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PersonStrongMatches"
    ADD CONSTRAINT "PersonStrongMatches_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PersonToPersonCommunication"
    ADD CONSTRAINT "PersonToPersonCommunication_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PhysicalPublicDocument"
    ADD CONSTRAINT "PhysicalPublicDocument_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Post"
    ADD CONSTRAINT "Post_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PostMonthLog"
    ADD CONSTRAINT "PostMonthLog_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ProgramReferrers"
	ADD CONSTRAINT "ProgramReferrers_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PropertyCloseSchedule"
    ADD CONSTRAINT "PropertyCloseSchedule_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PropertyGroup"
    ADD CONSTRAINT "PropertyGroup_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PropertyPartySettings"
    ADD CONSTRAINT "PropertyPartySettings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."PublicApiRequestTracking"
    ADD CONSTRAINT "PublicApiRequestTracking_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."PublicDocument"
    ADD CONSTRAINT "PublicDocument_pkey" PRIMARY KEY (uuid);

ALTER TABLE ONLY db_namespace."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."RecurringJobs"
    ADD CONSTRAINT "RecurringJobs_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ResidentImportTracking"
    ADD CONSTRAINT "ResidentImportTracking_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."RingCentralEvents"
    ADD CONSTRAINT "RingCentralEvents_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."RmsPricing"
	ADD CONSTRAINT "RmsPricing_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."ScreeningCriteria"
    ADD CONSTRAINT "ScreeningCriteria_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY db_namespace."Sources"
    ADD CONSTRAINT "Sources_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Subscriptions"
    ADD CONSTRAINT "Subscriptions_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Tasks"
    ADD CONSTRAINT "Tasks_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TeamCalendarEvents"
    ADD CONSTRAINT "TeamCalendarEvents_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TeamMemberSalesTargets"
    ADD CONSTRAINT "TeamMemberSalesTargets_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TeamMembers"
    ADD CONSTRAINT "TeamMembers_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TeamPropertyProgram"
    ADD CONSTRAINT "TeamPropertyProgram_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TeamSalesTargets"
    ADD CONSTRAINT "TeamSalesTargets_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Teams"
    ADD CONSTRAINT "Teams_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."TemplateShortCode"
    ADD CONSTRAINT "TemplateShortCode_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."UnreadCommunication"
    ADD CONSTRAINT "UnreadCommunication_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."UserCalendarEvents"
    ADD CONSTRAINT "UserCalendarEvents_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."Users"
    ADD CONSTRAINT "Users_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."UserStatusHistory"
    ADD CONSTRAINT "UserStatusHistory_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."VoiceMenuItems"
	ADD CONSTRAINT "VoiceMenuItems_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY db_namespace."VoiceMessages"
	ADD CONSTRAINT "VoiceMessages_pkey" PRIMARY KEY (id);


/********************************************************** UNIQUE KEYS **********************************************************/
ALTER TABLE ONLY db_namespace."ActiveLeaseWorkflowData"
    ADD CONSTRAINT "ActiveLeaseWorkflowData_partyId_key" UNIQUE("partyId");

ALTER TABLE ONLY db_namespace."Amenity"
    ADD CONSTRAINT "Amenity_name_category_subCategory_propertyId_key" UNIQUE (name, category, "subCategory", "propertyId");

ALTER TABLE ONLY db_namespace."AppSettings"
    ADD CONSTRAINT "AppSettings_key_key" UNIQUE (key);

ALTER TABLE ONLY db_namespace."Associated_Fee"
    ADD CONSTRAINT "Associated_Fee_primaryFee_associatedFee_key" UNIQUE ("primaryFee", "associatedFee");

ALTER TABLE ONLY db_namespace."Building"
    ADD CONSTRAINT "Building_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."BusinessEntity"
    ADD CONSTRAINT "BusinessEntity_name_type_key" UNIQUE (name, type);

ALTER TABLE ONLY db_namespace."CallDetails"
	ADD CONSTRAINT "CallDetails_commId_key" UNIQUE ("commId");

ALTER TABLE ONLY db_namespace."CallQueue"
    ADD CONSTRAINT "CallQueue_commId_key" UNIQUE ("commId");

ALTER TABLE ONLY db_namespace."CallQueueStatistics"
    ADD CONSTRAINT "CallQueueStatistics_communicationId_key" UNIQUE ("communicationId");

ALTER TABLE ONLY db_namespace."Campaigns"
	ADD CONSTRAINT "Campaigns_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."CommsTemplate"
    ADD CONSTRAINT "CommsTemplate_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."CommsTemplateSettings"
    ADD CONSTRAINT "CommsTemplateSettings_propertyId_section_action_key" UNIQUE ("propertyId", section, action);

ALTER TABLE ONLY db_namespace."Company"
	ADD CONSTRAINT "Company_displayName_key" UNIQUE ("displayName");

ALTER TABLE ONLY db_namespace."Concession"
    ADD CONSTRAINT "Concession_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."Concession_Fee"
    ADD CONSTRAINT "Concession_Fee_concessionId_feeId_key" UNIQUE ("concessionId", "feeId");

ALTER TABLE ONLY db_namespace."Disclosure"
    ADD CONSTRAINT "Disclosure_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."ExternalPhones"
    ADD CONSTRAINT "ExternalPhones_number_key" UNIQUE (number);

ALTER TABLE ONLY db_namespace."Fee"
    ADD CONSTRAINT "Fee_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."FloatingMemberAvailability"
    ADD CONSTRAINT "FloatingMemberAvailability_teamMemberId_day_key" UNIQUE ("teamMemberId","day");

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_name_propertyId_buildingId_key" UNIQUE (name, "propertyId", "buildingId");

ALTER TABLE db_namespace."Inventory_Amenity"
    ADD CONSTRAINT "Inventory_Amenity_inventoryId_amenityId_endDate_key" UNIQUE ("inventoryId", "amenityId", "endDate");

ALTER TABLE ONLY db_namespace."InventoryGroup"
    ADD CONSTRAINT "InventoryGroup_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."Layout"
    ADD CONSTRAINT "Layout_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE db_namespace."LeaseDocumentTemplate"
    ADD CONSTRAINT "LeaseDocumentTemplate_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."LeaseName"
    ADD CONSTRAINT "LeaseName_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."LeaseTemplate"
    ADD CONSTRAINT "LeaseTemplate_propertyId_key" UNIQUE ("propertyId");

ALTER TABLE ONLY db_namespace."LeaseTerm"
    ADD CONSTRAINT "LeaseTerm_termLength_leaseNameId_period_key" UNIQUE ("termLength", "leaseNameId", period);

ALTER TABLE ONLY db_namespace."MarketingAsset"
	ADD CONSTRAINT "MarketingAsset_name_type_key" UNIQUE (name, type);

ALTER TABLE ONLY db_namespace."MarketingContactData"
	ADD CONSTRAINT "MarketingContactData_marketingSessionId_key" UNIQUE ("marketingSessionId");

ALTER TABLE ONLY db_namespace."MarketingLayout"
	ADD CONSTRAINT "MarketingLayout_name_propertyId_key" UNIQUE (name, "propertyId");

ALTER TABLE ONLY db_namespace."MarketingLayoutGroup"
	ADD CONSTRAINT "MarketingLayoutGroup_name_key" UNIQUE ("name");

ALTER TABLE ONLY db_namespace."MarketingSearch"
	ADD CONSTRAINT "MarketingSearch_order_entryMatch_scope_key" UNIQUE ("order", "entryMatch", "scope");

ALTER TABLE ONLY db_namespace."MarketingQuestions"
   ADD CONSTRAINT "MarketingQuestions_name_key" UNIQUE ("name");

ALTER TABLE ONLY db_namespace."NavigationHistory"
    ADD CONSTRAINT "NavigationHistory_entity_id_userId_key" UNIQUE (entity_id, "userId");

ALTER TABLE db_namespace."PartyCohort"
    ADD CONSTRAINT "PartyCohort_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."PartySearch"
    ADD CONSTRAINT "PartySearch_partyId_key" UNIQUE ("partyId");

ALTER TABLE ONLY db_namespace."PersonSearch"
    ADD CONSTRAINT "PersonSearch_personId_key" UNIQUE ("personId");

ALTER TABLE ONLY db_namespace."PersonToPersonCommunication"
    ADD CONSTRAINT "PersonToPersonCommunication_forwardMessageId_key" UNIQUE ("forwardMessageId");

ALTER TABLE ONLY db_namespace."PersonToPersonCommunication"
    ADD CONSTRAINT "PersonToPersonCommunication_messageId_key" UNIQUE ("messageId");

ALTER TABLE db_namespace."Notification"
    ADD CONSTRAINT "Notification_postRecipientId_type_key" UNIQUE ("postRecipientId", type);

ALTER TABLE db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_postId_personId_propertyId_partyGroupId_key" UNIQUE ("postId", "personId", "propertyId", "partyGroupId");

ALTER TABLE ONLY db_namespace."ProgramReferences"
    ADD CONSTRAINT "ProgramReferences_parentProgramId_referenceProgramPropertyI_key" UNIQUE ("parentProgramId", "referenceProgramPropertyId");

ALTER TABLE ONLY db_namespace."ProgramReferrers"
	ADD CONSTRAINT "ProgramReferrers_order_key" UNIQUE ("order");

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_directEmailIdentifier_key" UNIQUE ("directEmailIdentifier");

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."PropertyCloseSchedule"
	ADD CONSTRAINT "PropertyCloseSchedule_propertyId_month_year_key" UNIQUE ("propertyId", month, year);

ALTER TABLE ONLY db_namespace."PropertyGroup"
    ADD CONSTRAINT "PropertyGroup_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."PropertyPartySettings"
    ADD CONSTRAINT "PropertyPartySettings_propertyId_partyType_key" UNIQUE ("propertyId", "partyType");

ALTER TABLE ONLY db_namespace."RecurringJobs"
    ADD CONSTRAINT "RecurringJobs_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."RmsPricing"
    ADD CONSTRAINT "RmsPricing_inventoryId_pricingType_key" UNIQUE ("inventoryId", "pricingType");

ALTER TABLE ONLY db_namespace."ScreeningCriteria"
  ADD CONSTRAINT "ScreeningCriteria_name_key" UNIQUE ("name");

ALTER TABLE ONLY db_namespace."Sources"
    ADD CONSTRAINT "Sources_displayName_key" UNIQUE ("displayName");

ALTER TABLE ONLY db_namespace."Sources"
    ADD CONSTRAINT "Sources_name_key" UNIQUE ("name");

ALTER TABLE ONLY db_namespace."Subscriptions"
    ADD CONSTRAINT "Subscriptions_decision_name_key" UNIQUE (decision_name);

ALTER TABLE ONLY db_namespace."TeamCalendarEvents"
  ADD CONSTRAINT "TeamCalendarEvents_externalId_key" UNIQUE ("externalId");

ALTER TABLE ONLY db_namespace."TeamMembers"
    ADD CONSTRAINT "TeamMembers_teamId_userId_key" UNIQUE ("teamId", "userId");

ALTER TABLE ONLY db_namespace."TeamMemberSalesTargets"
    ADD CONSTRAINT "TeamMemberSalesTargets_teamId_userId_month_year_key" UNIQUE ("teamId", "userId", month, year);

ALTER TABLE ONLY db_namespace."TeamProperties"
    ADD CONSTRAINT "TeamProperties_teamId_propertyId_key" UNIQUE ("teamId", "propertyId");

ALTER TABLE ONLY db_namespace."Teams"
    ADD CONSTRAINT "Teams_displayName_key" UNIQUE ("displayName");

ALTER TABLE ONLY db_namespace."Teams"
    ADD CONSTRAINT "Teams_name_module_key" UNIQUE (name, module);

ALTER TABLE ONLY db_namespace."Teams"
    ADD CONSTRAINT "Teams_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."TeamSalesTargets"
    ADD CONSTRAINT "TeamSalesTargets_teamId_month_year_key" UNIQUE ("teamId", month, year);

ALTER TABLE ONLY db_namespace."TemplateShortCode"
    ADD CONSTRAINT "TemplateShortCode_shortCode_propertyId_key" UNIQUE ("shortCode", "propertyId");

ALTER TABLE ONLY db_namespace."Users"
    ADD CONSTRAINT "Users_email_key" UNIQUE (email);

ALTER TABLE ONLY db_namespace."Users"
    ADD CONSTRAINT "Users_externalUniqueId_key" UNIQUE ("externalUniqueId");

ALTER TABLE ONLY db_namespace."UnreadCommunication"
    ADD CONSTRAINT "UnreadCommunication_partyId_communicationId_key" UNIQUE ("partyId", "communicationId");

ALTER TABLE ONLY db_namespace."VoiceMenuItems"
    ADD CONSTRAINT "VoiceMenuItems_name_key" UNIQUE (name);

ALTER TABLE ONLY db_namespace."VoiceMessages"
    ADD CONSTRAINT "VoiceMessages_name_key" UNIQUE (name);


/********************************************************** FOREIGN KEYS **********************************************************/

ALTER TABLE ONLY db_namespace."ActiveLeaseWorkflowData"
  ADD CONSTRAINT "ActiveLeaseWorkflowData_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES db_namespace."Lease"(id);

ALTER TABLE ONLY db_namespace."ActiveLeaseWorkflowData"
  ADD CONSTRAINT "ActiveLeaseWorkflowData_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Amenity"
  ADD CONSTRAINT "Amenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."ApplicantData"
  ADD CONSTRAINT "ApplicantData_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person" ("id");

ALTER TABLE ONLY db_namespace."ApplicantData"
  ADD CONSTRAINT "ApplicantData_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property" ("id");

ALTER TABLE ONLY db_namespace."ApplicantData"
  ADD CONSTRAINT "ApplicantData_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES db_namespace."Users" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReport"
  ADD CONSTRAINT "ApplicantReport_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReport"
  ADD CONSTRAINT "ApplicantReport_applicantDataId_fkey" FOREIGN KEY ("applicantDataId") REFERENCES db_namespace."ApplicantData" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReport"
  ADD CONSTRAINT "ApplicantReport_obsoletedBy_fkey" FOREIGN KEY ("obsoletedBy") REFERENCES db_namespace."ApplicantReport" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportRequestTracking"
  ADD CONSTRAINT "ApplicantReportRequestTracking_applicantReportId_fkey" FOREIGN KEY ("applicantReportId") REFERENCES db_namespace."ApplicantReport" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportRequestTracking"
  ADD CONSTRAINT "ApplicantReportRequestTracking_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportRequestTracking"
  ADD CONSTRAINT "ApplicantReportRequestTracking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property" ("id");

ALTER TABLE ONLY db_namespace."ApplicantReportResponseTracking"
  ADD CONSTRAINT "ApplicantReportResponseTracking_screeningRequestId_fkey" FOREIGN KEY ("screeningRequestId") REFERENCES db_namespace."ApplicantReportRequestTracking" ("id");

ALTER TABLE ONLY db_namespace."ApplicantDataNotCommitted"
  ADD CONSTRAINT "ApplicantDataNotCommitted_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person" ("id");

ALTER TABLE ONLY db_namespace."ApplicantDataNotCommitted"
  ADD CONSTRAINT "ApplicantDataNotCommitted_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party" ("id");

ALTER TABLE ONLY db_namespace."Assets"
  ADD CONSTRAINT "Assets_physicalAssetId_fkey" FOREIGN KEY ("physicalAssetId") REFERENCES db_namespace."PhysicalAsset"(id);

ALTER TABLE ONLY db_namespace."Associated_Fee"
  ADD CONSTRAINT "Associated_Fee_associatedFee_fkey" FOREIGN KEY ("associatedFee") REFERENCES db_namespace."Fee"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Associated_Fee"
  ADD CONSTRAINT "Associated_Fee_primaryFee_fkey" FOREIGN KEY ("primaryFee") REFERENCES db_namespace."Fee"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Building"
  ADD CONSTRAINT "Building_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES db_namespace."Address"(id);

ALTER TABLE ONLY db_namespace."Building_Amenity"
  ADD CONSTRAINT "Building_Amenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES db_namespace."Amenity"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Building_Amenity"
    ADD CONSTRAINT "Building_Amenity_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES db_namespace."Building"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Building"
    ADD CONSTRAINT "Building_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."BusinessEntity"
    ADD CONSTRAINT "BusinessEntity_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES db_namespace."Address"(id);

ALTER TABLE ONLY db_namespace."CallDetails"
	ADD CONSTRAINT "CallDetails_commId_fkey" FOREIGN KEY ("commId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."CallQueue"
	ADD CONSTRAINT "CallQueue_commId_fkey" FOREIGN KEY ("commId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."CallQueue"
	ADD CONSTRAINT "CallQueue_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."CallQueueStatistics"
	ADD CONSTRAINT "CallQueueStatistics_callBackCommunicationId_fkey" FOREIGN KEY ("callBackCommunicationId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."CallQueueStatistics"
	ADD CONSTRAINT "CallQueueStatistics_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."CallQueueStatistics"
	ADD CONSTRAINT "CallQueueStatistics_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."CommsTemplateSettings"
    ADD CONSTRAINT "CommsTemplateSettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."CommsTemplateSettings"
    ADD CONSTRAINT "CommsTemplateSettings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES db_namespace."CommsTemplate"(id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_readBy_fkey" FOREIGN KEY ("readBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_teamPropertyProgramId_fkey" FOREIGN KEY ("teamPropertyProgramId") REFERENCES db_namespace."TeamPropertyProgram"(id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_transferredFromCommId_fkey" FOREIGN KEY ("transferredFromCommId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."Communication"
    ADD CONSTRAINT "Communication_fallbackTeamPropertyProgramId_fkey" FOREIGN KEY ("fallbackTeamPropertyProgramId") REFERENCES db_namespace."TeamPropertyProgram"(id);

ALTER TABLE ONLY db_namespace."CommunicationDrafts"
	ADD CONSTRAINT "CommunicationDrafts_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."CommunicationDrafts"
	ADD CONSTRAINT "CommunicationDrafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Concession_Fee"
    ADD CONSTRAINT "Concession_Fee_concessionId_fkey" FOREIGN KEY ("concessionId") REFERENCES db_namespace."Concession"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Concession_Fee"
    ADD CONSTRAINT "Concession_Fee_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES db_namespace."Fee"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Concession"
    ADD CONSTRAINT "Concession_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."ContactInfo"
    ADD CONSTRAINT "ContactInfo_markedAsSpamBy_fkey" FOREIGN KEY ("markedAsSpamBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."ContactInfo"
    ADD CONSTRAINT "ContactInfo_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."DelayedMessages"
    ADD CONSTRAINT "DelayedMessages_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."DirectMessageNotification"
    ADD CONSTRAINT "DirectMessageNotification_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."DirectMessageNotification"
    ADD CONSTRAINT "DirectMessageNotification_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."ExistingResidents"
    ADD CONSTRAINT "ExistingResidents_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."ExceptionReport"
    ADD CONSTRAINT "ExceptionReport_residentImportTrackingId_fkey" FOREIGN KEY ("residentImportTrackingId") REFERENCES db_namespace."ResidentImportTracking"(id);

ALTER TABLE ONLY db_namespace."ExportLog"
    ADD CONSTRAINT "ExportLog_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES db_namespace."Lease"(id);

ALTER TABLE ONLY db_namespace."ExportLog"
	ADD CONSTRAINT "ExportLog_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."ExternalPartyMemberInfo"
    ADD CONSTRAINT "ExternalPartyMemberInfo_childId_fkey" FOREIGN KEY ("childId") REFERENCES db_namespace."Party_AdditionalInfo"(id);

ALTER TABLE ONLY db_namespace."ExternalPartyMemberInfo"
    ADD CONSTRAINT "ExternalPartyMemberInfo_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES db_namespace."Lease"(id);

ALTER TABLE ONLY db_namespace."ExternalPartyMemberInfo"
    ADD CONSTRAINT "ExternalPartyMemberInfo_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."ExternalPartyMemberInfo"
    ADD CONSTRAINT "ExternalPartyMemberInfo_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES db_namespace."PartyMember"(id);

ALTER TABLE db_namespace."ExternalPartyMemberInfo"
    ADD CONSTRAINT ExternalPartyMemberInfo_propertyId_fkey FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE ONLY db_namespace."ExternalPhones"
	ADD CONSTRAINT "ExternalPhones_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."Fee"
    ADD CONSTRAINT "Fee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."Fee"
   ADD CONSTRAINT "Fee_marketingQuestionId_fkey" FOREIGN KEY ("marketingQuestionId") REFERENCES db_namespace."MarketingQuestions"(id);

ALTER TABLE ONLY db_namespace."FloatingMemberAvailability"
    ADD CONSTRAINT "FloatingMemberAvailability_modifiedBy_fkey" FOREIGN KEY ("modifiedBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."FloatingMemberAvailability"
    ADD	CONSTRAINT "FloatingMemberAvailability_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES db_namespace."TeamMembers"(id);

ALTER TABLE ONLY db_namespace."ForwardedCommunications"
    ADD CONSTRAINT "ForwardedCommunications_programId_fkey" FOREIGN KEY ("programId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."Inventory_Amenity"
    ADD CONSTRAINT "Inventory_Amenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES db_namespace."Amenity"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Inventory_Amenity"
    ADD CONSTRAINT "Inventory_Amenity_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES db_namespace."Inventory"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES db_namespace."Building"(id);

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_inventoryGroupId_fkey" FOREIGN KEY ("inventoryGroupId") REFERENCES db_namespace."InventoryGroup"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES db_namespace."Layout"(id);

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_parentInventory_fkey" FOREIGN KEY ("parentInventory") REFERENCES db_namespace."Inventory"(id);

ALTER TABLE ONLY db_namespace."Inventory"
    ADD CONSTRAINT "Inventory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."InventoryGroup_Amenity"
    ADD CONSTRAINT "InventoryGroup_Amenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES db_namespace."Amenity"(id);

ALTER TABLE ONLY db_namespace."InventoryGroup_Amenity"
    ADD CONSTRAINT "InventoryGroup_Amenity_inventoryGroupId_fkey" FOREIGN KEY ("inventoryGroupId") REFERENCES db_namespace."InventoryGroup"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."InventoryGroup"
    ADD CONSTRAINT "InventoryGroup_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES db_namespace."Fee"(id);

ALTER TABLE ONLY db_namespace."InventoryGroup"
    ADD CONSTRAINT "InventoryGroup_leaseNameId_fkey" FOREIGN KEY ("leaseNameId") REFERENCES db_namespace."LeaseName"(id);

ALTER TABLE ONLY db_namespace."InventoryGroup"
    ADD CONSTRAINT "InventoryGroup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."InventoryOnHold"
    ADD CONSTRAINT "InventoryOnHold_heldBy_fkey" FOREIGN KEY ("heldBy") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."InventoryOnHold"
    ADD CONSTRAINT "InventoryOnHold_releasedBy_fkey" FOREIGN KEY ("releasedBy") REFERENCES db_namespace."Users"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."InventoryOnHold"
    ADD CONSTRAINT "InventoryOnHold_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES db_namespace."Inventory"(id);

ALTER TABLE ONLY db_namespace."InventoryOnHold"
    ADD CONSTRAINT "InventoryOnHold_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Layout_Amenity"
    ADD CONSTRAINT "Layout_Amenity_amenityId_fkey" FOREIGN KEY ("amenityId") REFERENCES db_namespace."Amenity"(id);

ALTER TABLE ONLY db_namespace."Layout_Amenity"
    ADD CONSTRAINT "Layout_Amenity_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES db_namespace."Layout"(id);

ALTER TABLE ONLY db_namespace."Layout"
    ADD CONSTRAINT "Layout_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."Layout"
    ADD CONSTRAINT "Layout_marketingLayoutId_fkey" FOREIGN KEY ("marketingLayoutId") REFERENCES db_namespace."MarketingLayout" (id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_leaseTemplateId_fkey" FOREIGN KEY ("leaseTemplateId") REFERENCES db_namespace."LeaseTemplate"(id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_leaseTermId_fkey" FOREIGN KEY ("leaseTermId") REFERENCES db_namespace."LeaseTerm"(id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES db_namespace."Quote"(id);

ALTER TABLE ONLY db_namespace."Lease"
    ADD CONSTRAINT "Lease_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."LeaseName"
    ADD CONSTRAINT "LeaseName_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."LeaseSignatureStatus"
    ADD CONSTRAINT "LeaseSignatureStatus_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES db_namespace."Lease"(id);

ALTER TABLE ONLY db_namespace."LeaseSignatureStatus"
    ADD CONSTRAINT "LeaseSignatureStatus_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES db_namespace."PartyMember"(id);

ALTER TABLE ONLY db_namespace."LeaseSignatureStatus"
    ADD CONSTRAINT "LeaseSignatureStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."LeaseSubmissionTracking"
    ADD CONSTRAINT "LeaseSubmissionTracking_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES db_namespace."Lease"(id);

ALTER TABLE ONLY db_namespace."LeaseTemplate"
    ADD CONSTRAINT "LeaseTemplate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."LeaseTerm"
    ADD CONSTRAINT "LeaseTerm_leaseNameId_fkey" FOREIGN KEY ("leaseNameId") REFERENCES db_namespace."LeaseName"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."MarketingContactData"
	ADD CONSTRAINT "MarketingContactData_programId_fkey" FOREIGN KEY ("programId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."MarketingLayout"
	ADD CONSTRAINT "MarketingLayout_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property" (id);

ALTER TABLE ONLY db_namespace."MarketingLayout"
	ADD CONSTRAINT "MarketingLayout_marketingLayoutGroupId_fkey" FOREIGN KEY ("marketingLayoutGroupId") REFERENCES db_namespace."MarketingLayoutGroup" (id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
    ADD CONSTRAINT "MergePartyMatches_firstPartyId_fkey" FOREIGN KEY ("firstPartyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
	ADD CONSTRAINT "MergePartyMatches_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
	ADD CONSTRAINT "MergePartyMatches_resultPartyId_fkey" FOREIGN KEY ("resultPartyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
	ADD CONSTRAINT "MergePartyMatches_secondPartyId_fkey" FOREIGN KEY ("secondPartyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."MergePartyMatches"
	ADD CONSTRAINT "MergePartyMatches_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES db_namespace."MergePartySessions"(id);

ALTER TABLE ONLY db_namespace."NavigationHistory"
    ADD CONSTRAINT "NavigationHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."MRIExportQueue"
    ADD CONSTRAINT "MRIExportQueue_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."MRIExportTracking"
	ADD CONSTRAINT "MRIExportTracking_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Notification"
    ADD CONSTRAINT "Notification_notificationTemplateId_fkey" FOREIGN KEY ("notificationTemplateId") REFERENCES db_namespace."NotificationTemplate"(id);

ALTER TABLE ONLY db_namespace."Notification"
    ADD CONSTRAINT "Notification_postRecipientId_fkey" FOREIGN KEY ("postRecipientId") REFERENCES db_namespace."PostRecipient"(id);

ALTER TABLE ONLY db_namespace."NotificationUnsubscription"
    ADD CONSTRAINT "NotificationUnsubscription_commsTemplateSettingsId_fkey" FOREIGN KEY ("commsTemplateSettingsId") REFERENCES db_namespace."CommsTemplateSettings"(id);

ALTER TABLE ONLY db_namespace."NotificationUnsubscription"
    ADD CONSTRAINT "NotificationUnsubscription_directMessageNotificationId_fkey" FOREIGN KEY ("directMessageNotificationId") REFERENCES db_namespace."DirectMessageNotification"(id);

ALTER TABLE ONLY db_namespace."NotificationUnsubscription"
    ADD CONSTRAINT "NotificationUnsubscription_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES db_namespace."Notification"(id);

ALTER TABLE ONLY db_namespace."NotificationUnsubscription"
    ADD CONSTRAINT "NotificationUnsubscription_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."Party_AdditionalInfo"
    ADD CONSTRAINT "Party_AdditionalInfo_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Party"
	ADD CONSTRAINT "Party_createdFromCommId_fkey" FOREIGN KEY ("createdFromCommId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Party"
	ADD CONSTRAINT "Party_mergedWith_fkey" FOREIGN KEY ("mergedWith") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Party"
	ADD CONSTRAINT "Party_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_ownerTeam_fkey" FOREIGN KEY ("ownerTeam") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_teamPropertyProgramId_fkey" FOREIGN KEY ("teamPropertyProgramId") REFERENCES db_namespace."TeamPropertyProgram"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_assignedPropertyId_fkey" FOREIGN KEY ("assignedPropertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_partyGroupId_fkey" FOREIGN KEY ("partyGroupId") REFERENCES db_namespace."PartyGroup"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_seedPartyId_fkey" FOREIGN KEY ("seedPartyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Party"
    ADD CONSTRAINT "Party_fallbackTeamPropertyProgramId_fkey" FOREIGN KEY ("fallbackTeamPropertyProgramId") REFERENCES db_namespace."TeamPropertyProgram"(id);

ALTER TABLE ONLY db_namespace."PartyDocumentHistory"
    ADD CONSTRAINT "PartyDocumentHistory_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."PartyEvents"
    ADD CONSTRAINT "PartyEvents_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."PartyEvents"
    ADD CONSTRAINT "PartyEvents_partyMemberId_fkey" FOREIGN KEY ("partyMemberId") REFERENCES db_namespace."PartyMember"(id);

ALTER TABLE ONLY db_namespace."PartyEvents"
    ADD CONSTRAINT "PartyEvents_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_guaranteedBy_fkey" FOREIGN KEY ("guaranteedBy") REFERENCES db_namespace."PartyMember"(id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."PartyMember"
    ADD CONSTRAINT "PartyMember_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES db_namespace."Company"(id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
    ADD CONSTRAINT "PartyQuotePromotions_leaseTermId_fkey" FOREIGN KEY ("leaseTermId") REFERENCES db_namespace."LeaseTerm"(id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
    ADD CONSTRAINT "PartyQuotePromotions_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
    ADD CONSTRAINT "PartyQuotePromotions_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES db_namespace."Quote"(id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
    ADD CONSTRAINT "PartyQuotePromotions_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."PartyQuotePromotions"
      ADD CONSTRAINT "PartyQuotePromotions_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."PartySearch"
    ADD CONSTRAINT "PartySearch_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Person"
    ADD CONSTRAINT "Person_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Person"
    ADD CONSTRAINT "Person_mergedWith_fkey" FOREIGN KEY ("mergedWith") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PersonMessage"
    ADD CONSTRAINT "PersonMessage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."PersonRelationship"
    ADD CONSTRAINT "PersonRelationship_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."PersonStrongMatches"
    ADD CONSTRAINT "PersonStrongMatches_firstPersonId_fkey" FOREIGN KEY ("firstPersonId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PersonStrongMatches"
	ADD CONSTRAINT "PersonStrongMatches_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."PersonStrongMatches"
	ADD CONSTRAINT "PersonStrongMatches_secondPersonId_fkey" FOREIGN KEY ("secondPersonId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PersonToPersonCommunication"
    ADD CONSTRAINT "PersonToPersonCommunication_from_fkey" FOREIGN KEY ("from") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PersonToPersonCommunication"
    ADD CONSTRAINT "PersonToPersonCommunication_to_fkey" FOREIGN KEY ("to") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."Post"
    ADD CONSTRAINT "Post_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Post"
    ADD CONSTRAINT "Post_sentBy_fkey" FOREIGN KEY ("sentBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Post"
    ADD CONSTRAINT "Post_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Post"
    ADD CONSTRAINT "Post_publicDocumentId_fkey" FOREIGN KEY ("publicDocumentId") REFERENCES db_namespace."PublicDocument"(uuid);

ALTER TABLE ONLY db_namespace."PostMonthLog"
	ADD CONSTRAINT "PostMonthLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_partyGroupId_fkey" FOREIGN KEY ("partyGroupId") REFERENCES db_namespace."PartyGroup"(id);

ALTER TABLE ONLY db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_personId_fkey" FOREIGN KEY ("personId") REFERENCES db_namespace."Person"(id);

ALTER TABLE ONLY db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_postId_fkey" FOREIGN KEY ("postId") REFERENCES db_namespace."Post"(id);

ALTER TABLE ONLY db_namespace."PostRecipient"
    ADD CONSTRAINT "PostRecipient_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."ProgramReferences"
    ADD CONSTRAINT "ProgramReferences_parentProgramId_fkey" FOREIGN KEY ("parentProgramId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."ProgramReferences"
    ADD CONSTRAINT "ProgramReferences_referenceProgramId_fkey" FOREIGN KEY ("referenceProgramId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."ProgramReferences"
    ADD CONSTRAINT "ProgramReferences_referenceProgramPropertyId_fkey" FOREIGN KEY ("referenceProgramPropertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES db_namespace."Sources"(id);

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_onSiteLeasingTeamId_fkey" FOREIGN KEY ("onSiteLeasingTeamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."Programs"
	ADD CONSTRAINT "Programs_voiceMessageId_fkey" FOREIGN KEY ("voiceMessageId") REFERENCES db_namespace."VoiceMessages"(id);

ALTER TABLE ONLY db_namespace."Programs"
    ADD CONSTRAINT "Programs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES db_namespace."Campaigns" ("id");

ALTER TABLE ONLY db_namespace."Programs"
    ADD CONSTRAINT "Programs_programFallbackId_fkey" FOREIGN KEY ("programFallbackId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."ProgramReferrers"
	ADD CONSTRAINT "ProgramReferrers_programId_fkey" FOREIGN KEY ("programId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES db_namespace."Address"(id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_operator_fkey" FOREIGN KEY (operator) REFERENCES db_namespace."BusinessEntity"(id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_owner_fkey" FOREIGN KEY (owner) REFERENCES db_namespace."BusinessEntity"(id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_propertyGroupId_fkey" FOREIGN KEY ("propertyGroupId") REFERENCES db_namespace."PropertyGroup"(id);

ALTER TABLE ONLY db_namespace."Property"
    ADD CONSTRAINT "Property_partyCohortId_fkey" FOREIGN KEY ("partyCohortId") REFERENCES db_namespace."PartyCohort"(id);

ALTER TABLE ONLY db_namespace."PropertyCloseSchedule"
	ADD CONSTRAINT "PropertyCloseSchedule_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."PropertyGroup"
    ADD CONSTRAINT "PropertyGroup_operator_fkey" FOREIGN KEY (operator) REFERENCES db_namespace."BusinessEntity"(id);

ALTER TABLE ONLY db_namespace."PropertyGroup"
    ADD CONSTRAINT "PropertyGroup_owner_fkey" FOREIGN KEY (owner) REFERENCES db_namespace."BusinessEntity"(id);

ALTER TABLE ONLY db_namespace."PropertyGroup"
    ADD CONSTRAINT "PropertyGroup_parentGroup_fkey" FOREIGN KEY ("parentGroup") REFERENCES db_namespace."PropertyGroup"(id);

ALTER TABLE ONLY db_namespace."PropertyPartySettings"
    ADD CONSTRAINT "PropertyPartySettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property" ("id");

ALTER TABLE ONLY db_namespace."PropertyPartySettings"
    ADD CONSTRAINT "PropertyPartySettings_screeningCriteriaId_fkey" FOREIGN KEY ("screeningCriteriaId") REFERENCES db_namespace."ScreeningCriteria" ("id");

ALTER TABLE ONLY db_namespace."PublicDocument"
    ADD CONSTRAINT "PublicDocument_physicalPublicDocumentId_fkey" FOREIGN KEY ("physicalPublicDocumentId") REFERENCES db_namespace."PhysicalPublicDocument"(id);

ALTER TABLE ONLY db_namespace."Quote"
	ADD CONSTRAINT "Quote_createdFromCommId_fkey" FOREIGN KEY ("createdFromCommId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."Quote"
    ADD CONSTRAINT "Quote_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES db_namespace."Inventory"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Quote"
    ADD CONSTRAINT "Quote_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id) ON DELETE CASCADE;

ALTER TABLE ONLY db_namespace."Quote"
    ADD CONSTRAINT "Quote_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."RmsPricing"
	ADD CONSTRAINT "RmsPricing_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES db_namespace."Inventory"(id);

ALTER TABLE ONLY db_namespace."RmsPricing"
	ADD CONSTRAINT "RmsPricing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."ResetTokens"
    ADD CONSTRAINT "ResetTokens_user_id_fkey" FOREIGN KEY (user_id) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."Tasks"
	ADD CONSTRAINT "Tasks_createdFromCommId_fkey" FOREIGN KEY ("createdFromCommId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."Tasks"
    ADD CONSTRAINT "Tasks_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."Tasks"
    ADD CONSTRAINT "Tasks_modified_by_fkey" FOREIGN KEY (modified_by) REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."TeamCalendarEvents"
  ADD CONSTRAINT "TeamCalendarEvents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."TeamMembers"
    ADD CONSTRAINT "TeamMembers_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."TeamMembers"
    ADD CONSTRAINT "TeamMembers_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."TeamMembers"
    ADD CONSTRAINT "TeamMembers_voiceMessageId_fkey" FOREIGN KEY ("voiceMessageId") REFERENCES db_namespace."VoiceMessages"(id);

ALTER TABLE ONLY db_namespace."TeamMemberSalesTargets"
    ADD CONSTRAINT "TeamMemberSalesTargets_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."TeamMemberSalesTargets"
    ADD CONSTRAINT "TeamMemberSalesTargets_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."TeamProperties"
    ADD CONSTRAINT "TeamProperties_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."TeamProperties"
    ADD CONSTRAINT "TeamProperties_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."TeamPropertyProgram"
    ADD CONSTRAINT "TeamPropertyProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES db_namespace."Programs"(id);

ALTER TABLE ONLY db_namespace."TeamPropertyProgram"
	ADD CONSTRAINT "TeamPropertyProgram_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."TeamPropertyProgram"
	ADD CONSTRAINT "TeamPropertyProgram_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."Teams"
    ADD CONSTRAINT "Team_voiceMessageId_fkey" FOREIGN KEY ("voiceMessageId") REFERENCES db_namespace."VoiceMessages"(id);

ALTER TABLE ONLY db_namespace."TeamSalesTargets"
    ADD CONSTRAINT "TeamSalesTargets_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES db_namespace."Teams"(id);

ALTER TABLE ONLY db_namespace."TemplateShortCode"
    ADD CONSTRAINT "TemplateShortCode_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES db_namespace."Property"(id);

ALTER TABLE ONLY db_namespace."TemplateShortCode"
    ADD CONSTRAINT "TemplateShortCode_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES db_namespace."CommsTemplate"(id);

ALTER TABLE ONLY db_namespace."UnreadCommunication"
    ADD CONSTRAINT "UnreadCommunication_communicationId_fkey" FOREIGN KEY ("communicationId") REFERENCES db_namespace."Communication"(id);

ALTER TABLE ONLY db_namespace."UnreadCommunication"
    ADD CONSTRAINT "UnreadCommunication_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES db_namespace."Party"(id);

ALTER TABLE ONLY db_namespace."UserCalendarEvents"
    ADD CONSTRAINT "UserCalendarEvents_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

ALTER TABLE ONLY db_namespace."UserStatusHistory"
    ADD CONSTRAINT "UserStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES db_namespace."Users"(id);

/********************************************************** TRIGGERS **********************************************************/

CREATE TRIGGER check_publishDate_update BEFORE UPDATE OF "publishDate" ON db_namespace."Quote" FOR EACH ROW EXECUTE PROCEDURE db_namespace.not_allow_update_published_quote();

CREATE TRIGGER contactinfotrgoninsertforperssearch AFTER INSERT ON db_namespace."ContactInfo" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepersonsearchtbl();

CREATE TRIGGER contactinfo_on_update_for_partysearch_trg AFTER UPDATE ON db_namespace."ContactInfo" FOR EACH ROW WHEN (((old.value)::text IS DISTINCT FROM (new.value)::text)) EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER contactinfo_on_update_for_personsearch_trg AFTER UPDATE ON db_namespace."ContactInfo" FOR EACH ROW WHEN (old.value IS DISTINCT FROM new.value OR old."isSpam" IS DISTINCT FROM new."isSpam") EXECUTE procedure db_namespace.updatepersonsearchtbl();

CREATE TRIGGER partymemberenddatecompanyidtrgonupdate AFTER UPDATE OF "endDate", "companyId" ON db_namespace."PartyMember" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER partymembertrgoninsertupdate AFTER INSERT OR UPDATE ON db_namespace."PartyMember" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER partymembertrgoninsertupdateforperssearch AFTER INSERT OR UPDATE ON db_namespace."PartyMember" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepersonsearchtbl();

CREATE TRIGGER partytrgonupdate AFTER UPDATE OF "state", "metadata", "qualificationQuestions", "userId", "workflowState"   ON db_namespace."Party"  FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER persontrgoninsertupdatedeleteforperssearch AFTER INSERT OR DELETE OR UPDATE ON db_namespace."Person" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepersonsearchtbl();

CREATE TRIGGER persontrgonupdate AFTER UPDATE ON db_namespace."Person" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER activeleaseworkflowdatatrgoninsertorupdate AFTER INSERT OR UPDATE ON db_namespace."ActiveLeaseWorkflowData" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER update_activeleaseworkflowdata_updated_at_trg BEFORE UPDATE ON db_namespace."ActiveLeaseWorkflowData" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_activitylog_updated_at_trg BEFORE UPDATE ON db_namespace."ActivityLog" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_analyticslog_updated_at_trg BEFORE UPDATE ON db_namespace."AnalyticsLog" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_address_updated_at_trg BEFORE UPDATE ON db_namespace."Address" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_amenity_updated_at_trg BEFORE UPDATE ON db_namespace."Amenity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_assets_updated_at_trg BEFORE UPDATE ON db_namespace."Assets" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_associated_fee_updated_at_trg BEFORE UPDATE ON db_namespace."Associated_Fee" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_building_amenity_updated_at_trg BEFORE UPDATE ON db_namespace."Building_Amenity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_building_updated_at_trg BEFORE UPDATE ON db_namespace."Building" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_businessentity_updated_at_trg BEFORE UPDATE ON db_namespace."BusinessEntity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_calldetails_updated_at_trg BEFORE UPDATE ON db_namespace."CallDetails" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_callqueuestatistics_updated_at_trg BEFORE UPDATE ON db_namespace."CallQueueStatistics" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at_trg BEFORE UPDATE ON db_namespace."Campaigns" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_communication_updated_at_trg BEFORE UPDATE ON db_namespace."Communication" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_communicationdrafts_updated_at_trg BEFORE UPDATE ON db_namespace."CommunicationDrafts" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_communicationspam_updated_at_trg BEFORE UPDATE ON db_namespace."CommunicationSpam" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_concession_fee_updated_at_trg BEFORE UPDATE ON db_namespace."Concession_Fee" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_concession_updated_at_trg BEFORE UPDATE ON db_namespace."Concession" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_company_updated_at_trg BEFORE UPDATE ON db_namespace."Company" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_contactinfo_updated_at_trg BEFORE UPDATE ON db_namespace."ContactInfo" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_directmessagenotification_updated_at_trg BEFORE UPDATE ON db_namespace."DirectMessageNotification" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_disclosure_updated_at_trg BEFORE UPDATE ON db_namespace."Disclosure" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at_trg BEFORE UPDATE ON db_namespace."Documents" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_exceptionreport_updated_at_trg BEFORE UPDATE ON db_namespace."ExceptionReport" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_fee_updated_at_trg BEFORE UPDATE ON db_namespace."Fee" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_forwardedcommunications_updated_at_trg BEFORE UPDATE ON db_namespace."ForwardedCommunications" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_inventory_amenity_updated_at_trg BEFORE UPDATE ON db_namespace."Inventory_Amenity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at_trg BEFORE UPDATE ON db_namespace."Inventory" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_inventorygroup_amenity_updated_at_trg BEFORE UPDATE ON db_namespace."InventoryGroup_Amenity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_inventorygroup_updated_at_trg BEFORE UPDATE ON db_namespace."InventoryGroup" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_inventoryonhold_updated_at_trg BEFORE UPDATE ON db_namespace."InventoryOnHold" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at_trg BEFORE UPDATE ON db_namespace."Jobs" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_layout_amenity_updated_at_trg BEFORE UPDATE ON db_namespace."Layout_Amenity" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_layout_updated_at_trg BEFORE UPDATE ON db_namespace."Layout" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_lease_updated_at_trg BEFORE UPDATE ON db_namespace."Lease" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leasedocumenttemplate_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseDocumentTemplate" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leasename_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseName" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leasesignaturestatus_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseSignatureStatus" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leasesubmissiontracking_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseSubmissionTracking" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leasetemplate_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseTemplate" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_leaseterm_updated_at_trg BEFORE UPDATE ON db_namespace."LeaseTerm" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketingcontactdata_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingContactData" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketingcontacthistory_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingContactHistory" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketinglayout_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingLayout" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketinglayoutgroup_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingLayoutGroup" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketingsearch_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingSearch" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_marketingquestions_updated_at_trg BEFORE UPDATE ON db_namespace."MarketingQuestions" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_mergepartymatches_updated_at_trg BEFORE UPDATE ON db_namespace."MergePartyMatches" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_mergepartysessions_updated_at_trg BEFORE UPDATE ON db_namespace."MergePartySessions" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_mriexportqueue_updated_at_trg BEFORE UPDATE ON db_namespace."MRIExportQueue" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_mriexporttracking_updated_at_trg BEFORE UPDATE ON db_namespace."MRIExportTracking" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_navigationhistory_updated_at_trg BEFORE UPDATE ON db_namespace."NavigationHistory" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_notification_updated_at_trg BEFORE UPDATE ON db_namespace."Notification" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_notificationtemplate_updated_at_trg BEFORE UPDATE ON db_namespace."NotificationTemplate" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_notificationunsubscription_updated_at_trg BEFORE UPDATE ON db_namespace."NotificationUnsubscription" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_party_additionalinfo_updated_at_trg BEFORE UPDATE ON db_namespace."Party_AdditionalInfo" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_party_updated_at_trg BEFORE UPDATE ON db_namespace."Party" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_partycohort_updated_at_trg BEFORE UPDATE ON db_namespace."PartyCohort" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_partydocumenthistory_updated_at_trg BEFORE UPDATE ON db_namespace."PartyDocumentHistory" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_partymember_updated_at_trg BEFORE UPDATE ON db_namespace."PartyMember" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_partyquotepromotions_updated_at_trg BEFORE UPDATE ON db_namespace."PartyQuotePromotions" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_partysearch_updated_at_trg BEFORE UPDATE ON db_namespace."PartySearch" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_person_updated_at_trg BEFORE UPDATE ON db_namespace."Person" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_personmessage_updated_at_trg BEFORE UPDATE ON db_namespace."PersonMessage" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_personrelationship_updated_at_trg BEFORE UPDATE ON db_namespace."PersonRelationship" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_personsearch_updated_at_trg BEFORE UPDATE ON db_namespace."PersonSearch" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_personstrongmatches_updated_at_trg BEFORE UPDATE ON db_namespace."PersonStrongMatches" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_persontopersoncommunication_updated_at_trg BEFORE UPDATE ON db_namespace."PersonToPersonCommunication" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_physicalasset_updated_at_trg BEFORE UPDATE ON db_namespace."PhysicalAsset" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_physicalpublicdocument_updated_at_trg BEFORE UPDATE ON db_namespace."PhysicalPublicDocument" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_post_updated_at_trg BEFORE UPDATE ON db_namespace."Post" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_postmonthlog_updated_at_trg BEFORE UPDATE ON db_namespace."PostMonthLog" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_postrecipient_updated_at_trg BEFORE UPDATE ON db_namespace."PostRecipient" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_programs_updated_at_trg BEFORE UPDATE ON db_namespace."Programs" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_programreferrers_updated_at_trg BEFORE UPDATE ON db_namespace."ProgramReferrers" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_programreferences_updated_at_trg BEFORE UPDATE ON db_namespace."ProgramReferences" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_property_updated_at_trg BEFORE UPDATE ON db_namespace."Property" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_propertygroup_updated_at_trg BEFORE UPDATE ON db_namespace."PropertyGroup" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_propertycloseschedule_updated_at_trg BEFORE UPDATE ON db_namespace."PropertyCloseSchedule" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_publicapirequesttracking_updated_at_trg BEFORE UPDATE ON db_namespace."PublicApiRequestTracking" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_publicdocument_updated_at_trg BEFORE UPDATE ON db_namespace."PublicDocument" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_quote_updated_at_trg BEFORE UPDATE ON db_namespace."Quote" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_residentimporttracking_updated_at_trg BEFORE UPDATE ON db_namespace."ResidentImportTracking" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_ringcentralevents_updated_at_trg BEFORE UPDATE ON db_namespace."RingCentralEvents" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_rmspricing_updated_at_trg BEFORE UPDATE ON db_namespace."RmsPricing" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_sources_updated_at_trg BEFORE UPDATE ON db_namespace."Sources" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at_trg BEFORE UPDATE ON db_namespace."Tasks" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teamcalendarevents_updated_at_trg BEFORE UPDATE ON db_namespace."TeamCalendarEvents" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teammembers_updated_at_trg BEFORE UPDATE ON db_namespace."TeamMembers" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teamproperties_updated_at_trg BEFORE UPDATE ON db_namespace."TeamProperties" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at_trg BEFORE UPDATE ON db_namespace."Teams" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teammembersalestargets_updated_at_trg BEFORE UPDATE ON db_namespace."TeamMemberSalesTargets" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teampropertyprogram_updated_at_trg BEFORE UPDATE ON db_namespace."TeamPropertyProgram" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_teamsalestargets_updated_at_trg BEFORE UPDATE ON db_namespace."TeamSalesTargets" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE TRIGGER update_usercalendarevents_updated_at_trg BEFORE UPDATE ON db_namespace."UserCalendarEvents" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

CREATE CONSTRAINT TRIGGER notify_party_events_table_changes_trg AFTER INSERT ON db_namespace."PartyEvents" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW  EXECUTE PROCEDURE db_namespace.notify_party_events_table_changes();

CREATE TRIGGER notify_party_history_changes_trg AFTER INSERT ON db_namespace."PartyDocumentHistory" FOR EACH ROW EXECUTE PROCEDURE db_namespace.notify_party_history_changes();

CREATE TRIGGER contactinfotrgondeleteforperssearch AFTER DELETE ON db_namespace."ContactInfo" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepersonsearchtbl();

CREATE TRIGGER partymembertrgondeleteforpartysearch AFTER DELETE ON db_namespace."PartyMember" FOR EACH ROW EXECUTE PROCEDURE db_namespace.updatepartysearchtbl();

CREATE TRIGGER users_update_status_trg AFTER UPDATE OF metadata ON db_namespace."Users" FOR EACH ROW EXECUTE PROCEDURE db_namespace.insert_user_status_history();

CREATE TRIGGER update_users_updated_at_trg BEFORE UPDATE ON db_namespace."Users" FOR EACH ROW EXECUTE PROCEDURE db_namespace.update_updated_at_column();

/********************************************************** INDEXES **********************************************************/

CREATE INDEX "ActivityLog_context_parties_idx" ON db_namespace."ActivityLog" USING GIN(("context" -> 'parties'));

CREATE INDEX "Communication_category_idx" ON db_namespace."Communication" ("category");

CREATE INDEX "Communication_messageId_idx" ON db_namespace."Communication" USING btree ("messageId");

CREATE UNIQUE INDEX "Communication_messageId_idx1" ON db_namespace."Communication" USING BTREE ("messageId") WHERE ((type)::text <> 'Call'::text);

CREATE INDEX "Communication_threadId_idx" ON db_namespace."Communication" USING btree ("threadId");

CREATE INDEX "Communication_parties_idx" ON db_namespace."Communication" USING GIN (parties);

CREATE INDEX "Communication_persons_idx" ON db_namespace."Communication" USING GIN (persons);

CREATE INDEX "Communication_type_idx" ON db_namespace."Communication" ("type");

CREATE INDEX "ContactInfo_personId_idx" ON db_namespace."ContactInfo" ("personId");

CREATE INDEX "ContactInfo_type_value_idx" ON db_namespace."ContactInfo" (type, value);

CREATE UNIQUE INDEX "ContactInfo_type_personId_idx" ON db_namespace."ContactInfo" USING BTREE (type, "personId") WHERE "isPrimary" = true;

CREATE UNIQUE INDEX "ContactInfo_value_idx" ON db_namespace."ContactInfo" USING BTREE (value) WHERE (type = 'email'::text);

CREATE UNIQUE INDEX "Inventory_Amenity_inventoryId_amenityId_endDate_idx" ON db_namespace."Inventory_Amenity" USING btree ("inventoryId", "amenityId") WHERE ("endDate" IS NULL);

CREATE UNIQUE INDEX "Inventory_name_propertyId_coalesce_idx" ON db_namespace."Inventory" USING BTREE (name, "propertyId", (COALESCE("buildingId", '00000000-0000-0000-0000-000000000000'::uuid)));

CREATE INDEX "InventoryOnHold_partyId_idx" ON db_namespace."InventoryOnHold" USING BTREE ("partyId");

CREATE UNIQUE INDEX "Inventory_propertyId_rmsExternalId_idx" ON db_namespace."Inventory" USING btree ("propertyId", "rmsExternalId") WHERE (("rmsExternalId")::text <> ''::text);

CREATE INDEX "Inventory_propertyId_layoutId_idx" ON db_namespace."Inventory" USING BTREE ("propertyId","layoutId");

CREATE INDEX "Lease_partyId_idx" ON db_namespace."Lease" ("partyId");

CREATE INDEX "LeaseSignatureStatus_leaseId_idx" ON db_namespace."LeaseSignatureStatus" ("leaseId");

CREATE UNIQUE INDEX "LeaseSignatureStatus_leaseId_partyMemberId_envelopeId_idx" ON db_namespace."LeaseSignatureStatus" USING BTREE ("leaseId", "partyMemberId", "envelopeId") WHERE ("userId" IS NULL);

CREATE UNIQUE INDEX "LeaseSignatureStatus_leaseId_userId_envelopeId_idx" ON db_namespace."LeaseSignatureStatus" USING BTREE ("leaseId", "userId", "envelopeId") WHERE ("partyMemberId" IS NULL);

CREATE INDEX "MarketingContactHistory_marketingSessionId_idx" ON db_namespace."MarketingContactHistory" ("marketingSessionId");

CREATE INDEX "Party_userId_idx" ON db_namespace."Party" USING BTREE ("userId");

CREATE INDEX "Party_teams_idx" ON db_namespace."Party" USING GIN (teams);

CREATE INDEX "Party_state_idx" ON db_namespace."Party" USING btree ("state");

CREATE INDEX "Party_workflowState_idx" ON db_namespace."Party" USING btree ("workflowState");

CREATE INDEX "PartyDocumentHistory_partyId_idx" ON db_namespace."PartyDocumentHistory" USING BTREE ("partyId");

CREATE INDEX "PartyDocumentHistory_status_idx" ON db_namespace."PartyDocumentHistory" USING BTREE (status);

CREATE INDEX "PartyEvents_partyId_idx" ON db_namespace."PartyEvents" USING BTREE ("partyId");

CREATE UNIQUE INDEX "PartyEvents_communicationId_partyId_event_idx" ON db_namespace."PartyEvents" ((metadata->>'communicationId'), "partyId", "event") WHERE event IN ('communication_completed', 'communication_missed_call');

CREATE INDEX "PartyMember_partyId_idx" ON db_namespace."PartyMember" ("partyId");

CREATE INDEX "PartyMember_personId_idx" ON db_namespace."PartyMember" ("personId");

CREATE INDEX "PartyQuotePromotions_partyId_idx" ON db_namespace."PartyQuotePromotions" ("partyId");

CREATE INDEX "Quote_partyId_idx" ON db_namespace."Quote" ("partyId");

CREATE UNIQUE INDEX "TeamPropertyProgram_teamId_propertyId_idx" ON db_namespace."TeamPropertyProgram" USING BTREE ("teamId", "propertyId") WHERE (("commDirection")::text = 'out'::text);

CREATE INDEX "UnitSearch_id_idx" ON db_namespace."UnitSearch" USING btree (id);

CREATE INDEX "Tasks_partyId_idx" ON db_namespace."Tasks" ("partyId");

CREATE INDEX "Tasks_userIds_idx" ON db_namespace."Tasks" USING GIN ("userIds");

CREATE INDEX "Tasks_state_idx" ON db_namespace."Tasks" USING BTREE(state);

/********************************************************** PUBLIC FUNCTIONS AND VIEWS **********************************************************/

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

CREATE OR REPLACE VIEW public."monitor_locks" AS
    SELECT COALESCE(blockingl.relation::regclass::text,blockingl.locktype) as locked_item,
        now() - blockeda.query_start AS waiting_duration,
        blockeda.pid AS blocked_pid,
        blockeda.query as blocked_query,
        blockedl.mode as blocked_mode,
        blockinga.pid AS blocking_pid,
        blockinga.query as blocking_query,
        blockingl.mode as blocking_mode
    FROM pg_catalog.pg_locks blockedl
    JOIN pg_stat_activity blockeda ON blockedl.pid = blockeda.pid
    JOIN pg_catalog.pg_locks blockingl ON (
    ( (blockingl.transactionid = blockedl.transactionid) OR (blockingl.relation = blockedl.relation AND blockingl.locktype = blockedl.locktype))
    AND blockedl.pid != blockingl.pid)
    JOIN pg_stat_activity blockinga ON blockingl.pid = blockinga.pid AND blockinga.datid = blockeda.datid
    WHERE NOT blockedl.granted
    AND blockinga.datname = current_database();


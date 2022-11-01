/*  L2-Load.SQL - intended to load transformations to the normalized historical data model.   */
/*	Assumes that L1_Load.SQL has been run right before, which will populate the t_ temp tables -- */
/* and this information is used to UPSERT only those new records part of the most recent extract.   */

/* Load -- using L1 norm tables AS input, t_tables to get incremental scope, transform some of the complex objects
	into relational structured data, that will then be used to create analytic stars */

-- DELETE - PartyTeam - link parties to unnested teams
DELETE FROM "dstNormDB"."dstNormSchema"."PartyTeam"
WHERE "partyId" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_Party");

-- INSERT - PartyTeam
INSERT INTO "dstNormDB"."dstNormSchema"."PartyTeam" (
	"partyId",
	"teamId",
	"created_at",
	"updated_at"
)
SELECT
	py."id"	,
	UNNEST(py."teams"),
	py."created_at",
	py."updated_at"
FROM "tmpNormDB"."tmpNormSchema"."t_Party" py;

-- DELETE - AnalyticsLogPartyUser - intermediary - keep track of the link between parties and users over time
DELETE FROM "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser"
WHERE "analyticslogId" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog");

-- INSERT - AnalyticsLogPartyUser
INSERT INTO "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser" (
	"analyticslogId",
	"userId",
	"partyId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
 	COALESCE(CAST(("context"#>>'{users,0}') AS UUID), CAST((entity->>'userId') AS UUID)) AS "userId",
	CAST(("context"#>>'{parties,0}') AS UUID) AS "partyId",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLog"
WHERE "id" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
        AND "component" = 'party'
        AND "context"#>>'{parties,0}' IS NOT NULL
        AND ("context"#>>'{users,0}' IS NOT NULL OR entity->>'userId' IS NOT NULL);

-- UPSERT - AnalyticsLogParty - intermediary - keep track of party changes over time
INSERT INTO "dstNormDB"."dstNormSchema"."AnalyticsLogParty" (
	"analyticslogId",
	"partyId",
	"displayNo",
	"isSystemGenerated" ,
	"state",
	"storedUnitsFilters",
	"metadata",
	"qualificationQuestions",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	CAST(("context"#>>'{parties,0}') AS UUID) AS "partyId",
  CAST((COALESCE("activityDetails"->>'displayNo','0')) AS INTEGER)  AS "displayNo",
	CAST(("activityDetails"->>'isSystemGenerated') AS BOOLEAN ) AS "isSystemGenerated",
	"entity"->>'state' AS "state",
	CAST(("entity"->>'storedUnitsFilters' ) AS JSON) AS "storedUnitsFilters",
	CAST(("entity"->>'metadata' ) AS JSON) AS "metadata",
	CAST(("entity"->>'qualificationQuestions' ) AS JSON) AS "qualificationQuestions",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLog"
WHERE "id" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
        AND "component" = 'party'
ON CONFLICT ("analyticslogId")
	DO UPDATE
	SET
		"displayNo" = EXCLUDED."displayNo",
		"partyId" = EXCLUDED."partyId",
		"isSystemGenerated" = EXCLUDED."isSystemGenerated",
		"state" = EXCLUDED."state",
		"storedUnitsFilters" = EXCLUDED."storedUnitsFilters",
		"metadata" = EXCLUDED."metadata",
		"qualificationQuestions" = EXCLUDED."qualificationQuestions",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

-- UPSERT - AnalyticsLogTask - intermediary - keep track of task changes over time
INSERT INTO "dstNormDB"."dstNormSchema"."AnalyticsLogTask" (
	"analyticslogId",
  "userId",
	"partyId",
	"taskId",
	"metadata",
	"state",
	"dueDate",
	"created_at",
	"updated_at"
)
SELECT
	"id",
 	COALESCE(CAST(("context"#>>'{users,0}') AS UUID), CAST(("entity"#>>'{userIds,0}') AS UUID)) AS "userId",
	CAST(("context"#>>'{parties,0}') AS UUID) AS "partyId",
	CAST(("entity"->>'id' ) AS UUID) AS "taskId",
	entity AS metadata,
	"entity"->>'state' AS "state",
	CAST(("entity"->>'dueDate' ) AS TIMESTAMPTZ) AS "dueDate",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLog"
WHERE "id" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
	AND "component" = 'task'
	AND "entity"->>'id' IS NOT NULL
ON CONFLICT ("analyticslogId")
	DO UPDATE
	SET
		"userId" = EXCLUDED."userId",
		"partyId" = EXCLUDED."partyId",
		"taskId" = EXCLUDED."taskId",
		"metadata" = EXCLUDED."metadata",
		"state" = EXCLUDED."state",
		"dueDate" = EXCLUDED."dueDate",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

-- UPSERT - AnalyticsLogAppointment - intermediary - keep track of appointment changes over time
INSERT INTO "dstNormDB"."dstNormSchema"."AnalyticsLogAppointment" (
	"analyticslogId",
	"partyId",
	"metadata",
	"completionDate",
	"state",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	CAST(("context"#>>'{parties,0}') AS UUID) AS "partyId",
	"entity" AS "metadata",
  CAST(CAST("entity"->>'metadata' AS JSON)->>'endDate' AS TIMESTAMPTZ) AS "completionDate",
	"entity"->>'state' AS "state",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLog"
WHERE "id" IN (SELECT "id" FROM "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
	AND "component" = 'appointment'
ON CONFLICT ("analyticslogId")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"metadata" = EXCLUDED."metadata",
		"completionDate" = EXCLUDED."completionDate",
		"state" = EXCLUDED."state",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

/* PartyStateHistory 1: find last PartyStateHistory activity for each party that has incoming party activity, and set end date to be start date of new create date */
WITH Parties AS (
SELECT psh."partyId",
			 min(alp."updated_at") AS minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."PartyStateHistory" psh
 	INNER JOIN "dstNormDB"."dstNormSchema"."AnalyticsLogParty" alp ON psh."partyId" = alp."partyId"
 	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" al ON alp."analyticslogId" = al."id"
WHERE psh."end_date" IS NULL
  AND alp."updated_at" > psh."start_date"
  AND alp."state" <> psh."state"
GROUP BY psh."partyId"
)
UPDATE "dstNormDB"."dstNormSchema"."PartyStateHistory" upd
	SET "end_date" = minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."PartyStateHistory" psh
  INNER JOIN Parties p ON psh."partyId" = p."partyId"
WHERE upd."analyticslogId" = psh."analyticslogId"
	AND upd."end_date" IS NULL;

/* PartyStateHistory 2: insert new activity being loaded FROM temp table, and insert into PartyStateHistory */
/* PartyStateHistory is a SCD, which tracks the history of the various states of the PartyState - to calcuate durations and quantities at each state */
/* Any query against PSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
WITH DistinctParties AS (
SELECT
		alp."partyId",
		alp."state",
		min(alp."created_at") AS "created_at",
		min(alp."updated_at") AS "updated_at"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLogParty" alp
	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alp."analyticslogId" = tal."id" AND tal."type" <> 'remove'
	LEFT JOIN "dstNormDB"."dstNormSchema"."PartyStateHistory" psh ON psh."partyId" = alp."partyId" AND psh."state" = alp."state"
WHERE psh."partyId" IS NULL
GROUP BY alp."partyId", alp."state"
)
INSERT INTO "dstNormDB"."dstNormSchema"."PartyStateHistory" (
	"analyticslogId",
	"partyId",
	"state",
	"created_at",
	"updated_at",
	"start_date",
	"end_date"
)
SELECT aux."analyticslogId",
			 dp."partyId",
			 dp."state",
			 dp."created_at",
			 dp."updated_at",
			 dp."created_at" AS "start_date",
			 ed."end_date"
FROM DistinctParties dp
	INNER JOIN "dstNormDB"."dstNormSchema"."AnalyticsLogParty" aux ON dp."partyId" = aux."partyId" AND dp."state" = aux."state" AND dp."created_at" = aux."created_at"
	LEFT JOIN LATERAL
		(SELECT min("updated_at") AS "end_date"
		 FROM "dstNormDB"."dstNormSchema"."AnalyticsLogParty"
     WHERE "partyId" = dp."partyId"
    		AND "state" <> dp."state"
    		AND "updated_at" > dp."updated_at"
    	) ed ON TRUE
WHERE dp."state" IS NOT NULL
	AND aux."analyticslogId" NOT IN (SELECT "analyticslogId" FROM "dstNormDB"."dstNormSchema"."PartyStateHistory");

/* PartyStateHistory 3:  mark any activities entries that have been removed AS ended */
UPDATE "dstNormDB"."dstNormSchema"."PartyStateHistory"  psh
SET "end_date"= latest_activity."close_date"
FROM (SELECT alp."partyId", max(alp."updated_at") AS "close_date"
       FROM "dstNormDB"."dstNormSchema"."AnalyticsLogParty" alp
           JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alp."analyticslogId" = tal."id"
       WHERE  tal."type"='remove'
       GROUP BY 1) AS latest_activity
WHERE psh."end_date" IS NULL
	AND psh."partyId"=latest_activity."partyId";

/* TaskStateHistory 1: find last TaskStateHistory activity for each task that has incoming task activity, and set end date to be start date of new create date */
WITH Tasks AS (
SELECT tsh."taskId", min(alt."updated_at") AS minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."TaskStateHistory" tsh
 	INNER JOIN "dstNormDB"."dstNormSchema"."AnalyticsLogTask" alt ON tsh."taskId" = alt."taskId"
 	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" al ON alt."analyticslogId" = al."id"
WHERE tsh."end_date" IS NULL
  AND alt."updated_at" > tsh."start_date"
GROUP BY tsh."taskId"
)
UPDATE "dstNormDB"."dstNormSchema"."TaskStateHistory" upd
	SET "end_date" = minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."TaskStateHistory" tsh
  JOIN Tasks t ON tsh."taskId" = t."taskId"
WHERE upd."analyticslogId" = tsh."analyticslogId"
	AND upd."end_date" IS NULL;

/* TaskStateHistory 2: insert new activity being loaded FROM temp table, and insert into TaskStateHistory */
/* TaskStateHistory is a SCD, which tracks the history of the various states of the TaskState - to calcuate durations and quantities at each state */
/* Any query against TSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
INSERT INTO "dstNormDB"."dstNormSchema"."TaskStateHistory" (
	"analyticslogId",
	"partyId",
	"taskId",
	"userId",
	"state",
	"created_at",
	"updated_at",
	"start_date",
	"end_date",
  "dueDate"
)
SELECT
  task."analyticslogId",
  task."partyId",
  task."taskId",
  task."userId",
  task."state",
  task."created_at",
  task."updated_at",
  task."created_at" AS "start_date",
  lead(task."updated_at", 1) OVER (PARTITION BY task."taskId" ORDER BY task."updated_at" ) AS "end_date",
  task."dueDate"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLogTask" task
  LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal on task."analyticslogId" = tal."id"
WHERE tal."type" <> 'remove'
  AND task."state" IS NOT NULL
  AND task."analyticslogId" NOT IN (SELECT "analyticslogId" FROM "dstNormDB"."dstNormSchema"."TaskStateHistory");

/* TaskStateHistory 3:  mark any  entries tasks that have been removed as ended */
UPDATE "dstNormDB"."dstNormSchema"."TaskStateHistory" tsh
SET "end_date" = latest_activity."close_date"
FROM (SELECT task."taskId", max(task."updated_at") AS "close_date"
       FROM "dstNormDB"."dstNormSchema"."AnalyticsLogTask" task
              LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON task."analyticslogId" = tal."id"
       WHERE  tal."type" = 'remove'
       GROUP BY 1) AS latest_activity
WHERE tsh."end_date" IS NULL
	AND tsh."taskId" = latest_activity."taskId";


/* PartyUserHistory is a SCD, which tracks the history of users associated to Parties- to calcuate durations and quantities at each state */
/* Any query against PSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* PartyStateHistory 2: insert new activity being loaded FROM temp table, and insert into PartyStateHistory */

/* PartyUserHistory 1:  first mark any existing activities entries that have been changed as ended */
WITH first_change AS
(
	SELECT alpu."partyId", alpu."updated_at" AS "close_date", ROW_NUMBER() OVER (PARTITION BY alpu."partyId" ORDER BY alpu.updated_at) AS ord
	FROM "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser" alpu
		INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alpu."analyticslogId" = tal."id"
		INNER JOIN "dstNormDB"."dstNormSchema"."PartyUserHistory" puh ON alpu."partyId" = puh."partyId" AND puh."end_date" IS NULL
	WHERE alpu."userId" <> puh."userId"
)
UPDATE "dstNormDB"."dstNormSchema"."PartyUserHistory" upd
	SET "end_date" = fc."close_date"
FROM first_change fc
WHERE upd."partyId" = fc."partyId"
	AND fc.ord = 1
	AND upd."end_date" IS NULL
  AND upd."start_date" < fc."close_date";

/* PartyUserHistory 2:  get new activity and insert into PartyUserHistory */
WITH DistinctParties AS
(
SELECT DISTINCT "partyId"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser" alpu
	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" al ON alpu."analyticslogId" = al."id"
), GetLead AS (
SELECT alpu."partyId",
			 alpu."userId",
			 lag(alpu."userId",1) OVER (PARTITION BY alpu."partyId" ORDER BY alpu.created_at) AS "lastUserId",
			 alpu.created_at AS "start_date"
FROM "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser" alpu
	INNER JOIN DistinctParties dp ON alpu."partyId" = dp."partyId"
), GetUnique AS (
SELECT "partyId",
			 "userId",
			 "lastUserId",
			 "start_date"
FROM GetLead
WHERE "userId" != "lastUserId"
	OR "lastUserId" IS NULL
)
INSERT INTO "dstNormDB"."dstNormSchema"."PartyUserHistory" (
	"analyticslogId",
	"partyId",
	"userId",
	"created_at",
	"updated_at",
	"start_date",
	"end_date"
)
SELECT  alpu."analyticslogId",
				gu."partyId",
				gu."userId",
				alpu."created_at",
				alpu."updated_at",
				gu."start_date",
				lead(gu."start_date",1) OVER (PARTITION BY gu."partyId" ORDER BY gu."start_date") AS "end_date"
FROM GetUnique gu
	JOIN "dstNormDB"."dstNormSchema"."AnalyticsLogPartyUser" alpu ON gu."partyId" = alpu."partyId" AND gu."userId" = alpu."userId" AND gu."start_date" = alpu."created_at"
	LEFT JOIN "dstNormDB"."dstNormSchema"."PartyUserHistory" ex ON alpu."analyticslogId" = ex."analyticslogId"
WHERE ex."analyticslogId" IS NULL;

/* InventoryGroupHistory is a SCD, which tracks the history of the various changes that occur in InventoryGroup */
/* Any query against IGH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* InventoryGroupHistory 1: find last InventoryGroupHistory activity for each inventoryGroup that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."InventoryGroupHistory" igh
SET "end_date" = latest_update."close_date"
FROM (
	SELECT ig."id", max(ig."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."InventoryGroup" ig
	  where ig.updated_at > (select max(updated_at) FROM "dstNormDB"."dstNormSchema"."InventoryGroupHistory")
GROUP BY 1
) AS latest_update
WHERE igh."end_date" IS NULL
  AND igh."inventorygroupId" = latest_update."id"
  AND igh."start_date" < latest_update."close_date";

/* InventoryGroupHistory 2: get new activity being changed, and insert into InventoryGroupHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."InventoryGroupHistory" (
  "inventorygroupId",
  "name",
  "propertyId",
  "displayName",
  "description",
  "basePriceMonthly",
  "basePriceWeekly",
  "basePriceDaily",
  "basePriceHourly",
  "start_date",
  "end_date",
  "created_at",
  "updated_at"
)
SELECT
  ig."id",
  ig."name",
  ig."propertyId",
  ig."displayName",
  ig."description",
  ig."basePriceMonthly",
  ig."basePriceWeekly",
  ig."basePriceDaily",
  ig."basePriceHourly",
  COALESCE(lead(ig."updated_at", 1) OVER (PARTITION BY ig."id" ORDER BY ig."updated_at"), ig."updated_at") AS "start_date",
  null AS "end_date",
  ig."created_at",
  ig."updated_at"
FROM "dstNormDB"."dstNormSchema"."InventoryGroup" ig
WHERE ig.updated_at > (select max(updated_at) FROM "dstNormDB"."dstNormSchema"."InventoryGroupHistory")
	OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."InventoryGroupHistory") = 0);


/* AmenityHistory is a SCD, which tracks the history of the various changes that occur in the Amenity table */
/* Any query against AH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* AmenityHistory 1: find last AmenityHistory activity for each amenity that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."AmenityHistory" ah
SET "end_date"= latest_update."close_date"
FROM (
	SELECT a."id", max(a."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."Amenity" a
	  WHERE a.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."AmenityHistory")
GROUP BY 1
) AS latest_update
WHERE ah."end_date" IS NULL
  AND ah."amenityId" = latest_update."id"
  AND ah."start_date" < latest_update."close_date";

/* AmenityHistory 2: get new amenity being changed, and insert into AmenityHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."AmenityHistory" (
  "amenityId",
  "name",
  "category",
  "subCategory",
  "description",
  "propertyId",
  "displayName",
  "relativePrice",
  "absolutePrice",
  "start_date",
  "end_date",
  "created_at",
  "updated_at",
  "hidden",
  "highValue",
  "infographicName",
  "targetUnit"
)
SELECT
  a."id",
  a."name",
  a."category",
  a."subCategory",
  a."description",
  a."propertyId",
  a."displayName",
  a."relativePrice",
  a."absolutePrice",
  COALESCE(lead(a."updated_at", 1) OVER (PARTITION BY a."id" ORDER BY a."updated_at"), a."updated_at") AS "start_date",
  null AS "end_date",
  a."created_at",
  a."updated_at",
  a."hidden",
  a."highValue",
  a."infographicName",
  a."targetUnit"
FROM "dstNormDB"."dstNormSchema"."Amenity" a
WHERE a.updated_at > (SELECT max(updated_at) FROM	"dstNormDB"."dstNormSchema"."AmenityHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."AmenityHistory") = 0);


/* Inventory History is a SCD, which tracks the history of the various changes that occur in the Inventory table */
/* Any query against IH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* InventoryHistory 1: find last InventoryHistory activity for each inventory that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."InventoryHistory" ih
SET "end_date"= latest_update."close_date"
FROM (
	SELECT i."id", max(i."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."Inventory" i
	  WHERE i.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."InventoryHistory")
GROUP BY 1
) AS latest_update
WHERE ih."end_date" IS NULL
  AND ih."inventoryId" = latest_update."id"
  AND ih."start_date" < latest_update."close_date";

/* InventoryHistory 2: get new amenity being changed, and insert into InventoryHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."InventoryHistory" (
  "inventoryId",
  "name",
  "propertyId",
  "description",
  "type",
  "floor",
  "layoutId",
  "inventoryGroupId",
  "buildingId",
  "parentInventory",
  "state",
  "stateStartDate",
	"start_date",
  "end_date",
  "created_at",
  "updated_at"
)
SELECT
  i."id",
  i."name",
  i."propertyId",
  i."description",
  i."type",
  i."floor",
  i."layoutId",
  i."inventoryGroupId",
  i."buildingId",
  i."parentInventory",
  i."state",
  i."stateStartDate",
  COALESCE(lead(i."updated_at", 1) OVER (PARTITION BY i."id" ORDER BY i."updated_at"), i."updated_at") AS "start_date",
  null AS "end_date",
  i."created_at",
  i."updated_at"
FROM "dstNormDB"."dstNormSchema"."Inventory" i
WHERE i.updated_at > (SELECT MAX(updated_at) FROM	"dstNormDB"."dstNormSchema"."InventoryHistory")
	OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."InventoryHistory") = 0);

/* ConcessionHistory 1: find last ConcessionHistory activity for each concession that has changed, and set end date to be start date of new create date */
/* ConcessionHistory is a SCD, which tracks the history of the various changes that occur in the Concession table */
/* Any query against CH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
UPDATE "dstNormDB"."dstNormSchema"."ConcessionHistory" ch
SET "stateEndDate"= latest_update."close_date"
FROM (
	SELECT c."id", max(c."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."Concession" c
	  WHERE c.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."ConcessionHistory")
GROUP BY 1
) AS latest_update
WHERE ch."stateEndDate" IS NULL
  AND ch."concessionId" = latest_update."id"
  AND ch."stateStartDate" < latest_update."close_date";

/* ConcessionHistory 2: get new concession being changed, and insert into ConcessionHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."ConcessionHistory" (
	"concessionId",
	"name",
	"propertyId",
	"description",
	"relativeAdjustment",
	"absoluteAdjustment",
	"variableAdjustment",
	"optional",
	"recurring",
	"recurringCount",
	"nonRecurringAppliedAt",
	"matchingCriteria",
	"leaseState",
	"startDate",
	"stateStartDate",
	"endDate",
	"stateEndDate",
	"account",
	"subAccount",
	"taxable",
	"hideInSelfService",
	"displayName",
	"excludeFromRentFlag",
	"externalChargeCode",
	"bakedIntoAppliedFeeFlag",
	"created_at",
	"updated_at")
SELECT
	c."id",
	c."name",
	c."propertyId",
	c."description",
	c."relativeAdjustment",
	c."absoluteAdjustment",
	c."variableAdjustment",
	c."optional",
	c."recurring",
	c."recurringCount",
	c."nonRecurringAppliedAt",
	c."matchingCriteria",
	c."leaseState",
	c."startDate",
	COALESCE(LEAD(c."updated_at", 1) OVER (PARTITION BY c."id" ORDER BY c."updated_at"), c."updated_at") AS "stateStartDate",
	c."endDate",
	NULL AS "stateEndDate",
	c."account",
	c."subAccount",
	c."taxable",
	c."hideInSelfService",
	c."displayName",
	c."excludeFromRentFlag",
	c."externalChargeCode",
	c."bakedIntoAppliedFeeFlag",
	c."created_at",
	c."updated_at"
FROM "dstNormDB"."dstNormSchema"."Concession" c
WHERE c.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."ConcessionHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."ConcessionHistory") = 0);

/* InventoryGroup_AmenityHistory 1: find last InventoryGroup_AmenityHistory activity for each InventoryGroup_Amenity that has changed, and set end date to be start date of new create date */
/* InventoryGroup_AmenityHistory is a SCD, which tracks the history of the various changes that occur in the InventoryGroup_Amenity table */
/* Any query against InventoryGroup_AmenityHistory needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
UPDATE "dstNormDB"."dstNormSchema"."InventoryGroup_AmenityHistory" igah
SET "endDate"= latest_update."close_date"
FROM (
	SELECT iga."id", max(iga."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."InventoryGroup_Amenity" iga
	  WHERE iga.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."InventoryGroup_AmenityHistory")
GROUP BY 1
) AS latest_update
WHERE igah."endDate" IS NULL
  AND igah."inventoryGroupAmenityId" = latest_update."id"
  AND igah."startDate" < latest_update."close_date";

/* InventoryGroup_AmenityHistory 2: get new InventoryGroup_Amenity being changed, and insert into InventoryGroup_AmenityHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."InventoryGroup_AmenityHistory" (
	"inventoryGroupAmenityId",
	"inventoryGroupId",
	"amenityId",
	"startDate",
	"endDate",
	"created_at",
	"updated_at")
SELECT
	iga."id",
	iga."inventoryGroupId",
	iga."amenityId",
	COALESCE(LEAD(iga."updated_at", 1) OVER (PARTITION BY iga."id" ORDER BY iga."updated_at"), iga."updated_at") AS "startDate",
	NULL AS "endDate",
	iga."created_at",
	iga."updated_at"
FROM "dstNormDB"."dstNormSchema"."InventoryGroup_Amenity" iga
WHERE iga.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."InventoryGroup_AmenityHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."InventoryGroup_AmenityHistory") = 0);

/* Inventory_AmenityHistory 1: find last Inventory_AmenityHistory activity for each Inventory_Amenity that has changed, and set end date to be start date of new create date */
/* Inventory_AmenityHistory is a SCD, which tracks the history of the various changes that occur in the Inventory_Amenity table */
/* Any query against Inventory_AmenityHistory needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
UPDATE "dstNormDB"."dstNormSchema"."Inventory_AmenityHistory" iah
SET "endDate"= latest_update."close_date"
FROM (
	SELECT ia."id", max(ia."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."Inventory_Amenity" ia
	  WHERE ia.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."Inventory_AmenityHistory")
GROUP BY 1
) AS latest_update
WHERE iah."endDate" IS NULL
  AND iah."inventory_amenityId" = latest_update."id"
  AND iah."startDate" < latest_update."close_date";

/* Inventory_AmenityHistory 2: get new Inventory_Amenity being changed, and insert into Inventory_AmenityHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."Inventory_AmenityHistory" (
	"inventory_amenityId",
	"inventoryId",
	"amenityId",
	"startDate",
	"endDate",
	"created_at",
	"updated_at")
SELECT
	ia."id",
	ia."inventoryId",
	ia."amenityId",
	COALESCE(LEAD(ia."updated_at", 1) OVER (PARTITION BY ia."id" ORDER BY ia."updated_at"), ia."updated_at") AS "startDate",
	NULL AS "endDate",
	ia."created_at",
	ia."updated_at"
FROM "dstNormDB"."dstNormSchema"."Inventory_Amenity" ia
WHERE ia.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."Inventory_AmenityHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."Inventory_AmenityHistory") = 0);

/* Layout_AmenityHistory 1: find last Layout_AmenityHistory activity for each Layout_Amenity that has changed, and set end date to be start date of new create date */
/* Layout_AmenityHistory is a SCD, which tracks the history of the various changes that occur in the Layout_Amenity table */
/* Any query against Layout_AmenityHistory needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
UPDATE "dstNormDB"."dstNormSchema"."Layout_AmenityHistory" lah
SET "endDate"= latest_update."close_date"
FROM (
	SELECT la."id", max(la."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."Layout_Amenity" la
	  WHERE la.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."Layout_AmenityHistory")
GROUP BY 1
) AS latest_update
WHERE lah."endDate" IS NULL
  AND lah."layout_amenityId" = latest_update."id"
  AND lah."startDate" < latest_update."close_date";

/* Layout_AmenityHistory 2: get new Layout_Amenity being changed, and insert into Layout_AmenityHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."Layout_AmenityHistory" (
	"layout_amenityId",
	"layoutId",
	"amenityId",
	"startDate",
	"endDate",
	"created_at",
	"updated_at")
select
	la."id",
	la."layoutId",
	la."amenityId",
	COALESCE(LEAD(la."updated_at", 1) OVER (PARTITION BY la."id" ORDER BY la."updated_at"), la."updated_at") AS "startDate",
	NULL AS "endDate",
	la."created_at",
	la."updated_at"
FROM "dstNormDB"."dstNormSchema"."Layout_Amenity" la
WHERE la.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."Layout_AmenityHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."Layout_AmenityHistory") = 0);

/* LeaseTermHistory 1: find last LeaseTermHistory activity for each LeaseTerm that has changed, and set end date to be start date of new create date */
/* LeaseTermHistory is a SCD, which tracks the history of the various changes that occur in the LeaseTerm table */
/* Any query against LeaseTermHistory needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
UPDATE "dstNormDB"."dstNormSchema"."LeaseTermHistory" lth
SET "endDate"= latest_update."close_date"
FROM (
	SELECT lt."id", max(lt."updated_at") AS "close_date"
	  FROM "dstNormDB"."dstNormSchema"."LeaseTerm" lt
    WHERE lt.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."LeaseTermHistory")
GROUP BY 1
) AS latest_update
WHERE lth."endDate" IS NULL
  AND lth."leasetermId" = latest_update."id"
  AND lth."startDate" < latest_update."close_date";

/* n_LeaseTermHistory 2: get new LeaseTerm being changed, and insert into LeaseTermHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."LeaseTermHistory" (
	"leasetermId",
	"termLength",
	"showOnQuote",
	"leaseNameId",
	"period",
	"relativeAdjustment",
	"absoluteAdjustment",
	"state",
	"startDate",
	"endDate",
	"created_at",
	"updated_at"
)
SELECT
	lt."id",
	lt."termLength",
	lt."showOnQuote",
	lt."leaseNameId",
	lt."period",
	lt."relativeAdjustment",
	lt."absoluteAdjustment",
	lt."state",
	COALESCE(LEAD(lt."updated_at", 1) OVER (PARTITION BY lt."id" ORDER BY lt."updated_at"), lt."updated_at") AS "startDate",
	NULL AS "endDate",
	lt."created_at",
	lt."updated_at"
FROM "dstNormDB"."dstNormSchema"."LeaseTerm" lt
WHERE lt.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."LeaseTermHistory")
OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."LeaseTermHistory") = 0);

/* RmsPricingHistory 1: find the last RmsPrincing update date as set as end_date for all existing records */
/* RmsPricingHistory is a SCD, which tracks the history of the imports that occur in the RmsPricing table */
/* Any query against RmsPricingHistory needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* RmsPricing is overwritten at each import, so if the inventoryId exists, RmsPricingHistory existing record gets and end_date (1) and a new record (2),
																								if the inventoryId is new, RmsPricingHistory gets a new record for the new inventory (2)
																								if the inventoryId is not coming any more, RmsPricingHistory existing record gets and end_date (1)*/
UPDATE "dstNormDB"."dstNormSchema"."RmsPricingHistory" rph
SET "end_date"= latest_update."close_date"
FROM
(
	SELECT "inventoryId", "pricingType", max(la."updated_at") AS "close_date"
	FROM "dstNormDB"."dstNormSchema"."RmsPricing" la
	WHERE la.updated_at > (SELECT MAX(updated_at)
												 FROM "dstNormDB"."dstNormSchema"."RmsPricingHistory")
	GROUP BY 1,2
) AS latest_update
WHERE rph."end_date" IS NULL
	AND rph."inventoryId" = latest_update."inventoryId"
	AND rph."pricingType" = latest_update."pricingType"
	AND rph."start_date" < latest_update."close_date";

/* RmsPricingHistory 2: get new RmsPricing being imported, and insert into RmsPricingHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."RmsPricingHistory" (
	"id",
	"inventoryId",
	"fileName",
	"rmsProvider",
	"minRent",
	"minRentStartDate",
	"minRentEndDate",
	"minRentLeaseLength",
	"standardLeaseLength",
	"standardRent",
	"availDate",
	"status",
	"amenityValue",
	"rentMatrix",
	"start_date",
	"end_date",
	"created_at",
	"updated_at",
	"amenities",
	"renewalDate",
	"propertyId",
	"type",
	"pricingType"
	)
SELECT
	r."id",
	r."inventoryId",
	r."fileName",
	r."rmsProvider",
	r."minRent",
	r."minRentStartDate",
	r."minRentEndDate",
	r."minRentLeaseLength",
	r."standardLeaseLength",
	r."standardRent",
	r."availDate",
	r."status",
	r."amenityValue",
	r."rentMatrix",
	COALESCE(LEAD(r."updated_at", 1) OVER (PARTITION BY r."inventoryId", r."pricingType" ORDER BY r."updated_at"), r."updated_at") AS "startDate",
	NULL AS "end_date",
	r."created_at",
	r."updated_at",
	"amenities",
	"renewalDate",
	"propertyId",
	"type",
	"pricingType"
FROM "dstNormDB"."dstNormSchema"."RmsPricing" r
WHERE r.updated_at > (SELECT MAX(updated_at) FROM "dstNormDB"."dstNormSchema"."RmsPricingHistory")
	OR ((SELECT COUNT(*) FROM "dstNormDB"."dstNormSchema"."RmsPricingHistory") = 0);
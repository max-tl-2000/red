/*  L2-DDL+Load.SQL - intended to load transformations to the normalized historical data model.   */
/*	Assumes that L1_Load.SQL has been run right before, which will populate the t_ temp tables -- */
/* and this information is used to UPSERT only those new records part of the most recent extract.   */

/* DDL -- Used only one tables need to be created initially -- don't run as part of a new load, or else you will wipe out history */

DROP TABLE IF EXISTS  "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"displayNo" integer,
	"isSystemGenerated" boolean,
	"state" varchar(20),
	"storedUnitsFilters" json,
	"metadata" json,
	"qualificationQuestions" json,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS  "dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser" (
	"analyticslogId"	uuid	NOT NULL,
	"userId" uuid NOT NULL,
	"partyId" uuid NOT NULL,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	PRIMARY KEY ("analyticslogId", "userId")
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_PartyStateHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_PartyStateHistory" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"state"	       varchar(255)	NOT NULL ,
	"start_date"    timestamptz NOT NULL,
	"end_date"      timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_TaskStateHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_TaskStateHistory" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"taskId"	uuid	NOT NULL,
	"userId"	uuid,
	"state" varchar(255)	NOT NULL ,
	"start_date" timestamptz NOT NULL,
	"end_date" timestamptz,
	"dueDate" timestamptz,
	"created_at" timestamptz,
	"updated_at" timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_PartyUserHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_PartyUserHistory" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"userId"	uuid	NOT NULL,
	"start_date"    timestamptz NOT NULL,
	"end_date"      timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_PartyTeam";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_PartyTeam" (
	"id"	        SERIAL	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"teamId"	uuid	NOT NULL ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz

);

DROP TABLE IF EXISTS  "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" (
	"analyticslogId"	uuid	NOT NULL PRIMARY KEY,
	"partyId"	uuid	NOT NULL,
	"metadata" json,
	"completionDate" timestamptz,
	"state" varchar(255),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS  "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask" (
	"analyticslogId"	uuid NOT NULL PRIMARY KEY,
	"userId" uuid,
	"partyId" uuid,
	"taskId" uuid NOT NULL,
  "metadata" json,
  "state" varchar(255),
  "dueDate" timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory" (
	"inventorygroupId"	uuid	NOT NULL,
	"name" varchar(255),
	"propertyId" uuid,
	"displayName" varchar(255),
	"description" varchar(255),
	"basePriceMonthly" float,
	"basePriceWeekly" float,
	"basePriceDaily" float,
	"basePriceHourly" float,
	"start_date"    timestamptz NOT NULL,
	"end_date"      timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_AmenityHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_AmenityHistory" (
	"amenityId" uuid NOT NULL,
	"name" varchar(255),
	"category" varchar(255),
	"subCategory" varchar(255),
	"description" varchar(255),
	"propertyId" uuid,
	"displayName" varchar(255),
	"relativePrice" float,
	"absolutePrice" float,
	"start_date"    timestamptz NOT NULL,
	"end_date"      timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_InventoryHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_InventoryHistory" (
  "inventoryId" uuid NOT NULL,
  "name" varchar(255),
  "propertyId" uuid,
  "description" varchar(255),
  "type" varchar(255),
  "floor" int,
  "layoutId" uuid,
  "inventoryGroupId" uuid,
  "buildingId" uuid,
  "parentInventory" uuid,
  "state" varchar(255),
  "start_date" timestamptz NOT NULL,
  "stateStartDate" timestamptz,
  "end_date" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

DROP TABLE IF EXISTS "dstNormDB"."dstNormSchema"."n_MarketRentHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_MarketRentHistory" (
	"entityId" uuid NOT NULL,
	"name" varchar(255),
	"marketRentMonthly" float,
	"marketRentWeekly" float,
	"marketRentDaily" float,
	"marketRentHourly" float,
	"inventoryGroupId" uuid,
	"start_date" timestamptz NOT NULL,
	"end_date" timestamptz,
	"created_at" timestamptz default now(),
	"updated_at" timestamptz default now()
);

/* Load -- using L1 n_ tables as input, t_tablees to get incremental scope, transform some of the complex objects into relational structured data, that will then be used to create analytic stars */
INSERT INTO "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" (
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
	"analyticslogId",
	CAST(("context"#>>'{parties,0}') as uuid) as "partyId",
  CAST((COALESCE("activityDetails"->>'displayNo','0')) AS INTEGER)  as "displayNo",
	CAST(("activityDetails"->>'isSystemGenerated') as boolean) as "isSystemGenerated",
	"entity"->>'state' as "state",
	CAST(("entity"->>'storedUnitsFilters' ) as json) as "storedUnitsFilters",
	CAST(("entity"->>'metadata' ) as json) as "metadata",
	CAST(("entity"->>'qualificationQuestions' ) as json) as "qualificationQuestions",
	"created_at",
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_AnalyticsLog"
WHERE   "analyticslogId" IN (select distinct "id" from "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
        and "component" = 'party'
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


DELETE FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser"
WHERE   "analyticslogId" IN (select distinct "id" from "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog");

INSERT INTO "dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser" (
	"analyticslogId",
	"userId",
	"partyId",
	"created_at",
	"updated_at"
)
SELECT
	"analyticslogId",
 	COALESCE(CAST(("context"#>>'{users,0}') as uuid), CAST((entity->>'userId') as uuid)) as "userId",
	CAST(("context"#>>'{parties,0}') as uuid)  as "partyId",
	"created_at",
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_AnalyticsLog"
WHERE   "analyticslogId" IN (select distinct "id" from "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
        and "component" = 'party'
        and "context"#>>'{parties,0}' IS NOT NULL;

/* PartyStateHistory 1: find last PartyStateHistory activity for each party that has incoming party activity, and set end date to be start date of new create date */
WITH Parties AS (
SELECT psh."analyticslogId", min(alp."updated_at") AS minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory"  psh
 	INNER JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" alp ON psh."partyId"=alp."partyId"
 	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" al ON alp."analyticslogId"=al."id"
WHERE psh."end_date" IS NULL
  AND alp."updated_at">=psh."start_date"
GROUP BY psh."analyticslogId"
)
UPDATE "dstNormDB"."dstNormSchema"."n_PartyStateHistory" upd
	SET "end_date" = minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory" psh
  LEFT JOIN Parties p ON psh."analyticslogId" = p."analyticslogId"
WHERE upd."analyticslogId" = psh."analyticslogId";

/* PartyStateHistory is a SCD, which tracks the history of the various states of the PartyState - to calcuate durations and quantities at each state */
/* Any query against PSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* PartyStateHistory 2: insert new activity being loaded from temp table, and insert into PartyStateHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_PartyStateHistory" (
	"analyticslogId",
	"partyId",
	"state",
	"created_at",
	"updated_at",
	"start_date",
	"end_date"
)
SELECT DISTINCT ON (alp."state", alp."partyId")
  alp."analyticslogId",
  alp."partyId",
  alp."state",
  alp."created_at",
  alp."updated_at",
  alp."created_at" as "start_date",
  (SELECT "updated_at" FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" 
    WHERE "partyId" = alp."partyId" 
    AND state <> alp.state 
    AND updated_at > alp.updated_at
    ORDER BY updated_at
    LIMIT 1) AS "end_date"
FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" alp
  LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alp."analyticslogId" = tal."id" and tal."type"<>'remove'
WHERE alp.state IS NOT NULL
  AND alp.state NOT IN (SELECT "state" FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory" WHERE "partyId" = alp."partyId")
  AND alp."analyticslogId" NOT IN (SELECT "analyticslogId" FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory");

/* PartyStateHistory 3:  mark any activities entries that have been removed as ended */
UPDATE "dstNormDB"."dstNormSchema"."n_PartyStateHistory"  psh
SET "end_date"= latest_activity."close_date"
FROM (SELECT alp."partyId", max(alp."updated_at") as "close_date"
       FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogParty" alp
              LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alp."analyticslogId"=tal."id"
       WHERE  tal."type"='remove'
       GROUP BY 1) as latest_activity
WHERE psh."end_date" IS NULL AND psh."partyId"=latest_activity."partyId";

/* PartyUserHistory is a SCD, which tracks the history of users associated to Parties- to calcuate durations and quantities at each state */
/* Any query against PSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* PartyStateHistory 2: insert new activity being loaded from temp table, and insert into PartyStateHistory */

/* n_PartyUserHistory 3:  first mark any existing activities entries that have been changed as ended */
UPDATE "dstNormDB"."dstNormSchema"."n_PartyUserHistory" puh
SET "end_date"= latest_activity."close_date"
FROM    (SELECT alpu."analyticslogId", alpu."partyId", max(alpu."updated_at") as "close_date"
         FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser" alpu
                INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON alpu."analyticslogId"=tal."id"
         GROUP BY 1,2) as latest_activity
WHERE puh."end_date" IS NULL
  AND puh."partyId"=latest_activity."partyId"
  AND puh."start_date" < latest_activity."close_date";

INSERT INTO "dstNormDB"."dstNormSchema"."n_PartyUserHistory" (
	"analyticslogId",
	"partyId",
	"userId",
	"created_at",
	"updated_at",
	"start_date",
	"end_date"
)
SELECT
	alpu."analyticslogId",
	alpu."partyId",
	alpu."userId",
	alpu."created_at",
	alpu."updated_at",
  alpu."updated_at" as "start_date",
	lead(alpu."updated_at",1) over (partition by alpu."partyId" order by alpu."updated_at" ) as "end_date"
FROM 	"dstNormDB"."dstNormSchema"."n_AnalyticsLogPartyUser" alpu
  LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal on alpu."analyticslogId" = tal."id"
WHERE tal."type"<>'remove'
  AND	alpu."analyticslogId" NOT IN (SELECT "analyticslogId" FROM "dstNormDB"."dstNormSchema"."n_PartyUserHistory");

DELETE FROM "dstNormDB"."dstNormSchema"."n_PartyTeam"
        WHERE 	"partyId" IN (select "id" from "tmpNormDB"."tmpNormSchema"."t_Party");

INSERT INTO "dstNormDB"."dstNormSchema"."n_PartyTeam" (
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
FROM 	"tmpNormDB"."tmpNormSchema"."t_Party" py;

INSERT INTO "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" (
	"analyticslogId",
	"partyId",
	"metadata",
	"completionDate",
	"state",
	"created_at",
	"updated_at"
)
SELECT
	"analyticslogId",
	CAST(("context"#>>'{parties,0}') as uuid) as "partyId",
	"entity" as "metadata",
  CAST(CAST("entity"->>'metadata' as json)->>'endDate' as timestamptz) as "completionDate",
	"entity"->>'state' as "state",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLog"
WHERE "analyticslogId" IN (select distinct "id" from "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
and "component" = 'appointment'
ON CONFLICT ("analyticslogId")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"metadata" = EXCLUDED."metadata",
		"completionDate" = EXCLUDED."completionDate",
		"state" = EXCLUDED."state",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


INSERT INTO "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask" (
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
	"analyticslogId",
 	COALESCE(CAST(("context"#>>'{users,0}') as uuid), CAST(("entity"#>>'{userIds,0}') as uuid)) as "userId",
	CAST(("context"#>>'{parties,0}') as uuid) as "partyId",
	CAST(("entity"->>'id' ) as uuid) as "taskId",
	entity as metadata,
	"entity"->>'state' as "state",
	CAST(("entity"->>'dueDate' ) as timestamptz) as "dueDate",
	"created_at",
	"updated_at"
FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLog"
WHERE "analyticslogId" IN (select distinct "id" from "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog")
and "component" = 'task' and "entity"->>'id' is not null
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


/* TaskStateHistory 1: find last TaskStateHistory activity for each task that has incoming task activity, and set end date to be start date of new create date */
WITH Tasks AS (
SELECT tsh."analyticslogId", min(alt."updated_at") AS minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."n_TaskStateHistory" tsh
 	INNER JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask" alt ON tsh."taskId"=alt."taskId"
 	INNER JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" al ON alt."analyticslogId"=al."id"
WHERE tsh."end_date" IS NULL
	AND alt."updated_at">=tsh."start_date"
GROUP BY tsh."analyticslogId"
)
UPDATE "dstNormDB"."dstNormSchema"."n_TaskStateHistory" upd
	SET "end_date" = minUpdatedAt
FROM "dstNormDB"."dstNormSchema"."n_TaskStateHistory" tsh
  LEFT JOIN Tasks t ON tsh."analyticslogId" = t."analyticslogId"
WHERE upd."analyticslogId" = tsh."analyticslogId";

/* TaskStateHistory is a SCD, which tracks the history of the various states of the TaskState - to calcuate durations and quantities at each state */
/* Any query against TSH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* TaskStateHistory 2: insert new activity being loaded from temp table, and insert into TaskStateHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_TaskStateHistory" (
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
  task."created_at" as "start_date",
  lead(task."updated_at", 1) over (partition by task."taskId" order by task."updated_at" ) as "end_date",
  task."dueDate"
from "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask" task
  LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal on task."analyticslogId" = tal."id"
WHERE tal."type"<>'remove'
  AND task.state IS NOT NULL
  AND task."analyticslogId" NOT IN (SELECT "analyticslogId" FROM "dstNormDB"."dstNormSchema"."n_TaskStateHistory");


/* TaskStateHistory 3:  mark any  entries tasks that have been removed as ended */
UPDATE "dstNormDB"."dstNormSchema"."n_TaskStateHistory" tsh
SET "end_date"= latest_activity."close_date"
FROM (SELECT task."taskId", max(task."updated_at") as "close_date"
       FROM "dstNormDB"."dstNormSchema"."n_AnalyticsLogTask" task
              LEFT JOIN "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" tal ON task."analyticslogId"=tal."id"
       WHERE  tal."type"='remove'
       GROUP BY 1) as latest_activity
WHERE tsh."end_date" IS NULL AND tsh."taskId"=latest_activity."taskId";


/* InventoryGroupHistory is a SCD, which tracks the history of the various changes that occur in InventoryGroup */
/* Any query against IGH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* InventoryGroupHistory 1: find last InventoryGroupHistory activity for each inventoryGroup that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory" igh
SET "end_date"= latest_update."close_date"
FROM (
	SELECT ig."inventorygroupId", max(ig."updated_at") as "close_date"
	  FROM "dstNormDB"."dstNormSchema"."n_InventoryGroup" ig
	  where ig.updated_at > (select max(updated_at) from "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory")
GROUP BY 1
) as latest_update
WHERE igh."end_date" IS NULL
  AND igh."inventorygroupId"=latest_update."inventorygroupId"
  AND igh."start_date" < latest_update."close_date";

/* InventoryGroupHistory 2: get new activity being changed, and insert into InventoryGroupHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory" (
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
  ig."inventorygroupId",
  ig."name",
  ig."propertyId",
  ig."displayName",
  ig."description",
  ig."basePriceMonthly",
  ig."basePriceWeekly",
  ig."basePriceDaily",
  ig."basePriceHourly",
  COALESCE(lead(ig."updated_at", 1) over (partition by ig."inventorygroupId" order by ig."updated_at"), ig."updated_at") as "start_date",
  null as "end_date",
  ig."created_at",
  ig."updated_at"
FROM "dstNormDB"."dstNormSchema"."n_InventoryGroup" ig
WHERE ig.updated_at > (select max(updated_at) from "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory")
OR ((SELECT COUNT(*) from "dstNormDB"."dstNormSchema"."n_InventoryGroupHistory") = 0);


/* AmenityHistory is a SCD, which tracks the history of the various changes that occur in the Amenity table */
/* Any query against AH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* AmenityHistory 1: find last AmenityHistory activity for each amenity that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."n_AmenityHistory" ah
SET "end_date"= latest_update."close_date"
FROM (
	SELECT a."amenityId", max(a."updated_at") as "close_date"
	  FROM "dstNormDB"."dstNormSchema"."n_Amenity" a
	  WHERE a.updated_at > (SELECT MAX(updated_at) from "dstNormDB"."dstNormSchema"."n_AmenityHistory")
GROUP BY 1) AS latest_update
WHERE ah."end_date" IS NULL
  AND ah."amenityId"=latest_update."amenityId"
  AND ah."start_date" < latest_update."close_date";

/* AmenityHistory 2: get new amenity being changed, and insert into AmenityHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_AmenityHistory" (
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
  "updated_at"
)
SELECT
  a."amenityId",
  a."name",
  a."category",
  a."subCategory",
  a."description",
  a."propertyId",
  a."displayName",
  a."relativePrice",
  a."absolutePrice",
  COALESCE(lead(a."updated_at", 1) over (partition by a."amenityId" order by a."updated_at"), a."updated_at") as "start_date",
  null as "end_date",
  a."created_at",
  a."updated_at"
FROM "dstNormDB"."dstNormSchema"."n_Amenity" a
WHERE a.updated_at > (select max(updated_at) from	"dstNormDB"."dstNormSchema"."n_AmenityHistory")
OR ((SELECT COUNT(*) from "dstNormDB"."dstNormSchema"."n_AmenityHistory") = 0);

/* Inventory History is a SCD, which tracks the history of the various changes that occur in the Inventory table */
/* Any query against IH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */

/* InventoryHistory 1: find last InventoryHistory activity for each inventory that has changed, and set end date to be start date of new create date */

UPDATE "dstNormDB"."dstNormSchema"."n_InventoryHistory" ih
SET "end_date"= latest_update."close_date"
FROM (
	SELECT i."inventoryId", max(i."updated_at") as "close_date"
	  FROM "dstNormDB"."dstNormSchema"."n_Inventory" i
	  WHERE i.updated_at > (SELECT MAX(updated_at) from "dstNormDB"."dstNormSchema"."n_InventoryHistory")
GROUP BY 1
) AS latest_update
WHERE ih."end_date" IS NULL
  AND ih."inventoryId"=latest_update."inventoryId"
  AND ih."start_date" < latest_update."close_date";

/* InventoryHistory 2: get new amenity being changed, and insert into InventoryHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_InventoryHistory" (
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
  "start_date",
  "stateStartDate",
  "end_date",
  "created_at",
  "updated_at"
)
SELECT
  i."inventoryId",
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
  COALESCE(lead(i."updated_at", 1) over (partition by i."inventoryId" order by i."updated_at"), i."updated_at") as "start_date",
  null as "end_date",
  i."created_at",
  i."updated_at"
FROM "dstNormDB"."dstNormSchema"."n_Inventory" i
WHERE i.updated_at > (SELECT MAX(updated_at) from	"dstNormDB"."dstNormSchema"."n_InventoryHistory")
OR ((SELECT COUNT(*) from "dstNormDB"."dstNormSchema"."n_InventoryHistory") = 0);

/* MarketRentHistory is a SCD, which tracks the history of the various changes that occur in the MarketRent materialized view */
/* Any query against MRH needs to be done "As Of" a particular date, start_date >= "As Of Date" and "As of Date" > end_date OR end_date IS NULL */
/* MarketRentHistory 1: find last MarketRentHistory activity for each market rent record that has changed, and set end date to be start date of new create date */
UPDATE "dstNormDB"."dstNormSchema"."n_MarketRentHistory" mrHist
SET "end_date"= latest_update."close_date"
FROM (
	SELECT mr."entityId", max(mr."updated_at") as "close_date"
	FROM "dstNormDB"."dstNormSchema"."n_MarketRent" mr
	LEFT JOIN "dstNormDB"."dstNormSchema"."n_MarketRentHistory" mrh ON mrh."entityId" = mr."entityId"  
	WHERE 
	(
		mr."name" <> mrh."name" OR
		mr."marketRentMonthly" <> mrh."marketRentMonthly" OR
		mr."marketRentWeekly" <> mrh."marketRentWeekly" OR
		mr."marketRentDaily" <> mrh."marketRentDaily" OR
		mr."marketRentHourly" <> mrh."marketRentHourly" OR
		mr."inventoryGroupId" <> mrh."inventoryGroupId"
	)
GROUP BY 1
) AS latest_update
WHERE mrHist."end_date" IS NULL
  AND mrHist."entityId"=latest_update."entityId";

/* MarketRentHistory 2: get new market rent record being changed, and insert into MarketRentHistory */
INSERT INTO "dstNormDB"."dstNormSchema"."n_MarketRentHistory" (
  "entityId",
  "name",
  "marketRentMonthly",
  "marketRentWeekly",
  "marketRentDaily",
  "marketRentHourly",
  "inventoryGroupId",
  "start_date",
  "end_date",
  "created_at",
  "updated_at"
)
SELECT
  mr."entityId",
  mr."name",
  mr."marketRentMonthly",
  mr."marketRentWeekly",
  mr."marketRentDaily",
  mr."marketRentHourly",
  mr."inventoryGroupId",
  now() as "start_date",
  null as "end_date",
  mr."created_at",
  mr."updated_at"	
FROM "dstNormDB"."dstNormSchema"."n_MarketRent" mr
LEFT JOIN "dstNormDB"."dstNormSchema"."n_MarketRentHistory" mrh ON mrh."entityId" = mr."entityId"  
WHERE 
  (
    mr."name" <> mrh."name" OR
    mr."marketRentMonthly" <> mrh."marketRentMonthly" OR
    mr."marketRentWeekly" <> mrh."marketRentWeekly" OR
    mr."marketRentDaily" <> mrh."marketRentDaily" OR
    mr."marketRentHourly" <> mrh."marketRentHourly" OR
    mr."inventoryGroupId" <> mrh."inventoryGroupId"
  ) 
  OR ((SELECT COUNT(*) from "dstNormDB"."dstNormSchema"."n_MarketRentHistory") = 0);


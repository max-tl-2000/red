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
  "created_at"	timestamptz,
  "updated_at"	timestamptz
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

DROP TABLE IF EXISTS  "dstNormDB"."dstNormSchema"."n_RmsPricingHistory";
CREATE TABLE "dstNormDB"."dstNormSchema"."n_RmsPricingHistory" (
	"id" uuid NOT NULL PRIMARY KEY,
	"inventoryId" uuid NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"rmsProvider" varchar(255) NOT NULL,
	"minRent" numeric(8,2) NOT NULL,
	"minRentStartDate" timestamptz NOT NULL,
	"minRentEndDate" timestamptz NOT NULL,
	"minRentLeaseLength" int4 NOT NULL,
	"standardLeaseLength" int4 NULL,
	"standardRent" numeric(8,2) NULL,
	"availDate" timestamptz NULL,
	"status" varchar(255) NULL,
	"amenityValue" numeric(8,2) NULL,
	"rentMatrix" jsonb NULL,
	"start_date" timestamptz NOT NULL,
	"end_date" timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);


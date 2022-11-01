/*  L3-DDL+Load.SQL - intended to load and create dimension tables, sourced from the n_ tables   */
/*	Assumes that L1_Load.SQL and L2_Load.SQL has been run right before, which will populate the t_ temp tables */

/* DDL -- Used only one tables need to be created initially -- don't run as part of a new load, or else you will wipe out history */

DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_UserTeamProperty";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Date" ;
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Party";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Team";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_User";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_PipelineState";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Property";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_TeamSalesTargets";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets";
DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."d_Tasks";

CREATE TABLE "dstStarDB"."dstStarSchema"."d_UserTeamProperty" (
	"userId"	uuid   not null,
	"externalUniqueId"	varchar(255),
	"fullName"	     varchar(255),
	"preferredName"    varchar(255),
	"email"	     varchar(255),
	"employmentType"	varchar(255),
	"userInactive"	bool,
	"teamMemberDirectEmailIdentifier" varchar(80),
	"teamMemberDirectPhoneIdentifier" varchar(20),
	"ringPhones"	varchar(100),
	"teamMemberOutsideDedicatedEmails"	varchar(100),
	"teamId"	uuid   not null,
	"module"	text   ,
	"teamDescription"	varchar(500),
	"teamInactive"	bool ,
	"mainRoles"	varchar(255),
	"functionalRoles" varchar(255)	,
	"propertyId"	uuid   ,
  primary key("userId", "teamId", "propertyId")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Date" (
  "eventDt" date primary key
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Party" (
  "partyId"	uuid		PRIMARY KEY,
  "state"	varchar(255),
  "assignedPropertyId" uuid,
  "userId"	uuid,
  "score"	varchar(255),
  "type" varchar(255),
  "startDate"	timestamptz,
  "endDate"	timestamptz,
  "created_at"	timestamptz,
  "updated_at"	timestamptz
);


CREATE TABLE "dstStarDB"."dstStarSchema"."d_Team" (
	"teamId"	uuid		PRIMARY KEY,
	"module"	text		,
	"description"	varchar(500)		,
	"created_at"	timestamptz		,
	"updated_at"	timestamptz
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_User" (
	"userId"	uuid		PRIMARY KEY,
	"externalUniqueId"	varchar(255)		,
	"fullName"	varchar(255)		,
	"preferredName"	varchar(255)		,
	"email"	varchar(255)		,
	"employmentType"	varchar(255)		,
	"loginAttempts"	int4		,
	"inactive"	bool		,
	"ringPhones"	varchar(100)		,
	"created_at"	timestamptz		,
	"updated_at"	timestamptz
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_PipelineState" (
	"pipelineStateId"	integer		PRIMARY KEY,
	"state"	text		,
	"created_at"	timestamptz		,
	"updated_at"	timestamptz
);


CREATE TABLE "dstStarDB"."dstStarSchema"."d_Property" (
	"propertyId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(200)	NOT NULL ,
	"propertyLegalName"	varchar(200) ,
	"ownerName"            varchar(200),
	"ownerType"            varchar(200),
	"operatorName"         varchar(200),
	"operatorType"         varchar(200),
	"propertyGroupName"    varchar(200),
	"propertyGroupDescription" varchar(200),
	"propertyGroupDisplayName" varchar(200),
	"startDate"	timestamptz	 ,
	"endDate"	timestamptz	 ,
	"APN"	varchar(40)	 ,
	"MSANumber"	int2	 ,
	"MSAName"	varchar(60)	 ,
	"description"	text	 ,
	"website"	varchar(200)	 ,
	"displayName"	varchar(200)	 ,
	"timezone"	text	 ,
	"settings"	jsonb	 ,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_TeamSalesTargets" (
	"teamId"	uuid,
	"month"	int4,
	"year"	int4,
	"salesTarget"	int4,
	"salesCycleDays" int4,
	"created_at" timestamptz,
	"updated_at" timestamptz,
	primary key("teamId", "month", "year")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets" (
	"userId" uuid,
	"teamId" uuid,
	"month"	int4,
	"year"	int4,
	"salesTarget"	int4,
	"contactsToSalesConv" numeric,
	"leadsToSalesConv" numeric,
	"prospectsToSalesConv" numeric,
	"applicantsToSalesConv" numeric,
	"leasesToSalesConv" numeric,
	"salesCycleDays" int4,
	"created_at" timestamptz,
	"updated_at" timestamptz,
	primary key("teamId", "userId", "month", "year")
);

CREATE TABLE "dstStarDB"."dstStarSchema"."d_Tasks" (
	"taskId"	uuid	NOT NULL PRIMARY KEY,
	"name"	varchar(255),
	"partyId"	uuid	NOT NULL,
	"state"	text,
	"dueDate"	timestamptz,
	"category"	varchar(255),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

delete from "dstStarDB"."dstStarSchema"."d_UserTeamProperty"
        where true;

INSERT INTO "dstNormDB"."dstStarSchema"."d_UserTeamProperty" (
	"userId"	,
	"externalUniqueId",
	"fullName"	  ,
	"preferredName"   ,
	"email"	     ,
	"employmentType"	,
	"userInactive"	,
	"teamMemberDirectEmailIdentifier" ,
	"teamMemberDirectPhoneIdentifier" ,
	"ringPhones"	,
	"teamMemberOutsideDedicatedEmails"	,
	"teamId"	,
	"module"	   ,
	"teamDescription",
	"teamInactive"	 ,
	"mainRoles"	,
	"functionalRoles" 	,
	"propertyId"
)

SELECT
	u."userId"	,
	u."externalUniqueId"	,
	u."fullName"	,
	u."preferredName"	,
	u."email"	,
	u."employmentType"	,
	u."inactive"	,
	tm."directEmailIdentifier"	,
	tm."directPhoneIdentifier"	,
	u."ringPhones"	,
	tm."outsideDedicatedEmails"	,
	t."teamId"	,
	t."module"	,
	t."description"	,
	tm."inactive"	,
	tm."mainRoles"	,
	tm."functionalRoles"	,
	tp."propertyId"

FROM "dstNormDB"."dstNormSchema"."n_Users" as u
    LEFT JOIN "dstNormDB"."dstNormSchema"."n_TeamMembers" as tm ON u."userId" = tm."userId"
    LEFT JOIN "dstNormDB"."dstNormSchema"."n_Teams" as t ON tm."teamId" = t."teamId"
    LEFT JOIN "dstNormDB"."dstNormSchema"."n_TeamProperties" as tp ON t."teamId" = tp."teamId"
WHERE tm."teamId" is not null  and tp."propertyId" is not null;


INSERT INTO "dstStarDB"."dstStarSchema"."d_Party" (
  "partyId",
  "userId",
  "score",
  "type",
  "assignedPropertyId",
  "state",
  "startDate",
  "endDate",
  "created_at",
  "updated_at"
)
SELECT
  "partyId",
  "userId",
  "score",
  "qualificationQuestions"->>'groupProfile' as "type",
  "state",
  "assignedPropertyId",
  "created_at",
  null,
  "created_at",
  "updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_Party"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Party") is null
	 or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Party")
ON CONFLICT ("partyId")
	DO UPDATE
	SET
		"userId" = EXCLUDED."userId",
		"score" = EXCLUDED."score",
		"type" = EXCLUDED."type",
		"state" = EXCLUDED."state",
		"assignedPropertyId" = EXCLUDED."assignedPropertyId",
		"startDate" = EXCLUDED."startDate",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


INSERT INTO "dstStarDB"."dstStarSchema"."d_Team" (
	"teamId",
	"module",
	"description",
	"created_at"		,
	"updated_at"
)
SELECT	"teamId",
	"module",
	"description",
	"created_at"		,
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_Teams"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Team") is null
	 or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Team")
ON CONFLICT ("teamId")
	DO UPDATE
	SET
		"module" = EXCLUDED."module",
		"description" = EXCLUDED."description",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


INSERT INTO "dstStarDB"."dstStarSchema"."d_User" (
	"userId"	 ,
	"externalUniqueId"		,
	"fullName"		,
	"preferredName"		,
	"email"			,
	"employmentType"		,
	"loginAttempts"			,
	"inactive"		,
	"ringPhones"			,
	"created_at"			,
	"updated_at"
)
SELECT	"userId"	 ,
	"externalUniqueId"		,
	"fullName"		,
	"preferredName"		,
	"email"			,
	"employmentType"		,
	"loginAttempts"			,
	"inactive"		,
	"ringPhones"			,
	"created_at"			,
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_Users"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_User") is null
	 or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_User")
ON CONFLICT ("userId")
	DO UPDATE
	SET
		"externalUniqueId" = EXCLUDED."externalUniqueId",
		"fullName" = EXCLUDED."fullName",
		"preferredName" = EXCLUDED."preferredName",
		"email" = EXCLUDED."email",
		"employmentType" = EXCLUDED."employmentType",
		"loginAttempts" = EXCLUDED."loginAttempts",
		"inactive" = EXCLUDED."inactive",
		"ringPhones" = EXCLUDED."ringPhones",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

DELETE FROM "dstStarDB"."dstStarSchema"."d_Property"
        where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_Property" (
	"propertyId",
	"name",
	"propertyLegalName",
	"ownerName",
	"ownerType",
	"operatorName",
	"operatorType",
	"propertyGroupName",
	"propertyGroupDescription",
	"propertyGroupDisplayName",
	"startDate",
	"endDate",
	"APN",
	"MSANumber",
	"MSAName",
	"description",
	"website",
	"displayName",
	"timezone",
	"created_at",
	"updated_at"
)
SELECT
	p."propertyId",
	p."name",
	p."propertyLegalName",
	own."name",
	own."type",
	opr."name",
	opr."type",
	pg."name",
	pg."description",
	pg."displayName",
	p."startDate",
	p."endDate",
	p."APN",
	p."MSANumber",
	p."MSAName",
	p."description",
	p."website",
	p."displayName",
	p."timezone",
	p."created_at",
	p."updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_Property" p
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_BusinessEntity" own ON (p."owner" = own."businessentityId")
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_BusinessEntity" opr ON (p."operator" = opr."businessentityId")
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PropertyGroup" pg ON (p."propertyGroupId" = pg."propertygroupId");

DELETE FROM "dstStarDB"."dstStarSchema"."d_Date"
        where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_Date" (
        "eventDt"
)

SELECT date(d) as "eventDt"
FROM generate_series((select  min(date_trunc('day',"created_at")) from "dstNormDB"."dstNormSchema"."n_ActivityLog"),
											(select Case When max(date_trunc('day',"updated_at")) > date_trunc('day', now()) Then max(date_trunc('day',"updated_at"))
					                         Else date_trunc('day', now()) End MostRecent from "dstNormDB"."dstNormSchema"."n_ActivityLog"),
										'1 day') d;


DELETE FROM "dstStarDB"."dstStarSchema"."d_PipelineState"
        where true;


INSERT INTO "dstStarDB"."dstStarSchema"."d_PipelineState" (
	"pipelineStateId"	,
	"state"	,
	"created_at"		,
	"updated_at"
)
VALUES
	(1, 'Contact', now(), now()),
	(2, 'Prospect', now(), now()),
	(3, 'Lead', now(), now()),
	(4, 'Applicant', now(), now()),
	(5, 'FutureResident', now(), now()),
	(6, 'Lease', now(), now());

DELETE FROM "dstStarDB"."dstStarSchema"."d_TeamSalesTargets" where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_TeamSalesTargets" (
	"teamId",
	"month",
	"year",
	"salesTarget",
	"salesCycleDays",
	"created_at",
	"updated_at"
)
SELECT
	"teamId",
	"month",
	"year",
	"salesTarget",
	"salesCycleDays",
	"created_at",
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_TeamSalesTargets"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_TeamSalesTargets") is null
	 or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_TeamSalesTargets");

DELETE FROM "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets" where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets" (
	"teamId",
	"userId",
	"month",
	"year",
	"salesTarget",
	"contactsToSalesConv",
	"leadsToSalesConv",
	"prospectsToSalesConv",
	"applicantsToSalesConv",
	"leasesToSalesConv",
	"created_at",
	"updated_at"
)
SELECT
	"teamId",
	"userId",
	"month",
	"year",
	"salesTarget",
	"contactsToSalesConv",
	"leadsToSalesConv",
	"prospectsToSalesConv",
	"applicantsToSalesConv",
	"leasesToSalesConv",
	"created_at",
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_TeamMemberSalesTargets"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets") is null
or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_TeamMemberSalesTargets");

INSERT INTO "dstStarDB"."dstStarSchema"."d_Tasks" (
  "taskId",
  "name",
  "partyId",
  "state",
  "dueDate",
  "category",
  "created_at",
  "updated_at"
)
SELECT
  "taskId",
  "name",
  "partyId",
  "state",
  "dueDate",
  "category",
  "created_at",
  "updated_at"
FROM 	"dstNormDB"."dstNormSchema"."n_Tasks"
WHERE 	(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Tasks") is null
	 or "updated_at">(select max("updated_at") from "dstStarDB"."dstStarSchema"."d_Tasks")
ON CONFLICT ("taskId")
	DO UPDATE
	SET
    "taskId" = EXCLUDED."taskId",
    "name" = EXCLUDED."name",
    "partyId" = EXCLUDED."partyId",
    "state" = EXCLUDED."state",
    "dueDate" = EXCLUDED."dueDate",
    "category" = EXCLUDED."category",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

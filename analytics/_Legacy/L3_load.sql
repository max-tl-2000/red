/*  L3-DDL+Load.SQL - intended to load and create dimension tables, sourced from the n_ tables   */
/*	Assumes that L1_Load.SQL and L2_Load.SQL has been run right before, which will populate the t_ temp tables */


delete from "dstStarDB"."dstStarSchema"."d_UserTeamProperty"
        where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_UserTeamProperty" (
	"userId"	,
	"externalUniqueId",
	"fullName"	  ,
	"preferredName"   ,
	"email"	     ,
	"employmentType"	,
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
	u."id"	,
	u."externalUniqueId"	,
	u."fullName"	,
	u."preferredName"	,
	u."email"	,
	u."employmentType"	,
	tm."directEmailIdentifier"	,
	tm."directPhoneIdentifier"	,
	u."ringPhones"	,
	tm."outsideDedicatedEmails"	,
	t."id"	,
	t."module"	,
	t."description"	,
	tm."inactive"	,
	tm."mainRoles"	,
	tm."functionalRoles"	,
	tp."propertyId"

FROM "dstNormDB"."dstNormSchema"."Users" as u
    LEFT JOIN "dstNormDB"."dstNormSchema"."TeamMembers" as tm ON u."id" = tm."userId"
    LEFT JOIN "dstNormDB"."dstNormSchema"."Teams" as t ON tm."teamId" = t."id"
    LEFT JOIN "dstNormDB"."dstNormSchema"."TeamProperties" as tp ON t."id" = tp."teamId"
WHERE tm."teamId" is not null  and tp."propertyId" is not null;


INSERT INTO "dstStarDB"."dstStarSchema"."d_Party" (
  "partyId",
  "userId",
  "score",
  "type",
  "state",
  "assignedPropertyId",
  "startDate",
  "endDate",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "userId",
  "score",
  "qualificationQuestions"->>'groupProfile' as "type",
  "state",
  "assignedPropertyId",
  "created_at",
  null,
  "created_at",
  "updated_at"
FROM 	"dstNormDB"."dstNormSchema"."Party"
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
SELECT	"id",
	"module",
	"description",
	"created_at"		,
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."Teams"
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
	"ringPhones"			,
	"created_at"			,
	"updated_at"
)
SELECT	"id"	 ,
	"externalUniqueId"		,
	"fullName"		,
	"preferredName"		,
	"email"			,
	"employmentType"		,
	"loginAttempts"			,
	"ringPhones"			,
	"created_at"			,
	"updated_at"
FROM 	"dstNormDB"."dstNormSchema"."Users"
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
	p."id",
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
FROM 	"dstNormDB"."dstNormSchema"."Property" p
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."BusinessEntity" own ON (p."owner" = own."id")
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."BusinessEntity" opr ON (p."operator" = opr."id")
        LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."PropertyGroup" pg ON (p."propertyGroupId" = pg."id");

DELETE FROM "dstStarDB"."dstStarSchema"."d_Date"
        where true;

INSERT INTO "dstStarDB"."dstStarSchema"."d_Date" (
        "eventDt"
)
SELECT date(d) as "eventDt"
FROM generate_series((select  min(date_trunc('day',"created_at")) from "dstNormDB"."dstNormSchema"."ActivityLog"),
											(select Case When max(date_trunc('day',"updated_at")) > date_trunc('day', now()) Then max(date_trunc('day',"updated_at"))
					                         Else date_trunc('day', now()) End MostRecent from "dstNormDB"."dstNormSchema"."ActivityLog"),
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
FROM 	"dstNormDB"."dstNormSchema"."TeamSalesTargets"
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
FROM 	"dstNormDB"."dstNormSchema"."TeamMemberSalesTargets"
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
  "id",
  "name",
  "partyId",
  "state",
  "dueDate",
  "category",
  "created_at",
  "updated_at"
FROM 	"dstNormDB"."dstNormSchema"."Tasks"
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

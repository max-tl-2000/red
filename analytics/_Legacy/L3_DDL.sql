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
  "userId"	uuid,
  "score"	varchar(255),
  "type"	varchar(255),
  "assignedPropertyId" uuid,
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

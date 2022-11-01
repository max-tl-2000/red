TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ActivityLog";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ActivityLog" (
	"id",
	"type",
	"component",
  "subComponent",
	"details",
	"context",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"type",
		"component",
    "subComponent",
		"details",
		"context",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."ActivityLog"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ActivityLog") || ''''

) AS (
	"id"	uuid,
	"type"	varchar(255),
	"component"	varchar(255),
  "subComponent" varchar(255),
	"details"	json,
	"context"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ActivityLog" (
	"id",
	"type",
	"component",
  "subComponent",
	"details",
	"context",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"type",
	"component",
  "subComponent",
	"details",
	"context",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ActivityLog"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"type" = EXCLUDED."type",
		"component" = EXCLUDED."component",
    "subComponent" = EXCLUDED."subComponent",
		"details" = EXCLUDED."details",
		"context" = EXCLUDED."context",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Address";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Address" (
	"id",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"postalCode",
	"startDate",
	"endDate",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"addressLine1",
		"addressLine2",
		"city",
		"state",
		"postalCode",
		"startDate",
		"endDate",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Address"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Address") || ''''

) AS (
	"id"	uuid,
	"addressLine1"	varchar(256),
	"addressLine2"	varchar(256),
	"city"	varchar(128),
	"state"	varchar(2),
	"postalCode"	varchar(10),
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

-- delete from Address table if something else got loaded in t_Address
DELETE FROM "dstNormDB"."dstNormSchema"."Address"
WHERE (SELECT count(1) FROM "tmpNormDB"."tmpNormSchema"."t_Address") > 0;

INSERT INTO "dstNormDB"."dstNormSchema"."Address" (
	"id",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"postalCode",
	"startDate",
	"endDate",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"postalCode",
	"startDate",
	"endDate",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Address";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Amenity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Amenity" (
	"id",
	"name",
	"category",
	"subCategory",
	"description",
	"hidden",
	"propertyId",
	"displayName",
	"highValue",
	"relativePrice",
	"absolutePrice",
	"targetUnit",
	"infographicName",
	"inactive",
	"created_at",
	"updated_at",
	"order"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"category",
		"subCategory",
		"description",
		"hidden",
		"propertyId",
		"displayName",
		"highValue",
		"relativePrice",
		"absolutePrice",
		"targetUnit",
		"infographicName",
		"inactive",
		"created_at",
		"updated_at",
		"order"

	FROM "srcDB"."srcSchema"."Amenity"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Amenity") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"category"	varchar(80),
	"subCategory"	varchar(80),
	"description"	text,
	"hidden"	bool,
	"propertyId"	uuid,
	"displayName"	varchar(200),
	"highValue"	bool,
	"relativePrice"	numeric,
	"absolutePrice"	numeric,
	"targetUnit"	bool,
	"infographicName"	varchar(200),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"order" int4
);

INSERT INTO "dstNormDB"."dstNormSchema"."Amenity" (
	"id",
	"name",
	"category",
	"subCategory",
	"description",
	"hidden",
	"propertyId",
	"displayName",
	"highValue",
	"relativePrice",
	"absolutePrice",
	"targetUnit",
	"infographicName",
	"inactive",
	"created_at",
	"updated_at",
	"order"
)
SELECT
	"id",
	"name",
	"category",
	"subCategory",
	"description",
	"hidden",
	"propertyId",
	"displayName",
	"highValue",
	"relativePrice",
	"absolutePrice",
	"targetUnit",
	"infographicName",
	"inactive",
	"created_at",
	"updated_at",
	"order"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Amenity"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"category" = EXCLUDED."category",
		"subCategory" = EXCLUDED."subCategory",
		"description" = EXCLUDED."description",
		"hidden" = EXCLUDED."hidden",
		"propertyId" = EXCLUDED."propertyId",
		"displayName" = EXCLUDED."displayName",
		"highValue" = EXCLUDED."highValue",
		"relativePrice" = EXCLUDED."relativePrice",
		"absolutePrice" = EXCLUDED."absolutePrice",
		"targetUnit" = EXCLUDED."targetUnit",
		"infographicName" = EXCLUDED."infographicName",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"order" = EXCLUDED."order";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_AnalyticsLog" (
	"id",
	"type",
	"component",
  "subComponent",
	"activityDetails",
	"entity",
	"context",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"type",
		"component",
    "subComponent",
		"activityDetails",
		"entity",
		"context",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."AnalyticsLog"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."AnalyticsLog") || ''''

) AS (
	"id"	uuid,
	"type"	varchar(255),
	"component"	varchar(255),
  "subComponent" varchar(255),
	"activityDetails"	jsonb,
	"entity"	jsonb,
	"context"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."AnalyticsLog" (
	"id",
	"type",
	"component",
  "subComponent",
	"activityDetails",
	"entity",
	"context",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"type",
	"component",
  "subComponent",
	"activityDetails",
	"entity",
	"context",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_AnalyticsLog"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"type" = EXCLUDED."type",
		"component" = EXCLUDED."component",
    "subComponent" = EXCLUDED."subComponent",
		"activityDetails" = EXCLUDED."activityDetails",
		"entity" = EXCLUDED."entity",
		"context" = EXCLUDED."context",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Assets";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Assets" (
	"uuid",
	"path",
	"entity",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"uuid",
		"path",
		"entity",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Assets"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Assets") || ''''

) AS (
	"uuid"	uuid,
	"path"	varchar(255),
	"entity"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

-- delete from Assets table if something else got loaded in t_Assets
DELETE FROM "dstNormDB"."dstNormSchema"."Assets"
WHERE (SELECT count(1) FROM "tmpNormDB"."tmpNormSchema"."t_Assets") > 0;

INSERT INTO "dstNormDB"."dstNormSchema"."Assets" (
	"uuid",
	"path",
	"entity",
	"created_at",
	"updated_at"
)
SELECT
	"uuid",
	"path",
	"entity",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Assets";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Building";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Building" (
	"id",
	"name",
	"displayName",
	"type",
	"propertyId",
	"description",
	"addressId",
	"startDate",
	"endDate",
	"floorCount",
	"surfaceArea",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"displayName",
		"type",
		"propertyId",
		"description",
		"addressId",
		"startDate",
		"endDate",
		"floorCount",
		"surfaceArea",
		"externalId",
		"inactive",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Building"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Building") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"displayName"	varchar(200),
	"type"	varchar(80),
	"propertyId"	uuid,
	"description"	text,
	"addressId"	uuid,
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"floorCount"	int4,
	"surfaceArea"	numeric,
	"externalId"	varchar(200),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Building" (
	"id",
	"name",
	"displayName",
	"type",
	"propertyId",
	"description",
	"addressId",
	"startDate",
	"endDate",
	"floorCount",
	"surfaceArea",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"displayName",
	"type",
	"propertyId",
	"description",
	"addressId",
	"startDate",
	"endDate",
	"floorCount",
	"surfaceArea",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Building"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"displayName" = EXCLUDED."displayName",
		"type" = EXCLUDED."type",
		"propertyId" = EXCLUDED."propertyId",
		"description" = EXCLUDED."description",
		"addressId" = EXCLUDED."addressId",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"floorCount" = EXCLUDED."floorCount",
		"surfaceArea" = EXCLUDED."surfaceArea",
		"externalId" = EXCLUDED."externalId",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Building_Amenity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Building_Amenity" (
	"id",
	"buildingId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"buildingId",
		"amenityId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Building_Amenity"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Building_Amenity") || ''''

) AS (
	"id"	uuid,
	"buildingId"	uuid,
	"amenityId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

-- delete from Building_Amenity table if something else got loaded in t_Building_Amenity
DELETE FROM "dstNormDB"."dstNormSchema"."Building_Amenity"
WHERE (SELECT count(1) FROM "tmpNormDB"."tmpNormSchema"."t_Building_Amenity") > 0;

INSERT INTO "dstNormDB"."dstNormSchema"."Building_Amenity" (
	"id",
	"buildingId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"buildingId",
	"amenityId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Building_Amenity";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_BusinessEntity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_BusinessEntity" (
	"id",
	"name",
	"type",
	"expertise",
	"description",
	"addressId",
	"website",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"type",
		"expertise",
		"description",
		"addressId",
		"website",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."BusinessEntity"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."BusinessEntity") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"type"	varchar(80),
	"expertise"	varchar(200),
	"description"	text,
	"addressId"	uuid,
	"website"	varchar(200),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."BusinessEntity" (
	"id",
	"name",
	"type",
	"expertise",
	"description",
	"addressId",
	"website",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"type",
	"expertise",
	"description",
	"addressId",
	"website",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_BusinessEntity"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"type" = EXCLUDED."type",
		"expertise" = EXCLUDED."expertise",
		"description" = EXCLUDED."description",
		"addressId" = EXCLUDED."addressId",
		"website" = EXCLUDED."website",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_VoiceMessages";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_VoiceMessages" (
	"id",
  "name",
  "afterHours",
  "voicemail",
  "unavailable",
  "callBackRequestAck",
  "callQueueWelcome",
  "callQueueUnavailable",
  "callQueueClosing",
  "callRecordingNotice",
  "holdingMusic",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
    "name",
    "afterHours",
    "voicemail",
    "unavailable",
    "callBackRequestAck",
    "callQueueWelcome",
    "callQueueUnavailable",
    "callQueueClosing",
    "callRecordingNotice",
    "holdingMusic",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."VoiceMessages"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."VoiceMessages") || ''''

) AS (
	"id"	uuid,
  "name" text,
  "afterHours" text,
  "voicemail" text,
  "unavailable" text,
  "callBackRequestAck" text,
  "callQueueWelcome" text,
  "callQueueUnavailable" text,
  "callQueueClosing" text,
  "callRecordingNotice" text,
  "holdingMusic" text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."VoiceMessages" (
	"id",
  "name",
  "afterHours",
  "voicemail",
  "unavailable",
  "callBackRequestAck",
  "callQueueWelcome",
  "callQueueUnavailable",
  "callQueueClosing",
  "callRecordingNotice",
  "holdingMusic",
	"created_at",
	"updated_at"
)
SELECT
	"id",
  "name",
  "afterHours",
  "voicemail",
  "unavailable",
  "callBackRequestAck",
  "callQueueWelcome",
  "callQueueUnavailable",
  "callQueueClosing",
  "callRecordingNotice",
  "holdingMusic",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_VoiceMessages"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"afterHours" = EXCLUDED."afterHours",
		"voicemail" = EXCLUDED."voicemail",
		"unavailable" = EXCLUDED."unavailable",
		"callBackRequestAck" = EXCLUDED."callBackRequestAck",
		"callQueueWelcome" = EXCLUDED."callQueueWelcome",
		"callQueueUnavailable" = EXCLUDED."callQueueUnavailable",
		"callQueueClosing" = EXCLUDED."callQueueClosing",
		"callRecordingNotice" = EXCLUDED."callRecordingNotice",
		"holdingMusic" = EXCLUDED."holdingMusic",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_VoiceMenuItems";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_VoiceMenuItems" (
	"id",
  "name",
  "key",
  "action",
  "number",
  "displayName",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
    "name",
    "key",
    "action",
    "number",
	"displayName",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."VoiceMenuItems"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."VoiceMenuItems") || ''''

) AS (
	"id"	uuid,
  "name" text,
  "key" integer,
  "action" text,
  "number" text,
  "displayName" text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."VoiceMenuItems" (
	"id",
  "name",
  "key",
  "action",
  "number",
  "displayName",
	"created_at",
	"updated_at"
)
SELECT
	"id",
  "name",
  "key",
  "action",
  "number",
  "displayName",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_VoiceMenuItems"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"key" = EXCLUDED."key",
		"action" = EXCLUDED."action",
		"number" = EXCLUDED."number",
		"displayName" = EXCLUDED."displayName",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_CallQueueStatistics";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_CallQueueStatistics" (
	"id",
	"communicationId",
	"entryTime",
	"exitTime",
	"hangUp",
	"userId",
	"callBackTime",
	"transferredToVoiceMail",
	"callBackCommunicationId",
	"callerRequestedAction",
  "metadata",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"communicationId",
		"entryTime",
		"exitTime",
		"hangUp",
		"userId",
		"callBackTime",
		"transferredToVoiceMail",
		"callBackCommunicationId",
		"callerRequestedAction",
    "metadata",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."CallQueueStatistics"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."CallQueueStatistics") || ''''

) AS (
	"id"	uuid,
	"communicationId"	uuid,
	"entryTime"	timestamptz,
	"exitTime"	timestamptz,
	"hangUp"	bool,
	"userId"	uuid,
	"callBackTime"	timestamptz,
	"transferredToVoiceMail"	bool,
	"callBackCommunicationId"	uuid,
	"callerRequestedAction"	text,
  "metadata" jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."CallQueueStatistics" (
	"id",
	"communicationId",
	"entryTime",
	"exitTime",
	"hangUp",
	"userId",
	"callBackTime",
	"transferredToVoiceMail",
	"callBackCommunicationId",
	"callerRequestedAction",
  "metadata",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"communicationId",
	"entryTime",
	"exitTime",
	"hangUp",
	"userId",
	"callBackTime",
	"transferredToVoiceMail",
	"callBackCommunicationId",
	"callerRequestedAction",
  "metadata",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_CallQueueStatistics"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"communicationId" = EXCLUDED."communicationId",
		"entryTime" = EXCLUDED."entryTime",
		"exitTime" = EXCLUDED."exitTime",
		"hangUp" = EXCLUDED."hangUp",
		"userId" = EXCLUDED."userId",
		"callBackTime" = EXCLUDED."callBackTime",
		"transferredToVoiceMail" = EXCLUDED."transferredToVoiceMail",
		"callBackCommunicationId" = EXCLUDED."callBackCommunicationId",
		"callerRequestedAction" = EXCLUDED."callerRequestedAction",
		"metadata" = EXCLUDED."metadata",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Communication";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Communication" (
	"id",
	"parties",
	"persons",
	"direction",
	"type",
	"userId",
	"messageId",
	"message",
	"status",
	"threadId",
	"teams",
	"category",
	"unread",
	"teamPropertyProgramId",
	"transferredFromCommId",
	"created_at",
	"updated_at",
	"readBy",
	"readAt"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"parties",
		"persons",
		"direction",
		"type",
		"userId",
		"messageId",
		"message",
		"status",
		"threadId",
		"teams",
		"category",
		"unread",
		"teamPropertyProgramId",
		"transferredFromCommId",
		"created_at",
		"updated_at",
		"readBy",
		"readAt"

	FROM "srcDB"."srcSchema"."Communication"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Communication") || ''''

) AS (
	"id"	uuid,
	"parties"	_uuid,
	"persons"	_uuid,
	"direction"	varchar(255),
	"type"	varchar(255),
	"userId"	uuid,
	"messageId"	varchar(255),
	"message"	json,
	"status"	json,
	"threadId"	text,
	"teams"	_uuid,
	"category"	varchar(255),
	"unread" bool,
	"teamPropertyProgramId" uuid,
	"transferredFromCommId" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"readBy" uuid,
	"readAt" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Communication" (
	"id",
	"parties",
	"persons",
	"direction",
	"type",
	"userId",
	"messageId",
	"message",
	"status",
	"threadId",
	"teams",
	"category",
	"unread",
	"teamPropertyProgramId",
	"transferredFromCommId",
	"created_at",
	"updated_at",
	"readBy",
	"readAt"
)
SELECT
	"id",
	"parties",
	"persons",
	"direction",
	"type",
	"userId",
	"messageId",
	"message",
	"status",
	"threadId",
	"teams",
	"category",
	"unread",
	"teamPropertyProgramId",
	"transferredFromCommId",
	"created_at",
	"updated_at",
	"readBy",
	"readAt"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Communication"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"parties" = EXCLUDED."parties",
		"persons" = EXCLUDED."persons",
		"direction" = EXCLUDED."direction",
		"type" = EXCLUDED."type",
		"userId" = EXCLUDED."userId",
		"messageId" = EXCLUDED."messageId",
		"message" = EXCLUDED."message",
		"status" = EXCLUDED."status",
		"threadId" = EXCLUDED."threadId",
		"teams" = EXCLUDED."teams",
		"category" = EXCLUDED."category",
		"unread" = EXCLUDED."unread",
		"teamPropertyProgramId" = EXCLUDED."teamPropertyProgramId",
		"transferredFromCommId" = EXCLUDED."transferredFromCommId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"readBy" = EXCLUDED."readBy",
		"readAt" = EXCLUDED."readAt";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_CommunicationSpam";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_CommunicationSpam" (
	"id",
	"from",
	"type",
	"message",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"from",
		"type",
		"message",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."CommunicationSpam"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."CommunicationSpam") || ''''

) AS (
	"id"	uuid,
	"from"	varchar(255),
	"type"	text,
	"message"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."CommunicationSpam" (
	"id",
	"from",
	"type",
	"message",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"from",
	"type",
	"message",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_CommunicationSpam"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"from" = EXCLUDED."from",
		"type" = EXCLUDED."type",
		"message" = EXCLUDED."message",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Concession";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Concession" (
	"id",
	"name",
	"propertyId",
	"description",
	"relativeAdjustment",
	"absoluteAdjustment",
	"relativeDefaultAdjustment",
	"absoluteDefaultAdjustment",
	"variableAdjustment",
	"optional",
	"recurring",
	"recurringCount",
	"nonRecurringAppliedAt",
	"matchingCriteria",
	"leaseState",
	"startDate",
	"endDate",
	"account",
	"subAccount",
	"taxable",
	"hideInSelfService",
	"displayName",
	"excludeFromRentFlag",
	"externalChargeCode",
	"bakedIntoAppliedFeeFlag",
	"adjustmentFloorCeiling",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyId",
		"description",
		"relativeAdjustment",
		"absoluteAdjustment",
		"relativeDefaultAdjustment",
	    "absoluteDefaultAdjustment",
		"variableAdjustment",
		"optional",
		"recurring",
		"recurringCount",
		"nonRecurringAppliedAt",
		"matchingCriteria",
		"leaseState",
		"startDate",
		"endDate",
		"account",
		"subAccount",
		"taxable",
		"hideInSelfService",
		"displayName",
		"excludeFromRentFlag",
		"externalChargeCode",
		"bakedIntoAppliedFeeFlag",
		"adjustmentFloorCeiling",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Concession"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Concession") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyId"	uuid,
	"description"	text,
	"relativeAdjustment"	numeric,
	"absoluteAdjustment"	numeric,
	"relativeDefaultAdjustment"	numeric,
	"absoluteDefaultAdjustment"	numeric,
	"variableAdjustment"	bool,
	"optional"	bool,
	"recurring"	bool,
	"recurringCount"	int4,
	"nonRecurringAppliedAt"	varchar(200),
	"matchingCriteria"	text,
	"leaseState"	varchar(80),
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"account"	int4,
	"subAccount"	int4,
	"taxable"	bool,
	"hideInSelfService"	bool,
	"displayName"	varchar(200),
	"excludeFromRentFlag"	bool,
	"externalChargeCode"	varchar(255),
	"bakedIntoAppliedFeeFlag" bool,
	"adjustmentFloorCeiling" text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Concession" (
	"id",
	"name",
	"propertyId",
	"description",
	"relativeAdjustment",
	"absoluteAdjustment",
	"relativeDefaultAdjustment",
	"absoluteDefaultAdjustment",
	"variableAdjustment",
	"optional",
	"recurring",
	"recurringCount",
	"nonRecurringAppliedAt",
	"matchingCriteria",
	"leaseState",
	"startDate",
	"endDate",
	"account",
	"subAccount",
	"taxable",
	"hideInSelfService",
	"displayName",
	"excludeFromRentFlag",
	"externalChargeCode",
	"bakedIntoAppliedFeeFlag",
	"adjustmentFloorCeiling",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"propertyId",
	"description",
	"relativeAdjustment",
	"absoluteAdjustment",
	"relativeDefaultAdjustment",
	"absoluteDefaultAdjustment",
	"variableAdjustment",
	"optional",
	"recurring",
	"recurringCount",
	"nonRecurringAppliedAt",
	"matchingCriteria",
	"leaseState",
	"startDate",
	"endDate",
	"account",
	"subAccount",
	"taxable",
	"hideInSelfService",
	"displayName",
	"excludeFromRentFlag",
	"externalChargeCode",
	"bakedIntoAppliedFeeFlag",
	"adjustmentFloorCeiling",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Concession"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"description" = EXCLUDED."description",
		"relativeAdjustment" = EXCLUDED."relativeAdjustment",
		"absoluteAdjustment" = EXCLUDED."absoluteAdjustment",
		"relativeDefaultAdjustment" = EXCLUDED."relativeDefaultAdjustment",
	    "absoluteDefaultAdjustment" = EXCLUDED."absoluteDefaultAdjustment",
		"variableAdjustment" = EXCLUDED."variableAdjustment",
		"optional" = EXCLUDED."optional",
		"recurring" = EXCLUDED."recurring",
		"recurringCount" = EXCLUDED."recurringCount",
		"nonRecurringAppliedAt" = EXCLUDED."nonRecurringAppliedAt",
		"matchingCriteria" = EXCLUDED."matchingCriteria",
		"leaseState" = EXCLUDED."leaseState",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"account" = EXCLUDED."account",
		"subAccount" = EXCLUDED."subAccount",
		"taxable" = EXCLUDED."taxable",
		"hideInSelfService" = EXCLUDED."hideInSelfService",
		"displayName" = EXCLUDED."displayName",
		"excludeFromRentFlag" = EXCLUDED."excludeFromRentFlag",
		"externalChargeCode" = EXCLUDED."externalChargeCode",
		"bakedIntoAppliedFeeFlag" = EXCLUDED."bakedIntoAppliedFeeFlag",
		"adjustmentFloorCeiling" = EXCLUDED."adjustmentFloorCeiling",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Concession_Fee";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Concession_Fee" (
	"id",
	"concessionId",
	"feeId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"concessionId",
		"feeId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Concession_Fee"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Concession_Fee") || ''''

) AS (
	"id"	uuid,
	"concessionId"	uuid,
	"feeId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Concession_Fee" (
	"id",
	"concessionId",
	"feeId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"concessionId",
	"feeId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Concession_Fee"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"concessionId" = EXCLUDED."concessionId",
		"feeId" = EXCLUDED."feeId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ContactInfo";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ContactInfo" (
	"id",
	"type",
	"value",
	"imported",
	"metadata",
	"personId",
	"isSpam",
	"isPrimary",
	"markedAsSpamBy",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"type",
		"value",
		"imported",
		"metadata",
		"personId",
		"isSpam",
		"isPrimary",
		"markedAsSpamBy",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."ContactInfo"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ContactInfo") || ''''

) AS (
	"id"	uuid,
	"type"	text,
	"value"	varchar(100),
	"imported"	bool,
	"metadata"	jsonb,
	"personId"	uuid,
	"isSpam"	bool,
	"isPrimary" bool,
	"markedAsSpamBy"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ContactInfo" (
	"id",
	"type",
	"value",
	"imported",
	"metadata",
	"personId",
	"isSpam",
	"isPrimary",
	"markedAsSpamBy",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"type",
	"value",
	"imported",
	"metadata",
	"personId",
	"isSpam",
	"isPrimary",
	"markedAsSpamBy",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ContactInfo"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"type" = EXCLUDED."type",
		"value" = EXCLUDED."value",
		"imported" = EXCLUDED."imported",
		"metadata" = EXCLUDED."metadata",
		"personId" = EXCLUDED."personId",
		"isSpam" = EXCLUDED."isSpam",
		"isPrimary" = EXCLUDED."isPrimary",
		"markedAsSpamBy" = EXCLUDED."markedAsSpamBy",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Disclosure";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Disclosure" (
	"id",
	"name",
	"displayName",
	"displayOrder",
	"displayHelp",
	"descriptionHelper",
	"requireApplicationReview",
	"showInApplication",
	"showInParty",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"displayName",
		"displayOrder",
		"displayHelp",
		"descriptionHelper",
		"requireApplicationReview",
		"showInApplication",
		"showInParty",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Disclosure"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Disclosure") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(255),
	"displayName"	varchar(255),
	"displayOrder"	int4,
	"displayHelp"	varchar(255),
	"descriptionHelper"	varchar(255),
	"requireApplicationReview"	bool,
	"showInApplication"	bool,
	"showInParty"	bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Disclosure" (
	"id",
	"name",
	"displayName",
	"displayOrder",
	"displayHelp",
	"descriptionHelper",
	"requireApplicationReview",
	"showInApplication",
	"showInParty",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"displayName",
	"displayOrder",
	"displayHelp",
	"descriptionHelper",
	"requireApplicationReview",
	"showInApplication",
	"showInParty",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Disclosure"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"displayName" = EXCLUDED."displayName",
		"displayOrder" = EXCLUDED."displayOrder",
		"displayHelp" = EXCLUDED."displayHelp",
		"descriptionHelper" = EXCLUDED."descriptionHelper",
		"requireApplicationReview" = EXCLUDED."requireApplicationReview",
		"showInApplication" = EXCLUDED."showInApplication",
		"showInParty" = EXCLUDED."showInParty",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Documents";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Documents" (
	"uuid",
	"accessType",
	"metadata",
	"context",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"uuid",
		"accessType",
		"metadata",
		"context",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Documents"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Documents") || ''''

) AS (
	"uuid"	uuid,
	"accessType"	varchar(255),
	"metadata"	jsonb,
	"context"	text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Documents" (
	"uuid",
	"accessType",
	"metadata",
	"context",
	"created_at",
	"updated_at"
)
SELECT
	"uuid",
	"accessType",
	"metadata",
	"context",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Documents"
ON CONFLICT ("uuid")
	DO UPDATE
	SET
		"accessType" = EXCLUDED."accessType",
		"metadata" = EXCLUDED."metadata",
		"context" = EXCLUDED."context",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ExistingResidents";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ExistingResidents" (
	"id",
	"personId",
	"metadata",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"personId",
		"metadata",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."ExistingResidents"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ExistingResidents") || ''''

) AS (
	"id"	uuid,
	"personId"	uuid,
	"metadata"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ExistingResidents" (
	"id",
	"personId",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"personId",
	"metadata",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ExistingResidents"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"personId" = EXCLUDED."personId",
		"metadata" = EXCLUDED."metadata",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ExportLog";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ExportLog" (
	"id",
	"type",
	"partyId",
	"data",
	"leaseId",
	"metadata",
	"processed",
	"externalId",
	"entries",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"type",
		"partyId",
		"data",
		"leaseId",
		"metadata",
		"processed",
		"externalId",
		"entries",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."ExportLog"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ExportLog") || ''''

) AS (
	"id"	uuid,
	"type"	text,
	"partyId"	uuid,
	"data"	jsonb,
	"leaseId"	uuid,
	"metadata"	jsonb,
	"processed" timestamptz,
	"externalId" varchar(50),
	"entries" text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ExportLog" (
	"id",
	"type",
	"partyId",
	"data",
	"leaseId",
	"metadata",
	"processed",
	"externalId",
	"entries",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"type",
	"partyId",
	"data",
	"leaseId",
	"metadata",
	"processed",
	"externalId",
	"entries",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ExportLog"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"type" = EXCLUDED."type",
		"partyId" = EXCLUDED."partyId",
		"data" = EXCLUDED."data",
		"leaseId" = EXCLUDED."leaseId",
		"metadata" = EXCLUDED."metadata",
		"processed" = EXCLUDED."processed",
		"externalId" = EXCLUDED."externalId",
		"entries" = EXCLUDED."entries",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ExternalPhones";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ExternalPhones" (
	"id",
	"number",
	"displayName",
	"propertyId",
	"teamIds",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"number",
		"displayName",
		"propertyId",
		"teamIds",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."ExternalPhones"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ExternalPhones") || ''''

) AS (
	"id"	uuid,
	"number"	varchar(255),
	"displayName"	varchar(255),
	"propertyId"	uuid,
	"teamIds"	_uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ExternalPhones" (
	"id",
	"number",
	"displayName",
	"propertyId",
	"teamIds",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"number",
	"displayName",
	"propertyId",
	"teamIds",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_ExternalPhones"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"number" = EXCLUDED."number",
		"displayName" = EXCLUDED."displayName",
		"propertyId" = EXCLUDED."propertyId",
		"teamIds" = EXCLUDED."teamIds",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Fee";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Fee" (
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"feeType",
	"quoteSectionName",
	"maxQuantityInQuote",
	"servicePeriod",
	"variableAdjustment",
	"estimated",
	"relativePrice",
	"absolutePrice",
	"relativeDefaultPrice",
	"absoluteDefaultPrice",
	"depositInterest",
	"externalChargeCode",
	"externalChargeAccount",
	"externalChargeAccrualAccount",
	"externalChargeNotes",
	"externalChargeRef",
	"externalReceiptAccount",
	"externalReceiptAccrualAccount",
	"externalReceiptOffset",
	"externalReceiptNotes",
	"externalReceiptRef",
	"externalWaiverAccount",
	"externalWaiverAccrualAccount",
	"externalWaiverOffset",
	"externalWaiverNotes",
	"externalWaiverRef",
	"priceFloorCeiling",
	"marketingQuestionId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyId",
		"displayName",
		"description",
		"feeType",
		"quoteSectionName",
		"maxQuantityInQuote",
		"servicePeriod",
		"variableAdjustment",
		"estimated",
		"relativePrice",
		"absolutePrice",
		"relativeDefaultPrice",
		"absoluteDefaultPrice",
		"depositInterest",
		"externalChargeCode",
		"externalChargeAccount",
		"externalChargeAccrualAccount",
		"externalChargeNotes",
		"externalChargeRef",
		"externalReceiptAccount",
		"externalReceiptAccrualAccount",
		"externalReceiptOffset",
		"externalReceiptNotes",
		"externalReceiptRef",
		"externalWaiverAccount",
		"externalWaiverAccrualAccount",
		"externalWaiverOffset",
		"externalWaiverNotes",
		"externalWaiverRef",
		"priceFloorCeiling",
		"marketingQuestionId",
		"quotePaymentScheduleFlag",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Fee"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Fee") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyId"	uuid,
	"displayName"	varchar(200),
	"description"	text,
	"feeType"	varchar(80),
	"quoteSectionName"	varchar(80),
	"maxQuantityInQuote"	int4,
	"servicePeriod"	varchar(80),
	"variableAdjustment"	bool,
	"estimated"	bool,
	"relativePrice"	numeric,
	"absolutePrice"	numeric,
	"relativeDefaultPrice"	numeric,
	"absoluteDefaultPrice"	numeric,
	"depositInterest"	bool,
	"externalChargeCode" varchar(255),
	"externalChargeAccount" varchar(255),
	"externalChargeAccrualAccount" varchar(255),
	"externalChargeNotes" varchar(2048),
	"externalChargeRef" varchar(255),
	"externalReceiptAccount" varchar(255),
	"externalReceiptAccrualAccount" varchar(255),
	"externalReceiptOffset" varchar(255),
	"externalReceiptNotes" varchar(2048),
	"externalReceiptRef" varchar(255),
	"externalWaiverAccount" varchar(255),
	"externalWaiverAccrualAccount" varchar(255),
	"externalWaiverOffset" varchar(255),
	"externalWaiverNotes" varchar(2048),
	"externalWaiverRef" varchar(255),
	"priceFloorCeiling" text,
	"marketingQuestionId" uuid,
	"quotePaymentScheduleFlag" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Fee" (
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"feeType",
	"quoteSectionName",
	"maxQuantityInQuote",
	"servicePeriod",
	"variableAdjustment",
	"estimated",
	"relativePrice",
	"absolutePrice",
	"relativeDefaultPrice",
	"absoluteDefaultPrice",
	"depositInterest",
	"externalChargeCode",
	"externalChargeAccount",
	"externalChargeAccrualAccount",
	"externalChargeNotes",
	"externalChargeRef",
	"externalReceiptAccount",
	"externalReceiptAccrualAccount",
	"externalReceiptOffset",
	"externalReceiptNotes",
	"externalReceiptRef",
	"externalWaiverAccount",
	"externalWaiverAccrualAccount",
	"externalWaiverOffset",
	"externalWaiverNotes",
	"externalWaiverRef",
	"priceFloorCeiling",
	"marketingQuestionId",
	"quotePaymentScheduleFlag",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"feeType",
	"quoteSectionName",
	"maxQuantityInQuote",
	"servicePeriod",
	"variableAdjustment",
	"estimated",
	"relativePrice",
	"absolutePrice",
	"relativeDefaultPrice",
	"absoluteDefaultPrice",
	"depositInterest",
	"externalChargeCode",
	"externalChargeAccount",
	"externalChargeAccrualAccount",
	"externalChargeNotes",
	"externalChargeRef",
	"externalReceiptAccount",
	"externalReceiptAccrualAccount",
	"externalReceiptOffset",
	"externalReceiptNotes",
	"externalReceiptRef",
	"externalWaiverAccount",
	"externalWaiverAccrualAccount",
	"externalWaiverOffset",
	"externalWaiverNotes",
	"externalWaiverRef",
	"priceFloorCeiling",
	"marketingQuestionId",
	"quotePaymentScheduleFlag",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Fee"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"displayName" = EXCLUDED."displayName",
		"description" = EXCLUDED."description",
		"feeType" = EXCLUDED."feeType",
		"quoteSectionName" = EXCLUDED."quoteSectionName",
		"maxQuantityInQuote" = EXCLUDED."maxQuantityInQuote",
		"servicePeriod" = EXCLUDED."servicePeriod",
		"variableAdjustment" = EXCLUDED."variableAdjustment",
		"estimated" = EXCLUDED."estimated",
		"relativePrice" = EXCLUDED."relativePrice",
		"absolutePrice" = EXCLUDED."absolutePrice",
		"relativeDefaultPrice" = EXCLUDED."relativeDefaultPrice",
		"absoluteDefaultPrice" = EXCLUDED."absoluteDefaultPrice",
		"depositInterest" = EXCLUDED."depositInterest",
		"externalChargeCode" = EXCLUDED."externalChargeCode",
		"externalChargeAccount" = EXCLUDED."externalChargeAccount",
		"externalChargeAccrualAccount" = EXCLUDED."externalChargeAccrualAccount",
		"externalChargeNotes" = EXCLUDED."externalChargeNotes",
		"externalChargeRef" = EXCLUDED."externalChargeRef",
		"externalReceiptAccount" = EXCLUDED."externalReceiptAccount",
		"externalReceiptAccrualAccount" = EXCLUDED."externalReceiptAccrualAccount",
		"externalReceiptOffset" = EXCLUDED."externalReceiptOffset",
		"externalReceiptNotes" = EXCLUDED."externalReceiptNotes",
		"externalReceiptRef" = EXCLUDED."externalReceiptRef",
		"externalWaiverAccount" = EXCLUDED."externalWaiverAccount",
		"externalWaiverAccrualAccount" = EXCLUDED."externalWaiverAccrualAccount",
		"externalWaiverOffset" = EXCLUDED."externalWaiverOffset",
		"externalWaiverNotes" = EXCLUDED."externalWaiverNotes",
		"externalWaiverRef" = EXCLUDED."externalWaiverRef",
		"priceFloorCeiling" = EXCLUDED."priceFloorCeiling",
		"marketingQuestionId" = EXCLUDED."marketingQuestionId",
		"quotePaymentScheduleFlag" = EXCLUDED."quotePaymentScheduleFlag",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Inventory";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Inventory" (
	"id",
	"name",
	"propertyId",
	"multipleItemTotal",
	"description",
	"type",
	"floor",
	"layoutId",
	"inventoryGroupId",
	"buildingId",
	"parentInventory",
	"state",
	"stateStartDate",
	"availabilityDate",
	"externalId",
  "rmsExternalId",
	"address",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyId",
		"multipleItemTotal",
		"description",
		"type",
		"floor",
		"layoutId",
		"inventoryGroupId",
		"buildingId",
		"parentInventory",
		"state",
		"stateStartDate",
		"availabilityDate",
		"externalId",
		"rmsExternalId",
		"address",
		"inactive",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Inventory"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Inventory") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyId"	uuid,
	"multipleItemTotal"	int4,
	"description"	text,
	"type"	varchar(80),
	"floor"	int4,
	"layoutId"	uuid,
	"inventoryGroupId"	uuid,
	"buildingId"	uuid,
	"parentInventory"	uuid,
	"state"	varchar(255),
	"stateStartDate"	timestamptz,
	"availabilityDate" timestamptz,
	"externalId"	varchar(255),
	"rmsExternalId"    varchar(255),
	"address"	varchar(255),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Inventory" (
	"id",
	"name",
	"propertyId",
	"multipleItemTotal",
	"description",
	"type",
	"floor",
	"layoutId",
	"inventoryGroupId",
	"buildingId",
	"parentInventory",
	"state",
	"stateStartDate",
	"availabilityDate",
	"externalId",
	"rmsExternalId",
	"address",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"propertyId",
	"multipleItemTotal",
	"description",
	"type",
	"floor",
	"layoutId",
	"inventoryGroupId",
	"buildingId",
	"parentInventory",
	"state",
	"stateStartDate",
	"availabilityDate",
	"externalId",
	"rmsExternalId",
	"address",
	"inactive",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Inventory"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"multipleItemTotal" = EXCLUDED."multipleItemTotal",
		"description" = EXCLUDED."description",
		"type" = EXCLUDED."type",
		"floor" = EXCLUDED."floor",
		"layoutId" = EXCLUDED."layoutId",
		"inventoryGroupId" = EXCLUDED."inventoryGroupId",
		"buildingId" = EXCLUDED."buildingId",
		"parentInventory" = EXCLUDED."parentInventory",
		"state" = EXCLUDED."state",
		"stateStartDate" = EXCLUDED."stateStartDate",
		"availabilityDate" = EXCLUDED."availabilityDate",
		"externalId" = EXCLUDED."externalId",
		"rmsExternalId" = EXCLUDED."rmsExternalId",
		"address" = EXCLUDED."address",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Inventory_Amenity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Inventory_Amenity" (
	"id",
	"inventoryId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"inventoryId",
		"amenityId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Inventory_Amenity"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Inventory_Amenity") || ''''

) AS (
	"id"	uuid,
	"inventoryId"	uuid,
	"amenityId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

-- delete from Inventory_Amenity table if something else got loaded in t_Inventory_Amenity
DELETE FROM "dstNormDB"."dstNormSchema"."Inventory_Amenity"
WHERE (SELECT count(1) FROM "tmpNormDB"."tmpNormSchema"."t_Inventory_Amenity") > 0;

INSERT INTO "dstNormDB"."dstNormSchema"."Inventory_Amenity" (
	"id",
	"inventoryId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"inventoryId",
	"amenityId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Inventory_Amenity";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_InventoryGroup";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_InventoryGroup" (
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"leaseNameId",
	"basePriceMonthly",
	"basePriceWeekly",
	"basePriceDaily",
	"basePriceHourly",
	"primaryRentable",
	"economicStatus",
	"rentControl",
	"affordable",
	"feeId",
	"inventoryType",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyId",
		"displayName",
		"description",
		"leaseNameId",
		"basePriceMonthly",
		"basePriceWeekly",
		"basePriceDaily",
		"basePriceHourly",
		"primaryRentable",
		"economicStatus",
		"rentControl",
		"affordable",
		"feeId",
		"inventoryType",
		"externalId",
		"inactive",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."InventoryGroup"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."InventoryGroup") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyId"	uuid,
	"displayName"	varchar(200),
	"description"	text,
	"leaseNameId"	uuid,
	"basePriceMonthly"	numeric,
	"basePriceWeekly"	numeric,
	"basePriceDaily"	numeric,
	"basePriceHourly"	numeric,
	"primaryRentable"	bool,
	"economicStatus"	varchar(80),
	"rentControl"	bool,
	"affordable"	bool,
	"feeId"	uuid,
	"inventoryType"	varchar(255),
	"externalId"	varchar(200),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."InventoryGroup" (
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"leaseNameId",
	"basePriceMonthly",
	"basePriceWeekly",
	"basePriceDaily",
	"basePriceHourly",
	"primaryRentable",
	"economicStatus",
	"rentControl",
	"affordable",
	"feeId",
	"inventoryType",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"propertyId",
	"displayName",
	"description",
	"leaseNameId",
	"basePriceMonthly",
	"basePriceWeekly",
	"basePriceDaily",
	"basePriceHourly",
	"primaryRentable",
	"economicStatus",
	"rentControl",
	"affordable",
	"feeId",
	"inventoryType",
	"externalId",
	"inactive",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_InventoryGroup"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"displayName" = EXCLUDED."displayName",
		"description" = EXCLUDED."description",
		"leaseNameId" = EXCLUDED."leaseNameId",
		"basePriceMonthly" = EXCLUDED."basePriceMonthly",
		"basePriceWeekly" = EXCLUDED."basePriceWeekly",
		"basePriceDaily" = EXCLUDED."basePriceDaily",
		"basePriceHourly" = EXCLUDED."basePriceHourly",
		"primaryRentable" = EXCLUDED."primaryRentable",
		"economicStatus" = EXCLUDED."economicStatus",
		"rentControl" = EXCLUDED."rentControl",
		"affordable" = EXCLUDED."affordable",
		"feeId" = EXCLUDED."feeId",
		"inventoryType" = EXCLUDED."inventoryType",
		"inactive" = EXCLUDED."inactive",
		"externalId" = EXCLUDED."externalId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_InventoryGroup_Amenity";
TRUNCATE TABLE "dstNormDB"."dstNormSchema"."InventoryGroup_Amenity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_InventoryGroup_Amenity" (
	"id",
	"inventoryGroupId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"inventoryGroupId",
		"amenityId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."InventoryGroup_Amenity"'

) AS (
	"id"	uuid,
	"inventoryGroupId"	uuid,
	"amenityId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."InventoryGroup_Amenity" (
	"id",
	"inventoryGroupId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"inventoryGroupId",
	"amenityId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_InventoryGroup_Amenity";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_InventoryOnHold";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_InventoryOnHold" (
	"inventoryId",
	"partyId",
	"startDate",
	"endDate",
	"reason",
	"quotable",
	"heldBy",
	"releasedBy",
	"id",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"inventoryId",
		"partyId",
		"startDate",
		"endDate",
		"reason",
		"quotable",
		"heldBy",
		"releasedBy",
		"id",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."InventoryOnHold"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."InventoryOnHold") || ''''

) AS (
	"inventoryId"	uuid,
	"partyId"	uuid,
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"reason"	text,
	"quotable"	bool,
	"heldBy"	uuid,
	"releasedBy"	uuid,
	"id"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."InventoryOnHold" (
	"inventoryId",
	"partyId",
	"startDate",
	"endDate",
	"reason",
	"quotable",
	"heldBy",
	"releasedBy",
	"id",
	"created_at",
	"updated_at"
)
SELECT
	"inventoryId",
	"partyId",
	"startDate",
	"endDate",
	"reason",
	"quotable",
	"heldBy",
	"releasedBy",
	"id",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_InventoryOnHold"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"inventoryId" = EXCLUDED."inventoryId",
		"partyId" = EXCLUDED."partyId",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"reason" = EXCLUDED."reason",
		"quotable" = EXCLUDED."quotable",
		"heldBy" = EXCLUDED."heldBy",
		"releasedBy" = EXCLUDED."releasedBy",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingLayoutGroup";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingLayoutGroup" (
	"id",
  "name",
  "order",
  "displayName",
  "shortDisplayName",
  "description",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	"id",
  "name",
  "order",
  "displayName",
  "shortDisplayName",
  "description",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."MarketingLayoutGroup"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingLayoutGroup") || ''''

) AS (
	"id" uuid,
  "name" text,
  "order" int4,
  "displayName" text,
  "shortDisplayName" text,
  "description" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MarketingLayoutGroup" (
	"id",
  "name",
  "order",
  "displayName",
  "shortDisplayName",
  "description",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "name",
  "order",
  "displayName",
  "shortDisplayName",
  "description",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingLayoutGroup"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"name" = EXCLUDED."name",
		"order" = EXCLUDED."order",
		"displayName" = EXCLUDED."displayName",
		"shortDisplayName" = EXCLUDED."shortDisplayName",
		"description" = EXCLUDED."description",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingAsset";

 INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingAsset" (
	"id",
  "name",
  "type",
	"url",
  "displayName",
  "displayDescription",
	"altTag",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	"id",
  "name",
  "type",
	"url",
  "displayName",
  "displayDescription",
	"altTag",
  "created_at",
  "updated_at"
   FROM "srcDB"."srcSchema"."MarketingAsset"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingAsset") || ''''

 ) AS (
	"id" uuid,
  "name" varchar(200),
  "type" text,
	"url" varchar(200),
  "displayName" varchar(200),
  "displayDescription" text,
	"altTag" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

 INSERT INTO "dstNormDB"."dstNormSchema"."MarketingAsset" (
	"id",
  "name",
  "type",
	"url",
  "displayName",
  "displayDescription",
	"altTag",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "name",
  "type",
	"url",
  "displayName",
  "displayDescription",
	"altTag",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingAsset"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"name" = EXCLUDED."name",
		"type" = EXCLUDED."type",
		"url" = EXCLUDED."url",
		"displayName" = EXCLUDED."displayName",
		"displayDescription" = EXCLUDED."displayDescription",
		"altTag" = EXCLUDED."altTag",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingLayout";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingLayout" (
	"id",
  "name",
  "propertyId",
  "marketingLayoutGroupId",
  "displayName",
  "description",
  "order",
  "inactive",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	"id",
  "name",
  "propertyId",
  "marketingLayoutGroupId",
  "displayName",
  "description",
  "order",
  "inactive",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."MarketingLayout"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingLayout") || ''''

) AS (
	"id" uuid,
  "name" text,
  "propertyId" uuid,
  "marketingLayoutGroupId" uuid,
  "displayName" text,
  "description" text,
  "order" int4,
  "inactive" bool,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MarketingLayout" (
	"id",
  "name",
  "propertyId",
  "marketingLayoutGroupId",
  "displayName",
  "description",
  "order",
  "inactive",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "name",
  "propertyId",
  "marketingLayoutGroupId",
  "displayName",
  "description",
  "order",
  "inactive",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingLayout"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"marketingLayoutGroupId" = EXCLUDED."marketingLayoutGroupId",
		"displayName" = EXCLUDED."displayName",
		"description" = EXCLUDED."description",
		"order" = EXCLUDED."order",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingQuestions";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingQuestions" (
	"id",
  "name",
  "displaySectionQuestion",
  "displayPrimaryQuestion",
  "displayPrimaryQuestionDescription",
  "displayFollowupQuestion",
  "inputTypeForFollowupQuestion",
  "displayOrder",
  "enumValues",
  "inactive",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	"id",
  "name",
  "displaySectionQuestion",
  "displayPrimaryQuestion",
  "displayPrimaryQuestionDescription",
  "displayFollowupQuestion",
  "inputTypeForFollowupQuestion",
  "displayOrder",
  "enumValues",
  "inactive",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."MarketingQuestions"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingQuestions") || ''''

) AS (
	"id" uuid,
  "name" varchar(255),
  "displaySectionQuestion" text,
  "displayPrimaryQuestion" text,
  "displayPrimaryQuestionDescription" text,
  "displayFollowupQuestion" text,
  "inputTypeForFollowupQuestion" varchar(80),
  "displayOrder" numeric,
  "enumValues" varchar[],
  "inactive" bool,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MarketingQuestions" (
	"id",
  "name",
  "displaySectionQuestion",
  "displayPrimaryQuestion",
  "displayPrimaryQuestionDescription",
  "displayFollowupQuestion",
  "inputTypeForFollowupQuestion",
  "displayOrder",
  "enumValues",
  "inactive",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "name",
  "displaySectionQuestion",
  "displayPrimaryQuestion",
  "displayPrimaryQuestionDescription",
  "displayFollowupQuestion",
  "inputTypeForFollowupQuestion",
  "displayOrder",
  "enumValues",
  "inactive",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingQuestions"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"name" = EXCLUDED."name",
		"displaySectionQuestion" = EXCLUDED."displaySectionQuestion",
		"displayPrimaryQuestion" = EXCLUDED."displayPrimaryQuestion",
		"displayPrimaryQuestionDescription" = EXCLUDED."displayPrimaryQuestionDescription",
		"displayFollowupQuestion" = EXCLUDED."displayFollowupQuestion",
		"inputTypeForFollowupQuestion" = EXCLUDED."inputTypeForFollowupQuestion",
    "displayOrder" = EXCLUDED."displayOrder",
		"enumValues" = EXCLUDED."enumValues",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Layout";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Layout" (
	"id",
	"name",
	"description",
	"propertyId",
	"numBedrooms",
	"numBathrooms",
	"surfaceArea",
	"displayName",
	"floorCount",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at",
	"marketingLayoutId",
	"marketingVideoAssets",
	"marketing3DAssets"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"description",
		"propertyId",
		"numBedrooms",
		"numBathrooms",
		"surfaceArea",
		"displayName",
		"floorCount",
		"inventoryType",
		"inactive",
		"created_at",
		"updated_at",
		"marketingLayoutId",
		"marketingVideoAssets",
		"marketing3DAssets"

	FROM "srcDB"."srcSchema"."Layout"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Layout") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"description"	text,
	"propertyId"	uuid,
	"numBedrooms"	numeric,
	"numBathrooms"	numeric,
	"surfaceArea"	numeric,
	"displayName"	varchar(200),
	"floorCount"	int4,
	"inventoryType"	varchar(255),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"marketingLayoutId" uuid,
	"marketingVideoAssets" _varchar,
	"marketing3DAssets" _varchar
);

INSERT INTO "dstNormDB"."dstNormSchema"."Layout" (
	"id",
	"name",
	"description",
	"propertyId",
	"numBedrooms",
	"numBathrooms",
	"surfaceArea",
	"displayName",
	"floorCount",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at",
	"marketingLayoutId",
	"marketingVideoAssets",
	"marketing3DAssets"
)
SELECT
	"id",
	"name",
	"description",
	"propertyId",
	"numBedrooms",
	"numBathrooms",
	"surfaceArea",
	"displayName",
	"floorCount",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at",
	"marketingLayoutId",
	"marketingVideoAssets",
	"marketing3DAssets"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Layout"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"description" = EXCLUDED."description",
		"propertyId" = EXCLUDED."propertyId",
		"numBedrooms" = EXCLUDED."numBedrooms",
		"numBathrooms" = EXCLUDED."numBathrooms",
		"surfaceArea" = EXCLUDED."surfaceArea",
		"displayName" = EXCLUDED."displayName",
		"floorCount" = EXCLUDED."floorCount",
		"inventoryType" = EXCLUDED."inventoryType",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"marketingLayoutId" = EXCLUDED."marketingLayoutId",
		"marketingVideoAssets" = EXCLUDED."marketingVideoAssets",
		"marketing3DAssets" = EXCLUDED."marketing3DAssets";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Layout_Amenity";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Layout_Amenity" (
	"id",
	"layoutId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"layoutId",
		"amenityId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Layout_Amenity"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Layout_Amenity") || ''''

) AS (
	"id"	uuid,
	"layoutId"	uuid,
	"amenityId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Layout_Amenity" (
	"id",
	"layoutId",
	"amenityId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"layoutId",
	"amenityId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Layout_Amenity"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"layoutId" = EXCLUDED."layoutId",
		"amenityId" = EXCLUDED."amenityId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Lease";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Lease" (
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"leaseTemplateId",
	"leaseData",
	"versions",
	"status",
	"baselineData",
	"signDate",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyId",
		"quoteId",
		"leaseTermId",
		"leaseTemplateId",
		"leaseData",
		"versions",
		"status",
		"baselineData",
		"signDate",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Lease"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Lease") || ''''

) AS (
	"id"	uuid,
	"partyId"	uuid,
	"quoteId"	uuid,
	"leaseTermId"	uuid,
	"leaseTemplateId"	uuid,
	"leaseData"	jsonb,
	"versions"	jsonb,
	"status"	varchar(255),
	"baselineData"	jsonb,
	"signDate"	timestamptz,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Lease" (
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"leaseTemplateId",
	"leaseData",
	"versions",
	"status",
	"baselineData",
	"signDate",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"leaseTemplateId",
	"leaseData",
	"versions",
	"status",
	"baselineData",
	"signDate",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Lease"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"quoteId" = EXCLUDED."quoteId",
		"leaseTermId" = EXCLUDED."leaseTermId",
		"leaseTemplateId" = EXCLUDED."leaseTemplateId",
		"leaseData" = EXCLUDED."leaseData",
		"versions" = EXCLUDED."versions",
		"status" = EXCLUDED."status",
		"baselineData" = EXCLUDED."baselineData",
		"signDate" = EXCLUDED."signDate",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_LeaseName";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_LeaseName" (
	"id",
	"name",
	"propertyId",
	"description",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyId",
		"description",
		"inventoryType",
		"inactive",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."LeaseName"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."LeaseName") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyId"	uuid,
	"description"	text,
	"inventoryType"	varchar(255),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."LeaseName" (
	"id",
	"name",
	"propertyId",
	"description",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"propertyId",
	"description",
	"inventoryType",
	"inactive",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_LeaseName"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyId" = EXCLUDED."propertyId",
		"description" = EXCLUDED."description",
		"inventoryType" = EXCLUDED."inventoryType",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_LeaseSignatureStatus";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_LeaseSignatureStatus" (
	"id",
	"leaseId",
	"partyMemberId",
	"userId",
	"status",
	"metadata",
	"envelopeId",
	"signUrl",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"leaseId",
		"partyMemberId",
		"userId",
		"status",
		"metadata",
		"envelopeId",
		"signUrl",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."LeaseSignatureStatus"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."LeaseSignatureStatus") || ''''

) AS (
	"id"	uuid,
	"leaseId"	uuid,
	"partyMemberId"	uuid,
	"userId"	uuid,
	"status"	varchar(255),
	"metadata"	jsonb,
	"envelopeId"	text,
	"signUrl"	text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."LeaseSignatureStatus" (
	"id",
	"leaseId",
	"partyMemberId",
	"userId",
	"status",
	"metadata",
	"envelopeId",
	"signUrl",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"leaseId",
	"partyMemberId",
	"userId",
	"status",
	"metadata",
	"envelopeId",
	"signUrl",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_LeaseSignatureStatus"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"leaseId" = EXCLUDED."leaseId",
		"partyMemberId" = EXCLUDED."partyMemberId",
		"userId" = EXCLUDED."userId",
		"status" = EXCLUDED."status",
		"metadata" = EXCLUDED."metadata",
		"envelopeId" = EXCLUDED."envelopeId",
		"signUrl" = EXCLUDED."signUrl",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_LeaseTemplate";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_LeaseTemplate" (
	"id",
	"propertyId",
	"templateData",
	"request",
	"response",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"propertyId",
		"templateData",
		"request",
		"response",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."LeaseTemplate"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."LeaseTemplate") || ''''

) AS (
	"id"	uuid,
	"propertyId"	uuid,
	"templateData"	jsonb,
	"request"	text,
	"response"	text,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."LeaseTemplate" (
	"id",
	"propertyId",
	"templateData",
	"request",
	"response",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"propertyId",
	"templateData",
	"request",
	"response",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_LeaseTemplate"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"propertyId" = EXCLUDED."propertyId",
		"templateData" = EXCLUDED."templateData",
		"request" = EXCLUDED."request",
		"response" = EXCLUDED."response",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_LeaseTerm";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_LeaseTerm" (
	"id",
	"termLength",
	"showOnQuote",
	"leaseNameId",
	"period",
	"relativeAdjustment",
	"absoluteAdjustment",
	"state",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"termLength",
		"showOnQuote",
		"leaseNameId",
		"period",
		"relativeAdjustment",
		"absoluteAdjustment",
		"state",
		"inactive",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."LeaseTerm"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."LeaseTerm") || ''''

) AS (
	"id"	uuid,
	"termLength"	int4,
	"showOnQuote"	bool,
	"leaseNameId"	uuid,
	"period"	varchar(20),
	"relativeAdjustment"	numeric,
	"absoluteAdjustment"	numeric,
	"state"	varchar(80),
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."LeaseTerm" (
	"id",
	"termLength",
	"showOnQuote",
	"leaseNameId",
	"period",
	"relativeAdjustment",
	"absoluteAdjustment",
	"state",
	"inactive",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"termLength",
	"showOnQuote",
	"leaseNameId",
	"period",
	"relativeAdjustment",
	"absoluteAdjustment",
	"state",
	"inactive",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_LeaseTerm"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"termLength" = EXCLUDED."termLength",
		"showOnQuote" = EXCLUDED."showOnQuote",
		"leaseNameId" = EXCLUDED."leaseNameId",
		"period" = EXCLUDED."period",
		"relativeAdjustment" = EXCLUDED."relativeAdjustment",
		"absoluteAdjustment" = EXCLUDED."absoluteAdjustment",
		"inactive" = EXCLUDED."inactive",
		"state" = EXCLUDED."state",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MergePartyMatches";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MergePartyMatches" (
	"id",
	"sessionId",
	"firstPartyId",
	"secondPartyId",
	"resultPartyId",
	"response",
	"resolvedBy",
	"dataBeforeMerge",
	"mergeChanges",
	"exportData",
	"created_at",
	"updated_at"
)

SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"sessionId",
		"firstPartyId",
		"secondPartyId",
		"resultPartyId",
		"response",
		"resolvedBy",
		"dataBeforeMerge",
		"mergeChanges",
		"exportData",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."MergePartyMatches"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MergePartyMatches") || ''''

) AS (
	"id"	uuid,
	"sessionId"	uuid,
	"firstPartyId"	uuid,
	"secondPartyId"	uuid,
	"resultPartyId"	uuid,
	"response"	text,
	"resolvedBy"	uuid,
	"dataBeforeMerge"	jsonb,
	"mergeChanges"	jsonb,
	"exportData"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MergePartyMatches" (
	"id",
	"sessionId",
	"firstPartyId",
	"secondPartyId",
	"resultPartyId",
	"response",
	"resolvedBy",
	"dataBeforeMerge",
	"mergeChanges",
	"exportData",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"sessionId",
	"firstPartyId",
	"secondPartyId",
	"resultPartyId",
	"response",
	"resolvedBy",
	"dataBeforeMerge",
	"mergeChanges",
	"exportData",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MergePartyMatches"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"sessionId" = EXCLUDED."sessionId",
		"firstPartyId" = EXCLUDED."firstPartyId",
		"secondPartyId" = EXCLUDED."secondPartyId",
		"resultPartyId" = EXCLUDED."resultPartyId",
		"response" = EXCLUDED."response",
		"resolvedBy" = EXCLUDED."resolvedBy",
		"dataBeforeMerge" = EXCLUDED."dataBeforeMerge",
		"mergeChanges" = EXCLUDED."mergeChanges",
		"exportData" = EXCLUDED."exportData",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MergePartySessions";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MergePartySessions" (
	"id",
	"context",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"context",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."MergePartySessions"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MergePartySessions") || ''''

) AS (
	"id"	uuid,
	"context"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MergePartySessions" (
	"id",
	"context",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"context",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MergePartySessions"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"context" = EXCLUDED."context",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

-- PartyGroup
TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PartyGroup";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PartyGroup" (
	"id",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"created_at",
		"updated_at"
	FROM "srcDB"."srcSchema"."PartyGroup"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PartyGroup") || ''''
) AS (
	"id"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PartyGroup" (
	"id",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_PartyGroup"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

-- Party
TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Party";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Party" (
	"id",
	"state",
	"storedUnitsFilters",
	"userId",
	"metadata",
	"score",
	"qualificationQuestions",
	"teams",
	"collaborators",
	"assignedPropertyId",
	"startDate",
	"endDate",
	"emailIdentifier",
	"ownerTeam",
	"mergedWith",
	"teamPropertyProgramId",
	"leaseType",
	"stage",
	"modified_by",
	"created_at",
	"updated_at",
  "workflowName",
  "workflowState",
  "partyGroupId"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"state",
		"storedUnitsFilters",
		"userId",
		"metadata",
		"score",
		"qualificationQuestions",
		"teams",
		"collaborators",
		"assignedPropertyId",
		"startDate",
		"endDate",
		"emailIdentifier",
		"ownerTeam",
		"mergedWith",
		"teamPropertyProgramId",
		"leaseType",
		"stage",
		"modified_by",
		"created_at",
		"updated_at",
    "workflowName",
    "workflowState",
    "partyGroupId"
	FROM "srcDB"."srcSchema"."Party"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Party") || ''''

) AS (
	"id"	uuid,
	"state"	varchar(255),
	"storedUnitsFilters"	json,
	"userId"	uuid,
	"metadata"	jsonb,
	"score"	varchar(255),
	"qualificationQuestions"	jsonb,
	"teams"	_uuid,
	"collaborators"	_uuid,
	"assignedPropertyId"	uuid,
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"emailIdentifier" varchar(255),
	"ownerTeam"	uuid,
	"mergedWith"	uuid,
	"teamPropertyProgramId" uuid,
	"leaseType" text,
	"stage" text,
	"modified_by" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
  "workflowName" varchar(80),
  "workflowState" varchar(80),
  "partyGroupId" uuid
);

INSERT INTO "dstNormDB"."dstNormSchema"."Party" (
	"id",
	"state",
	"storedUnitsFilters",
	"userId",
	"metadata",
	"score",
	"qualificationQuestions",
	"teams",
	"collaborators",
	"assignedPropertyId",
	"startDate",
	"endDate",
	"emailIdentifier",
	"ownerTeam",
	"mergedWith",
	"teamPropertyProgramId",
	"leaseType",
	"stage",
	"modified_by",
	"created_at",
	"updated_at",
  "workflowName",
  "workflowState",
  "partyGroupId"
)
SELECT
	"id",
	"state",
	"storedUnitsFilters",
	"userId",
	"metadata",
	"score",
	"qualificationQuestions",
	"teams",
	"collaborators",
	"assignedPropertyId",
	"startDate",
	"endDate",
	"emailIdentifier",
	"ownerTeam",
	"mergedWith",
	"teamPropertyProgramId",
	"leaseType",
	"stage",
	"modified_by",
	"created_at",
	"updated_at",
  "workflowName",
  "workflowState",
  "partyGroupId"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Party"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"state" = EXCLUDED."state",
		"storedUnitsFilters" = EXCLUDED."storedUnitsFilters",
		"userId" = EXCLUDED."userId",
		"metadata" = EXCLUDED."metadata",
		"score" = EXCLUDED."score",
		"qualificationQuestions" = EXCLUDED."qualificationQuestions",
		"teams" = EXCLUDED."teams",
		"collaborators" = EXCLUDED."collaborators",
		"assignedPropertyId" = EXCLUDED."assignedPropertyId",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"emailIdentifier" = EXCLUDED."emailIdentifier",
		"ownerTeam" = EXCLUDED."ownerTeam",
		"mergedWith" = EXCLUDED."mergedWith",
		"teamPropertyProgramId" = EXCLUDED."teamPropertyProgramId",
		"leaseType" = EXCLUDED."leaseType",
		"stage" = EXCLUDED."stage",
		"modified_by" = EXCLUDED."modified_by",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"workflowName" = EXCLUDED."workflowName",
		"workflowState" = EXCLUDED."workflowState",
		"partyGroupId" = EXCLUDED."partyGroupId";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Party_AdditionalInfo";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Party_AdditionalInfo" (
	"id",
	"partyId",
	"type",
	"info",
	"externalRoommateId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyId",
		"type",
		"info",
		"externalRoommateId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Party_AdditionalInfo"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Party_AdditionalInfo") || ''''

) AS (
	"id"	uuid,
	"partyId"	uuid,
	"type"	varchar(255),
	"info"	jsonb,
	"externalRoommateId" varchar(255),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Party_AdditionalInfo" (
	"id",
	"partyId",
	"type",
	"info",
	"externalRoommateId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"partyId",
	"type",
	"info",
	"externalRoommateId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Party_AdditionalInfo"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"type" = EXCLUDED."type",
		"info" = EXCLUDED."info",
		"externalRoommateId" = EXCLUDED."externalRoommateId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PartyMember";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PartyMember" (
	"id",
	"partyId",
	"memberState",
	"memberType",
	"personId",
	"isSpam",
	"externalId",
	"guaranteedBy",
	"endDate",
	"startDate",
	"external",
	"modified_by",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyId",
		"memberState",
		"memberType",
		"personId",
		"isSpam",
		"externalId",
		"guaranteedBy",
		"endDate",
		"startDate",
		"external",
		"modified_by",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."PartyMember"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PartyMember") || ''''

) AS (
	"id"	uuid,
	"partyId"	uuid,
	"memberState"	varchar(255),
	"memberType"	varchar(255),
	"personId"	uuid,
	"isSpam"	bool,
	"externalId"	varchar(255),
	"guaranteedBy"	uuid,
	"endDate"	timestamptz,
	"startDate"	timestamptz,
	"external"	jsonb,
	"modified_by" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PartyMember" (
	"id",
	"partyId",
	"memberState",
	"memberType",
	"personId",
	"isSpam",
	"externalId",
	"guaranteedBy",
	"endDate",
	"startDate",
	"external",
	"modified_by",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"partyId",
	"memberState",
	"memberType",
	"personId",
	"isSpam",
	"externalId",
	"guaranteedBy",
	"endDate",
	"startDate",
	"external",
	"modified_by",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_PartyMember"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"memberState" = EXCLUDED."memberState",
		"memberType" = EXCLUDED."memberType",
		"personId" = EXCLUDED."personId",
		"isSpam" = EXCLUDED."isSpam",
		"externalId" = EXCLUDED."externalId",
		"guaranteedBy" = EXCLUDED."guaranteedBy",
		"endDate" = EXCLUDED."endDate",
		"startDate" = EXCLUDED."startDate",
		"external" = EXCLUDED."external",
		"modified_by" = EXCLUDED."modified_by",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PartyQuotePromotions";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PartyQuotePromotions" (
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"promotionStatus",
	"modified_by",
	"created_at",
	"updated_at",
	"approvedBy",
	"approvalDate"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyId",
		"quoteId",
		"leaseTermId",
		"promotionStatus",
    "modified_by",
		"created_at",
		"updated_at",
		"approvedBy",
		"approvalDate"

	FROM "srcDB"."srcSchema"."PartyQuotePromotions"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PartyQuotePromotions") || ''''

) AS (
	"id"	uuid,
	"partyId"	uuid,
	"quoteId"	uuid,
	"leaseTermId"	uuid,
	"promotionStatus"	text,
	"modified_by" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"approvedBy" uuid,
	"approvalDate" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PartyQuotePromotions" (
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"promotionStatus",
  "modified_by",
	"created_at",
	"updated_at",
	"approvedBy",
	"approvalDate"
)
SELECT
	"id",
	"partyId",
	"quoteId",
	"leaseTermId",
	"promotionStatus",
  "modified_by",
	"created_at",
	"updated_at",
	"approvedBy",
	"approvalDate"

FROM 	"tmpNormDB"."tmpNormSchema"."t_PartyQuotePromotions"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"quoteId" = EXCLUDED."quoteId",
		"leaseTermId" = EXCLUDED."leaseTermId",
		"promotionStatus" = EXCLUDED."promotionStatus",
    "modified_by" = EXCLUDED."modified_by",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"approvedBy" = EXCLUDED."approvedBy",
		"approvalDate" = EXCLUDED."approvalDate";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Person";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Person" (
	"id",
	"fullName",
	"preferredName",
	"dob",
	"idType",
	"idValue",
	"idState",
	"idProvince",
	"idCountry",
	"mergedWith",
	"modified_by",
	"isSuspiciousContent",
	"companyName",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"fullName",
		"preferredName",
		"dob",
		"idType",
		"idValue",
		"idState",
		"idProvince",
		"idCountry",
		"mergedWith",
		"modified_by",
		"isSuspiciousContent",
		"companyName",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Person"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Person") || ''''

) AS (
	"id"	uuid,
	"fullName"	varchar(255),
	"preferredName"	varchar(255),
	"dob"	timestamptz,
	"idType"	varchar(255),
	"idValue"	varchar(255),
	"idState"	varchar(255),
	"idProvince"	varchar(255),
	"idCountry"	varchar(255),
	"mergedWith" uuid,
	"modified_by" uuid,
	"isSuspiciousContent" bool,
	"companyName" varchar(255),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Person" (
	"id",
	"fullName",
	"preferredName",
	"dob",
	"idType",
	"idValue",
	"idState",
	"idProvince",
	"idCountry",
	"mergedWith",
	"modified_by",
	"isSuspiciousContent",
	"companyName",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"fullName",
	"preferredName",
	"dob",
	"idType",
	"idValue",
	"idState",
	"idProvince",
	"idCountry",
	"mergedWith",
	"modified_by",
	"isSuspiciousContent",
	"companyName",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Person"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"fullName" = EXCLUDED."fullName",
		"preferredName" = EXCLUDED."preferredName",
		"dob" = EXCLUDED."dob",
		"idType" = EXCLUDED."idType",
		"idValue" = EXCLUDED."idValue",
		"idState" = EXCLUDED."idState",
		"idProvince" = EXCLUDED."idProvince",
		"idCountry" = EXCLUDED."idCountry",
		"mergedWith" = EXCLUDED."mergedWith",
		"modified_by" = EXCLUDED."modified_by",
		"isSuspiciousContent" = EXCLUDED."isSuspiciousContent",
		"companyName" = EXCLUDED."companyName",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Property";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Property" (
	"id",
	"name",
	"propertyLegalName",
	"owner",
	"operator",
	"propertyGroupId",
	"addressId",
	"startDate",
	"endDate",
	"APN",
	"MSANumber",
	"MSAName",
	"description",
	"website",
  "displayPhone",
	"displayName",
  "leasingOfficeAddress",
	"timezone",
	"settings",
	"paymentProvider",
	"externalId",
  "rmsExternalId",
	"postMonth",
	"inactive",
	"created_at",
	"updated_at",
	"geoLocation"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"propertyLegalName",
		"owner",
		"operator",
		"propertyGroupId",
		"addressId",
		"startDate",
		"endDate",
		"APN",
		"MSANumber",
		"MSAName",
		"description",
		"website",
    "displayPhone",
		"displayName",
    "leasingOfficeAddress",
		"timezone",
		"settings",
		"paymentProvider",
		"externalId",
		"rmsExternalId",
		"postMonth",
		"inactive",
		"created_at",
		"updated_at",
		"geoLocation"

	FROM "srcDB"."srcSchema"."Property"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Property") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"propertyLegalName"	varchar(200),
	"owner"	uuid,
	"operator"	uuid,
	"propertyGroupId"	uuid,
	"addressId"	uuid,
	"startDate"	timestamptz,
	"endDate"	timestamptz,
	"APN"	varchar(40),
	"MSANumber"	int2,
	"MSAName"	varchar(60),
	"description"	text,
	"website"	varchar(200),
	"displayPhone"	varchar(20),
	"displayName"	varchar(200),
	"leasingOfficeAddress" varchar(256),
  "timezone"	text,
	"settings"	jsonb,
	"paymentProvider"	jsonb,
	"externalId"	varchar(200),
	"rmsExternalId"    varchar(200),
	"postMonth" date,
	"inactive" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"geoLocation" json
);

INSERT INTO "dstNormDB"."dstNormSchema"."Property" (
	"id",
	"name",
	"propertyLegalName",
	"owner",
	"operator",
	"propertyGroupId",
	"addressId",
	"startDate",
	"endDate",
	"APN",
	"MSANumber",
	"MSAName",
	"description",
	"website",
  "displayPhone",
	"displayName",
  "leasingOfficeAddress",
	"timezone",
	"settings",
	"paymentProvider",
	"externalId",
	"rmsExternalId",
	"postMonth",
	"inactive",
	"created_at",
	"updated_at",
	"geoLocation"
)
SELECT
	"id",
	"name",
	"propertyLegalName",
	"owner",
	"operator",
	"propertyGroupId",
	"addressId",
	"startDate",
	"endDate",
	"APN",
	"MSANumber",
	"MSAName",
	"description",
	"website",
  "displayPhone",
	"displayName",
  "leasingOfficeAddress",
	"timezone",
	"settings",
	"paymentProvider",
	"externalId",
	"rmsExternalId",
	"postMonth",
	"inactive",
	"created_at",
	"updated_at",
	"geoLocation"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Property"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"propertyLegalName" = EXCLUDED."propertyLegalName",
		"owner" = EXCLUDED."owner",
		"operator" = EXCLUDED."operator",
		"propertyGroupId" = EXCLUDED."propertyGroupId",
		"addressId" = EXCLUDED."addressId",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"APN" = EXCLUDED."APN",
		"MSANumber" = EXCLUDED."MSANumber",
		"MSAName" = EXCLUDED."MSAName",
		"description" = EXCLUDED."description",
		"website" = EXCLUDED."website",
		"displayPhone" = EXCLUDED."displayPhone",
		"displayName" = EXCLUDED."displayName",
    "leasingOfficeAddress" = EXCLUDED."leasingOfficeAddress",
		"timezone" = EXCLUDED."timezone",
		"settings" = EXCLUDED."settings",
		"paymentProvider" = EXCLUDED."paymentProvider",
		"externalId" = EXCLUDED."externalId",
		"rmsExternalId" = EXCLUDED."rmsExternalId",
		"postMonth" = EXCLUDED."postMonth",
		"inactive" = EXCLUDED."inactive",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"geoLocation" = EXCLUDED."geoLocation";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PropertyGroup";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PropertyGroup" (
	"id",
	"name",
	"description",
	"owner",
	"operator",
	"parentGroup",
	"displayName",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"description",
		"owner",
		"operator",
		"parentGroup",
		"displayName",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."PropertyGroup"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PropertyGroup") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"description"	text,
	"owner"	uuid,
	"operator"	uuid,
	"parentGroup"	uuid,
	"displayName"	varchar(200),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PropertyGroup" (
	"id",
	"name",
	"description",
	"owner",
	"operator",
	"parentGroup",
	"displayName",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"description",
	"owner",
	"operator",
	"parentGroup",
	"displayName",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_PropertyGroup"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"description" = EXCLUDED."description",
		"owner" = EXCLUDED."owner",
		"operator" = EXCLUDED."operator",
		"parentGroup" = EXCLUDED."parentGroup",
		"displayName" = EXCLUDED."displayName",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Quote";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Quote" (
	"id",
	"inventoryId",
	"partyId",
	"publishDate",
	"expirationDate",
	"leaseStartDate",
	"selections",
	"confirmationNumber",
	"publishedQuoteData",
	"modified_by",
	"propertyTimezone",
  "isSelfService",
  "leaseState",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"inventoryId",
		"partyId",
		"publishDate",
		"expirationDate",
		"leaseStartDate",
		"selections",
		"confirmationNumber",
		"publishedQuoteData",
		"modified_by",
		"propertyTimezone",
    "isSelfService",
    "leaseState",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Quote"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Quote") || ''''

) AS (
	"id"	uuid,
	"inventoryId"	uuid,
	"partyId"	uuid,
	"publishDate"	timestamptz,
	"expirationDate"	timestamptz,
	"leaseStartDate"	timestamptz,
	"selections"	jsonb,
	"confirmationNumber"	uuid,
	"publishedQuoteData"	jsonb,
	"modified_by" uuid,
	"propertyTimezone" text,
  "isSelfService" bool,
  "leaseState" varchar(80),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Quote" (
	"id",
	"inventoryId",
	"partyId",
	"publishDate",
	"expirationDate",
	"leaseStartDate",
	"selections",
	"confirmationNumber",
	"publishedQuoteData",
	"modified_by",
	"propertyTimezone",
  "isSelfService",
  "leaseState",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"inventoryId",
	"partyId",
	"publishDate",
	"expirationDate",
	"leaseStartDate",
	"selections",
	"confirmationNumber",
	"publishedQuoteData",
	"modified_by",
	"propertyTimezone",
  "isSelfService",
  "leaseState",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Quote"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"inventoryId" = EXCLUDED."inventoryId",
		"partyId" = EXCLUDED."partyId",
		"publishDate" = EXCLUDED."publishDate",
		"expirationDate" = EXCLUDED."expirationDate",
		"leaseStartDate" = EXCLUDED."leaseStartDate",
		"selections" = EXCLUDED."selections",
		"confirmationNumber" = EXCLUDED."confirmationNumber",
		"publishedQuoteData" = EXCLUDED."publishedQuoteData",
		"modified_by" = EXCLUDED."modified_by",
		"propertyTimezone" = EXCLUDED."propertyTimezone",
		"isSelfService" = EXCLUDED."isSelfService",
		"leaseState" = EXCLUDED."leaseState",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationInvoices";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationInvoices" (
	"id",
	"applicationFeeId",
	"applicationFeeAmount",
	"holdDepositFeeId",
	"holdDepositFeeIdAmount",
	"paymentCompleted",
	"receiptPayload",
	"partyApplicationId",
	"personApplicationId",
	"quoteId",
	"created_at",
	"updated_at",
	"propertyId",
	"applicationFeeWaiverAmount"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"applicationFeeId",
		"applicationFeeAmount",
		"holdDepositFeeId",
		"holdDepositFeeIdAmount",
		"paymentCompleted",
		"receiptPayload",
		"partyApplicationId",
		"personApplicationId",
		"quoteId",
		"created_at",
		"updated_at",
		"propertyId",
		"applicationFeeWaiverAmount"

	FROM "srcDB"."srcSchema"."rentapp_ApplicationInvoices"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_ApplicationInvoices") || ''''

) AS (
	"id"	uuid,
	"applicationFeeId"	uuid,
	"applicationFeeAmount"	numeric,
	"holdDepositFeeId"	uuid,
	"holdDepositFeeIdAmount"	numeric,
	"paymentCompleted"	bool,
	"receiptPayload"	jsonb,
	"partyApplicationId"	uuid,
	"personApplicationId"	uuid,
	"quoteId"	uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"propertyId"	uuid,
	"applicationFeeWaiverAmount" numeric(7,2)
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_ApplicationInvoices" (
	"id",
	"applicationFeeId",
	"applicationFeeAmount",
	"holdDepositFeeId",
	"holdDepositFeeIdAmount",
	"paymentCompleted",
	"receiptPayload",
	"partyApplicationId",
	"personApplicationId",
	"quoteId",
	"created_at",
	"updated_at",
	"propertyId",
	"applicationFeeWaiverAmount"
)
SELECT
	"id",
	"applicationFeeId",
	"applicationFeeAmount",
	"holdDepositFeeId",
	"holdDepositFeeIdAmount",
	"paymentCompleted",
	"receiptPayload",
	"partyApplicationId",
	"personApplicationId",
	"quoteId",
	"created_at",
	"updated_at",
	"propertyId",
	"applicationFeeWaiverAmount"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationInvoices"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"applicationFeeId" = EXCLUDED."applicationFeeId",
		"applicationFeeAmount" = EXCLUDED."applicationFeeAmount",
		"holdDepositFeeId" = EXCLUDED."holdDepositFeeId",
		"holdDepositFeeIdAmount" = EXCLUDED."holdDepositFeeIdAmount",
		"paymentCompleted" = EXCLUDED."paymentCompleted",
		"receiptPayload" = EXCLUDED."receiptPayload",
		"partyApplicationId" = EXCLUDED."partyApplicationId",
		"personApplicationId" = EXCLUDED."personApplicationId",
		"quoteId" = EXCLUDED."quoteId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"propertyId" = EXCLUDED."propertyId",
		"applicationFeeWaiverAmount" = EXCLUDED."applicationFeeWaiverAmount";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationTransactions";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationTransactions" (
	"id",
	"invoiceId",
	"transactionType",
	"transactionData",
	"externalId",
	"targetId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"invoiceId",
		"transactionType",
		"transactionData",
		"externalId",
		"targetId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_ApplicationTransactions"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_ApplicationTransactions") || ''''

) AS (
	"id"	uuid,
	"invoiceId"	uuid,
	"transactionType"	varchar(80),
	"transactionData"	jsonb,
	"externalId"	varchar(255),
	"targetId"	varchar(255),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_ApplicationTransactions" (
	"id",
	"invoiceId",
	"transactionType",
	"transactionData",
	"externalId",
	"targetId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"invoiceId",
	"transactionType",
	"transactionData",
	"externalId",
	"targetId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_ApplicationTransactions"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"invoiceId" = EXCLUDED."invoiceId",
		"transactionType" = EXCLUDED."transactionType",
		"transactionData" = EXCLUDED."transactionData",
		"externalId" = EXCLUDED."externalId",
		"targetId" = EXCLUDED."targetId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_PartyApplication";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_PartyApplication" (
	"id",
	"partyId",
	"applicationData",
	"maxApprovedAt",
	"minDeniedAt",
	"isHeld",
	"holdReason",
	"overrideNewCountChecks",
	"screeningVersion",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyId",
		"applicationData",
		"maxApprovedAt",
		"minDeniedAt",
		"isHeld",
		"holdReason",
		"overrideNewCountChecks",
		"screeningVersion",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_PartyApplication"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_PartyApplication") || ''''

) AS (
	"id"	uuid,
	"partyId"	uuid,
	"applicationData"	jsonb,
	"maxApprovedAt"	numeric,
	"minDeniedAt"	numeric,
	"isHeld"	bool,
	"holdReason"	text,
	"overrideNewCountChecks"	bool,
	"screeningVersion"	numeric,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_PartyApplication" (
	"id",
	"partyId",
	"applicationData",
	"maxApprovedAt",
	"minDeniedAt",
	"isHeld",
	"holdReason",
	"overrideNewCountChecks",
	"screeningVersion",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"partyId",
	"applicationData",
	"maxApprovedAt",
	"minDeniedAt",
	"isHeld",
	"holdReason",
	"overrideNewCountChecks",
	"screeningVersion",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_PartyApplication"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"applicationData" = EXCLUDED."applicationData",
		"maxApprovedAt" = EXCLUDED."maxApprovedAt",
		"minDeniedAt" = EXCLUDED."minDeniedAt",
		"isHeld" = EXCLUDED."isHeld",
		"holdReason" = EXCLUDED."holdReason",
		"overrideNewCountChecks" = EXCLUDED."overrideNewCountChecks",
		"screeningVersion" = EXCLUDED."screeningVersion",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_partyApplicationDocuments";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_partyApplicationDocuments" (
	"id",
	"partyApplicationId",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyApplicationId",
		"metadata",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_partyApplicationDocuments"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_partyApplicationDocuments") || ''''

) AS (
	"id"	uuid,
	"partyApplicationId"	uuid,
	"metadata"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_partyApplicationDocuments" (
	"id",
	"partyApplicationId",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"partyApplicationId",
	"metadata",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_partyApplicationDocuments"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyApplicationId" = EXCLUDED."partyApplicationId",
		"metadata" = EXCLUDED."metadata",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_PersonApplication";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_PersonApplication" (
	"id",
	"personId",
	"partyId",
	"partyApplicationId",
	"paymentCompleted",
	"applicationData",
	"applicationStatus",
	"additionalData",
	"applicantId",
	"ssn",
	"itin",
	"isFeeWaived",
	"feeWaiverReason",
	"endedAsMergedAt",
	"sendSsnEnabled",
	"tosEvents",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"personId",
		"partyId",
		"partyApplicationId",
		"paymentCompleted",
		"applicationData",
		"applicationStatus",
		"additionalData",
		"applicantId",
		"ssn",
		"itin",
		"isFeeWaived",
		"feeWaiverReason",
		"endedAsMergedAt",
		"sendSsnEnabled",
		"tosEvents",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_PersonApplication"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_PersonApplication") || ''''

) AS (
	"id"	uuid,
	"personId"	uuid,
	"partyId"	uuid,
	"partyApplicationId"	uuid,
	"paymentCompleted"	bool,
	"applicationData"	jsonb,
	"applicationStatus"	varchar(255),
	"additionalData"	jsonb,
	"applicantId" varchar(255),
	"ssn" varchar(255),
	"itin" varchar(255),
	"isFeeWaived" bool,
	"feeWaiverReason" text,
	"endedAsMergedAt" timestamptz,
	"sendSsnEnabled" bool,
	"tosEvents" jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_PersonApplication" (
	"id",
	"personId",
	"partyId",
	"partyApplicationId",
	"paymentCompleted",
	"applicationData",
	"applicationStatus",
	"additionalData",
	"applicantId",
	"ssn",
	"itin",
	"isFeeWaived",
	"feeWaiverReason",
	"endedAsMergedAt",
	"sendSsnEnabled",
	"tosEvents",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"personId",
	"partyId",
	"partyApplicationId",
	"paymentCompleted",
	"applicationData",
	"applicationStatus",
	"additionalData",
	"applicantId",
	"ssn",
	"itin",
	"isFeeWaived",
	"feeWaiverReason",
	"endedAsMergedAt",
	"sendSsnEnabled",
	"tosEvents",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_PersonApplication"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"personId" = EXCLUDED."personId",
		"partyId" = EXCLUDED."partyId",
		"partyApplicationId" = EXCLUDED."partyApplicationId",
		"paymentCompleted" = EXCLUDED."paymentCompleted",
		"applicationData" = EXCLUDED."applicationData",
		"applicationStatus" = EXCLUDED."applicationStatus",
		"additionalData" = EXCLUDED."additionalData",
		"applicantId" = EXCLUDED."applicantId",
		"ssn" = EXCLUDED."ssn",
		"itin" = EXCLUDED."itin",
		"isFeeWaived" = EXCLUDED."isFeeWaived",
		"feeWaiverReason" = EXCLUDED."feeWaiverReason",
		"endedAsMergedAt" = EXCLUDED."endedAsMergedAt",
		"sendSsnEnabled" = EXCLUDED."sendSsnEnabled",
		"tosEvents" = EXCLUDED."tosEvents",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_personApplicationDocuments";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_personApplicationDocuments" (
	"id",
	"personApplicationId",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"personApplicationId",
		"metadata",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_personApplicationDocuments"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_personApplicationDocuments") || ''''

) AS (
	"id"	uuid,
	"personApplicationId"	uuid,
	"metadata"	jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_personApplicationDocuments" (
	"id",
	"personApplicationId",
	"metadata",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"personApplicationId",
	"metadata",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_personApplicationDocuments"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"personApplicationId" = EXCLUDED."personApplicationId",
		"metadata" = EXCLUDED."metadata",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionRequest";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionRequest" (
	"id",
	"partyApplicationId",
	"propertyId",
	"rentData",
	"applicantData",
	"transactionNumber",
	"quoteId",
	"isAlerted",
	"created_at",
	"updated_at",
	"isObsolete",
	"requestType",
	"requestEndedAt",
  "requestResult",
  "completeSubmissionResponseId",
  "parentSubmissionRequestId",
  "origin",
  "requestDataDiff"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"partyApplicationId",
		"propertyId",
		"rentData",
		"applicantData",
		"transactionNumber",
		"quoteId",
		"isAlerted",
		"created_at",
		"updated_at",
		"isObsolete",
		"requestType",
	  "requestEndedAt",
    "requestResult",
    "completeSubmissionResponseId",
    "parentSubmissionRequestId",
    "origin",
    "requestDataDiff"

	FROM "srcDB"."srcSchema"."rentapp_SubmissionRequest"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_SubmissionRequest") || ''''

) AS (
	"id"	uuid,
	"partyApplicationId"	uuid,
	"propertyId"	uuid,
	"rentData"	jsonb,
	"applicantData"	jsonb,
	"transactionNumber" varchar(255),
	"quoteId" uuid,
	"isAlerted" bool,
	"created_at"	timestamptz,
	"updated_at"	timestamptz,
	"isObsolete" bool,
	"requestType" varchar(255),
	"requestEndedAt" timestamptz,
  "requestResult" jsonb,
  "completeSubmissionResponseId" uuid,
  "parentSubmissionRequestId" uuid,
  "origin" varchar(255),
  "requestDataDiff" jsonb
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_SubmissionRequest" (
	"id",
	"partyApplicationId",
	"propertyId",
	"rentData",
	"applicantData",
	"transactionNumber",
	"quoteId",
	"isAlerted",
	"created_at",
	"updated_at",
	"isObsolete",
	"requestType",
	"requestEndedAt",
  "requestResult",
  "completeSubmissionResponseId",
  "parentSubmissionRequestId",
  "origin",
  "requestDataDiff"
)
SELECT
	"id",
	"partyApplicationId",
	"propertyId",
	"rentData",
	"applicantData",
	"transactionNumber",
	"quoteId",
	"isAlerted",
	"created_at",
	"updated_at",
	"isObsolete",
	"requestType",
	"requestEndedAt",
  "requestResult",
  "completeSubmissionResponseId",
  "parentSubmissionRequestId",
  "origin",
  "requestDataDiff"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionRequest"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"partyApplicationId" = EXCLUDED."partyApplicationId",
		"propertyId" = EXCLUDED."propertyId",
		"rentData" = EXCLUDED."rentData",
		"applicantData" = EXCLUDED."applicantData",
		"transactionNumber" = EXCLUDED."transactionNumber",
		"quoteId" = EXCLUDED."quoteId",
		"isAlerted" = EXCLUDED."isAlerted",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at",
		"isObsolete" = EXCLUDED."isObsolete",
		"requestType" = EXCLUDED."requestType",
	  "requestEndedAt" = EXCLUDED."requestEndedAt",
    "requestResult" = EXCLUDED."requestResult",
    "completeSubmissionResponseId" = EXCLUDED."completeSubmissionResponseId",
    "parentSubmissionRequestId" = EXCLUDED."parentSubmissionRequestId",
    "origin" = EXCLUDED."origin",
    "requestDataDiff" = EXCLUDED."requestDataDiff";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionResponse";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionResponse" (
	"id",
	"submissionRequestId",
	"applicationDecision",
	"applicantDecision",
	"recommendations",
	"externalId",
	"status",
	"serviceStatus",
	"origin",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"submissionRequestId",
		"applicationDecision",
		"applicantDecision",
		"recommendations",
		"externalId",
		"status",
		"serviceStatus",
		"origin",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."rentapp_SubmissionResponse"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."rentapp_SubmissionResponse") || ''''

) AS (
	"id"	uuid,
	"submissionRequestId"	uuid,
	"applicationDecision"	varchar(255),
	"applicantDecision"	_jsonb,
	"recommendations"	_jsonb,
	"externalId"	varchar(255),
	"status"	varchar(255),
	"serviceStatus" jsonb,
	"origin" varchar(80),
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."rentapp_SubmissionResponse" (
	"id",
	"submissionRequestId",
	"applicationDecision",
	"applicantDecision",
	"recommendations",
	"externalId",
	"status",
	"serviceStatus",
	"origin",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"submissionRequestId",
	"applicationDecision",
	"applicantDecision",
	"recommendations",
	"externalId",
	"status",
	"serviceStatus",
	"origin",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_rentapp_SubmissionResponse"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"submissionRequestId" = EXCLUDED."submissionRequestId",
		"applicationDecision" = EXCLUDED."applicationDecision",
		"applicantDecision" = EXCLUDED."applicantDecision",
		"recommendations" = EXCLUDED."recommendations",
		"externalId" = EXCLUDED."externalId",
		"status" = EXCLUDED."status",
		"serviceStatus" = EXCLUDED."serviceStatus",
		"origin" = EXCLUDED."origin",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Sources";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Sources" (
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at",
	"type"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
    "id",
    "name",
    "displayName",
    "description",
    "created_at",
    "updated_at",
		"type"
  FROM "srcDB"."srcSchema"."Sources"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Sources") || ''''

) AS (
  "id" uuid,
  "name"	varchar(200),
  "displayName"	varchar(200),
  "description"	varchar(500),
  "created_at"	timestamptz,
  "updated_at"	timestamptz,
	"type" varchar(200)
);

INSERT INTO "dstNormDB"."dstNormSchema"."Sources" (
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at",
	"type"
)
SELECT
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at",
	"type"

FROM 	"tmpNormDB"."tmpNormSchema"."t_Sources"
  ON CONFLICT ("id")
DO UPDATE
  SET
		"name" = EXCLUDED."name",
  	"displayName" = EXCLUDED."displayName",
  	"description" = EXCLUDED."description",
  	"created_at" = EXCLUDED."created_at",
  	"updated_at" = EXCLUDED."updated_at",
		"type" = EXCLUDED."type";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Tasks";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Tasks" (
	"id",
	"name",
	"partyId",
	"state",
	"userIds",
	"dueDate",
	"category",
	"metadata",
	"completionDate",
	"modified_by",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"partyId",
		"state",
		"userIds",
		"dueDate",
		"category",
		"metadata",
		"completionDate",
		"modified_by",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Tasks"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Tasks") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(255),
	"partyId"	uuid,
	"state"	text,
	"userIds"	_uuid,
	"dueDate"	timestamptz,
	"category"	varchar(255),
	"metadata"	jsonb,
	"completionDate" timestamptz,
	"modified_by" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Tasks" (
	"id",
	"name",
	"partyId",
	"state",
	"userIds",
	"dueDate",
	"category",
	"metadata",
	"completionDate",
	"modified_by",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"partyId",
	"state",
	"userIds",
	"dueDate",
	"category",
	"metadata",
	"completionDate",
	"modified_by",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Tasks"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"partyId" = EXCLUDED."partyId",
		"state" = EXCLUDED."state",
		"userIds" = EXCLUDED."userIds",
		"dueDate" = EXCLUDED."dueDate",
		"category" = EXCLUDED."category",
		"metadata" = EXCLUDED."metadata",
		"completionDate" = EXCLUDED."completionDate",
		"modified_by" = EXCLUDED."modified_by",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamMembers";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamMembers" (
	"id",
	"teamId",
	"userId",
	"inactive",
	"mainRoles",
	"functionalRoles",
	"directPhoneIdentifier",
	"directEmailIdentifier",
	"outsideDedicatedEmails",
  "voiceMessageId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"teamId",
		"userId",
		"inactive",
		"mainRoles",
		"functionalRoles",
		"directPhoneIdentifier",
		"directEmailIdentifier",
		"outsideDedicatedEmails",
    "voiceMessageId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."TeamMembers"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamMembers") || ''''

) AS (
	"id"	uuid,
	"teamId"	uuid,
	"userId"	uuid,
	"inactive"	bool,
	"mainRoles"	_varchar,
	"functionalRoles"	_varchar,
	"directPhoneIdentifier" varchar(20),
	"directEmailIdentifier" varchar(80),
	"outsideDedicatedEmails" _varchar,
  "voiceMessageId" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamMembers" (
	"id",
	"teamId",
	"userId",
	"inactive",
	"mainRoles",
	"functionalRoles",
	"directPhoneIdentifier",
	"directEmailIdentifier",
	"outsideDedicatedEmails",
  "voiceMessageId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"teamId",
	"userId",
	"inactive",
	"mainRoles",
	"functionalRoles",
	"directPhoneIdentifier",
	"directEmailIdentifier",
	"outsideDedicatedEmails",
  "voiceMessageId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_TeamMembers"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"teamId" = EXCLUDED."teamId",
		"userId" = EXCLUDED."userId",
		"inactive" = EXCLUDED."inactive",
		"mainRoles" = EXCLUDED."mainRoles",
		"functionalRoles" = EXCLUDED."functionalRoles",
		"directPhoneIdentifier" = EXCLUDED."directPhoneIdentifier",
		"directEmailIdentifier" = EXCLUDED."directEmailIdentifier",
		"outsideDedicatedEmails" = EXCLUDED."outsideDedicatedEmails",
		"voiceMessageId" = EXCLUDED."voiceMessageId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamMemberSalesTargets";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamMemberSalesTargets" (
	"id",
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
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
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

	FROM "srcDB"."srcSchema"."TeamMemberSalesTargets"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamMemberSalesTargets") || ''''

) AS (
	"id"	uuid,
	"teamId"	uuid,
	"userId"	uuid,
	"month"	int4,
	"year"	int4,
	"salesTarget"	int4,
	"contactsToSalesConv"	numeric,
	"leadsToSalesConv"	numeric,
	"prospectsToSalesConv"	numeric,
	"applicantsToSalesConv"	numeric,
	"leasesToSalesConv"	numeric,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamMemberSalesTargets" (
	"id",
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
	"id",
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
FROM 	"tmpNormDB"."tmpNormSchema"."t_TeamMemberSalesTargets"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"teamId" = EXCLUDED."teamId",
		"userId" = EXCLUDED."userId",
		"month" = EXCLUDED."month",
		"year" = EXCLUDED."year",
		"salesTarget" = EXCLUDED."salesTarget",
		"contactsToSalesConv" = EXCLUDED."contactsToSalesConv",
		"leadsToSalesConv" = EXCLUDED."leadsToSalesConv",
		"prospectsToSalesConv" = EXCLUDED."prospectsToSalesConv",
		"applicantsToSalesConv" = EXCLUDED."applicantsToSalesConv",
		"leasesToSalesConv" = EXCLUDED."leasesToSalesConv",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Teams";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Teams" (
	"id",
	"name",
	"displayName",
	"module",
	"description",
	"metadata",
	"timeZone",
	"officeHours",
	"callCenterPhoneNumber",
	"externalCalendars",
	"voiceMessageId",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"name",
		"displayName",
		"module",
		"description",
		"metadata",
		"timeZone",
		"officeHours",
		"callCenterPhoneNumber",
    "externalCalendars",
		"voiceMessageId",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Teams"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Teams") || ''''

) AS (
	"id"	uuid,
	"name"	varchar(200),
	"displayName"	varchar(200),
	"module"	text,
	"description"	varchar(500),
	"metadata"	jsonb,
	"timeZone"	text,
	"officeHours"	jsonb,
	"callCenterPhoneNumber" varchar(255),
	"externalCalendars" jsonb,
	"voiceMessageId" uuid,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Teams" (
	"id",
	"name",
	"displayName",
	"module",
	"description",
	"metadata",
	"timeZone",
	"officeHours",
	"callCenterPhoneNumber",
	"externalCalendars",
	"voiceMessageId",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"name",
	"displayName",
	"module",
	"description",
	"metadata",
	"timeZone",
	"officeHours",
	"callCenterPhoneNumber",
	"externalCalendars",
	"voiceMessageId",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Teams"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"name" = EXCLUDED."name",
		"displayName" = EXCLUDED."displayName",
		"module" = EXCLUDED."module",
		"description" = EXCLUDED."description",
		"metadata" = EXCLUDED."metadata",
		"timeZone" = EXCLUDED."timeZone",
		"officeHours" = EXCLUDED."officeHours",
		"callCenterPhoneNumber" = EXCLUDED."callCenterPhoneNumber",
    "externalCalendars" = EXCLUDED."externalCalendars",
		"voiceMessageId" = EXCLUDED."voiceMessageId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamSalesTargets";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamSalesTargets" (
	"id",
	"teamId",
	"month",
	"year",
	"salesTarget",
	"salesCycleDays",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"teamId",
		"month",
		"year",
		"salesTarget",
		"salesCycleDays",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."TeamSalesTargets"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamSalesTargets") || ''''

) AS (
	"id"	uuid,
	"teamId"	uuid,
	"month"	int4,
	"year"	int4,
	"salesTarget"	int4,
	"salesCycleDays"	int4,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamSalesTargets" (
	"id",
	"teamId",
	"month",
	"year",
	"salesTarget",
	"salesCycleDays",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"teamId",
	"month",
	"year",
	"salesTarget",
	"salesCycleDays",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_TeamSalesTargets"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"teamId" = EXCLUDED."teamId",
		"month" = EXCLUDED."month",
		"year" = EXCLUDED."year",
		"salesTarget" = EXCLUDED."salesTarget",
		"salesCycleDays" = EXCLUDED."salesCycleDays",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Users" CASCADE;

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Users" (
	"id",
	"externalUniqueId",
	"fullName",
	"preferredName",
	"email",
	"password",
	"employmentType",
	"loginAttempts",
	"metadata",
	"ringPhones",
	"lastLoginAttempt",
	"externalCalendars",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
		"id",
		"externalUniqueId",
		"fullName",
		"preferredName",
		"email",
		"password",
		"employmentType",
		"loginAttempts",
		"metadata",
		"ringPhones",
		"lastLoginAttempt",
		"externalCalendars",
		"created_at",
		"updated_at"

	FROM "srcDB"."srcSchema"."Users"
	WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Users") || ''''

) AS (
	"id"	uuid,
	"externalUniqueId"	varchar(255),
	"fullName"	varchar(255),
	"preferredName"	varchar(255),
	"email"	varchar(255),
	"password"	varchar(255),
	"employmentType"	varchar(255),
	"loginAttempts"	int4,
	"metadata"	jsonb,
	"ringPhones"	_varchar,
	"lastLoginAttempt"	timestamptz,
	"externalCalendars" jsonb,
	"created_at"	timestamptz,
	"updated_at"	timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Users" (
	"id",
	"externalUniqueId",
	"fullName",
	"preferredName",
	"email",
	"password",
	"employmentType",
	"loginAttempts",
	"metadata",
	"ringPhones",
	"lastLoginAttempt",
	"externalCalendars",
	"created_at",
	"updated_at"
)
SELECT
	"id",
	"externalUniqueId",
	"fullName",
	"preferredName",
	"email",
	"password",
	"employmentType",
	"loginAttempts",
	"metadata",
	"ringPhones",
	"lastLoginAttempt",
	"externalCalendars",
	"created_at",
	"updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Users"
ON CONFLICT ("id")
	DO UPDATE
	SET
		"externalUniqueId" = EXCLUDED."externalUniqueId",
		"fullName" = EXCLUDED."fullName",
		"preferredName" = EXCLUDED."preferredName",
		"email" = EXCLUDED."email",
		"password" = EXCLUDED."password",
		"employmentType" = EXCLUDED."employmentType",
		"loginAttempts" = EXCLUDED."loginAttempts",
		"metadata" = EXCLUDED."metadata",
		"ringPhones" = EXCLUDED."ringPhones",
		"lastLoginAttempt" = EXCLUDED."lastLoginAttempt",
		"externalCalendars" = EXCLUDED."externalCalendars",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Campaigns";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Campaigns" (
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
    "id",
    "name",
    "displayName",
    "description",
    "created_at",
    "updated_at"

  FROM "srcDB"."srcSchema"."Campaigns"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Campaigns") || ''''

) AS (
  "id" uuid,
  "name" text,
  "displayName" text,
  "description" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Campaigns" (
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "name",
  "displayName",
  "description",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Campaigns"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "name" = EXCLUDED."name",
    "displayName" = EXCLUDED."displayName",
    "description" = EXCLUDED."description",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_Programs";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_Programs" (
  "id",
  "name",
  "displayName",
  "description",
  "sourceId",
  "directEmailIdentifier",
  "outsideDedicatedEmails",
  "displayEmail",
  "directPhoneIdentifier",
  "displayPhoneNumber",
	"voiceMessageId",
  "campaignId",
  "reportingDisplayName",
  "path",
  "created_at",
  "updated_at",
	"metadata",
	"endDate",
	"endDateSetOn"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
    "id",
    "name",
    "displayName",
    "description",
    "sourceId",
    "directEmailIdentifier",
    "outsideDedicatedEmails",
    "displayEmail",
    "directPhoneIdentifier",
    "displayPhoneNumber",
		"voiceMessageId",
    "campaignId",
    "reportingDisplayName",
    "path",
    "created_at",
    "updated_at",
		"metadata",
		"endDate",
		"endDateSetOn"

  FROM "srcDB"."srcSchema"."Programs"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."Programs") || ''''

) AS (
  "id" uuid,
  "name" varchar(255),
  "displayName" varchar(255),
  "description" varchar(255),
  "sourceId" uuid,
  "directEmailIdentifier" varchar(255),
  "outsideDedicatedEmails" text[],
  "displayEmail" varchar(255),
  "directPhoneIdentifier" varchar(255),
  "displayPhoneNumber" varchar(255),
	"voiceMessageId" uuid,
  "campaignId" uuid,
  "reportingDisplayName" text,
  "path" text,
  "created_at" timestamptz,
  "updated_at" timestamptz,
	"metadata" jsonb,
	"endDate" date,
	"endDateSetOn" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."Programs" (
  "id",
  "name",
  "displayName",
  "description",
  "sourceId",
  "directEmailIdentifier",
  "outsideDedicatedEmails",
  "displayEmail",
  "directPhoneIdentifier",
  "displayPhoneNumber",
	"voiceMessageId",
  "campaignId",
  "reportingDisplayName",
  "path",
  "created_at",
  "updated_at",
	"metadata",
	"endDate",
	"endDateSetOn"
)
SELECT
  "id",
  "name",
  "displayName",
  "description",
  "sourceId",
  "directEmailIdentifier",
  "outsideDedicatedEmails",
  "displayEmail",
  "directPhoneIdentifier",
  "displayPhoneNumber",
	"voiceMessageId",
  "campaignId",
  "reportingDisplayName",
  "path",
  "created_at",
  "updated_at",
	"metadata",
	"endDate",
	"endDateSetOn"
FROM 	"tmpNormDB"."tmpNormSchema"."t_Programs"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "name" = EXCLUDED."name",
    "displayName" = EXCLUDED."displayName",
    "description" = EXCLUDED."description",
    "sourceId" = EXCLUDED."sourceId",
    "directEmailIdentifier" = EXCLUDED."directEmailIdentifier",
    "outsideDedicatedEmails" = EXCLUDED."outsideDedicatedEmails",
    "displayEmail" = EXCLUDED."displayEmail",
    "directPhoneIdentifier" = EXCLUDED."directPhoneIdentifier",
    "displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
		"voiceMessageId" = EXCLUDED."voiceMessageId",
		"campaignId" = EXCLUDED."campaignId",
		"reportingDisplayName" = EXCLUDED."reportingDisplayName",
		"path" = EXCLUDED."path",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at",
		"metadata" = EXCLUDED."metadata",
		"endDate" = EXCLUDED."endDate",
		"endDateSetOn" = EXCLUDED."endDateSetOn";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamPropertyProgram";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamPropertyProgram" (
	"id",
  "teamId",
  "propertyId",
  "programId",
  "commDirection",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
		"id",
    "teamId",
    "propertyId",
    "programId",
    "commDirection",
    "created_at",
    "updated_at"

  FROM "srcDB"."srcSchema"."TeamPropertyProgram"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamPropertyProgram") || ''''

) AS (
	"id" uuid,
  "teamId" uuid,
  "propertyId" uuid,
  "programId" uuid,
  "commDirection" varchar(255),
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamPropertyProgram" (
	"id",
  "teamId",
  "propertyId",
  "programId",
  "commDirection",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "teamId",
  "propertyId",
  "programId",
  "commDirection",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_TeamPropertyProgram"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"teamId" = EXCLUDED."teamId",
		"propertyId" = EXCLUDED."propertyId",
		"programId" = EXCLUDED."programId",
		"commDirection" = EXCLUDED."commDirection",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingContactData";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingContactData" (
	"id",
  "marketingSessionId",
  "contact",
	"programId",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
		"id",
    "marketingSessionId",
    "contact",
		"programId",
    "created_at",
    "updated_at"

  FROM "srcDB"."srcSchema"."MarketingContactData"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingContactData") || ''''

) AS (
	"id" uuid,
  "marketingSessionId" uuid,
  "contact" jsonb,
	"programId" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MarketingContactData" (
	"id",
  "marketingSessionId",
  "contact",
	"programId",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "marketingSessionId",
  "contact",
	"programId",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingContactData"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"marketingSessionId" = EXCLUDED."marketingSessionId",
		"contact" = EXCLUDED."contact",
		"programId" = EXCLUDED."programId",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";


TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_MarketingContactHistory";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_MarketingContactHistory" (
	"id",
  "marketingSessionId",
  "requestData",
  "marketingSessionResolution",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	"id",
  "marketingSessionId",
  "requestData",
  "marketingSessionResolution",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."MarketingContactHistory"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."MarketingContactHistory") || ''''

) AS (
	"id" uuid,
  "marketingSessionId" uuid,
  "requestData" jsonb,
  "marketingSessionResolution" varchar(255),
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."MarketingContactHistory" (
	"id",
  "marketingSessionId",
  "requestData",
  "marketingSessionResolution",
  "created_at",
  "updated_at"
)
SELECT
	"id",
  "marketingSessionId",
  "requestData",
  "marketingSessionResolution",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_MarketingContactHistory"
ON CONFLICT ("id")
  DO UPDATE
  SET
		"id" = EXCLUDED."id",
		"marketingSessionId" = EXCLUDED."marketingSessionId",
		"requestData" = EXCLUDED."requestData",
		"marketingSessionResolution" = EXCLUDED."marketingSessionResolution",
		"created_at" = EXCLUDED."created_at",
		"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PostMonthLog";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PostMonthLog" (
  "id",
  "propertyId",
	"postMonth",
	"startDate",
	"endDate",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	  "id",
		"propertyId",
		"postMonth",
		"startDate",
		"endDate",
		"created_at",
		"updated_at"
  FROM "srcDB"."srcSchema"."PostMonthLog"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PostMonthLog") || ''''

) AS (
  "id" uuid,
  "propertyId" uuid,
  "postMonth" date,
  "startDate" timestamptz,
  "endDate" timestamptz,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PostMonthLog" (
  "id",
  "propertyId",
	"postMonth",
	"startDate",
	"endDate",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "propertyId",
	"postMonth",
	"startDate",
	"endDate",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_PostMonthLog"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "propertyId" = EXCLUDED."propertyId",
    "postMonth" = EXCLUDED."postMonth",
    "startDate" = EXCLUDED."startDate",
    "endDate" = EXCLUDED."endDate",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PropertyCloseSchedule";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PropertyCloseSchedule" (
  "id",
  "propertyId",
	"month",
	"year",
	"rollForwardDate",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	  "id",
		"propertyId",
		"month",
		"year",
		"rollForwardDate",
		"created_at",
		"updated_at"
  FROM "srcDB"."srcSchema"."PropertyCloseSchedule"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."PropertyCloseSchedule") || ''''

) AS (
  "id" uuid,
  "propertyId" uuid,
  "month" varchar(255),
  "year" varchar(255),
  "rollForwardDate" date,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."PropertyCloseSchedule" (
  "id",
  "propertyId",
	"month",
	"year",
	"rollForwardDate",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "propertyId",
	"month",
	"year",
	"rollForwardDate",
  "created_at",
  "updated_at"
FROM 	"tmpNormDB"."tmpNormSchema"."t_PropertyCloseSchedule"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "propertyId" = EXCLUDED."propertyId",
    "month" = EXCLUDED."month",
    "year" = EXCLUDED."year",
    "rollForwardDate" = EXCLUDED."rollForwardDate",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_CallDetails";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_CallDetails" (
  "id",
  "commId",
  "details",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "commId",
  "details",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."CallDetails"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."CallDetails") || ''''

) AS (
  "id" uuid,
  "commId" uuid,
  "details" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."CallDetails" (
  "id",
  "commId",
  "details",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "commId",
  "details",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_CallDetails"
ON CONFLICT ("commId")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "details" = EXCLUDED."details",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ExternalPartyMemberInfo";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ExternalPartyMemberInfo" (
  "id",
  "created_at",
  "updated_at",
  "partyId",
  "partyMemberId",
	"childId",
	"leaseId",
	"startDate",
	"endDate",
	"externalId",
	"externalProspectId",
	"externalRoommateId",
	"isPrimary",
	"metadata",
  "propertyId"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
	  "id",
		"created_at",
		"updated_at",
		"partyId",
		"partyMemberId",
		"childId",
		"leaseId",
		"startDate",
		"endDate",
		"externalId",
		"externalProspectId",
		"externalRoommateId",
		"isPrimary",
		"metadata",
    "propertyId"
  FROM "srcDB"."srcSchema"."ExternalPartyMemberInfo"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ExternalPartyMemberInfo") || ''''

) AS (
  "id" uuid,
	"created_at" timestamptz,
	"updated_at" timestamptz,
	"partyId" uuid,
	"partyMemberId" uuid,
	"childId" uuid,
	"leaseId" uuid,
	"startDate" timestamptz,
	"endDate" timestamptz,
	"externalId" varchar(255),
	"externalProspectId" varchar(255),
	"externalRoommateId" varchar(255),
	"isPrimary" bool,
	"metadata" jsonb,
  "propertyId" uuid
);

INSERT INTO "dstNormDB"."dstNormSchema"."ExternalPartyMemberInfo" (
  "id",
  "created_at",
  "updated_at",
  "partyId",
  "partyMemberId",
	"childId",
	"leaseId",
	"startDate",
	"endDate",
	"externalId",
	"externalProspectId",
	"externalRoommateId",
	"isPrimary",
	"metadata",
  "propertyId"
)
SELECT
  "id",
  "created_at",
  "updated_at",
  "partyId",
  "partyMemberId",
	"childId",
	"leaseId",
	"startDate",
	"endDate",
	"externalId",
	"externalProspectId",
	"externalRoommateId",
	"isPrimary",
	"metadata",
  "propertyId"
FROM  "tmpNormDB"."tmpNormSchema"."t_ExternalPartyMemberInfo"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "externalId" = EXCLUDED."externalId",
		"externalProspectId" = EXCLUDED."externalProspectId",
		"externalRoommateId" = EXCLUDED."externalRoommateId",
		"isPrimary" = EXCLUDED."isPrimary",
		"metadata" = EXCLUDED."metadata",
		"endDate" = EXCLUDED."endDate",
    "propertyId" = EXCLUDED."propertyId",
		"created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_CommsTemplate";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_CommsTemplate" (
  "id",
  "name",
  "displayName",
  "description",
  "emailSubject",
  "emailTemplate",
  "smsTemplate",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "name",
  "displayName",
  "description",
  "emailSubject",
  "emailTemplate",
  "smsTemplate",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."CommsTemplate"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."CommsTemplate") || ''''

) AS (
  "id" uuid,
  "name" varchar(255),
  "displayName" varchar(255),
  "description" text,
  "emailSubject" text,
  "emailTemplate" text,
  "smsTemplate" text,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."CommsTemplate" (
  "id",
  "name",
  "displayName",
  "description",
  "emailSubject",
  "emailTemplate",
  "smsTemplate",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "name",
  "displayName",
  "description",
  "emailSubject",
  "emailTemplate",
  "smsTemplate",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_CommsTemplate"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "name" = EXCLUDED."name",
    "displayName" = EXCLUDED."displayName",
    "description" = EXCLUDED."description",
    "emailSubject" = EXCLUDED."emailSubject",
    "emailTemplate" = EXCLUDED."emailTemplate",
    "smsTemplate" = EXCLUDED."smsTemplate",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TemplateShortCode";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TemplateShortCode" (
  "id",
  "propertyId",
  "shortCode",
  "templateId",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "propertyId",
  "shortCode",
  "templateId",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."TemplateShortCode"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TemplateShortCode") || ''''

) AS (
  "id" uuid,
  "propertyId" uuid,
  "shortCode" varchar(255),
  "templateId" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TemplateShortCode" (
  "id",
  "propertyId",
  "shortCode",
  "templateId",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "propertyId",
  "shortCode",
  "templateId",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_TemplateShortCode"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "propertyId" = EXCLUDED."propertyId",
    "shortCode" = EXCLUDED."shortCode",
    "templateId" = EXCLUDED."templateId",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ScreeningCriteria";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ScreeningCriteria" (
  "id",
	"name",
	"monthlyResidentIncomeDebtMultiple",
	"monthlyGuarantorIncomeDebtMultiple",
	"monthlyResidentIncomeMultiple",
	"monthlyGuarantorIncomeMultiple",
	"excessiveIssuesCount",
	"hasGroupResidentIncomes",
	"hasGroupGuarantorIncomes",
	"hasGroupResidentCreditScores",
	"hasGroupGuarantorCreditScores",
	"fullLeaseLiquidAssetMultiple",
	"approvedResidentCreditScore",
	"declinedResidentCreditScore",
	"approvedGuarantorCreditScore",
	"declinedGuarantorCreditScore",
	"defaultResidentCreditScore",
	"defaultGuarantorCreditScore",
	"drugsFelony",
	"drugsMisdemeanor",
	"duiFelony",
	"duiMisdemeanor",
	"unclassifiedFelony",
	"unclassifiedMisdemeanor",
	"propertyFelony",
	"propertyMisdemeanor",
	"sexFelony",
	"sexMisdemeanor",
	"theftFelony",
	"theftMisdemeanor",
	"theftByCheckFelony",
	"theftByCheckMisdemeanor",
	"trafficFelony",
	"trafficMisdemeanor",
	"violentCrimeFelony",
	"violentCrimeMisdemeanor",
	"weaponsFelony",
	"weaponsMisdemeanor",
	"registeredSexOffender",
	"globalSanctions",
	"applicantsInsufficientIncome",
	"applicantsCreditScoreApproved",
	"applicantsCreditScoreDeclined",
	"applicantsCreditScoreBetween",
	"applicantsNoEstablishedCredit",
	"applicantsBankruptcy",
	"applicantsForeclosure",
	"applicantsLegalItem",
	"applicantsTaxLien",
	"applicantsPropertyDebt",
	"applicantsMortgageDebt",
	"applicantsUtilityDebt",
	"applicantsEvictionOrEvictionFiling",
	"applicantsExcessiveIssues",
	"applicantsSsnSuspicious",
	"guarantorsInsufficientIncome",
	"guarantorsCreditScoreApproved",
	"guarantorsCreditScoreDeclined",
	"guarantorsCreditScoreBetween",
	"guarantorsNoEstablishedCredit",
	"guarantorsBankruptcy",
	"guarantorsForeclosure",
	"guarantorsLegalItem",
	"guarantorsTaxLien",
	"guarantorsPropertyDebt",
	"guarantorsMortgageDebt",
	"guarantorsUtilityDebt",
	"guarantorsEvictionOrEvictionFiling",
	"guarantorsExcessiveIssues",
	"guarantorsSsnSuspicious",
	"created_at",
	"updated_at"
)
SELECT * FROM public.dblink('tenantName',
	'SELECT
  "id",
	"name",
	"monthlyResidentIncomeDebtMultiple",
	"monthlyGuarantorIncomeDebtMultiple",
	"monthlyResidentIncomeMultiple",
	"monthlyGuarantorIncomeMultiple",
	"excessiveIssuesCount",
	"hasGroupResidentIncomes",
	"hasGroupGuarantorIncomes",
	"hasGroupResidentCreditScores",
	"hasGroupGuarantorCreditScores",
	"fullLeaseLiquidAssetMultiple",
	"approvedResidentCreditScore",
	"declinedResidentCreditScore",
	"approvedGuarantorCreditScore",
	"declinedGuarantorCreditScore",
	"defaultResidentCreditScore",
	"defaultGuarantorCreditScore",
	"drugsFelony",
	"drugsMisdemeanor",
	"duiFelony",
	"duiMisdemeanor",
	"unclassifiedFelony",
	"unclassifiedMisdemeanor",
	"propertyFelony",
	"propertyMisdemeanor",
	"sexFelony",
	"sexMisdemeanor",
	"theftFelony",
	"theftMisdemeanor",
	"theftByCheckFelony",
	"theftByCheckMisdemeanor",
	"trafficFelony",
	"trafficMisdemeanor",
	"violentCrimeFelony",
	"violentCrimeMisdemeanor",
	"weaponsFelony",
	"weaponsMisdemeanor",
	"registeredSexOffender",
	"globalSanctions",
	"applicantsInsufficientIncome",
	"applicantsCreditScoreApproved",
	"applicantsCreditScoreDeclined",
	"applicantsCreditScoreBetween",
	"applicantsNoEstablishedCredit",
	"applicantsBankruptcy",
	"applicantsForeclosure",
	"applicantsLegalItem",
	"applicantsTaxLien",
	"applicantsPropertyDebt",
	"applicantsMortgageDebt",
	"applicantsUtilityDebt",
	"applicantsEvictionOrEvictionFiling",
	"applicantsExcessiveIssues",
	"applicantsSsnSuspicious",
	"guarantorsInsufficientIncome",
	"guarantorsCreditScoreApproved",
	"guarantorsCreditScoreDeclined",
	"guarantorsCreditScoreBetween",
	"guarantorsNoEstablishedCredit",
	"guarantorsBankruptcy",
	"guarantorsForeclosure",
	"guarantorsLegalItem",
	"guarantorsTaxLien",
	"guarantorsPropertyDebt",
	"guarantorsMortgageDebt",
	"guarantorsUtilityDebt",
	"guarantorsEvictionOrEvictionFiling",
	"guarantorsExcessiveIssues",
	"guarantorsSsnSuspicious",
	"created_at",
	"updated_at"

  FROM "srcDB"."srcSchema"."ScreeningCriteria"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ScreeningCriteria") || ''''
) AS (
	"id" uuid,
	"name" varchar(50),
	"monthlyResidentIncomeDebtMultiple" numeric,
	"monthlyGuarantorIncomeDebtMultiple" numeric,
	"monthlyResidentIncomeMultiple" numeric,
	"monthlyGuarantorIncomeMultiple" numeric,
	"excessiveIssuesCount" numeric,
	"hasGroupResidentIncomes" boolean,
	"hasGroupGuarantorIncomes" boolean,
	"hasGroupResidentCreditScores" boolean,
	"hasGroupGuarantorCreditScores" boolean,
	"fullLeaseLiquidAssetMultiple" numeric,
	"approvedResidentCreditScore" numeric,
	"declinedResidentCreditScore" numeric,
	"approvedGuarantorCreditScore" numeric,
	"declinedGuarantorCreditScore" numeric,
	"defaultResidentCreditScore" numeric,
	"defaultGuarantorCreditScore" numeric,
	"drugsFelony" varchar(50),
	"drugsMisdemeanor" varchar(50),
	"duiFelony" varchar(50),
	"duiMisdemeanor" varchar(50),
	"unclassifiedFelony" varchar(50),
	"unclassifiedMisdemeanor" varchar(50),
	"propertyFelony" varchar(50),
	"propertyMisdemeanor" varchar(50),
	"sexFelony" varchar(50),
	"sexMisdemeanor" varchar(50),
	"theftFelony" varchar(50),
	"theftMisdemeanor" varchar(50),
	"theftByCheckFelony" varchar(50),
	"theftByCheckMisdemeanor" varchar(50),
	"trafficFelony" varchar(50),
	"trafficMisdemeanor" varchar(50),
	"violentCrimeFelony" varchar(50),
	"violentCrimeMisdemeanor" varchar(50),
	"weaponsFelony" varchar(50),
	"weaponsMisdemeanor" varchar(50),
	"registeredSexOffender" varchar(50),
	"globalSanctions" varchar(50),
	"applicantsInsufficientIncome" varchar(50),
	"applicantsCreditScoreApproved" varchar(50),
	"applicantsCreditScoreDeclined" varchar(50),
	"applicantsCreditScoreBetween" varchar(50),
	"applicantsNoEstablishedCredit" varchar(50),
	"applicantsBankruptcy" varchar(50),
	"applicantsForeclosure" varchar(50),
	"applicantsLegalItem" varchar(50),
	"applicantsTaxLien" varchar(50),
	"applicantsPropertyDebt" varchar(50),
	"applicantsMortgageDebt" varchar(50),
	"applicantsUtilityDebt" varchar(50),
	"applicantsEvictionOrEvictionFiling" varchar(50),
	"applicantsExcessiveIssues" varchar(50),
	"applicantsSsnSuspicious" varchar(50),
	"guarantorsInsufficientIncome" varchar(50),
	"guarantorsCreditScoreApproved" varchar(50),
	"guarantorsCreditScoreDeclined" varchar(50),
	"guarantorsCreditScoreBetween" varchar(50),
	"guarantorsNoEstablishedCredit" varchar(50),
	"guarantorsBankruptcy" varchar(50),
	"guarantorsForeclosure" varchar(50),
	"guarantorsLegalItem" varchar(50),
	"guarantorsTaxLien" varchar(50),
	"guarantorsPropertyDebt" varchar(50),
	"guarantorsMortgageDebt" varchar(50),
	"guarantorsUtilityDebt" varchar(50),
	"guarantorsEvictionOrEvictionFiling" varchar(50),
	"guarantorsExcessiveIssues" varchar(50),
	"guarantorsSsnSuspicious" varchar(50),
	"created_at" timestamptz,
	"updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ScreeningCriteria" (
  "id",
	"name",
	"monthlyResidentIncomeDebtMultiple",
	"monthlyGuarantorIncomeDebtMultiple",
	"monthlyResidentIncomeMultiple",
	"monthlyGuarantorIncomeMultiple",
	"excessiveIssuesCount",
	"hasGroupResidentIncomes",
	"hasGroupGuarantorIncomes",
	"hasGroupResidentCreditScores",
	"hasGroupGuarantorCreditScores",
	"fullLeaseLiquidAssetMultiple",
	"approvedResidentCreditScore",
	"declinedResidentCreditScore",
	"approvedGuarantorCreditScore",
	"declinedGuarantorCreditScore",
	"defaultResidentCreditScore",
	"defaultGuarantorCreditScore",
	"drugsFelony",
	"drugsMisdemeanor",
	"duiFelony",
	"duiMisdemeanor",
	"unclassifiedFelony",
	"unclassifiedMisdemeanor",
	"propertyFelony",
	"propertyMisdemeanor",
	"sexFelony",
	"sexMisdemeanor",
	"theftFelony",
	"theftMisdemeanor",
	"theftByCheckFelony",
	"theftByCheckMisdemeanor",
	"trafficFelony",
	"trafficMisdemeanor",
	"violentCrimeFelony",
	"violentCrimeMisdemeanor",
	"weaponsFelony",
	"weaponsMisdemeanor",
	"registeredSexOffender",
	"globalSanctions",
	"applicantsInsufficientIncome",
	"applicantsCreditScoreApproved",
	"applicantsCreditScoreDeclined",
	"applicantsCreditScoreBetween",
	"applicantsNoEstablishedCredit",
	"applicantsBankruptcy",
	"applicantsForeclosure",
	"applicantsLegalItem",
	"applicantsTaxLien",
	"applicantsPropertyDebt",
	"applicantsMortgageDebt",
	"applicantsUtilityDebt",
	"applicantsEvictionOrEvictionFiling",
	"applicantsExcessiveIssues",
	"applicantsSsnSuspicious",
	"guarantorsInsufficientIncome",
	"guarantorsCreditScoreApproved",
	"guarantorsCreditScoreDeclined",
	"guarantorsCreditScoreBetween",
	"guarantorsNoEstablishedCredit",
	"guarantorsBankruptcy",
	"guarantorsForeclosure",
	"guarantorsLegalItem",
	"guarantorsTaxLien",
	"guarantorsPropertyDebt",
	"guarantorsMortgageDebt",
	"guarantorsUtilityDebt",
	"guarantorsEvictionOrEvictionFiling",
	"guarantorsExcessiveIssues",
	"guarantorsSsnSuspicious",
	"created_at",
	"updated_at"
)
SELECT
  "id",
	"name",
	"monthlyResidentIncomeDebtMultiple",
	"monthlyGuarantorIncomeDebtMultiple",
	"monthlyResidentIncomeMultiple",
	"monthlyGuarantorIncomeMultiple",
	"excessiveIssuesCount",
	"hasGroupResidentIncomes",
	"hasGroupGuarantorIncomes",
	"hasGroupResidentCreditScores",
	"hasGroupGuarantorCreditScores",
	"fullLeaseLiquidAssetMultiple",
	"approvedResidentCreditScore",
	"declinedResidentCreditScore",
	"approvedGuarantorCreditScore",
	"declinedGuarantorCreditScore",
	"defaultResidentCreditScore",
	"defaultGuarantorCreditScore",
	"drugsFelony",
	"drugsMisdemeanor",
	"duiFelony",
	"duiMisdemeanor",
	"unclassifiedFelony",
	"unclassifiedMisdemeanor",
	"propertyFelony",
	"propertyMisdemeanor",
	"sexFelony",
	"sexMisdemeanor",
	"theftFelony",
	"theftMisdemeanor",
	"theftByCheckFelony",
	"theftByCheckMisdemeanor",
	"trafficFelony",
	"trafficMisdemeanor",
	"violentCrimeFelony",
	"violentCrimeMisdemeanor",
	"weaponsFelony",
	"weaponsMisdemeanor",
	"registeredSexOffender",
	"globalSanctions",
	"applicantsInsufficientIncome",
	"applicantsCreditScoreApproved",
	"applicantsCreditScoreDeclined",
	"applicantsCreditScoreBetween",
	"applicantsNoEstablishedCredit",
	"applicantsBankruptcy",
	"applicantsForeclosure",
	"applicantsLegalItem",
	"applicantsTaxLien",
	"applicantsPropertyDebt",
	"applicantsMortgageDebt",
	"applicantsUtilityDebt",
	"applicantsEvictionOrEvictionFiling",
	"applicantsExcessiveIssues",
	"applicantsSsnSuspicious",
	"guarantorsInsufficientIncome",
	"guarantorsCreditScoreApproved",
	"guarantorsCreditScoreDeclined",
	"guarantorsCreditScoreBetween",
	"guarantorsNoEstablishedCredit",
	"guarantorsBankruptcy",
	"guarantorsForeclosure",
	"guarantorsLegalItem",
	"guarantorsTaxLien",
	"guarantorsPropertyDebt",
	"guarantorsMortgageDebt",
	"guarantorsUtilityDebt",
	"guarantorsEvictionOrEvictionFiling",
	"guarantorsExcessiveIssues",
	"guarantorsSsnSuspicious",
	"created_at",
	"updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_ScreeningCriteria"
ON CONFLICT ("id")
  DO UPDATE
  SET
		  "id" = EXCLUDED."id",
			"name" = EXCLUDED."name",
			"monthlyResidentIncomeDebtMultiple" = EXCLUDED."monthlyResidentIncomeDebtMultiple",
			"monthlyGuarantorIncomeDebtMultiple" = EXCLUDED."monthlyGuarantorIncomeDebtMultiple",
			"monthlyResidentIncomeMultiple" = EXCLUDED."monthlyResidentIncomeMultiple",
			"monthlyGuarantorIncomeMultiple" = EXCLUDED."monthlyGuarantorIncomeMultiple",
			"excessiveIssuesCount" = EXCLUDED."excessiveIssuesCount",
			"hasGroupResidentIncomes" = EXCLUDED."hasGroupResidentIncomes",
			"hasGroupGuarantorIncomes" = EXCLUDED."hasGroupGuarantorIncomes",
			"hasGroupResidentCreditScores" = EXCLUDED."hasGroupResidentCreditScores",
			"hasGroupGuarantorCreditScores" = EXCLUDED."hasGroupGuarantorCreditScores",
			"fullLeaseLiquidAssetMultiple" = EXCLUDED."fullLeaseLiquidAssetMultiple",
			"approvedResidentCreditScore" = EXCLUDED."approvedResidentCreditScore",
			"declinedResidentCreditScore" = EXCLUDED."declinedResidentCreditScore",
			"approvedGuarantorCreditScore" = EXCLUDED."approvedGuarantorCreditScore",
			"declinedGuarantorCreditScore" = EXCLUDED."declinedGuarantorCreditScore",
			"defaultResidentCreditScore" = EXCLUDED."defaultResidentCreditScore",
			"defaultGuarantorCreditScore" = EXCLUDED."defaultGuarantorCreditScore",
			"drugsFelony" = EXCLUDED."drugsFelony",
			"drugsMisdemeanor" = EXCLUDED."drugsMisdemeanor",
			"duiFelony" = EXCLUDED."duiFelony",
			"duiMisdemeanor" = EXCLUDED."duiMisdemeanor",
			"unclassifiedFelony" = EXCLUDED."unclassifiedFelony",
			"unclassifiedMisdemeanor" = EXCLUDED."unclassifiedMisdemeanor",
			"propertyFelony" = EXCLUDED."propertyFelony",
			"propertyMisdemeanor" = EXCLUDED."propertyMisdemeanor",
			"sexFelony" = EXCLUDED."sexFelony",
			"sexMisdemeanor" = EXCLUDED."sexMisdemeanor",
			"theftFelony" = EXCLUDED."theftFelony",
			"theftMisdemeanor" = EXCLUDED."theftMisdemeanor",
			"theftByCheckFelony" = EXCLUDED."theftByCheckFelony",
			"theftByCheckMisdemeanor" = EXCLUDED."theftByCheckMisdemeanor",
			"trafficFelony" = EXCLUDED."trafficFelony",
			"trafficMisdemeanor" = EXCLUDED."trafficMisdemeanor",
			"violentCrimeFelony" = EXCLUDED."violentCrimeFelony",
			"violentCrimeMisdemeanor" = EXCLUDED."violentCrimeMisdemeanor",
			"weaponsFelony" = EXCLUDED."weaponsFelony",
			"weaponsMisdemeanor" = EXCLUDED."weaponsMisdemeanor",
			"registeredSexOffender" = EXCLUDED."registeredSexOffender",
			"globalSanctions" = EXCLUDED."globalSanctions",
			"applicantsInsufficientIncome" = EXCLUDED."applicantsInsufficientIncome",
			"applicantsCreditScoreApproved" = EXCLUDED."applicantsCreditScoreApproved",
			"applicantsCreditScoreDeclined" = EXCLUDED."applicantsCreditScoreDeclined",
			"applicantsCreditScoreBetween" = EXCLUDED."applicantsCreditScoreBetween",
			"applicantsNoEstablishedCredit" = EXCLUDED."applicantsNoEstablishedCredit",
			"applicantsBankruptcy" = EXCLUDED."applicantsBankruptcy",
			"applicantsForeclosure" = EXCLUDED."applicantsForeclosure",
			"applicantsLegalItem" = EXCLUDED."applicantsLegalItem",
			"applicantsTaxLien" = EXCLUDED."applicantsTaxLien",
			"applicantsPropertyDebt" = EXCLUDED."applicantsPropertyDebt",
			"applicantsMortgageDebt" = EXCLUDED."applicantsMortgageDebt",
			"applicantsUtilityDebt" = EXCLUDED."applicantsUtilityDebt",
			"applicantsEvictionOrEvictionFiling" = EXCLUDED."applicantsEvictionOrEvictionFiling",
			"applicantsExcessiveIssues" = EXCLUDED."applicantsExcessiveIssues",
			"applicantsSsnSuspicious" = EXCLUDED."applicantsSsnSuspicious",
			"guarantorsInsufficientIncome" = EXCLUDED."guarantorsInsufficientIncome",
			"guarantorsCreditScoreApproved" = EXCLUDED."guarantorsCreditScoreApproved",
			"guarantorsCreditScoreDeclined" = EXCLUDED."guarantorsCreditScoreDeclined",
			"guarantorsCreditScoreBetween" = EXCLUDED."guarantorsCreditScoreBetween",
			"guarantorsNoEstablishedCredit" = EXCLUDED."guarantorsNoEstablishedCredit",
			"guarantorsBankruptcy" = EXCLUDED."guarantorsBankruptcy",
			"guarantorsForeclosure" = EXCLUDED."guarantorsForeclosure",
			"guarantorsLegalItem" = EXCLUDED."guarantorsLegalItem",
			"guarantorsTaxLien" = EXCLUDED."guarantorsTaxLien",
			"guarantorsPropertyDebt" = EXCLUDED."guarantorsPropertyDebt",
			"guarantorsMortgageDebt" = EXCLUDED."guarantorsMortgageDebt",
			"guarantorsUtilityDebt" = EXCLUDED."guarantorsUtilityDebt",
			"guarantorsEvictionOrEvictionFiling" = EXCLUDED."guarantorsEvictionOrEvictionFiling",
			"guarantorsExcessiveIssues" = EXCLUDED."guarantorsExcessiveIssues",
			"guarantorsSsnSuspicious" = EXCLUDED."guarantorsSsnSuspicious",
			"created_at" = EXCLUDED."created_at",
			"updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_PropertyPartySettings";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_PropertyPartySettings" (
  "id",
  "propertyId",
  "screeningCriteriaId",
  "partyType",
	"inactive"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "propertyId",
  "screeningCriteriaId",
  "partyType",
	"inactive"

  FROM "srcDB"."srcSchema"."PropertyPartySettings"'
) AS (
	"id" uuid,
	"propertyId" uuid,
	"screeningCriteriaId" uuid,
	"partyType" varchar(50),
	"inactive" boolean
);

INSERT INTO "dstNormDB"."dstNormSchema"."PropertyPartySettings" (
  "id",
  "propertyId",
  "screeningCriteriaId",
  "partyType",
	"inactive"
)
SELECT
  "id",
  "propertyId",
  "screeningCriteriaId",
  "partyType",
	"inactive"
FROM  "tmpNormDB"."tmpNormSchema"."t_PropertyPartySettings"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "propertyId" = EXCLUDED."propertyId",
    "screeningCriteriaId" = EXCLUDED."screeningCriteriaId",
    "partyType" = EXCLUDED."partyType",
    "inactive" = EXCLUDED."inactive";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_UserCalendarEvents";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_UserCalendarEvents" (
  "id",
  "userId",
  "startDate",
  "endDate",
	"source",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "userId",
  "startDate",
  "endDate",
	"source",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."UserCalendarEvents"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."UserCalendarEvents") || ''''

) AS (
  "id" uuid,
  "userId" uuid,
  "startDate" timestamptz,
  "endDate" timestamptz,
	"source" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."UserCalendarEvents" (
  "id",
  "userId",
  "startDate",
  "endDate",
	"source",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "userId",
  "startDate",
  "endDate",
	"source",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_UserCalendarEvents"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "userId" = EXCLUDED."userId",
    "startDate" = EXCLUDED."startDate",
    "endDate" = EXCLUDED."endDate",
		"source" = EXCLUDED."source",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_TeamCalendarEvents";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_TeamCalendarEvents" (
  "id",
  "teamId",
  "startDate",
  "endDate",
	"externalId",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "teamId",
  "startDate",
  "endDate",
	"externalId",
  "created_at",
  "updated_at"

  FROM "srcDB"."srcSchema"."TeamCalendarEvents"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."TeamCalendarEvents") || ''''

) AS (
  "id" uuid,
  "teamId" uuid,
  "startDate" timestamptz,
  "endDate" timestamptz,
	"externalId" varchar(50),
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."TeamCalendarEvents" (
  "id",
  "teamId",
  "startDate",
  "endDate",
	"externalId",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "teamId",
  "startDate",
  "endDate",
	"externalId",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_TeamCalendarEvents"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "teamId" = EXCLUDED."teamId",
    "startDate" = EXCLUDED."startDate",
    "endDate" = EXCLUDED."endDate",
		"externalId" = EXCLUDED."externalId",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ApplicantData";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ApplicantData" (
  "id",
  "personId",
  "propertyId",
  "applicationData",
	"applicationDataTimestamps",
  "applicationDataDiff",
  "startDate",
  "endDate",
	"validUntil",
  "updatedByUserId",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "personId",
  "propertyId",
  "applicationData",
	"applicationDataTimestamps",
  "applicationDataDiff",
  "startDate",
  "endDate",
	"validUntil",
  "updatedByUserId",
  "created_at",
  "updated_at"
  FROM "srcDB"."srcSchema"."ApplicantData"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ApplicantData") || ''''

) AS (
  "id" uuid,
  "personId" uuid,
  "propertyId" uuid,
  "applicationData" jsonb,
	"applicationDataTimestamps" jsonb,
  "applicationDataDiff" jsonb,
  "startDate" timestamptz,
  "endDate" timestamptz,
	"validUntil" timestamptz,
  "updatedByUserId" uuid,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ApplicantData" (
  "id",
  "personId",
  "propertyId",
  "applicationData",
	"applicationDataTimestamps",
  "applicationDataDiff",
  "startDate",
  "endDate",
	"validUntil",
  "updatedByUserId",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "personId",
  "propertyId",
  "applicationData",
	"applicationDataTimestamps",
  "applicationDataDiff",
  "startDate",
  "endDate",
	"validUntil",
  "updatedByUserId",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_ApplicantData"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "personId" = EXCLUDED."personId",
    "propertyId" = EXCLUDED."propertyId",
    "applicationData" = EXCLUDED."applicationData",
    "applicationDataTimestamps" = EXCLUDED."applicationDataTimestamps",
    "applicationDataDiff" = EXCLUDED."applicationDataDiff",
    "startDate" = EXCLUDED."startDate",
    "endDate" = EXCLUDED."endDate",
    "validUntil" = EXCLUDED."validUntil",
    "updatedByUserId" = EXCLUDED."updatedByUserId",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ApplicantReport";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ApplicantReport" (
  "id",
  "personId",
  "reportName",
  "applicantDataId",
	"status",
  "serviceStatus",
  "completedAt",
  "mergedAt",
	"validUntil",
  "obsoletedBy",
  "creditBureau",
  "isAlerted",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "personId",
  "reportName",
  "applicantDataId",
	"status",
  "serviceStatus",
  "completedAt",
  "mergedAt",
	"validUntil",
  "obsoletedBy",
  "creditBureau",
  "isAlerted",
  "created_at",
  "updated_at"
  FROM "srcDB"."srcSchema"."ApplicantReport"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ApplicantReport") || ''''

) AS (
  "id" uuid,
  "personId" uuid,
  "reportName" varchar(255),
  "applicantDataId" uuid,
	"status" varchar(255),
  "serviceStatus" jsonb,
  "completedAt" timestamptz,
  "mergedAt" timestamptz,
	"validUntil" timestamptz,
  "obsoletedBy" uuid,
  "creditBureau" varchar(255),
  "isAlerted" bool,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ApplicantReport" (
  "id",
  "personId",
  "reportName",
  "applicantDataId",
	"status",
  "serviceStatus",
  "completedAt",
  "mergedAt",
	"validUntil",
  "obsoletedBy",
  "creditBureau",
  "isAlerted",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "personId",
  "reportName",
  "applicantDataId",
	"status",
  "serviceStatus",
  "completedAt",
  "mergedAt",
	"validUntil",
  "obsoletedBy",
  "creditBureau",
  "isAlerted",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_ApplicantReport"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "personId" = EXCLUDED."personId",
    "reportName" = EXCLUDED."reportName",
    "applicantDataId" = EXCLUDED."applicantDataId",
    "status" = EXCLUDED."status",
    "serviceStatus" = EXCLUDED."serviceStatus",
    "completedAt" = EXCLUDED."completedAt",
    "mergedAt" = EXCLUDED."mergedAt",
    "validUntil" = EXCLUDED."validUntil",
    "obsoletedBy" = EXCLUDED."obsoletedBy",
    "creditBureau" = EXCLUDED."creditBureau",
    "isAlerted" = EXCLUDED."isAlerted",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ApplicantReportRequestTracking";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ApplicantReportRequestTracking" (
  "id",
  "applicantReportId",
  "personId",
  "reportName",
  "requestApplicantId",
  "propertyId",
  "requestType",
  "forcedNew",
  "externalReportId",
  "isAlerted",
  "isObsolete",
  "requestEndedAt",
  "hasTimedOut",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "applicantReportId",
  "personId",
  "reportName",
  "requestApplicantId",
  "propertyId",
  "requestType",
  "forcedNew",
  "externalReportId",
  "isAlerted",
  "isObsolete",
  "requestEndedAt",
  "hasTimedOut",
  "created_at",
  "updated_at"
  FROM "srcDB"."srcSchema"."ApplicantReportRequestTracking"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ApplicantReportRequestTracking") || ''''

) AS (
  "id" uuid,
  "applicantReportId" uuid,
  "personId" uuid,
  "reportName" varchar(255),
  "requestApplicantId" uuid,
  "propertyId" uuid,
  "requestType" varchar(255),
  "forcedNew" bool,
  "externalReportId" varchar(255),
  "isAlerted" bool,
  "isObsolete" bool,
  "requestEndedAt" timestamptz,
  "hasTimedOut" bool,
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ApplicantReportRequestTracking" (
  "id",
  "applicantReportId",
  "personId",
  "reportName",
  "requestApplicantId",
  "propertyId",
  "requestType",
  "forcedNew",
  "externalReportId",
  "isAlerted",
  "isObsolete",
  "requestEndedAt",
  "hasTimedOut",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "applicantReportId",
  "personId",
  "reportName",
  "requestApplicantId",
  "propertyId",
  "requestType",
  "forcedNew",
  "externalReportId",
  "isAlerted",
  "isObsolete",
  "requestEndedAt",
  "hasTimedOut",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_ApplicantReportRequestTracking"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "applicantReportId" = EXCLUDED."applicantReportId",
    "personId" = EXCLUDED."personId",
    "reportName" = EXCLUDED."reportName",
    "requestApplicantId" = EXCLUDED."requestApplicantId",
    "propertyId" = EXCLUDED."propertyId",
    "requestType" = EXCLUDED."requestType",
    "forcedNew" = EXCLUDED."forcedNew",
    "externalReportId" = EXCLUDED."externalReportId",
    "isAlerted" = EXCLUDED."isAlerted",
    "isObsolete" = EXCLUDED."isObsolete",
    "requestEndedAt" = EXCLUDED."requestEndedAt",
    "hasTimedOut" = EXCLUDED."hasTimedOut",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";
TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ApplicantReportResponseTracking";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ApplicantReportResponseTracking" (
  "id",
  "screeningRequestId",
  "status",
  "blockedReason",
  "serviceStatus",
  "serviceBlockedStatus",
  "origin",
  "created_at",
  "updated_at"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "screeningRequestId",
  "status",
  "blockedReason",
  "serviceStatus",
  "serviceBlockedStatus",
  "origin",
  "created_at",
  "updated_at"
  FROM "srcDB"."srcSchema"."ApplicantReportResponseTracking"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ApplicantReportResponseTracking") || ''''

) AS (
  "id" uuid,
  "screeningRequestId" uuid,
  "status" varchar(255),
  "blockedReason" varchar(255),
  "serviceStatus" jsonb,
  "serviceBlockedStatus" text,
  "origin" varchar(80),
  "created_at" timestamptz,
  "updated_at" timestamptz
);

INSERT INTO "dstNormDB"."dstNormSchema"."ApplicantReportResponseTracking" (
  "id",
  "screeningRequestId",
  "status",
  "blockedReason",
  "serviceStatus",
  "serviceBlockedStatus",
  "origin",
  "created_at",
  "updated_at"
)
SELECT
  "id",
  "screeningRequestId",
  "status",
  "blockedReason",
  "serviceStatus",
  "serviceBlockedStatus",
  "origin",
  "created_at",
  "updated_at"
FROM  "tmpNormDB"."tmpNormSchema"."t_ApplicantReportResponseTracking"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "screeningRequestId" = EXCLUDED."screeningRequestId",
    "status" = EXCLUDED."status",
    "blockedReason" = EXCLUDED."blockedReason",
    "serviceStatus" = EXCLUDED."serviceStatus",
    "serviceBlockedStatus" = EXCLUDED."serviceBlockedStatus",
    "origin" = EXCLUDED."origin",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at";

TRUNCATE TABLE "tmpNormDB"."tmpNormSchema"."t_ApplicantDataNotCommitted";

INSERT INTO "tmpNormDB"."tmpNormSchema"."t_ApplicantDataNotCommitted" (
  "id",
  "personId",
  "partyId",
  "partyApplicationId",
  "applicationData",
  "created_at",
  "updated_at",
  "paymentCompleted"
)
SELECT * FROM public.dblink('tenantName',
  'SELECT
  "id",
  "personId",
  "partyId",
  "partyApplicationId",
  "applicationData",
  "created_at",
  "updated_at",
  "paymentCompleted"
  FROM "srcDB"."srcSchema"."ApplicantDataNotCommitted"
  WHERE "updated_at"> ''' ||  (select COALESCE(max("updated_at"), '-infinity') FROM "dstNormDB"."dstNormSchema"."ApplicantDataNotCommitted") || ''''

) AS (
  "id" uuid,
  "personId" uuid,
  "partyId" uuid,
  "partyApplicationId" uuid,
  "applicationData" jsonb,
  "created_at" timestamptz,
  "updated_at" timestamptz,
  "paymentCompleted" bool
);

INSERT INTO "dstNormDB"."dstNormSchema"."ApplicantDataNotCommitted" (
  "id",
  "personId",
  "partyId",
  "partyApplicationId",
  "applicationData",
  "created_at",
  "updated_at",
  "paymentCompleted"
)
SELECT
  "id",
  "personId",
  "partyId",
  "partyApplicationId",
  "applicationData",
  "created_at",
  "updated_at",
  "paymentCompleted"
FROM  "tmpNormDB"."tmpNormSchema"."t_ApplicantDataNotCommitted"
ON CONFLICT ("id")
  DO UPDATE
  SET
    "id" = EXCLUDED."id",
    "personId" = EXCLUDED."personId",
    "partyId" = EXCLUDED."partyId",
    "partyApplicationId" = EXCLUDED."partyApplicationId",
    "applicationData" = EXCLUDED."applicationData",
    "created_at" = EXCLUDED."created_at",
    "updated_at" = EXCLUDED."updated_at",
    "paymentCompleted" = EXCLUDED."paymentCompleted";

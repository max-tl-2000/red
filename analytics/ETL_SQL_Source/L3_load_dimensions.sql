-- prepare for loading
UPDATE "dstStarDB"."dstStarSchema"."s_LastLoadDate"
	SET "needToLoad" = TRUE;

-- d_Property - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_Property"
(
	"propertyKey",
	"propertyId",
	"utcCreatedDate",
	"propertyName",
	"propertyLegalName",
	"propertyDisplayName",
	"propertyTimezone",
	"propertyStartDate",
	"propertyEndDate",
	"APN",
	"MSANumber",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"postalCode",
	"isSameStore"
)
SELECT
	-1 AS "propertyKey",
	'00000000-0000-0000-0000-000000000000' AS "propertyId",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "propertyName",
	'N/A' AS "propertyLegalName",
	'N/A' AS "propertyDisplayName",
	'Universal' AS "propertyTimezone",
	'1900-01-01 00:00:00' AS "propertyStartDate",
	'2999-12-31 00:00:00' AS "propertyEndDate",
	'N/A' AS "APN",
	-1 AS "MSANumber",
	'N/A' AS "addressLine1",
	'N/A' AS "addressLine2",
	'N/A' AS "city",
	'NA' AS "state",
	'N/A' AS "postalCode",
	'N/A' AS "isSameStore"
ON CONFLICT ("propertyKey")
DO UPDATE
	SET
		"propertyId" = EXCLUDED."propertyId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"propertyName" = EXCLUDED."propertyName",
		"propertyLegalName" = EXCLUDED."propertyLegalName",
		"propertyDisplayName" = EXCLUDED."propertyDisplayName",
		"propertyTimezone" = EXCLUDED."propertyTimezone",
		"propertyStartDate" = EXCLUDED."propertyStartDate",
		"propertyEndDate" = EXCLUDED."propertyEndDate",
		"APN" = EXCLUDED."APN",
		"MSANumber" = EXCLUDED."MSANumber",
		"addressLine1" = EXCLUDED."addressLine1",
		"addressLine2" = EXCLUDED."addressLine2",
		"city" = EXCLUDED."city",
		"state" = EXCLUDED."state",
		"postalCode" = EXCLUDED."postalCode",
		"isSameStore" = EXCLUDED."isSameStore";

-- d_Property - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Property"
(
	"propertyId",
	"utcCreatedDate",
	"propertyName",
	"propertyLegalName",
	"propertyDisplayName",
	"propertyTimezone",
	"propertyStartDate",
	"propertyEndDate",
	"APN",
	"MSANumber",
	"addressLine1",
	"addressLine2",
	"city",
	"state",
	"postalCode",
	"isSameStore"
)
SELECT
	p.id AS "propertyId",
	p.created_at AS "utcCreatedDate",
	p."name" AS "propertyName",
	p."propertyLegalName" AS "propertyLegalName",
	p."displayName" AS "propertyDisplayName",
	p.timezone AS "propertyTimezone",
	p."startDate" AT TIME ZONE "timezone" AS "propertyStartDate",
	COALESCE(p."endDate"  AT TIME ZONE "timezone", '2999-12-31 00:00:00') AS "propertyEndDate",
	COALESCE(p."APN", 'N/A') AS "APN",
	COALESCE(p."MSANumber", -1) AS "MSANumber",
	COALESCE(a."addressLine1", 'N/A') AS "addressLine1",
	COALESCE(a."addressLine2", 'N/A') AS "addressLine2",
	COALESCE(a.city, 'N/A') AS "city",
	COALESCE(a.state, 'NA') AS "state",
	COALESCE(a."postalCode", 'N/A') AS "postalCode",
	'Yes' AS "isSameStore" -- updated manually
FROM "dstReplicaDB"."dstReplicaSchema"."Property" AS p
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Property' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Address" AS a ON p."addressId" = a.id
	LEFT JOIN LATERAL
		(SELECT MAX("propertyKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Property" WHERE "propertyKey" <> -1) AS dim ON TRUE
WHERE (dim."hasData" IS NULL
			OR p.updated_at > lst."loadDate"
			OR a.updated_at > lst."loadDate"
			)
ON CONFLICT ("propertyId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"propertyName" = EXCLUDED."propertyName",
		"propertyLegalName" = EXCLUDED."propertyLegalName",
		"propertyDisplayName" = EXCLUDED."propertyDisplayName",
		"propertyTimezone" = EXCLUDED."propertyTimezone",
		"propertyStartDate" = EXCLUDED."propertyStartDate",
		"propertyEndDate" = EXCLUDED."propertyEndDate",
		"APN" = EXCLUDED."APN",
		"MSANumber" = EXCLUDED."MSANumber",
		"addressLine1" = EXCLUDED."addressLine1",
		"addressLine2" = EXCLUDED."addressLine2",
		"city" = EXCLUDED."city",
		"state" = EXCLUDED."state",
		"postalCode" = EXCLUDED."postalCode",
		"isSameStore" = EXCLUDED."isSameStore";

-- set d_Property as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Property', 'resultPrevInstr', 'final');

-- d_Party - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Party"
(
	"partyKey",
	"partyId",
	"utcCreatedDate",
	"partyURL",
	"utcFirstContactDate",
	"utcClosedDate",
	"utcSaleDate",
	"currentAssignedProperty",
	"closeReason",
	"currentState",
	"primaryAgentName",
	"sourceName",
	"sourceDisplayName",
	"programName",
	"programDisplayName",
	"initialChannel",
	"leadScore",
	"daysToCloseSale",
	"QQMoveIn",
	"QQBudget",
	"QQNumBedrooms",
	"QQGroupProfile",
	"creationType",
	"programProperty",
	"reportingStatus",
	"hasGuarantor",
	"originalTeam",
	"originalParticipant",
	"workflowName",
	"workflowState",
	"partyGroupId",
	"isTransferLease",
	"utcArchiveDate"
)
SELECT
	-1 AS "partyKey",
	'00000000-0000-0000-0000-000000000000' AS "partyId",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "partyURL",
	'1900-01-01 00:00:00' AS "utcFirstContactDate",
	'2999-12-31 00:00:00' AS "utcClosedDate",
	'1900-01-01 00:00:00' AS "utcSaleDate",
	'N/A' AS "currentAssignedProperty",
	'N/A' AS "closeReason",
	'N/A' AS "currentState",
	'N/A' AS "primaryAgentName",
	'N/A' AS "sourceName",
	'N/A' AS "sourceDisplayName",
	'N/A' AS "programName",
	'N/A' AS "programDisplayName",
	'N/A' AS "initialChannel",
	'N/A' AS "leadScore",
	-1 AS "daysToCloseSale",
	'N/A' AS "QQMoveIn",
	'N/A' AS "QQBudget",
	'N/A' AS "QQNumBedrooms",
	'N/A' AS "QQGroupProfile",
	'N/A' AS "creationType",
	'N/A' AS "programProperty",
	'N/A' AS "reportingStatus",
	'N/A' AS "hasGuarantor",
	'N/A' AS "originalTeam",
	'N/A' AS "originalParticipant",
	'N/A' AS "workflowName",
	'N/A' AS "workflowState",
	'00000000-0000-0000-0000-000000000000' AS "partyGroupId",
	'N/A' AS "isTransferLease",
	'1900-01-01 00:00:00' AS "utcArchiveDate"
ON CONFLICT ("partyKey")
DO UPDATE
	SET
		"partyId" = EXCLUDED."partyId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"partyURL" = EXCLUDED."partyURL",
		"utcFirstContactDate" = EXCLUDED."utcFirstContactDate",
		"utcClosedDate" = EXCLUDED."utcClosedDate",
		"utcSaleDate" = EXCLUDED."utcSaleDate",
		"currentAssignedProperty" = EXCLUDED."currentAssignedProperty",
		"closeReason" = EXCLUDED."closeReason",
		"currentState" = EXCLUDED."currentState",
		"primaryAgentName" = EXCLUDED."primaryAgentName",
		"sourceName" = EXCLUDED."sourceName",
		"sourceDisplayName" = EXCLUDED."sourceDisplayName",
		"programName" = EXCLUDED."programName",
		"programDisplayName" = EXCLUDED."programDisplayName",
		"initialChannel" = EXCLUDED."initialChannel",
		"leadScore" = EXCLUDED."leadScore",
		"daysToCloseSale" = EXCLUDED."daysToCloseSale",
		"QQMoveIn" = EXCLUDED."QQMoveIn",
		"QQBudget" = EXCLUDED."QQBudget",
		"QQNumBedrooms" = EXCLUDED."QQNumBedrooms",
		"QQGroupProfile" = EXCLUDED."QQGroupProfile",
		"creationType" = EXCLUDED."creationType",
		"programProperty" = EXCLUDED."programProperty",
		"reportingStatus" = EXCLUDED."reportingStatus",
		"hasGuarantor" = EXCLUDED."hasGuarantor",
		"originalTeam" = EXCLUDED."originalTeam",
		"originalParticipant" = EXCLUDED."originalParticipant",
		"workflowName" = EXCLUDED."workflowName",
		"workflowState" = EXCLUDED."workflowState",
		"partyGroupId" = EXCLUDED."partyGroupId",
		"isTransferLease" = EXCLUDED."isTransferLease",
		"utcArchiveDate" = EXCLUDED."utcArchiveDate";

-- d_Party - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Party"
(
	"partyId",
	"utcCreatedDate",
	"partyURL",
	"utcFirstContactDate",
	"utcClosedDate",
	"utcSaleDate",
	"currentAssignedProperty",
	"closeReason",
	"currentState",
	"primaryAgentName",
	"sourceName",
	"sourceDisplayName",
	"programName",
	"programDisplayName",
	"initialChannel",
	"leadScore",
	"daysToCloseSale",
	"QQMoveIn",
	"QQBudget",
	"QQNumBedrooms",
	"QQGroupProfile",
	"creationType",
	"programProperty",
	"reportingStatus",
	"hasGuarantor",
	"originalTeam",
	"originalParticipant",
	"workflowName",
	"workflowState",
	"partyGroupId",
	"isTransferLease",
	"utcArchiveDate"
)
SELECT
	p."id" AS "partyId",
	p.created_at AS "utcCreatedDate",
	'https://maximus.reva.tech/prospect/' || p."id"::TEXT AS "partyURL",
	COALESCE((p.metadata ->> 'firstContactedDate')::DATE, '1900-01-01') AS "utcFirstContactDate",
	COALESCE(p."endDate",'2999-12-31 00:00:00') AS "utcClosedDate",
	COALESCE(lease."signDate", '1900-01-01 00:00:00') AS "utcSaleDate",
	COALESCE(prop."name",'N/A') AS "currentAssignedProperty",
	CASE
		WHEN p."endDate" IS NULL THEN 'N/A'
		ELSE COALESCE(p.metadata ->> 'closeReasonId', 'N/A')
	END AS "closeReason",
	p.state AS "currentState",
	COALESCE(u."fullName", 'N/A') AS "primaryAgentName",
	COALESCE(s."name", 'N/A') AS "sourceName",
	COALESCE(s."displayName", p.metadata ->> 'source', 'N/A') AS "sourceDisplayName",
	COALESCE(camp."name", 'N/A') AS "programName",
	COALESCE(camp."displayName", p.metadata ->> 'programId', 'N/A') AS "programDisplayName",
	COALESCE(p.metadata ->> 'firstContactChannel', 'N/A') AS "initialChannel",
	CASE
		WHEN (ITA."TourStartDate" AT TIME ZONE prop."timezone")::DATE > (p.created_at AT TIME ZONE prop."timezone" + interval '28 days')::DATE
			THEN CASE
						WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
						ELSE 'bronze'
					 END
		WHEN (ITA."TourStartDate" AT TIME ZONE prop."timezone")::DATE <= (p."created_at" AT TIME ZONE prop."timezone" + interval '28 days')::DATE
			THEN CASE
						WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND "qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'gold'
						ELSE 'silver'
					 END
		WHEN ITA."TourStartDate" IS NULL
			THEN CASE
						WHEN (p."qualificationQuestions" ->> 'moveInTime' = 'NEXT_4_WEEKS' AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'silver'
						WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
						WHEN (p."qualificationQuestions" ->> 'moveInTime' <> 'NEXT_4_WEEKS'
							AND COALESCE(NULLIF(p."qualificationQuestions" ->> 'moveInTime', ''), 'I_DONT_KNOW') <> 'I_DONT_KNOW'
							AND p."qualificationQuestions" ->> 'cashAvailable' = 'YES') THEN 'bronze'
						ELSE 'prospect'
					 END
		WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
		ELSE 'prospect'
	END AS "leadScore",
	COALESCE((lease."signDate" AT TIME ZONE prop.timezone)::date - (p.created_at AT TIME ZONE prop.timezone)::date + 1, -1) AS "daysToCloseLease",
	COALESCE(p."qualificationQuestions" ->> 'moveInTime','N/A') AS "QQMoveIn",
	COALESCE(p."qualificationQuestions" ->> 'cashAvailable','N/A') AS "QQBudget",
	COALESCE(p."qualificationQuestions" ->> 'numBedrooms','N/A') AS "QQNumBedrooms",
	CASE WHEN (p."qualificationQuestions" ->> 'groupProfile' <> '') THEN p."qualificationQuestions" ->> 'groupProfile' ELSE 'N/A' END "QQGroupProfile",
	COALESCE(p.metadata ->> 'creationType', 'N/A') AS "creationType",
	COALESCE(campProp.name,'N/A') AS "programProperty",
	CASE
		WHEN p."endDate" IS NOT NULL
			THEN CASE
						WHEN p.metadata ->> 'closeReasonId' = 'CANT_AFFORD' THEN 'Unqualified'
						WHEN p.metadata ->> 'closeReasonId' = 'NO_MEMBERS' THEN 'Ignore'
						WHEN p.metadata ->> 'closeReasonId' = 'MERGED_WITH_ANOTHER_PARTY' THEN 'Ignore'
						WHEN p.metadata ->> 'closeReasonId' = 'MARKED_AS_SPAM' THEN 'Ignore'
						WHEN p.metadata ->> 'closeReasonId' = 'ALREADY_A_RESIDENT' THEN 'Ignore'
						ELSE 'Include'
			END
		ELSE 'Include'
	END AS "reportingStatus",
	CASE WHEN hasGuarantor."partyId" IS NULL THEN 'No' ELSE 'Yes' END AS "hasGuarantor",
	COALESCE(t."displayName", 'N/A') AS "originalTeam",
	COALESCE(op."fullName", 'N/A') AS "originalParticipant",
	COALESCE(p."workflowName", 'N/A') AS "workFlowName",
	COALESCE(p."workflowState", 'N/A') AS "workFlowState",
	COALESCE(p."partyGroupId", '00000000-0000-0000-0000-000000000000') AS "partyGroupId",
	CASE WHEN p."isTransferLease" = TRUE THEN 'Yes' ELSE 'No' END AS "isTransferLease",
	COALESCE(p."archiveDate", '1900-01-01 00:00:00') AS "utcArchiveDate"
FROM "dstReplicaDB"."dstReplicaSchema"."Party" AS p
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Party' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS u ON u."id" = p."userId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS prop ON prop."id" = p."assignedPropertyId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpc ON tpc.id = p."teamPropertyProgramId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Programs" AS camp ON camp.id = tpc."programId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Sources" AS s ON s.id = camp."sourceId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS campProp ON campProp."id" = tpc."propertyId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Teams" AS t ON (p.metadata ->> 'originalTeam')::uuid = t.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS op ON (p.metadata ->> 'firstCollaborator')::uuid = op.id
	LEFT JOIN
		(SELECT t."partyId",
			CAST(t.metadata ->> 'startDate' as TIMESTAMPTZ) as "TourStartDate", t.updated_at,
			row_number() OVER (PARTITION BY t."partyId" ORDER BY (t.metadata ->> 'startDate')::TIMESTAMPTZ ASC) AS rn
		 FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
		 WHERE t.name = 'APPOINTMENT'
		) AS ITA ON p.id = ITA."partyId" AND ITA.rn = 1 -- ITA = InitialTourAppointment - order by startDate
	LEFT OUTER JOIN
		(SELECT DISTINCT "partyId"
		 FROM "dstReplicaDB"."dstReplicaSchema"."PartyMember" pm
		 WHERE "memberType" = 'Guarantor'
			AND "endDate" IS NULL
		) AS hasGuarantor ON p.id = hasGuarantor."partyId"
	LEFT OUTER JOIN
		(SELECT "partyId", MIN("signDate") AS "signDate"
		 FROM "dstReplicaDB"."dstReplicaSchema"."Lease"
		 WHERE "status" = 'executed'
		 GROUP BY "partyId"
		) AS lease ON p.id = lease."partyId" -- lease = first executed lease
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" dim ON p.id = dim."partyId"
  WHERE dim."partyKey" IS NULL
		OR p.updated_at > lst."loadDate"
		OR tpc.updated_at > lst."loadDate"
		OR camp.updated_at > lst."loadDate"
		OR s.updated_at > lst."loadDate"
		OR ITA.updated_at > lst."loadDate"
ON CONFLICT ("partyId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"partyURL" = EXCLUDED."partyURL",
		"utcFirstContactDate" = EXCLUDED."utcFirstContactDate",
		"utcClosedDate" = EXCLUDED."utcClosedDate",
		"utcSaleDate" = EXCLUDED."utcSaleDate",
		"currentAssignedProperty" = EXCLUDED."currentAssignedProperty",
		"closeReason" = EXCLUDED."closeReason",
		"currentState" = EXCLUDED."currentState",
		"primaryAgentName" = EXCLUDED."primaryAgentName",
		"sourceName" = EXCLUDED."sourceName",
		"sourceDisplayName" = EXCLUDED."sourceDisplayName",
		"programName" = EXCLUDED."programName",
		"programDisplayName" = EXCLUDED."programDisplayName",
		"initialChannel" = EXCLUDED."initialChannel",
		"leadScore" = EXCLUDED."leadScore",
		"daysToCloseSale" = EXCLUDED."daysToCloseSale",
		"QQMoveIn" = EXCLUDED."QQMoveIn",
		"QQBudget" = EXCLUDED."QQBudget",
		"QQNumBedrooms" = EXCLUDED."QQNumBedrooms",
		"QQGroupProfile" = EXCLUDED."QQGroupProfile",
		"creationType" = EXCLUDED."creationType",
		"programProperty" = EXCLUDED."programProperty",
		"reportingStatus" = EXCLUDED."reportingStatus",
		"hasGuarantor" = EXCLUDED."hasGuarantor",
		"originalTeam" = EXCLUDED."originalTeam",
		"originalParticipant" = EXCLUDED."originalParticipant",
		"workflowName" = EXCLUDED."workflowName",
		"workflowState" = EXCLUDED."workflowState",
		"partyGroupId" = EXCLUDED."partyGroupId",
		"isTransferLease" = EXCLUDED."isTransferLease",
		"utcArchiveDate" = EXCLUDED."utcArchiveDate";;

-- set d_Party as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Party', 'resultPrevInstr', 'final');


-- d_Person - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_Person"
	(
		"personKey",
		"personId",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"utcCreatedDate",
		"fullName",
		"preferredName",
		"mergedWith"
	)
SELECT
	-1 AS "personKey",
	'00000000-0000-0000-0000-000000000000' AS "personId",
	'1900-01-01 00:00:00' AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	'default value' AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "fullName",
	'N/A' AS "preferredName",
	'N/A' AS "mergedWith"
ON CONFLICT ("personKey")
DO UPDATE
	SET
		"personId" = EXCLUDED."personId",
		"SCD_startDate" = EXCLUDED."SCD_startDate",
		"SCD_endDate" = EXCLUDED."SCD_endDate",
		"SCD_changeReason" = EXCLUDED."SCD_changeReason",
		"SCD_isCurrent" = EXCLUDED."SCD_isCurrent",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"fullName" = EXCLUDED."fullName",
		"preferredName" = EXCLUDED."preferredName",
		"mergedWith" = EXCLUDED."mergedWith";

-- d_Person - Step 1 - update end interval date for changed records
WITH sourceETL AS (
SELECT
	p.id AS "personId",
	p.created_at AS "utcCreatedDate",
	COALESCE(p."fullName", 'N/A') AS "fullName",
	COALESCE(p."preferredName", 'N/A') AS "preferredName",
	COALESCE(mu."fullName",'N/A') AS "mergedWith"
FROM "dstReplicaDB"."dstReplicaSchema"."Person" AS p
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Person' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Person" AS mu ON p."mergedWith" = mu.id
	LEFT JOIN LATERAL (SELECT MAX("personKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Person" WHERE "personKey" <> -1) AS dim ON TRUE
  WHERE dim."hasData" IS NULL
  	OR p.updated_at > lst."loadDate"
), sourceETLmd5 AS
(
	SELECT "personId",
	md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"fullName",
		"preferredName",
		"mergedWith"
	)::TEXT) AS "personHashKey"
FROM sourceETL
)
UPDATE "dstStarDB"."dstStarSchema"."d_Person" d
	SET "SCD_endDate" = now()
	, "SCD_isCurrent" = 'No'
FROM "dstStarDB"."dstStarSchema"."vw_d_Person" v
	INNER JOIN sourceETLmd5 AS src ON src."personId" = v."personId" AND src."personHashKey" <> v."personHashKey"
WHERE d."personKey" = v."personKey";

-- cancel all table loadings depending on d_Person
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Person', 'resultPrevInstr', 'intermediary');

-- d_Person - Step 2 - insert new rows for added/changed records
WITH pers_ord AS
(
SELECT "personId", "SCD_isCurrent" AS lst,
	ROW_NUMBER() OVER (PARTITION BY "personId" ORDER BY "SCD_endDate" DESC) AS rn
FROM "dstStarDB"."dstStarSchema"."d_Person"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_Person"
	(
		"personId",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"utcCreatedDate",
		"fullName",
		"preferredName",
		"mergedWith"
	)
SELECT
	p.id AS "personId",
	CASE WHEN po.lst IS NULL THEN p.created_at ELSE now() END AS "SCD_startDate",
  '2999-12-31 00:00:00' AS "SCD_endDate",
  CASE WHEN po.lst IS NULL THEN 'insert' ELSE 'update' END AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	p.created_at AS "utcCreatedDate",
	COALESCE(p."fullName", 'N/A') AS "fullName",
	COALESCE(p."preferredName", 'N/A') AS "preferredName",
	COALESCE(mu."fullName",'N/A') AS "mergedWith"
FROM "dstReplicaDB"."dstReplicaSchema"."Person" AS p
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Person' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Person" AS mu ON p."mergedWith" = mu.id
	LEFT JOIN pers_ord AS po ON p.id = po."personId" AND po.rn = 1
	LEFT JOIN LATERAL (SELECT MAX("personKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Person" WHERE "personKey" <> -1) AS dim ON TRUE
WHERE (po.lst = 'No' OR po.lst IS null)
	AND (dim."hasData" IS NULL
  	OR p.updated_at > lst."loadDate");

-- set d_Person as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Person', 'resultPrevInstr', 'final');

-- d_ContactInfo - default- SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_ContactInfo"
	(
		"contactInfoKey",
		"contactInfoId",
		"personKey",
		"utcCreatedDate",
		"contactType",
		"value",
		"isImported",
		"isPrimary",
		"isSMSCapable"
	)
SELECT
	-1 AS "contactInfoKey",
	'00000000-0000-0000-0000-000000000000' AS "contactInfoId",
	-1 AS "personKey",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "contactType",
	'N/A' AS "value",
	'N/A' AS "isImported",
	'N/A' AS "isPrimary",
	'N/A' AS "isSMSCapable"
ON CONFLICT ("contactInfoKey")
DO UPDATE
	SET
		"contactInfoId" = EXCLUDED."contactInfoId",
		"personKey" = EXCLUDED."personKey",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"contactType" = EXCLUDED."contactType",
		"value" = EXCLUDED."value",
		"isImported" = EXCLUDED."isImported",
		"isPrimary" = EXCLUDED."isPrimary",
		"isSMSCapable" = EXCLUDED."isSMSCapable";

-- d_ContactInfo - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_ContactInfo"
  (
		"contactInfoId",
		"personKey",
		"utcCreatedDate",
		"contactType",
		"value",
		"isImported",
		"isPrimary",
		"isSMSCapable"
	)
SELECT
	ci.id AS "contactInfoId",
	dp."personKey",
	ci.created_at AS "utcCreatedDate",
	ci."type" AS "contactType",
	ci.value,
	CASE WHEN ci."imported" = TRUE THEN 'Yes' ELSE 'No' END AS "isImported",
	CASE WHEN ci."isPrimary" = TRUE THEN 'Yes' ELSE 'No' END AS "isPrimary",
	CASE
		WHEN ci.metadata->'sms' = 'true' THEN 'Yes'
		WHEN ci.metadata->'sms' = 'false' THEN 'No'
	ELSE 'N/A' END AS "isSMSCapable"
FROM "dstReplicaDB"."dstReplicaSchema"."ContactInfo" AS ci
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_ContactInfo' AND lst."needToLoad" = TRUE
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Person" AS dp ON ci."personId" = dp."personId" AND "SCD_isCurrent" = 'Yes'
	LEFT JOIN LATERAL (SELECT MAX("contactInfoKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_ContactInfo" WHERE "contactInfoKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
  OR ci.updated_at > lst."loadDate"
	OR dp."SCD_startDate" > lst."loadDate"
ON CONFLICT ("contactInfoId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"contactType" = EXCLUDED."contactType",
		"value" = EXCLUDED."value",
		"isImported" = EXCLUDED."isImported",
		"isPrimary" = EXCLUDED."isPrimary",
		"isSMSCapable" = EXCLUDED."isSMSCapable";

-- set d_ContactInfo as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_ContactInfo', 'resultPrevInstr', 'final');

-- d_PartyMember - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_PartyMember"
	(
		"partyMemberKey",
		"partyMemberId",
		"partyKey",
		"personKey",
		"utcStartDate",
		"utcEndDate",
		"memberState",
		"memberType",
		"externalPrimaryId",
		"externalSecondaryId",
		"guarantorFullName",
		"isPrimary"
	)
SELECT
	-1 AS "partyMemberKey",
	'00000000-0000-0000-0000-000000000000' AS "partyMemberId",
	-1 AS "partyKey",
	-1 AS "personKey",
	'1900-01-01 00:00:00' AS "utcStartDate",
	'2999-12-31 00:00:00' AS "utcEndDate",
	'N/A' AS "memberState",
	'N/A' AS "memberType",
	'N/A' AS "externalPrimaryId",
	'N/A' AS "externalSecondaryId",
	'N/A' AS "guarantorFullName",
	'N/A' AS "isPrimary"
ON CONFLICT ("partyMemberKey")
	DO UPDATE
	SET
		"partyMemberId" = EXCLUDED."partyMemberId",
		"partyKey" = EXCLUDED."partyKey",
		"personKey" = EXCLUDED."personKey",
		"utcStartDate" = EXCLUDED."utcStartDate",
		"utcEndDate" = EXCLUDED."utcEndDate",
		"memberState" = EXCLUDED."memberState",
		"memberType" = EXCLUDED."memberType",
		"externalPrimaryId" = EXCLUDED."externalPrimaryId",
		"externalSecondaryId" = EXCLUDED."externalSecondaryId",
		"guarantorFullName" = EXCLUDED."guarantorFullName",
		"isPrimary" = EXCLUDED."isPrimary";

-- d_PartyMember - UPSERT
WITH lastExternalIds AS
(
SELECT
	pm.id AS "partyMemberId",
	ei."externalId" as "externalPrimaryId",
	COALESCE(ei."externalProspectId", ei."externalRoommateId") as "externalSecondaryId",
	ei."isPrimary",
	ei.updated_at,
	ROW_NUMBER() OVER (PARTITION BY ei."partyMemberId" ORDER BY ei.created_at DESC) AS ord
FROM "dstReplicaDB"."dstReplicaSchema"."PartyMember" pm
   	LEFT OUTER JOIN "dstReplicaDB"."dstReplicaSchema"."ExternalPartyMemberInfo" ei on ei."partyMemberId" = pm.id
WHERE pm."endDate" IS NULL
	AND ( ei."externalProspectId" IS NOT NULL
			)
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_PartyMember"
(
	"partyMemberId",
	"partyKey",
	"personKey",
	"utcStartDate",
	"utcEndDate",
	"memberState",
	"memberType",
	"externalPrimaryId",
	"externalSecondaryId",
	"guarantorFullName",
	"isPrimary"
)
SELECT
	pm.id AS "partyMemberId",
	dp."partyKey",
	COALESCE(dps."personKey",1) AS "personKey",
	pm."startDate" AS "utcStartDate",
	COALESCE(pm."endDate",'2999-12-31 00:00:00') AS "utcEndDate",
	pm."memberState",
	pm."memberType",
	COALESCE(lei."externalPrimaryId",'N/A') AS "externalPrimaryId",
	COALESCE(lei."externalSecondaryId",'N/A') AS "externalSecondaryId",
	COALESCE(gup."fullName",'N/A') AS "guarantorFullName",
	CASE WHEN lei."isPrimary" = TRUE THEN 'Yes'
			 WHEN lei."isPrimary" = FALSE THEN 'No'
			 ELSE 'N/A'
	END as "isPrimary"
FROM "dstReplicaDB"."dstReplicaSchema"."PartyMember" AS pm
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_PartyMember' AND lst."needToLoad" = TRUE
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Person" AS p ON pm."personId" = p.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."PartyMember" AS gu ON pm."guaranteedBy" = gu.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Person" AS gup ON gu."personId" = gup.id
	LEFT JOIN lastExternalIds AS lei ON pm.id = lei."partyMemberId" AND lei.ord = 1
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON pm."partyId" = dp."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Person" AS dps ON pm."personId" = dps."personId" AND dps."SCD_isCurrent" = 'Yes'
	LEFT JOIN LATERAL (SELECT MAX(d."utcStartDate") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_PartyMember" AS d WHERE "partyMemberKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
  OR pm.updated_at > lst."loadDate"
	OR p.updated_at > lst."loadDate"
	OR lei.updated_at > lst."loadDate"
	OR dps."SCD_startDate" > lst."loadDate"
ON CONFLICT ("partyMemberId")
DO UPDATE
	SET
		"partyKey" = EXCLUDED."partyKey",
		"personKey" = EXCLUDED."personKey",
		"utcStartDate" = EXCLUDED."utcStartDate",
		"utcEndDate" = EXCLUDED."utcEndDate",
		"memberState" = EXCLUDED."memberState",
		"memberType" = EXCLUDED."memberType",
		"externalPrimaryId" = EXCLUDED."externalPrimaryId",
		"externalSecondaryId" = EXCLUDED."externalSecondaryId",
		"guarantorFullName" = EXCLUDED."guarantorFullName",
		"isPrimary" = EXCLUDED."isPrimary";

-- set d_PartyMember as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_PartyMember', 'resultPrevInstr', 'final');

-- d_Program - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Program"
	(
		"programKey",
		"programId",
		"programName",
		"programDisplayName",
		"programDescription",
		"directEmailIdentifier",
		"outsideDedicatedEmails",
		"displayEmail",
		"directPhoneIdentifier",
		"displayPhoneNumber",
		"utcCreatedDate",
		"sourceId",
		"sourceName",
		"sourceDisplayName",
		"sourceDescription",
		"utcSourceCreatedDate"
	)
SELECT
	-1 AS "programKey",
	'00000000-0000-0000-0000-000000000000' AS "programId",
	'N/A' AS "programName",
	'N/A' AS "programDisplayName",
	'N/A' AS "programDescription",
	'N/A' AS "directEmailIdentifier",
	'N/A' AS "outsideDedicatedEmails",
	'N/A' AS "displayEmail",
	'N/A' AS "directPhoneIdentifier",
	'N/A' AS "displayPhoneNumber",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'00000000-0000-0000-0000-000000000000' AS "sourceId",
	'N/A' AS "sourceName",
	'N/A' AS "sourceDisplayName",
	'N/A' AS "sourceDescription",
	'1900-01-01 00:00:00' AS "utcSourceCreatedDate"
ON CONFLICT ("programKey")
DO UPDATE
	SET
		"programId" = EXCLUDED."programId",
		"programName" = EXCLUDED."programName",
		"programDisplayName" = EXCLUDED."programDisplayName",
		"programDescription" = EXCLUDED."programDescription",
		"directEmailIdentifier" = EXCLUDED."directEmailIdentifier",
		"outsideDedicatedEmails" = EXCLUDED."outsideDedicatedEmails",
		"displayEmail" = EXCLUDED."displayEmail",
		"directPhoneIdentifier" = EXCLUDED."directPhoneIdentifier",
		"displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"sourceId" = EXCLUDED."sourceId",
		"sourceName" = EXCLUDED."sourceName",
		"sourceDisplayName" = EXCLUDED."sourceDisplayName",
		"sourceDescription" = EXCLUDED."sourceDescription",
		"utcSourceCreatedDate" = EXCLUDED."utcSourceCreatedDate";

-- d_Program  - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Program"
	(
		"programId",
		"programName",
		"programDisplayName",
		"programDescription",
		"directEmailIdentifier",
		"outsideDedicatedEmails",
		"displayEmail",
		"directPhoneIdentifier",
		"displayPhoneNumber",
		"utcCreatedDate",
		"sourceId",
		"sourceName",
		"sourceDisplayName",
		"sourceDescription",
		"utcSourceCreatedDate"
	)
SELECT
	p."id" AS "programId",
	p."name" AS "programName",
	p."displayName" AS "programDisplayName",
	COALESCE(p."description", 'N/A') AS "programDescription",
	COALESCE(p."directEmailIdentifier", 'N/A') AS "directEmailIdentifier",
	CASE WHEN ARRAY_TO_STRING(p."outsideDedicatedEmails",',') = '' THEN 'N/A'  ELSE ARRAY_TO_STRING(p."outsideDedicatedEmails",',') END AS "outsideDedicatedEmails",
	COALESCE(p."displayEmail", 'N/A') AS "displayEmail",
	COALESCE(p."directPhoneIdentifier", 'N/A') AS "directPhoneIdentifier",
	COALESCE(p."displayPhoneNumber", 'N/A') AS "displayPhoneNumber",
	p."created_at" AS "utcCreatedDate",
	s."id" AS "sourceId",
	s."name" AS "sourceName",
	s."displayName" AS "sourceDisplayName",
	COALESCE(s."description", 'N/A') AS "sourceDescription",
	s."created_at" AS "utcSourceCreatedDate"
FROM "dstReplicaDB"."dstReplicaSchema"."Programs" AS p
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Program' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Sources" AS s ON p."sourceId" = s."id"
	LEFT JOIN LATERAL (SELECT MAX("programKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Program" WHERE "programKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR p.updated_at > lst."loadDate"
	OR s.updated_at > lst."loadDate"
ON CONFLICT ("programId")
DO UPDATE
	SET
		"programName" = EXCLUDED."programName",
		"programDisplayName" = EXCLUDED."programDisplayName",
		"programDescription" = EXCLUDED."programDescription",
		"directEmailIdentifier" = EXCLUDED."directEmailIdentifier",
		"outsideDedicatedEmails" = EXCLUDED."outsideDedicatedEmails",
		"displayEmail" = EXCLUDED."displayEmail",
		"directPhoneIdentifier" = EXCLUDED."directPhoneIdentifier",
		"displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"sourceId" = EXCLUDED."sourceId",
		"sourceName" = EXCLUDED."sourceName",
		"sourceDisplayName" = EXCLUDED."sourceDisplayName",
		"sourceDescription" = EXCLUDED."sourceDescription",
		"utcSourceCreatedDate" = EXCLUDED."utcSourceCreatedDate";

-- set d_Program as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Program', 'resultPrevInstr', 'final');

-- d_User - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_User"
	(
		"userKey",
		"userId",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"utcCreatedDate",
		"fullName",
		"preferredName",
		"externalUniqueId",
		"businessTitle",
		"email",
		"displayPhoneNumber",
		"displayEmail",
		"isActive"
	)
SELECT
	-1 AS "userKey",
	'00000000-0000-0000-0000-000000000000' AS "userId",
	'1900-01-01 00:00:00' AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	'default value' AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'' AS "fullName",
	'' AS "preferredName",
	'' AS "externalUniqueId",
	'' AS "businessTitle",
	'' AS "email",
	'' AS "displayPhoneNumber",
	'' AS "displayEmail",
	'' AS "isActive"
ON CONFLICT ("userKey")
DO UPDATE
	SET
	"userId" = EXCLUDED."userId",
	"SCD_startDate" = EXCLUDED."SCD_startDate",
	"SCD_endDate" = EXCLUDED."SCD_endDate",
	"SCD_changeReason" = EXCLUDED."SCD_changeReason",
	"SCD_isCurrent" = EXCLUDED."SCD_isCurrent",
	"utcCreatedDate" = EXCLUDED."utcCreatedDate",
	"fullName" = EXCLUDED."fullName",
	"preferredName" = EXCLUDED."preferredName",
	"externalUniqueId" = EXCLUDED."externalUniqueId",
	"businessTitle" = EXCLUDED."businessTitle",
	"email" = EXCLUDED."email",
	"displayPhoneNumber" = EXCLUDED."displayPhoneNumber",
	"displayEmail" = EXCLUDED."displayEmail",
	"isActive" = EXCLUDED."isActive";

-- d_User - Step 1 - update end interval date for changed records
WITH sourceETL AS (
SELECT
	u."id" AS "userId",
	u."created_at" AS "utcCreatedDate",
	u."fullName" AS "fullName",
	u."preferredName" AS "preferredName",
	u."externalUniqueId" AS "externalUniqueId",
	COALESCE((metadata->>'businessTitle')::text,'N/A') AS "businessTitle",
	u."email" AS "email",
	COALESCE(u."displayPhoneNumber", 'N/A') AS "displayPhoneNumber",
	COALESCE(u."displayEmail", 'N/A') AS "displayEmail",
	'Yes' AS "isActive"
FROM "dstReplicaDB"."dstReplicaSchema"."Users" AS u
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_User' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("userKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_User" WHERE "userKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR u.updated_at > lst."loadDate"
), sourceETLmd5 AS
(
SELECT "userId",
	md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"fullName",
		"preferredName",
		"externalUniqueId",
		"businessTitle",
		"email",
		"displayPhoneNumber",
		"displayEmail",
		"isActive"
	)::TEXT) AS "userHashKey"
FROM sourceETL
)
UPDATE "dstStarDB"."dstStarSchema"."d_User" AS d
	SET "SCD_endDate" = now()
	, "SCD_isCurrent" = 'No'
FROM "dstStarDB"."dstStarSchema"."vw_d_User" AS v
	INNER JOIN sourceETLmd5 AS src ON src."userId" = v."userId" AND src."userHashKey" <> v."userHashKey"
WHERE d."userKey" = v."userKey";

-- cancel all table loadings depending on d_ContactInfo
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_User', 'resultPrevInstr', 'intermediary');

-- d_User - Step 2 - insert new rows for added/changed records
WITH user_ord AS
(
SELECT "userId", "SCD_isCurrent" AS lst,
	ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "SCD_endDate" DESC) AS rn
FROM "dstStarDB"."dstStarSchema"."d_User"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_User"
(
	"userId",
	"SCD_startDate",
	"SCD_endDate",
	"SCD_changeReason",
	"SCD_isCurrent",
	"utcCreatedDate",
	"fullName",
	"preferredName",
	"externalUniqueId",
	"businessTitle",
	"email",
	"displayPhoneNumber",
	"displayEmail",
	"isActive"
)
SELECT
	u."id" AS "userId",
	CASE WHEN uo.lst IS NULL THEN u.created_at ELSE now() END AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	CASE WHEN uo.lst IS NULL THEN 'insert' ELSE 'update' END AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	u."created_at" AS "utcCreatedDate",
	u."fullName" AS "fullName",
	u."preferredName" AS "preferredName",
	u."externalUniqueId" AS "externalUniqueId",
	COALESCE((metadata->>'businessTitle')::text,'N/A') AS "businessTitle",
	u."email" AS "email",
	COALESCE(u."displayPhoneNumber", 'N/A') AS "displayPhoneNumber",
	COALESCE(u."displayEmail", 'N/A') AS "displayEmail",
	'Yes' AS "isActive"
FROM "dstReplicaDB"."dstReplicaSchema"."Users" AS u
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_User' AND lst."needToLoad" = TRUE
	LEFT JOIN user_ord AS uo ON u.id = uo."userId" AND uo.rn = 1
	LEFT JOIN LATERAL (SELECT MAX("userKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_User" WHERE "userKey" <> -1) AS dim ON TRUE
WHERE (uo.lst = 'No' OR uo.lst IS null)
	AND (dim."hasData" IS NULL
		OR u.updated_at > lst."loadDate");

-- set d_User as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_User', 'resultPrevInstr', 'final');

-- d_Team - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Team"
	(
		"teamKey",
		"teamId",
		"utcCreatedDate",
		"teamName",
		"teamDisplayName",
		"teamModule",
		"teamDescription",
		"teamTimezone"
	)
SELECT
	-1 AS "teamKey",
	'00000000-0000-0000-0000-000000000000' AS "teamId",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "teamName",
	'N/A' AS "teamDisplayName",
	'N/A' AS "teamModule",
	'N/A' AS "teamDescription",
	'Universal' AS "teamTimezone"
ON CONFLICT ("teamKey")
DO UPDATE
	SET
		"teamId" = EXCLUDED."teamId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"teamName" = EXCLUDED."teamName",
		"teamDisplayName" = EXCLUDED."teamDisplayName",
		"teamModule" = EXCLUDED."teamModule",
		"teamDescription" = EXCLUDED."teamDescription",
		"teamTimezone" = EXCLUDED."teamTimezone";

-- d_Team - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Team"
  (
		"teamId",
		"utcCreatedDate",
		"teamName",
		"teamDisplayName",
		"teamModule",
		"teamDescription",
		"teamTimezone"
	)
SELECT
	t."id" AS "teamId",
	t."created_at" AS "utcCreatedDate",
	t."name" AS "teamName",
	t."displayName" AS "teamDisplayName",
	t."module" AS "teamModule",
	t."description" AS "teamDescription",
	t."timeZone" AS "teamTimzone"
FROM "dstReplicaDB"."dstReplicaSchema"."Teams" AS t
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Team' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("teamKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Team" WHERE "teamKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR t.updated_at > lst."loadDate"
ON CONFLICT ("teamId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"teamName" = EXCLUDED."teamName",
		"teamDisplayName" = EXCLUDED."teamDisplayName",
		"teamModule" = EXCLUDED."teamModule",
		"teamDescription" = EXCLUDED."teamDescription",
		"teamTimezone" = EXCLUDED."teamTimezone";

-- set d_Team as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Team', 'resultPrevInstr', 'final');

-- d_TeamMember - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_TeamMember"
(
	"teamMemberKey",
	"teamMemberId",
	"SCD_startDate",
	"SCD_endDate",
	"SCD_changeReason",
	"SCD_isCurrent",
	"utcCreatedDate",
	"userKey",
	"teamKey",
	"mainRoles",
	"functionalRoles"
)
SELECT
	-1 AS "teamMemberKey",
	'00000000-0000-0000-0000-000000000000' AS "teamMemberId",
	'1900-01-01 00:00:00' AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	'default value' AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	-1 AS "userKey",
	-1 AS "teamKey",
	'N/A' AS "mainRoles",
	'N/A' AS "functionalRoles"
ON CONFLICT ("teamMemberKey")
DO UPDATE
	SET
		"teamMemberId" = EXCLUDED."teamMemberId",
		"SCD_startDate" = EXCLUDED."SCD_startDate",
		"SCD_endDate" = EXCLUDED."SCD_endDate",
		"SCD_changeReason" = EXCLUDED."SCD_changeReason",
		"SCD_isCurrent" = EXCLUDED."SCD_isCurrent",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"userKey" = EXCLUDED."userKey",
		"teamKey" = EXCLUDED."teamKey",
		"mainRoles" = EXCLUDED."mainRoles",
		"functionalRoles" = EXCLUDED."functionalRoles";

-- d_TeamMember - Step 1 - update end interval date for changed records
WITH sourceETL AS (
SELECT
	tm.id AS "teamMemberId",
	tm.created_at AS "utcCreatedDate",
	du."userKey",
	dt."teamKey",
	CASE WHEN ARRAY_TO_STRING(tm."mainRoles",',') = '' THEN 'N/A'  ELSE ARRAY_TO_STRING(tm."mainRoles",',') END AS "mainRoles",
	CASE WHEN ARRAY_TO_STRING(tm."functionalRoles",',') = '' THEN 'N/A'  ELSE ARRAY_TO_STRING(tm."functionalRoles",',') END AS "functionalRoles"
FROM "dstReplicaDB"."dstReplicaSchema"."TeamMembers" AS tm
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_TeamMember' AND lst."needToLoad" = TRUE
	INNER JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON tm."userId" = du."userId" AND du."SCD_isCurrent" = 'Yes'
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Team" AS dt ON tm."teamId" = dt."teamId"
	LEFT JOIN LATERAL (SELECT MAX(d."utcCreatedDate") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_TeamMember" AS d WHERE "teamMemberKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR tm.updated_at > lst."loadDate"
	OR du."SCD_startDate" > lst."loadDate"
), sourceETLmd5 AS
(
SELECT "teamMemberId",
	md5(ROW(
		TO_CHAR("utcCreatedDate", 'YYYY-MM-DD HH:MI:SS'),
		"userKey",
		"teamKey",
		"mainRoles",
		"functionalRoles"
	)::TEXT) AS "teamMemberHashKey"
FROM sourceETL
)
UPDATE "dstStarDB"."dstStarSchema"."d_TeamMember" AS d
	SET "SCD_endDate" = now()
	, "SCD_isCurrent" = 'No'
FROM "dstStarDB"."dstStarSchema"."vw_d_TeamMember" AS v
	INNER JOIN sourceETLmd5 AS src ON src."teamMemberId" = v."teamMemberId" AND src."teamMemberHashKey" <> v."teamMemberHashKey"
WHERE d."teamMemberKey" = v."teamMemberKey";

-- cancel all table loadings depending on d_TeamMember
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_TeamMember', 'resultPrevInstr', 'intermediary');

-- d_TeamMember - Step 2 - insert new rows for added/changed records
WITH tm_ord AS
(
SELECT "teamMemberId", "SCD_isCurrent" AS lst,
	ROW_NUMBER() OVER (PARTITION BY "teamMemberId" ORDER BY "SCD_endDate" DESC) AS rn
FROM "dstStarDB"."dstStarSchema"."d_TeamMember"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_TeamMember"
	(
		"teamMemberId",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"utcCreatedDate",
		"userKey",
		"teamKey",
		"mainRoles",
		"functionalRoles"
	)
SELECT
	tm.id AS "teamMemberId",
	CASE WHEN tmo.lst IS NULL THEN tm.created_at ELSE now() END AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	CASE WHEN tmo.lst IS NULL THEN 'insert' ELSE 'update' END AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	tm.created_at AS "utcCreatedDate",
	du."userKey",
	dt."teamKey",
	CASE WHEN ARRAY_TO_STRING(tm."mainRoles",',') = '' THEN 'N/A'  ELSE ARRAY_TO_STRING(tm."mainRoles",',') END AS "mainRoles",
	CASE WHEN ARRAY_TO_STRING(tm."functionalRoles",',') = '' THEN 'N/A'  ELSE ARRAY_TO_STRING(tm."functionalRoles",',') END AS "functionalRoles"
FROM "dstReplicaDB"."dstReplicaSchema"."TeamMembers" AS tm
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_TeamMember' AND lst."needToLoad" = TRUE
	INNER JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON tm."userId" = du."userId" AND du."SCD_isCurrent" = 'Yes'
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Team" AS dt ON tm."teamId" = dt."teamId"
	LEFT JOIN tm_ord AS tmo ON tm.id = tmo."teamMemberId" AND tmo.rn = 1
	LEFT JOIN LATERAL (SELECT MAX("teamMemberKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_TeamMember" WHERE "teamMemberKey" <> -1) AS dim ON TRUE
WHERE (tmo.lst = 'No' OR tmo.lst IS null)
	AND ( dim."hasData" IS NULL
			OR tm.updated_at > lst."loadDate"
			OR du."SCD_startDate" > lst."loadDate");

-- set d_TeamMember as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_TeamMember', 'resultPrevInstr', 'final');

-- d_Task - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Task"
(
	"taskKey",
	"taskId",
	"utcCreatedDate",
	"utcDueDate",
	"utcCompletedDate",
	"utcCanceledDate",
	"taskName",
	"taskCategory",
	"currentState",
	"taskOwners",
	"partyKey",
	"utcStartDate",
	"utcEndDate",
	"appointmentResult",
	"originalPartyOwner",
	"taskCreatedBy",
	"taskCompletedBy",
	"originalAssignees",
	"notes",
	"appointmentCreatedFrom"
)
SELECT
	-1 AS "taskKey",
	'00000000-0000-0000-0000-000000000000' AS "taskId",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'2999-12-31 00:00:00' AS "utcDueDate",
	'2999-12-31 00:00:00' AS "utcCompletedDate",
	'2999-12-31 00:00:00' AS "utcCanceledDate",
	'N/A' AS "taskName",
	'N/A' AS "taskCategory",
	'N/A' AS "currentState",
	'N/A' AS "taskOwners",
	-1 AS "partyKey",
	'1900-01-01 00:00:00' AS "utcStartDate",
	'2999-12-31 00:00:00' AS "utcEndDate",
	'N/A' AS "appointmentResult",
	'N/A' AS "originalPartyOwner",
	'N/A' AS "taskCreatedBy",
	'N/A' AS "taskCompletedBy",
	'N/A' AS "originalAssignees",
	'N/A' AS "notes",
	'N/A' AS "appointmentCreatedFrom"
ON CONFLICT ("taskKey")
DO UPDATE
	SET
		"taskId" = EXCLUDED."taskId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"utcDueDate" = EXCLUDED."utcDueDate",
		"utcCompletedDate" = EXCLUDED."utcCompletedDate",
		"utcCanceledDate" = EXCLUDED."utcCanceledDate",
		"taskName" = EXCLUDED."taskName",
		"taskCategory" = EXCLUDED."taskCategory",
		"currentState" = EXCLUDED."currentState",
		"taskOwners" = EXCLUDED."taskOwners",
		"partyKey" = EXCLUDED."partyKey",
		"utcStartDate" = EXCLUDED."utcStartDate",
		"utcEndDate" = EXCLUDED."utcEndDate",
		"appointmentResult" = EXCLUDED."appointmentResult",
		"originalPartyOwner" = EXCLUDED."originalPartyOwner",
		"taskCreatedBy" = EXCLUDED."taskCreatedBy",
		"taskCompletedBy" = EXCLUDED."taskCompletedBy",
		"originalAssignees" = EXCLUDED."originalAssignees",
		"notes" = EXCLUDED."notes",
		"appointmentCreatedFrom" = EXCLUDED."appointmentCreatedFrom";

-- d_Task - UPSERT
WITH TaskUsers AS (
SELECT
	uid.i::UUID AS "userId",
	t.id,
	CASE WHEN CHAR_LENGTH((t.metadata ->> 'completedBy')::TEXT) <> 36 THEN NULL ELSE t.metadata ->> 'completedBy' END AS "completedBy",
	CASE WHEN CHAR_LENGTH((t.metadata ->> 'createdBy')::TEXT) <> 36 THEN NULL ELSE t.metadata ->> 'createdBy' END AS "createdBy"
FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
	LEFT JOIN LATERAL UNNEST("userIds") as uid(i) ON TRUE
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Task' AND lst."needToLoad" = TRUE
WHERE t.updated_at > lst."loadDate"
), TaskUsersString AS (
SELECT
	tu.id,
	tu."completedBy",
	tu."createdBy",
	string_agg(u."fullName", '|' ORDER BY u."fullName") AS "usersFullName"
FROM TaskUsers tu
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS u ON tu."userId" = u.id
GROUP BY tu.id, tu."completedBy", tu."createdBy"
), TaskAssignees AS (
SELECT
	translate(unnest(string_to_array(t.metadata ->> 'originalAssignees', ',')
									),
		'[]" ', '') AS "userId",
	t.id AS "taskId"
FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Task' AND lst."needToLoad" = TRUE
WHERE t.updated_at > lst."loadDate"
), TaskAssigneesString AS (
SELECT
	string_agg(u1."fullName", ' | ') as "users",
	ta."taskId"
FROM
	TaskAssignees AS ta
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Users" u1 on u1.id = ta."userId"::UUID
WHERE ta."userId" <> ''
GROUP BY ta."taskId"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_Task"
(
	"taskId",
	"utcCreatedDate",
	"utcDueDate",
	"utcCompletedDate",
	"utcCanceledDate",
	"taskName",
	"taskCategory",
	"currentState",
	"taskOwners",
	"partyKey",
	"utcStartDate",
	"utcEndDate",
	"appointmentResult",
	"originalPartyOwner",
	"taskCreatedBy",
	"taskCompletedBy",
	"originalAssignees",
	"notes",
	"appointmentCreatedFrom"
)
SELECT
	t."id" AS "taskId",
	t."created_at" AS "utcCreatedDate",
	COALESCE(t."dueDate", '2999-12-31 00:00:00') AS "utcDueDate",
	COALESCE(t."completionDate", '2999-12-31 00:00:00') AS "utcCompletedDate",
	CASE WHEN state = 'Canceled' THEN t.updated_at ELSE '2999-12-31 00:00:00' END AS "utcCanceledDate",
	COALESCE(t."name", 'N/A') AS "taskName",
	COALESCE(t."category", 'N/A') AS "taskCategory",
	COALESCE(t."state", 'N/A') AS "currentState",
	COALESCE(tus."usersFullName", 'N/A') AS "taskOwners",
	dp."partyKey" AS "partyKey",
	COALESCE(CAST(t.metadata ->> 'startDate' AS TIMESTAMPTZ),'1900-01-01 00:00:00') as "utcStartDate",
	COALESCE(CAST(t.metadata ->> 'endDate' AS TIMESTAMPTZ), '2999-12-31 00:00:00') as "utcEndDate",
	COALESCE(t.metadata ->> 'appointmentResult', 'N/A') as "appointmentResult",
	COALESCE(opo."fullName", 'N/A') AS "originalPartyOwner",
	COALESCE(tcb."fullName", 'N/A') AS "taskCreatedBy",
	CASE WHEN char_length(t.metadata ->> 'completedBy') < 36 THEN t.metadata ->> 'completedBy'
		 WHEN char_length(t.metadata ->> 'completedBy') = 36 THEN tcpb."fullName"
		 ELSE 'N/A'
	END AS "taskCompletedBy",
	COALESCE(tas.users, 'N/A') AS "originalAssignees",
	COALESCE(t.metadata ->> 'note', 'N/A') AS "notes",
	COALESCE(t.metadata->>'appointmentCreatedFrom', 'N/A') AS "appointmentCreatedFrom"
FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Task' AND lst."needToLoad" = TRUE
	LEFT JOIN TaskUsersString AS tus ON t.id = tus.id
	LEFT JOIN TaskAssigneesString AS tas ON t.id = tas."taskId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS opo ON (t.metadata ->> 'originalPartyOwner')::uuid = opo.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS tcb ON tus."createdBy"::uuid = tcb.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS tcpb ON tus."completedBy" = tcpb.id::text
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON t."partyId" = dp."partyId"
	LEFT JOIN LATERAL (SELECT MAX("taskKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Task" WHERE "taskKey" <> -1) AS dim ON TRUE
  WHERE dim."hasData" IS NULL
  	OR t.updated_at > lst."loadDate"
ON CONFLICT ("taskId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"utcDueDate" = EXCLUDED."utcDueDate",
		"utcCompletedDate" = EXCLUDED."utcCompletedDate",
		"utcCanceledDate" = EXCLUDED."utcCanceledDate",
		"taskName" = EXCLUDED."taskName",
		"taskCategory" = EXCLUDED."taskCategory",
		"currentState" = EXCLUDED."currentState",
		"taskOwners" = EXCLUDED."taskOwners",
		"partyKey" = EXCLUDED."partyKey",
		"utcStartDate" = EXCLUDED."utcStartDate",
		"utcEndDate" = EXCLUDED."utcEndDate",
		"appointmentResult" = EXCLUDED."appointmentResult",
		"originalPartyOwner" = EXCLUDED."originalPartyOwner",
		"taskCreatedBy" = EXCLUDED."taskCreatedBy",
		"taskCompletedBy" = EXCLUDED."taskCompletedBy",
		"originalAssignees" = EXCLUDED."originalAssignees",
		"notes" = EXCLUDED."notes",
		"appointmentCreatedFrom" = EXCLUDED."appointmentCreatedFrom";

-- set d_Task as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Task', 'resultPrevInstr', 'final');

-- d_Inventory - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Inventory"
(
	"inventoryKey",
	"inventoryId",
	"inventoryName",
	"inventoryType",
	"inventoryDescription",
	"floor",
	"currentState",
	"externalId",
	"isOnHold",
	"holdReason",
	"holdParty",
	"propertyHoldStartDate",
	"holdAgentFullName",
	"inventoryAddress",
	"inventoryGroupName",
	"inventoryGroupDisplayName",
	"isRentControl",
	"isAffordable",
	"layoutName",
	"layoutDisplayName",
	"layoutDescription",
	"numBedrooms",
	"numBathrooms",
	"SQFT",
	"layoutFloorCount",
	"buildingName",
	"buildingDisplayName",
	"buildingType",
	"buildingDescription",
	"buildingFloorCount",
	"buildingAddressLine1",
	"buildingAddressLine2",
	"city",
	"state",
  "postalCode",
	"propertyKey",
	"stateStartDate",
	"availabilityDate",
	"inventoryAmenities",
	"inventoryGroupAmenities",
	"layoutAmenities",
	"buildingAmenities",
	"propertyAmenities"
)
SELECT
	-1 AS "inventoryKey",
	'00000000-0000-0000-0000-000000000000' AS "inventoryId",
	'N/A' AS "inventoryName",
	'N/A' AS "inventoryType",
	'N/A' AS "inventoryDescription",
	-1 AS "floor",
	'N/A' AS "currentState",
	'N/A' AS "externalId",
	'N/A' AS "isOnHold",
	'N/A' AS "holdReason",
	'N/A' AS "holdParty",
	'1900-01-01 00:00:00' AS "propertyHoldStartDate",
	'N/A' AS "holdAgentFullName",
	'N/A' AS "inventoryAddress",
	'N/A' AS "inventoryGroupName",
	'N/A' AS "inventoryGroupDisplayName",
	'N/A' AS "isRentControl",
	'N/A' AS "isAffordable",
	'N/A' AS "layoutName",
	'N/A' AS "layoutDisplayName",
	'N/A' AS "layoutDescription",
	-1 AS "numBedrooms",
	-1 AS "numBathrooms",
	-1 AS "SQFT",
	-1 AS "layoutFloorCount",
	'N/A' AS "buildingName",
	'N/A' AS "buildingDisplayName",
	'N/A' AS "buildingType",
	'N/A' AS "buildingDescription",
	-1 AS "buildingFloorCount",
	'N/A' AS "buildingAddressLine1",
	'N/A' AS "buildingAddressLine2",
	'N/A' AS "city",
	'NA' AS "state",
	'N/A' AS "postalCode",
	-1 AS "propertyKey",
	'1900-01-01 00:00:00' AS "stateStartDate",
	'1900-01-01 00:00:00' AS "availabilityDate",
	'N/A' AS "inventoryAmenities",
	'N/A' AS "inventoryGroupAmenities",
	'N/A' AS "layoutAmenities",
	'N/A' AS "buildingAmenities",
	'N/A' AS "propertyAmenities"
ON CONFLICT ("inventoryKey")
DO UPDATE
	SET
		"inventoryId" = EXCLUDED."inventoryId",
		"inventoryName" = EXCLUDED."inventoryName",
		"inventoryType" = EXCLUDED."inventoryType",
		"inventoryDescription" = EXCLUDED."inventoryDescription",
		"floor" = EXCLUDED."floor",
		"currentState" = EXCLUDED."currentState",
		"externalId" = EXCLUDED."externalId",
		"isOnHold" = EXCLUDED."isOnHold",
		"holdReason" = EXCLUDED."holdReason",
		"holdParty" = EXCLUDED."holdParty",
		"propertyHoldStartDate" = EXCLUDED."propertyHoldStartDate",
		"holdAgentFullName" = EXCLUDED."holdAgentFullName",
		"inventoryAddress" = EXCLUDED."inventoryAddress",
		"inventoryGroupName" = EXCLUDED."inventoryGroupName",
		"inventoryGroupDisplayName" = EXCLUDED."inventoryGroupDisplayName",
		"isRentControl" = EXCLUDED."isRentControl",
		"isAffordable" = EXCLUDED."isAffordable",
		"layoutName" = EXCLUDED."layoutName",
		"layoutDisplayName" = EXCLUDED."layoutDisplayName",
		"layoutDescription" = EXCLUDED."layoutDescription",
		"numBedrooms" = EXCLUDED."numBedrooms",
		"numBathrooms" = EXCLUDED."numBathrooms",
		"SQFT" = EXCLUDED."SQFT",
		"layoutFloorCount" = EXCLUDED."layoutFloorCount",
		"buildingName" = EXCLUDED."buildingName",
		"buildingDisplayName" = EXCLUDED."buildingDisplayName",
		"buildingType" = EXCLUDED."buildingType",
		"buildingDescription" = EXCLUDED."buildingDescription",
		"buildingFloorCount" = EXCLUDED."buildingFloorCount",
		"buildingAddressLine1" = EXCLUDED."buildingAddressLine1",
		"buildingAddressLine2" = EXCLUDED."buildingAddressLine2",
		"city" = EXCLUDED."city",
		"state" = EXCLUDED."state",
		"postalCode" = EXCLUDED."postalCode",
		"propertyKey" = EXCLUDED."propertyKey",
		"stateStartDate" = EXCLUDED."stateStartDate",
		"availabilityDate" = EXCLUDED."availabilityDate",
		"inventoryAmenities" = EXCLUDED."inventoryAmenities",
		"inventoryGroupAmenities" = EXCLUDED."inventoryGroupAmenities",
		"layoutAmenities" = EXCLUDED."layoutAmenities",
		"buildingAmenities" = EXCLUDED."buildingAmenities",
		"propertyAmenities" = EXCLUDED."propertyAmenities";

-- d_Inventory - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Inventory"
(
	"inventoryId",
	"inventoryName",
	"inventoryType",
	"inventoryDescription",
	"floor",
	"currentState",
	"externalId",
	"isOnHold",
	"holdReason",
	"holdParty",
	"propertyHoldStartDate",
	"holdAgentFullName",
	"inventoryAddress",
	"inventoryGroupName",
	"inventoryGroupDisplayName",
	"isRentControl",
	"isAffordable",
	"layoutName",
	"layoutDisplayName",
	"layoutDescription",
	"numBedrooms",
	"numBathrooms",
	"SQFT",
	"layoutFloorCount",
	"buildingName",
	"buildingDisplayName",
	"buildingType",
	"buildingDescription",
	"buildingFloorCount",
	"buildingAddressLine1",
	"buildingAddressLine2",
	"city",
	"state",
	"postalCode",
	"propertyKey",
	"stateStartDate",
	"availabilityDate",
	"inventoryAmenities",
	"inventoryGroupAmenities",
	"layoutAmenities",
	"buildingAmenities",
	"propertyAmenities"
)
SELECT
	i."id" AS "inventoryId",
	i."name" AS "inventoryName",
	i."type" AS "inventoryType",
	COALESCE(i."description",'N/A') AS "inventoryDescription",
	COALESCE(i."floor", -1) AS "floor",
	i."state" AS "currentState",
	i."externalId",
	CASE WHEN ioh.id IS NOT NULL THEN 'Yes' ELSE 'No' END AS "IsOnHold",
	COALESCE(ioh.reason, 'N/A') AS "holdReason",
	CASE WHEN ioh."partyId" IS NOT NULL THEN 'https://maximus.reva.tech/prospect/' || ioh. "partyId" ELSE 'N/A' END AS "holdParty",
	CASE WHEN ioh."startDate" IS NOT NULL THEN ioh."startDate" AT TIME ZONE p.timezone ELSE '1900-01-01 00:00:00' END AS "propertyHoldStartDate",
	COALESCE(hu. "fullName", 'N/A') AS "holdAgentFullName",
	COALESCE (i.address, 'N/A') AS "inventoryAddress",
	ig."name" AS "inventoryGroupName",
	ig."displayName" AS "inventoryGroupDisplayName",
	CASE ig."rentControl" WHEN TRUE THEN 'Yes' ELSE 'No' END AS "isRentControl",
	CASE ig."affordable" WHEN TRUE THEN 'Yes' ELSE 'No' END AS "isAffordable",
	COALESCE(l."name", 'N/A') AS "layoutName",
	COALESCE(l."displayName", 'N/A') AS "layoutDisplayName",
	COALESCE(l."description", 'N/A') AS "layoutDescription",
	COALESCE(l."numBedrooms", -1) AS "numBedrooms",
	COALESCE(l."numBathrooms", -1) AS "numBathrooms",
	COALESCE(l."surfaceArea", -1) AS "SQFT",
	COALESCE(l."floorCount", -1) AS "layoutFloorCount",
	COALESCE(b."name", 'N/A') AS "buildingName",
	COALESCE(b."displayName", 'N/A') AS "buildingDisplayName",
	COALESCE(b."type", 'N/A') AS "buildingType",
	COALESCE(b."description", 'N/A') AS "buldingDescription",
	COALESCE(b."floorCount", -1) AS "buildingFloorCount",
	COALESCE(a."addressLine1", 'N/A') AS "buildingAddressLine1",
	COALESCE(a."addressLine2", 'N/A') AS "buildingAddressLine2",
	COALESCE(a."city", 'N/A') AS "city",
	COALESCE(a."state", 'NA') AS "state",
	COALESCE(a."postalCode", 'N/A') AS "postalCode",
	COALESCE(dp."propertyKey", -1) AS "propertyKey",
	COALESCE(i."stateStartDate" AT TIME ZONE p.timezone, '1900-01-01 00:00:00') AS "stateStartDate",
	COALESCE(i."availabilityDate" AT TIME ZONE p.timezone, '1900-01-01 00:00:00') AS "availabilityDate",
	'N/A' AS "inventoryAmenities",
	'N/A' AS "inventoryGroupAmenities",
	'N/A' AS "layoutAmenities",
	'N/A' AS "buildingAmenities",
	'N/A' AS "propertyAmenities"
FROM "dstReplicaDB"."dstReplicaSchema"."Inventory" AS i
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Inventory' AND lst."needToLoad" = TRUE
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS p ON i."propertyId" = p.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Layout" AS l ON i."layoutId" = l.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Building" AS b ON i."buildingId" = b.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."InventoryGroup" AS ig ON i."inventoryGroupId" = ig.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Address" AS a ON b."addressId" = a.id
	LEFT JOIN
		(SELECT *, ROW_NUMBER() OVER (PARTITION BY "inventoryId" ORDER BY created_at) AS ord
		 FROM "dstReplicaDB"."dstReplicaSchema"."InventoryOnHold"
		 WHERE "endDate" IS NULL) -- TODO: treat case when an inventory is put on hold multiple times
	 AS ioh ON ioh. "inventoryId" = i.id AND ioh.ord = 1
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS hu ON hu.id = ioh. "heldBy"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dp ON p.id = dp."propertyId"
	LEFT JOIN LATERAL (SELECT MAX("inventoryKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Inventory" WHERE "inventoryKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
		OR i.updated_at > lst."loadDate"
  	OR l.updated_at > lst."loadDate"
		OR b.updated_at > lst."loadDate"
		OR ig.updated_at > lst."loadDate"
		OR a.updated_at > lst."loadDate"
		OR ioh.updated_at > lst."loadDate"
ON CONFLICT ("inventoryId")
DO UPDATE
	SET
		"inventoryName" = EXCLUDED."inventoryName",
		"inventoryType" = EXCLUDED."inventoryType",
		"inventoryDescription" = EXCLUDED."inventoryDescription",
		"floor" = EXCLUDED."floor",
		"currentState" = EXCLUDED."currentState",
		"externalId" = EXCLUDED."externalId",
		"isOnHold" = EXCLUDED."isOnHold",
		"holdReason" = EXCLUDED."holdReason",
		"holdParty" = EXCLUDED."holdParty",
		"propertyHoldStartDate" = EXCLUDED."propertyHoldStartDate",
		"holdAgentFullName" = EXCLUDED."holdAgentFullName",
		"inventoryAddress" = EXCLUDED."inventoryAddress",
		"inventoryGroupName" = EXCLUDED."inventoryGroupName",
		"inventoryGroupDisplayName" = EXCLUDED."inventoryGroupDisplayName",
		"isRentControl" = EXCLUDED."isRentControl",
		"isAffordable" = EXCLUDED."isAffordable",
		"layoutName" = EXCLUDED."layoutName",
		"layoutDisplayName" = EXCLUDED."layoutDisplayName",
		"layoutDescription" = EXCLUDED."layoutDescription",
		"numBedrooms" = EXCLUDED."numBedrooms",
		"numBathrooms" = EXCLUDED."numBathrooms",
		"SQFT" = EXCLUDED."SQFT",
		"layoutFloorCount" = EXCLUDED."layoutFloorCount",
		"buildingName" = EXCLUDED."buildingName",
		"buildingDisplayName" = EXCLUDED."buildingDisplayName",
		"buildingType" = EXCLUDED."buildingType",
		"buildingDescription" = EXCLUDED."buildingDescription",
		"buildingFloorCount" = EXCLUDED."buildingFloorCount",
		"buildingAddressLine1" = EXCLUDED."buildingAddressLine1",
		"buildingAddressLine2" = EXCLUDED."buildingAddressLine2",
		"city" = EXCLUDED."city",
		"state" = EXCLUDED."state",
		"postalCode" = EXCLUDED."postalCode",
		"propertyKey" = EXCLUDED."propertyKey",
		"stateStartDate" = EXCLUDED."stateStartDate",
		"availabilityDate" = EXCLUDED."availabilityDate",
		"inventoryAmenities" = EXCLUDED."inventoryAmenities",
		"inventoryGroupAmenities" = EXCLUDED."inventoryGroupAmenities",
		"layoutAmenities" = EXCLUDED."layoutAmenities",
		"buildingAmenities" = EXCLUDED."buildingAmenities",
		"propertyAmenities" = EXCLUDED."propertyAmenities";

-- d_Inventory - UPDATE AMENITIES
UPDATE "dstStarDB"."dstStarSchema"."d_Inventory" upd
	SET
		"inventoryAmenities" = COALESCE(invAmen."inventoryAmenities", 'N/A'),
		"inventoryGroupAmenities" = COALESCE(invGrAmen."inventoryGroupAmenities", 'N/A'),
		"layoutAmenities" = COALESCE(layAmen."layoutAmenities", 'N/A'),
		"buildingAmenities" = COALESCE(buildAmen."buildingAmenities", 'N/A'),
		"propertyAmenities" = COALESCE(propAmen."propertyAmenities", 'N/A')
FROM "dstReplicaDB"."dstReplicaSchema"."Inventory" i
	LEFT JOIN
		(SELECT
		    ia."inventoryId",
		    string_agg(a.name, ' | ' ORDER BY a.name) AS "inventoryAmenities"
		FROM
		    "dstReplicaDB"."dstReplicaSchema"."Amenity" a
		    INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Inventory_Amenity" ia ON ia."amenityId" = a.id
		GROUP BY
		    ia."inventoryId"
		) invAmen ON i.id = invAmen."inventoryId"
	LEFT JOIN
		(SELECT
		    ia."inventoryGroupId",
		    string_agg(a.name, ' | ' ORDER BY a.name) AS "inventoryGroupAmenities"
		FROM
		    "dstReplicaDB"."dstReplicaSchema"."Amenity" a
		    INNER JOIN "dstReplicaDB"."dstReplicaSchema"."InventoryGroup_Amenity" ia ON ia."amenityId" = a.id
		GROUP BY
		    ia."inventoryGroupId"
		) invGrAmen ON i."inventoryGroupId" = invGrAmen."inventoryGroupId"
	LEFT JOIN
		(SELECT
		    ia."buildingId",
		    string_agg(a.name, ' | ' ORDER BY a.name) AS "buildingAmenities"
		FROM
		    "dstReplicaDB"."dstReplicaSchema"."Amenity" a
		    INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Building_Amenity" ia ON ia."amenityId" = a.id
		GROUP BY
		    ia."buildingId"
		) buildAmen ON i."buildingId" = buildAmen."buildingId"
	LEFT JOIN
		(SELECT
		    ia."layoutId",
		    string_agg(a.name, ' | ' ORDER BY a.name) AS "layoutAmenities"
		FROM
		    "dstReplicaDB"."dstReplicaSchema"."Amenity" a
		    INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Layout_Amenity" ia ON ia."amenityId" = a.id
		GROUP BY
		    ia."layoutId"
		) layAmen ON i."layoutId" = layAmen."layoutId"
	LEFT JOIN
		(SELECT
		    a."propertyId",
		    string_agg(a.name, ' | ' ORDER BY a.name) AS "propertyAmenities"
		FROM
		    "dstReplicaDB"."dstReplicaSchema"."Amenity" a
		WHERE a.category = 'property'
		GROUP BY
		    a."propertyId"
		) propAmen ON i."propertyId" = propAmen."propertyId"
WHERE (SELECT max(created_at) FROM "dstReplicaDB"."dstReplicaSchema"."Inventory_Amenity") >
	(SELECT "loadDate" FROM "dstStarDB"."dstStarSchema"."s_LastLoadDate" WHERE "tableName" = 'd_Inventory')
	AND upd."inventoryId" = i.id;

-- set d_Inventory as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Inventory', 'resultPrevInstr', 'final');

-- d_Communication - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Communication"
(
	"communicationKey",
	"communicationId",
	"utcCreatedDate",
	"threadId",
	"orderInThread",
	"commType",
	"direction",
	"from",
	"to",
	"category",
	"commSource",
	"commProgram",
	"unread",
	"readDate",
	"commCampaignSource",
	"commCampaign",
	"messageText",
	"messageType",
	"commMarketingSessionId"
)
SELECT
	-1 AS "communicationKey",
	'00000000-0000-0000-0000-000000000000' AS "communicationId",
	'1900-01-01 00:00:00' AS "utcCreatedDate",
	'N/A' AS "threadId",
	-1 AS "orderInThread",
	'N/A' AS "commType",
	'N/A' AS "direction",
	'N/A' AS "from",
	'N/A' AS "to",
	'N/A' AS "category",
	'N/A' AS "commSource",
	'N/A' AS "commProgram",
	'N/A' AS "unread",
	'1900-01-01 00:00:00' AS "readDate",
	'N/A' AS "commCampaignSource",
	'N/A' AS "commCampaign",
	'N/A' AS "messageText",
	'N/A' as "messageType",
	'N/A' AS "commMarketingSessionId"
ON CONFLICT ("communicationKey")
DO UPDATE
	SET
		"communicationId" = EXCLUDED."communicationId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"threadId" = EXCLUDED."threadId",
		"orderInThread" = EXCLUDED."orderInThread",
		"commType" = EXCLUDED."commType",
		"direction" = EXCLUDED."direction",
		"from" = EXCLUDED."from",
		"to" = EXCLUDED."to",
		"category" = EXCLUDED."category",
		"commSource" = EXCLUDED."commSource",
		"commProgram" = EXCLUDED."commProgram",
		"unread" = EXCLUDED."unread",
		"readDate" = EXCLUDED."readDate",
		"commCampaignSource" = EXCLUDED."commCampaignSource",
		"commCampaign" = EXCLUDED."commCampaign",
		"messageText" = EXCLUDED."messageText",
		"messageType" = EXCLUDED."messageType",
		"commMarketingSessionId" = EXCLUDED."commMarketingSessionId";

-- d_Communication - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Communication"
(
	"communicationId",
	"utcCreatedDate",
	"threadId",
	"orderInThread",
	"commType",
	"direction",
	"from",
	"to",
	"category",
	"commSource",
	"commProgram",
	"unread",
	"readDate",
	"commCampaignSource",
	"commCampaign",
	"messageText",
	"messageType",
	"commMarketingSessionId"
)
SELECT
	c.id AS "communicationId",
	c.created_at AS "utcCreatedDate",
	COALESCE(c."threadId", 'N/A') AS "threadId",
	row_number() OVER (PARTITION BY "threadId" ORDER BY c.created_at) AS "orderInThread",
	c."type" AS "commType",
	COALESCE(c.direction, 'N/A') AS direction,
	CASE
		WHEN c.TYPE IN ('Call', 'Sms') THEN COALESCE(c.message ->> 'from'::text, c.message ->> 'fromNumber'::text,'N/A')
		WHEN c.TYPE = 'Email' THEN COALESCE(c.message ->> 'from'::text, 'N/A')
		WHEN c.TYPE = 'Web' THEN COALESCE(c.message ->> 'from'::text, c.message -> 'rawMessageData' ->> 'email', 'N/A')
		ELSE 'N/A'
	END AS "from",
	CASE
		WHEN c.TYPE IN ('Call', 'Sms') THEN COALESCE(c.message #>> '{rawMessage,To}'::text[], replace(REPLACE(replace(replace(c.message ->> 'to'::text,'["',''),'"]',''),'","',','),'", "',','), c.message ->> 'toNumber'::text, 'N/A')
		WHEN c.TYPE = 'Email' THEN COALESCE(REPLACE(replace(replace(c.message ->> 'to'::text,'["',''),'"]',''),'","',','),'N/A')
		WHEN c.TYPE = 'Web' THEN COALESCE(c.message ->> 'to'::text, c.message -> 'rawMessageData' ->> 'teamEmail', 'N/A')
		ELSE 'N/A'
	END AS "to",
	COALESCE(c.category, 'N/A') AS "category",
	COALESCE((c.message -> 'programData'::text) ->> 'source'::text, 'N/A') AS "commSource",
  COALESCE((c.message -> 'programData'::text) ->> 'programId'::text, 'N/A') AS "commProgram",
  CASE WHEN c.unread = true THEN 'Yes' ELSE 'No' END aS "unread",
	NULL AS "readDate",
	COALESCE((message -> 'campaignData' ->> 'source')::varchar,'N/A') AS "commCampaignSource",
	COALESCE((message -> 'campaignData' ->> 'campaignId')::varchar,'N/A') AS "commCampaign",
	COALESCE(message ->> 'text'::text,'N/A') AS "messageText",
	COALESCE(message ->> 'type'::varchar,'N/A') AS "messageType",
	COALESCE((message -> 'rawMessageData' ->> 'marketingSessionId')::varchar,'N/A') AS "commMarketingSessionId"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Communication' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("communicationKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Communication" WHERE "communicationKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
  	OR c.updated_at > lst."loadDate"
ON CONFLICT ("communicationId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"threadId" = EXCLUDED."threadId",
		"commType" = EXCLUDED."commType",
		"direction" = EXCLUDED."direction",
		"from" = EXCLUDED."from",
		"to" = EXCLUDED."to",
		"category" = EXCLUDED."category",
		"commSource" = EXCLUDED."commSource",
		"commProgram" = EXCLUDED."commProgram",
		"readDate" = EXCLUDED."readDate",
		"commCampaignSource" = EXCLUDED."commCampaignSource",
		"commCampaign" = EXCLUDED."commCampaign",
		"messageText" = EXCLUDED."messageText",
		"messageType" = EXCLUDED."messageType",
		"commMarketingSessionId" = EXCLUDED."commMarketingSessionId"
		;

-- set d_Communication as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Communication', 'resultPrevInstr', 'final');

-- b_Communication_Team - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Communication_Team"
(
	"communicationTeamKey",
	"communicationKey",
	"teamKey"
)
SELECT
	-1,
	-1,
	-1
ON CONFLICT ("communicationTeamKey")
DO UPDATE
	SET
		"communicationKey" = EXCLUDED."communicationKey",
		"teamKey" = EXCLUDED."teamKey";

-- b_Communication_Team - UPSERT
WITH srcCommTeam AS
(
	SELECT c.id AS "communicationId",
		unnest(teams)::uuid AS "teamId"
	FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Communication_Team' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("communicationTeamKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Communication_Team" WHERE "communicationTeamKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
  	OR c.updated_at > lst."loadDate"
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_Communication_Team"
(
	"communicationKey",
	"teamKey"
)
SELECT
	dc."communicationKey",
	dt."teamKey"
FROM srcCommTeam src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Communication" dc ON src."communicationId" = dc."communicationId"
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Team" AS dt ON src."teamId" = dt."teamId"
ON CONFLICT ("communicationKey","teamKey")
DO NOTHING;

-- set b_Communication_Team as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Communication_Team', 'resultPrevInstr', 'final');

-- b_Communication_Person - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Communication_Person"
(
	"communicationPersonKey",
	"communicationKey",
	"personKey"
)
SELECT
	-1,
	-1,
	-1
ON CONFLICT ("communicationPersonKey")
DO UPDATE
	SET
		"communicationKey" = EXCLUDED."communicationKey",
		"personKey" = EXCLUDED."personKey";

-- b_Communication_Person - UPSERT
WITH srcCommPerson AS
(
	SELECT c.id AS "communicationId",
		unnest(persons)::uuid AS "personId"
	FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Communication_Person' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("communicationPersonKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Communication_Person" WHERE "communicationPersonKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
  	OR c.updated_at > lst."loadDate"
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_Communication_Person"
(
	"communicationKey",
	"personKey"
)
SELECT
	dc."communicationKey",
	dp."personKey"
FROM srcCommPerson src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Communication" dc ON src."communicationId" = dc."communicationId"
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Person" AS dp ON src."personId" = dp."personId" AND dp."SCD_isCurrent" = 'Yes'
ON CONFLICT ("communicationKey","personKey")
DO NOTHING;

-- set b_Communication_Person as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Communication_Person', 'resultPrevInstr', 'final');

-- d_Call - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Call" (
	"callKey",
	"callId",
	"userFullName",
	"direction",
	"fromNumber",
	"toNumber",
	"utcPickUpDate",
	"utcHangUpDate",
	"callDuration",
	"callSeconds",
	"dialStatus",
	"isMissed",
	"isVoiceMail",
	"voiceMailDuration",
	"voiceMailSeconds",
	"talkDuration",
	"talkSeconds",
	"utcQueueEntryTime",
	"utcQueueExitTime",
	"queueAgentFullName",
	"queueCallerRequestedAction",
	"queueCalledBack",
	"queueCallBackTime",
	"queueMinutesToCallBack",
	"queueCallbackCommunicationId",
	"queueHangUp",
	"queueTransferredToVoiceMail",
	"transferredFrom",
	"transferredTo",
	"communicationKey",
	"answeringTeam",
	"isRecorded",
	"messageIsDeclined",
	"messageNotes"
)
SELECT
	-1 AS "callKey",
	'00000000-0000-0000-0000-000000000000' AS "callId",
	'N/A' AS "userFullName",
	'N/A' AS "direction",
	'N/A' AS "fromNumber",
	'N/A' AS "toNumber",
	'1900-01-01 00:00:00.000' AS "utcPickUpDate",
	'1900-01-01 00:00:00.000' AS "utcHangUpDate",
	'00:00:00' AS "callDuration",
	0 AS "callSeconds",
	'N/A' AS "dialStatus",
	'N/A' AS "isMissed",
	'N/A' AS "isVoiceMail",
	'00:00:00' AS "voiceMailDuration",
	0 AS "voiceMailSeconds",
	'00:00:00' AS "talkDuration",
	0 AS "talkSeconds",
	'1900-01-01 00:00:00.000' AS "utcQueueEntryTime",
	'1900-01-01 00:00:00.000' AS "utcQueueExitTime",
	'N/A' AS "queueAgentFullName",
	'N/A' AS "queueCallerRequestedAction",
	'N/A' AS "queueCalledBack",
	'1900-01-01 00:00:00.000' AS "queueCallBackTime",
	0 AS "queueMinutesToCallBack",
	'00000000-0000-0000-0000-000000000000' AS "queueCallbackCommunicationId",
	'N/A' AS "queueHangUp",
	'N/A' AS "queueTransferredToVoiceMail",
	'00000000-0000-0000-0000-000000000000' AS "transferredFrom",
	'00000000-0000-0000-0000-000000000000' AS "transferredTo",
	-1 AS "communicationKey",
	'N/A' as "answeringTeam",
	'N/A' as "isRecorded",
	'N/A' as "messageIsDeclined",
	'N/A' as "messageNotes"
ON CONFLICT ("callKey")
DO UPDATE
	SET
		"callId" = EXCLUDED."callId",
		"userFullName" = EXCLUDED."userFullName",
		"direction" = EXCLUDED."direction",
		"fromNumber" = EXCLUDED."fromNumber",
		"toNumber" = EXCLUDED."toNumber",
		"utcPickUpDate" = EXCLUDED."utcPickUpDate",
		"utcHangUpDate" = EXCLUDED."utcHangUpDate",
		"callDuration" = EXCLUDED."callDuration",
		"callSeconds" = EXCLUDED."callSeconds",
		"dialStatus" = EXCLUDED."dialStatus",
		"isMissed" = EXCLUDED."isMissed",
		"isVoiceMail" = EXCLUDED."isVoiceMail",
		"voiceMailDuration" = EXCLUDED."voiceMailDuration",
		"voiceMailSeconds" = EXCLUDED."voiceMailSeconds",
		"talkDuration" = EXCLUDED."talkDuration",
		"talkSeconds" = EXCLUDED."talkSeconds",
		"utcQueueEntryTime" = EXCLUDED."utcQueueEntryTime",
		"utcQueueExitTime" = EXCLUDED."utcQueueExitTime",
		"queueAgentFullName" = EXCLUDED."queueAgentFullName",
		"queueCallerRequestedAction" = EXCLUDED."queueCallerRequestedAction",
		"queueCalledBack" = EXCLUDED."queueCalledBack",
		"queueCallBackTime" = EXCLUDED."queueCallBackTime",
		"queueMinutesToCallBack" = EXCLUDED."queueMinutesToCallBack",
		"queueCallbackCommunicationId" = EXCLUDED."queueCallbackCommunicationId",
		"queueHangUp" = EXCLUDED."queueHangUp",
		"queueTransferredToVoiceMail" = EXCLUDED."queueTransferredToVoiceMail",
		"transferredFrom" = EXCLUDED."transferredFrom",
		"transferredTo" = EXCLUDED."transferredTo",
		"communicationKey" = EXCLUDED."communicationKey",
		"answeringTeam" = EXCLUDED."answeringTeam",
		"isRecorded" = EXCLUDED."isRecorded",
		"messageIsDeclined" = EXCLUDED."messageIsDeclined",
		"messageNotes" = EXCLUDED."messageNotes"
		;

-- d_Call - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_Call" (
	"callId",
	"userFullName",
	"direction",
	"fromNumber",
	"toNumber",
	"utcPickUpDate",
	"utcHangUpDate",
	"callDuration",
	"callSeconds",
	"dialStatus",
	"isMissed",
	"isVoiceMail",
	"voiceMailDuration",
	"voiceMailSeconds",
	"talkDuration",
	"talkSeconds",
	"utcQueueEntryTime",
	"utcQueueExitTime",
	"queueAgentFullName",
	"queueCallerRequestedAction",
	"queueCalledBack",
	"queueCallBackTime",
	"queueMinutesToCallBack",
	"queueCallbackCommunicationId",
	"queueHangUp",
	"queueTransferredToVoiceMail",
	"transferredFrom",
	"transferredTo",
	"communicationKey",
	"answeringTeam",
	"isRecorded",
	"messageIsDeclined",
	"messageNotes"
)
SELECT
	c.id AS "callId",
	COALESCE(u."fullName", 'N/A') AS "userFullName",
	COALESCE(c.direction, 'N/A') as direction,
	COALESCE(c.message ->> 'from'::text, c.message ->> 'fromNumber'::text,'N/A') AS "fromNumber",
	COALESCE(c.message #>> '{rawMessage,To}'::text[], c.message ->> 'to'::text, c.message ->> 'toNumber'::text, 'N/A') AS "toNumber",
	c.created_at AS "utcPickUpDate",
	COALESCE((det.details ->> 'endTime'::text)::timestamp with time zone, '1900-01-01 00:00:00.000') AS "utcHangUpDate",
	'00:'::text || COALESCE((c.message ->> 'duration'::text),'00:00') AS "callDuration",
	COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) AS "callSeconds",
	COALESCE(c.message ->> 'dialStatus'::text, 'N/A'::text) AS "dialStatus",
	CASE WHEN COALESCE(c.message ->> 'isMissed'::text, 'false'::text)::boolean = true THEN 'Yes' ELSE 'No' END AS "isMissed",
	CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = true THEN 'Yes' ELSE 'No' END AS "isVoiceMail",
	CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = true THEN '00:'::text || (c.message ->> 'duration'::text) ELSE '00:00:00'::text END AS "voiceMailDuration",
	CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = true THEN date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::int ELSE 0::int END AS "voiceMailSeconds",
	CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = false AND COALESCE(c.message ->> 'isMissed'::text, 'false'::text)::boolean = false THEN '00:'::text || COALESCE((c.message ->> 'duration'::text), '00:00') ELSE '00:00:00'::text END AS "talkDuration",
	CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = false AND COALESCE(c.message ->> 'isMissed'::text, 'false'::text)::boolean = false THEN COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::int,0) ELSE 0::int END AS "talkSeconds",
	COALESCE(cqs."entryTime", '1900-01-01 00:00:00.000') AS "utcQueueEntryDate",
	COALESCE(cqs."exitTime", '1900-01-01 00:00:00.000') AS "utcQueueExitTime",
	COALESCE(cqsu."fullName", 'N/A') AS "queueAgentFullName",
	COALESCE(cqs."callerRequestedAction", 'N/A') AS "callerRequestedAction",
	CASE WHEN cqs."callBackTime" IS NOT NULL THEN 'Yes' ELSE 'No' END AS "calledBack",
	COALESCE(cqs."callBackTime", '1900-01-01 00:00:00.000') AS "utcCallBackDate",
	CASE WHEN cqs."callBackTime" IS NOT NULL THEN COALESCE((date_part('epoch'::text, date_trunc('minute'::text, cqs."callBackTime") - date_trunc('minute'::text, cqs."exitTime")) / 60)::int,0) ELSE 0::int END AS "minutesToCallBack",
	COALESCE(cqs."callBackCommunicationId", '00000000-0000-0000-0000-000000000000') AS "callBackCommunicationId",
	CASE WHEN cqs."hangUp" = TRUE THEN 'Yes' ELSE 'No' END AS "hangUp",
	CASE WHEN cqs."transferredToVoiceMail" = TRUE THEN 'Yes' ELSE 'No' END AS "transferredToVoiceMail",
	COALESCE(c."transferredFromCommId", '00000000-0000-0000-0000-000000000000') AS "transferredFrom",
	COALESCE(ttc.id, '00000000-0000-0000-0000-000000000000') AS "transfferedTo",
	dc."communicationKey",
	'N/A' AS "answeringTeam",
	CASE WHEN COALESCE(c.message ->> 'isRecorded'::text, 'false'::text)::boolean = true THEN 'Yes' ELSE 'No' END AS "isRecorded",
	coalesce(c.message ->> 'isDeclined'::varchar,'N/A') as "messageIsDeclined",
	coalesce(c.message ->> 'notes'::text,'N/A') as "messageNotes"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Communication" dc on c.id = dc."communicationId"
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Call' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" AS u ON c."userId" = u.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."CallDetails" AS det ON c.id = det."commId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."CallQueueStatistics" AS cqs ON c.id = cqs."communicationId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" cqsu ON cqsu.id = cqs."userId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Communication" ttc ON c.id = ttc."transferredFromCommId"
	LEFT JOIN LATERAL (SELECT MAX("callKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Call" WHERE "callKey" <> -1) AS dim ON TRUE
WHERE c.TYPE = 'Call'
		AND (
		dim."hasData" IS NULL
  	OR c.updated_at > lst."loadDate"
		OR det.updated_at > lst."loadDate"
		)
ON CONFLICT ("callId")
DO UPDATE
	SET
		"userFullName" = EXCLUDED."userFullName",
		"direction" = EXCLUDED."direction",
		"fromNumber" = EXCLUDED."fromNumber",
		"toNumber" = EXCLUDED."toNumber",
		"utcPickUpDate" = EXCLUDED."utcPickUpDate",
		"utcHangUpDate" = EXCLUDED."utcHangUpDate",
		"callDuration" = EXCLUDED."callDuration",
		"callSeconds" = EXCLUDED."callSeconds",
		"dialStatus" = EXCLUDED."dialStatus",
		"isMissed" = EXCLUDED."isMissed",
		"isVoiceMail" = EXCLUDED."isVoiceMail",
		"voiceMailDuration" = EXCLUDED."voiceMailDuration",
		"voiceMailSeconds" = EXCLUDED."voiceMailSeconds",
		"talkDuration" = EXCLUDED."talkDuration",
		"talkSeconds" = EXCLUDED."talkSeconds",
		"utcQueueEntryTime" = EXCLUDED."utcQueueEntryTime",
		"utcQueueExitTime" = EXCLUDED."utcQueueExitTime",
		"queueAgentFullName" = EXCLUDED."queueAgentFullName",
		"queueCallerRequestedAction" = EXCLUDED."queueCallerRequestedAction",
		"queueCalledBack" = EXCLUDED."queueCalledBack",
		"queueCallBackTime" = EXCLUDED."queueCallBackTime",
		"queueMinutesToCallBack" = EXCLUDED."queueMinutesToCallBack",
		"queueCallbackCommunicationId" = EXCLUDED."queueCallbackCommunicationId",
		"queueHangUp" = EXCLUDED."queueHangUp",
		"queueTransferredToVoiceMail" = EXCLUDED."queueTransferredToVoiceMail",
		"transferredFrom" = EXCLUDED."transferredFrom",
		"transferredTo" = EXCLUDED."transferredTo",
		"communicationKey" = EXCLUDED."communicationKey",
		"answeringTeam" = EXCLUDED."answeringTeam",
		"isRecorded" = EXCLUDED."isRecorded",
		"messageIsDeclined" = EXCLUDED."messageIsDeclined",
		"messageNotes" = EXCLUDED."messageNotes";

-- update d_Call set answeringTeam
WITH "AnswTeams" AS (
    SELECT
        t."displayName",
        u.id as "userId",
        p.name,
        t.module
    FROM "dstReplicaDB"."dstReplicaSchema"."TeamMembers" pm
        JOIN "dstReplicaDB"."dstReplicaSchema"."Users" u ON pm."userId" = u.id
        JOIN "dstReplicaDB"."dstReplicaSchema"."Teams" t ON t.id = pm."teamId"
        JOIN "dstReplicaDB"."dstReplicaSchema"."TeamProperties" tp ON tp."teamId" = t.id
        JOIN "dstReplicaDB"."dstReplicaSchema"."Property" p ON tp."propertyId" = p.id
    WHERE pm.inactive = false
),
"CommParties" AS (
	SELECT c.id, unnest(parties)::uuid AS "partyId",
		COALESCE(c.message #>> '{rawMessage,To}'::text[], c.message ->> 'to'::text, c.message ->> 'toNumber'::text) AS "toNumber",
		created_at,
		"partyOwner",
		"calledTeam"
	FROM "dstReplicaDB"."dstReplicaSchema"."Communication" c
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Call' AND lst."needToLoad" = TRUE
	WHERE TYPE = 'Call'
		AND direction = 'in'
		AND c.updated_at >= lst."loadDate"
)
UPDATE "dstStarDB"."dstStarSchema"."d_Call" upd
	SET "answeringTeam" = COALESCE(
	CASE WHEN t."displayName" <> 'The HUB' THEN t."displayName"
		 ELSE (
            SELECT t."displayName"
            FROM "AnswTeams" t
            WHERE t."userId" = cp."partyOwner"
                AND ( t.name = assignprop.name
                    OR assignprop.name IS NULL )
            ORDER BY t.module
            LIMIT 1)
    END, 'N/A')
FROM "CommParties" cp
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Party" p ON cp."partyId" = p.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" assignprop ON assignprop.id = p."assignedPropertyId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Teams" t ON cp."calledTeam" = t.id
WHERE upd."callId" = cp.id;

-- set d_Call as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Call', 'resultPrevInstr', 'final');

-- d_InventoryPrice - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryPrice"
(
	"inventoryPriceKey",
	"inventoryKey",
	"SCD_startDate",
	"SCD_endDate",
	"SCD_changeReason",
	"SCD_isCurrent",
	"basePrice",
	"amenitiesTotalPrice",
	"totalPrice"
)
SELECT
	-1 AS "inventoryPriceKey",
	-1 AS "inventoryKey",
	'1900-01-01 00:00:00' AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	'default value' AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	0.00::numeric(7,2) AS "basePrice",
	0.00::numeric(7,2) AS "amenitiesTotalPrice",
	0.00::numeric(7,2) AS "totalPrice"
ON CONFLICT ("inventoryPriceKey")
DO UPDATE
	SET
		"inventoryKey" = EXCLUDED."inventoryKey",
		"SCD_startDate" = EXCLUDED."SCD_startDate",
		"SCD_endDate" = EXCLUDED."SCD_endDate",
		"SCD_changeReason" = EXCLUDED."SCD_changeReason",
		"SCD_isCurrent" = EXCLUDED."SCD_isCurrent",
		"basePrice" = EXCLUDED."basePrice",
		"amenitiesTotalPrice" = EXCLUDED."amenitiesTotalPrice",
		"totalPrice" = EXCLUDED."totalPrice";

-- d_InventoryPrice - Step 1 - update end interval date for changed records
WITH sourceETL AS (
SELECT
	di."inventoryKey" AS "inventoryKey",
	COALESCE(ig."basePriceMonthly", 0.00::numeric(7,2)) AS "basePrice",
	COALESCE(amen."amenities", 0.00::numeric(7,2)) AS "amenitiesTotalPrice",
	COALESCE(ig."basePriceMonthly" , 0.00::numeric(7,2)) + COALESCE(amen."amenities", 0.00::numeric(7,2)) AS "totalPrice"
FROM "dstReplicaDB"."dstReplicaSchema"."Inventory" AS i
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryPrice' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."InventoryGroup" AS ig ON i."inventoryGroupId" = ig.id
 	LEFT JOIN (
    SELECT
      ia. "inventoryId",
      SUM(a."absolutePrice") AS "amenities",
			MAX(ia.updated_at) AS updated_at,
			MAX(a.updated_at) AS updated_at_a
    FROM "dstReplicaDB"."dstReplicaSchema"."Amenity" AS a
    	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Inventory_Amenity" AS ia ON ia. "amenityId" = a.id
    GROUP BY ia."inventoryId") AS amen ON amen. "inventoryId" = i.id
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di ON i."id" = di."inventoryId"
	LEFT JOIN LATERAL (SELECT MAX(d."inventoryPriceKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryPrice" AS d WHERE "inventoryPriceKey" <> -1) AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR i.updated_at > lst."loadDate"
	OR ig.updated_at > lst."loadDate"
	OR amen.updated_at > lst."loadDate"
	OR amen.updated_at_a > lst."loadDate"
), sourceETLmd5 AS
(
SELECT "inventoryKey",
	md5(ROW(
		"inventoryKey",
		"basePrice",
		"amenitiesTotalPrice",
		"totalPrice"
	)::TEXT) AS "inventoryPriceHashKey"
FROM sourceETL
)
UPDATE "dstStarDB"."dstStarSchema"."d_InventoryPrice" AS d
	SET "SCD_endDate" = now()
	, "SCD_isCurrent" = 'No'
FROM "dstStarDB"."dstStarSchema"."vw_d_InventoryPrice" AS v
	INNER JOIN sourceETLmd5 AS src ON src."inventoryKey" = v."inventoryKey" AND src."inventoryPriceHashKey" <> v."inventoryPriceHashKey"
WHERE d."inventoryPriceKey" = v."inventoryPriceKey";

-- cancel all table loadings depending on d_InventoryPrice
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryPrice', 'resultPrevInstr', 'intermediary');

-- d_InventoryPrice - Step 2 - insert new rows for added/changed records
WITH ip_ord AS
(
SELECT "inventoryKey", "SCD_isCurrent" AS lst,
	ROW_NUMBER() OVER (PARTITION BY "inventoryKey" ORDER BY "SCD_endDate" DESC) AS rn
FROM "dstStarDB"."dstStarSchema"."d_InventoryPrice"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryPrice"
	(
		"inventoryKey",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"basePrice",
		"amenitiesTotalPrice",
		"totalPrice"
	)
SELECT
	di."inventoryKey" AS "inventoryKey",
	CASE WHEN ipo.lst IS NULL THEN i.created_at ELSE now() END AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	CASE WHEN ipo.lst IS NULL THEN 'insert' ELSE 'update' END AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	COALESCE(ig."basePriceMonthly", 0.00::numeric(7,2)) AS "basePrice",
	COALESCE(amen."amenities", 0.00::numeric(7,2)) AS "amenitiesTotalPrice",
	COALESCE(ig."basePriceMonthly" , 0.00::numeric(7,2)) + COALESCE(amen."amenities", 0.00::numeric(7,2)) AS "totalPrice"
FROM "dstReplicaDB"."dstReplicaSchema"."Inventory" AS i
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryPrice' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."InventoryGroup" AS ig ON i."inventoryGroupId" = ig.id
 	LEFT JOIN (
    SELECT
      ia. "inventoryId",
      SUM(a."absolutePrice") AS "amenities",
			MAX(ia.updated_at) AS updated_at,
			MAX(a.updated_at) AS updated_at_a
    FROM "dstReplicaDB"."dstReplicaSchema"."Amenity" AS a
    	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Inventory_Amenity" AS ia ON ia. "amenityId" = a.id
    GROUP BY ia."inventoryId") amen ON amen. "inventoryId" = i.id
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di ON i."id" = di."inventoryId"
	LEFT JOIN ip_ord AS ipo ON di."inventoryKey" = ipo."inventoryKey" AND ipo.rn = 1
	LEFT JOIN LATERAL (SELECT MAX(d."inventoryPriceKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryPrice" AS d WHERE "inventoryPriceKey" <> -1) AS dim ON TRUE
WHERE (ipo.lst = 'No' OR ipo.lst IS null)
	AND (dim."hasData" IS NULL
		OR i.updated_at > lst."loadDate"
		OR ig.updated_at > lst."loadDate"
		OR amen.updated_at > lst."loadDate"
		OR amen.updated_at_a > lst."loadDate");

-- set d_InventoryPrice as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryPrice', 'resultPrevInstr', 'final');

-- d_InventoryState - default - SCD2
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryState"
(
	"inventoryStateKey",
	"inventoryKey",
	"SCD_startDate",
	"SCD_endDate",
	"SCD_changeReason",
	"SCD_isCurrent",
	"state"
)
SELECT
	-1 AS "inventoryStateKey",
	-1 AS "inventoryKey",
	'1900-01-01 00:00:00' AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	'default value' AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	'N/A' AS "state "
ON CONFLICT ("inventoryStateKey")
DO UPDATE
	SET
		"inventoryKey" = EXCLUDED."inventoryKey",
		"SCD_startDate" = EXCLUDED."SCD_startDate",
		"SCD_endDate" = EXCLUDED."SCD_endDate",
		"SCD_changeReason" = EXCLUDED."SCD_changeReason",
		"SCD_isCurrent" = EXCLUDED."SCD_isCurrent",
		"state" = EXCLUDED."state";

-- d_InventoryState - Step 1 - update end interval date for changed records
UPDATE "dstStarDB"."dstStarSchema"."d_InventoryState" AS d
	SET "SCD_endDate" = now()
	, "SCD_isCurrent" = 'No'
FROM "dstStarDB"."dstStarSchema"."d_Inventory" AS src
  INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryState' AND lst."needToLoad" = TRUE
  LEFT JOIN LATERAL (SELECT MAX(d."inventoryStateKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryState" AS d WHERE "inventoryStateKey" <> -1) AS dim ON TRUE
WHERE src."inventoryKey" = d."inventoryKey" AND src."state" <> d."state"
  AND d."inventoryStateKey" <> -1
  AND (dim."hasData" IS NULL
	OR src.updated_at > lst."loadDate");

-- cancel all table loadings depending on d_InventoryState
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryState', 'resultPrevInstr', 'intermediary');

-- d_InventoryState - Step 2 - insert new rows for added/changed records
WITH is_ord AS
(
SELECT "inventoryKey", "SCD_isCurrent" AS lst,
	ROW_NUMBER() OVER (PARTITION BY "inventoryKey" ORDER BY "SCD_endDate" DESC) AS rn
FROM "dstStarDB"."dstStarSchema"."d_InventoryState"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryState"
	(
		"inventoryKey",
		"SCD_startDate",
		"SCD_endDate",
		"SCD_changeReason",
		"SCD_isCurrent",
		"state"
	)
SELECT
	di."inventoryKey" AS "inventoryKey",
	CASE WHEN ipo.lst IS NULL THEN i.created_at ELSE now() END AS "SCD_startDate",
	'2999-12-31 00:00:00' AS "SCD_endDate",
	CASE WHEN ipo.lst IS NULL THEN 'insert' ELSE 'update' END AS "SCD_changeReason",
	'Yes' AS "SCD_isCurrent",
	COALESCE(i."state", 'N/A') AS "state"
FROM "dstStarDB"."dstStarSchema"."d_Inventory" AS di
  INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Inventory" AS i ON di."inventoryId" = i.id
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryState' AND lst."needToLoad" = TRUE
	LEFT JOIN is_ord AS ipo ON di."inventoryKey" = ipo."inventoryKey" AND ipo.rn = 1
	LEFT JOIN LATERAL (SELECT MAX(d."inventoryStateKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryState" AS d WHERE "inventoryStateKey" <> -1) AS dim ON TRUE
WHERE (ipo.lst = 'No' OR ipo.lst IS null)
	AND (dim."hasData" IS NULL
		OR i.updated_at > lst."loadDate");

-- set d_InventoryState as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryState', 'resultPrevInstr', 'final');

-- b_Task_Inventory - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_Inventory"
(
	"taskInventoryKey",
	"taskKey",
	"inventoryKey"
)
SELECT
	-1,
	-1,
	-1
ON CONFLICT ("taskInventoryKey")
DO UPDATE
	SET
		"taskKey" = EXCLUDED."taskKey",
		"inventoryKey" = EXCLUDED."inventoryKey";

-- b_Task_Inventory - UPSERT
WITH srcTaskInv AS
(
	SELECT
		t.id as "taskId",
		inv."inventoryId"
	FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
		LEFT JOIN LATERAL (SELECT (jsonb_array_elements_text(t.metadata -> 'inventories'))::uuid AS "inventoryId") AS inv ON TRUE
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Task_Inventory' AND lst."needToLoad" = TRUE
		LEFT JOIN LATERAL (SELECT MAX("taskInventoryKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Task_Inventory" WHERE "taskInventoryKey" <> -1) AS dim ON TRUE
	WHERE (dim."hasData" IS NULL
  	OR t.updated_at > lst."loadDate")
		AND t.name = 'APPOINTMENT'
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_Inventory"
(
	"taskKey",
	"inventoryKey"
)
SELECT
	dt."taskKey",
	COALESCE(di."inventoryKey", -1)
FROM srcTaskInv src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Task" AS dt ON src."taskId" = dt."taskId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di ON src."inventoryId" = di."inventoryId"
ON CONFLICT ("taskKey","inventoryKey")
DO NOTHING;

-- set b_Task_Inventory as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Task_Inventory', 'resultPrevInstr', 'final');

-- b_Task_PartyMember - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_PartyMember"
(
	"taskPartyMemberKey",
	"taskKey",
	"partyMemberKey"
)
SELECT
	-1,
	-1,
	-1
ON CONFLICT ("taskPartyMemberKey")
DO UPDATE
	SET
		"taskKey" = EXCLUDED."taskKey",
		"partyMemberKey" = EXCLUDED."partyMemberKey";

-- b_Task_PartyMember - UPSERT
WITH srcTaskInv AS
(
	SELECT
		t.id as "taskId",
		inv."partyMemberId"
	FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
		LEFT JOIN LATERAL (SELECT (jsonb_array_elements_text(t.metadata -> 'partyMembers'))::uuid AS "partyMemberId") AS inv ON TRUE
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Task_PartyMember' AND lst."needToLoad" = TRUE
		LEFT JOIN LATERAL (SELECT MAX("taskPartyMemberKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Task_PartyMember" WHERE "taskPartyMemberKey" <> -1) AS dim ON TRUE
	WHERE (dim."hasData" IS NULL
  	OR t.updated_at > lst."loadDate")
		AND t.name = 'APPOINTMENT'
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_PartyMember"
(
	"taskKey",
	"partyMemberKey"
)
SELECT
	dt."taskKey",
	COALESCE(dpm."partyMemberKey", -1)
FROM srcTaskInv src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Task" AS dt ON src."taskId" = dt."taskId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_PartyMember" AS dpm ON src."partyMemberId" = dpm."partyMemberId"
ON CONFLICT ("taskKey","partyMemberKey")
DO NOTHING;

-- set b_Task_PartyMember as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Task_PartyMember', 'resultPrevInstr', 'final');

-- b_Task_User - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_User"
(
	"taskUserKey",
	"taskKey",
	"userKey"
)
SELECT
	-1,
	-1,
	-1
ON CONFLICT ("taskUserKey")
DO UPDATE
	SET
		"taskKey" = EXCLUDED."taskKey",
		"userKey" = EXCLUDED."userKey";

-- b_Task_User - UPSERT
WITH srcTaskUser AS
(
	SELECT
		t.id as "taskId",
		usr."userId"
	FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" AS t
		LEFT JOIN LATERAL (SELECT (jsonb_array_elements_text(t.metadata -> 'originalAssignees'))::uuid AS "userId") AS usr ON TRUE
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Task_User' AND lst."needToLoad" = TRUE
		LEFT JOIN LATERAL (SELECT MAX("taskUserKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Task_User" WHERE "taskUserKey" <> -1) AS dim ON TRUE
	WHERE (dim."hasData" IS NULL
  	OR t.updated_at > lst."loadDate")
		AND t.name = 'APPOINTMENT'
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_Task_User"
(
	"taskKey",
	"userKey"
)
SELECT
	dt."taskKey",
	COALESCE(du."userKey", -1)
FROM srcTaskUser src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Task" AS dt ON src."taskId" = dt."taskId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON src."userId" = du."userId"
ON CONFLICT ("taskKey","userKey")
DO NOTHING;

-- set b_Task_PartyMember as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Task_User', 'resultPrevInstr', 'final');








-- b_AgentCallSummary - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party"
(
	"partyGroupKey",
	"partyKey",
	"parties",
	"weightFactor"
)
SELECT
	-1,
	-1,
	'{}',
	1
ON CONFLICT ("partyGroupKey", "partyKey")
DO UPDATE
	SET
		"parties" = EXCLUDED."parties",
		"weightFactor" = EXCLUDED."weightFactor";

-- b_AgentCallSummary - UPSERT
WITH srcPartyGroup AS
(
	SELECT DISTINCT
		DENSE_RANK() OVER (ORDER BY c.parties) + (SELECT MAX("partyGroupKey") FROM "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party") AS "partyGroupKey",
		c.parties,
		unnest(c.parties)::uuid AS "partyId",
		CASE WHEN c.parties <> '{}' THEN 1::float/cardinality(c.parties) ELSE 1 END AS "weightFactor"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_AgentCallSummary_Party' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("partyGroupKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party" WHERE "partyGroupKey" <> -1) AS dim ON TRUE
WHERE "type" = 'Call'
	AND (dim."hasData" IS NULL
  	OR c.created_at > lst."loadDate")
)
INSERT INTO "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party"
(
	"partyGroupKey",
	"partyKey",
	"parties",
	"weightFactor"
)
SELECT
	src."partyGroupKey",
	dp."partyKey",
	src."parties",
	src."weightFactor"
FROM srcPartyGroup src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON src."partyId" = dp."partyId";

-- set b_Task_PartyMember as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_AgentCallSummary_Party', 'resultPrevInstr', 'final');


-- d_Lease - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_Lease" (
	"leaseKey",
	"leaseId",
	"utcCreatedDate",
	"status",
	"leaseTerm",
	"utcLeaseStartDate",
	"utcLeaseEndDate",
	"leaseBaseRent",
	"leaseAdditionalRent",
	"moveInDate",
	"approverNotes",
	"applicationDecision",
	"recommendations",
	"additionalCharges",
	"activeLeaseState",
	"activeLeaseRolloverPeriod",
	"activeLeaseIsExtension"
)
SELECT
	-1 AS "leaseKey",
	'00000000-0000-0000-0000-000000000000' AS "leaseId",
	'1900-01-01 00:00:00.000' AS "utcCreatedDate",
	'N/A' AS "status",
	'N/A' AS "leaseTerm",
	'1900-01-01 00:00:00.000' AS "utcLeaseStartDate",
	'1900-01-01 00:00:00.000' AS "utcLeaseEndDate",
	0 AS "leaseBaseRent",
	0 AS "leaseAdditionalRent",
	'1900-01-01' AS "moveInDate",
	'N/A' AS "approverNotes",
	'N/A' AS "applicationDecision",
	'N/A' AS "recommendations",
	'N/A' AS "additionalCharges",
	'N/A' AS "activeLeaseState",
	'N/A' AS "activeLeaseRolloverPeriod",
	'N/A' AS "activeLeaseIsExtension"
ON CONFLICT ("leaseKey")
DO UPDATE
	SET
		"leaseId" = EXCLUDED."leaseId",
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"status" = EXCLUDED."status",
		"leaseTerm" = EXCLUDED."leaseTerm",
		"utcLeaseStartDate" = EXCLUDED."utcLeaseStartDate",
		"utcLeaseEndDate" = EXCLUDED."utcLeaseEndDate",
		"leaseBaseRent" = EXCLUDED."leaseBaseRent",
		"leaseAdditionalRent" = EXCLUDED."leaseAdditionalRent",
		"moveInDate" = EXCLUDED."moveInDate",
		"approverNotes" = EXCLUDED."approverNotes",
		"applicationDecision" = EXCLUDED."applicationDecision",
		"recommendations" = EXCLUDED."recommendations",
		"additionalCharges" = EXCLUDED."additionalCharges",
		"activeLeaseState" = EXCLUDED."activeLeaseState",
		"activeLeaseRolloverPeriod" = EXCLUDED."activeLeaseRolloverPeriod",
		"activeLeaseIsExtension" = EXCLUDED."activeLeaseIsExtension";

-- d_Lease - UPSERT
WITH lease_response AS
(
SELECT
	l.id,
	l."quoteId",
	resp."applicationDecision",
	resp.recommendations,
	resp."submissionRequestId",
	ROW_NUMBER () OVER (PARTITION BY l.id, l."quoteId" ORDER BY req.created_at DESC, resp.created_at desc) AS ord, -- order by response
	RANK() OVER (PARTITION BY l.id, l."quoteId" ORDER BY req.created_at desc) AS ord_req -- rank by request for recommendations
FROM "dstReplicaDB"."dstReplicaSchema"."Lease" l
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Lease' AND lst."needToLoad" = TRUE
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_SubmissionRequest" req ON l."quoteId" = req."quoteId"
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_SubmissionResponse" resp ON req.id = resp."submissionRequestId"
WHERE
	resp.created_at <= l.created_at -- get last response before lease creation
	AND l.created_at > lst."loadDate"
	AND resp.status = 'Complete'
), all_recs AS (
SELECT "submissionRequestId", UNNEST(recommendations)->>'text' AS allrecs
FROM lease_response
WHERE ord_req = 1
), unique_recs AS (
SELECT
	"submissionRequestId",
	string_agg(DISTINCT allrecs, ' | ') AS recs
FROM all_recs
GROUP BY "submissionRequestId"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_Lease" (
	"leaseId",
	"utcCreatedDate",
	"status",
	"leaseTerm",
	"utcLeaseStartDate",
	"utcLeaseEndDate",
	"leaseBaseRent",
	"leaseAdditionalRent",
	"moveInDate",
	"approverNotes",
	"applicationDecision",
	"recommendations",
	"additionalCharges",
	"activeLeaseState",
	"activeLeaseRolloverPeriod",
	"activeLeaseIsExtension"
)
SELECT
	l.id AS "leaseId",
	l.created_at AS "utcCreatedDate",
	l.status,
	COALESCE(l."baselineData" -> 'quote' ->> 'leaseTerm', 'N/A') AS "leaseTerm",
	COALESCE(l."baselineData" -> 'publishedLease' ->> 'leaseStartDate', '1900-01-01 00:00:00.000')::TIMESTAMPTZ AS "leaseStartDate",
	COALESCE(l."baselineData" -> 'publishedLease' ->> 'leaseEndDate', '1900-01-01 00:00:00.000')::TIMESTAMPTZ AS "leaseEndDate",
	COALESCE((l."baselineData" -> 'publishedLease' ->> 'unitRent')::DECIMAL, 0) AS "leaseBaseRent",
	COALESCE((l."baselineData" -> 'quote' ->> 'totalAdditionalRent')::DECIMAL, 0) AS "leaseAdditionalRent",
	COALESCE(l."baselineData" -> 'quote' ->> 'moveInDate','1900-01-01')::DATE AS "moveInDate",
	COALESCE(l."baselineData" -> 'additionalConditions' ->> 'additionalNotes','') AS "approverNotes",
	COALESCE(lr."applicationDecision", '[No Completed Application]') AS "applicationDecision",
	COALESCE(ur."recs", '[No System Recommendations]') AS "recommendations",
	COALESCE(l."baselineData" -> 'publishedLease' ->> 'additionalCharges', 'NULL charges') as "additionalCharges",
	COALESCE(alwd."state", 'N/A') AS "activeLeaseState",
	COALESCE(alwd."rolloverPeriod", 'N/A') AS "activeLeaseRolloverPeriod",
	CASE WHEN alwd."isExtension" = TRUE THEN 'Yes' ELSE 'No' END AS "activeLeaseIsExtension"
FROM "dstReplicaDB"."dstReplicaSchema"."Lease" AS l
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_Lease' AND lst."needToLoad" = TRUE
	LEFT JOIN  "dstReplicaDB"."dstReplicaSchema"."ActiveLeaseWorkflowData" AS alwd ON l.id = alwd."leaseId"
	LEFT OUTER JOIN lease_response AS lr ON l.id = lr.id AND lr.ord = 1
	LEFT OUTER JOIN unique_recs AS ur ON lr."submissionRequestId" = ur."submissionRequestId"
	LEFT JOIN LATERAL (SELECT MAX("leaseKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_Lease" WHERE "leaseKey" <> -1) AS dim ON TRUE
WHERE  dim."hasData" IS NULL
	OR l.updated_at > lst."loadDate"
ON CONFLICT ("leaseId")
DO UPDATE
	SET
		"utcCreatedDate" = EXCLUDED."utcCreatedDate",
		"status" = EXCLUDED."status",
		"leaseTerm" = EXCLUDED."leaseTerm",
		"utcLeaseStartDate" = EXCLUDED."utcLeaseStartDate",
		"utcLeaseEndDate" = EXCLUDED."utcLeaseEndDate",
		"leaseBaseRent" = EXCLUDED."leaseBaseRent",
		"leaseAdditionalRent" = EXCLUDED."leaseAdditionalRent",
		"moveInDate" = EXCLUDED."moveInDate",
		"approverNotes" = EXCLUDED."approverNotes",
		"applicationDecision" = EXCLUDED."applicationDecision",
		"recommendations" = EXCLUDED."recommendations",
		"additionalCharges" = EXCLUDED."additionalCharges",
		"activeLeaseState" = EXCLUDED."activeLeaseState",
		"activeLeaseRolloverPeriod" = EXCLUDED."activeLeaseRolloverPeriod",
		"activeLeaseIsExtension" = EXCLUDED."activeLeaseIsExtension";

-- set d_Lease as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_Lease', 'resultPrevInstr', 'final');

-- b_Team_Property_Program - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."b_Team_Property_Program" (
	"teamPropertyProgramKey",
	"teamPropertyProgramId",
	"teamKey",
	"propertyKey",
	"programKey",
	"commDirection"
)
SELECT
	-1 AS "teamPropertyProgramKey",
	'00000000-0000-0000-0000-000000000000' AS "teamPropertyProgramId",
	-1 AS "teamKey",
	-1 AS "propertyKey",
	-1 AS "programKey",
	'N/A' AS "commDirection"
ON CONFLICT ("teamPropertyProgramKey")
DO UPDATE
	SET
		"teamPropertyProgramId" = EXCLUDED."teamPropertyProgramId",
		"teamKey" = EXCLUDED."teamKey",
		"propertyKey" = EXCLUDED."propertyKey",
		"programKey" = EXCLUDED."programKey",
		"commDirection" = EXCLUDED."commDirection";

-- b_Team_Property_Program - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."b_Team_Property_Program" (
	"teamPropertyProgramId",
	"teamKey",
	"propertyKey",
	"programKey",
	"commDirection"
)
SELECT
	tpp.id,
	dt."teamKey",
	dp."propertyKey",
	dpg."programKey",
	tpp."commDirection"
FROM "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'b_Team_Property_Program' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Team" AS dt ON tpp."teamId" = dt."teamId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dp ON tpp."propertyId" = dp."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Program" AS dpg ON tpp."programId" = dpg."programId"
	LEFT JOIN LATERAL (SELECT MAX("teamPropertyProgramKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."b_Team_Property_Program" WHERE "teamPropertyProgramKey" <> -1) AS dim ON TRUE
WHERE  dim."hasData" IS NULL
	OR tpp.updated_at > lst."loadDate"
ON CONFLICT ("teamPropertyProgramId")
DO UPDATE
	SET
		"teamKey" = EXCLUDED."teamKey",
		"propertyKey" = EXCLUDED."propertyKey",
		"programKey" = EXCLUDED."programKey",
		"commDirection" = EXCLUDED."commDirection";

-- set b_Team_Property_Program as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('b_Team_Property_Program', 'resultPrevInstr', 'final');

-- d_InventoryRmsPrice - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice" (
	"inventoryRmsPriceKey",
	"inventoryKey",
	"pricingType",
	"unitType",
	"LROUnitStatus",
	"availDate",
	"fileName",
	"rmsProvider",
	"LROAmenities",
	"LROAmenityValue",
	"isRenewal",
	"renewalDate",
	"minRent",
	"minRentStartDate",
	"minRentEndDate",
	"minRentLeaseLength",
	"standardLeaseLength",
	"standardRent",
	"fileImportedDate"
)
SELECT
	-1 AS "inventoryRmsPriceKey",
	-1 AS "inventoryKey",
	'N/A' AS "pricingType",
	'N/A' AS "unitType",
	'N/A' AS "LROUnitStatus",
	'1900-01-01' AS "availDate",
	'N/A' AS "fileName",
	'N/A' AS "rmsProvider",
	'N/A' AS "LROAmenities",
	0.0 AS "LROAmenityValue",
	'N/A' AS "isRenewal",
	'1900-01-01' AS "renewalDate",
	0.0 AS "minRent",
	'1900-01-01 00:00:00.000' AS "minRentStartDate",
	'1900-01-01 00:00:00.000' AS "minRentEndDate",
	0 AS "minRentLeaseLength",
	0 AS "standardLeaseLength",
	0.0 AS "standardRent",
	'1900-01-01 00:00:00.000' AS "fileImportedDate"
ON CONFLICT ("inventoryRmsPriceKey")
DO UPDATE
	SET
		"inventoryKey" = EXCLUDED."inventoryKey",
		"pricingType" = EXCLUDED."pricingType",
		"unitType" = EXCLUDED."unitType",
		"LROUnitStatus" = EXCLUDED."LROUnitStatus",
		"availDate" = EXCLUDED."availDate",
		"fileName" = EXCLUDED."fileName",
		"rmsProvider" = EXCLUDED."rmsProvider",
		"LROAmenities" = EXCLUDED."LROAmenities",
		"LROAmenityValue" = EXCLUDED."LROAmenityValue",
		"isRenewal" = EXCLUDED."isRenewal",
		"renewalDate" = EXCLUDED."renewalDate",
		"minRent" = EXCLUDED."minRent",
		"minRentStartDate" = EXCLUDED."minRentStartDate",
		"minRentEndDate" = EXCLUDED."minRentEndDate",
		"minRentLeaseLength" = EXCLUDED."minRentLeaseLength",
		"standardLeaseLength" = EXCLUDED."standardLeaseLength",
		"standardRent" = EXCLUDED."standardRent",
		"fileImportedDate" = EXCLUDED."fileImportedDate";

-- d_InventoryRmsPrice - UPSERT
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice" (
	"inventoryKey",
	"pricingType",
	"unitType",
	"LROUnitStatus",
	"availDate",
	"fileName",
	"rmsProvider",
	"LROAmenities",
	"LROAmenityValue",
	"isRenewal",
	"renewalDate",
	"minRent",
	"minRentStartDate",
	"minRentEndDate",
	"minRentLeaseLength",
	"standardLeaseLength",
	"standardRent",
	"fileImportedDate"
)
SELECT "inventoryKey",
	"pricingType",
	TYPE AS "unitType",
	status AS "LROUnitStatus",
	("availDate" AT time zone p.timezone) AS "availDate",
	"fileName",
	"rmsProvider",
	amenities AS "LROAmenities",
	"amenityValue" AS "LROAmenityValue",
	CASE WHEN r."renewalDate" IS NULL THEN 0 ELSE 1 END as "isRenewal",
	COALESCE(("renewalDate" AT time ZONE p.timezone), '1900-01-01 00:00:00.000') AS "renewalDate",
	"minRent",
	("minRentStartDate" AT time ZONE p.timezone) AS "minRentStartDate",
	("minRentEndDate" AT time ZONE p.timezone) AS "minRentEndDate",
	"minRentLeaseLength",
	"standardLeaseLength",
	"standardRent",
	r.created_at at time zone 'America/Los_Angeles' as "fileImportedDate"
FROM "dstReplicaDB"."dstReplicaSchema"."RmsPricing" r
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Property" p ON r."propertyId" = p.id
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Inventory" di on r."inventoryId" = di."inventoryId"
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryRmsPrice' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("inventoryRmsPriceKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryRmsPrice" WHERE "inventoryRmsPriceKey" <> -1) AS dim ON TRUE
WHERE  dim."hasData" IS NULL
	OR r.updated_at > lst."loadDate"
ON CONFLICT ("inventoryKey", "pricingType")
DO UPDATE
	SET
		"unitType" = EXCLUDED."unitType",
		"LROUnitStatus" = EXCLUDED."LROUnitStatus",
		"availDate" = EXCLUDED."availDate",
		"fileName" = EXCLUDED."fileName",
		"rmsProvider" = EXCLUDED."rmsProvider",
		"LROAmenities" = EXCLUDED."LROAmenities",
		"LROAmenityValue" = EXCLUDED."LROAmenityValue",
		"isRenewal" = EXCLUDED."isRenewal",
		"renewalDate" = EXCLUDED."renewalDate",
		"minRent" = EXCLUDED."minRent",
		"minRentStartDate" = EXCLUDED."minRentStartDate",
		"minRentEndDate" = EXCLUDED."minRentEndDate",
		"minRentLeaseLength" = EXCLUDED."minRentLeaseLength",
		"standardLeaseLength" = EXCLUDED."standardLeaseLength",
		"standardRent" = EXCLUDED."standardRent",
		"fileImportedDate" = EXCLUDED."fileImportedDate";

-- set d_InventoryRmsPrice as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryRmsPrice', 'resultPrevInstr', 'final');

-- d_InventoryTerm - default - SCD1
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryTerm" (
	"inventoryTermKey",
	"inventoryKey",
	"leaseTerm",
	"startDate",
	"endDate",
	"rent"
)
SELECT
	-1 AS "inventoryTermKey",
	-1 AS "inventoryKey",
	0 AS "leaseTerm",
	'1900-01-01'::date AS "startDate",
	'1900-01-01'::date AS "endDate",
	0.0 AS "rent"
ON CONFLICT ("inventoryTermKey")
DO UPDATE
	SET
		"inventoryKey" = EXCLUDED."inventoryKey",
		"leaseTerm" = EXCLUDED."leaseTerm",
		"startDate" = EXCLUDED."startDate",
		"endDate" = EXCLUDED."endDate",
		"rent" = EXCLUDED."rent";

-- d_InventoryTerm - UPSERT
WITH rms_terms AS (
select
    di."inventoryKey",
    jsonb_object_keys(rms."rentMatrix") :: int as "term",
    rms."rentMatrix" -> (jsonb_object_keys(rms."rentMatrix") :: text) as "dates"
from
    "dstReplicaDB"."dstReplicaSchema"."RmsPricing" AS rms
		INNER JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di on rms."inventoryId" = di."inventoryId"
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'd_InventoryTerm' AND lst."needToLoad" = TRUE
		LEFT JOIN LATERAL (SELECT MAX("inventoryTermKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."d_InventoryTerm" WHERE "inventoryTermKey" <> -1) AS dim ON TRUE
WHERE  dim."hasData" IS NULL
	OR rms.updated_at > lst."loadDate"
)
INSERT INTO "dstStarDB"."dstStarSchema"."d_InventoryTerm" (
	"inventoryKey",
	"leaseTerm",
	"startDate",
	"endDate",
	"rent"
)
SELECT distinct
	rt."inventoryKey",
	rt."term",
	(jsonb_object_keys(rt.dates))::date as "startDate",
	(rt.dates -> (jsonb_object_keys(rt.dates) :: text) ->> 'endDate')::date AS "endDate",
	(rt.dates -> (jsonb_object_keys(rt.dates) :: text) ->> 'rent')::decimal(8,2) AS rent
FROM rms_terms rt
ON CONFLICT ("inventoryKey", "leaseTerm", "startDate", "endDate")
DO UPDATE
	SET
		"rent" = EXCLUDED."rent";

-- set d_InventoryTerm as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('d_InventoryTerm', 'resultPrevInstr', 'final');

-- RmsPricingHistory
INSERT INTO "dstStarDB"."dstStarSchema"."h_RmsPricingHistory" (
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
	status,
	"amenityValue",
	"rentMatrix",
	"renewalDate",
	amenities,
	"propertyId",
	"type",
	"pricingType"
)
SELECT
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
	status,
	"amenityValue",
	"rentMatrix",
	"renewalDate",
	amenities,
	"propertyId",
	"type",
	"pricingType"
FROM "dstReplicaDB"."dstReplicaSchema"."RmsPricing" r
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'h_RmsPricingHistory' AND lst."needToLoad" = TRUE
	LEFT JOIN LATERAL (SELECT MAX("rmsPricingHistoryKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."h_RmsPricingHistory") AS dim ON TRUE
WHERE dim."hasData" IS NULL
	OR r.updated_at > lst."loadDate";

-- set d_InventoryRmsPrice as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('h_RmsPricingHistory', 'resultPrevInstr', 'final');
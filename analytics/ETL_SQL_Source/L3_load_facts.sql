-- f_PaymentsAndRefunds
WITH CurrentPartyMember AS
(
	SELECT
		pm.id,
		pm."personId",
		pm."partyId",
		ROW_NUMBER() OVER (PARTITION BY pm."personId", pm."partyId" ORDER BY pm."startDate" DESC) AS ord
	FROM "dstReplicaDB"."dstReplicaSchema"."PartyMember" pm
), SrcPaymentsAndRefunds AS
(
	SELECT
		pa."partyId" AS "partyId",
		appPm.id AS "applicantPartyMemberId",
		primPm."partyMemberId" AS "primaryPartyMemberId",
		f."propertyId" AS "applicationPropertyId",
		COALESCE(atran.created_at, ai.created_at) AS "transactionInvoiceDate",
		CASE
			WHEN atran.id IS NOT NULL THEN COALESCE((atran."transactionData" ->> 'firstName'), '') || ' ' || COALESCE((atran."transactionData" ->> 'lastName'), '')
			ELSE 'Waiver'
		END AS "paidBy",
		COALESCE(atran."externalId", 'N/A') AS "AptexxRef",
		COALESCE(atran."transactionType", 'waiver') AS "transactionType",
		CASE
			WHEN atran.id IS NOT NULL
				THEN ((atran."transactionData" ->> 'amount')::NUMERIC / 100)::MONEY * CASE WHEN COALESCE(atran."transactionType", 'payment') = 'payment' THEN 1 ELSE -1 END
			ELSE (ai."applicationFeeWaiverAmount")::MONEY * -1
		END AS "amount"
	FROM "dstReplicaDB"."dstReplicaSchema"."rentapp_ApplicationInvoices" AS ai
		INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_PaymentsAndRefunds' AND lst."needToLoad" = TRUE
		INNER JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_PartyApplication" AS pa ON pa.id = ai."partyApplicationId"
		INNER JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_PersonApplication" AS perApp ON perApp.id = ai."personApplicationId"
		INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Person" AS appPer ON appPer.id = perApp."personId"
		LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Fee" AS f ON ai."applicationFeeId" = f.id
		LEFT JOIN CurrentPartyMember AS appPM ON appPM."personId" = perApp."personId" AND pa."partyId" = appPM."partyId" and appPm.ord = 1
		LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_ApplicationTransactions" AS atran ON atran."invoiceId" = ai.id
		LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."ExternalPartyMemberInfo" AS primPm ON primPm."partyId" = pa."partyId" AND primPm."isPrimary" = TRUE AND primPm."endDate" IS NULL AND primPm."externalId" IS NOT NULL
		LEFT JOIN LATERAL (SELECT MAX("paymentsAndRefundsKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_PaymentsAndRefunds") AS fact ON TRUE
	WHERE ((ai."paymentCompleted" = 'true'
					AND atran."transactionType" IN ('payment', 'refund'))
				OR
				(ai."paymentCompleted" = 'true'
					AND ai."applicationFeeWaiverAmount" IS NOT NULL))
				AND
				(ai.updated_at > lst."loadDate" -- brings only the new invoices or the ones for which the payment was completed
					OR fact."hasData" IS NULL)
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_PaymentsAndRefunds"
	(
		"partyKey",
		"applicantPartyMemberKey",
		"primaryPartyMemberKey",
		"applicationPropertyKey",
		"utcDateKey",
		"utcTimeKey",
		"propertyDateKey",
		"propertyTimeKey",
		"paidBy",
		"AptexxRef",
		"transactionType",
		"amount"
	)
SELECT
	dp."partyKey",
	COALESCE(dpma."partyMemberKey", -1) AS "applicantPartyMemberKey",
	COALESCE(dpm."partyMemberKey", -1) AS "primaryPartyMemberKey",
	dpr."propertyKey" AS "applicationPropertyKey",
	utcd."dateKey" AS "utcDateKey",
	utct."timeKey" "utcTimeKey",
	propd."dateKey" AS "propertyDateKey",
	propt."timeKey" AS "propertyTimeKey",
	src."paidBy",
	src."AptexxRef",
	src."transactionType",
	src."amount"
FROM SrcPaymentsAndRefunds AS src
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON src."partyId" = dp."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dpr ON src."applicationPropertyId" = dpr."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_PartyMember" AS dpma ON src."applicantPartyMemberId" = dpma."partyMemberId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_PartyMember" AS dpm ON src."primaryPartyMemberId" = dpm."partyMemberId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS utcd ON src."transactionInvoiceDate"::DATE = utcd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propd ON (src."transactionInvoiceDate" AT TIME ZONE dpr."propertyTimezone")::DATE = propd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS utct ON to_char(src."transactionInvoiceDate"::TIME,'HH24:MI') = utct."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS propt ON to_char((src."transactionInvoiceDate" AT TIME ZONE dpr."propertyTimezone")::TIME,'HH24:MI') = propt."hourMinute";

-- set f_PaymentsAndRefunds as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_PaymentsAndRefunds', 'resultPrevInstr', 'final');

-- f_PartyConversion - LOAD
WITH srcPartyConversion AS
(
SELECT p."assignedPropertyId" AS "propertyId",
	p.id AS "partyId",
	tpp."programId" AS "programId",
	COALESCE((p.metadata->>'firstContactedDate')::TIMESTAMPTZ, p.created_at)::DATE AS "utcDate",
	(COALESCE((p.metadata->>'firstContactedDate')::TIMESTAMPTZ, p.created_at) AT TIME ZONE pr."timezone")::date AS "propDate",
	to_char(COALESCE((p.metadata->>'firstContactedDate')::TIMESTAMPTZ, p.created_at)::TIME,'HH24:MI') AS "utcTime",
	to_char((COALESCE((p.metadata->>'firstContactedDate')::TIMESTAMPTZ, p.created_at) AT TIME ZONE pr.timezone)::time,'HH24:MI') AS "propTime",
	(p.metadata->>'firstContactChannel')::TEXT AS "contactChannel",
	p."userId" AS "agentId",
	1 AS "newContacts",
	CASE WHEN COALESCE(CT."completedTours", 0) >= 1 THEN 1 ELSE 0 END AS "completedFirstTours",
	COALESCE(CT."completedTours", 0) AS "completedTours",
	COALESCE(CA."completedApplications", 0) AS "completedApplications",
	COALESCE(l."sales", 0) AS "sales"
FROM "dstReplicaDB"."dstReplicaSchema"."Party" AS p
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS pr ON p."assignedPropertyId" = pr.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp ON tpp.id = p."teamPropertyProgramId"
	LEFT JOIN
		(SELECT t."partyId", COUNT(1) AS "completedTours"
		 FROM "dstReplicaDB"."dstReplicaSchema"."Tasks" t
		 WHERE t.name = 'APPOINTMENT'
				AND t.state = 'Completed'
				AND t.metadata ->> 'appointmentResult' = 'COMPLETE'
		 GROUP BY t."partyId"
		) AS CT ON p.id = CT."partyId"
	LEFT JOIN
		(SELECT pa."partyId",count(1) AS "completedApplications"
		 FROM "dstReplicaDB"."dstReplicaSchema"."rentapp_PartyApplication" pa
				INNER JOIN "dstReplicaDB"."dstReplicaSchema"."rentapp_SubmissionRequest" sr ON pa.id = sr."partyApplicationId"
		 GROUP BY pa."partyId"
		) AS CA ON p.id =  CA."partyId"
	LEFT JOIN
		(SELECT "partyId", count(1) AS "sales"
		 FROM "dstReplicaDB"."dstReplicaSchema"."Lease"
		 WHERE "status" = 'executed'
		 GROUP BY "partyId"
		) AS l ON l."partyId" = p."id"
	LEFT JOIN LATERAL (SELECT MAX("partyConversionKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_PartyConversion") AS fact ON TRUE
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_PartyConversion' AND lst."needToLoad" = TRUE
WHERE (fact."hasData" IS NULL
  	OR p.created_at >= (lst."loadDate"::date) - INTERVAL '30 day')
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_PartyConversion"
(
	"propertyKey",
	"partyKey",
	"programKey",
	"utcDateKey",
	"propertyDateKey",
	"utcTimeKey",
	"propertyTimeKey",
	"contactChannelKey",
  "agentKey",
  "newContacts",
  "completedFirstTours",
	"completedTours",
	"completedApplications",
	"sales"
)
SELECT
	COALESCE(dpr."propertyKey", -1) AS "propertyKey",
	dp."partyKey",
	COALESCE(dc."programKey", -1) AS "programKey",
	COALESCE(utcd."dateKey", 19000101) AS "utcDateKey",
	COALESCE(propd."dateKey", 19000101) AS "propertyDateKey",
	utct."timeKey" AS "utcTimeKey",
	COALESCE(propt."timeKey", -1) AS "propertyTimeKey",
	COALESCE(dcc."contactChannelKey", -1) AS "contactChannelKey",
	COALESCE(du."userKey", -1) AS "agentKey",
	1 AS "newContacts",
	src."completedFirstTours",
	src."completedTours",
	src."completedApplications",
	src."sales"
FROM srcPartyConversion AS src
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dpr ON src."propertyId" = dpr."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON src."partyId" = dp."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Program" AS dc ON src."programId" = dc."programId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_ContactChannel" AS dcc ON src."contactChannel" = dcc."channelName"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS utcd ON src."utcDate" = utcd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propd ON src."propDate" = propd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS utct ON src."utcTime" = utct."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS propt ON src."propTime" = propt."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON src."agentId" = du."userId" AND du."SCD_isCurrent" = 'Yes'
ON CONFLICT ("partyKey")
DO UPDATE
	SET
		"propertyKey" = EXCLUDED."propertyKey",
		"programKey" = EXCLUDED."programKey",
		"utcDateKey" = EXCLUDED."utcDateKey",
		"propertyDateKey" = EXCLUDED."propertyDateKey",
		"utcTimeKey" = EXCLUDED."utcTimeKey",
		"propertyTimeKey" = EXCLUDED."propertyTimeKey",
		"contactChannelKey" = EXCLUDED."contactChannelKey",
		"agentKey" = EXCLUDED."agentKey",
		"newContacts" = EXCLUDED."newContacts",
		"completedFirstTours" = EXCLUDED."completedFirstTours",
		"completedTours" = EXCLUDED."completedTours",
		"completedApplications" = EXCLUDED."completedApplications",
		"sales" = EXCLUDED."sales";


-- set f_PartyConversion as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_PartyConversion', 'resultPrevInstr', 'final');

-- f_PartyCommunication
WITH srcCommParty AS
(
SELECT c.id AS "communicationId",
	unnest(c.parties)::uuid AS "partyId",
	c.created_at AS "utcCreatedDate",
	tpp."propertyId",
	tpp."programId",
	c."userId" AS "agentId"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_PartyCommunication' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp ON c."teamPropertyProgramId" = tpp.id
	LEFT JOIN LATERAL (SELECT MAX("partyCommunicationKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_PartyCommunication") AS fact ON TRUE
WHERE fact."hasData" IS NULL
  	OR c.updated_at > lst."loadDate"
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_PartyCommunication"
(
	"communicationKey",
	"partyKey",
	"programKey",
	"programPropertyKey",
	"propDateKey",
	"propTimeKey",
	"agentKey",
	"partyPropertyKey",
	"commCount"
)
SELECT
	dc."communicationKey",
	dp."partyKey",
	COALESCE(dcp."programKey", -1),
	COALESCE(dpr."propertyKey", -1) AS "programPropertyKey",
	propd."dateKey",
	propt."timeKey",
	COALESCE(du."userKey", -1),
	COALESCE(asdpr."propertyKey", -1) AS "partyPropertyKey",
	1 AS "commCount"
FROM srcCommParty src
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Party" p ON src."partyId" = p.id
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Communication" dc ON src."communicationId" = dc."communicationId"
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON src."partyId" = dp."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Program" AS dcp ON src."programId" = dcp."programId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dpr ON src."propertyId" = dpr."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS asdpr ON dp."currentAssignedProperty" = asdpr."propertyName"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON src."agentId" = du."userId" AND du."SCD_isCurrent" = 'Yes'
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propd ON (src."utcCreatedDate" AT TIME ZONE asdpr."propertyTimezone")::DATE = propd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS propt ON to_char((src."utcCreatedDate" AT TIME ZONE asdpr."propertyTimezone")::TIME,'HH24:MI') = propt."hourMinute"
ON CONFLICT ("communicationKey", "partyKey")
DO UPDATE
	SET
		"programKey" = EXCLUDED."programKey",
		"programPropertyKey" = EXCLUDED."programPropertyKey",
		"propDateKey" = EXCLUDED."propDateKey",
		"propTimeKey" = EXCLUDED."propTimeKey",
		"agentKey" = EXCLUDED."agentKey",
		"partyPropertyKey" = EXCLUDED."partyPropertyKey";

-- set f_PartyCommunication as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_PartyCommunication', 'resultPrevInstr', 'final');


-- f_CompletedTour
WITH srcComplTour AS
(
SELECT
	t.id AS "taskId",
	p.id AS "partyId",
	p."assignedPropertyId" AS "propertyId",
	tpp."programId",
	(p.metadata->>'firstContactChannel')::TEXT AS "contactChannel",
	t.created_at::DATE AS "utcCreatedDate",
	to_char(t.created_at::TIME,'HH24:MI') AS "utcCreatedTime",
	(t.created_at AT TIME ZONE pr."timezone")::DATE AS "propCreatedDate",
	to_char((t.created_at AT TIME ZONE pr.timezone)::TIME,'HH24:MI') AS "propCreatedTime",
	CAST(t.metadata ->> 'endDate' AS TIMESTAMPTZ)::DATE AS "utcTourDate",
	to_char(CAST(t.metadata ->> 'endDate' as TIMESTAMPTZ)::TIME,'HH24:MI') AS "utcTourTime",
	(CAST(t.metadata ->> 'endDate' AS TIMESTAMPTZ) AT TIME ZONE pr."timezone")::DATE AS "propTourDate",
	to_char((CAST(t.metadata ->> 'endDate' AS TIMESTAMPTZ) AT TIME ZONE pr.timezone)::TIME,'HH24:MI') AS "propTourTime",
	ROW_NUMBER() OVER (PARTITION BY "partyId" ORDER BY CAST(t.metadata ->> 'endDate' AS TIMESTAMPTZ) ASC) AS "tourOrder",
	ROW_NUMBER() OVER (PARTITION BY "partyId" ORDER BY t.created_at ASC) AS "scheduledOrder",
	(t.metadata -> 'inventories' ->> 0)::UUID AS "inventoryId"
FROM
  "dstReplicaDB"."dstReplicaSchema"."Tasks" t
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_CompletedTour' AND lst."needToLoad" = TRUE
  INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Party" p ON p."id" = t."partyId"
  LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" pr ON p."assignedPropertyId" = pr.id
  LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" tpp ON tpp.id = p."teamPropertyProgramId"
	LEFT JOIN LATERAL (SELECT MAX("completedTourKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_CompletedTour") AS fact ON TRUE
WHERE (fact."hasData" IS NULL
  	OR t.updated_at > lst."loadDate")
	AND t.name = 'APPOINTMENT'
	AND t.state = 'Completed'
	AND t.metadata ->> 'appointmentResult' = 'COMPLETE'
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_CompletedTour"
(
	"taskKey",
	"partyKey",
	"propertyKey",
	"programKey",
	"contactChannelKey",
	"utcCreatedDateKey",
	"utcCreatedTimeKey",
	"propertyCreatedDateKey",
	"propertyCreatedTimeKey",
	"utcTourDateKey",
	"utcTourTimeKey",
	"propertyTourDateKey",
	"propertyTourTimeKey",
	"isFirstCompletedTour",
	"isFirstScheduledTour",
	"inventoryKey"
)
SELECT
	dt."taskKey",
	COALESCE(dp."partyKey", -1),
	COALESCE(dpr."propertyKey", -1),
	COALESCE(dcp."programKey", -1),
	COALESCE(dcc."contactChannelKey", -1),
	COALESCE(utcd."dateKey", 19000101),
	COALESCE(utct."timeKey", -1),
	COALESCE(propd."dateKey", 19000101),
	COALESCE(propt."timeKey", -1),
	COALESCE(utcdc."dateKey", 19000101),
	COALESCE(utctc."timeKey", -1),
	COALESCE(propdc."dateKey", 19000101),
	COALESCE(proptc."timeKey", -1),
	CASE WHEN src."tourOrder" = 1 THEN 'Yes' ELSE 'No' END,
	CASE WHEN src."scheduledOrder" = 1 THEN 'Yes' ELSE 'No' END,
	COALESCE(di."inventoryKey", -1)
FROM srcComplTour src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Task" dt ON src."taskId" = dt."taskId"
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp ON src."partyId" = dp."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Program" AS dcp ON src."programId" = dcp."programId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dpr ON src."propertyId" = dpr."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_ContactChannel" AS dcc ON src."contactChannel" = dcc."channelName"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS utcd ON src."utcCreatedDate" = utcd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS utct ON src."utcCreatedTime" = utct."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propd ON src."propCreatedDate" = propd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS propt ON src."propCreatedTime" = propt."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS utcdc ON src."utcTourDate" = utcdc."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS utctc ON src."utcTourTime" = utctc."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propdc ON src."propTourDate" = propdc."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS proptc ON src."propTourTime" = proptc."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di ON src."inventoryId" = di."inventoryId"
ON CONFLICT ("taskKey")
DO UPDATE
	SET
		"partyKey" = EXCLUDED."partyKey",
		"propertyKey" = EXCLUDED."propertyKey",
		"programKey" = EXCLUDED."programKey",
		"contactChannelKey" = EXCLUDED."contactChannelKey",
		"utcCreatedDateKey" = EXCLUDED."utcCreatedDateKey",
		"utcCreatedTimeKey" = EXCLUDED."utcCreatedTimeKey",
		"propertyCreatedDateKey" = EXCLUDED."propertyCreatedDateKey",
		"propertyCreatedTimeKey" = EXCLUDED."propertyCreatedTimeKey",
		"utcTourDateKey" = EXCLUDED."utcTourDateKey",
		"utcTourTimeKey" = EXCLUDED."utcTourTimeKey",
		"propertyTourDateKey" = EXCLUDED."propertyTourDateKey",
		"propertyTourTimeKey" = EXCLUDED."propertyTourTimeKey",
		"isFirstCompletedTour" = EXCLUDED."isFirstCompletedTour",
		"isFirstScheduledTour" = EXCLUDED."isFirstScheduledTour",
		"inventoryKey" = EXCLUDED."inventoryKey";

-- set f_CompletedTour as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_CompletedTour', 'resultPrevInstr', 'final');


-- f_AgentCallSummary
WITH callSrc AS
(
	SELECT c.id,
		c.created_at,
		(c.created_at AT TIME ZONE COALESCE(t."timeZone", first_team."timeZone"))::DATE AS "agentDate",
		COALESCE(tpp."teamId", first_team.id) AS "teamId",
		c."userId" AS "agentId",
		c.parties,
		1 AS "callCount",
		COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) AS "callSeconds",
		CASE WHEN direction = 'in' THEN 1 ELSE 0 END AS "inCall",
		CASE WHEN direction = 'in' THEN COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) ELSE 0 END AS "inCallSeconds",
		CASE WHEN direction = 'out' THEN 1 ELSE 0 END AS "outCall",
		CASE WHEN direction = 'out' THEN COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) ELSE 0 END AS "outCallSeconds",
		CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = true THEN 1 ELSE 0 END AS "isVoiceMail",
		CASE WHEN cqs."callBackTime" IS NOT NULL THEN 1 ELSE 0 END AS "calledBack",
		CASE WHEN cqs."hangUp" = TRUE THEN 1 ELSE 0 END AS "hangUp",
		CASE WHEN cqs."communicationId" IS NOT NULL THEN 1 ELSE 0 END AS "callQueued",
		CASE WHEN cqs."communicationId" IS NOT NULL THEN extract(epoch FROM (date_trunc('second', COALESCE(cqs."exitTime",cqs."entryTime")) - date_trunc('second', cqs."entryTime"))) ELSE 0 END AS "callQueuedSeconds",
		CASE WHEN cqs."callerRequestedAction" = 'call_back' THEN 1 ELSE 0 END AS "requestedCallbacks",
		CASE WHEN cqs."callBackTime" IS NOT NULL THEN COALESCE((date_part('epoch'::text, date_trunc('minute'::text, cqs."callBackTime") - date_trunc('minute'::text, cqs."exitTime")) / 60)::int,0) ELSE 0::int END AS "minutesToCallBack"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_AgentCallSummary' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp ON c."teamPropertyProgramId" = tpp.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Teams" AS t ON tpp."teamId" = t.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Teams" AS first_team ON first_team.id = c."teams"[0]::uuid
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."CallQueueStatistics" AS cqs ON c.id = cqs."communicationId"
	LEFT JOIN LATERAL (SELECT MAX("agentCallSummaryKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_AgentCallSummary") AS fact ON TRUE
WHERE (fact."hasData" IS NULL
  	OR c.created_at >= (lst."loadDate"::date) - INTERVAL '7 day')
	AND c."type" = 'Call'
), distinctPartyGroup AS
(
	SELECT DISTINCT "partyGroupKey", parties
	FROM "dstStarDB"."dstStarSchema"."b_AgentCallSummary_Party"
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_AgentCallSummary"
(
	"agentKey",
	"teamKey",
	"agentDateKey",
	"partyGroupKey",
	"totalCalls",
	"totalCallDuration",
	"avgCallDuration",
	"totalIncomingCalls",
	"totalIncomingCallDuration",
	"avgIncomingCallDuration",
	"totalOutgoingCalls",
	"totalOutgoingCallDuration",
	"avgOutgoingCallDuration",
	"totalHangUps",
	"totalVoicemails",
	"totalRequestedCallbacks",
	"totalCallbacks",
	"totalMinutesToCallback",
	"avgMinutesToCallback",
	"avgQueueDuration"
)
SELECT
	COALESCE(du."userKey", -1),
	COALESCE(dt."teamKey", -1),
	COALESCE(dd."dateKey", 19000101),
	COALESCE(dpg."partyGroupKey", -1),
	sum("callCount") AS "totalCalls",
	sum("callSeconds") AS "totalCallDuration",
	avg("callSeconds") AS "avgCallDuration",
	sum("inCall") AS "totalIncommingCalls",
	sum("inCallSeconds") AS "totalIncommingCallDuration",
	CASE WHEN sum("inCall") > 0 THEN sum("inCallSeconds")::numeric(8,2)/sum("inCall") ELSE 0 END AS "avgIncommingCallDuration",
	sum("outCall") AS "totalOutgoingCalls",
	sum("outCallSeconds") AS "totalOutgoingCallDuration",
	CASE WHEN sum("outCall") > 0 THEN sum("outCallSeconds")::numeric(8,2)/sum("outCall") ELSE 0 END AS "avgOutgoingCallDuration",
	sum("hangUp") AS "totalHangUps",
	sum("isVoiceMail") AS "totalVoicemails",
	sum("requestedCallbacks") AS "totalRequestedCallbacks",
	sum("calledBack") AS "totalCallBacks",
	sum("minutesToCallBack") AS "totalMinutesToCallback",
	CASE WHEN sum("calledBack") > 0 THEN sum("minutesToCallBack")::numeric(8,2)/sum("calledBack") ELSE 0 END AS "avgMinutesToCallback",
	CASE WHEN sum("callQueued") > 0 THEN sum("callQueuedSeconds")::numeric(8,2)/sum("callQueued") ELSE 0 END AS "avgQueueDuration"
FROM callSrc AS src
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON src."agentId" = du."userId" AND "SCD_isCurrent" = 'Yes'
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Team" AS dt ON src."teamId" = dt."teamId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS dd ON src."agentDate" = dd."onlyDate"
	LEFT JOIN distinctPartyGroup dpg ON dpg.parties = src.parties
GROUP BY du."userKey",
	dt."teamKey",
	dd."dateKey",
	dpg."partyGroupKey"
ON CONFLICT ("agentKey", "teamKey", "agentDateKey", "partyGroupKey")
DO UPDATE
	SET
		"totalCalls" = EXCLUDED."totalCalls",
		"totalCallDuration" = EXCLUDED."totalCallDuration",
		"avgCallDuration" = EXCLUDED."avgCallDuration",
		"totalIncomingCalls" = EXCLUDED."totalIncomingCalls",
		"totalIncomingCallDuration" = EXCLUDED."totalIncomingCallDuration",
		"avgIncomingCallDuration" = EXCLUDED."avgIncomingCallDuration",
		"totalOutgoingCalls" = EXCLUDED."totalOutgoingCalls",
		"totalOutgoingCallDuration" = EXCLUDED."totalOutgoingCallDuration",
		"avgOutgoingCallDuration" = EXCLUDED."avgOutgoingCallDuration",
		"totalHangUps" = EXCLUDED."totalHangUps",
		"totalVoicemails" = EXCLUDED."totalVoicemails",
		"totalRequestedCallbacks" = EXCLUDED."totalRequestedCallbacks",
		"totalCallbacks" = EXCLUDED."totalCallbacks",
		"totalMinutesToCallback" = EXCLUDED."totalMinutesToCallback",
		"avgMinutesToCallback" = EXCLUDED."avgMinutesToCallback",
		"avgQueueDuration" = EXCLUDED."avgQueueDuration";

-- set f_AgentCallSummary as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_AgentCallSummary', 'resultPrevInstr', 'final');

-- f_PropertyCallSummary
WITH callSrc AS
(
	SELECT c.id,
		c.created_at,
		(c.created_at AT TIME ZONE COALESCE(p."timezone", pp."timezone"))::DATE AS "propertyDate",
		COALESCE(tpp."propertyId", pp.id) AS "propertyId",
		1 AS "callCount",
		COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) AS "callSeconds",
		CASE WHEN direction = 'in' THEN 1 ELSE 0 END AS "inCall",
		CASE WHEN direction = 'in' THEN COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) ELSE 0 END AS "inCallSeconds",
		CASE WHEN direction = 'out' THEN 1 ELSE 0 END AS "outCall",
		CASE WHEN direction = 'out' THEN COALESCE(date_part('epoch'::text, ('00:'::text || (c.message ->> 'duration'::text))::interval)::integer,0) ELSE 0 END AS "outCallSeconds",
		CASE WHEN COALESCE(c.message ->> 'isVoiceMail'::text, 'false'::text)::boolean = true THEN 1 ELSE 0 END AS "isVoiceMail",
		CASE WHEN cqs."callBackTime" IS NOT NULL THEN 1 ELSE 0 END AS "calledBack",
		CASE WHEN cqs."hangUp" = TRUE THEN 1 ELSE 0 END AS "hangUp",
		CASE WHEN cqs."communicationId" IS NOT NULL THEN 1 ELSE 0 END AS "callQueued",
		CASE WHEN cqs."communicationId" IS NOT NULL THEN extract(epoch FROM (date_trunc('second', COALESCE(cqs."exitTime",cqs."entryTime")) - date_trunc('second', cqs."entryTime"))) ELSE 0 END AS "callQueuedSeconds",
		CASE WHEN cqs."callerRequestedAction" = 'call_back' THEN 1 ELSE 0 END AS "requestedCallbacks",
		CASE WHEN cqs."callBackTime" IS NOT NULL THEN COALESCE((date_part('epoch'::text, date_trunc('minute'::text, cqs."callBackTime") - date_trunc('minute'::text, cqs."exitTime")) / 60)::int,0) ELSE 0::int END AS "minutesToCallBack"
FROM "dstReplicaDB"."dstReplicaSchema"."Communication" AS c
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_PropertyCallSummary' AND lst."needToLoad" = TRUE
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp ON c."teamPropertyProgramId" = tpp.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS p ON tpp."propertyId" = p.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Party" first_party ON first_party.id = c."parties"[0]::uuid
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS pp ON first_party."assignedPropertyId" = pp.id
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."CallQueueStatistics" AS cqs ON c.id = cqs."communicationId"
	LEFT JOIN LATERAL (SELECT MAX("propertyCallSummaryKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_PropertyCallSummary") AS fact ON TRUE
WHERE (fact."hasData" IS NULL
  	OR c.created_at >= (lst."loadDate"::date) - INTERVAL '7 day')
	AND c."type" = 'Call'
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_PropertyCallSummary"
(
	"propertyKey",
	"propertyDateKey",
	"totalCalls",
	"totalCallDuration",
	"avgCallDuration",
	"totalIncomingCalls",
	"totalIncomingCallDuration",
	"avgIncomingCallDuration",
	"totalOutgoingCalls",
	"totalOutgoingCallDuration",
	"avgOutgoingCallDuration",
	"totalHangUps",
	"totalVoicemails",
	"totalRequestedCallbacks",
	"totalCallbacks",
	"totalMinutesToCallback",
	"avgMinutesToCallback",
	"avgQueueDuration"
)
SELECT
	COALESCE(dp."propertyKey",-1),
	COALESCE(dd."dateKey",19000101),
	sum("callCount") AS "totalCalls",
	sum("callSeconds") AS "totalCallDuration",
	avg("callSeconds") AS "avgCallDuration",
	sum("inCall") AS "totalIncommingCalls",
	sum("inCallSeconds") AS "totalIncommingCallDuration",
	CASE WHEN sum("inCall") > 0 THEN sum("inCallSeconds")::numeric(10,2)/sum("inCall") ELSE 0 END AS "avgIncomingCallDuration",
	sum("outCall") AS "totalOutgoingCalls",
	sum("outCallSeconds") AS "totalOutgoingCallDuration",
	CASE WHEN sum("outCall") > 0 THEN sum("outCallSeconds")::numeric(10,2)/sum("outCall") ELSE 0 END AS "avgOutgoingCallDuration",
	sum("hangUp") AS "totalHangUps",
	sum("isVoiceMail") AS "totalVoicemails",
	sum("requestedCallbacks") AS "totalRequestedCallbacks",
	sum("calledBack") AS "totalCallBacks",
	sum("minutesToCallBack") AS "totalMinutesToCallback",
	CASE WHEN sum("calledBack") > 0 THEN sum("minutesToCallBack")::numeric(10,2)/sum("calledBack") ELSE 0 END AS "avgMinutesToCallback",
	CASE WHEN sum("callQueued") > 0 THEN sum("callQueuedSeconds")::numeric(10,2)/sum("callQueued") ELSE 0 END AS "avgQueueDuration"
FROM callSrc AS src
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dp ON src."propertyId" = dp."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS dd ON src."propertyDate" = dd."onlyDate"
GROUP BY dp."propertyKey",
	dd."dateKey"
ON CONFLICT ("propertyKey", "propertyDateKey")
DO UPDATE
	SET
		"totalCalls" = EXCLUDED."totalCalls",
		"totalCallDuration" = EXCLUDED."totalCallDuration",
		"avgCallDuration" = EXCLUDED."avgCallDuration",
		"totalIncomingCalls" = EXCLUDED."totalIncomingCalls",
		"totalIncomingCallDuration" = EXCLUDED."totalIncomingCallDuration",
		"avgIncomingCallDuration" = EXCLUDED."avgIncomingCallDuration",
		"totalOutgoingCalls" = EXCLUDED."totalOutgoingCalls",
		"totalOutgoingCallDuration" = EXCLUDED."totalOutgoingCallDuration",
		"avgOutgoingCallDuration" = EXCLUDED."avgOutgoingCallDuration",
		"totalHangUps" = EXCLUDED."totalHangUps",
		"totalVoicemails" = EXCLUDED."totalVoicemails",
		"totalRequestedCallbacks" = EXCLUDED."totalRequestedCallbacks",
		"totalCallbacks" = EXCLUDED."totalCallbacks",
		"totalMinutesToCallback" = EXCLUDED."totalMinutesToCallback",
		"avgMinutesToCallback" = EXCLUDED."avgMinutesToCallback",
		"avgQueueDuration" = EXCLUDED."avgQueueDuration";


-- set f_PropertyCallSummary as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_PropertyCallSummary', 'resultPrevInstr', 'final');

-- f_Sale
WITH saleSrc AS
(
SELECT
	l.id AS "leaseId",
	prop.id AS "propertyId",
	p.id AS "partyId",
	i.id AS "inventoryId",
	tpp."programId" AS "programId",
	(p.metadata->>'firstContactChannel')::TEXT AS "contactChannel",
	l."signDate"::DATE AS "utcDate",
	TO_CHAR(l."signDate"::TIME,'HH24:MI') AS "utcTime",
	(l."signDate" AT TIME ZONE prop.timezone)::DATE AS "propDate",
	TO_CHAR((l."signDate" AT TIME ZONE prop.timezone)::TIME,'HH24:MI') AS "propTime",
	p."userId" AS "agentId",
	ig."basePriceMonthly" as "currentMarketRent",
	COALESCE((l."baselineData" -> 'publishedLease' ->> 'unitRent')::DECIMAL, 0)
	+ COALESCE((l."baselineData" -> 'quote' ->> 'totalAdditionalRent')::DECIMAL, 0 ) AS "leaseTotalRent",
	COALESCE((l."baselineData" -> 'publishedLease' -> 'oneTimeCharges' -> f.id :: text ->> 'amount')::DECIMAL, 0) AS "leaseUnitDeposit",
	COALESCE((qq."leaseTerms" ->> 'originalBaseRent')::DECIMAL, 0) AS "quoteOriginalBaseRent",
  COALESCE((qq."leaseTerms" ->> 'overwrittenBaseRent')::DECIMAL, 0) as "quoteOverwrittenBaseRent",
	COALESCE((quoteDep."fees" ->> 'amount')::DECIMAL, 0) as "quoteUnitDeposit",
	COALESCE(pq."approvingAgentName", 'N/A') as "approvingAgentName"
FROM "dstReplicaDB"."dstReplicaSchema"."Lease" AS l
	INNER JOIN "dstStarDB"."dstStarSchema"."s_LastLoadDate" AS lst ON lst."tableName" = 'f_Sale' AND lst."needToLoad" = TRUE
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Party" AS p ON p.id = l."partyId"
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Quote" AS q ON l."quoteId" = q.id
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Inventory" AS i ON i.id = q."inventoryId"
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."InventoryGroup" AS ig ON ig.id = i."inventoryGroupId"
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."Property" AS prop ON prop.id = i."propertyId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."TeamPropertyProgram" AS tpp ON tpp.id = p."teamPropertyProgramId"
	LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Fee" f ON f."propertyId" = prop.id AND f.name = 'UnitDeposit'
	LEFT JOIN LATERAL
		(SELECT jsonb_array_elements(q0."publishedQuoteData" -> 'additionalAndOneTimeCharges' -> 'oneTimeCharges') AS "fees"
			FROM "dstReplicaDB"."dstReplicaSchema"."Quote" q0
			WHERE q0.id = q.id
		) quoteDep ON quoteDep."fees" ->> 'id' = f.id::TEXT
	INNER JOIN
		(SELECT jsonb_array_elements("publishedQuoteData" -> 'leaseTerms') AS "leaseTerms",
					( jsonb_array_elements("publishedQuoteData" -> 'leaseTerms') ->> 'termLength')::INTEGER AS "termLength",
					id
			FROM "dstReplicaDB"."dstReplicaSchema"."Quote"
		) qq ON qq.id = l."quoteId"
	INNER JOIN
		(SELECT mostRecent.*, u."fullName" as "approvingAgentName"
			FROM (SELECT rank() OVER ( PARTITION BY "quoteId" ORDER BY created_at DESC ) as "theRank",
								"leaseTermId",
								"quoteId",
								"approvedBy",
								id
						FROM "dstReplicaDB"."dstReplicaSchema"."PartyQuotePromotions"
					) mostRecent
					LEFT JOIN "dstReplicaDB"."dstReplicaSchema"."Users" u on u.id = mostRecent."approvedBy"
			WHERE mostRecent."theRank" = 1
	) pq on pq."quoteId" = qq.id
	INNER JOIN "dstReplicaDB"."dstReplicaSchema"."LeaseTerm" lt ON lt.id = pq."leaseTermId" AND lt."termLength" = qq."termLength"
	LEFT JOIN LATERAL (SELECT MAX("saleKey") AS "hasData" FROM "dstStarDB"."dstStarSchema"."f_Sale") AS fact ON TRUE
WHERE (fact."hasData" IS NULL
		OR l.updated_at >= lst."loadDate")
)
INSERT INTO "dstStarDB"."dstStarSchema"."f_Sale"
(
	"leaseKey",
	"propertyKey",
	"partyKey",
	"inventoryKey",
	"programKey",
	"contactChannelKey",
	"utcDateKey",
	"utcTimeKey",
	"propertyDateKey",
	"propertyTimeKey",
	"agentKey",
	"currentMarketRent",
	"leaseTotalRent",
	"leaseUnitDeposit",
	"quoteOriginalBaseRent",
	"quoteOverwrittenBaseRent",
	"quoteUnitDeposit",
	"approvingAgentName",
	"isNonCompliant"
)
SELECT
	dl."leaseKey",
	COALESCE(dp."propertyKey",-1),
	COALESCE(dpa."partyKey",-1),
	COALESCE(di."inventoryKey",-1),
	COALESCE(dpg."programKey",-1),
	COALESCE(dcc."contactChannelKey",-1),
	COALESCE(utcdd."dateKey",19000101),
	COALESCE(utcdt."timeKey", -1),
	COALESCE(propdd."dateKey",19000101),
	COALESCE(propdt."timeKey", -1),
	COALESCE(du."userKey",-1),
	COALESCE(src."currentMarketRent", -1),
	src."leaseTotalRent",
	src."leaseUnitDeposit",
	src."quoteOriginalBaseRent",
	src."quoteOverwrittenBaseRent",
	src."quoteUnitDeposit",
	src."approvingAgentName",
	CASE
		WHEN dl."applicationDecision" = 'approved' THEN 0
		WHEN dl."applicationDecision" IN ('[No Completed Application]','declined') THEN 1
		WHEN dl."applicationDecision" = 'Guarantor Required' THEN
			CASE WHEN dpa."hasGuarantor" = 'No' THEN 1 ELSE 0 END
		WHEN dl."applicationDecision" IN ('approved_with_cond','further_review') THEN
			/*additional deposit*/
			CASE
				WHEN dl."recommendations" like '%additional deposit%' THEN
					CASE
						WHEN "leaseUnitDeposit" > "quoteUnitDeposit" THEN 0
						ELSE 1
					END
				/*guarantor required - not seen in system with current config*/
				WHEN dl."recommendations" like '%uarantor%' THEN
					CASE WHEN dpa."hasGuarantor" = 'No' THEN 1 ELSE 0 END
				ELSE 0
			END
		ELSE 0
		END AS "isNonCompliant"
FROM saleSrc AS src
	INNER JOIN "dstStarDB"."dstStarSchema"."d_Lease" AS dl ON src."leaseId" = dl."leaseId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Property" AS dp ON src."propertyId" = dp."propertyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dpa ON src."partyId" = dpa."partyId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Inventory" AS di ON src."inventoryId" = di."inventoryId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Program" AS dpg ON src."programId" = dpg."programId"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_ContactChannel" AS dcc ON src."contactChannel" = dcc."channelName"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS utcdd ON src."utcDate" = utcdd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS utcdt ON src."utcTime" = utcdt."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Date" AS propdd ON src."propDate" = propdd."onlyDate"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_Time" AS propdt ON src."propTime" = utcdt."hourMinute"
	LEFT JOIN "dstStarDB"."dstStarSchema"."d_User" AS du ON src."agentId" = du."userId" AND du."SCD_isCurrent" = 'Yes'
ON CONFLICT ("leaseKey")
DO UPDATE
	SET
		"propertyKey" = EXCLUDED."propertyKey",
		"partyKey" = EXCLUDED."partyKey",
		"inventoryKey" = EXCLUDED."inventoryKey",
		"programKey" = EXCLUDED."programKey",
		"contactChannelKey" = EXCLUDED."contactChannelKey",
		"utcDateKey" = EXCLUDED."utcDateKey",
		"utcTimeKey" = EXCLUDED."utcTimeKey",
		"propertyDateKey" = EXCLUDED."propertyDateKey",
		"propertyTimeKey" = EXCLUDED."propertyTimeKey",
		"agentKey" = EXCLUDED."agentKey",
		"currentMarketRent" = EXCLUDED."currentMarketRent",
		"leaseTotalRent" = EXCLUDED."leaseTotalRent",
		"leaseUnitDeposit" = EXCLUDED.	"leaseUnitDeposit",
		"quoteOriginalBaseRent" = EXCLUDED.	"quoteOriginalBaseRent",
		"quoteOverwrittenBaseRent" = EXCLUDED.	"quoteOverwrittenBaseRent",
		"quoteUnitDeposit" = EXCLUDED.	"quoteUnitDeposit",
		"approvingAgentName" = EXCLUDED.	"approvingAgentName",
		"isNonCompliant" = EXCLUDED.	"isNonCompliant";


-- set f_Sale as loaded or cancel all table loadings depending on it
SELECT "dstStarDB"."dstStarSchema".update_last_load_date('f_Sale', 'resultPrevInstr', 'final');

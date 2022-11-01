DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis";

CREATE TABLE "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (

	"metricName"	varchar(255)	,
	"metricAggregationType"	varchar(10)	,
	"eventDt"		date		,
	"partyId"		uuid		,
	"ownerId"		uuid		,
	"propertyId"		uuid		,
	"pipelineStateId"	integer	,
	"metricFloat"   float   ,
	"metricBigint"  bigint   ,
	"updated_at"	timestamptz
);

/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis"
        WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate' ;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"	,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'resolvedStateQty' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	0 as "metricFloat",
	count(distinct psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

/* all parties of each state that completed that respective state specifically on d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" as d
	JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ((date(d."eventDt") = date(psh."end_date") ))
	JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
	LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
	JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
			FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
			WHERE pt."teamId"=tp."teamId"
			GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"
  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'newStateQty' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	0 as "metricFloat",
	count(distinct psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

/* all parties of each state that entered the next state specifically on d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
      JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ((date(d."eventDt") = date(psh."start_date") ))
      LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
      LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
      JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'fullCycleProcessQty' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	5 as "pipelineStateId",
	0 as "metricFloat",
	count(distinct psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* all parties that have completed state 'Lease' specifically on d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
       JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON "state"='Lease' AND date("end_date")=date(d."eventDt")
       LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
         JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"
  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
  "metricName",
  "metricAggregationType",
  "eventDt",
  "partyId",
  "ownerId",
  "propertyId",
  "pipelineStateId",
  "metricFloat",
  "metricBigint",
  "updated_at"
)
SELECT DISTINCT
  'activeStateQty' as "metricName",
  'DAY' as "metricAggregationType",
  d."eventDt" as "eventDt",
  "partyStateHist"."partyId" as "partyId",
  puh."userId" as "ownerId",
  TeamProps."aPropertyId" as "propertyId",
  ps."pipelineStateId" as "pipelineStateId",
  0 as "metricFloat",
  count(distinct "partyStateHist"."partyId") as "metricBigint",
  max("partyStateHist"."updated_at") as "updated_at"

  /* all parties of each state that were active on d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
    JOIN (
      SELECT psh."analyticslogId", psh."partyId", psh.start_date, psh.end_date, psh.state, psh."updated_at"
    FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory" psh
    INNER JOIN 
    (
      SELECT MAX(start_date) max_time, "partyId"
      FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory"
      GROUP BY date(start_date), "partyId"
    ) AS t
    ON psh.start_date = t.max_time) as "partyStateHist" on 
      ( date(d."eventDt") >= date("partyStateHist"."start_date") AND ( date(d."eventDt") < date("partyStateHist"."end_date") OR "partyStateHist"."end_date" IS NULL))
      LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON ("partyStateHist"."analyticslogId"=puh."analyticslogId")
      LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"="partyStateHist"."state")
       JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
              FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
              WHERE pt."teamId"=tp."teamId"
              GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"="partyStateHist"."partyId"
  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'historyStateQty' as "metricName",
	'ALL'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	NULL::uuid  as "partyId",
	NULL::uuid as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	0 as "metricFloat",
	count(distinct psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* all parties each state in history that were active on or before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ( date(psh."start_date") <= date(d."eventDt"))
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'MTDactiveStateQty' as "metricName",
	'MTD'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	null::uuid  as "partyId",
	null::uuid as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	0 as "metricFloat",
	count(distinct psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* MTD all parties each state in history that were active in the same month as before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ( date(psh."start_date") <= date(d."eventDt") AND extract(month from psh."start_date")=extract(month from d."eventDt") AND extract(year from psh."start_date")=extract(year from d."eventDt"))
  LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'resolvedStateDurationHours' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	sum(extract(epoch FROM (LEAST(COALESCE(psh."end_date",d."eventDt"+1),d."eventDt"+1) - psh."start_date")))/3600 as "metricFloat",
	0 as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* total duration of parties of each state resolved specifically on d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ((date(d."eventDt") = date(psh."end_date") ))
  LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'activeStateDurationHours' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	sum(extract(epoch FROM (LEAST(COALESCE(psh."end_date",d."eventDt"+1),d."eventDt"+1) - psh."start_date")))/3600 as "metricFloat",
	0 as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* total duration of parties of each state active d_date.eventDt - as of midnight on  d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ( date(psh."start_date") <= date(d."eventDt") AND (date(d."eventDt") <= date(psh."end_date") OR psh."end_date" IS NULL))
  LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'historyStateDurationHours' as "metricName",
	'ALL'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	NULL::uuid as "partyId",
	NULL::uuid as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	sum(extract(epoch FROM (LEAST(COALESCE(psh."end_date",d."eventDt"+1),d."eventDt"+1) - psh."start_date")))/3600 as "metricFloat",
	0 as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* total duration of all parties ever trangressed as of d_date.eventDt - as of midnight on  d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ( date(d."eventDt") >= date(psh."start_date"))
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'MTDactiveStateDurationHours' as "metricName",
	'ALL'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	NULL::uuid as "partyId",
	NULL::uuid as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	ps."pipelineStateId" as "pipelineStateId",
	sum(extract(epoch FROM (LEAST(COALESCE(psh."end_date",d."eventDt"+1),d."eventDt"+1) - psh."start_date")))/3600 as "metricFloat",
	0 as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* MTD duration all parties each state in history that were active in the same month as before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON ( date(psh."start_date") <= date(d."eventDt") AND extract(month from psh."start_date")=extract(month from d."eventDt") AND extract(year from psh."start_date")=extract(year from d."eventDt"))
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
                FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
                WHERE pt."teamId"=tp."teamId"
                GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" (
	"metricName"		,
	"metricAggregationType"		,
	"eventDt"				,
	"partyId"				,
	"ownerId"				,
	"propertyId"			,
	"pipelineStateId"				,
	"metricFloat"      ,
	"metricBigint"     ,
	"updated_at"
)
SELECT DISTINCT
	'fullCycleDurationHours' as "metricName",
	'DAY'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	psh."partyId"  as "partyId",
	puh."userId" as "ownerId",
	TeamProps."aPropertyId" as "propertyId",
	5 as "pipelineStateId",
	SUM(EXTRACT(epoch FROM (LEAST(COALESCE(history."processEnd_date",d."eventDt"+1),d."eventDt"+1) - history."processStart_date")))/3600 as "metricFloat",
	0 AS "metricBigint",
	MAX(psh."updated_at") as "updated_at"

  /* calculate total process duration for all parties that have completed state 'Lease' specifically on d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh ON "state"='Lease' AND date("end_date")=date(d."eventDt")
  LEFT OUTER JOIN "dstNormDB"."dstNormSchema"."n_PartyUserHistory" as puh ON (psh."analyticslogId"=puh."analyticslogId")
  LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."d_PipelineState" as ps ON (ps."state"=psh."state")
  JOIN (SELECT "partyId", MIN("start_date") AS "processStart_date", MAX("end_date") AS "processEnd_date"
         FROM "dstNormDB"."dstNormSchema"."n_PartyStateHistory"
         GROUP BY "partyId") AS history ON history."partyId"=psh."partyId"
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
        	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
        	WHERE pt."teamId"=tp."teamId"
        	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"
  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'

  GROUP BY 1,2,3,4,5,6,7
  ORDER BY 1,2,3,4,5,6,7;

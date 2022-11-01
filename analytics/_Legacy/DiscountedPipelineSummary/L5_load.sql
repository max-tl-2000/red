/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."f_PipelineStateAnalysis"
        WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate' ;

INSERT INTO "dstStarDB"."dstStarSchema"."f_PipelineStateAnalysis" (
	"eventDt",
	"partyId",
	"ownerId",
	"propertyId",
	"pipelineStateId",

	"activeStateQty", /* m2 */
	"newStateQty", /* m3 */
	"resolvedStateQty", /* m4 */
	"historyStateQty", /* m5 */

	"activeStateDurationHours",  /* m6 */
	"resolvedStateDurationHours", /* m7 */
	"historyStateDurationHours", /* m8 */

	"MTDactiveStateQty", /* m9 */
	"fullCycleProcessQty", /* m10 */
	"MTDactiveStateDurationHours",  /* m11 */
	"fullCycleProcessDurationHours", /* m12 */

	"updated_at"
)
SELECT
	m."eventDt" ,
	m."partyId",
	m."ownerId",
	m."propertyId",
	m."pipelineStateId",

	sum(m2."metricBigint") as "activeStateQty",
	sum(m3."metricBigint") as "newStateQty",
	sum(m4."metricBigint") as "resolvedStateQty",
	sum(m5."metricBigint") as "historyStateQty",
	sum(m6."metricFloat") as "activeStateDurationHours",
	sum(m7."metricFloat") as "resolvedStateDurationHours",
	sum(m8."metricFloat") as "historyStateDurationHours",
	sum(m9."metricBigint") as "MTDactiveStateQty",
	sum(m10."metricBigint") as "fullCycleProcessQty",
	sum(m11."metricFloat") as "MTDactiveStateDurationHours",
	sum(m12."metricFloat") as "fullCycleProcessDurationHours",
	max(m."updated_at")

FROM "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" m
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m2
       ON  m2."metricName"='activeStateQty' AND m2."metricName"=m."metricName" AND m2."pipelineStateId"=m."pipelineStateId" AND date(m2."eventDt")  = date(m."eventDt") AND m."partyId"  IS NOT DISTINCT FROM m2."partyId" AND  m."ownerId"  IS NOT DISTINCT FROM m2."ownerId"  AND  m."propertyId"  IS NOT DISTINCT FROM m2."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m3
       ON  m3."metricName"='newStateQty'  AND m3."metricName"=m."metricName" AND m3."pipelineStateId"=m."pipelineStateId" AND date(m3."eventDt")  = date(m."eventDt") AND m."partyId"  IS NOT DISTINCT FROM m3."partyId" AND  m."ownerId"  IS NOT DISTINCT FROM m3."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m3."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m4
       ON  m4."metricName"='resolvedStateQty'  AND m4."metricName"=m."metricName" AND m4."pipelineStateId"=m."pipelineStateId" AND date(m4."eventDt")  = date(m."eventDt") AND m."partyId"  IS NOT DISTINCT FROM m4."partyId" AND  m."ownerId" IS NOT DISTINCT FROM m4."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m4."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m5
       ON  m5."metricName"='historyStateQty'  AND m5."metricName"=m."metricName" AND m5."pipelineStateId"=m."pipelineStateId" AND date(m5."eventDt")  = date(m."eventDt") AND m5."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m5."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m5."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m6
       ON  m6."metricName"='activeStateDurationHours'  AND m6."metricName"=m."metricName" AND m6."pipelineStateId"=m."pipelineStateId" AND date(m6."eventDt")  = date(m."eventDt") AND m6."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m6."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m6."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m7
       ON  m7."metricName"='resolvedStateDurationHours'  AND m7."metricName"=m."metricName" AND m7."pipelineStateId"=m."pipelineStateId" AND date(m7."eventDt")  = date(m."eventDt") AND m7."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m7."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m7."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m8
       ON  m8."metricName"='historyStateDurationHours'  AND m8."metricName"=m."metricName" AND m8."pipelineStateId"=m."pipelineStateId" AND date(m8."eventDt")  = date(m."eventDt") AND m8."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m8."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m8."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m9
       ON  m9."metricName"='MTDactiveStateQty'  AND m9."metricName"=m."metricName" AND m9."pipelineStateId"=m."pipelineStateId" AND date(m9."eventDt")  = date(m."eventDt") AND m9."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m9."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m9."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m10
       ON  m10."metricName"='fullCycleProcessQty'  AND m10."metricName"=m."metricName" AND m10."pipelineStateId"=m."pipelineStateId" AND date(m10."eventDt")  = date(m."eventDt") AND m10."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m10."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m10."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m11
       ON  m11."metricName"='MTDactiveStateDurationHours'  AND m11."metricName"=m."metricName" AND m11."pipelineStateId"=m."pipelineStateId" AND date(m11."eventDt")  = date(m."eventDt") AND m11."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m11."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m11."propertyId"
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_PipelineStateAnalysis" as m12
       ON  m12."metricName"='fullCycleDurationHours'  AND m12."metricName"=m."metricName" AND m12."pipelineStateId"=m."pipelineStateId" AND date(m12."eventDt")  = date(m."eventDt") AND m12."partyId" IS NOT DISTINCT FROM  m."partyId" AND  m12."ownerId"  IS NOT DISTINCT FROM  m."ownerId"   AND  m."propertyId"  IS NOT DISTINCT FROM m12."propertyId"

GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

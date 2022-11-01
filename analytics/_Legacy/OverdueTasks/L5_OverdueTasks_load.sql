/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."f_OverdueTasks"
  WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate';

INSERT INTO "dstStarDB"."dstStarSchema"."f_OverdueTasks" (

  "eventDt",
  "propertyId",
  "partyId",
  "taskId",
  "userId",

  "activeTasksQty",
  "completedTasksQty",
  "resolvedTasksDurationHours",
  "overdueDurationHours",
  "overdueTasksQty",
  "updated_at"
)
SELECT
  m."eventDt",
  m."propertyId",
  m."partyId",
  m."taskId",
  m."userId",

  SUM(m1."metricBigint") AS "activeTasksQty",
  SUM(m2."metricBigint") AS "completedTasksQty",
  SUM(m3."metricFloat") AS "resolvedTasksDurationHours",
  SUM(m4."metricFloat") AS "overdueDurationHours",
  SUM(m5."metricBigint") AS "overdueTasksQty",

  max(m."updated_at")
  
FROM "dstStarDB"."dstStarSchema"."m_OverdueTasks" m

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_OverdueTasks" as m1 ON  m1."metricName"='activeTasksQty'
  AND m1."metricName"=m."metricName"
  AND m1."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m1."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m1."partyId"
  AND m."taskId"  IS NOT DISTINCT FROM m1."taskId"
  AND m."userId"  IS NOT DISTINCT FROM m1."userId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_OverdueTasks" as m2 ON  m2."metricName"='completedTasksQty'
  AND m2."metricName"=m."metricName"
  AND m2."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m2."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m2."partyId"
  AND m."taskId"  IS NOT DISTINCT FROM m2."taskId"
  AND m."userId"  IS NOT DISTINCT FROM m2."userId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_OverdueTasks" as m3 ON  m3."metricName"='resolvedTasksDurationHours'
  AND m3."metricName"=m."metricName"
  AND m3."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m3."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m3."partyId"
  AND m."taskId"  IS NOT DISTINCT FROM m3."taskId"
  AND m."userId"  IS NOT DISTINCT FROM m3."userId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_OverdueTasks" as m4 ON  m4."metricName"='overdueDurationHours'
  AND m4."metricName"=m."metricName"
  AND m4."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m4."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m4."partyId"
  AND m."taskId"  IS NOT DISTINCT FROM m4."taskId"
  AND m."userId"  IS NOT DISTINCT FROM m4."userId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_OverdueTasks" as m5 ON  m5."metricName"='overdueTasksQty'
  AND m5."metricName"=m."metricName"
  AND m5."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m5."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m5."partyId"
  AND m."taskId"  IS NOT DISTINCT FROM m5."taskId"
  AND m."userId"  IS NOT DISTINCT FROM m5."userId"

GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

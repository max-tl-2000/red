/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."m_OverdueTasks"
WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate' ;

INSERT INTO "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "userId",
 "taskId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'overdueTasksQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 task."partyId",
 task."userId",
 task."taskId",
 0 AS "metricFloat",
 count(DISTINCT task."taskId") AS "metricBigint",
 max(task."updated_at") AS "updated_at"

/* all active and overdue tasks at the same day as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."TaskStateHistory" AS task ON
  (date(task."dueDate") < date(d."eventDt") and ((task.end_date is null and task.state <> 'Completed') or (task.end_date is not null and date(task.end_date) > date(d."eventDt") and task.state <> 'Completed')))
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."PartyTeam" pt, "dstNormDB"."dstNormSchema"."TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=task."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "userId",
 "taskId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'activeTasksQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 task."partyId",
 task."userId",
 task."taskId",
 0 AS "metricFloat",
 count(DISTINCT task."taskId") AS "metricBigint",
 max(task."updated_at") AS "updated_at"

/* all tasks that are active and not overdue at the same day as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."TaskStateHistory" AS task on
  (extract(day from date(task."dueDate")) >= extract(day from date(d."eventDt")) and task.state = 'Active')
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."PartyTeam" pt, "dstNormDB"."dstNormSchema"."TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=task."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "userId",
 "taskId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'completedTasksQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 task."partyId",
 task."userId",
 task."taskId",
 0 AS "metricFloat",
 count(DISTINCT task."taskId") AS "metricBigint",
 max(task."updated_at") AS "updated_at"

/* all tasks completed in the same day as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."TaskStateHistory" AS task ON
 (extract(day from date(task."start_date")) = extract(day from date(d."eventDt")) and task.state = 'Completed')
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."PartyTeam" pt, "dstNormDB"."dstNormSchema"."TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=task."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "userId",
 "taskId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'resolvedTasksDurationHours' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 task."partyId",
 task."userId",
 task."taskId",
 sum(extract(epoch FROM (LEAST(COALESCE(task."end_date", d."eventDt"+1), d."eventDt" + 1) - task."start_date"))) / 3600 as "metricFloat",
 0 AS "metricBigint",
 max(task."updated_at") AS "updated_at"

 /* total duration of tasks completed specifically on d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."TaskStateHistory" AS task ON date(d."eventDt") = date(task."end_date")
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."PartyTeam" pt, "dstNormDB"."dstNormSchema"."TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=task."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "userId",
 "taskId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'overdueDurationHours' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 task."partyId",
 task."userId",
 task."taskId",
 sum(extract(epoch FROM ((d."eventDt" + 1) - task."dueDate"))) / 3600 as "metricFloat",
 0 AS "metricBigint",
 max(task."updated_at") AS "updated_at"

 /* total overdue duration of tasks specifically on d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."TaskStateHistory" AS task on
	date(task."dueDate") < date(d."eventDt")
	and ((task.end_date is null and task.state <> 'Completed')
	or (task.end_date is not null and date(task.end_date) > date(d."eventDt") and task.state <> 'Completed'))
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."PartyTeam" pt, "dstNormDB"."dstNormSchema"."TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=task."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

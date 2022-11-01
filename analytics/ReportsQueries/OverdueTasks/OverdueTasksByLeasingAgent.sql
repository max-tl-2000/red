SELECT prop.name,
       usr."fullName",
       SUM(COALESCE(tsk."activeTasksQty", 0)) + SUM(COALESCE(tsk."overdueTasksQty", 0)) as "openTasks",
       SUM(COALESCE(tsk."overdueTasksQty", 0)) AS "overdueTasks",
       SUM(COALESCE(tsk."completedTasksQty", 0)) AS "completedTasks",
       AVG(COALESCE(tsk."resolvedTasksDurationHours", 0)) AS "avgHoursToCompleteTask",

  ( SELECT COUNT (*)
   FROM "${dstStarSchema}$"."f_OverdueTasks"
   WHERE "resolvedTasksDurationHours" < 24
     AND "userId" = tsk."userId"
     AND "eventDt" = '"${date}$"' ) AS "resolvedUnder24Hours",

  ( SELECT COUNT (*)
   FROM "${dstStarSchema}$"."f_OverdueTasks"
   WHERE "overdueDurationHours" > 24
     AND "userId" = tsk."userId"
     AND "eventDt" = '"${date}$"' ) AS "overdueMoreThan24Hours"
FROM "${dstStarSchema}$"."f_OverdueTasks" tsk
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = tsk."propertyId"
INNER JOIN "${dstStarSchema}$"."d_User" usr ON usr."userId" = tsk."userId"
WHERE tsk."eventDt" = '"${date}$"'
GROUP BY prop.name,
         usr."fullName",
         tsk."userId";

DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_OverdueTasks";
CREATE TABLE "dstStarDB"."dstStarSchema"."f_OverdueTasks" (

  "eventDt" date,
  "propertyId" uuid,
  "partyId" uuid,
  "taskId" uuid,
  "userId" uuid,

  "activeTasksQty" bigint,
  "overdueTasksQty" bigint,
  "completedTasksQty" bigint,
  "resolvedTasksDurationHours" float,
  "overdueDurationHours" float,

  "updated_at"	timestamptz
);

DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."m_OverdueTasks";

CREATE TABLE "dstStarDB"."dstStarSchema"."m_OverdueTasks" (
	"metricName" VARCHAR(255),
	"metricAggregationType"	VARCHAR(10),
	"eventDt" date,
	"propertyId" uuid,
	"partyId" uuid,
	"userId" uuid,
	"taskId" uuid,
	"metricFloat" FLOAT,
	"metricBigint" BIGINT,
	"updated_at" timestamptz
);

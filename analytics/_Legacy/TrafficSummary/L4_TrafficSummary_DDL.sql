DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."m_TrafficSummary";

CREATE TABLE "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
	"metricName" VARCHAR(255),
	"metricAggregationType"	VARCHAR(10),
	"eventDt" date,
	"propertyId" uuid,
	"partyId" uuid,
	"type" VARCHAR(50),
	"score" VARCHAR(50),
	"metricFloat" FLOAT,
	"metricBigint" BIGINT,
	"updated_at" timestamptz
);

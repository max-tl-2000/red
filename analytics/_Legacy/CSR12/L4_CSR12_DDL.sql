DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12";

CREATE TABLE "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
	"metricName" VARCHAR(255),
	"metricAggregationType"	VARCHAR(10),
	"eventDt" date,
	"propertyId" uuid,
	"partyId" uuid,
	"metricFloat" FLOAT,
	"metricBigint" BIGINT,
	"updated_at" timestamptz
);

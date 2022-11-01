DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_TrafficSummary";
CREATE TABLE "dstStarDB"."dstStarSchema"."f_TrafficSummary" (

  "eventDt" date,
  "propertyId" uuid,
  "partyId" uuid,
  "score" VARCHAR(50),
  "type" VARCHAR(50),

  "toursQty" BIGINT,
  "MTDtoursQty" BIGINT,
  "QTDtoursQty" BIGINT,
  "YTDtoursQty" BIGINT,
  "newContactsQty" BIGINT,
  "MTDnewContactsQty" BIGINT,
  "QTDnewContactsQty" BIGINT,
  "YTDnewContactsQty" BIGINT,
  "salesQty" BIGINT,
  "MTDsalesQty" BIGINT,
  "QTDsalesQty" BIGINT,
  "YTDsalesQty" BIGINT,

  "updated_at"	timestamptz
);

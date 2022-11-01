DROP TABLE IF EXISTS "dstStarDB"."dstStarSchema"."f_ConversionSummaryRolling12";
CREATE TABLE "dstStarDB"."dstStarSchema"."f_ConversionSummaryRolling12" (

	"eventDt" date,
	"propertyId" uuid,
	"partyId" uuid,
	
	"toursQty" BIGINT,
	"newContactsQty" BIGINT,
	"leasesQty" BIGINT,
	"salesQty" BIGINT,

  "MTDtoursQty" BIGINT,
  "MTDnewContactsQty" BIGINT,
  "MTDleasesQty" BIGINT,
  "MTDsalesQty" BIGINT,

	"rateIncreasePercent" FLOAT,

	"updated_at"	timestamptz
);

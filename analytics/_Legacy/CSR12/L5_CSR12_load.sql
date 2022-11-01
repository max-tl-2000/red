/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."f_ConversionSummaryRolling12"
  WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate';

INSERT INTO "dstStarDB"."dstStarSchema"."f_ConversionSummaryRolling12" (

  "eventDt",
  "propertyId",
  "partyId",

  "toursQty",
  "newContactsQty",
  "leasesQty",
  "salesQty",

  "MTDtoursQty",
  "MTDnewContactsQty",
  "MTDleasesQty",
  "MTDsalesQty",

  "updated_at"
)
SELECT
  m."eventDt",
  m."propertyId",
  m."partyId",

  SUM(m2."metricBigint") AS "toursQty",
  SUM(m3."metricBigint") AS "newContactsQty",
  SUM(m4."metricBigint") AS "leasesQty",
  SUM(m5."metricBigint") AS "salesQty",

  SUM(m6."metricBigint") AS "MTDtoursQty",
  SUM(m7."metricBigint") AS "MTDnewContactsQty",
  SUM(m8."metricBigint") AS "MTDleasesQty",
  SUM(m9."metricBigint") AS "MTDsalesQty",

  max(m."updated_at")

FROM "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" m
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m2 ON  m2."metricName"='toursQty'
  AND m2."metricName"=m."metricName"
  AND m2."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m2."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m2."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m3 ON  m3."metricName"='newContactsQty'
  AND m3."metricName"=m."metricName"
  AND m3."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m3."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m3."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m4 ON  m4."metricName"='leasesQty'
  AND m4."metricName"=m."metricName"
  AND m4."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m4."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m4."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m5 ON  m5."metricName"='salesQty'
  AND m5."metricName"=m."metricName"
  AND m5."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m5."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m5."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m6 ON  m6."metricName"='MTDtoursQty'
  AND m6."metricName"=m."metricName"
  AND m6."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m6."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m6."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m7 ON  m7."metricName"='MTDnewContactsQty'
  AND m7."metricName"=m."metricName"
  AND m7."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m7."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m7."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m8 ON  m8."metricName"='MTDleasesQty'
  AND m8."metricName"=m."metricName"
  AND m8."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m8."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m8."partyId"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" as m9 ON  m9."metricName"='MTDsalesQty'
  AND m9."metricName"=m."metricName"
  AND m9."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m9."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m9."partyId"
  
GROUP BY 1,2,3
ORDER BY 1,2,3;

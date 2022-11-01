/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."f_TrafficSummary"
  WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate';

INSERT INTO "dstStarDB"."dstStarSchema"."f_TrafficSummary" (

  "eventDt",
  "propertyId",
  "partyId",
  "score",
  "type",

  "newContactsQty",
  "MTDnewContactsQty",
  "QTDnewContactsQty",
  "YTDnewContactsQty",

  "toursQty",
  "MTDtoursQty",
  "QTDtoursQty",
  "YTDtoursQty",

  "salesQty",
  "MTDsalesQty",
  "QTDsalesQty",
  "YTDsalesQty",

  "updated_at"
)
SELECT
  m."eventDt",
  m."propertyId",
  m."partyId",
  m."score",
  m."type",

  SUM(m1."metricBigint") AS "newContactsQty",
  SUM(m2."metricBigint") AS "MTDnewContactsQty",
  SUM(m3."metricBigint") AS "QTDnewContactsQty",
  SUM(m4."metricBigint") AS "YTDnewContactsQty",

  SUM(m5."metricBigint") AS "toursQty",
  SUM(m6."metricBigint") AS "MTDtoursQty",
  SUM(m7."metricBigint") AS "QTDtoursQty",
  SUM(m8."metricBigint") AS "YTDtoursQty",

  SUM(m9."metricBigint") AS "salesQty",
  SUM(m10."metricBigint") AS "MTDsalesQty",	
  SUM(m11."metricBigint") AS "QTDsalesQty",
  SUM(m12."metricBigint") AS "YTDsalesQty",

  max(m."updated_at")
  
FROM "dstStarDB"."dstStarSchema"."m_TrafficSummary" m

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m1 ON  m1."metricName"='newContactsQty'
  AND m1."metricName"=m."metricName"
  AND m1."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m1."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m1."partyId"
  AND m."score"  IS NOT DISTINCT FROM m1."score"
  AND m."type"  IS NOT DISTINCT FROM m1."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m2 ON  m2."metricName"='MTDnewContactsQty'
  AND m2."metricName"=m."metricName"
  AND m2."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m2."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m2."partyId"
  AND m."score"  IS NOT DISTINCT FROM m2."score"
  AND m."type"  IS NOT DISTINCT FROM m2."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m3 ON  m3."metricName"='QTDnewContactsQty'
  AND m3."metricName"=m."metricName"
  AND m3."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m3."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m3."partyId"
  AND m."score"  IS NOT DISTINCT FROM m3."score"
  AND m."type"  IS NOT DISTINCT FROM m3."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m4 ON  m4."metricName"='YTDnewContactsQty'
  AND m4."metricName"=m."metricName"
  AND m4."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m4."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m4."partyId"
  AND m."score"  IS NOT DISTINCT FROM m4."score"
  AND m."type"  IS NOT DISTINCT FROM m4."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m5 ON  m5."metricName"='toursQty'
  AND m5."metricName"=m."metricName"
  AND m5."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m5."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m5."partyId"
  AND m."score"  IS NOT DISTINCT FROM m5."score"
  AND m."type"  IS NOT DISTINCT FROM m5."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m6 ON  m6."metricName"='MTDtoursQty'
  AND m6."metricName"=m."metricName"
  AND m6."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m6."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m6."partyId"
  AND m."score"  IS NOT DISTINCT FROM m6."score"
  AND m."type"  IS NOT DISTINCT FROM m6."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m7 ON  m7."metricName"='QTDtoursQty'
  AND m7."metricName"=m."metricName"
  AND m7."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m7."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m7."partyId"
  AND m."score"  IS NOT DISTINCT FROM m7."score"
  AND m."type"  IS NOT DISTINCT FROM m7."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m8 ON  m8."metricName"='YTDtoursQty'
  AND m8."metricName"=m."metricName"
  AND m8."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m8."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m8."partyId"
  AND m."score"  IS NOT DISTINCT FROM m8."score"
  AND m."type"  IS NOT DISTINCT FROM m8."type"

  
LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m9 ON  m9."metricName"='salesQty'
  AND m9."metricName"=m."metricName"
  AND m9."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m9."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m9."partyId"
  AND m."score"  IS NOT DISTINCT FROM m9."score"
  AND m."type"  IS NOT DISTINCT FROM m9."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m10 ON  m10."metricName"='MTDsalesQty'
  AND m10."metricName"=m."metricName"
  AND m10."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m10."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m10."partyId"
  AND m."score"  IS NOT DISTINCT FROM m10."score"
  AND m."type"  IS NOT DISTINCT FROM m10."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m11 ON  m11."metricName"='QTDsalesQty'
  AND m11."metricName"=m."metricName"
  AND m11."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m11."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m11."partyId"
  AND m."score"  IS NOT DISTINCT FROM m11."score"
  AND m."type"  IS NOT DISTINCT FROM m11."type"

LEFT OUTER JOIN "dstStarDB"."dstStarSchema"."m_TrafficSummary" as m12 ON  m12."metricName"='YTDsalesQty'
  AND m12."metricName"=m."metricName"
  AND m12."eventDt" = m."eventDt"
  AND m."propertyId" IS NOT DISTINCT FROM m12."propertyId"
  AND m."partyId"  IS NOT DISTINCT FROM m12."partyId"
  AND m."score"  IS NOT DISTINCT FROM m12."score"
  AND m."type"  IS NOT DISTINCT FROM m12."type"

GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

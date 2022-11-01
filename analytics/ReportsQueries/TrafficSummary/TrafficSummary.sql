-- here we still need to determine the way to retrieve the price/sq ft to be able to do the required calculations

SELECT CASE
           WHEN ts."score" IS NULL
                OR ts."score"='' THEN 'UNKNOWN'
           ELSE ts."score"
       END AS "partyScore",
       SUM(coalesce(ts."newContactsQty", 0)) AS "newContacts",
       SUM(coalesce(ts."toursQty", 0)) AS tours,
       SUM(coalesce(ts."salesQty", 0)) AS "sales"
FROM "${dstStarSchema}$"."f_TrafficSummary" ts
WHERE ts."eventDt" = date("${date}$")
GROUP BY "partyScore";

------------------------------------------------------------------------------------------

SELECT coalesce(ts."type", 'UNKNOWN') AS "partyType",
       CASE
           WHEN ts."score" IS NULL
                OR ts."score"='' THEN 'UNKNOWN'
           ELSE ts."score"
       END AS "partyScore",
       SUM(coalesce(ts."newContactsQty", 0)) AS "newContacts",
       SUM(coalesce(ts."toursQty", 0)) AS tours,
       SUM(coalesce(ts."salesQty", 0)) AS "sales"
FROM "${dstStarSchema}$"."f_TrafficSummary" ts
WHERE ts."eventDt" = date("${date}$")
GROUP BY "partyType",
         "partyScore";

SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."MTDnewContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."MTDtoursQty", 0)) AS "tours",
       SUM(COALESCE(csr."MTDleasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."MTDsalesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE csr."eventDt" = date("${date}$") -- this should be the current date the report is generated.
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '1 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '2 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '3 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '4 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '5 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '6 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '7 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '8 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '9 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '10 month'))
GROUP BY prop."name",
         "month"
UNION ALL
SELECT prop."name",
       to_char(csr."eventDt", 'Month') AS "month",
       SUM(COALESCE(csr."newContactsQty", 0)) AS "newContacts",
       SUM(COALESCE(csr."toursQty", 0)) AS "tours",
       SUM(COALESCE(csr."leasesQty", 0)) AS "leases",
       SUM(COALESCE(csr."salesQty", 0)) AS "sales",
       AVG(COALESCE(csr."rateIncreasePercent", 0)) AS "rentIncreasePercent"
FROM "${dstStarSchema}$"."f_ConversionSummaryRolling12" csr
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = csr."propertyId"
WHERE extract(MONTH
              FROM csr."eventDt") = extract(MONTH
                                            FROM (date("${date}$") - interval '11 month'))
GROUP BY prop."name",
         "month";

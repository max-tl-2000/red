SELECT prop."name",
       psa."eventDt",

  ( SELECT DISTINCT "salesTarget"
   FROM "${dstStarSchema}$"."d_TeamSalesTargets" tst
   INNER JOIN "${dstStarSchema}$"."d_UserTeamProperty" usp ON usp."teamId" = tst."teamId"
   WHERE usp."propertyId" = prop."propertyId"
     AND (extract(MONTH
                  FROM psa."eventDt") = tst."month"
          AND extract(YEAR
                      FROM psa."eventDt") = tst."year") LIMIT 1) AS "salesTarget",
       SUM(psa."MTDactiveStateQty") AS "Current",
       0 AS "Projected",
       ps.state,
       AVG(psa."activeStateDurationHours") AS "activeInStateAvgHours",

  (SELECT SUM(psa."fullCycleProcessDurationHours")
   FROM "${dstStarSchema}$"."f_PipelineStateAnalysis" psa
   WHERE psa."eventDt" = date("${date}$")
     AND psa."pipelineStateId" = ps."pipelineStateId"
     AND psa."propertyId" = prop."propertyId" ) AS "fullCycleHours"
FROM "${dstStarSchema}$"."f_PipelineStateAnalysis" psa
INNER JOIN "${dstStarSchema}$"."d_Property" prop ON prop."propertyId" = psa."propertyId"
INNER JOIN "${dstStarSchema}$"."d_PipelineState" ps ON ps."pipelineStateId" = psa."pipelineStateId"
WHERE psa."eventDt" = date("${date}$")
GROUP BY prop."propertyId",
         prop."name",
         ps."pipelineStateId",
         ps.state,
         psa."eventDt";

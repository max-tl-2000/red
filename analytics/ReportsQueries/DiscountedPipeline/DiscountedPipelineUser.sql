SELECT usr."fullName",
       psa."eventDt",
       COUNT (DISTINCT psa."partyId") AS "Current",
             0 AS "Projected",
             tmst."salesTarget",
             tmst."contactsToSalesConv",
             tmst."leadsToSalesConv",
             tmst."prospectsToSalesConv",
             tmst."applicantsToSalesConv",
             ps.state,
             AVG(psa."activeStateDurationHours") AS "activeInStateAvgHours", -- don't know if this should be an avg or a total ?

  (SELECT SUM(psa."fullCycleProcessDurationHours")
   FROM "${dstStarSchema}$"."f_PipelineStateAnalysis" psa
   WHERE psa."eventDt" = date("${date}$")
     AND psa."pipelineStateId" = ps."pipelineStateId"
     AND psa."ownerId" = usr."userId" ) AS "fullCycleHours"
FROM "${dstStarSchema}$"."f_PipelineStateAnalysis" psa
INNER JOIN "${dstStarSchema}$"."d_User" usr ON usr."userId" = psa."ownerId"
INNER JOIN "${dstStarSchema}$"."d_PipelineState" ps ON ps."pipelineStateId" = psa."pipelineStateId"
LEFT JOIN "${dstStarSchema}$"."d_TeamMemberSalesTargets" tmst
  ON (psa."ownerId" = tmst."userId" AND (extract(MONTH FROM psa."eventDt") = tmst."month" AND extract(YEAR FROM psa."eventDt") = tmst."year"))
WHERE psa."eventDt" = date("${date}$")
GROUP BY tmst."salesTarget",
         tmst."contactsToSalesConv",
         tmst."leadsToSalesConv",
         tmst."prospectsToSalesConv",
         tmst."applicantsToSalesConv",
         usr."fullName",
         ps.state,
         psa."eventDt",
         ps."pipelineStateId",
         usr."userId";

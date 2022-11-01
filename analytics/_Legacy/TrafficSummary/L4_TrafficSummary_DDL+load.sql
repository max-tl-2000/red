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

/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."m_TrafficSummary"
WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate' ;

/* --------======== New Contacts Section ========-------- */
/* -- number of new contacts in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
	'newContactsQty' AS "metricName",
	'DAY'  AS "metricAggregationType",
	d."eventDt" AS "eventDt",
	TeamProps."aPropertyId" AS "propertyId",
	psh."partyId",
	dp."type",
	dp."score",
	0 AS "metricFloat",
	count(DISTINCT psh."partyId") AS "metricBigint",
	max(psh."updated_at") AS "updated_at"

/* all parties with the state of new Contact that were created in the same day as d_date.eventDt */
 FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
     JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
     ON ( date(psh."start_date") = date(d."eventDt") AND (psh.state = 'Contact' or psh.state = 'Lead'))
     JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp on psh."partyId" = dp."partyId"
     JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
               FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
               WHERE pt."teamId"=tp."teamId"
               GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

 WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
 GROUP BY 1,2,3,4,5,6,7
 ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
	'MTDnewContactsQty' as "metricName",
	'MTD'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	TeamProps."aPropertyId" as "propertyId",
	NULL::uuid as "partyId",
	NULL as "type",
	NULL as "score",
	0 as "metricFloat",
	count(DISTINCT psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* MTD all parties that were in the state of Contact or Lead in the same month as before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh
  	ON ( date(psh."start_date") <= date(d."eventDt")
  		 AND extract(month from psh."start_date")=extract(month from d."eventDt")
  		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
  		 AND (psh.state = 'Contact' or psh.state = 'Lead'))
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
         FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
         WHERE pt."teamId"=tp."teamId"
         GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6
  ORDER BY 1,2,3,4,5,6;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
	'QTDnewContactsQty' as "metricName",
	'QTD'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	TeamProps."aPropertyId" as "propertyId",
	NULL::uuid as "partyId",
	NULL as "type",
	NULL as "score",
	0 as "metricFloat",
	count(DISTINCT psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* MTD all parties that were in the state of Contact or Lead in the same quarter as before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh
  	ON ( date(psh."start_date") <= date(d."eventDt")
  		 AND extract(quarter from psh."start_date")=extract(quarter from d."eventDt")
  		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
  		 AND (psh.state = 'Contact' or psh.state = 'Lead'))
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
         FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
         WHERE pt."teamId"=tp."teamId"
         GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6
  ORDER BY 1,2,3,4,5,6;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
	'YTDnewContactsQty' as "metricName",
	'YTD'  as "metricAggregationType",
	d."eventDt"  as "eventDt",
	TeamProps."aPropertyId" as "propertyId",
	NULL::uuid as "partyId",
	NULL as "type",
	NULL as "score",
	0 as "metricFloat",
	count(DISTINCT psh."partyId") as "metricBigint",
	max(psh."updated_at") as "updated_at"

  /* MTD all parties that were in the state of Contact or Lead in the same year as before d_date.eventDt */
  FROM "dstStarDB"."dstStarSchema"."d_Date" as d
  JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" as psh
  	ON ( date(psh."start_date") <= date(d."eventDt")
  		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
  		 AND (psh.state = 'Contact' or psh.state = 'Lead'))
  JOIN (SELECT "partyId", MIN("propertyId"::text)::uuid AS "aPropertyId"
         FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
         WHERE pt."teamId"=tp."teamId"
         GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

  WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
  GROUP BY 1,2,3,4,5,6
  ORDER BY 1,2,3,4,5,6;

/* --------======== New Contacts Section END ========-------- */


/* --------======== Tours Section ========-------- */
/* -- number of tours in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'toursQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 app."partyId",
 dp."type",
 dp."score",
 0 AS "metricFloat",
 count(DISTINCT app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

 /* all tours in the same day as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" AS app ON date(app."completionDate") = date(d."eventDt")
JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp on app."partyId" = dp."partyId"
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=app."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'MTDtoursQty' AS "metricName",
 'MTD'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 NULL::uuid as "partyId",
 null as "type",
 null as score,
 0 AS "metricFloat",
 count(distinct app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

 /* all tours in the same month as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" AS app
	ON (date(app."completionDate") <= date(d."eventDt")
		 AND extract(month from app."completionDate")=extract(month from d."eventDt")
		 AND extract(year from app."completionDate")=extract(year from d."eventDt"))
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=app."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'QTDtoursQty' AS "metricName",
 'QTD'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 NULL::uuid as "partyId",
 null as "type",
 null as score,
 0 AS "metricFloat",
 count(distinct app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

 /* all tours in the same quarter as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" AS app
	ON (date(app."completionDate") <= date(d."eventDt")
		 AND extract(quarter from app."completionDate")=extract(quarter from d."eventDt")
		 AND extract(year from app."completionDate")=extract(year from d."eventDt"))
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=app."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'YTDtoursQty' AS "metricName",
 'YTD'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 NULL::uuid as "partyId",
 null as "type",
 null as score,
 0 AS "metricFloat",
 count(distinct app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

 /* all tours in the same year as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" AS app
	ON (date(app."completionDate") <= date(d."eventDt")
		 AND extract(year from app."completionDate")=extract(year from d."eventDt"))
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=app."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

/* --------======== Tours Section END ========-------- */


/* --------======== Sales Section ========-------- */
INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'salesQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 psh."partyId",
 dp."type",
 dp."score",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned lease (completed application) in the same day as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
ON ( date(psh."start_date") = date(d."eventDt") AND psh.state = 'FutureResident')
JOIN "dstStarDB"."dstStarSchema"."d_Party" AS dp on psh."partyId" = dp."partyId"
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'MTDsalesQty' AS "metricName",
 'MTD'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid as "partyId",
 null as "type",
 null as "score",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned to a sale (future resident) in the same month as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
   	ON ( date(psh."start_date") <= date(d."eventDt")
    		 AND extract(month from psh."start_date")=extract(month from d."eventDt")
    		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
    		 AND psh.state = 'FutureResident')
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'QTDsalesQty' AS "metricName",
 'QTD'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid  as "partyId",
 null as "type",
 null as "score",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned to a sale (future resident) in the same quarter as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
   	ON ( date(psh."start_date") <= date(d."eventDt")
    		 AND extract(quarter from psh."start_date")=extract(quarter from d."eventDt")
    		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
    		 AND psh.state = 'FutureResident')
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;


INSERT INTO "dstStarDB"."dstStarSchema"."m_TrafficSummary" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "type",
 "score",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'YTDsalesQty' AS "metricName",
 'YTD'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid as "partyId",
 null as "type",
 null as "score",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned to a sale (future resident) in the same year as d_date.eventDt */
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
   	ON ( date(psh."start_date") <= date(d."eventDt")
		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
		 AND psh.state = 'FutureResident')
JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
	FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
	WHERE pt."teamId"=tp."teamId"
	GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5,6,7
ORDER BY 1,2,3,4,5,6,7;

/* --------======== Sales Section END ========-------- */

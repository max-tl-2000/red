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


/* erase all metric prior metric calculations for new ETL recalculation time */
DELETE FROM "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12"
WHERE "eventDt">='etlFrameDate' and "eventDt"<='etlToDate' ;

/* --------======== New Contacts Section ========-------- */
/* -- number of new contacts in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'newContactsQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt" AS "eventYear",
 TeamProps."aPropertyId" AS "propertyId",
 psh."partyId",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties with the state of new Contact that were created in the same day as d_date.eventDt */
	FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
			JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
			ON ( date(psh."start_date") = date(d."eventDt") AND (psh.state = 'Contact' or psh.state = 'Lead'))
			JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
								FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
								WHERE pt."teamId"=tp."teamId"
								GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

	WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
	GROUP BY 1,2,3,4,5
	ORDER BY 1,2,3,4,5;

/* -- number of new contacts MTD */
INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'MTDnewContactsQty' AS "metricName",
 'MTD'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid as"partyId",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"
FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
		JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
    ON ( date(psh."start_date") <= date(d."eventDt")
    		 AND extract(month from psh."start_date")=extract(month from d."eventDt")
    		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
    		 AND (psh.state = 'Contact' or psh.state = 'Lead'))
		JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
				FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
				WHERE pt."teamId"=tp."teamId"
				GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

/* --------======== New Contacts Section END ========-------- */


/* --------======== Tours Section ========-------- */
/* -- number of tours in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
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
 0 AS "metricFloat",
 count(DISTINCT app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

 /* all tours in the same day as d_date.eventDt */
	FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
			JOIN "dstNormDB"."dstNormSchema"."n_AnalyticsLogAppointment" AS app ON date(app."completionDate") = date(d."eventDt")
			JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
								FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
								WHERE pt."teamId"=tp."teamId"
								GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=app."partyId"

	WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
		GROUP BY 1,2,3,4,5
		ORDER BY 1,2,3,4,5;

INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'MTDtoursQty' AS "metricName",
 'MTD'  AS "metricAggregationType",
 d."eventDt"  AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid as "partyId",
 0 AS "metricFloat",
 count(distinct app."partyId") AS "metricBigint",
 max(app."updated_at") AS "updated_at"

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
GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

/* --------======== Tours Section END ========-------- */


/* --------======== Leases Section ========-------- */
/* -- number of leases (completed applications) in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "metricFloat",
 "metricBigint",
 "updated_at"

)
SELECT DISTINCT
 'leasesQty' AS "metricName",
 'DAY'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 psh."partyId",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned lease (completed application) in the same day as d_date.eventDt */
	FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
			JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
			ON ( date(psh."start_date") = date(d."eventDt") AND psh.state = 'Lease')
			JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
								FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
								WHERE pt."teamId"=tp."teamId"
								GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

	WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
	GROUP BY 1,2,3,4,5
	ORDER BY 1,2,3,4,5;

INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
 "metricFloat",
 "metricBigint",
 "updated_at"
)
SELECT DISTINCT
 'MTDleasesQty' AS "metricName",
 'MTD'  AS "metricAggregationType",
 d."eventDt" AS "eventDt",
 TeamProps."aPropertyId" AS "propertyId",
 null::uuid as "partyId",
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"
  FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
  		JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
      ON ( date(psh."start_date") <= date(d."eventDt")
      		 AND extract(month from psh."start_date")=extract(month from d."eventDt")
      		 AND extract(year from psh."start_date")=extract(year from d."eventDt")
       		 AND psh.state = 'Lease')
  		JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
  							FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
  							WHERE pt."teamId"=tp."teamId"
  							GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

/* --------======== Leases Section END ========-------- */


/* --------======== Sales Section ========-------- */
/* -- number of sales (future resident) in the day */
INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
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
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned lease (completed application) in the same day as d_date.eventDt */
	FROM "dstStarDB"."dstStarSchema"."d_Date" AS d
			JOIN "dstNormDB"."dstNormSchema"."n_PartyStateHistory" AS psh
			ON ( date(psh."start_date") = date(d."eventDt") AND psh.state = 'FutureResident')

			JOIN (SELECT "partyId", MIN("propertyId"::TEXT)::uuid AS "aPropertyId"
								FROM "dstNormDB"."dstNormSchema"."n_PartyTeam" pt, "dstNormDB"."dstNormSchema"."n_TeamProperties" tp
								WHERE pt."teamId"=tp."teamId"
								GROUP BY "partyId") AS TeamProps ON TeamProps."partyId"=psh."partyId"

	WHERE d."eventDt">='etlFrameDate' and d."eventDt"<='etlToDate'
	GROUP BY 1,2,3,4,5
	ORDER BY 1,2,3,4,5;

INSERT INTO "dstStarDB"."dstStarSchema"."m_ConversionSummaryRolling12" (
 "metricName",
 "metricAggregationType",
 "eventDt",
 "propertyId",
 "partyId",
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
 0 AS "metricFloat",
 count(DISTINCT psh."partyId") AS "metricBigint",
 max(psh."updated_at") AS "updated_at"

 /* all parties that were transitioned lease (completed application) in the same day as d_date.eventDt */
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
GROUP BY 1,2,3,4,5
ORDER BY 1,2,3,4,5;

/* --------======== Sales Section END ========-------- */

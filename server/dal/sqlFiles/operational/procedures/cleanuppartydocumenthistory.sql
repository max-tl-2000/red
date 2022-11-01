CREATE OR REPLACE FUNCTION db_namespace.cleanuppartydocumenthistory(p_batchSize integer, p_versionsToKeep integer, p_noOfDaysFullHistory integer)
/* USAGE: Delete the oldest 1000 rows, keeping 1 version for each party; the rows updated in the last 14 days are not deleted
** SELECT db_namespace.cleanuppartydocumenthistory(1000,1,14); */
 RETURNS void
 LANGUAGE plpgsql
AS $function$
	DECLARE rowCount int;
	DECLARE referenceDate timestamptz;
BEGIN
    SELECT TO_CHAR(NOW(),'YYYY-MM-DD')::timestamptz - (p_noOfDaysFullHistory || ' days')::INTERVAL INTO referenceDate; -- substract X days from today
    IF p_versionsToKeep > 0 THEN
		WITH pdhOrder AS
		(
		SELECT id,
			RANK() OVER (PARTITION BY "partyId" ORDER BY transaction_id DESC) AS ord, --keep all versions with the same last transaction_id
			updated_at
		FROM db_namespace."PartyDocumentHistory"
		)
		DELETE FROM db_namespace."PartyDocumentHistory" pdh
		USING pdhOrder
		WHERE pdhOrder.id = pdh.id
			AND pdhOrder.ord > p_versionsToKeep
			AND pdh.updated_at < referenceDate
		AND pdh.Id IN
			(
				SELECT Id FROM pdhOrder AS po WHERE po.ord > p_versionsToKeep ORDER BY po.updated_at ASC LIMIT p_batchSize
			);

    --deleting data from PartyEvents with no correspondent data in PartyDocumentHistory
		delete from db_namespace."PartyEvents" del
		using db_namespace."PartyEvents" pe
		left join db_namespace."PartyDocumentHistory" ph
		on ph."partyId"  = pe."partyId"
				and ph.transaction_id = pe.transaction_id
		where
		ph.id is null
		and del.id = pe.id;
		-- get no of rows deleted
		GET DIAGNOSTICS rowCount = ROW_COUNT;
		RAISE NOTICE 'Function cleanuppartydocumenthistory removed % PartyDocumentHistory versions for parties that were not changed in the last % day/s, keeping % version/s', rowCount, p_noOfDaysFullHistory, p_versionsToKeep;
	ELSE
		RAISE NOTICE 'Given p_versionsToKeep parameter is less than 1. If you want to delete all from PartyDocumentHistory use TRUNCATE TABLE';
	END IF;
END;
$function$
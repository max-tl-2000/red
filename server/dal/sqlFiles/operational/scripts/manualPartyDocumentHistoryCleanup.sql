-- replace db_namespace with tenant schema name

-- CHECKS

-- total rows in PartyDocumentHistory
SELECT count(1) FROM db_namespace."PartyDocumentHistory";

-- no of records with updated_at in the last 14 days - will all be kept
SELECT count(1) FROM db_namespace."PartyDocumentHistory" WHERE updated_at >= now() - '14 days'::INTERVAL;

-- no of records to be deleted
WITH pdhOrder AS
(
SELECT id,
	RANK() OVER (PARTITION BY "partyId" ORDER BY transaction_id DESC) AS ord, --keep all versions with the same last transaction_id
	updated_at
FROM db_namespace."PartyDocumentHistory"
)
SELECT count(*)
FROM db_namespace."PartyDocumentHistory" pdh
	INNER JOIN pdhOrder ON  pdhOrder.id = pdh.id
WHERE pdhOrder.ord > 1 --versionsToKeep
	AND pdh.updated_at < now() - '14 days'::INTERVAL; -- delete party versions that had no changes in the last 14 days

-- USE THE FUNCTION: Delete the oldest 1000 rows, keeping 1 version for each party; the rows updated in the last 14 days are not deleted
SELECT db_namespace.cleanuppartydocumenthistory(1000,1,14);

-- USE MANUAL SCRIPT: Delete the oldest 100000 rows, keeping 1 version for each party; the rows updated in the last 14 days are not deleted
DO $function$
	DECLARE rowCount int;
	DECLARE referenceDate timestamptz;
	DECLARE p_batchSize integer;
	DECLARE p_versionsToKeep integer;
	DECLARE p_noOfDaysFullHistory integer;
BEGIN
    p_batchSize := 100000;
    p_versionsToKeep := 1;
    p_noOfDaysFullHistory := 14;
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
								SELECT Id FROM pdhOrder AS po WHERE po.ord > p_versionsToKeep ORDER BY po.updated_at ASC  LIMIT p_batchSize
						);
			-- get no of rows deleted
			GET DIAGNOSTICS rowCount = ROW_COUNT;
			RAISE NOTICE 'Function cleanuppartydocumenthistory removed % PartyDocumentHistory versions for parties that were not changed in the last % day/s, keeping % version/s', rowCount, p_noOfDaysFullHistory, p_versionsToKeep;
		ELSE
			RAISE NOTICE 'Given p_versionsToKeep parameter is less than 1. If you want to delete all from PartyDocumentHistory use TRUNCATE TABLE';
		END IF;
END;
$function$
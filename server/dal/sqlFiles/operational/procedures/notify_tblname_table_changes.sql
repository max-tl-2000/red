CREATE OR REPLACE FUNCTION db_namespace."${funName}"()
  RETURNS trigger
  LANGUAGE plpgsql
 AS $function$
    DECLARE current_row RECORD;
    DECLARE party_id UUID;
    DECLARE trx_id BIGINT;
    DECLARE begin_time BIGINT;
    DECLARE end_time BIGINT;
    BEGIN
      begin_time := extract(epoch from clock_timestamp()) * 1000;
      IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        current_row := NEW;
      ELSE
        current_row := OLD;
      END IF;
      FOR party_id IN (${partyIdQuery})
      LOOP
      IF party_id IS NOT NULL THEN
        -- the trigger is deffered until the end of transaction so we should generate the updated document only once
        SELECT transaction_id FROM db_namespace."PartyDocumentHistory" pdh
        WHERE pdh."partyId"=party_id
        AND pdh.transaction_id = txid_current()
        ORDER BY pdh.created_at DESC
        LIMIT 1
        INTO trx_id;
        IF trx_id IS NOT NULL THEN
           RAISE WARNING 'SKIPPING PartyDocumentHistory generation, document already generated in TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
           -- TODO: add the skipped event to the list of events for this version
        ELSE
           INSERT INTO db_namespace."PartyDocumentHistory"
           (id, "partyId", "document", transaction_id, triggered_by, status, created_at, updated_at)
           VALUES("public".gen_random_uuid(),
                  party_id,
                  (row_to_json(db_namespace.buildAggregatedPartyDocument(party_id))::jsonb)->'result',
                  txid_current(),
                  json_build_object('table', TG_TABLE_NAME,
                             'type', TG_OP,
                             'entity_id', current_row.id),
                  '${DALTypes.PartyDocumentStatus.PENDING}',
                  now(), now());
        END IF;
      ELSE
       RAISE WARNING 'party_id is not defined, SKIPPING PartyDocumentHistory generation TX=% OP=% TABLE=% ID=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id;
      END IF;
      END LOOP;
      end_time := extract(epoch from clock_timestamp()) * 1000;
      RAISE WARNING 'trigger for PartyDocumentHistory generation took TX=% OP=% TABLE=% ID=% MS=%', txid_current(), TG_OP, TG_TABLE_NAME, current_row.id, (end_time - begin_time);
      RETURN current_row;
    END;
    $function$

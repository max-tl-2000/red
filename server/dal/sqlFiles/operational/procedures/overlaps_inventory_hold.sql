CREATE OR REPLACE FUNCTION db_namespace.overlaps_inventory_hold(inventoryid uuid, reason text, startdate timestamp with time zone, enddate timestamp with time zone, id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $function$
    DECLARE overlap BOOLEAN;
    BEGIN
      IF $3 > $4 OR $3 IS NULL THEN
        overlap := TRUE;
      ELSE
        SELECT 1 INTO overlap
        FROM db_namespace."InventoryOnHold" ih
        WHERE ih."inventoryId" = $1 AND ih.reason = $2 AND tstzrange($3, $4) && tstzrange(ih."startDate", ih."endDate") AND ($5 IS NULL OR $5 <> ih.id);
      END IF;

      RETURN overlap;
    END;
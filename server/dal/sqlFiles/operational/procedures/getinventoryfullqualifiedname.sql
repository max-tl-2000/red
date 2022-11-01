CREATE OR REPLACE FUNCTION db_namespace.getinventoryfullqualifiedname(p_inventoryids varchar(36)[])
RETURNS TABLE (c_inventoryId uuid, c_fullQualifiedName text)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH inventory_ids AS
  (
  SELECT UNNEST(p_inventoryids)::uuid AS "inventoryId"
  )
  SELECT i.id,
      CASE
          WHEN b.name IS NULL THEN (p.name::text || '-'::text) || i.name::text
          ELSE (((p.name::text || '-'::text) || b.name::text) || '-'::text) || i.name::text
      END AS "fullQualifiedName"
  FROM inventory_ids AS ii
    INNER JOIN db_namespace."Inventory" i ON ii."inventoryId" = i.id
    INNER JOIN db_namespace."Property" p ON i."propertyId" = p.id
    LEFT JOIN db_namespace."Building" b ON i."buildingId" = b.id;
	END;
$function$
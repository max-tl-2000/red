CREATE OR REPLACE FUNCTION db_namespace.insertorupdatepartysearchdata(entityid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO db_namespace."PartySearch" (id, "partyId", "partyObject", "searchVector", created_at, updated_at. "phoneSearchVector")
  SELECT "public".gen_random_uuid(), f."partyId", f."partyObject", f."searchVector", now(), now(), f."phoneSearchVector"
  FROM db_namespace.getpartysearchrows(entityid) as f("partyId" uuid, "partyObject" json, "searchVector" tsvector, "phoneSearchVector" tsvector)
  ON CONFLICT ("partyId")
  DO UPDATE SET
    "partyObject" = EXCLUDED."partyObject",
    "searchVector" = EXCLUDED."searchVector",
    "phoneSearchVector" = EXCLUDED."phoneSearchVector",
    "updated_at" = now();
END;
$function$
;

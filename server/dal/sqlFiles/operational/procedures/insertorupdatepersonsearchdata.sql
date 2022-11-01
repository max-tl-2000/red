CREATE OR REPLACE FUNCTION db_namespace.insertorupdatepersonsearchdata(enitityid uuid)
   RETURNS void
 LANGUAGE plpgsql
 AS $function$
  DECLARE curs record;
  BEGIN
    FOR curs in
      SELECT * FROM db_namespace.getpersonsearchrows(enitityId) as f("personId" uuid, "personObject" json, "searchVector" tsvector, "phoneSearchVector" tsvector,"fullName" varchar, "firstName" varchar, "lastName" varchar)

    LOOP
      INSERT INTO db_namespace."PersonSearch" (id, "personId", "personObject", "searchVector", "fullName", "firstName", "lastName", created_at, updated_at, "phoneSearchVector")
      Values ("public".gen_random_uuid(), curs."personId", curs."personObject", curs."searchVector", curs."fullName", curs."firstName", curs."lastName", now(), now(), curs."phoneSearchVector")
      ON CONFLICT ("personId")
      DO UPDATE SET
        "personObject" = curs."personObject",
        "searchVector" = curs."searchVector",
        "fullName" = curs."fullName",
        "firstName" = curs."firstName",
        "lastName" = curs."lastName",
        "updated_at" = now(),
        "phoneSearchVector" = curs."phoneSearchVector"
      WHERE db_namespace."PersonSearch"."personId" = curs."personId";
    END LOOP;
  END;
  $function$

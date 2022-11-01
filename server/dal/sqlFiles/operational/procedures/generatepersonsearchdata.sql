CREATE OR REPLACE FUNCTION db_namespace.generatepersonsearchdata()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
  /*
    Function that when called regenerates all the data from the PersonSearch table.
  */

  DECLARE curs record;
  BEGIN
      DELETE FROM db_namespace."PersonSearch";

      FOR curs in
          -- here we run getpersonsearchrows with NULL as a param which means we'll get back all the records and regenerate all the data in the personSearch table.
          SELECT * FROM db_namespace.getpersonsearchrows(NULL) as f("personId" uuid, "personObject" json, "searchVector" tsvector, "phoneSearchVector" tsvector, "fullName" varchar, "firstName" varchar, "lastName" varchar)
      LOOP

          INSERT INTO db_namespace."PersonSearch" (id, "personId", "personObject", "searchVector", "fullName", "firstName", "lastName", created_at, updated_at, "phoneSearchVector")
          Values ("public".gen_random_uuid(), curs."personId", curs."personObject", curs."searchVector", curs."fullName", curs."firstName", curs."lastName", now(), now(), curs."phoneSearchVector");
      END LOOP;

  END;
$function$

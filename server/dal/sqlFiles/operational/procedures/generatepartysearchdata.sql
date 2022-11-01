 CREATE OR REPLACE FUNCTION db_namespace.generatepartysearchdata()
       RETURNS void
       LANGUAGE plpgsql
      AS $function$
              DECLARE curs record;
              BEGIN
                  DELETE FROM db_namespace."PartySearch";

                  FOR curs in
                      -- here we run getpartysearchrows with NULL as a param which means we'll get back all the records and regenerate all the data in the partySearch table.
                      SELECT * FROM db_namespace.getpartysearchrows(NULL)
                      as f("partyId" uuid, "partyObject" json, "searchVector" tsvector, "phoneSearchVector" tsvector)
                  LOOP
                      INSERT INTO db_namespace."PartySearch" (id, "partyId", "partyObject", "searchVector", created_at, updated_at, "phoneSearchVector")
                      Values ("public".gen_random_uuid(), curs."partyId", curs."partyObject", curs."searchVector", now(), now(), curs."phoneSearchVector")
                      ON CONFLICT ("partyId") DO
                      UPDATE SET ("partyObject", "searchVector", "phoneSearchVector") = (EXCLUDED."partyObject", EXCLUDED."searchVector", EXCLUDED."phoneSearchVector");
                  END LOOP;

              END;
          $function$
      ;
CREATE OR REPLACE FUNCTION db_namespace.insert_user_status_history()
RETURNS trigger
LANGUAGE plpgsql
  AS $function$
    BEGIN
      IF NEW.status <> OLD.status THEN
        INSERT INTO db_namespace."UserStatusHistory"(id, "userId", status, pid)
          VALUES("public".gen_random_uuid(), NEW."userId", NEW.status, pg_backend_pid());
      ELSE
        RETURN NULL;
      END IF;
        RETURN NULL;
    END;
$function$

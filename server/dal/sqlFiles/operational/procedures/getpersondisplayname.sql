CREATE OR REPLACE FUNCTION db_namespace.getpersondisplayname(person_id uuid)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
BEGIN
RETURN (SELECT
          CASE WHEN COALESCE(p."fullName", '') = '' THEN ci.value
            ELSE p."fullName"
          END
        FROM db_namespace."Person" p
        LEFT JOIN db_namespace."ContactInfo" ci ON (ci."personId" = p.id and ci."isPrimary")
        WHERE p.id = person_id
        ORDER BY type DESC
        LIMIT 1);
END;
$function$

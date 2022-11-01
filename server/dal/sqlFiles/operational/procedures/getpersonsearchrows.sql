CREATE OR REPLACE FUNCTION db_namespace.getpersonsearchrows(entityid uuid)
 RETURNS SETOF record
 LANGUAGE sql
AS $function$
/*
  Returns a record or a set of records of the "PersonSearch" table type.
  If the entityid is NULL it means we want to regenerate all the data from the PersonSearch table, otherwise only one record.
*/
SELECT p.id,
json_build_object(
        'id', p.id,
        'fullName', db_namespace.getpersondisplayname(p."id"),
        'preferredName', p."preferredName",
        'memberState', (Select "memberState" FROM db_namespace."PartyMember" where "personId" = p.id LIMIT 1),
        'partyId', (Select "partyId" FROM db_namespace."PartyMember" where "personId" = p.id LIMIT 1),
        'type', 'person',
        'personType', 'Contact',
        'contactInfo',
          json_agg(
            json_build_object(
                          'id', ci.id,
                            'type', ci.type,
                            'value', ci.value,
                            'metadata', ci.metadata,
                            'isPrimary', ci."isPrimary",
                            'personId', ci."personId",
                            'isSpam', ci."isSpam")
          ) filter (where ci.id is not null)
) AS "personObject",
(setweight(to_tsvector('english'::regconfig, COALESCE(p."fullName", '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, COALESCE(p."preferredName", '')), 'A') ||
  setweight(to_tsvector('simple'::regconfig, COALESCE(CASE WHEN ci."type" != 'phone' THEN ci.value
                      ELSE NULL END, ''), '')), 'A')) AS "searchVector",
  setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(
                      CASE WHEN ci."type" = 'phone' THEN concat(ci.value, ' ', substring(ci.value, 2), ' ', substring(ci.value, 5), ' ', right(ci.value, 4))
                      ELSE NULL END, ' '), '')), 'A') AS "phoneSearchVector",
  p."fullName" as "fullName",
  split_part(split_part(p."fullName", ',', 1), ' ', 1) as "firstName",
  CASE
    WHEN (SELECT DISTINCT TRUE FROM regexp_matches(p."fullName", ' ', 'g')) THEN split_part(split_part(p."fullName", ',', 1), ' ', (length(split_part(p."fullName", ',', 1)) - length(replace(split_part(p."fullName", ',', 1),' ',''))::integer + 1))
    ELSE NULL
  END as "lastName"

FROM db_namespace."Person" p
LEFT JOIN db_namespace."ContactInfo" ci ON ci."personId" = p.id
WHERE (entityId IS NULL OR
        ( p.id = entityId OR
          p.id IN (Select "personId" From db_namespace."PartyMember" where "id" = entityId) OR
          p.id IN (Select "personId" FROM db_namespace."ContactInfo" where "id" = entityId)))
AND p."mergedWith" IS NULL
GROUP BY p.id

UNION ALL

SELECT u.id,
json_build_object(
        'id', u.id,
        'fullName', u."fullName",
        'preferredName', u."preferredName",
        'memberState', string_agg(array_to_string(tm."mainRoles", ', '), ' '),
        'personType', 'Employee',
        'type', 'person'
) AS "personObject",
(setweight(to_tsvector('english'::regconfig, u."fullName"), 'A') ||
  setweight(to_tsvector('english'::regconfig, u."preferredName"), 'A') ||
  setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(u.email, ' '), '')), 'A')) AS "searchVector",
  setweight(to_tsvector('simple'::regconfig, COALESCE(string_agg(tm."directPhoneIdentifier", ''), '')), 'A') AS "phoneSearchVector",
  u."fullName" as "fullName",
  split_part(split_part(u."fullName", ',', 1), ' ', 1) as "firstName",
  CASE
    WHEN (SELECT DISTINCT TRUE FROM regexp_matches(u."fullName", ' ', 'g')) THEN split_part(split_part(u."fullName", ',', 1), ' ', (length(split_part(u."fullName", ',', 1)) - length(replace(split_part(u."fullName", ',', 1),' ',''))::integer + 1))
    ELSE NULL
  END as "lastName"

FROM db_namespace."Users" u
LEFT JOIN db_namespace."TeamMembers" tm ON tm."userId" = u."id"
WHERE entityId IS NULL
GROUP BY u.id;
$function$

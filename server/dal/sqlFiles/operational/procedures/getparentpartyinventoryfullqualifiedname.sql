CREATE OR REPLACE FUNCTION db_namespace.getparentpartyinventoryfullqualifiedname (partyid uuid)
      RETURNS TABLE (
          c_partyid uuid,
          c_activeLeaseworkflowid uuid,
          c_fullqualifiedname text)
      LANGUAGE sql
      AS $FUNCTION$
      WITH RECURSIVE parentpartyinventoryqualifiedname (
      id,
      seed_party_id
  ) AS (
      SELECT
          p.id AS "partyId",
          p."seedPartyId",
          ac.id as "ActiveLeaseWorkflowDataId",
(SELECT c_fullqualifiedname from db_namespace.getinventoryfullqualifiedname(
                    (string_to_array(ac."leaseData"->>'inventoryId', ',')))
                    ) as  "fullQualifiedName"
      FROM
      db_namespace."Party" p
          LEFT JOIN db_namespace."Lease" l ON l."partyId" = p.id
          LEFT JOIN db_namespace."ActiveLeaseWorkflowData" ac on ac."partyId" = p.id
      WHERE
          p.id = partyid
      UNION
      SELECT
          party.id,
          party."seedPartyId",
          alwd.id as "ActiveLeaseWorkflowDataId",
         (SELECT c_fullqualifiedname from db_namespace.getinventoryfullqualifiedname(
                    (string_to_array(alwd."leaseData"->>'inventoryId', ',')))
                    ) as  "fullQualifiedName"
      FROM
          db_namespace."Party" party
          LEFT JOIN "ActiveLeaseWorkflowData" alwd on alwd."partyId" = party.id,
          parentpartyinventoryqualifiedname
      WHERE
          parentpartyinventoryqualifiedname.seed_party_id = party.id
  ),
  parentinfo AS (
      SELECT * FROM parentpartyinventoryqualifiedname )
  SELECT id, "ActiveLeaseWorkflowDataId", "fullQualifiedName"
  FROM parentinfo pinfo
  WHERE"ActiveLeaseWorkflowDataId" IS NOT NULL
  LIMIT 1 $FUNCTION$;

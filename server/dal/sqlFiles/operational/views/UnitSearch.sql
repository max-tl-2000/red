DROP MATERIALIZED VIEW IF EXISTS db_namespace."UnitSearch";
CREATE MATERIALIZED VIEW db_namespace."UnitSearch" AS
WITH "withInventoryObj" AS (
  SELECT invobj.id,
  	  invobj.name AS "inventoryName",
	  invobj."buildingDisplayName" as "buildingName",
	  invobj."propertyName",
	  invobj."fullQualifiedName",
	  invobj."layoutDisplayName" AS "layoutName",
    jsonb_build_object('id', invobj.id, 'name', invobj.name, 'description', invobj.description, 'floor', invobj.floor, 'type', invobj.type, 'unitType', invobj."unitType", 'address', invobj.address, 'id', invobj.id, 'amenities', invobj.amenities, 'updated_at', invobj.updated_at, 'buildingShorthand', invobj."buildingName", 'buildingName', invobj."buildingDisplayName", 'layoutName', invobj."layoutName", 'layoutDisplayName', invobj."layoutDisplayName", 'layoutNoBathrooms', invobj."layoutNoBathrooms", 'layoutNoBedrooms', invobj."layoutNoBedrooms", 'layoutSurfaceArea', invobj."layoutSurfaceArea", 'floorCount', invobj."floorCount", 'buildingDescription', invobj."buildingDescription", 'propertyId', invobj."propertyId", 'propertyName', invobj."propertyName", 'propertyDisplayName', invobj."propertyDisplayName", 'propertyDescription', invobj."propertyDescription", 'propertyLegalName', invobj."propertyLegalName", 'fullQualifiedName', invobj."fullQualifiedName") AS inventory_object
    FROM ( SELECT i.id,
            i.name,
            i.description,
            i.floor,
            i.type,
            i.type AS "unitType",
            ( SELECT btrim(("Address"."addressLine1"::text || ' '::text) || "Address"."addressLine2"::text) AS btrim
                    FROM db_namespace."Address"
                  WHERE "Address".id =
                        CASE
                            WHEN i."buildingId" IS NULL THEN p."addressId"
                            ELSE b."addressId"
                        END) AS address,
            ly.name AS "layoutName",
            ly."displayName" AS "layoutDisplayName",
            ly."numBathrooms" AS "layoutNoBathrooms",
            ly."numBedrooms" AS "layoutNoBedrooms",
            ly."surfaceArea" AS "layoutSurfaceArea",
            b.name AS "buildingName",
            b."displayName" AS "buildingDisplayName",
            b."floorCount",
            b.description AS "buildingDescription",
            p.id AS "propertyId",
            p.name AS "propertyName",
            p."displayName" AS "propertyDisplayName",
            p.description AS "propertyDescription",
            p."propertyLegalName",
            array_to_json(COALESCE(array(SELECT DISTINCT UNNEST(iam_agg_name || bam_agg_name)), '{}'::character varying[]))::jsonb AS amenities,
            i.updated_at,
            CASE
              WHEN b.name IS NULL THEN (p.name::text || '-'::text) || i.name::text
              ELSE (((p.name::text || '-'::text) || b.name::text) || '-'::text) || i.name::text
            END AS "fullQualifiedName"
            FROM db_namespace."Inventory" i
              JOIN db_namespace."Property" p ON p.id = i."propertyId"
              LEFT JOIN db_namespace."Building" b ON b.id = i."buildingId"
              LEFT JOIN db_namespace."Layout" ly ON ly.id = i."layoutId"
              LEFT JOIN
                (
                SELECT ia."inventoryId", array_agg(a.name) AS iam_agg_name
                FROM db_namespace."Inventory_Amenity" ia
                  JOIN db_namespace."Amenity" a ON ia."amenityId" = a.id
                WHERE a."endDate" IS NULL
                AND ia."endDate" IS NULL
                GROUP BY ia."inventoryId"
                ) iam ON i.id = iam."inventoryId"
              LEFT JOIN
                (
                SELECT ba."buildingId", array_agg(a.name) AS bam_agg_name
                FROM db_namespace."Building_Amenity" ba
                  JOIN db_namespace."Amenity" a ON ba."amenityId" = a.id
                WHERE a."endDate" IS NULL
                GROUP BY ba."buildingId"
                ) bam ON i."buildingId" = bam."buildingId"
          ) invobj
)
SELECT inv.id,
  inv.inventory_object,
  inv."inventoryName",
  inv."buildingName",
  inv."propertyName",
  inv."fullQualifiedName",
  inv."layoutName",
  ((setweight(to_tsvector('simple'::regconfig, COALESCE(inv."inventoryName", ''::character varying)::text), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(inv."layoutName", ''::character varying)::text), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(inv."buildingName", ''::character varying)::text), 'C'::"char")) || setweight(to_tsvector('simple'::regconfig, COALESCE(inv."fullQualifiedName", ''::character varying::text)), 'A'::"char") ||
  setweight(to_tsvector('english'::regconfig, CONCAT(inv."propertyName", inv."buildingName", inv."inventoryName") :: character varying::text), 'C'::"char") ||
  setweight(to_tsvector('english'::regconfig, CONCAT(inv."buildingName", inv."inventoryName") :: character varying::text), 'C'::"char") AS "globalSearchVector"
  FROM "withInventoryObj" inv;

-- View indexes:
CREATE UNIQUE INDEX IF NOT EXISTS "UnitSearch_id_idx" ON db_namespace."UnitSearch" USING btree (id);

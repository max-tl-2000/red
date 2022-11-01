/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { knex, initQuery, insertOrUpdate, getOne, bulkUpsert } from '../database/factory';
import loggerModule from '../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'buildingRepo' });

export const saveBuilding = async (ctx, building) => {
  try {
    return await insertOrUpdate(ctx.tenantId, 'Building', building);
  } catch (error) {
    logger.error(error);
    return null;
  }
};

export const saveBuildings = async (ctx, buildings) => await bulkUpsert(ctx, 'Building', buildings);

export const getBuildingAmenities = async (ctx, buildingId) =>
  await initQuery(ctx)
    .from('Amenity')
    .whereIn('id', function whereInCb() {
      this.select('amenityId').withSchema(ctx.tenantId).from('Building_Amenity').where({ buildingId });
    })
    .andWhere('endDate', null);

export const getBuildings = async ctx => await initQuery(ctx).from('Building');

const getBuildingColumnQuery = column => `"Building"."${column}"::text ilike ?`;

export const getBuildingByNameAndPropertyName = async (ctx, buildingName, propertyName) =>
  await initQuery(ctx)
    .from('Building')
    .join('Property', 'Building.propertyId', '=', 'Property.id')
    .select('Building.*')
    .whereRaw(getBuildingColumnQuery('name'), buildingName || '')
    .andWhere('Property.name', propertyName)
    .first();

export const getBuildingsByPropertyId = async (ctx, propertyId) => await initQuery(ctx).from('Building').where('propertyId', propertyId);

export const getBuildingsByPropertyName = async (ctx, propertyName) =>
  await initQuery(ctx).from('Building').join('Property', 'Building.propertyId', '=', 'Property.id').select('Building.*').where('Property.name', propertyName);

export const getBuildingById = (ctx, id) => {
  // TODO this should be optional
  const fksToExpand = {
    addressId: {
      rel: 'Address',
      repr: 'address',
    },
  };
  return getOne(ctx, 'Building', id, fksToExpand);
};

export const getBuildingsByIdsWhereIn = async (ctx, buildingIds) => await initQuery(ctx).select('name').from('Building').whereIn('id', buildingIds);

export const getBuildingsToExport = async (ctx, simpleFields, propertyIdsToExport) => {
  const { tenantId } = ctx;

  const simpleFieldsToSelect = simpleFields.map(field => `Building.${field}`);
  const foreignKeysToSelect = [
    'Property.name as property',
    'Address.addressLine1 as addressLine1',
    'Address.addressLine2 as addressLine2',
    'Address.city as city',
    'Address.state as state',
    'Address.postalCode as postalCode',
  ];

  const allFieldsToSelect = simpleFieldsToSelect.concat(foreignKeysToSelect);

  return await initQuery(ctx)
    .select(allFieldsToSelect)
    .select(
      knex.raw(
        `ARRAY(select "Amenity"."name"
        from :tenantId:."Building_Amenity"
        left join :tenantId:."Amenity" on "Building_Amenity"."amenityId" = "Amenity".id
        where "Building_Amenity"."buildingId" = "Building".id) as amenities`,
        {
          tenantId,
        },
      ),
    )
    .from('Building')
    .innerJoin('Property', 'Building.propertyId', 'Property.id')
    .innerJoin('Address', 'Building.addressId', 'Address.id')
    .whereIn('Property.id', propertyIdsToExport);
};

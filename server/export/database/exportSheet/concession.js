/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getConcessionsToExport } from '../../../dal/concessionRepo';
import { getLayoutsByIdWhereIn } from '../../../dal/layoutRepo';
import { getAmenitiesByIdsWhereIn } from '../../../dal/amenityRepo';
import { getLeasesByIdsWhereIn } from '../../../dal/leaseTermRepo';
import { getBuildingsByIdsWhereIn } from '../../../dal/buildingRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';

const DB_MAPPERS = [
  {
    columnHeader: 'variableAdjustmentFlag',
    dbField: 'variableAdjustment',
  },
  {
    columnHeader: 'optionalFlag',
    dbField: 'optional',
  },
  {
    columnHeader: 'hideInSelfServiceFlag',
    dbField: 'hideInSelfService',
  },
  {
    columnHeader: 'recurringFlag',
    dbField: 'recurring',
  },
  {
    columnHeader: 'taxableFlag',
    dbField: 'taxable',
  },
];

const MATCHING_CRITERIA = ['leaseNames', 'minLeaseLength', 'maxLeaseLength', 'layouts', 'buildings', 'amenities'];

const removeFieldsInMatchingCriteria = dbSimpleFields => dbSimpleFields.filter(field => !MATCHING_CRITERIA.includes(field));

const getLayoutNamesByLayoutIds = async (ctx, layoutIds) => {
  if (!layoutIds) return null;
  const layouts = await getLayoutsByIdWhereIn(ctx, layoutIds);
  return layouts.map(layout => layout.name);
};

const getAmenityNamesByAmenityIds = async (ctx, amenityIds) => {
  if (!amenityIds) return null;
  const amenities = await getAmenitiesByIdsWhereIn(ctx, amenityIds);
  return amenities.map(amenity => amenity.name);
};

const getLeaseNamesByLeaseIds = async (ctx, leaseIds) => {
  if (!leaseIds) return null;
  const leases = await getLeasesByIdsWhereIn(ctx, leaseIds);
  return leases.map(lease => lease.name);
};

const getBuildingNamesByBuildingIds = async (ctx, buildingIds) => {
  if (!buildingIds) return null;
  const buildings = await getBuildingsByIdsWhereIn(ctx, buildingIds);
  return buildings.map(building => building.name);
};

const getMatchingCriteriaData = async (ctx, concessions) =>
  await execConcurrent(concessions, async concession => {
    if (!concession.matchingCriteria) return concession;

    const matchingCriteria = JSON.parse(concession.matchingCriteria);

    const { minLeaseLength, maxLeaseLength } = matchingCriteria;
    const { leaseNames: leaseIds, layouts: layoutIds, buildings: buildingIds, amenities: amenityIds } = matchingCriteria;

    const leaseNames = await getLeaseNamesByLeaseIds(ctx, leaseIds);
    const layouts = await getLayoutNamesByLayoutIds(ctx, layoutIds);
    const amenities = await getAmenityNamesByAmenityIds(ctx, amenityIds);
    const buildings = await getBuildingNamesByBuildingIds(ctx, buildingIds);

    return {
      ...concession,
      minLeaseLength,
      maxLeaseLength,
      layouts,
      amenities,
      leaseNames,
      buildings,
    };
  });

export const exportConcessions = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Concession;
  const columnHeaders = getColumnHeaders(spreadsheet.Concession.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);
  const dbSimpleFieldsWithoutFieldsInMatchingCriteria = removeFieldsInMatchingCriteria(dbSimpleFields);

  const concessions = await getConcessionsToExport(ctx, dbSimpleFieldsWithoutFieldsInMatchingCriteria, propertyIdsToExport);
  const concessionWithMatchingCriteria = await getMatchingCriteriaData(ctx, concessions);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(concessionWithMatchingCriteria, columnHeadersOrderedMapped);
};

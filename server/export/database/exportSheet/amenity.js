/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getAmenitiesToExport } from '../../../dal/amenityRepo';
import { buildDataPumpFormat, getSimpleFieldsColumns, getColumnHeadersMappedWithDB } from '../../helpers/export';
import { spreadsheet, getColumnHeaders, cellTypes } from '../../../../common/helpers/spreadsheet';

const amenitiesColunms = spreadsheet.Amenity.columns;

/* use DB_MAPPER just if the columnHeader from workbooksheet is different to the field in the DB */
const DB_MAPPERS = [
  {
    columnHeader: 'highValueFlag',
    dbField: 'highValue',
  },
  {
    columnHeader: 'targetUnitFlag',
    dbField: 'targetUnit',
  },
  {
    columnHeader: 'hiddenFlag',
    dbField: 'hidden',
  },
];

const parseBooleanData = amenities => {
  const booleanColumns = amenitiesColunms
    .filter(column => column.type === cellTypes.BOOLEAN)
    .map(({ header }) => {
      const mapperFound = DB_MAPPERS.find(mapper => mapper.columnHeader === header);
      return mapperFound ? mapperFound.dbField : header;
    });
  return amenities.map(amenity => {
    booleanColumns.forEach(column => {
      amenity[column] = amenity[column] ? 'x' : '';
    });
    return amenity;
  });
};

const parseData = amenities => parseBooleanData(amenities);

export const exportAmenities = async (
  ctx,
  { propertyIdsToExport, columnHeaders: columnHeadersOrdered },
  opts = { includeId: false, includeInventoryOnly: false },
) => {
  const { foreignKeys } = spreadsheet.Amenity;
  const columnHeaders = opts.includeId ? ['id', ...getColumnHeaders(spreadsheet.Amenity.columns)] : getColumnHeaders(spreadsheet.Amenity.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const amenities = await getAmenitiesToExport(ctx, dbSimpleFields, propertyIdsToExport, opts.includeInventoryOnly);

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(parseData(amenities), columnHeadersOrderedMapped);
};

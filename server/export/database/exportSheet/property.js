/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPropertiesToExport } from '../../../dal/propertyRepo';
import { buildDataPumpFormat, getColumnHeadersMappedWithDB, getSimpleFieldsColumns } from '../../helpers/export';
import { spreadsheet, getColumnHeaders } from '../../../../common/helpers/spreadsheet';

/* use DB_MAPPER just if the columnHeader from workbooksheet is different to the field in the DB */
const DB_MAPPERS = [
  {
    columnHeader: 'timeZone',
    dbField: 'timezone',
  },
  {
    columnHeader: 'inactiveFlag',
    dbField: 'inactive',
  },
];

const convertPropertiesToString = properties =>
  properties.map(property => ({
    ...property,
    geoLocation: JSON.stringify(property.geoLocation),
  }));

export const exportProperties = async (ctx, { propertyIdsToExport, columnHeaders: columnHeadersOrdered }) => {
  const { foreignKeys } = spreadsheet.Property;
  const columnHeaders = getColumnHeaders(spreadsheet.Property.columns);
  const columnHeadersMapped = getColumnHeadersMappedWithDB(columnHeaders, DB_MAPPERS);
  const dbSimpleFields = getSimpleFieldsColumns(columnHeadersMapped, foreignKeys);

  const properties = convertPropertiesToString(await getPropertiesToExport(ctx, dbSimpleFields, propertyIdsToExport));

  const columnHeadersOrderedMapped = getColumnHeadersMappedWithDB(columnHeadersOrdered, DB_MAPPERS);
  return buildDataPumpFormat(properties, columnHeadersOrderedMapped);
};

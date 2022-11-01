/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import _ from 'lodash'; // eslint-disable-line red/no-lodash
import { propertiesMapper, EXCEL_HEADERS as propertiesExcelHeaders, CSV_HEADERS as propertiesCsvHeaders } from './mappers/propertiesMapper';
import { buildingsMapper, EXCEL_HEADERS as buildingsExcelHeaders, CSV_HEADERS as buildingsCsvHeaders } from './mappers/buildingsMapper';
import { amenityMapper, EXCEL_HEADERS as amenityExcelHeaders, CSV_HEADERS as amenityCsvHeaders } from './mappers/amenityMapper';
import { employeeMapper, EXCEL_HEADERS as employeeExcelHeaders, CSV_HEADERS as employeeCsvHeaders } from './mappers/employeeMapper';
import { inventoryGroupMapper, EXCEL_HEADERS as inventoryGroupExcelHeaders, CSV_HEADERS as inventoryGroupCsvHeaders } from './mappers/inventoryGroupMapper';
import { layoutMapper, EXCEL_HEADERS as layoutExcelHeaders, CSV_HEADERS as layoutCsvHeaders } from './mappers/layoutMapper';
import {
  inventoryGroupNonUnitMapper,
  EXCEL_HEADERS as inventoryGroupNonExcelHeaders,
  CSV_HEADERS as inventoryGroupNonCsvHeaders,
} from './mappers/inventoryGroupNonUnitMapper';
import {
  inventoryCommonUnitMapper,
  EXCEL_HEADERS as inventoryCommonUnitExcelHeaders,
  CSV_HEADERS as inventoryCommonUnitCsvHeaders,
} from './mappers/inventoryCommonUnitMapper';
import {
  inventoryUnitAmenitiesMapper,
  EXCEL_HEADERS as inventoryUnitAmenitiesExcelHeaders,
  CSV_HEADERS as inventoryUnitAmenitiesCsvHeaders,
} from './mappers/inventoryUnitAmenitiesMapper';
import {
  inventoryRentableItemsMapper,
  EXCEL_HEADERS as inventoryRentableItemsExcelHeaders,
  CSV_HEADERS as inventoryRentableItemsCsvHeaders,
} from './mappers/inventoryRentableItemsMapper';

const csvConverters = [
  {
    key: 'CommProperties',
    sheetName: 'Properties',
    converter: propertiesMapper,
    fields: propertiesExcelHeaders,
    csvHeaders: propertiesCsvHeaders,
  },
  {
    key: 'CommBuildings',
    sheetName: 'Buildings',
    converter: buildingsMapper,
    fields: buildingsExcelHeaders,
    csvHeaders: buildingsCsvHeaders,
  },
  {
    key: 'ResPropertyAmenities',
    sheetName: 'Amenities',
    converter: amenityMapper,
    fields: amenityExcelHeaders,
    csvHeaders: amenityCsvHeaders,
  },
  {
    key: 'ResAgentNames',
    sheetName: 'Employees',
    converter: employeeMapper,
    fields: employeeExcelHeaders,
    csvHeaders: employeeCsvHeaders,
  },
  {
    key: 'ResUnitTypes',
    mappersArr: [
      {
        sheetName: 'Inventory Groups',
        converter: inventoryGroupMapper,
        fields: inventoryGroupExcelHeaders,
        csvHeaders: inventoryGroupCsvHeaders,
      },
      {
        sheetName: 'Layouts',
        converter: layoutMapper,
        fields: layoutExcelHeaders,
        csvHeaders: layoutCsvHeaders,
      },
    ],
  },
  {
    key: 'ResRentableItemsTypes',
    sheetName: 'Inventory Groups',
    converter: inventoryGroupNonUnitMapper,
    fields: inventoryGroupNonExcelHeaders,
    csvHeaders: inventoryGroupNonCsvHeaders,
  },
  {
    key: 'CommUnits',
    sheetName: 'Inventory',
    converter: inventoryCommonUnitMapper,
    fields: inventoryCommonUnitExcelHeaders,
    csvHeaders: inventoryCommonUnitCsvHeaders,
    childMapper: {
      key: 'ResUnitAmenities',
      parentMatchColumnIndex: 0,
      parentDestinyColumnIndex: 11,
      childValueColumnIndex: 1,
      converter: inventoryUnitAmenitiesMapper,
      fields: inventoryUnitAmenitiesExcelHeaders,
      csvHeaders: inventoryUnitAmenitiesCsvHeaders,
    },
  },
  {
    key: 'ResRentableItems',
    sheetName: 'Inventory',
    converter: inventoryRentableItemsMapper,
    fields: inventoryRentableItemsExcelHeaders,
    csvHeaders: inventoryRentableItemsCsvHeaders,
  },
];

const getConverter = name => {
  const converterName = _.split(_.trim(name), '_', 1);
  return csvConverters.find(cnv => converterName[0].toLocaleLowerCase().indexOf(cnv.key.toLocaleLowerCase()) > -1);
};

export const mappingConverters = settings => {
  if (!(settings && settings.length)) return [];
  const converters = [];
  settings.forEach(file => {
    const converter = getConverter(file.originalName);
    if (converter) {
      // If there are several converters for the smae file
      if (converter.mappersArr && converter.mappersArr.length) {
        // Add the key to the converters of mappersArr
        const arr = converter.mappersArr.map(cnv => ({
          key: converter.key,
          ...cnv,
        }));
        arr.forEach(conv => {
          conv.filePath = file.filePath;
          converters.push(conv);
        });
      } else {
        const existsConverter = converters.some(cnv => cnv.key === converter.key);
        if (!existsConverter) {
          if (converter.childMapper) {
            const fileKey = converter.childMapper.key;
            const childFile = settings.find(fileSetting => fileSetting.originalName.includes(fileKey));
            if (childFile) {
              converter.childMapper.filePath = childFile.filePath;
            }
          }
          converter.filePath = file.filePath;
          converters.push(converter);
        }
      }
    }
  });
  return converters;
};

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import split from 'lodash/split';
import sortBy from 'lodash/sortBy';

import { ImportMappersEntityTypes } from '../../../common/enums/enums';
import { DALTypes } from '../../../common/enums/DALTypes';
import { removeTimestampPrefixFromFileName } from '../../helpers/importUtils';
import {
  unitStatusCsvMapper,
  preComputeRequiredData as preComputeUnitStatusCsvRequiredData,
  CSV_HEADERS as unitStatusCsvHeaders,
  NEW_CSV_HEADERS as unitStatusResultHeaders,
  REQUIRED_HEADERS as unitStatusRequiredHeaders,
} from './mappers/unitStatusCsvMapper';
import {
  manageRentableItemsCsvMapper,
  preComputeRequiredData as preComputeManageRentableItemsCsvRequiredData,
  CSV_HEADERS as manageRentableItemsCsvHeaders,
  NEW_CSV_HEADERS as manageRentableItemsResultHeaders,
  REQUIRED_HEADERS as manageRentableItemsRequiredHeaders,
} from './mappers/manageRentableItemsCsvMapper';
import {
  unitAmenitiesCsvMapper,
  CSV_HEADERS as unitAmenitiesCsvHeaders,
  NEW_CSV_HEADERS as unitAmenitiesResultHeaders,
  REQUIRED_HEADERS as unitAmenitiesRequiredHeaders,
} from './mappers/unitAmenitiesCsvMapper';
import {
  prospectsCsvMapper,
  CSV_HEADERS as prospectsCsvHeaders,
  NEW_CSV_HEADERS as prospectsResultHeaders,
  REQUIRED_HEADERS as prospectsResultRequiredHeaders,
} from './mappers/prospectsCsvMapper';
import {
  mriProspectsCsvMapper,
  CSV_HEADERS as mriProspectsCsvHeaders,
  NEW_CSV_HEADERS as mriProspectsResultHeaders,
  REQUIRED_HEADERS as mriProspectsResultRequiredHeaders,
} from './mri_mappers/mriProspectsCsvMapper';
import {
  historicalCommunicationCsvMapper,
  CSV_HEADERS as historicalCommunicationCsvHeaders,
  NEW_CSV_HEADERS as historicalCommunicationResultHeaders,
  REQUIRED_HEADERS as historicalCommunicationResultRequiredHeaders,
} from './mappers/historicalCommunicationCsvMapper';
import {
  mriUnitStatusCsvMapper,
  CSV_HEADERS as mriUnitStatusCsvHeaders,
  NEW_CSV_HEADERS as mriUnitStatusResultHeaders,
  REQUIRED_HEADERS as mriUnitStatusResultRequiredHeaders,
} from './mri_mappers/mriUnitStatusCsvMapper';
import {
  mriUnitAmenitiesCsvMapper,
  CSV_HEADERS as mriUnitAmenitiesCsvHeaders,
  NEW_CSV_HEADERS as mriUnitAmenitiesResultHeaders,
  REQUIRED_HEADERS as mriUnitAmenitiesResultRequiredHeaders,
} from './mri_mappers/mriUnitAmenitiesCsvMapper';
import { CSV_HEADERS as mriPropertiesCsvHeaders, REQUIRED_HEADERS as mriPropertiesResultRequiredHeaders } from './mri_mappers/mriPropertiesCsvMapper';
import {
  mriRentableItemsCsvMapper,
  CSV_HEADERS as mriRentableItemsCsvHeaders,
  NEW_CSV_HEADERS as mriRentableItemsResultHeaders,
  REQUIRED_HEADERS as mriRentableItemsResultRequiredHeaders,
} from './mri_mappers/mriRentableItemsCsvMapper';

// CPM-6491 Comment out import of resident files from ftp inbound
import {
  roommatesCsvMapper,
  CSV_HEADERS as roommastesCsvHeaders,
  NEW_CSV_HEADERS as roommastesResultHeaders,
  REQUIRED_HEADERS as rommatesRequiredHeaders,
} from './mappers/roommatesCsvMapper';
import {
  tenantsCsvMapper,
  preComputeRequiredData as preComputeTenantsCsvRequiredData,
  CSV_HEADERS as tenantsCsvHeaders,
  NEW_CSV_HEADERS as tenantsResultHeaders,
  REQUIRED_HEADERS as tenantsRequiredHeaders,
} from './mappers/tenantsCsvMappers';
import {
  commUnitCsvMapper,
  preComputeRequiredData as preComputeCommUnitsCsvRequiredData,
  CSV_HEADERS as commUnitsCsvHeaders,
  NEW_CSV_HEADERS as commUnitsResultHeaders,
  REQUIRED_HEADERS as commUnitsRequiredHeaders,
} from './mappers/commUnitsCsvMapper';

const csvConverters = [
  {
    key: 'ResUnitStatus',
    csvHeaders: unitStatusCsvHeaders,
    mapper: unitStatusCsvMapper,
    resultPrefix: ImportMappersEntityTypes.UnitStatusMapper,
    resultHeaders: unitStatusResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: unitStatusRequiredHeaders,
    preComputedData: preComputeUnitStatusCsvRequiredData,
  },
  {
    key: 'ResManageRentableItems',
    csvHeaders: manageRentableItemsCsvHeaders,
    mapper: manageRentableItemsCsvMapper,
    resultPrefix: ImportMappersEntityTypes.RentableItemsMapper,
    resultHeaders: manageRentableItemsResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: manageRentableItemsRequiredHeaders,
    preComputedData: preComputeManageRentableItemsCsvRequiredData,
  },
  {
    key: 'ResUnitAmenities',
    csvHeaders: unitAmenitiesCsvHeaders,
    mapper: unitAmenitiesCsvMapper,
    resultPrefix: ImportMappersEntityTypes.UnitAmenitiesMapper,
    resultHeaders: unitAmenitiesResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: unitAmenitiesRequiredHeaders,
  },
  {
    key: 'ManualResProspects',
    csvHeaders: prospectsCsvHeaders,
    mapper: prospectsCsvMapper,
    resultPrefix: ImportMappersEntityTypes.ProspectsMapper,
    resultHeaders: prospectsResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: prospectsResultRequiredHeaders,
  },
  {
    key: 'MriManualResProspects',
    csvHeaders: mriProspectsCsvHeaders,
    mapper: mriProspectsCsvMapper,
    resultPrefix: ImportMappersEntityTypes.ProspectsMapper,
    resultHeaders: mriProspectsResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.MRI,
    requiredHeaders: mriProspectsResultRequiredHeaders,
  },
  {
    key: 'Comms',
    csvHeaders: historicalCommunicationCsvHeaders,
    mapper: historicalCommunicationCsvMapper,
    resultPrefix: ImportMappersEntityTypes.HistoricalCommunicationMapper,
    resultHeaders: historicalCommunicationResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: historicalCommunicationResultRequiredHeaders,
  },
  {
    key: 'MriUnits',
    csvHeaders: mriUnitStatusCsvHeaders,
    mapper: mriUnitStatusCsvMapper,
    resultPrefix: ImportMappersEntityTypes.MriUnitMapper,
    resultHeaders: mriUnitStatusResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.MRI,
    requiredHeaders: mriUnitStatusResultRequiredHeaders,
  },
  {
    key: 'MriUnitAmenities',
    csvHeaders: mriUnitAmenitiesCsvHeaders,
    mapper: mriUnitAmenitiesCsvMapper,
    resultPrefix: ImportMappersEntityTypes.MriUnitAmenitiesMapper,
    resultHeaders: mriUnitAmenitiesResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.MRI,
    requiredHeaders: mriUnitAmenitiesResultRequiredHeaders,
  },
  {
    key: 'MriProperties',
    csvHeaders: mriPropertiesCsvHeaders,
    resultPrefix: ImportMappersEntityTypes.MriProperties,
    resultHeaders: mriPropertiesCsvHeaders,
    thirdPartySystem: DALTypes.BackendMode.MRI,
    requiredHeaders: mriPropertiesResultRequiredHeaders,
  },
  {
    key: 'MRIRentableItems',
    csvHeaders: mriRentableItemsCsvHeaders,
    mapper: mriRentableItemsCsvMapper,
    resultPrefix: ImportMappersEntityTypes.MriRentableItems,
    resultHeaders: mriRentableItemsResultHeaders,
    requiredHeaders: mriRentableItemsResultRequiredHeaders,
  },
  {
    key: 'ResRoommates',
    csvHeaders: roommastesCsvHeaders,
    mapper: roommatesCsvMapper,
    resultPrefix: ImportMappersEntityTypes.PartyMembersMapper,
    resultHeaders: roommastesResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: rommatesRequiredHeaders,
  },
  {
    key: 'ResTenants',
    csvHeaders: tenantsCsvHeaders,
    mapper: tenantsCsvMapper,
    resultPrefix: ImportMappersEntityTypes.PartiesMapper,
    resultHeaders: tenantsResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: tenantsRequiredHeaders,
    preComputedData: preComputeTenantsCsvRequiredData,
  },
  {
    key: 'CommUnits',
    csvHeaders: commUnitsCsvHeaders,
    mapper: commUnitCsvMapper,
    resultPrefix: ImportMappersEntityTypes.CommUnitsMapper,
    resultHeaders: commUnitsResultHeaders,
    thirdPartySystem: DALTypes.BackendMode.YARDI,
    requiredHeaders: commUnitsRequiredHeaders,
    preComputedData: preComputeCommUnitsCsvRequiredData,
  },
];

const csvResultPrefixes = csvConverters.reduce((acc, item) => {
  if (!acc.includes(item.resultPrefix)) {
    acc.push(item.resultPrefix);
  }
  return acc;
}, []);

const isValidConverter = (converterName, value) => {
  const filterExpression = new RegExp(`^${converterName}$`, 'i');
  return filterExpression.test(value);
};

/**
 * Receives the name of a file like ResUnitStatus_10611.csv and matches a csv converter
 * using the base file name ResUnitStatus as a key to match a csv converter to the file
 *
 * @param {String} fileName the fileName to match a csv converter
 * @returns {Object} a csv converter
 */
const getConverterByFileName = fileName => {
  const converterPrefixNameExtracted = split(fileName, /(-|_|\.)/i, 1);
  if (!converterPrefixNameExtracted) return null;
  return csvConverters.find(cnv => isValidConverter(cnv.key, converterPrefixNameExtracted));
};

/**
 * Maps a csv converter given a list of uploaded files
 *
 * @param {Array} files list of file object to match file handlers
 *  checksum: file checksum
 *  destination: upload file path
 *  encoding: file encoding
 *  filename: uploaded file name is uuid without dashes
 *  filePath: uploaded file path
 *  mimetype: file mime type
 *  originalName: the original file name as it was uploaded
 *  path: same as filePath?
 *  size: file size in bytes
 * @returns {Array} list of csv file mappers enhanced with filePath, originalName, and resultPrefix
 */
const mappingFileHandlers = files => {
  if (!(files && files.length)) return [];

  // if the original file is named 1607515829288-ResUnitStatus_10611.csv then this returns the same files array
  // with a new property called nameWithoutPrefix containing ResUnitStatus_10611.csv
  const sortedFilesWithoutPrefix = sortBy(files.map(f => ({ ...f, nameWithoutPrefix: removeTimestampPrefixFromFileName(f.originalName) })).sort(), [
    'nameWithoutPrefix',
  ]);

  const mappers = sortedFilesWithoutPrefix.reduce((seq, file) => {
    const { nameWithoutPrefix, filePath, originalName } = file;
    const converter = getConverterByFileName(nameWithoutPrefix);

    if (converter) {
      const sameTypeConverters = seq.filter(cnv => isValidConverter(converter.key, cnv.key));
      // if multiple update files of the same type are uploaded add a suffix (ie. inventory-n) to the csv converter resultPrefix
      const resultPrefix = sameTypeConverters.length ? `${converter.resultPrefix}-${sameTypeConverters.length + 1}` : converter.resultPrefix;
      const mapper = { ...converter, filePath, originalName, resultPrefix };
      seq.push(mapper);
    }
    return seq;
  }, []);

  return mappers;
};

export { mappingFileHandlers, csvResultPrefixes };

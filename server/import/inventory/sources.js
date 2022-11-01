/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import differenceBy from 'lodash/differenceBy';
import isEqual from 'lodash/isEqual';
import { filter as promiseFilter } from 'bluebird';
import { getMasterSourceList, saveSource, getSources } from '../../dal/sourcesRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

export const NAME = 'name';
export const TYPE = 'type';
export const INVALID_SOURCE_NAME = 'INVALID_SOURCE_NAME';
export const INVALID_SOURCE_TYPE = 'INVALID_SOURCE_TYPE';
export const MASTER_LIST = 'master list';
export const MISSING_SOURCE = 'MISSING_SOURCE';

const sourceRequiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'description',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'type',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const masterListValidation = (sources, masterSources) => {
  const errors = [];

  const missingSources = differenceBy(masterSources, sources, 'name');

  if (missingSources.length) {
    missingSources.map(source =>
      errors.push({
        name: MASTER_LIST,
        message: `${MISSING_SOURCE} - "${source.name}" with type "${source.type}" from master list is not part of the imported list`,
      }),
    );
  }

  return errors;
};

const customSourcesValidation = async (source, masterSources) => {
  const validation = [];

  const matchingMasterSource = masterSources.find(s => s.name === source.name);

  if (matchingMasterSource) {
    const matchingType = matchingMasterSource.type === source.type;

    if (!matchingType) {
      validation.push({
        name: TYPE,
        message: `${INVALID_SOURCE_TYPE} - Type for "${source.name}" should be "${matchingMasterSource.type}"`,
      });
    }
  } else {
    validation.push({
      name: NAME,
      message: `${INVALID_SOURCE_NAME} - "${source.name}" does not match a source in the master list`,
    });
  }

  return validation;
};

const isExistingSource = (sourceData, dbSourceData = {}) => Object.keys(sourceData).every(key => isEqual(sourceData[key], dbSourceData[key]));

const getRowsToBeSaved = async ({ sources, dbSources }) =>
  await promiseFilter(sources, async row => {
    const sourceData = row.data;
    const dbSource = dbSources.find(s => s.name === sourceData.name);

    return !isExistingSource(sourceData, dbSource);
  });

export const importSources = async (ctx, sources) => {
  const masterSources = await getMasterSourceList();
  const sourcesData = sources.map(s => s.data);
  const dbSources = await getSources(ctx);

  const rowsToBeSaved = dbSources.length ? await getRowsToBeSaved({ sources, dbSources }) : sources;

  const invalidFields = await validate(
    rowsToBeSaved,
    {
      requiredFields: sourceRequiredFields,
      async onValidEntity(source) {
        return await saveSource(ctx, source);
      },
      customCheck(source) {
        return customSourcesValidation(source, masterSources);
      },
      customSpreadsheetCheck() {
        return masterListValidation(sourcesData, masterSources);
      },
    },
    ctx,
    spreadsheet.Source.columns,
  );

  return {
    invalidFields,
  };
};

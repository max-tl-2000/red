/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { existSheetByName } from '../../helpers/importUtils';
import { ServiceError } from '../../common/errors';
import * as service from '../../services/sheets';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'sheetAPI' });

const validateSheetName = sheetName => {
  if (!existSheetByName(sheetName)) {
    throw new ServiceError({
      token: 'SHEET_NAME_NOT_FOUND',
      status: 404,
    });
  }
};

export const getSheetData = async req => {
  const { sheetName } = req.params;
  logger.trace({ ctx: req, sheetName }, 'get sheet info for google spreadsheet');

  validateSheetName(sheetName);

  return await service.getSheetData(req, sheetName);
};

export const updateDBFromSheets = async req => {
  logger.trace({ ctx: req }, 'update DB from google sheets info');

  const { Amenities } = req.body;
  return await service.updateDBFromSheets(req, { amenities: Amenities });
};

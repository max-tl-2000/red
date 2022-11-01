/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as searchServices from '../../services/search';
import { validateUser } from './users';
import config from '../../config';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'actions/search' });

export const getRankedUnits = async req => {
  logger.trace({ ctx: req }, 'getRankedUnits');

  const readOnlyServer = config.useReadOnlyServer;
  return await searchServices.getRankedUnits({ ...req, readOnlyServer });
};

export const searchPersons = async req => {
  logger.trace({ ctx: req }, 'search persons');
  return await searchServices.searchPersons(req);
};

export const searchCompanies = async req => {
  logger.trace({ ctx: req }, 'search companies');
  return await searchServices.searchCompanies(req, req.body);
};

export const saveSearchHistory = async req => {
  const userId = req.params.userId;
  await validateUser(req, userId);
  logger.trace({ ctx: req }, 'save search history');
  return await searchServices.putSearchHistory(req, userId, req.body);
};

export const loadSearchHistory = async req => {
  const userId = req.params.userId;
  await validateUser(req, userId);
  logger.trace({ ctx: req }, 'load search history');
  return await searchServices.getSearchHistory(req, userId);
};

export const globalSearch = async req => {
  logger.trace({ ctx: req }, 'global search');
  const { query, filters = {} } = req.body;
  const options = {
    ...filters,
  };
  const { authUser } = req;
  const { id: userId, teamIds: authUserTeams } = authUser;
  const ctx = { ...req, userId, authUserTeams };

  return await searchServices.globalSearch(ctx, query, options);
};

export const getPersonMatches = async req => {
  logger.trace({ ctx: req }, 'get person matches');
  return await searchServices.getPersonMatches(req);
};

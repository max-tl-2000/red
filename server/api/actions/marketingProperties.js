/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validateToken, validateReferrer } from '../referrerAuth';
import loggerModule from '../../../common/helpers/logger';
import {
  respondToMarketingPropertiesRequest,
  respondToMarketingPropertyRequest,
  respondToMarketingPropertiesSearchRequest,
  respondToMarketingRelatedPropertiesSearchRequest,
} from '../../services/marketingPropertiesService';
import {
  respondToMarketingInventoryRequest,
  respondToMarketingInventoryPricing,
  respondToMarketingInventoryQuoteQuestions,
  respondToMarketingInventoryAndLayoutRequest,
} from '../../services/marketingInventoryService';
import { respondToMarketingLayoutGroupRequest } from '../../services/marketingLayoutGroupService';
import * as validators from '../helpers/validators';
import config from '../../config';

const logger = loggerModule.child({ subType: 'api/actions/marketingProperties' });

const validateRequest = async req => {
  await validateToken(req);
  validateReferrer(req);
};

export const getMarketingProperties = async req => {
  logger.trace({ ctx: req }, 'getMarketingProperties action - input params');

  await validateRequest(req);

  return await respondToMarketingPropertiesRequest(req);
};

export const searchMarketingProperties = async req => {
  const { 'x-reva-program-email': programEmail, 'x-reva-marketing-session-id': marketingSessionId } = req.headers;
  const readOnlyServer = config.useReadOnlyServer;

  const ctx = {
    ...req,
    readOnlyServer,
  };

  logger.trace({ ctx, ...req.body, programEmail, marketingSessionId }, 'searchMarketingProperties action - input params');

  await validateRequest(ctx);

  await validators.program(ctx, { programEmail, marketingSessionId });

  return await respondToMarketingPropertiesSearchRequest(ctx, { ...req.body, programEmail, marketingSessionId });
};

export const getMarketingLayoutGroup = async req => {
  const readOnlyServer = config.useReadOnlyServer;
  logger.trace({ ctx: req, ...req.params, ...req.query, readOnlyServer }, 'handling marketingLayoutGroup request');

  const ctx = {
    ...req,
    readOnlyServer,
  };

  await validateRequest(ctx);

  const { limit } = req.query;
  const { propertyId, marketingLayoutGroupId } = req.params;

  await validators.property(ctx, propertyId);
  await validators.marketingLayoutGroup(ctx, marketingLayoutGroupId);

  return await respondToMarketingLayoutGroupRequest(ctx, { propertyId, marketingLayoutGroupId, limit });
};

export const getMarketingProperty = async req => {
  const { includePOIs, includeAmenities } = req.query;
  const { propertyId } = req.params;
  const { 'x-reva-program-email': programEmail, 'x-reva-marketing-session-id': marketingSessionId } = req.headers;

  logger.trace({ ctx: req, programEmail, marketingSessionId }, 'getMarketingProperty action - input params');

  await validateRequest(req);

  await validators.program(req, { programEmail, marketingSessionId });
  await validators.property(req, propertyId);

  return await respondToMarketingPropertyRequest(req, propertyId, {
    programEmail,
    marketingSessionId,
    includePOIs,
    includeAmenities,
  });
};

export const getMarketingInventory = async req => {
  logger.trace({ ctx: req, ...req.params }, 'handling marketingInventoryDetails request');

  await validateRequest(req);

  const { inventoryId } = req.params;

  await validators.inventory(req, inventoryId);
  return await respondToMarketingInventoryRequest(req, inventoryId);
};

export const getMarketingInventoryPricing = async req => {
  logger.trace({ ctx: req, ...req.params, ...req.query }, 'getMarketingInventoryPricing - input params');

  await validateRequest(req);

  const { inventoryId } = req.params;

  await validators.inventory(req, inventoryId);
  const { moveInDate, validatePastDate = true } = req.query;
  moveInDate && validators.validDate(moveInDate, 'INCORRECT_DATE');

  return await respondToMarketingInventoryPricing(req, inventoryId, moveInDate, JSON.parse(validatePastDate));
};

export const searchRelatedProperties = async req => {
  const { propertyId } = req.params;
  const { 'x-reva-program-email': programEmail, 'x-reva-marketing-session-id': marketingSessionId } = req.headers;

  const query = { ...req.body, programEmail, marketingSessionId };
  logger.trace({ ctx: req, propertyId, searchRelatedPropertiesQuery: query }, 'searchRelatedProperties action - input params');

  await validateRequest(req);

  await validators.program(req, { programEmail, marketingSessionId });
  await validators.property(req, propertyId);

  return await respondToMarketingRelatedPropertiesSearchRequest(req, { targetPropertyId: propertyId, query });
};

export const getMarketingInventoryQuoteQuestions = async req => {
  const { 'x-reva-program-email': programEmail, 'x-reva-marketing-session-id': marketingSessionId } = req.headers;
  logger.trace({ ctx: req, ...req.params, programEmail, marketingSessionId }, 'getMarketingInventoryQuoteQuestions - input params');

  await validateRequest(req);

  await validators.program(req, { programEmail, marketingSessionId });

  const { inventoryId } = req.params;

  await validators.inventory(req, inventoryId);

  return await respondToMarketingInventoryQuoteQuestions(req, inventoryId);
};

export const getMarketingInventoryAndLayouts = async req => {
  logger.trace({ ctx: req, ...req.params }, 'getMarketingInventories - input params');
  await validateRequest(req);

  const { inventoryIds, marketingLayoutIds, source, asArray } = req.body;

  const validInventoryIds = inventoryIds?.filter(id => validators.isUuid(id));
  const validMarketingLayoutIds = marketingLayoutIds?.filter(id => validators.isUuid(id));

  return await respondToMarketingInventoryAndLayoutRequest(req, {
    inventoryIds: validInventoryIds,
    marketingLayoutIds: validMarketingLayoutIds,
    source,
    asArray,
  });
};

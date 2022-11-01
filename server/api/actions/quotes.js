/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as validators from '../helpers/validators';
import * as service from '../../services/quotes';
import { ServiceError } from '../../common/errors';
import { performPartyStateTransition } from '../../services/partyStatesTransitions';
import { renderTemplate } from '../../services/templates';
import { TemplateNames } from '../../../common/enums/templateTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getARandomPersonIdByPartyId } from '../../dal/partyRepo';
import { getInventoryItem } from '../../services/inventories';
import config from '../../config';

const getUUID = (uuid, token, status = 404) => {
  if (!validators.isUuid(uuid)) {
    throw new ServiceError({ token, status });
  }
  return uuid;
};

const getQuoteId = ({ params: { quoteId } }) => getUUID(quoteId, 'INVALID_QUOTE_ID');
const getPartyId = ({ query: { partyId } }) => getUUID(partyId, 'INVALID_PARTY_ID', 400);

const getAllQuotes = async request => {
  const readOnlyServer = config.useReadOnlyServer;

  const quotes = await service.getAllQuotesByPartyId({ ...request, readOnlyServer }, getPartyId(request));
  return { data: quotes };
};

const getAQuoteDraft = request => service.getQuoteDraft(request, getQuoteId(request));

const getAQuotePublish = request => {
  const throwError = token => {
    throw new ServiceError({ token, status: 404 });
  };
  const { personId, quoteId } = request.authUser || {};
  if (quoteId !== request.params.quoteId && !request.authUser.userId) throwError('INVALID_TOKEN');
  return service.getPublishedQuote(request, getQuoteId(request), personId);
};

const createAQuote = async request => {
  const quote = await service.createQuote(request, request.body);
  await performPartyStateTransition(request, quote.partyId);
  return quote;
};

const duplicateQuote = request => service.duplicateQuote(request, request.query.sourcePublishedQuoteId);

const patchAQuote = async request => {
  const quote = await service.updateQuoteById(request, getQuoteId(request), request.body);
  await performPartyStateTransition(request, quote.partyId);
  return quote;
};

const deleteAQuote = async request => {
  const quote = await getAQuoteDraft(request);
  const res = await service.deleteQuoteById(request, getQuoteId(request));
  if (quote) await performPartyStateTransition(request, quote.partyId);
  return res;
};

const printAQuote = request => service.printQuote(request, request.body);

export const sendQuoteMail = async req => {
  const throwError = token => {
    throw new ServiceError({ token, status: 412 });
  };

  const { partyId } = req.params;
  const { quoteId, context, personIds = [] } = req.body;

  if (!partyId) throwError('PARTY_ID_NOT_DEFINED');
  if (!quoteId) throwError('QUOTE_ID_NOT_DEFINED');

  return await service.sendQuoteMailEvent(req, { quoteId, partyId, context, personIds });
};

export const renderPublishedQuote = async req => {
  const { context, partyId, templateDataOverride, templateArgs = {} } = req.body;
  const { quoteId } = req.params;

  validators.uuid(quoteId, 'INVALID_QUOTE_ID');
  validators.uuid(partyId, 'INVALID_PARTY_ID');

  const { leaseState, inventoryId } = await service.getRawQuoteById(req, quoteId);
  const isRenewalQuote = leaseState === DALTypes.LeaseState.RENEWAL;
  const templateName = !isRenewalQuote ? TemplateNames.AGENT_TO_RESIDENT_QUOTE_TEMPLATE : undefined;

  const propertyTemplate = isRenewalQuote
    ? {
        section: 'QUOTE',
        action: 'RENEWAL_LETTER',
        propertyId: ((await getInventoryItem(req, inventoryId)) || {}).propertyId,
      }
    : undefined;
  const templateArguments = isRenewalQuote
    ? { ...templateArgs, personId: await getARandomPersonIdByPartyId(req, [partyId], { excludeInactive: true }) }
    : { quoteId, personId: req.authUser?.personId };

  return await renderTemplate(req, {
    propertyTemplate,
    templateName,
    context,
    partyId,
    templateDataOverride,
    templateArgs: { ...templateArguments, inventoryId },
  });
};

export { getAllQuotes, getAQuoteDraft, getAQuotePublish, createAQuote, duplicateQuote, patchAQuote, deleteAQuote, printAQuote };

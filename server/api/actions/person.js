/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import uniq from 'lodash/uniq';
import { getPersons, getRawLeadsPersons, getPersonById } from '../../dal/personRepo';
import { emailAddressesAlreadyExist } from '../../dal/contactInfoRepo';
import { getPartyIdsByPersonIds, loadPartyById } from '../../dal/partyRepo';
import { updatePerson as updatePersonService, mergePersons as mergePersonsFromService, mergeCanBePerformed } from '../../services/person';
import { ServiceError, BadRequestError } from '../../common/errors';
import * as validators from '../helpers/validators';
import { formatPhoneNumbers, formatPhoneFromContactInfo } from '../helpers/formatters';
import { exists } from '../../database/factory';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import loggerModule from '../../../common/helpers/logger';
import { sendPartyMembersInformationToScreen } from '../../services/party';

const logger = loggerModule.child({ subType: 'api/actions/person' });

const validatePersonExists = async (ctx, personId) => {
  if (await exists(ctx.tenantId, 'Person', personId)) {
    return;
  }

  throw new ServiceError({
    token: 'PERSON_NOT_FOUND',
    status: 404,
  });
};

export const validatePersonId = async (req, res, next) => {
  const personId = req.params.personId || req.body.personId;
  try {
    await validators.person(req, personId);
    next && next();
  } catch (e) {
    next && next(e);
  }
};

const validateMerge = async (ctx, firstPersonId, secondPersonId) => {
  const validationResult = await mergeCanBePerformed(ctx, firstPersonId, secondPersonId);

  if (validationResult.error) {
    throw new ServiceError({
      token: validationResult.error.token,
      status: validationResult.error.status,
    });
  }

  return;
};

const validatePersonMatchTokenInfo = (personId, authUser) => {
  const isCommonUser = !!authUser.commonUserId;
  if (!isCommonUser || (isCommonUser && personId === authUser.personId)) return;

  throw new BadRequestError('INVALID_PERSON_ID');
};

const validateEmailAddress = async (ctx, personId, contactInfo) => {
  const emailAddresses = contactInfo && contactInfo.emails && contactInfo.emails.map(email => email.value);
  const emailsExist = emailAddresses && (await emailAddressesAlreadyExist(ctx, personId, emailAddresses));

  if (emailsExist) {
    throw new ServiceError({
      token: 'EMAIL_ADDRESS_ALREADY_EXISTS',
      status: 412,
    });
  }
};

export const loadPersonById = async req => await getPersonById(req, req.params.personId);

export const loadPersons = async req => await getPersons(req);

export const loadRawLeads = async req => await getRawLeadsPersons(req);

export const updatePerson = async req => {
  const personId = req.params.personId;
  validators.uuid(personId, 'INVALID_PERSON_ID');
  await validatePersonExists(req, personId);

  validatePersonMatchTokenInfo(personId, req.authUser);
  let { contactInfo } = req.body;
  contactInfo = formatPhoneFromContactInfo(contactInfo);

  await validateEmailAddress(req, personId, contactInfo);

  const delta = { ...req.body, contactInfo };
  validators.lookslikeANumber(contactInfo, 'INVALID_PHONE_NUMBER');

  return await updatePersonService(req, personId, delta);
};

export const mergePersons = async req => {
  const { firstPersonId, secondPersonId, contactInfoToUpdate, dismissedMatches } = req.body;
  logger.trace(
    {
      ctx: req,
      firstPersonId,
      secondPersonId,
      contactInfoToUpdate,
    },
    'merge persons',
  );

  validators.uuid(firstPersonId, 'INVALID_PERSON_ID');
  await validatePersonExists(req, firstPersonId);

  validators.uuid(secondPersonId, 'INVALID_PERSON_ID');
  await validatePersonExists(req, secondPersonId);

  await validateMerge(req, firstPersonId, secondPersonId);

  const resultPerson = await mergePersonsFromService(req, firstPersonId, secondPersonId, formatPhoneNumbers(contactInfoToUpdate), dismissedMatches);

  logger.trace({ ctx: req, resultPerson }, 'merging result');

  const partyIds = uniq(await getPartyIdsByPersonIds(req, [resultPerson.id], false));
  await mapSeries(partyIds, async partyId => {
    const party = await loadPartyById(req, partyId);
    notify({
      ctx: req,
      event: eventTypes.PARTY_UPDATED,
      data: { partyId },
      routing: { teams: party.teams },
    });
  });

  await Promise.all(partyIds.map(partyId => sendPartyMembersInformationToScreen(req, partyId)));

  return resultPerson;
};

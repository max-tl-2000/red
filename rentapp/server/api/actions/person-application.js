/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import * as service from '../../services/person-application';
import { updatePersonFromApplication } from '../../services/payment';
import { BadRequestError } from '../../../../server/common/errors';
import { DALTypes } from '../../../../common/enums/DALTypes';

import { verifyUploaderPerson } from '../../services/documents';
import * as validators from '../../../../server/api/helpers/validators';
import * as rentappValidators from '../helpers/validators';
import { hasRight } from '../../../../server/api/authorization';
import { Rights } from '../../../../common/acd/rights';

import loggerModule from '../../../../common/helpers/logger';
import { getScreeningVersion } from '../../helpers/screening-helper';
import { ScreeningVersion } from '../../../../common/enums/screeningReportTypes';
import { personApplicationProvider } from '../../providers/person-application-provider-integration';
import { logEntity } from '../../../../server/services/activityLogService';
import { getFullName } from '../../../../common/helpers/personUtils';
import { COMPONENT_TYPES, ACTIVITY_TYPES } from '../../../../common/enums/activityLogTypes';

const logger = loggerModule.child({ subType: 'personApplicationAction' });

const validatePersonApplicationExists = async (id, { tenantId, partyId, screeningVersion }) => {
  screeningVersion = await getScreeningVersion({ tenantId, partyId, screeningVersion });
  return await personApplicationProvider(screeningVersion).validatePersonApplicationExists(tenantId, id);
};

const createOrUpdatePersonApplicationWithProvider = async (ctx, personApplicationRaw, shouldExcludeCurrentDataInResponse) => {
  const { tenantId, authUser } = ctx;
  const { partyId, setSsn, shouldUpdatePerson } = personApplicationRaw;
  let { screeningVersion } = authUser;
  screeningVersion = await getScreeningVersion({ tenantId, partyId, screeningVersion });
  const personApplicationUpdated = await personApplicationProvider(screeningVersion).createOrUpdatePersonApplication(ctx, personApplicationRaw, {
    shouldExcludeCurrentDataInResponse,
  });

  shouldUpdatePerson && (await updatePersonFromApplication(ctx, personApplicationRaw));

  if (setSsn) {
    await logEntity(ctx, {
      entity: {
        id: partyId,
        ssnSetFor: getFullName(personApplicationRaw.applicationData),
      },
      activityType: ACTIVITY_TYPES.UPDATE,
      component: COMPONENT_TYPES.PARTY,
    });
  }
  return personApplicationUpdated;
};

export const createOrUpdatePersonApplication = async req => {
  logger.trace({ ctx: req }, 'createOrUpdatePersonApplication');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  logger.info({ ctx: req }, 'createPersonApplication');

  // BUG: this easily be spoofed to obtain existing data if you have the email link!
  // Filed CPM-9866 to address
  // determines whether or not currently saved application data can be returned
  const shouldExcludeCurrentDataInResponse = !req.query.reload;
  const ctx = { tenantId: req.tenantId, authUser: req.authUser, reqId: req.reqId };
  const { propertyId } = ctx.authUser;

  const personApplicationRaw = req.body;

  logger.trace({ ctx: req, personApplicationRaw }, '>>> checking defined person app');
  validators.defined(personApplicationRaw, 'INVALID_PERSON_APPLICANT_BODY');

  logger.trace({ ctx: req, personApplicationRaw }, '>>> checking emailCanReplace');
  if (personApplicationRaw.applicationData) {
    const updateEmailError = await rentappValidators.canUpdateEmail(req, personApplicationRaw);
    if (updateEmailError && updateEmailError.error) return updateEmailError;

    const addressError = rentappValidators.validateApplicationAddress(req, personApplicationRaw);
    if (addressError && addressError.error) return addressError;

    const suffixError = rentappValidators.validateApplicantSuffix(req, personApplicationRaw);
    if (suffixError?.error) return suffixError;
  }

  if (personApplicationRaw.id) {
    // this probably menas that the calller did not realize that the application ID for
    // an updated is obtained from the tenant, party, and person in the authUser
    throw new BadRequestError('ILLEGAL_PARAMETER_ID');
  }

  if (!personApplicationRaw.partyId) {
    throw new BadRequestError('ILLEGAL_PARAMETER_PARTY_ID');
  }

  await service.validateApplicant(ctx, { partyId: personApplicationRaw.partyId, personId: personApplicationRaw.personId, propertyId });

  return await createOrUpdatePersonApplicationWithProvider(ctx, personApplicationRaw, shouldExcludeCurrentDataInResponse);
};

export const updatePersonApplication = async req => {
  logger.trace({ ctx: req }, 'updatePersonApplication');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const personApplicationId = req.params.personApplicationId;
  const { partyId, screeningVersion } = req.authUser;
  logger.info({ ctx: req, personApplicationId }, 'updatePersonApplication');
  const personApplicationRaw = req.body;

  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICANT_ID');
  logger.trace({ ctx: req, personApplicationId }, ' checking personApplication exists');
  await validatePersonApplicationExists(personApplicationId, { tenantId: req.tenantId, partyId, screeningVersion });

  return await service.updatePersonApplication(req, {
    id: personApplicationId,
    ...personApplicationRaw,
  });
};

export const getPersonApplication = async req => {
  logger.trace({ ctx: req }, 'getPersonApplication');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const personApplicationId = req.params.personApplicationId;
  const { partyId, screeningVersion } = req.authUser;
  logger.info({ ctx: req, personApplicationId }, 'getPersonApplication');

  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICANT_ID');
  await validatePersonApplicationExists(personApplicationId, { tenantId: req.tenantId, partyId, screeningVersion });

  return await service.getPersonApplication(req, personApplicationId);
};

export const getPersonApplicationsByPartyId = async req => {
  logger.trace({ ctx: req }, 'getPersonApplicationsByPartyId');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const partyId = req.params.partyId;
  logger.info({ ctx: req, partyId }, 'getPersonApplicationsByPartyId');
  validators.uuid(partyId, 'INVALID_PARTY_APPLICATION_ID');
  return service.getPersonApplicationsByFilter(req, { partyId });
};

export const getDocumentsForPersonApplication = async req => {
  const ctx = { ...req };
  logger.trace({ ctx }, 'getDocumentsForPersonApplication');
  const { partyId, screeningVersion } = req.authUser;

  // TODO: CPM-12483 handle documents for screening V2
  if (screeningVersion && screeningVersion === ScreeningVersion.V2) return [];

  await verifyUploaderPerson(ctx, req.authUser);
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const personApplicationId = req.params.personApplicationId;
  logger.info({ ctx: req, personApplicationId }, 'getDocumentsForPersonApplication');

  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICANT_ID');
  await validatePersonApplicationExists(personApplicationId, { tenantId: req.tenantId, partyId, screeningVersion });

  const result = await service.getDocumentsForPersonApplication(ctx, personApplicationId);

  // TODO: CPM-12483 add validations as part of resolution of CPM-5432
  return result.map(item => item.metadata);
};

export const getPersonApplicationAdditionalData = async req => {
  logger.trace({ ctx: req }, 'getPersonApplicationAdditionalData');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const { personApplicationId, partyId, screeningVersion } = req.authUser;
  logger.info({ ctx: req, personApplicationId }, 'getPersonApplicationAdditionalData');

  // TODO: CPM-12483 handle documents for screening V2
  if (screeningVersion && screeningVersion === ScreeningVersion.V2) return {};

  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICANT_ID');
  await validatePersonApplicationExists(personApplicationId, { tenantId: req.tenantId, partyId, screeningVersion });

  return service.getPersonApplicationAdditionalData(req, personApplicationId);
};

export const updatePersonApplicationAdditionalData = async req => {
  logger.trace({ ctx: req }, 'updatePersonApplicationAdditionalData');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const { personApplicationId, partyId, screeningVersion, propertyId } = req.authUser;
  logger.info({ ctx: req, personApplicationId }, 'updatePersonApplicationAdditionalData');

  // TODO: CPM-12483 handle documents for screening V2
  if (screeningVersion && screeningVersion === ScreeningVersion.V2) return {};

  const personApplicationRaw = req.body;

  validators.defined(personApplicationRaw, 'INVALID_PERSON_APPLICANT_BODY');

  if (!personApplicationId) {
    throw new BadRequestError('ILLEGAL_PARAMETER_ID');
  }
  if (!personApplicationRaw.additionalData) {
    throw new BadRequestError('ILLEGAL_PARAMETER_ADDITIONAL_DATA');
  }

  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICANT_ID');
  await validatePersonApplicationExists(personApplicationId, { tenantId: req.tenantId, partyId, screeningVersion });
  await service.validateApplicant(req, { personApplicationId, propertyId });
  return service.updatePersonApplicationAdditionalData(req, personApplicationId, personApplicationRaw.additionalData);
};

const isPersonApplicationStatusCompleted = applicationStatus => applicationStatus && applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED;

export const completePersonApplication = async req => {
  logger.trace({ ctx: req }, 'completePersonApplication');
  await validators.validTenant(req.tenantId, 'INVALID_TENANT_ID');
  const { personApplicationId, propertyId } = req.authUser;
  logger.info({ ctx: req, personApplicationId }, 'completePersonApplication');
  if (!personApplicationId) {
    throw new BadRequestError('INVALID_PERSON_APPLICATION_ID');
  }
  if (!isPersonApplicationStatusCompleted(req.body.applicationStatus)) {
    throw new BadRequestError('INVALID_APPLICATION_STATUS');
  }

  await service.validateApplicant(req, { personApplicationId, propertyId });

  return await service.completePersonApplication(req, personApplicationId);
};

export const getFeesByPersonApplication = async req => {
  logger.trace({ ctx: req }, 'getFeesByPersonApplication');
  const { quoteId, tenantId, propertyId, partyId, screeningVersion } = req.authUser;
  const personApplicationId = req.params.personApplicationId;
  validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICATION_ID');
  await validatePersonApplicationExists(personApplicationId, { tenantId, partyId, screeningVersion });

  return await service.getFeesByPersonApplication({
    tenantId,
    quoteId,
    propertyId,
    partyId,
    personApplicationId,
  });
};

export const updateWaivedFee = async req => {
  const ctx = { ...req };
  const { tenantId } = ctx;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  const personApplicationId = req.query.personApplicationId;
  personApplicationId && validators.uuid(personApplicationId, 'INVALID_PERSON_APPLICATION_ID');
  const { partyId } = req.body;
  const allowedToModifyParty = await hasRight(Rights.MODIFY_PARTY, ctx, partyId);
  if (!allowedToModifyParty) {
    throw new BadRequestError('USER_NOT_ALLOWED_TO_MODIFY_PARTY');
  }
  personApplicationId && rentappValidators.validateWaivedFeeStatus(ctx, personApplicationId);

  return service.updateWaivedFee(ctx, { partyId, personApplicationId, ...req.body });
};

const getPublicIP = req => (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

export const saveEvent = async req => {
  const { tenantId } = req;
  await validators.validTenant(tenantId, 'INVALID_TENANT_ID');
  const { 'user-agent': userAgent } = req.headers;

  return service.savePersonApplicationEvent(req, {
    userAgent,
    ...req.body,
    publicIP: getPublicIP(req),
  });
};

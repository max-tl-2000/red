/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import orderBy from 'lodash/orderBy';
import get from 'lodash/get';
import pick from 'lodash/pick';
import { mapSeries } from 'bluebird';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { getPersonApplicationsByFilter, validateApplicant } from '../../services/person-application';
import { loadPartyMembers, loadPartyById, getAdditionalInfoByPartyAndType, loadPartyMembersApplicantInfo } from '../../../../server/services/party';
import { getPropertyInfo } from '../helpers/properties';
import { getTenant } from '../../../../server/services/tenantService';
import { getApplicantData, formatApplicationObject } from '../helpers/applicant';
import { getCommonUser, getCommonUsersByCommonUserId, getRegistrationToken, getCommonUserByPersonIds } from '../../../../auth/server/services/common-user';
import { getApplicantName } from '../../../../common/helpers/applicants-utils';
import { execConcurrent } from '../../../../common/helpers/exec-concurrent';
import { getPropertyAssignedToParty } from '../../../../server/helpers/party';
import { getApplicationInvoicesByFilter } from '../../services/application-invoices';
import { AdditionalInfoTypes } from '../../../../common/enums/partyTypes';
import { createJWTToken } from '../../../../common/server/jwt-helpers';
import { AuthorizationDataError } from '../../../../server/common/errors';

import logger from '../../../../common/helpers/logger';
import { getScreeningVersion } from '../../helpers/screening-helper';
import { personApplicationProvider } from '../../providers/person-application-provider-integration';
import { getInventoryForQuote } from '../../../../server/services/inventories';
import { formatPropertyAssetUrl } from '../../../../server/helpers/assets-helper';
import { approvedQuotePromotionsExist } from '../../../../server/services/quotePromotions';
import { getLeasingAgentInformationForApplication } from '../../../../server/dal/usersRepo';

/*
  The next function validates if the payment was completed and if it was not a refresh
  of the Application Additional Info page.
*/

// TODO: move the code into the middleware: CPM-6926
export const getApplicant = async req => {
  const {
    quoteId,
    partyId,
    propertyId,
    impersonatorUserId,
    personId,
    personName,
    tenantId,
    tenantDomain,
    hasMultipleApplications,
    impersonatorEmail,
    isNewApplicationRequest,
  } = await getApplicantData(req);

  const ctx = pick(req, ['tenantId', 'authUser', 'reqId']);
  const { authUser } = ctx;
  const { commonUserId, personApplicationId } = authUser;
  let { screeningVersion } = authUser;
  const shouldExcludeCurrentDataInResponse = !!req.query.isReload;
  logger.trace({ ctx, commonUserId, quoteId, partyId, propertyId, impersonatorUserId, personId, personName, tenantDomain, impersonatorEmail }, 'getApplicant');
  await validateApplicant(ctx, { partyId, personId, propertyId });
  const tenant = await getTenant(ctx, tenantId);

  let inventoryId;
  let propertyFilter = { propertyId };
  if (quoteId) {
    const inventory = await getInventoryForQuote(ctx, quoteId, ['id']);
    inventoryId = inventory.id;
    propertyFilter = { inventoryId, hasQuote: true, ...propertyFilter };
  }
  const propertyInfo = await getPropertyInfo(ctx, propertyFilter);
  const party = await loadPartyById(ctx, partyId);
  const leasingAgent = await getLeasingAgentInformationForApplication(ctx, party.userId);
  const { firstName, lastName, middleName } = getApplicantName(personName);

  const personApplicationData = {
    personId,
    partyId,
    applicationData: {
      firstName,
      lastName,
      middleName,
    },
  };

  screeningVersion = await getScreeningVersion({ partyId, tenantId, screeningVersion });
  let applicationObject = await personApplicationProvider(screeningVersion).getApplication(ctx, party, personApplicationData, {
    shouldExcludeCurrentDataInResponse,
    personApplicationId,
  });

  applicationObject = formatApplicationObject(applicationObject);
  let redirectToApplicationList = false;
  if (!isNewApplicationRequest && applicationObject.paymentCompleted) {
    const commonUsers = await getCommonUserByPersonIds(ctx, [personId]);
    const applicationsByPersonId = await personApplicationProvider(screeningVersion).getPersonApplicationsFromCommonUsers(commonUsers);

    redirectToApplicationList = applicationsByPersonId.length > 1;
  }

  const members = await loadPartyMembersApplicantInfo(ctx, partyId);

  const contactUsLink = tenant.settings.communications && tenant.settings.communications.contactUsLink;
  const commonUser = commonUserId ? await getCommonUser(ctx, commonUserId) : {};
  const residentOrPartyLevelGuarantor = get(tenant, 'partySettings.traditional.residentOrPartyLevelGuarantor');

  return {
    impersonatorUserId,
    impersonatorEmail,
    quoteId,
    personId,
    personName,
    tenantId,
    partyId,
    tenantDomain,
    partyMembersInfo: members,
    applicationObject,
    propertyId,
    propertyInfo,
    leasingAgent,
    contactUsLink,
    commonUserEmail: commonUser.email,
    hasMultipleApplications,
    partyType: party.leaseType,
    residentOrPartyLevelGuarantor,
    isPromotionApproved: await approvedQuotePromotionsExist(ctx, partyId),
    redirectToApplicationList,
  };
};

const getApplicationList = async (ctx, commonUserId) => {
  const commonUsers = await getCommonUsersByCommonUserId(ctx, commonUserId);
  return (
    await execConcurrent(commonUsers, async ({ personId, tenantId, ...props }) => {
      const personApplications = await getPersonApplicationsByFilter({ tenantId }, { personId }, { includeApplicationsWherePartyMemberIsInactive: true });
      return personApplications.map(personApplication => ({ ...personApplication, tenantId, commonUser: { personId, tenantId, ...props } }));
    })
  ).reduce((acc, item) => acc.concat(item), []);
};

const isApplicantNotFoundOrPropertyIsInactive = async (ctx, { partyId, personId, propertyId }) => {
  try {
    await validateApplicant(ctx, { partyId, personId, propertyId });
  } catch (err) {
    return [
      DALTypes.ApplicantErrors.APPLICANT_NOT_FOUND,
      DALTypes.ApplicantErrors.INACTIVE_PROPERTY,
      DALTypes.ApplicantErrors.PARTY_MEMBER_REMOVED,
      DALTypes.ApplicantErrors.PARTY_CLOSED,
    ].includes(err.token);
  }
  return false;
};

export const getApplications = async req => {
  const ctx = req;
  const { commonUserId } = ctx.authUser;
  let applications = await getApplicationList(ctx, commonUserId);
  applications = orderBy(applications, ['updated_at'], ['desc']);

  applications = await mapSeries(applications, async application => {
    const { tenantId, commonUser, partyApplicationId, partyId, id: personApplicationId, applicationStatus, updated_at, paymentCompleted } = application;
    const appCtx = { tenantId };

    const tenant = await getTenant(appCtx);
    appCtx.tenantName = tenant.name;

    const party = await loadPartyById(appCtx, partyId);
    const property = await getPropertyAssignedToParty(appCtx, party);

    const isApplicantRemovedFromParty = await isApplicantNotFoundOrPropertyIsInactive(appCtx, {
      partyId,
      personId: commonUser.personId,
      propertyId: property.id,
    });

    const members = await loadPartyMembers(appCtx, partyId, { excludeInactive: false });
    const additionalInfo = await getAdditionalInfoByPartyAndType(appCtx, partyId);
    const invoices = await getApplicationInvoicesByFilter(appCtx, { partyApplicationId, personApplicationId, paymentCompleted: true });
    const person = members.find(m => m.personId === commonUser.personId);
    const { firstName, lastName } = getApplicantName(person.fullName);

    const quoteId = invoices.length && invoices[0].quoteId;
    let token = '';
    const baseTokenData = {
      partyId,
      quoteId,
      propertyId: property.id,
      personId: commonUser.personId,
      hasMultipleApplications: applications.length > 1,
      isNewApplicationRequest: true,
    };
    if (paymentCompleted) {
      token = await getRegistrationToken(appCtx, commonUser, {
        personApplicationId,
        ...baseTokenData,
      });
    } else {
      token = createJWTToken({
        tenantId: appCtx.tenantId,
        tenantName: appCtx.tenantName,
        ...ctx.authUser,
        commonUserId: null,
        ...baseTokenData,
      });
    }
    return {
      id: personApplicationId,
      applicantName: { firstName, lastName },
      property: property.displayName,
      alongWith: members
        .filter(member => member.fullName !== person.fullName)
        .map(member => member.preferredName || member.fullName)
        .join(','),
      numberOfPets: additionalInfo.filter(item => item.type === AdditionalInfoTypes.PET).length,
      numberOfChildren: additionalInfo.filter(item => item.type === AdditionalInfoTypes.CHILD).length,
      lastUpdated: updated_at,
      applicationStatus,
      unitImageUrl: await formatPropertyAssetUrl(appCtx, property.id),
      token,
      commonUserId: paymentCompleted ? commonUserId : null,
      isApplicantRemovedFromParty,
    };
  });

  if (applications.every(({ orphanApplication }) => orphanApplication)) {
    throw new AuthorizationDataError({ token: 'USER_ASSOCIATED_TO_REMOVED_PERSON' });
  }

  return applications.filter(({ orphanApplication }) => !orphanApplication);
};

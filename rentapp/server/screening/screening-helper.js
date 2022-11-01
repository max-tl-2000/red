/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';
import { getPersonApplicationsByFilter } from '../dal/person-application-repo';
import { upsertPartyApplication } from '../dal/party-application-repo';
import { loadPartyMembers } from '../../../server/services/party';
import { getPartyApplicationByPartyId, updatePartyApplicationHold } from '../services/party-application';
import { getPublishedQuotesDataByPartyId } from '../../../server/services/quotes';
import { errorIfHasUndefinedValues } from '../../../common/helpers/validators';
import { ContextualError } from '../../../server/common/errors';
import { DALTypes } from '../../../common/enums/DALTypes';
import { convertToList } from '../../../common/helpers/list-utils';
import { isPartyLevelGuarantor } from '../../../server/services/party-settings';

import loggerModule from '../../../common/helpers/logger';
const logger = loggerModule.child({ subType: 'screeningHelper' });

export const getPartyMemberAndPersonApplicationList = ({ partyMembers, personApplications }) => {
  const partyPersonIds = partyMembers.map(pm => pm.personId);

  return personApplications
    .filter(personApplication => partyPersonIds.includes(personApplication.personId))
    .map(personApplication => ({
      personApplication,
      partyMember: partyMembers.find(pm => pm.personId === personApplication.personId) || {},
    }));
};

export const shouldReplaceApplicantsIntlAddrWithPropertyAddr = partyMemberAndPersonApplicationList => {
  const [guarantors, residents] = partition(partyMemberAndPersonApplicationList, ({ partyMember }) => partyMember.memberType === DALTypes.MemberType.GUARANTOR);

  const allGuarHaveLocalAddr = guarantors.every(({ personApplication }) => !personApplication.applicationData.haveInternationalAddress);

  const existsApplicantsWithIntlAddr = residents.some(({ personApplication }) => personApplication.applicationData.haveInternationalAddress);

  return allGuarHaveLocalAddr && existsApplicantsWithIntlAddr;
};

export const getScreeningOnHoldValues = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'checking if the application screening is on hold');
  errorIfHasUndefinedValues({ partyId });
  let partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (!partyApplication) partyApplication = {};
  const ret = {
    isHeld: !!partyApplication.isHeld,
    holdReasons: convertToList(partyApplication.holdReason),
  };
  logger.trace({ ctx, ...ret }, 'getScreeningOnHoldValues returning');
  return ret;
};

export const getUnpaidPartyMembers = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'looking up unpaid party members');
  if (!partyId) {
    throw new ContextualError({ message: 'Attempted to get unpaid party members but partyId unset', ctx, partyId });
  }

  const personsApplicationsByParty = await getPersonApplicationsByFilter(ctx, { partyId });
  const partyMembers = await loadPartyMembers(ctx, partyId);

  return partyMembers.reduce((acc, partyMember) => {
    const personApplication = personsApplicationsByParty.find(pa => pa.personId === partyMember.personId);
    if (!personApplication || !personApplication.paymentCompleted) {
      acc.push(partyMember);
    }
    return acc;
  }, []);
};

// TODO: look into assumption that there is only one oneTimeChargeDeposit!
const getDepositForScreening = ({ id: quoteId, additionalAndOneTimeCharges }) => {
  let deposit = 0;
  if (additionalAndOneTimeCharges && additionalAndOneTimeCharges.oneTimeCharges) {
    const oneTimeChargeDeposit = additionalAndOneTimeCharges.oneTimeCharges.find(x => x.quoteSectionName === 'deposit');
    if (oneTimeChargeDeposit) {
      if (oneTimeChargeDeposit.amount || oneTimeChargeDeposit.amount === 0) {
        deposit = oneTimeChargeDeposit.amount;
      } else {
        logger.error({ quoteId }, 'Found deposit without amount!');
        deposit = 0;
      }
    }
  }
  return deposit;
};

export const getRentDataList = quotes => {
  let rentDataList = [];
  quotes.forEach(quote => {
    const deposit = quote.additionalAndOneTimeCharges ? getDepositForScreening(quote) : 0;
    const { leaseTerms } = quote;

    const temp = leaseTerms.map(leaseTerm => {
      if (!leaseTerm) throw new Error('LeaseTerm null');
      if (!leaseTerm.adjustedMarketRent) {
        throw new ContextualError({ message: 'leaseTerm.adjustedMarketRent null or empty', leaseTerm });
      }
      const { adjustedMarketRent: rent, termLength: leaseTermMonths, leaseNameId } = leaseTerm;
      const { id: quoteId = null } = quote;
      return {
        rent,
        leaseTermMonths,
        leaseNameId,
        deposit,
        quoteId,
      };
    });
    rentDataList = rentDataList.concat(temp);
  });
  return rentDataList;
};

// rentData is data for a single leaseTerm
const doesTermAndQuoteMatch = (rentData, screeningResult) =>
  rentData.leaseTermMonths === screeningResult.rentData.leaseTermMonths && rentData.quoteId === screeningResult.quoteId;

const hasRentBeenScreened = (screeningResults, rentData) => screeningResults.some(screeningResp => doesTermAndQuoteMatch(rentData, screeningResp));

// TODO: don't mutate screeningResults
// we should probably rename this function to something like getUnsubmittedQuoteLeaseTerms,
// but I'm keeping it for now because we may want the ability to screen unquoted rent levels
// later
// rentDataList is all published quote + leaseTerm combinations for the party
const getUnsubmittedRentLevels = (rentDataList, screeningResults) => {
  rentDataList = sortBy(rentDataList, 'rent');
  screeningResults = sortBy(screeningResults, 'rentData.rent');
  return rentDataList.filter(
    rentData => !screeningResults.some(screeningResult => doesTermAndQuoteMatch(rentData, screeningResult) || hasRentBeenScreened(screeningResults, rentData)),
  );
};

export const getNextUnsubmittedRentLevels = async (ctx, partyId, screeningResults) => {
  logger.trace({ ctx, partyId }, 'looking up next unsubmitted rent level');
  const { tenantId } = ctx;
  if (!tenantId || !partyId) {
    throw new ContextualError({ message: 'Attempted to get next unsubmitted rent level but partyId or tenantId unset', tenantId, partyId });
  }

  const publishedQuotes = await getPublishedQuotesDataByPartyId(ctx, partyId);
  const rentDataList = getRentDataList(publishedQuotes);

  return getUnsubmittedRentLevels(rentDataList, screeningResults);
};

const hasApplicantsWithInternationalAddressWithoutLinkedGuarantor = async (ctx, partyId) => {
  const { tenantId } = ctx;
  logger.debug({ ctx, partyId }, 'looking up applicants with international address');
  if (!tenantId || !partyId) {
    throw new ContextualError({ message: 'Attempted to get applicants with international address but partyId or tenantId are not set', tenantId, partyId });
  }

  const personsApplicationsByParty = await getPersonApplicationsByFilter(ctx, { partyId });
  const partyMembers = await loadPartyMembers(ctx, partyId);

  return partyMembers.some(partyMember => {
    const personApplication = personsApplicationsByParty.find(application => application.personId === partyMember.personId);
    if (!personApplication) return false;

    const { applicationData } = personApplication;
    const guarantorId = partyMember.guaranteedBy;
    let hasGuarantorInternationalAddress;
    let guarantorPersonApplication;
    // check if the guarantor linked to the applicant has an international address
    if (guarantorId) {
      const guarantor = partyMembers.find(member => member.id === guarantorId);
      guarantorPersonApplication = guarantor && personsApplicationsByParty.find(application => application.personId === guarantor.personId);
      hasGuarantorInternationalAddress =
        guarantorPersonApplication && guarantorPersonApplication.applicationData && guarantorPersonApplication.applicationData.haveInternationalAddress;
    }

    return applicationData && applicationData.haveInternationalAddress && (!guarantorId || !guarantorPersonApplication || hasGuarantorInternationalAddress);
  });
};

export const updateHoldForIntlAddr = async (ctx, partyId) => {
  logger.trace({ ctx, partyId }, 'updateHoldForIntlAddr');
  const hasApplicantsWithIntlAddrAndNoLinkedGuar = await hasApplicantsWithInternationalAddressWithoutLinkedGuarantor(ctx, partyId);
  logger.trace({ ctx, hasApplicantsWithIntlAddrAndNoLinkedGuar }, 'hasApplicantsWithIntlAddrAndNoLinkedGuar');

  const holdReason = DALTypes.HoldReasonTypes.INTERNATIONAL;
  let partyApplication;
  if (hasApplicantsWithIntlAddrAndNoLinkedGuar) {
    logger.trace(
      { ctx, hasApplicantsWithIntlAddrAndNoLinkedGuar, partyId },
      'There were applicants with international address and not linked guarantor, so holding the applicationm HoldReason INTERNATIONAL added',
    );
    partyApplication = await updatePartyApplicationHold(ctx, { partyId, isHeld: true, holdReason });
  } else {
    logger.trace(
      { ctx, hasApplicantsWithIntlAddrAndNoLinkedGuar, partyId },
      'All members with International address has a Guarantor. HoldReason INTERNATIONAL removed',
    );
    partyApplication = await updatePartyApplicationHold(ctx, { partyId, isHeld: false, holdReason });
  }
  return partyApplication.isHeld;
};

export const resetBadHoldScreening = async (ctx, partyId) => {
  const partyApplication = await getPartyApplicationByPartyId(ctx, partyId);
  if (partyApplication && !partyApplication.holdReason && partyApplication.isHeld) {
    await upsertPartyApplication(ctx, { ...partyApplication, partyId, isHeld: false });
  }
};

export const updateLinkedGuarantor = async (ctx, partyId) => {
  const partyMembers = (await loadPartyMembers(ctx, partyId)) || [];
  const members = partyMembers.filter(member => member.memberType !== DALTypes.MemberType.GUARANTOR);
  const guarantors = partyMembers.filter(member => member.memberType === DALTypes.MemberType.GUARANTOR);
  const hasAllGuarantorsLinkedResident = !!guarantors.length && guarantors.every(guarantor => members.some(member => member.guaranteedBy === guarantor.id));
  const holdReason = DALTypes.HoldReasonTypes.RESIDENT_GUARANTOR_LINK;

  let partyApplication;
  const shouldSetGuarantorLinkHold = guarantors.length && !hasAllGuarantorsLinkedResident && !(await isPartyLevelGuarantor(ctx));
  if (shouldSetGuarantorLinkHold) {
    logger.trace(
      { ctx, hasAllGuarantorsLinkedResident, partyId },
      'All guarantors are not linked to a resident, so holding the application HoldReason RESIDENT_GUARANTOR_LINK added',
    );
    partyApplication = await updatePartyApplicationHold(ctx, { partyId, isHeld: true, holdReason });
  } else {
    logger.trace({ ctx, hasAllGuarantorsLinkedResident, partyId }, 'All guarantors are linked to a resident, HoldReason RESIDENT_GUARANTOR_LINK removed');
    partyApplication = await updatePartyApplicationHold(ctx, { partyId, isHeld: false, holdReason });
  }
  return partyApplication.isHeld;
};

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import sortBy from 'lodash/sortBy';
import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../../dal/activeLeaseWorkflowRepo';
import { createExceptionReport } from './exception-report';
import { isSameDay, now, parseAsInTimezone, toMoment } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../../common/date-constants';
import {
  getRecurringCharges,
  getConcessions,
  getFormattedCharges,
  isLeaseMoveInComplete,
  isLeaseMoveOutComplete,
  parseDate,
  baseRentChargeCode,
} from './helpers';
import loggerModule from '../../../../common/helpers/logger';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { PartyExceptionReportRules } from '../../../helpers/exceptionReportRules';
import { markActiveLeaseAsMovingOut, cancelActiveLeaseAsMovingOut } from '../../activeLease.js';
import { logLeaseEndDateChanged } from '../../helpers/workflows';
import { getRenewalPartyIdBySeedPartyId } from '../../../dal/partyRepo';
import { getStartDateForActiveLeaseByPartyId, getSubmittedOrExecutedLeaseByPartyId } from '../../../dal/leaseRepo';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const MIN_DAYS_DIFFERENCE = 1; // Number of days needed between renewal lease start date and vacate date in order to not void the lease

const rules = [
  {
    check: ({ leaseEndChanged }) => !!leaseEndChanged,
    action: async ({
      ctx,
      renewalCycleStarted,
      activeLeaseData,
      newLeaseEndDate,
      isNewLeaseEndInPast,
      partyId,
      entry,
      externalId,
      timezone,
      isNewEndDateMatchingRenewalLease,
    }) => {
      logger.trace(
        { ctx, renewalCycleStarted, activeLeaseData, newLeaseEndDate, isNewLeaseEndInPast, partyId, residentImportTrackingId: entry.id, externalId },
        'lease end-date changed',
      );

      if (renewalCycleStarted) {
        // row 29
        !isNewEndDateMatchingRenewalLease &&
          (await createExceptionReport(ctx, { entry, externalId, partyId }, PartyExceptionReportRules.LEASE_END_DATE_UPDATE_AFTER_RENEWAL_START));
      } else if (isNewLeaseEndInPast) {
        const isExtension = !!activeLeaseData.isExtension;
        const isM2M = activeLeaseData.rolloverPeriod === DALTypes.RolloverPeriod.M2M;

        if (!isExtension && !isM2M) {
          activeLeaseData.metadata = { ...activeLeaseData.metadata, originalEndDate: activeLeaseData.leaseData.leaseEndDate, updatedEndDateInThePast: true };
          activeLeaseData.leaseData.leaseEndDate = newLeaseEndDate;
          activeLeaseData.isExtension = true;
        }
      } else {
        activeLeaseData.leaseData.leaseEndDate = newLeaseEndDate;
        await logLeaseEndDateChanged(ctx, { newLeaseEndDate, partyId, timezone });

        const isExtension = !!activeLeaseData.isExtension;
        const computedExtensionEndDate = activeLeaseData?.leaseData?.computedExtensionEndDate;
        if (
          isExtension &&
          computedExtensionEndDate &&
          toMoment(computedExtensionEndDate, { timezone }).isBefore(toMoment(entry.rawData.leaseEndDate, { timezone }), 'day')
        ) {
          activeLeaseData.isExtension = false;
          const leaseData = omit(activeLeaseData.leaseData, ['computedExtensionEndDate']);
          activeLeaseData.leaseData = leaseData;
        }
      }
    },
  },
  {
    check: ({ recurringChargesChanged }) => !!recurringChargesChanged,
    action: async ({ ctx, renewalCycleStarted, activeLeaseData, newRecurringCharges, entry, partyId, externalId }) => {
      logger.trace(
        { ctx, renewalCycleStarted, activeLeaseData, newRecurringCharges, residentImportTrackingId: entry.id, partyId, externalId },
        'recurring charges changed',
      );

      if (renewalCycleStarted) {
        await createExceptionReport(ctx, { entry, externalId, partyId }, PartyExceptionReportRules.RECURRING_CHARGES_UPDATED_AFTER_RENEWAL_START);
      } else {
        activeLeaseData.recurringCharges = newRecurringCharges;
      }
    },
  },
  {
    check: ({ concessionsChanged }) => !!concessionsChanged,
    action: async ({ ctx, renewalCycleStarted, activeLeaseData, newConcessions, entry, partyId, externalId }) => {
      logger.trace(
        { ctx, renewalCycleStarted, activeLeaseData, newConcessions, residentImportTrackingId: entry.id, partyId, externalId },
        'concessions changed',
      );

      if (renewalCycleStarted) {
        await createExceptionReport(ctx, { entry, partyId, externalId }, PartyExceptionReportRules.CONCESSIONS_UPDATED_AFTER_RENEWAL_START);
      } else {
        activeLeaseData.concessions = newConcessions;
      }
    },
  },
  {
    check: ({ leaseTermChanged }) => !!leaseTermChanged,
    action: async ({
      ctx,
      renewalCycleStarted,
      activeLeaseData,
      receivedLeaseTerm,
      leaseTerm,
      leaseEndDate,
      newLeaseEndDate,
      entry,
      partyId,
      externalId,
      isNewTermMatchingRenewalLease,
    }) => {
      logger.trace(
        {
          ctx,
          renewalCycleStarted,
          residentImportTrackingId: entry.id,
          partyId,
          externalId,
          oldLeaseTerm: leaseTerm,
          oldLeaseEndDate: leaseEndDate,
          newLeaseTerm: receivedLeaseTerm,
          newLeaseEndDate,
        },
        'lease term changed',
      );

      if (renewalCycleStarted) {
        !isNewTermMatchingRenewalLease &&
          (await createExceptionReport(ctx, { entry, partyId, externalId }, PartyExceptionReportRules.LEASE_TERM_UPDATED_AFTER_RENEWAL_START));
      } else if (receivedLeaseTerm !== 1) {
        activeLeaseData.leaseData.leaseTerm = parseInt(receivedLeaseTerm, 10);
        activeLeaseData.rolloverPeriod = DALTypes.RolloverPeriod.NONE;
      } else {
        logger.trace({ ctx, residentImportTrackingId: entry.id, partyId }, 'Lease term updated to MTM');
        activeLeaseData.leaseData.leaseTerm = 1;
        activeLeaseData.rolloverPeriod = DALTypes.RolloverPeriod.M2M;
      }
    },
  },
  {
    check: ({ unitRentChanged }) => !!unitRentChanged,
    action: ({ ctx, activeLeaseData, newUnitRent, entry, partyId }) => {
      logger.trace({ ctx, activeLeaseData, newUnitRent, residentImportTrackingId: entry.id, partyId }, 'unit rent changed');
      activeLeaseData.leaseData.unitRent = parseFloat(newUnitRent);
    },
  },
  {
    // specific for YARDI
    check: ({ ctx, leaseStartChanged }) => !!leaseStartChanged && ctx?.backendMode === DALTypes.BackendMode.YARDI,
    action: ({ ctx, activeLeaseData, newLeaseStartDate, entry, partyId }) => {
      logger.trace({ ctx, activeLeaseData, newLeaseStartDate, residentImportTrackingId: entry.id, partyId }, 'lease start date changed');
      activeLeaseData.leaseData.leaseStartDate = newLeaseStartDate;
      activeLeaseData.leaseData.moveInDate = newLeaseStartDate;

      const isExtension = !!activeLeaseData.isExtension;
      if (isExtension) {
        activeLeaseData.isExtension = false;
        const leaseData = omit(activeLeaseData.leaseData, ['computedExtensionEndDate']);
        activeLeaseData.leaseData = leaseData;
      }
    },
  },
];

const getParsedData = (entry, timezone) => {
  const { leaseEndDate: receivedLeaseEndDate, leaseStartDate: receivedLeaseStartDate, recurringCharges: receivedRecurringCharges } = entry.rawData;

  return {
    leaseEndDate: receivedLeaseEndDate && parseDate(receivedLeaseEndDate, timezone),
    leaseStartDate: receivedLeaseStartDate && parseDate(receivedLeaseStartDate, timezone),
    leaseMoveIn: receivedLeaseStartDate && parseDate(receivedLeaseStartDate, timezone),
    recurringCharges: getFormattedCharges(getRecurringCharges(receivedRecurringCharges), timezone),
    concessions: getFormattedCharges(getConcessions(receivedRecurringCharges), timezone),
    unitRent: (receivedRecurringCharges.find(charge => charge.code === baseRentChargeCode) || {}).amount || 0,
  };
};

const getDataForCheck = ({ ctx, entry, activeLeaseData, timezone, renewalPublishedLease }) => {
  const { unitRent: receivedUnitRent = 0 } = entry.rawData;
  const receivedLeaseTerm = entry.rawData.leaseTerm.toString().toLowerCase() === 'mtm' ? 1 : parseInt(entry.rawData.leaseTerm, 10);
  const { leaseEndDate, leaseTerm, unitRent, leaseStartDate } = activeLeaseData.leaseData;
  const { recurringCharges, concessions } = activeLeaseData;
  const shouldProcessCharges = ctx.backendMode === DALTypes.BackendMode.MRI; // specific for MRI

  const entryParsed = getParsedData(entry, timezone);
  const leaseTermChanged = receivedLeaseTerm !== parseInt(leaseTerm, 10);
  const leaseEndChanged = leaseEndDate && entryParsed.leaseEndDate && !isSameDay(leaseEndDate, entryParsed.leaseEndDate, { timezone });
  const leaseStartChanged = leaseStartDate && entryParsed.leaseStartDate && !isSameDay(leaseStartDate, entryParsed.leaseStartDate, { timezone });

  const isNewTermMatchingRenewalLease = leaseTermChanged && renewalPublishedLease?.termLength === receivedLeaseTerm;
  const isNewEndDateMatchingRenewalLease =
    leaseEndChanged && renewalPublishedLease?.leaseEndDate && isSameDay(renewalPublishedLease.leaseEndDate, entryParsed.leaseEndDate);

  const isNewLeaseEndInPast = parseAsInTimezone(entryParsed.leaseEndDate, { timezone, format: YEAR_MONTH_DAY_FORMAT }).isBefore(now({ timezone }), 'day');
  const sortOrder = ['amount', 'code', 'description', 'quantity', 'startDate', 'endDate'];
  const recurringChargesChanged = shouldProcessCharges && !isEqual(sortBy(recurringCharges, sortOrder), sortBy(entryParsed.recurringCharges, sortOrder));
  const concessionsChanged = shouldProcessCharges && !isEqual(sortBy(concessions, sortOrder), sortBy(entryParsed.concessions, sortOrder));

  const unitRentFromCharges = entryParsed.unitRent;
  const unitRentChanged =
    (!!receivedUnitRent && parseFloat(receivedUnitRent) !== parseFloat(unitRent)) ||
    (!!unitRentFromCharges && parseFloat(unitRentFromCharges) !== parseFloat(unitRent));
  return {
    leaseEndDate,
    isNewEndDateMatchingRenewalLease,
    isNewTermMatchingRenewalLease,
    newLeaseEndDate: entryParsed.leaseEndDate,
    newLeaseStartDate: entryParsed.leaseStartDate,
    leaseEndChanged,
    leaseStartChanged,
    isNewLeaseEndInPast,
    newRecurringCharges: entryParsed.recurringCharges,
    recurringChargesChanged,
    newConcessions: entryParsed.concessions,
    concessionsChanged,
    leaseTermChanged,
    receivedLeaseTerm,
    unitRentChanged,
    newUnitRent: receivedUnitRent || unitRentFromCharges,
    leaseTerm,
    timezone,
  };
};

const handleLeaseVacate = async (ctx, { entry, timezone, partyId, vacateDate, moveOutConfirmed, renewalCycleStarted, isUnderEviction }) => {
  const {
    leaseVacateNotificationDate: receivedLeaseNoticeDate,
    leaseVacateDate: receivedLeaseVacateDate,
    leaseVacateReason: receivedVacateReason,
    isUnderEviction: receivedUnderEvictionFlag,
  } = entry.rawData;

  const receivedNoticeDate = receivedLeaseNoticeDate && parseDate(receivedLeaseNoticeDate, timezone);
  const receivedVacateDate = receivedLeaseVacateDate && parseDate(receivedLeaseVacateDate, timezone);
  const vacateDateReceived = !vacateDate && receivedVacateDate;
  const vacateDateRemoved = vacateDate && !receivedVacateDate;
  const vacateDateChanged = vacateDate && receivedVacateDate && !isSameDay(vacateDate, receivedVacateDate, { timezone });
  const moveOutConfirmationReceived = !moveOutConfirmed && isLeaseMoveOutComplete(entry);
  const isUnderEvictionFlagReceived = receivedUnderEvictionFlag && !isUnderEviction;
  const isUnderEvictionFlagRemoved = !receivedUnderEvictionFlag && isUnderEviction;

  if (vacateDateReceived || vacateDateChanged || moveOutConfirmationReceived || isUnderEvictionFlagReceived) {
    logger.trace({ ctx, residentImportTrackingId: entry.id, externalId: entry.externalId, partyId }, 'lease vacate date changed');

    const renewalPartyId = renewalCycleStarted && (await getRenewalPartyIdBySeedPartyId(ctx, partyId));
    const renewalLeaseStartDate = renewalPartyId && (await getStartDateForActiveLeaseByPartyId(ctx, renewalPartyId));

    const isRenewalStartDateBeforeVacateDate =
      receivedVacateDate &&
      renewalLeaseStartDate &&
      toMoment(renewalLeaseStartDate, { timezone }).add(MIN_DAYS_DIFFERENCE, 'days').isBefore(receivedVacateDate, 'day');

    if (isRenewalStartDateBeforeVacateDate) {
      logger.trace(
        { ctx, residentImportTrackingId: entry.id, externalId: entry.externalId, partyId },
        `Lease vacate date received is ${MIN_DAYS_DIFFERENCE} days after the lease start date on the active renewal, so it will not be processed`,
      );
      return;
    }

    await markActiveLeaseAsMovingOut(ctx, {
      partyId,
      noticeDate: receivedNoticeDate,
      vacateDate: receivedVacateDate,
      reason: receivedVacateReason,
      moveOutCompleted: isLeaseMoveOutComplete(entry),
      timezone,
      isUnderEviction: receivedUnderEvictionFlag,
    });
  } else if ((vacateDateRemoved && !receivedUnderEvictionFlag) || (isUnderEvictionFlagRemoved && !receivedVacateDate)) {
    logger.trace({ ctx, residentImportTrackingId: entry.id, externalId: entry.externalId, partyId }, 'lease vacate date removed');
    await cancelActiveLeaseAsMovingOut(ctx, partyId);
  }
};

export const updateLeaseData = async (ctx, { entry, partyId, property, renewalCycleStarted, forceSyncLeaseData }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'updateLeaseData - start');

  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, partyId);

  if (forceSyncLeaseData) {
    const entryParsed = getParsedData(entry, property.timezone);
    activeLeaseData.leaseData.leaseStartDate = entryParsed.leaseStartDate;
    activeLeaseData.leaseData.leaseEndDate = entryParsed.leaseEndDate;
    activeLeaseData.leaseData.moveInDate = entryParsed.leaseMoveIn;
    activeLeaseData.recurringCharges = entryParsed.recurringCharges;
    activeLeaseData.concessions = entryParsed.concessions;
  } else {
    const renewalPartyId = renewalCycleStarted && (await getRenewalPartyIdBySeedPartyId(ctx, partyId));
    const renewalPublishedLease = renewalPartyId && (await getSubmittedOrExecutedLeaseByPartyId(ctx, renewalPartyId));
    const dataForCheck = getDataForCheck({
      ctx,
      entry,
      activeLeaseData,
      timezone: property.timezone,
      renewalPublishedLease: renewalPublishedLease?.baselineData?.publishedLease,
    });
    const rulesToExecute = rules.filter(rule => !!rule.check({ ctx, ...dataForCheck, renewalCycleStarted }));
    const dataForAction = { ctx, externalId: entry.primaryExternalId, renewalCycleStarted, activeLeaseData, entry, partyId, ...dataForCheck };
    await mapSeries(rulesToExecute, async rule => await rule.action(dataForAction));
  }

  await saveActiveLeaseWorkflowData(ctx, {
    ...activeLeaseData,
    metadata: {
      ...activeLeaseData.metadata,
      ...(isLeaseMoveInComplete(entry) && { moveInConfirmed: true }),
      legalStipulationInEffect: entry.rawData.legalStipulationInEffect || false,
    },
  });

  await handleLeaseVacate(ctx, {
    entry,
    timezone: property.timezone,
    partyId,
    vacateDate: activeLeaseData.metadata.vacateDate,
    isUnderEviction: activeLeaseData.metadata.isUnderEviction,
    renewalCycleStarted,
  });
};

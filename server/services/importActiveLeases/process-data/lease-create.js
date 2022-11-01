/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveActiveLeaseWorkflowData } from '../../../dal/activeLeaseWorkflowRepo';
import { loadPartyMembers } from '../../../dal/partyRepo';
import { toMoment, parseAsInTimezone } from '../../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT, TIME_MERIDIEM_FORMAT } from '../../../../common/date-constants';
import {
  getRecurringCharges,
  getConcessions,
  getFormattedCharges,
  baseRentChargeCode,
  isLeaseMoveInComplete,
  isLeaseMoveOutComplete,
  getInventoryByExternalId,
  isRenewalLetterSent,
  parseDate,
  isPartyMovingOut,
} from './helpers';
import loggerModule from '../../../../common/helpers/logger';
import { DALTypes } from '../../../../common/enums/DALTypes';
import { addCommunication } from '../../communication';

const logger = loggerModule.child({ subType: 'importActiveLeases' });

const buildLease = async (ctx, { property, partyId, entry, inventories, isMonthToMonthLease }) => {
  logger.trace({ ctx, partyId, residentImportTrackingId: entry.id, isMonthToMonthLease }, 'buildLease - start');
  const { rawData } = entry;

  const { buildingId, unitId, leaseStartDate, leaseEndDate, leaseTerm, recurringCharges, unitRent: receivedUnitRent = 0 } = rawData;

  const formattedLeaseStartDate = parseDate(leaseStartDate, property.timezone);
  const unitRent = (recurringCharges.find(charge => charge.code === baseRentChargeCode) || {}).amount || receivedUnitRent;
  const inventory = getInventoryByExternalId(inventories, property.externalId, buildingId, unitId);
  const { id: inventoryId, type: inventoryType } = inventory;

  const lease = {
    moveInDate: formattedLeaseStartDate,
    inventoryId,
    inventoryType,
    leaseStartDate: formattedLeaseStartDate,
    leaseEndDate: parseDate(leaseEndDate, property.timezone),
    unitRent: parseFloat(unitRent),
    leaseTerm: isMonthToMonthLease ? 1 : parseInt(leaseTerm, 10),
  };

  logger.trace({ ctx, partyId, residentImportTrackingId: entry.id, isMonthToMonthLease, lease }, 'buildLease - done');

  return lease;
};

export const addRenewalLetterContactEvent = async (ctx, { partyId, externalRenewalLetterSentDate, property, leaseEndDate }) => {
  const dataToLog = { ctx, partyId, externalRenewalLetterSentDate, propertyId: property.id };
  logger.trace(dataToLog, 'addRenewalLetterContactEvent');

  const { timezone, settings } = property;
  const dateFormat = `${YEAR_MONTH_DAY_FORMAT} ${TIME_MERIDIEM_FORMAT}`;
  let eventDateTime = externalRenewalLetterSentDate && parseAsInTimezone(`${externalRenewalLetterSentDate} 05:00 pm`, { format: dateFormat, timezone });

  if (!eventDateTime) {
    const { renewalCycleStart } = settings?.renewals || {};
    if (!renewalCycleStart) {
      logger.error(dataToLog, 'addRenewalLetterContactEvent - renewalCycleStart is not defined');
      return;
    }

    eventDateTime = toMoment(leaseEndDate, { timezone }).subtract(parseInt(renewalCycleStart, 10), 'days').format(dateFormat);
  }

  const message = {
    text: `MRI shows the renewal letter state as offered and potentially sent around ${eventDateTime}`,
    type: DALTypes.ContactEventTypes.OTHER,
    eventDateTime,
  };

  const partyMembers = await loadPartyMembers(ctx, partyId);
  const { tenantId, authUser } = ctx;
  const contactEventRequest = {
    trx: ctx.trx,
    body: {
      type: DALTypes.CommunicationMessageType.CONTACTEVENT,
      recipients: partyMembers.map(member => member.personId),
      partyId,
      message,
      contactEventType: DALTypes.ContactEventTypes.OTHER,
      names: partyMembers.map(member => member.fullName).join(','),
    },
    tenantId,
    authUser: authUser ? authUser.id : undefined,
  };

  await addCommunication(contactEventRequest);
};

export const createHistoricalLease = async (ctx, { property, partyId, entry, inventories }) => {
  logger.trace({ ctx, residentImportTrackingId: entry.id }, 'createHistoricalLease - start');

  const { rawData } = entry;
  const timezone = property.timezone;
  const isMonthToMonthLease = rawData.leaseTerm.toString().toLowerCase() === 'mtm';

  const leaseData = await buildLease(ctx, { property, partyId, entry, inventories, isMonthToMonthLease });
  const recurringCharges = getRecurringCharges(rawData.recurringCharges);
  const concessions = getConcessions(rawData.recurringCharges);

  const {
    leaseVacateNotificationDate: noticeDate,
    leaseVacateDate: vacateDate,
    leaseVacateReason: vacateReason,
    externalRenewalLetterSentDate,
    leaseEndDate,
    isUnderEviction,
    legalStipulationInEffect,
  } = rawData;
  const wasExternalRenewalLetterSent = isRenewalLetterSent(rawData);

  await saveActiveLeaseWorkflowData(ctx, {
    partyId,
    leaseId: null,
    isImported: true,
    leaseData,
    recurringCharges: getFormattedCharges(recurringCharges, timezone),
    concessions: getFormattedCharges(concessions, timezone),
    state: isPartyMovingOut(entry) ? DALTypes.ActiveLeaseState.MOVING_OUT : DALTypes.ActiveLeaseState.NONE,
    metadata: {
      ...(noticeDate && {
        dateOfTheNotice: parseDate(noticeDate, timezone),
      }),
      ...(vacateDate && {
        vacateDate: parseDate(vacateDate, timezone),
      }),
      ...(vacateReason && { notes: vacateReason }),
      ...(externalRenewalLetterSentDate && {
        externalRenewalLetterSentDate: parseDate(externalRenewalLetterSentDate, timezone),
      }),
      ...(isUnderEviction && { isUnderEviction }),
      legalStipulationInEffect: legalStipulationInEffect || false,
      wasExternalRenewalLetterSent,
      moveInConfirmed: isLeaseMoveInComplete(entry),
      moveOutConfirmed: isLeaseMoveOutComplete(entry),
    },
    externalLeaseId: rawData.leaseNo,
    rolloverPeriod: isMonthToMonthLease ? DALTypes.RolloverPeriod.M2M : DALTypes.RolloverPeriod.NONE,
  });

  if (wasExternalRenewalLetterSent) {
    await addRenewalLetterContactEvent(ctx, { partyId, externalRenewalLetterSentDate, property, leaseEndDate });
  }
};

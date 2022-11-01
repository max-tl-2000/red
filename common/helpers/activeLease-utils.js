/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import { toMoment } from './moment-utils';

export const getActiveLeaseEndDate = activeLeaseWorkflowData => {
  const leaseData = activeLeaseWorkflowData?.leaseData;

  return leaseData?.computedExtensionEndDate || leaseData?.leaseEndDate;
};

export const enhanceChargesWithAdjustedDates = (activeLeaseWorkflowData, timezone) => {
  const { recurringCharges, concessions } = activeLeaseWorkflowData;
  const formattedRecurringCharges = (recurringCharges || []).map(r => {
    const startDate = toMoment(r.startDate, { timezone }).add(2, 'hours').toISOString();
    const endDate = r.endDate ? toMoment(r.endDate, { timezone }).add(2, 'hours').toISOString() : null;
    return {
      ...r,
      startDate,
      endDate,
    };
  });

  const formattedConcessions = (concessions || []).map(c => {
    const startDate = toMoment(c?.startDate, { timezone }).add(2, 'hours').toISOString();
    const endDate = c.endDate ? toMoment(c.endDate, { timezone }).add(2, 'hours').toISOString() : null;
    return {
      ...c,
      startDate,
      endDate,
    };
  });

  return {
    ...activeLeaseWorkflowData,
    recurringCharges: formattedRecurringCharges,
    concessions: formattedConcessions,
  };
};

export const getFormattedLeaseEndDate = (formattedEndDate, daysBeforeLeaseEnds) => {
  const endDate = t('DATE', { date: formattedEndDate });

  if (daysBeforeLeaseEnds < -1) return `${endDate} ${t('DAYS_AGO', { noOfDays: -daysBeforeLeaseEnds })}`;
  if (daysBeforeLeaseEnds === -1) return `${endDate} ${t('REMAINING_YESTERDAY')}`;
  if (daysBeforeLeaseEnds === 0) return `${endDate} ${t('REMAINING_TODAY')}`;
  if (daysBeforeLeaseEnds === 1) return `${endDate} ${t('REMAINING_TOMORROW')}`;
  if (daysBeforeLeaseEnds > 1) return `${endDate} ${t('REMAINING_DAYS', { noOfDays: daysBeforeLeaseEnds })}`;
  return `${endDate}`;
};

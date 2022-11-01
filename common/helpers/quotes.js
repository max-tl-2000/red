/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import orderBy from 'lodash/orderBy';
import omit from 'lodash/omit';
import unionBy from 'lodash/unionBy';
import { t } from 'i18next';
import { QuoteSection, Charges } from '../enums/quoteTypes';
import { YEAR_MONTH_DAY_FORMAT, MONTH_YEAR_FORMAT, MONTH_DATE_YEAR_HOUR_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../date-constants';
import { DALTypes } from '../enums/DALTypes';
import { getDisplayName } from './person-helper';
import { dateInBetween, isDateAfterDate, isDateBeforeDate } from './date-utils';
import { toMoment, parseAsInTimezone, now } from './moment-utils';
import { ScreeningDecision } from '../enums/applicationTypes';
import { FADV_RESPONSE_STATUS } from '../../rentapp/common/screening-constants';
import { formatToMoneyString } from '../money-formatter';
import { adjustmentText } from './adjustmentText';
import { getFixedAmount } from './number';
import nullish from './nullish';
import { getPriceUsingFloorCeiling, setDefaultVariableAmount } from './fee';

const calculateRelativeAdjustment = (marketRent, relativeAdjustment) => (marketRent * parseFloat(relativeAdjustment)) / 100;

const calculateRelativeValue = (marketRent, relativeAdjustment, count) => {
  const percentage = calculateRelativeAdjustment(marketRent, relativeAdjustment);
  return percentage * count;
};

const getConcessionValue = (concession, feeTermInfo, computeRecurring = false) => {
  const relativeAdjustment = Math.abs(concession.relativeAdjustment);
  const absoluteAdjustment = Math.abs(concession.absoluteAdjustment);
  const floorCeilingAmount = concession.floorCeilingAmount;
  const recurringCount = concession.recurringCount || feeTermInfo.length;
  const count = computeRecurring && concession.recurring ? recurringCount : 1;

  let concessionValue;
  if (concession.variableAdjustment) {
    concessionValue = concession.amountVariableAdjustment ? concession.amountVariableAdjustment * count : 0;
  } else if (floorCeilingAmount > 0) {
    concessionValue = floorCeilingAmount * count;
  } else if (relativeAdjustment) {
    concessionValue = calculateRelativeValue(feeTermInfo.amount, relativeAdjustment, count);
  } else {
    concessionValue = absoluteAdjustment * count;
  }

  return getFixedAmount(concessionValue, 2);
};

const ADDITIONAL_CHARGES_SECTIONS = [
  QuoteSection.APPLIANCE,
  QuoteSection.PARKING,
  QuoteSection.PET,
  QuoteSection.STORAGE,
  QuoteSection.UTILITY,
  QuoteSection.SERVICE,
];

const ONETIME_CHARGES_SECTIONS = [QuoteSection.APPLICATION, QuoteSection.DEPOSIT];

const getRecurringAndOneTimeChargesObject = quoteFees => {
  const additionalCharges = [];
  const oneTimeCharges = [];
  quoteFees.forEach(fee => {
    if (ONETIME_CHARGES_SECTIONS.some(name => name.toLowerCase() === fee.quoteSectionName)) {
      oneTimeCharges.push(fee);
    } else {
      additionalCharges.push(fee);
    }
  });

  return {
    additionalCharges,
    oneTimeCharges,
  };
};

const getCharges = (quoteFees, section) => {
  let sectionArray;
  switch (section) {
    case Charges.ADDITIONAL:
      sectionArray = ADDITIONAL_CHARGES_SECTIONS;
      break;
    case Charges.ONETIME:
      sectionArray = ONETIME_CHARGES_SECTIONS;
      break;
    default:
  }

  sectionArray = sectionArray.map(sec => sec.toLowerCase());
  if (quoteFees) {
    const quoteFeesInSection = quoteFees.filter(fee => sectionArray.some(name => name === fee.quoteSectionName));
    const charges = groupBy(quoteFeesInSection, 'quoteSectionName');
    let resultCharges = Object.keys(charges).reduce((result, key) => {
      const chargeType = {};
      chargeType.name = key;
      chargeType.fees = charges[key];
      result.push(chargeType);
      return result;
    }, []);
    resultCharges = sortBy(resultCharges, 'name');
    return resultCharges;
  }
  return null;
};

export const getPersonalizedData = (quoteId, partyMembers, url, tenantId) =>
  partyMembers.map(p => {
    const { person = {} } = p;
    return {
      quoteId,
      personId: p.personId,
      personName: getDisplayName(person, { usePreferred: true, ignoreContactInfo: true }),
      url,
      tenantId,
    };
  });

export { getConcessionValue, calculateRelativeAdjustment, getCharges, getRecurringAndOneTimeChargesObject };

const getEndDateForMoveInOnFirst = (leaseStartDate, term, timezone) => {
  const endDate = toMoment(leaseStartDate, { timezone }).add(term.termLength, term.period);
  return endDate.clone().subtract(1, 'day');
};

const getEndDateForMoveInOnOtherDate = (leaseStartDate, term, timezone) => {
  const endDate = toMoment(leaseStartDate, { timezone }).subtract(1, 'day');
  return endDate.clone().add(term.termLength, term.period);
};

// returns a moment
export const getEndDateFromStartDate = (leaseStartDate, term, timezone) => {
  const { period, termLength } = term;
  if (period === DALTypes.LeasePeriod.MONTH) {
    const dayOfMonth = toMoment(leaseStartDate, { timezone }).date();
    if (dayOfMonth === 1) {
      return getEndDateForMoveInOnFirst(leaseStartDate, term, timezone);
    }

    return getEndDateForMoveInOnOtherDate(leaseStartDate, term, timezone);
  }
  // other period week/day/hour
  return toMoment(leaseStartDate, { timezone }).add(termLength, period);
};

export const canMemberBeInvitedToApply = member =>
  [DALTypes.MemberType.RESIDENT, DALTypes.MemberType.OCCUPANT, DALTypes.MemberType.GUARANTOR].includes(member.memberType);

export const getShortFormatRentableItem = (inventory = {}) => {
  const { name, building = {}, property = {} } = inventory;
  const names = [];
  const propertySH = property.name || '';
  const buildingSH = building.name || '';
  propertySH && names.push(propertySH);
  buildingSH && names.push(buildingSH);
  names.push(name);
  return names.join('-');
};

// TODO: use fullQualifiedName from UnitSearch view
export const getUnitShortHand = inventory => (inventory && getShortFormatRentableItem(inventory)) || '';

const MONTH_30 = 30;
const FEBRUARY_MONTH_NUM = 1; // 0 - 11 / Jan - Dec
const PS_30_DAY_MONTH = '30 day month';
const PS_CALENDAR_MONTH = 'Calendar month';

const isDateLastDayOfFebruary = (date, timezone) => {
  const dayOfMonth = toMoment(date, { timezone }).date();
  const monthOfYear = toMoment(date, { timezone }).month();
  const year = toMoment(date, { timezone }).year();
  const isLeapYear = toMoment([year], { timezone }).isLeapYear();
  if (!isLeapYear && dayOfMonth === 28 && monthOfYear === FEBRUARY_MONTH_NUM) {
    return true; // non-leap-year
  }
  if (isLeapYear && dayOfMonth === 29 && monthOfYear === FEBRUARY_MONTH_NUM) {
    return true; // leap-year
  }
  return false;
};

const calculateBillableDays = (date, { daysInMonth, isMoveInMonth, prorationStrategy, timezone } = {}) => {
  const moveInDay = toMoment(date, { timezone }).date();
  if (isMoveInMonth) {
    if (moveInDay === daysInMonth || (moveInDay > daysInMonth && prorationStrategy === PS_30_DAY_MONTH)) {
      return 1;
    }
    return daysInMonth + 1 - moveInDay; // Includes the move in date
  }

  if (moveInDay > daysInMonth || (isDateLastDayOfFebruary(date, timezone) && prorationStrategy === PS_30_DAY_MONTH)) {
    return daysInMonth;
  }

  return moveInDay; // otherwise billableDays days of month
};

const getBillableDaysPerPeriod = (date, { isMoveInMonth, prorationStrategy, timezone } = {}) => {
  let daysInMonth = 0;
  if (prorationStrategy === PS_30_DAY_MONTH) {
    daysInMonth = MONTH_30;
  } else if (prorationStrategy === PS_CALENDAR_MONTH) {
    daysInMonth = toMoment(date, { timezone }).daysInMonth();
  }

  return {
    billableDays: calculateBillableDays(date, { daysInMonth, isMoveInMonth, prorationStrategy, timezone }),
    daysInMonth,
  };
};

export const calculateProratedAmountToPayPerFee = (moveInDate, feeAmount, { predefinedBillableDays, timezone } = {}) => {
  const { billableDays, daysInMonth } = getBillableDaysPerPeriod(moveInDate, { isMoveInMonth: true, prorationStrategy: PS_CALENDAR_MONTH, timezone });
  const days = predefinedBillableDays || billableDays;
  return getFixedAmount((feeAmount / daysInMonth) * days, 2);
};

export const getTermLengths = (leaseTerms = []) => leaseTerms.map(term => term.termLength || term);

export const addBakedIntoAppliedFeeAdjustment = (concessions = [], partialAdjustedMarketRent) =>
  concessions
    .filter(concession => concession.bakedIntoAppliedFeeFlag)
    .reduce((result, concession) => {
      const concessionRelativeAdjustment = calculateRelativeAdjustment(result, concession.relativeAdjustment);
      const concessionAbsoluteAdjustment = parseFloat(concession.absoluteAdjustment);
      result += concessionRelativeAdjustment + concessionAbsoluteAdjustment;
      return result;
    }, partialAdjustedMarketRent);

const addNonVariableBakedFeesAdjustment = (concessions = [], partialAdjustedMarketRent) => {
  const nonVariableConcessions = concessions.filter(concession => !concession.variableAdjustment);
  return addBakedIntoAppliedFeeAdjustment(nonVariableConcessions, partialAdjustedMarketRent);
};

const formatBakedFeeForLogger = concession => ({
  id: concession.id,
  adjustment: concession.relativeAdjustment || concession.absoluteAdjustment,
});

const getMinMaxAdjustmentsInfo = (concessions, partialAdjustedMarketRent, adjustmentsNotIncluded = []) => {
  if (!concessions.length) {
    return {
      adjustmentFeeIncluded: {},
      bakedFeesAdjustment: '',
      adjustmentsNotIncluded,
    };
  }

  const feeAdjustment = concessions.shift();
  return {
    feeAdjustmentIncluded: formatBakedFeeForLogger(feeAdjustment),
    feeAdjustmentAmount: addBakedIntoAppliedFeeAdjustment([feeAdjustment], partialAdjustedMarketRent),
    adjustmentsNotIncluded: adjustmentsNotIncluded.concat(concessions),
  };
};

export const getMinAndMaxBakedFeesAdjustments = (concessions = [], partialAdjustedMarketRent) => {
  const isVariableBakedFee = concession => concession.bakedIntoAppliedFeeFlag && concession.variableAdjustment;
  const isPositiveAdjustment = concession => concession.relativeAdjustment > 0 || concession.absoluteAdjustment > 0;
  let allowBaseRentAdjustment = false;

  const minAndMaxVaribleConcessions = concessions.reduce(
    (result, concession) => {
      concession.relativeAdjustment = parseFloat(concession.relativeAdjustment);
      concession.absoluteAdjustment = parseFloat(concession.absoluteAdjustment);
      const isAVariableBakedFee = isVariableBakedFee(concession);
      if (isAVariableBakedFee) {
        allowBaseRentAdjustment = true;
        !isPositiveAdjustment(concession) && result.minVariableConcessions.push(concession);
        isPositiveAdjustment(concession) && result.maxVariableConcessions.push(concession);
      }

      return result;
    },
    { minVariableConcessions: [], maxVariableConcessions: [] },
  );

  const { minVariableConcessions, maxVariableConcessions } = minAndMaxVaribleConcessions;
  const sortedMinVariableConcession = orderBy(minVariableConcessions, ['relativeAdjustment', 'absoluteAdjustment'], ['asc', 'asc']);
  const sortedMaxVariableConcession = orderBy(maxVariableConcessions, ['relativeAdjustment', 'absoluteAdjustment'], ['desc', 'desc']);

  const {
    feeAdjustmentIncluded: minFeeAdjustmentIncluded,
    feeAdjustmentAmount: minBakedFeesAdjustment,
    adjustmentsNotIncluded: negativeFeesNotIncluded,
  } = getMinMaxAdjustmentsInfo(sortedMinVariableConcession, partialAdjustedMarketRent);

  const {
    feeAdjustmentIncluded: maxFeeAdjustmentIncluded,
    feeAdjustmentAmount: maxBakedFeesAdjustment,
    adjustmentsNotIncluded: negativeAndPositivesFeesNotIncluded,
  } = getMinMaxAdjustmentsInfo(sortedMaxVariableConcession, partialAdjustedMarketRent, negativeFeesNotIncluded);

  const adjustmentsNotIncluded = negativeAndPositivesFeesNotIncluded.map(fee => formatBakedFeeForLogger(fee));

  return {
    minBakedFeesAdjustment: minBakedFeesAdjustment || '',
    maxBakedFeesAdjustment: maxBakedFeesAdjustment || '',
    minFeeAdjustmentIncluded: minFeeAdjustmentIncluded || {},
    maxFeeAdjustmentIncluded: maxFeeAdjustmentIncluded || {},
    adjustmentsNotIncluded,
    allowBaseRentAdjustment,
  };
};

export const calculatePartialAdjustedMarketRentWithNonVariableBakedFees = (leaseTerm, marketRent = 0) => {
  const relativeAdjustment = marketRent ? calculateRelativeAdjustment(marketRent, leaseTerm.relativeAdjustment) : 0;
  const absoluteAdjustment = parseFloat(leaseTerm.absoluteAdjustment);
  const partialAdjustedMarketRent = marketRent + relativeAdjustment + absoluteAdjustment;
  return addNonVariableBakedFeesAdjustment(leaseTerm.concessions, partialAdjustedMarketRent);
};

const getChildFeeParentAmount = (fees, child) => {
  const parentFee = (fees || []).find(f => f.children && f.children.some(c => c === child.id)) || {};
  return parentFee.amount;
};

export const updateFeesAmount = fees =>
  fees.map(fee => {
    if (fee.concessions) {
      fee.amount = addBakedIntoAppliedFeeAdjustment(fee.concessions, parseFloat(fee.price));
    }

    if (fee.feeType === DALTypes.FeeType.DEPOSIT && fee.parentFeeAmount) {
      fee.parentFeeAmount = getChildFeeParentAmount(fees, fee);
    }
    return fee;
  });

export const isApplicationApprovable = promotionStatus =>
  promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL || promotionStatus === DALTypes.PromotionStatus.REQUIRES_WORK;

export const hasBakedFeesWithVariableFlag = (concessions = []) =>
  concessions.some(concession => concession.bakedIntoAppliedFeeFlag && concession.variableAdjustment);

export const isNotSetTheAllowBaseRentAdjustmentForTerm = (allowBaseRentAdjustment, allowBaseRentAdjustmentForTerm) =>
  allowBaseRentAdjustment && !allowBaseRentAdjustmentForTerm;

export const getLimitValuesForBaseRent = (leaseTerm, allowBaseRentAdjustment, originalBaseRent) =>
  isNotSetTheAllowBaseRentAdjustmentForTerm(allowBaseRentAdjustment, leaseTerm.allowBaseRentAdjustment)
    ? { min: originalBaseRent, max: '' }
    : {
        min: leaseTerm.minBakedFeesAdjustment,
        max: leaseTerm.maxBakedFeesAdjustment,
      };

const searchLeaseStartDateInMatrix = ({ startDates, leaseTermFromMatrix, leaseStartDate, getClosestRange }) => {
  const isMoveInBeforeRange = isDateAfterDate(startDates[0], leaseStartDate);
  if (isMoveInBeforeRange && !getClosestRange) return {};

  if (isMoveInBeforeRange) {
    return {
      leaseRentData: leaseTermFromMatrix[startDates[0]],
      date: startDates[0],
      index: 0,
    };
  }

  let firstIndex = 0;
  let lastIndex = startDates.length - 1;
  let middleIndex = Math.floor((lastIndex + firstIndex) / 2);

  let isLeaseStartDateInRange = dateInBetween(startDates[middleIndex], leaseTermFromMatrix[startDates[middleIndex]].endDate, leaseStartDate);

  while (!isLeaseStartDateInRange && firstIndex < lastIndex) {
    if (leaseStartDate <= startDates[middleIndex]) {
      lastIndex = middleIndex - 1;
    } else if (leaseStartDate >= startDates[middleIndex]) {
      firstIndex = middleIndex + 1;
    }
    middleIndex = Math.floor((lastIndex + firstIndex) / 2);
    isLeaseStartDateInRange = dateInBetween(startDates[middleIndex], leaseTermFromMatrix[startDates[middleIndex]].endDate, leaseStartDate);
  }

  if (isLeaseStartDateInRange) return { leaseRentData: leaseTermFromMatrix[startDates[middleIndex]], index: middleIndex };

  if (getClosestRange) {
    lastIndex = startDates.length - 1;
    const leaseRentData = leaseTermFromMatrix[startDates[lastIndex]];
    const lastDateFromRange = leaseRentData.endDate;

    return {
      leaseRentData,
      date: lastDateFromRange,
      index: lastIndex,
    };
  }
  return {};
};

export const getMatrixLeaseRentData = (leaseTermFromMatrix, leaseStartDate, getClosestRange) => {
  if (leaseTermFromMatrix[leaseStartDate]) {
    return { leaseRentData: leaseTermFromMatrix[leaseStartDate] };
  }

  return searchLeaseStartDateInMatrix({ startDates: Object.keys(leaseTermFromMatrix), leaseTermFromMatrix, leaseStartDate, getClosestRange });
};

export const updateTermWithMatrixRents = (leaseTerm, leaseStartDate, rentMatrix, timezone, resetOverwrittenBaseRent = false) => {
  if (!leaseStartDate) return leaseTerm;

  const formattedLeaseStartDate = toMoment(leaseStartDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT);
  const leaseTermFromMatrix = rentMatrix && rentMatrix[leaseTerm.termLength];
  const { leaseRentData: matrixLeaseRentData } = (leaseTermFromMatrix && getMatrixLeaseRentData(leaseTermFromMatrix, formattedLeaseStartDate)) || {};

  if (!matrixLeaseRentData) {
    return omit(leaseTerm, [
      'adjustedMarketRent',
      'overwrittenBaseRent',
      'originalBaseRent',
      'allowBaseRentAdjustment',
      'minBakedFeesAdjustment',
      'maxBakedFeesAdjustment',
    ]);
  }

  const {
    overwrittenBaseRent: savedOverwrittenBaseRent,
    originalBaseRent,
    allowBaseRentAdjustment,
    minBakedFeesAdjustment,
    maxBakedFeesAdjustment,
  } = matrixLeaseRentData;
  const adjustedMarketRent = matrixLeaseRentData.adjustedMarketRent || matrixLeaseRentData.rent;

  const resetOverwritten = leaseTerm.resetOverwrittenBaseRent || resetOverwrittenBaseRent;
  const overwrittenBaseRent = resetOverwritten ? 0 : leaseTerm.overwrittenBaseRent || savedOverwrittenBaseRent;

  leaseTerm.adjustedMarketRent = resetOverwritten ? originalBaseRent : adjustedMarketRent;
  leaseTerm.overwrittenBaseRent = resetOverwritten ? originalBaseRent : overwrittenBaseRent;
  leaseTerm.originalBaseRent = originalBaseRent;
  leaseTerm.allowBaseRentAdjustment = allowBaseRentAdjustment;
  leaseTerm.minBakedFeesAdjustment = minBakedFeesAdjustment;
  leaseTerm.maxBakedFeesAdjustment = maxBakedFeesAdjustment;

  return leaseTerm;
};

export const updateLeaseTermsWithMatrixRents = (model, leaseTerms, timezone, resetOverwrittenBaseRent) => {
  const { leaseStartDate, rentMatrix } = model;

  if (!rentMatrix) return leaseTerms;

  return leaseTerms.map(leaseTerm => updateTermWithMatrixRents(leaseTerm, leaseStartDate, rentMatrix, timezone, resetOverwrittenBaseRent));
};

export const getLeaseTermsWithoutRent = (leaseTerms, selectedLeaseTermIds) =>
  leaseTerms.filter(leaseTerm => selectedLeaseTermIds.some(leaseTermId => leaseTerm.id === leaseTermId && !leaseTerm.adjustedMarketRent));

export const isAValidLeaseStartDateInRentMatrix = (model, { validateDateRangePreference, moveInDateRangePreference } = {}) => {
  const { leaseStartDate, rentMatrix, leaseTerms, propertyTimezone: timezone } = model;
  if (!rentMatrix || !leaseStartDate) return true;

  const startDate = toMoment(leaseStartDate, { timezone }).startOf('day');
  const today = now({ timezone }).startOf('day');
  if (startDate.isBefore(today)) {
    return false;
  }

  if (validateDateRangePreference && moveInDateRangePreference) {
    const { min, max } = moveInDateRangePreference;
    const minDate = min ? toMoment(min, { timezone }) : today;
    const maxDate = max ? toMoment(max, { timezone }) : toMoment(now({ timezone }).add(100, 'years'), { timezone });

    if (maxDate.isBefore(today) && !startDate.isBetween(minDate, maxDate, null, '[]')) return false;
  }
  const formattedLeaseStartDate = toMoment(leaseStartDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT);

  return leaseTerms.some(leaseTerm => {
    const leaseTermFromMatrix = rentMatrix[leaseTerm.termLength];
    const { leaseRentData: matrixLeaseRentData } = (leaseTermFromMatrix && getMatrixLeaseRentData(leaseTermFromMatrix, formattedLeaseStartDate)) || {};
    return matrixLeaseRentData;
  });
};

const getHighestEndDateOnRentMatrix = ({ leaseTerms = [], rentMatrix, endDate, timezone }) => {
  if (!rentMatrix) {
    throw new Error('getHighestEndDateOnRentMatrix: Missing rent matrix');
  }

  return leaseTerms.reduce((acc, leaseTerm) => {
    const leaseTermFromMatrix = rentMatrix[leaseTerm.termLength];
    if (!leaseTermFromMatrix) return acc;

    const startDates = Object.keys(leaseTermFromMatrix);
    const startDatesLength = startDates.length - 1;
    const highestEndDate = parseAsInTimezone(leaseTermFromMatrix[startDates[startDatesLength]].endDate, { timezone });

    return isDateBeforeDate(acc, highestEndDate) ? highestEndDate : acc;
  }, endDate);
};

const searchOverlappingDatesInMatrix = ({ startDates, leaseTermFromMatrix, startDate, endDate, timezone }) => {
  let matchingStartDateIndex = startDates.findIndex(currentStartDate =>
    dateInBetween(currentStartDate, leaseTermFromMatrix[currentStartDate].endDate, startDate),
  );
  const overlappingMatrixPrices = [];

  // If we did not find it, that could mean the range startDate is before the priceMatrix start date
  if (matchingStartDateIndex < 0) {
    // Setting the matchingStartDateIndex to 0 in case the range startDate is before the matrix starDate or after the matrix endDate so we get the available prices below
    matchingStartDateIndex = 0;
  }

  // We get all the prices between the matchingStartDateIndex and the provided end date
  const lastIndex = startDates.length - 1;
  for (let i = matchingStartDateIndex; i <= lastIndex; i++) {
    const currentStartDate = startDates[i];
    // If the current start date is after the end date, that means we should not continue
    if (currentStartDate > endDate) {
      break;
    }

    overlappingMatrixPrices.push({ startDate: parseAsInTimezone(currentStartDate, { timezone }), ...leaseTermFromMatrix[currentStartDate] });
  }

  return overlappingMatrixPrices;
};

const isPriceLower = (currentPrice, price) => parseFloat(currentPrice) < parseFloat(price);

const getClosestLowestPriceTermAvailable = (overlappingMatrixPrices, currentLowestPriceTermBetweenRange) =>
  overlappingMatrixPrices.reduce(
    (acc, matrixPrice) => {
      const isCurrentPriceLower = isPriceLower(matrixPrice.adjustedMarketRent, acc.adjustedMarketRent);
      if (!acc.adjustedMarketRent || isCurrentPriceLower) {
        acc = matrixPrice;
      }
      return acc;
    },
    { ...currentLowestPriceTermBetweenRange },
  );

const getLowestPriceOverlappingTermInMatrix = ({ leaseTerms, rentMatrix, formattedStartDate, formattedEndDate, timezone, formattedMoveInEndDate }) =>
  leaseTerms.reduce(
    (lowestPriceTerm, leaseTerm) => {
      const { termLength, id: termId } = leaseTerm;
      const leaseTermFromMatrix = rentMatrix[termLength];
      if (!leaseTermFromMatrix) return lowestPriceTerm;

      const startDates = Object.keys(leaseTermFromMatrix);
      const overlappingMatrixPrices = leaseTermFromMatrix
        ? searchOverlappingDatesInMatrix({ startDates, leaseTermFromMatrix, startDate: formattedStartDate, endDate: formattedEndDate, timezone }) || []
        : [];

      if (!overlappingMatrixPrices.length) return lowestPriceTerm;

      const currentLowestPriceTermBetweenRange = overlappingMatrixPrices.reduce(
        (acc, matrixPrice) => {
          const parsedMatrixStartDate = parseAsInTimezone(matrixPrice.startDate, { timezone });
          const isCurrentBetweenMoveInDateRange = dateInBetween(formattedStartDate, formattedMoveInEndDate, parsedMatrixStartDate);

          const isCurrentPriceLower = isPriceLower(matrixPrice.adjustedMarketRent, acc.adjustedMarketRent);

          if (!acc.adjustedMarketRent || (isCurrentPriceLower && isCurrentBetweenMoveInDateRange)) {
            acc = matrixPrice;
          }
          return acc;
        },
        { startDate: null, adjustedMarketRent: null },
      );

      const closestLowestPriceTermAvailable = currentLowestPriceTermBetweenRange.adjustedMarketRent
        ? currentLowestPriceTermBetweenRange
        : getClosestLowestPriceTermAvailable(overlappingMatrixPrices, currentLowestPriceTermBetweenRange);

      if (!closestLowestPriceTermAvailable.startDate) return lowestPriceTerm;
      if (!lowestPriceTerm.adjustedMarketRent || isPriceLower(closestLowestPriceTermAvailable.adjustedMarketRent, lowestPriceTerm.adjustedMarketRent)) {
        lowestPriceTerm = { termId, termLength, ...closestLowestPriceTermAvailable };
      }

      return lowestPriceTerm;
    },
    { termId: null, startDate: null, adjustedMarketRent: null },
  );

export const getLowestPriceStartDateFromMatrixForDatesRange = ({ model, moveInDateRangePreference = {}, startFromToday = false }) => {
  const { min: minDate, max: maxDate } = moveInDateRangePreference;
  const { rentMatrix, leaseTerms, propertyTimezone: timezone } = model;
  if (!leaseTerms || !rentMatrix) return { termId: null, startDate: null };

  const today = now({ timezone });

  let startDate = minDate ? toMoment(minDate, { timezone }) : today;
  if (startFromToday && startDate.isBefore(today)) {
    startDate = today;
  }

  const endDate = getHighestEndDateOnRentMatrix({ leaseTerms, rentMatrix, endDate: startDate, timezone });

  const formattedStartDate = startDate.format(YEAR_MONTH_DAY_FORMAT);
  const formattedEndDate = toMoment(endDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT);
  const formattedMoveInEndDate = toMoment(maxDate, { timezone }).format(YEAR_MONTH_DAY_FORMAT);

  const lowestPriceTerm = getLowestPriceOverlappingTermInMatrix({
    leaseTerms,
    rentMatrix,
    formattedStartDate,
    formattedEndDate,
    timezone,
    formattedMoveInEndDate,
  });
  const { startDate: lowestPriceStartDate } = lowestPriceTerm;

  if (lowestPriceStartDate && parseAsInTimezone(lowestPriceStartDate, { timezone }).isBefore(today)) {
    return { ...lowestPriceTerm, startDate: today };
  }

  return lowestPriceTerm;
};

const getRentFromMatrixRange = ({ rent, adjustedMarketRent }) => parseFloat(rent || adjustedMarketRent);

export const searchLowestPriceInClosestRanges = (startDates, leaseTermFromMatrix, leaseStartDate, currentDate) => {
  const { leaseRentData, index } = searchLeaseStartDateInMatrix({ startDates, leaseTermFromMatrix, leaseStartDate });
  if (!leaseRentData) {
    return null;
  }

  let lowestRentInTerm = { rent: getRentFromMatrixRange(leaseRentData), endDate: leaseStartDate };

  const selectedDatePrice = parseFloat(lowestRentInTerm.rent);
  let previousDatePrice = Number.MAX_SAFE_INTEGER;
  let nextDatePrice = Number.MAX_SAFE_INTEGER;

  if (index > 0 && (!currentDate || !isDateAfterDate(currentDate, leaseTermFromMatrix[startDates[index - 1]].endDate))) {
    previousDatePrice = getRentFromMatrixRange(leaseTermFromMatrix[startDates[index - 1]]);
  }

  if (index < startDates.length - 1) {
    nextDatePrice = getRentFromMatrixRange(leaseTermFromMatrix[startDates[index + 1]]);
  }

  if (previousDatePrice < selectedDatePrice && previousDatePrice < nextDatePrice) {
    const rentData = leaseTermFromMatrix[startDates[index - 1]];
    lowestRentInTerm = { endDate: rentData.endDate, rent: getRentFromMatrixRange(rentData) };
  }

  if (nextDatePrice < selectedDatePrice && nextDatePrice < previousDatePrice) {
    const startDate = startDates[index + 1];
    const rentData = leaseTermFromMatrix[startDate];
    lowestRentInTerm = { rent: getRentFromMatrixRange(rentData), endDate: startDate };
  }

  return lowestRentInTerm;
};

export const calculateFeeRelativePrice = ({ relativePrice, absolutePrice }, parentPrice, isInventoryGroupType = false) => {
  if (isInventoryGroupType) return parentPrice;
  if (!relativePrice || !parentPrice) return absolutePrice;

  return Math.abs(relativePrice / 100) * parentPrice;
};

export const searchQuotePromotion = (promotion, quotePromotions, promotionStatus) => {
  let quotePromotion = promotion;

  if (!quotePromotion) {
    console.error('no approvable promotions found');
    // This can happen in cases in which an approval was requested earlier, but the user
    // closed the approval screen and then quickly returned.
    if (promotionStatus !== DALTypes.PromotionStatus.APPROVED) {
      // this probably means that the user initially accidentally click approved, then panicked and click the X
      // and quickly returned to this screen and tried to cancel.  So in this case, let them do it...
      quotePromotion = quotePromotions.find(p => p === DALTypes.PromotionStatus.APPROVED);
      if (!quotePromotion) {
        throw new Error(`Cannot find approved promotion to change to ${promotionStatus}`);
      }
    }
  }

  return quotePromotion || {};
};

const doesLeaseTermMatch = (leaseTerm, screeningResponse) => screeningResponse.rentData.leaseTermMonths === leaseTerm.termLength;

const doesQuoteIdMatch = (quoteId, screeningResponse) => screeningResponse.quoteId === quoteId;

export const getQuoteAndLeaseTermMatch = (leaseTerm, quoteId, screening) => ({
  leaseTermMatches: doesLeaseTermMatch(leaseTerm, screening),
  quoteMatches: doesQuoteIdMatch(quoteId, screening),
});

export const getMatchingResultsSorted = (quotePromotion, leaseTerm, screeningResults = []) => {
  const matchingResults = screeningResults.filter(result => {
    const { leaseTermMatches, quoteMatches } = getQuoteAndLeaseTermMatch(leaseTerm, quotePromotion.quoteId, result);
    return leaseTermMatches && quoteMatches;
  });

  return orderBy(matchingResults, ['submissionResponseCreatedAt'], ['desc']);
};

export const doesScreeningResultChangedAfterPromotion = (quotePromotion, screeningResults = []) => {
  if (screeningResults.length <= 1) return false;

  const currentResult = screeningResults[0];
  const newResultsExistsAfterPromotion = isDateAfterDate(currentResult.submissionResponseCreatedAt, quotePromotion.updated_at, 'seconds');

  if (!newResultsExistsAfterPromotion) return false;

  const previousResultBeforePromotion = screeningResults.find(result =>
    isDateBeforeDate(result.submissionResponseCreatedAt, quotePromotion.updated_at, 'seconds'),
  );

  return !previousResultBeforePromotion || currentResult.applicationDecision !== previousResultBeforePromotion.applicationDecision;
};

export const isScreeningResultIncomplete = (screeningResults = []) => {
  const { status = '', applicationDecision = '' } = screeningResults[0] || {};
  const hasIncompleteStatus =
    status.toLowerCase() === FADV_RESPONSE_STATUS.INCOMPLETE.toLowerCase() ||
    status.toLowerCase() === FADV_RESPONSE_STATUS.INCOMPLETE_INCORRECT_MEMBERS.toLowerCase();
  const hasIncompleteApplicationDecision = applicationDecision.toLowerCase() === ScreeningDecision.INCOMPLETE.toLowerCase();

  return hasIncompleteStatus || hasIncompleteApplicationDecision;
};

export const getCounterSignDialogTexts = hasApplicationStatusChanged => {
  if (hasApplicationStatusChanged) {
    return {
      titleText: t('WARNING_CONDITION_CHANGED'),
      contentText: t('WARNING_CONTENT_CHANGED'),
      contentQuestionText: t('WARNING_CONTENT_QUESTION_CHANGED'),
      continueButtonText: t('WARNING_BUTTON_CHANGED'),
    };
  }

  return {
    titleText: t('WARNING_CONDITION_INCOMPLETE'),
    contentText: t('WARNING_CONTENT_INCOMPLETE'),
    contentQuestionText: t('WARNING_CONTENT_QUESTION_INCOMPLETE'),
    continueButtonText: t('WARNING_BUTTON_INCOMPLETE'),
  };
};

const filterOutBakedConcessions = concessions => concessions.filter(concession => !concession.bakedIntoAppliedFeeFlag);

export const filterOutLeaseTermsBakedConcessions = leaseTerms =>
  leaseTerms.reduce((result, term) => {
    // TODO: this should be part of the quote model as a getter not mutating the values of the quote
    let { concessions, chargeConcessions, ...restOfTerm } = term;

    concessions = concessions ? filterOutBakedConcessions(concessions) : [];
    chargeConcessions = chargeConcessions ? filterOutBakedConcessions(chargeConcessions) : [];

    const newTerm = {
      ...restOfTerm,
      concessions,
      chargeConcessions,
    };

    result.push(newTerm);
    return result;
  }, []);

// should move the existing one from client/helpers/quoteTextHelpers.js to ../common/helpers/..
export const trans = {
  year: 'YEAR',
  week: 'WEEK',
  month: 'MONTH',
  day: 'DAY',
  hour: 'HOUR',
};

export const periodText = term => {
  const { termLength, period } = term;
  return t(trans[period] + ((termLength !== 1 && 'S') || ''));
};

const termText = term => {
  const { termLength } = term;
  const period = periodText(term);
  return `${termLength} ${period}`;
};

/*
For the provided lease term and array of selected concessions, returns an array of all selected
concessions, including the concessionName and formatted concessionValue.
*/
const flattenedConcessionsInfo = (term, concessions) =>
  concessions.reduce((result, concession) => {
    const formattedValue = formatToMoneyString(concession.computedValue);

    const isNotVariable = !concession.variableAdjustment;
    const isVariableAndSet = concession.variableAdjustment && concession.amountVariableAdjustment > 0;
    const isRecurringAndSet = concession.recurring && (isNotVariable || isVariableAndSet);
    const adjustmentCaption = adjustmentText(concession, term);

    const concessionObject = {
      concessionName: concession.displayName,
      concessionValue: formattedValue,
      adjustmentText: isRecurringAndSet ? adjustmentCaption : null,
    };

    result.push(concessionObject);
    return result;
  }, []);

export const flattenedLeaseTermsInfo = leaseTerms =>
  leaseTerms.reduce((result, term) => {
    const amount = term.adjustedMarketRent;
    const formattedRent = formatToMoneyString(amount);
    const termObject = {
      period: t('QUOTE_LEASE_LENGTH_TITLE', {
        length: termText(term),
      }),
      renewalPeriod: `${term.termLength} ${t(trans[term.period])}`,
      endDate: t('QUOTE_ENDS_ON', {
        date: term.endDate.format(MONTH_DATE_YEAR_FORMAT),
      }),
      baseRent: formattedRent,
      concessions: flattenedConcessionsInfo(term, term.concessions),
    };

    result.push(termObject);
    return result;
  }, []);

export const getAdjFormOfPeriod = term => {
  const period = t(trans[term.period] + ('LY' || ''));
  return `${period}`;
};

const getPeriodPaymentDetails = paymentSchedule =>
  paymentSchedule.reduce((result, period) => {
    const amount = period.amount;
    const formattedValue = formatToMoneyString(amount);

    const periodPaymentObject = {
      timeFrame: period.timeframe,
      amount: formattedValue,
    };
    result.push(periodPaymentObject);
    return result;
  }, []);

export const getTotalConcessions = concessions =>
  concessions.reduce((result, concession) => {
    result += concession.computedValue || 0;
    return result;
  }, 0);

export const flattenedChargeInfo = (charges, termId, formatAmount = true) => {
  const filteredCharges = [];
  (charges || []).forEach(charge => {
    const filteredCharge = { ...charge };
    let amount;
    if (charge.amount) {
      amount = charge.amount;
    } else if (charge.relativeAmountsByLeaseTerm) {
      const relativeAmountByLeaseTerm = charge.relativeAmountsByLeaseTerm.find(ra => ra.leaseTermId === termId && ra.selected);
      if (relativeAmountByLeaseTerm) {
        amount = relativeAmountByLeaseTerm.amount;
      }
    } else {
      amount = charge.amount;
    }

    if (parseFloat(amount, 10) >= 0) {
      filteredCharge.amount = formatAmount ? formatToMoneyString(amount) : amount;
      filteredCharges.push(filteredCharge);
    }
  });
  return filteredCharges;
};

export const flattenedPaymentSchedule = (leaseTerms, leaseStartDate, highValueAmenities, otherAmenities, additionalAndOneTimeCharges) => {
  let paymentsArray = [];
  const { additionalCharges, oneTimeCharges } = additionalAndOneTimeCharges;
  return leaseTerms.reduce((paymentResult, term) => {
    const termLength = termText(term);
    const period = getAdjFormOfPeriod(term);
    const additionalChargesTitle = t('DETAILS_PERIOD_CHARGES', { period });
    const title = t('PAYMENT_SCHEDULE_CARD_TITLE', { length: termLength });
    const caption = t('DETAILED_CHARGES_EXCLUDING_ONE_TIME');
    const fromTag = t('FROM');
    const baseRent = {
      title: t('BASE_RENT'),
      formattedAmount: formatToMoneyString(term.adjustedMarketRent),
    };
    const formattedTotalCharges = formatToMoneyString(term.totalMonthlyCharges);
    const termConcessions = term.chargeConcessions ? [...term.concessions, ...term.chargeConcessions] : term.concessions;
    const formattedTotalConcessions = formatToMoneyString(getTotalConcessions(termConcessions));
    const totalCharges = {
      title: `${period} ${t('TOTAL')}`,
      formattedAmount: formattedTotalCharges,
    };
    const totalConcessions = {
      title: t('TOTAL'),
      formattedAmount: formattedTotalConcessions,
    };
    const concessions = {
      title: t('SPECIALS_FULL_TERM_LENGTH'),
      info: flattenedConcessionsInfo(term, termConcessions),
    };
    const periodPaymentDetails = getPeriodPaymentDetails(term.paymentSchedule);

    const termPaymentSummary = {
      title,
      caption,
      periodPaymentDetails,
      oneTimeCharges: flattenedChargeInfo(oneTimeCharges, term.id),
      formattedAdditionalCharges: flattenedChargeInfo(additionalCharges, term.id),
      additionalChargesTitle,
      baseRent,
      totalCharges,
      concessions,
      totalConcessions,
      fromTag,
    };
    paymentsArray.push(termPaymentSummary);
    let payment = {};
    const isLastTerm = leaseTerms.lastIndexOf(term) === leaseTerms.length - 1;
    const isOddTerm = !!(leaseTerms.length % 2);

    if (paymentsArray.length === 2) {
      payment = { termPayments: paymentsArray };
      paymentsArray = [];
    }

    if (isOddTerm && isLastTerm) {
      payment = {
        termPayments: {
          termPaymentSummary,
          isLast: true,
          highValueAmenities,
          otherAmenities,
        },
      };
    }

    paymentResult.push(payment);
    return paymentResult;
  }, []);
};

export const calculateMonthlyAmountToPayPerFee = (feeAmount, billableDays, daysInMonth) => getFixedAmount((feeAmount / daysInMonth) * billableDays, 2);

const getFeeAmountByPeriodWithoutConcessions = (fee, paymentsForPeriods) => {
  const feeAmountForPeriods = paymentsForPeriods.reduce((acc, current) => {
    const amount = calculateMonthlyAmountToPayPerFee(Math.abs(fee.amount), current.billableDays, current.daysInMonth);
    return amount
      ? [
          ...acc,
          {
            amount,
            pendingConcessionAmount: 0,
            remainingConcessionAmount: 0,
            savedAmount: 0,
            billableDays: current.billableDays,
            daysInMonth: current.daysInMonth,
          },
        ]
      : [];
  }, []);

  return feeAmountForPeriods || [];
};

const isNonRecurringConcession = concession => !concession.recurring && !concession.recurringCount;

const addConcessionToAppliedConcessions = (paymentForPeriod, appliedConcession) => {
  const appliedConcessionIndex = paymentForPeriod.appliedConcessions.findIndex(ac => ac.concessionId === appliedConcession.concessionId);
  if (appliedConcessionIndex > -1) {
    paymentForPeriod.appliedConcessions[appliedConcessionIndex].amount += appliedConcession.amount;
  } else {
    paymentForPeriod.appliedConcessions.push(appliedConcession);
  }
};

const getConcessionToApply = (paymentForPeriodAmount, concession) => {
  let appliedConcession;
  if (paymentForPeriodAmount >= concession.amount) {
    appliedConcession = { ...concession };
    paymentForPeriodAmount -= concession.amount;
    concession.amount = 0;
  } else {
    appliedConcession = {
      concessionId: concession.concessionId,
      amount: paymentForPeriodAmount,
    };
    concession.amount -= paymentForPeriodAmount;
    paymentForPeriodAmount = 0;
  }
  return appliedConcession;
};

const addRemainingConcessionsToAppliedConcessions = (
  remainingAndPendingConcessions,
  paymentForPeriod,
  pendingApplicableConcessionAmount,
  remainingPaymentAmount,
) => {
  if (!remainingAndPendingConcessions || !remainingAndPendingConcessions.remainingConcessions || !remainingAndPendingConcessions.remainingConcessions.length) {
    return remainingPaymentAmount;
  }

  remainingAndPendingConcessions.remainingConcessions.forEach(remainingConcession => {
    if (remainingPaymentAmount > 0 && remainingConcession.amount !== 0) {
      const appliedConcession = getConcessionToApply(remainingPaymentAmount, remainingConcession);
      addConcessionToAppliedConcessions(paymentForPeriod, appliedConcession);

      if (pendingApplicableConcessionAmount) {
        pendingApplicableConcessionAmount -= appliedConcession.amount;
      }
    }
  });
  return remainingPaymentAmount;
};

const addPendingConcessionsToAppliedConcessions = (remainingAndPendingConcessions, paymentForPeriod, pendingApplicableConcessionAmount, periodAmount) => {
  const paymentForPeriodAmount = periodAmount || paymentForPeriod.amount;
  if (!remainingAndPendingConcessions || !remainingAndPendingConcessions.pendingConcessions || !remainingAndPendingConcessions.pendingConcessions.length) {
    return paymentForPeriodAmount;
  }
  const pendingConcessions = remainingAndPendingConcessions.pendingConcessions.reduce((acc, current) => {
    if (paymentForPeriodAmount > 0 && current.amount !== 0) {
      const appliedConcession = getConcessionToApply(paymentForPeriodAmount, current);
      addConcessionToAppliedConcessions(paymentForPeriod, appliedConcession);

      if (pendingApplicableConcessionAmount) {
        pendingApplicableConcessionAmount -= appliedConcession.amount;
      }
    }

    if (current.amount > 0) acc.push(current);
    return acc;
  }, []);

  remainingAndPendingConcessions.pendingConcessions = pendingConcessions;
  return paymentForPeriodAmount;
};

const setAmountToPeriodByPendingAmount = (paymentsForPeriod, pendingAmount) => {
  if (paymentsForPeriod.amount <= pendingAmount) {
    const remainingPendingAmount = pendingAmount - paymentsForPeriod.amount;
    paymentsForPeriod.amount = 0;
    return remainingPendingAmount;
  }
  paymentsForPeriod.amount -= pendingAmount;
  return 0;
};

const applyPendingConcessionAmountToPeriods = (paymentsForPeriods, pendingAmount, periodIndex, stopIndex, remainingAndPendingConcessions) => {
  let pendingConcessionAmount = true;
  let remainingPendingAmount = pendingAmount;
  while (pendingConcessionAmount) {
    const paymentsForPeriod = paymentsForPeriods[periodIndex];

    if (paymentsForPeriod.amount > 0) {
      if (!paymentsForPeriod.appliedConcessions) {
        paymentsForPeriod.appliedConcessions = [];
      }

      let paymentForPeriodAmount = paymentsForPeriod.amount;
      paymentForPeriodAmount = addPendingConcessionsToAppliedConcessions(
        remainingAndPendingConcessions,
        paymentsForPeriods[periodIndex],
        null,
        paymentForPeriodAmount,
      );

      if (paymentForPeriodAmount > 0) {
        addRemainingConcessionsToAppliedConcessions(remainingAndPendingConcessions, paymentsForPeriod, null, paymentForPeriodAmount);
      }

      remainingPendingAmount = setAmountToPeriodByPendingAmount(paymentsForPeriod, remainingPendingAmount);
    }
    periodIndex = stopIndex === 0 ? (periodIndex -= 1) : (periodIndex += 1);

    if (remainingPendingAmount <= 0 || periodIndex < 0 || periodIndex === paymentsForPeriods.length) {
      pendingConcessionAmount = false;
    }
  }
  return paymentsForPeriods;
};

const isAnApplicableConcession = (concessionIndex, concessionRecurringCount, applyRemainingConcession) =>
  concessionIndex < concessionRecurringCount || applyRemainingConcession;

const existPendingConcessionAmount = payment => payment.pendingConcessionAmount > 0 || payment.remainingConcessionAmount > 0;

const removePendingConcessionAmounts = payment => {
  payment.pendingConcessionAmount = 0;
  payment.remainingConcessionAmount = 0;
  return payment;
};

const getConcessionAmount = (feeAmount, concession) => {
  if (concession.variableAdjustment) {
    // Is a variableAdjustment
    return Math.abs(concession.amountVariableAdjustment);
  }
  if (Math.abs(concession.absoluteAdjustment) !== 0) {
    // Is an absoluteAdjustment
    return Math.abs(concession.absoluteAdjustment);
  }
  return getFixedAmount(feeAmount * Math.abs(concession.relativeAdjustment / 100), 2); // Is a relativeAdjustment
};

const calculateRelativeAdjustmentPerMonthlyPeriod = (amountPerPeriod, concession, period) => {
  if (!concession.recurring) {
    // Is a non-recurring concession, so we dont prorate
    const relativeAdjustment = getFixedAmount(Math.abs(concession.relativeAdjustment / 100) * amountPerPeriod, 2);

    return relativeAdjustment >= period.amount ? getFixedAmount(period.amount, 2) : relativeAdjustment;
  }

  // Is a recurring concession
  const proratedAmount = (amountPerPeriod / period.daysInMonth) * period.billableDays;
  return getFixedAmount(Math.abs(concession.relativeAdjustment / 100) * proratedAmount, 2);
};

export const calculateAbsoluteAdjustmentPerMonthlyPeriod = (absoluteAdjustment, period, isRecurring) => {
  if (!isRecurring) {
    // Is a non-recurring concession, so we dont prorate
    const positiveAbsoluteAdjustment = getFixedAmount(Math.abs(absoluteAdjustment), 2);
    return absoluteAdjustment >= period.amount ? period.amount : positiveAbsoluteAdjustment;
  }

  // Is a recurring concession
  return getFixedAmount((Math.abs(absoluteAdjustment) / period.daysInMonth) * period.billableDays, 2);
};

const getApplicableConcessionAmount = (amountPerPeriod, concession, period) => {
  let applicableConcessionAmount = 0;
  if (concession.variableAdjustment) {
    applicableConcessionAmount = calculateAbsoluteAdjustmentPerMonthlyPeriod(concession.amountVariableAdjustment, period, concession.recurring);
  } else if (Math.abs(concession.absoluteAdjustment) !== 0) {
    applicableConcessionAmount = calculateAbsoluteAdjustmentPerMonthlyPeriod(concession.absoluteAdjustment, period, concession.recurring);
  } else {
    applicableConcessionAmount = calculateRelativeAdjustmentPerMonthlyPeriod(amountPerPeriod, concession, period);
  }
  return applicableConcessionAmount > amountPerPeriod ? amountPerPeriod : applicableConcessionAmount;
};

const updatePaymentAmountsForPeriod = (totalConcessionAmount, paymentForPeriod) => {
  if (totalConcessionAmount > paymentForPeriod.amount) {
    paymentForPeriod.pendingConcessionAmount = totalConcessionAmount - paymentForPeriod.amount;
    paymentForPeriod.savedAmount = paymentForPeriod.amount;
    paymentForPeriod.amount = 0;
  } else {
    paymentForPeriod.amount -= totalConcessionAmount;
    paymentForPeriod.savedAmount = totalConcessionAmount;
    paymentForPeriod.pendingConcessionAmount = 0;
    paymentForPeriod.amount = getFixedAmount(paymentForPeriod.amount, 2);
  }
};

const updateRemainingAndPendingConcessions = ({ pendingConcessionAmount, remainingConcessionAmount, remainingAndPendingConcessions, concession }) => {
  if (pendingConcessionAmount > 0) {
    if (!remainingAndPendingConcessions.pendingConcessions) {
      remainingAndPendingConcessions.pendingConcessions = [];
    }
    remainingAndPendingConcessions.pendingConcessions.push({
      concessionId: concession.id,
      amount: pendingConcessionAmount,
    });
  }

  if (remainingConcessionAmount > 0) {
    if (!remainingAndPendingConcessions.remainingConcessions) {
      remainingAndPendingConcessions.remainingConcessions = [];
    }
    remainingAndPendingConcessions.remainingConcessions.push({
      concessionId: concession.id,
      amount: remainingConcessionAmount,
    });
  }
};

const applyAdjustmentOfConcessionToFeeAmount = (feeAmount, concession, paymentForPeriod, applyRemainingConcession, remainingAndPendingConcessions) => {
  const concessionAmount = !applyRemainingConcession ? getConcessionAmount(feeAmount, concession) : 0;
  const applicableConcessionAmount = !applyRemainingConcession ? getApplicableConcessionAmount(feeAmount, concession, paymentForPeriod) : 0;
  const remainingConcessionAmount = !applyRemainingConcession ? getFixedAmount(concessionAmount - applicableConcessionAmount, 2) : 0;
  const pendingConcessionAmount = isNonRecurringConcession(concession)
    ? concessionAmount - applicableConcessionAmount
    : applicableConcessionAmount - paymentForPeriod.amount;

  if (!paymentForPeriod.appliedConcessions) {
    paymentForPeriod.appliedConcessions = [];
  }

  const pendingApplicableConcessionAmount = paymentForPeriod.amount;
  addPendingConcessionsToAppliedConcessions(remainingAndPendingConcessions, paymentForPeriod, pendingApplicableConcessionAmount);

  let totalConcessionAmount = paymentForPeriod.pendingConcessionAmount + applicableConcessionAmount;

  if (applyRemainingConcession) {
    const remainingPaymentAmount = paymentForPeriod.amount - totalConcessionAmount;

    if ((isNonRecurringConcession(concession) ? totalConcessionAmount : remainingPaymentAmount) > 0) {
      addRemainingConcessionsToAppliedConcessions(remainingAndPendingConcessions, paymentForPeriod, pendingApplicableConcessionAmount, remainingPaymentAmount);
    }

    totalConcessionAmount += paymentForPeriod.remainingConcessionAmount;
    paymentForPeriod.remainingConcessionAmount = 0;
  }
  updatePaymentAmountsForPeriod(totalConcessionAmount, paymentForPeriod);

  paymentForPeriod.remainingConcessionAmount += remainingConcessionAmount;

  updateRemainingAndPendingConcessions({ pendingConcessionAmount, remainingConcessionAmount, remainingAndPendingConcessions, concession });

  if (pendingApplicableConcessionAmount > 0 && applicableConcessionAmount > 0) {
    const amount = pendingApplicableConcessionAmount > applicableConcessionAmount ? applicableConcessionAmount : pendingApplicableConcessionAmount;
    addConcessionToAppliedConcessions(paymentForPeriod, {
      concessionId: concession.id,
      amount,
    });
  }

  return paymentForPeriod;
};

const applyConcessionToEndOfMonthPeriod = (feeAmount, concession, paymentsForPeriods, concessionRecurringCount) => {
  let concessionIndex = 0;
  let pendingAmount = 0;
  let applyRemainingConcession = false;
  const periodsLength = paymentsForPeriods.length;
  let periodIndex = periodsLength - 1;
  let isApplicableConcession = true;
  const remainingAndPendingConcessions = {
    remainingConcessions: [],
    pendingConcessions: [],
  };

  while (periodIndex >= 0 && isApplicableConcession) {
    let payment = applyAdjustmentOfConcessionToFeeAmount(
      feeAmount,
      concession,
      paymentsForPeriods[periodIndex],
      applyRemainingConcession,
      remainingAndPendingConcessions,
    );

    if (existPendingConcessionAmount(payment)) {
      if (periodIndex - 1 >= 0) {
        paymentsForPeriods[periodIndex - 1].pendingConcessionAmount = payment.pendingConcessionAmount;
        paymentsForPeriods[periodIndex - 1].remainingConcessionAmount = payment.remainingConcessionAmount;
      } else {
        pendingAmount = payment.pendingConcessionAmount + payment.remainingConcessionAmount;
      }
      payment = removePendingConcessionAmounts(payment);
    }

    paymentsForPeriods[periodIndex] = payment;
    periodIndex -= 1;
    concessionIndex += 1;
    applyRemainingConcession = concessionIndex >= concessionRecurringCount;
    isApplicableConcession = isAnApplicableConcession(concessionIndex, concessionRecurringCount, applyRemainingConcession);
  }

  if (pendingAmount > 0) {
    return applyPendingConcessionAmountToPeriods(paymentsForPeriods, pendingAmount, 0, paymentsForPeriods.length - 1);
  }
  return paymentsForPeriods;
};

const applyConcessionToMonthPeriodConsecutively = (periodIndex, feeAmount, concession, paymentsForPeriods, concessionRecurringCount) => {
  let concessionIndex = 0;
  let pendingAmount = 0;
  let applyRemainingConcession = false;
  const periodsLength = paymentsForPeriods.length;
  let isApplicableConcession = true;
  const remainingAndPendingConcessions = {
    remainingConcessions: [],
    pendingConcessions: [],
  };

  while (periodIndex < periodsLength && isApplicableConcession) {
    let payment = applyAdjustmentOfConcessionToFeeAmount(
      feeAmount,
      concession,
      paymentsForPeriods[periodIndex],
      applyRemainingConcession,
      remainingAndPendingConcessions,
    );

    if (existPendingConcessionAmount(payment)) {
      if (periodIndex + 1 < periodsLength) {
        paymentsForPeriods[periodIndex + 1].pendingConcessionAmount = payment.pendingConcessionAmount;
        paymentsForPeriods[periodIndex + 1].remainingConcessionAmount = payment.remainingConcessionAmount;
      } else {
        pendingAmount = payment.pendingConcessionAmount + payment.remainingConcessionAmount;
      }
      payment = removePendingConcessionAmounts(payment);
    }

    paymentsForPeriods[periodIndex] = payment;
    periodIndex += 1;
    concessionIndex += 1;
    applyRemainingConcession = concessionIndex >= concessionRecurringCount;
    isApplicableConcession = isAnApplicableConcession(concessionIndex, concessionRecurringCount, applyRemainingConcession);
  }

  if (pendingAmount > 0 && !isNonRecurringConcession(concession)) {
    return applyPendingConcessionAmountToPeriods(paymentsForPeriods, pendingAmount, paymentsForPeriods.length - 1, 0, remainingAndPendingConcessions);
  }
  return paymentsForPeriods;
};

const applyConcessionToBeginingOfMonthPeriod = (feeAmount, concession, paymentsForPeriods, concessionRecurringCount) => {
  const applyConcessionToFirstPeriod = 0;
  return applyConcessionToMonthPeriodConsecutively(applyConcessionToFirstPeriod, feeAmount, concession, paymentsForPeriods, concessionRecurringCount);
};

const isFirstDayOfMonth = (leaseStartDate, timezone) => toMoment(leaseStartDate, { timezone }).date() === 1;

const isFullMonthPeriod = period => period.billableDays === period.daysInMonth;
const shouldApplyConcessionToSecondPeriod = (periodToApplyConcessionTo, secondPeriod) => periodToApplyConcessionTo === secondPeriod;
const isOnePeriodPayment = paymentsForPeriods => paymentsForPeriods.length < 2;

const applyConcessionToFirstFullMonthPeriod = (feeAmount, concession, paymentsForPeriods, concessionRecurringCount, leaseStartDate, timezone) => {
  const firstPeriod = 0;
  const secondPeriod = 1;
  const periodToApplyConcessionTo = isFirstDayOfMonth(leaseStartDate, timezone) ? firstPeriod : secondPeriod;

  if (
    shouldApplyConcessionToSecondPeriod(periodToApplyConcessionTo, secondPeriod) &&
    (isOnePeriodPayment(paymentsForPeriods) || !isFullMonthPeriod(paymentsForPeriods[secondPeriod]))
  ) {
    return paymentsForPeriods;
  }

  return applyConcessionToMonthPeriodConsecutively(periodToApplyConcessionTo, feeAmount, concession, paymentsForPeriods, concessionRecurringCount);
};

const applyConcessionToMonthPeriod = (nonRecurringAppliedAt, data) => {
  switch (nonRecurringAppliedAt) {
    case DALTypes.NonRecurringApplied.LAST:
      return applyConcessionToEndOfMonthPeriod(...data);
    case DALTypes.NonRecurringApplied.FIRST_FULL:
      return applyConcessionToFirstFullMonthPeriod(...data);
    case DALTypes.NonRecurringApplied.FIRST:
      return applyConcessionToBeginingOfMonthPeriod(...data);
    default:
      return applyConcessionToBeginingOfMonthPeriod(...data);
  }
};

const getConcessionMonthsLimit = (concession, termLength) => {
  if (isNonRecurringConcession(concession)) return 1;
  // recurring = true
  // TODO: Update === 0 to === null, the concession will be applied to the whole lease term length
  return concession.recurringCount === 0 ? termLength : concession.recurringCount;
};

export const applyMonthlyConcessions = (feeAmount, concessions, termLength, paymentsForPeriods, leaseStartDate, timezone) => {
  if (concessions && concessions.length > 0) {
    concessions.forEach(concession => {
      const isValidConcession = concession.selected && !concession.excludeFromRentFlag && !concession.bakedIntoAppliedFeeFlag;
      if (isValidConcession) {
        const limitMonths = getConcessionMonthsLimit(concession, termLength);

        paymentsForPeriods = applyConcessionToMonthPeriod(concession.nonRecurringAppliedAt, [
          feeAmount,
          concession,
          paymentsForPeriods,
          limitMonths,
          leaseStartDate,
          timezone,
        ]);
      }
    });
  }
  return paymentsForPeriods;
};

const calculateFeeAmountByPeriod = ({ fee, paymentsForPeriods, termLength, leaseStartDate, timezone }) => {
  let feeAmountForPeriods = [];
  if (fee.selected && fee.concessions) {
    feeAmountForPeriods = getFeeAmountByPeriodWithoutConcessions(fee, paymentsForPeriods);
    feeAmountForPeriods = applyMonthlyConcessions(fee.price, fee.concessions, termLength, feeAmountForPeriods, leaseStartDate, timezone);
  }
  return feeAmountForPeriods;
};

export const shouldApplyFeeToPaymentSchedule = fee => fee.quotePaymentScheduleFlag;

export const getSelectedFeesMonthlyAmount = (additionalCharges, payment, periodIndex, feesWithAmountConcessions) => {
  let additionalChargeAmount = 0;
  const { fees = [] } = additionalCharges;

  fees.forEach(fee => {
    if (fee.selected && shouldApplyFeeToPaymentSchedule(fee)) {
      const feeAmountWithoutConcession = calculateMonthlyAmountToPayPerFee(Math.abs(fee.amount), payment.billableDays, payment.daysInMonth);
      let finalFeeAmount = feeAmountWithoutConcession;
      if (fee.concessions && fee.concessions.length > 0) {
        const feeWithAmounts = feesWithAmountConcessions.find(f => f.feeId === fee.id);
        if (feeWithAmounts.amountsByPeriod && feeWithAmounts.amountsByPeriod.length > 0) {
          finalFeeAmount = feeWithAmounts.amountsByPeriod[periodIndex].amount;
        }
      }
      additionalChargeAmount += finalFeeAmount;
    }
  });
  return additionalChargeAmount;
};

export const applyMonthlyAdditonalCharges = (additionalCharges, paymentsForPeriods, termLength, leaseStartDate, timezone) => {
  let feesWithAmountConcessions = [];
  if (additionalCharges && additionalCharges.fees) {
    feesWithAmountConcessions = additionalCharges.fees.map(fee => {
      const savedAmountByPeriod = calculateFeeAmountByPeriod({ fee, paymentsForPeriods, termLength, leaseStartDate, timezone });
      return { feeId: fee.id, amountsByPeriod: savedAmountByPeriod };
    });
  }

  paymentsForPeriods.map((payment, index) => {
    payment.amount += getSelectedFeesMonthlyAmount(additionalCharges, payment, index, feesWithAmountConcessions);
    return payment;
  });
  return paymentsForPeriods;
};

export const getFormatedTimeframeDate = (timeframe, period) => {
  switch (period) {
    case DALTypes.LeasePeriod.MONTH:
      return timeframe.format(MONTH_YEAR_FORMAT);
    case DALTypes.LeasePeriod.HOUR:
      return timeframe.format(MONTH_DATE_YEAR_HOUR_FORMAT);
    default:
      return timeframe.format(MONTH_DATE_YEAR_FORMAT);
  }
};

export const calculateMonthlyBasePaymentPerPeriod = (leaseTerm, leaseStartDate, periodIndex, numMonthsInLease, prorationStrategy, timezone) => {
  const { endDate, period } = leaseTerm;

  const periodDate = toMoment(leaseStartDate, { timezone }).add(periodIndex, period);
  let periodBillableDays = {};

  const payment = {
    timeframe: getFormatedTimeframeDate(periodDate, period),
    pendingConcessionAmount: 0,
    remainingConcessionAmount: 0,
  };

  if (periodIndex === 0) {
    // it's the first month
    periodBillableDays = getBillableDaysPerPeriod(leaseStartDate, { isMoveInMonth: true, prorationStrategy, timezone });
    payment.billableDays = periodBillableDays.billableDays;
    payment.daysInMonth = periodBillableDays.daysInMonth;
  } else if (periodIndex === numMonthsInLease - 1) {
    // it's the last month
    periodBillableDays = getBillableDaysPerPeriod(endDate, { isMoveInMonth: false, prorationStrategy, timezone });
    payment.billableDays = periodBillableDays.billableDays;
    payment.daysInMonth = periodBillableDays.daysInMonth;
  } else {
    payment.daysInMonth = toMoment(periodDate, { timezone }).daysInMonth();
    if (prorationStrategy === PS_30_DAY_MONTH) {
      payment.daysInMonth = MONTH_30;
    }
    payment.billableDays = payment.daysInMonth;
  }
  const { adjustedMarketRent, overwrittenBaseRent } = leaseTerm;
  payment.amount = calculateMonthlyAmountToPayPerFee(overwrittenBaseRent || adjustedMarketRent, payment.billableDays, payment.daysInMonth);
  return payment;
};

export const getMoveInOutDateDay = (startDate, timezone) => {
  if (startDate) {
    const moveInDate = toMoment(startDate, { timezone }).clone().startOf('day');
    return moveInDate.date();
  }
  throw new Error('Missing Date');
};

/*
 * If leaseStartDate is the first day of the month, the number of periods is
 * leaseTerm.termLength, otherwise is leaseTerm.termLength + 1
 * e.g. 6 month period >>> leaseStartDate Jan 1st ends on June 30th (6 months)
 * e.g. 6 month period >>> leaseStartDate Jan 15th ends on July 15th (7 months)
 */
export const getNumberOfMonthsInLeaseTerm = (leaseTerm, leaseStartDate, timezone) => {
  const moveInDay = getMoveInOutDateDay(leaseStartDate, timezone);
  return moveInDay === 1 ? leaseTerm.termLength : leaseTerm.termLength + 1;
};

export const getMonthlyBasePayments = (leaseTerm, leaseStartDate, prorationStrategy, timezone) => {
  const numMonthsInLease = getNumberOfMonthsInLeaseTerm(leaseTerm, leaseStartDate, timezone);
  const paymentsForPeriods = [];
  for (let periodIndex = 0; periodIndex < numMonthsInLease; periodIndex++) {
    const payment = calculateMonthlyBasePaymentPerPeriod(leaseTerm, leaseStartDate, periodIndex, numMonthsInLease, prorationStrategy, timezone);
    paymentsForPeriods.push(payment);
  }
  return paymentsForPeriods;
};

export const getAdjustmentForConcession = (leaseTerm, concession) => {
  if (concession.variableAdjustment) {
    return concession.amountVariableAdjustment;
  }
  if (concession.absoluteAdjustment && Math.abs(concession.absoluteAdjustment) !== 0) {
    return Math.abs(concession.absoluteAdjustment);
  }
  if (concession.relativeAdjustment) {
    if (!leaseTerm.adjustedMarketRent) {
      throw new Error('Cannot getAdjustmentForConcession of undefined adjustedMarketRent');
    }
    return Math.abs(concession.relativeAdjustment / 100) * leaseTerm.adjustedMarketRent;
  }
  return 0;
};

const applyConcessionToPayment = (leaseTerm, concession, paymentForPeriod) => {
  const adjustmentPerPeriod = getAdjustmentForConcession(leaseTerm, concession);
  return {
    timeframe: paymentForPeriod.timeframe,
    savedAmount: adjustmentPerPeriod,
    amount: paymentForPeriod.amount - adjustmentPerPeriod,
  };
};

// Applies the given concession when property nonRecurringAppliedAt = last
const applyConcessionToEndOfPeriod = (leaseTerm, concession, paymentsForPeriods, maxPeriods) => {
  let periodIndex = paymentsForPeriods.length - 1;
  while (periodIndex >= 0 && maxPeriods > 0) {
    paymentsForPeriods[periodIndex] = applyConcessionToPayment(leaseTerm, concession, paymentsForPeriods[periodIndex]);
    periodIndex -= 1;
    maxPeriods -= 1;
  }
  return paymentsForPeriods;
};

// Applies the given concession when property nonRecurringAppliedAt = first
const applyConcessionToBeginingOfPeriod = (leaseTerm, concession, paymentsForPeriods, maxPeriods) => {
  let periodIndex = 0;
  while (periodIndex < paymentsForPeriods.length && periodIndex < maxPeriods) {
    paymentsForPeriods[periodIndex] = applyConcessionToPayment(leaseTerm, concession, paymentsForPeriods[periodIndex]);
    periodIndex += 1;
  }
  return paymentsForPeriods;
};

const applyAdjustmentOfConcessionToPeriod = (leaseTerm, concession, paymentsForPeriods, maxPeriods) => {
  if (maxPeriods > 0) {
    if (concession.nonRecurringAppliedAt === DALTypes.NonRecurringApplied.LAST) {
      return applyConcessionToEndOfPeriod(leaseTerm, concession, paymentsForPeriods, maxPeriods);
    }
    return applyConcessionToBeginingOfPeriod(leaseTerm, concession, paymentsForPeriods, maxPeriods);
  }
  // applicable to all periods
  paymentsForPeriods.forEach(payment => {
    const tmpPayment = applyConcessionToPayment(leaseTerm, concession, payment);
    payment.savedAmount = tmpPayment.savedAmount;
    payment.amount = tmpPayment.amount;
  });

  return paymentsForPeriods;
};

export const applyConcessionsToPeriod = (leaseTerm, paymentsForPeriods) => {
  leaseTerm.concessions.forEach(concession => {
    if (concession.selected && !concession.excludeFromRentFlag) {
      let maxPeriods = 0;
      if (!concession.recurring && concession.recurringCount === 0) {
        maxPeriods = 1;
      } else if (concession.recurring) {
        maxPeriods = concession.recurringCount === 0 ? 0 : concession.recurringCount;
      }
      paymentsForPeriods = applyAdjustmentOfConcessionToPeriod(leaseTerm, concession, paymentsForPeriods, maxPeriods);
    }
  });
  return paymentsForPeriods;
};

/*
 * Returns time and amount base on the given period (week / day / hour)
 * E.g if leaseStartDate = Sep 15, 2016
 * LeaseTerm.termLength 4, Period week, adjustedMarketRent 1000, periodIndex 0
 * >>>  { timeframe: Sep 15, 2016 - Sep 21, 2016, amount: 1000 } // 7 days - 1 week
 * LeaseTerm.termLength 4, Period week, adjustedMarketRent 1000, periodIndex 3
 * >>>  { timeframe: Oct 6 2016 - Oct 12, 2016, amount: 466.66 } // 7 days - 1 week
 * LeaseTerm.termLength 12, Period day, adjustedMarketRent 52.00, periodIndex 0
 * >>> { timeframe: Sep 15, 2016 , amount: 52.00 } //  1 day
 * LeaseTerm.termLength 12, Period day, adjustedMarketRent 52.00, periodIndex 11
 * >>> { timeframe: Sep 26, 2016 , amount: 52.00 } //  1 day
 * LeaseTerm.termLength 18, Period hour, adjustedMarketRent 12.50, periodIndex 0
 * >>> { timeframe: Sep 15 2016, 12:00 am, amount: 12.50} //  1 hour
 */
export const calculateTimeAndAmountOfPeriod = (leaseTerm, leaseStartDate, periodIndex, timezone) => {
  if (!leaseTerm.adjustedMarketRent) {
    throw new Error('Cannot calculateTimeAndAmountOfPeriod of undefined adjustedMarketRent');
  }
  if (!leaseTerm.period) {
    throw new Error('Cannot calculateTimeAndAmountOfPeriod of undefined period');
  }

  const leaseEndDate = toMoment(leaseStartDate, { timezone }).add(periodIndex, leaseTerm.period);

  let formatedTimeframe = getFormatedTimeframeDate(leaseEndDate, leaseTerm.period);
  if (leaseTerm.period === DALTypes.LeasePeriod.WEEK) {
    const timeframeStart = getFormatedTimeframeDate(leaseEndDate, leaseTerm.period);
    let timeframeEnd = toMoment(leaseEndDate, { timezone }).add(6, 'days');
    timeframeEnd = getFormatedTimeframeDate(timeframeEnd, leaseTerm.period);
    formatedTimeframe = `${timeframeStart} - ${timeframeEnd}`;
  }
  return {
    timeframe: formatedTimeframe,
    amount: leaseTerm.adjustedMarketRent,
  };
};

export const getBasePaymentForEachPeriod = (leaseTerm, leaseStartDate, timezone) => {
  const basePaymentForPeriods = [];
  for (let index = 0; index < leaseTerm.termLength; index++) {
    const payment = calculateTimeAndAmountOfPeriod(leaseTerm, leaseStartDate, index, timezone);
    basePaymentForPeriods.push(payment);
  }
  return basePaymentForPeriods;
};

const groupByPeriod = (dataToGroupOn, fieldNameToGroupOn, fieldNameForGroupName, fieldNameForChildren) => {
  const result = [];
  let currentValue = null;
  for (let i = 0; i < dataToGroupOn.length; i++) {
    const data = dataToGroupOn[i];
    if (data[fieldNameToGroupOn] !== currentValue) {
      currentValue = data[fieldNameToGroupOn];
      const group = {};
      group[fieldNameForGroupName] = currentValue;
      group[fieldNameForChildren] = [data];
      result.push(group);
    } else {
      result[result.length - 1][fieldNameForChildren].push(data);
    }
  }
  return result;
};

const groupPaymentsByUnchangedMonths = paymentData => groupByPeriod(paymentData, 'amount', 'amount', 'months');

export const getMonthlyPeriodsGroupsByAmount = paymentsForPeriods => {
  paymentsForPeriods = paymentsForPeriods.map(payment => ({
    ...payment,
    amount: payment.amount.toFixed(2),
  }));
  const paymentsGroups = groupPaymentsByUnchangedMonths(paymentsForPeriods);
  const groupedPayments = [];
  for (let i = 0; i < paymentsGroups.length; i++) {
    if (paymentsGroups[i].months.length === 1) {
      groupedPayments.push({
        timeframe: paymentsGroups[i].months[0].timeframe,
        amount: paymentsGroups[i].amount,
      });
    } else {
      const [startTimeframeMonth, startTimeframeYear] = paymentsGroups[i].months[0].timeframe.split(' ');
      const [endTimeframeMonth, endTimeframeYear] = paymentsGroups[i].months[paymentsGroups[i].months.length - 1].timeframe.split(' ');
      let timeframeText = '';

      if (startTimeframeYear === endTimeframeYear) {
        timeframeText = `${startTimeframeMonth} - ${endTimeframeMonth} ${startTimeframeYear}`;
      } else {
        timeframeText = `${startTimeframeMonth} ${startTimeframeYear} - ${endTimeframeMonth} ${endTimeframeYear}`;
      }

      groupedPayments.push({
        timeframe: timeframeText,
        amount: paymentsGroups[i].amount,
      });
    }
  }
  return groupedPayments;
};

export const getPeriodAmountsForLeaseTerm = ({ leaseTerm, leaseStartDate, additionalCharges, prorationStrategy, timezone }) => {
  if (!leaseTerm || !leaseStartDate) {
    return null;
  }

  if (leaseStartDate) {
    const { period, concessions, overwrittenBaseRent, adjustedMarketRent, termLength } = leaseTerm;
    if (period === DALTypes.LeasePeriod.MONTH) {
      const basePaymentForPeriods = getMonthlyBasePayments(leaseTerm, leaseStartDate, prorationStrategy, timezone);
      const basePaymentWithConcessionForPeriods = applyMonthlyConcessions(
        overwrittenBaseRent || adjustedMarketRent,
        concessions,
        termLength,
        basePaymentForPeriods,
        leaseStartDate,
        timezone,
      );
      const paymentsWithAdditionalCharges = applyMonthlyAdditonalCharges(
        additionalCharges,
        basePaymentWithConcessionForPeriods,
        termLength,
        leaseStartDate,
        timezone,
      );
      return getMonthlyPeriodsGroupsByAmount(paymentsWithAdditionalCharges);
    }
    // Applies to other periods week / day / hour
    const basePaymentForPeriods = getBasePaymentForEachPeriod(leaseTerm, leaseStartDate, timezone);
    const basePaymentWithConcessionForPeriod = applyConcessionsToPeriod(leaseTerm, basePaymentForPeriods);
    return basePaymentWithConcessionForPeriod;
  }
  return [];
};

/*
 * This function takes cares of adding the originalBaseRent and overwrittenBaseRent properties to each selectedLeaseTerm of the selections object,
 * only if the originalBaseRent exists, if this property exists it means that the adjustedMarketRent was modified by an agent for this quote.
 * This has to be done here because most of the 'quotes module' uses redux, so it cant be done with a mobx computed value.
 */
const setManuallyAdjustedBaseRentAmounts = (selectionsTerm, term) => {
  if (term.originalBaseRent) {
    selectionsTerm.originalBaseRent = term.originalBaseRent;
    selectionsTerm.overwrittenBaseRent = term.overwrittenBaseRent;
  }
};

export const getSelectionsLeaseTermsAndConcessions = (props = {}) => {
  const { selectedLeaseTermIds, leaseTerms, leaseStartDate, additionalAndOneTimeCharges, prorationStrategy, timezone } = props;

  if (!selectedLeaseTermIds.length) return { selectedLeaseTerms: [] };

  const selLeaseTerms = leaseTerms.filter(l => selectedLeaseTermIds.some(s => s === l.id));
  const additionalCharges = additionalAndOneTimeCharges.find(p => p.name === selLeaseTerms[0].period);

  const objSelections = {};
  objSelections.selectedLeaseTerms = [];
  selLeaseTerms.forEach(leaseTerm => {
    const term = {};
    term.id = leaseTerm.id;
    term.paymentSchedule = getPeriodAmountsForLeaseTerm({ leaseTerm, leaseStartDate, additionalCharges, prorationStrategy, timezone });
    term.concessions = [];

    setManuallyAdjustedBaseRentAmounts(term, leaseTerm);

    leaseTerm.concessions.forEach(c => {
      const concession = {};
      if (c.selected || !c.optional) {
        concession.id = c.id;
        concession.relativeAmount = c.relativeAmount;
        if (c.amountVariableAdjustment) {
          concession.amountVariableAdjustment = c.amountVariableAdjustment;
          concession.variableAmountUpdatedByAgent = c.variableAmountUpdatedByAgent;
        }
        term.concessions.push(concession);
      }
    });
    objSelections.selectedLeaseTerms.push(term);
  });
  return objSelections;
};

/*
 * Exported for testing purposes only
 */
export const getSelectedConcessionsFromFee = fee => {
  let selectedConcessions;
  if (fee.concessions) {
    selectedConcessions = fee.concessions.filter(concession => concession.selected);
  }
  return selectedConcessions;
};

export const getSelectedInventories = fee => {
  let selectedInventories;
  if (fee.selectedInventories && fee.selectedInventories.length) {
    selectedInventories = fee.selectedInventories;
  }
  return selectedInventories;
};

export const isUnitDepositFee = fee => fee.feeType === DALTypes.FeeType.DEPOSIT && fee.quoteSectionName === DALTypes.QuoteSection.DEPOSIT && fee.firstFee;

const addToRelativeAmountsByLeaseTerm = ({ currenRelativeAmountsByLeaseTerm = [], leaseTermId, amount, maxAmount }) => {
  const newRelativeAmountsByLeaseTerm = [...currenRelativeAmountsByLeaseTerm];
  newRelativeAmountsByLeaseTerm.push({ amount, maxAmount, leaseTermId, selected: true });
  return newRelativeAmountsByLeaseTerm;
};

const computeFeeAmountByLeaseTerm = ({ fee, leaseTerm, currenRelativeAmountsByLeaseTerm }) => {
  let regularAmount;
  let maxAmount;
  if (!nullish(fee.relativePrice)) {
    regularAmount = (parseFloat(leaseTerm.adjustedMarketRent) * parseFloat(fee.relativePrice)) / 100;
    maxAmount = (parseFloat(leaseTerm.adjustedMarketRent) * parseFloat(fee.relativePrice)) / 100;
  } else {
    regularAmount = parseFloat(fee.absolutePrice);
    maxAmount = parseFloat(fee.absolutePrice);
  }

  if (fee.priceFloorCeiling) {
    regularAmount = getPriceUsingFloorCeiling({
      floorCeilingFlag: fee.priceFloorCeiling,
      parentFeeAmount: leaseTerm.adjustedMarketRent,
      absolutePrice: fee.absolutePrice,
      relativePrice: fee.relativePrice,
    });
    maxAmount = regularAmount;
  }

  if (fee.variableAdjustment) {
    if (nullish(fee.relativeDefaultPrice) && nullish(fee.absoluteDefaultPrice)) {
      regularAmount = 0;
    } else {
      const relativeDefaultPriceValue = !nullish(fee.relativeDefaultPrice) && Math.abs(parseFloat(fee.relativeDefaultPrice));
      const absoluteDefaultPriceValue = !nullish(fee.absoluteDefaultPrice) && parseFloat(fee.absoluteDefaultPrice);
      const amountVariableAdjustment =
        relativeDefaultPriceValue && !nullish(leaseTerm.adjustedMarketRent)
          ? (parseFloat(leaseTerm.adjustedMarketRent) * relativeDefaultPriceValue) / 100
          : absoluteDefaultPriceValue;
      regularAmount = amountVariableAdjustment > regularAmount ? regularAmount : amountVariableAdjustment;
    }
  }

  return {
    relativeAmountsByLeaseTerm: addToRelativeAmountsByLeaseTerm({
      currenRelativeAmountsByLeaseTerm,
      leaseTermId: leaseTerm.id,
      amount: regularAmount,
      maxAmount,
    }),
  };
};

export const getFeeAmounts = (fee, selectedLeaseTermIds, isSelfServe, leaseTerms) => {
  const { variableAdjustment, parentFeeAmount, absoluteDefaultPrice, relativeDefaultPrice, relativePrice } = fee;
  // This means this a relative fee that depends upon base rent
  if (((!nullish(relativeDefaultPrice) && nullish(absoluteDefaultPrice)) || !nullish(relativePrice)) && !parentFeeAmount) {
    const selectedLeaseTerms = leaseTerms.filter(lt => selectedLeaseTermIds.some(sltid => lt.id === sltid));

    const newRelativeAmountsByLeaseTerm = selectedLeaseTerms.reduce((acc, slt) => {
      const { relativeAmountsByLeaseTerm } = computeFeeAmountByLeaseTerm({ fee, leaseTerm: slt, currenRelativeAmountsByLeaseTerm: acc });
      return relativeAmountsByLeaseTerm;
    }, []);

    return { relativeAmountsByLeaseTerm: newRelativeAmountsByLeaseTerm };
  }

  if (
    !isSelfServe ||
    !variableAdjustment ||
    (variableAdjustment && nullish(absoluteDefaultPrice) && (nullish(relativeDefaultPrice) || nullish(parentFeeAmount)))
  ) {
    return { amount: fee.amount, maxAmount: fee.absolutePrice, variableAdjustmentAmount: fee.variableAdjustmentAmount };
  }

  const defaultAmount = setDefaultVariableAmount(fee);
  const feeAmount = parseFloat(parseFloat(defaultAmount) < parseFloat(fee.amount) ? defaultAmount : fee.amount);
  const finalFeeAmount = feeAmount * fee.quantity;
  const maxAmount = finalFeeAmount > defaultAmount ? finalFeeAmount : defaultAmount;
  return { amount: finalFeeAmount, maxAmount, variableAdjustmentAmount: finalFeeAmount };
};

export const getFeesForSelectedTerm = (selectedLeaseTermIds, leaseTerms, additionalAndOneTimeCharges, isSelfServe) => {
  if (!selectedLeaseTermIds.length) return { fees: [] };
  const selectedTerm = leaseTerms.find(term => term.id === selectedLeaseTermIds[0]);
  const fees = additionalAndOneTimeCharges
    .find(period => period.name === selectedTerm.period)
    .fees.reduce((result, fee) => {
      if (fee.visible && fee.selected) {
        const { amount, variableAdjustmentAmount, relativeAmountsByLeaseTerm, maxAmount } = getFeeAmounts(fee, selectedLeaseTermIds, isSelfServe, leaseTerms);
        const selectedConcessions = getSelectedConcessionsFromFee(fee);
        const selectedInventories = getSelectedInventories(fee);
        result.push({
          id: fee.id,
          name: fee.name,
          quantity: fee.quantity,
          amount,
          maxAmount,
          estimated: fee.estimated,
          variableAdjustmentAmount,
          originalTotalAmount: fee.originalTotalAmount,
          relativeAmountsByLeaseTerm,
          isMinAndMaxRentEqual: fee.isMinAndMaxRentEqual,
          isIGFee: fee.isIGFee,
          isUnitDepositFee: isUnitDepositFee(fee),
          selectedConcessions,
          selectedInventories,
        });
      }
      return result;
    }, []);
  return { name: selectedTerm.period, fees };
};

const setFeeVisibleAndSelected = (fee, isVisible) => {
  const { selectedInventories, concessions } = fee;
  const feeUpdates = {};

  feeUpdates.selected = isVisible;
  if (selectedInventories && !isVisible) {
    feeUpdates.selectedInventories = [];
  }
  if (fee.concessions && !isVisible) {
    feeUpdates.concessions = concessions.map(concession => ({
      ...concession,
      selected: isVisible,
    }));
  }

  return { ...fee, ...feeUpdates };
};

const setChildrenFeeVisibleAndSelected = (fee, isVisible) => {
  const feeUpdates = {};

  feeUpdates.visible = isVisible;
  feeUpdates.selected = isVisible && fee.isAdditional;
  feeUpdates.quantity = isVisible ? fee.quantity : 1;

  if (fee.selectedInventories && !isVisible) {
    feeUpdates.selectedInventories = [];
  }

  return { ...fee, ...feeUpdates };
};

// set visible and selected properties for children fees which parents are selected before.
export const setVisibleAndSelected = (additionalOneTimeFees, periodName, isVisible, fee) => {
  let children = fee.children || [];
  const period = additionalOneTimeFees.find(p => p.name === periodName);
  const { fees: periodFees } = period;

  // get children fees - recursive method.
  if (!isVisible) {
    let firstChildren = children;
    do {
      firstChildren = firstChildren.reduce((result, feeChild) => {
        const hasChild = periodFees.find(pFee => pFee.id === feeChild);
        hasChild && hasChild.children && result.push(...hasChild.children);
        return result;
      }, []);
      children = children.concat(firstChildren);
    } while (firstChildren.length);
  }

  const updatedFeesForPeriod = periodFees.map(f => {
    if (f.id === fee.id) {
      return setFeeVisibleAndSelected(f, isVisible);
    }
    if (children.some(c => c === f.id)) {
      return setChildrenFeeVisibleAndSelected(f, isVisible);
    }
    return f;
  });

  return unionBy([{ ...period, fees: updatedFeesForPeriod }], additionalOneTimeFees, 'name');
};

// set parent quantity to its children fees and recalculate amount with it.
export const setQuantityAdditional = (additionalOneTimeFees, periodName, newQuantity, fee) => {
  const children = fee.children || [];
  return additionalOneTimeFees.map(period => {
    if (period.name === periodName) {
      const fees = period.fees.map(f => {
        if (f.id === fee.id) {
          f.quantity = newQuantity;
          f.amount = f.quantity * fee.price;
          f.variableAdjustmentAmount = f.quantity * fee.price;
          f.maxAmount = f.maxAmountPerItem * newQuantity;
        }
        if (children.some(c => c === f.id)) {
          if (f.isAdditional) {
            f.quantity = newQuantity;
            f.amount = f.quantity * f.price;
            f.maxAmount = f.maxAmountPerItem * newQuantity;
          }
        }
        return f;
      });
      period.fees = fees;
    }
    return period;
  });
};

const shouldSelectOrUnselectTheLeaseTermRelativeAmount = ({ selectedLeaseTerm, leaseTermId, relativeAmountByLeaseTerm, selectedFee, fee }) =>
  selectedLeaseTerm && selectedLeaseTerm.id === leaseTermId && relativeAmountByLeaseTerm && selectedFee.id === fee.id;

const shouldSelectOrUnselectAllTheLeaseTermsRelativeAmount = ({ relativeAmountByLeaseTerm, changeAll }) =>
  relativeAmountByLeaseTerm && typeof changeAll !== 'undefined';

const setSelectedRelativeAmount = selectionObject => {
  if (shouldSelectOrUnselectTheLeaseTermRelativeAmount(selectionObject)) {
    selectionObject.relativeAmountByLeaseTerm.selected = !selectionObject.relativeAmountByLeaseTerm.selected;
  } else if (shouldSelectOrUnselectAllTheLeaseTermsRelativeAmount(selectionObject)) {
    selectionObject.relativeAmountByLeaseTerm.selected = selectionObject.changeAll;
  }
};

const calculateRelativeAmount = (amount, baseRent, relativePrice) => (parseFloat(amount) >= 0 ? parseFloat(amount) : (baseRent * relativePrice) / 100);

const updateRelativeAmount = ({ relativeAmountsByLeaseTerm, leaseTermId, relativePrice, amount, baseRent }) => {
  relativeAmountsByLeaseTerm.forEach((relativeAmountByLeaseTerm, index) => {
    if (relativeAmountByLeaseTerm.leaseTermId === leaseTermId) {
      relativeAmountsByLeaseTerm[index].amount = calculateRelativeAmount(amount, baseRent, relativePrice);
    }
  });
};

const createRelativeAmount = ({ relativeAmountsByLeaseTerm, leaseTermId, relativePrice, isAdditional, amount, baseRent }) => {
  relativeAmountsByLeaseTerm.push({
    leaseTermId,
    amount: calculateRelativeAmount(amount, baseRent, relativePrice),
    selected: isAdditional,
  });
};

const createOrUpdateRelativeAmount = relativeAmountObject => {
  const relativeAmountByLeaseTerm = relativeAmountObject.relativeAmountsByLeaseTerm.find(ra => ra.leaseTermId === relativeAmountObject.leaseTermId);
  if (!relativeAmountByLeaseTerm) {
    createRelativeAmount(relativeAmountObject);
  } else {
    updateRelativeAmount(relativeAmountObject);
  }
  return relativeAmountByLeaseTerm;
};

const getOverwrittenBaseRentIfExists = (leaseTerms, selectedLeaseTermId) => {
  let overwrittenBaseRent;
  if (leaseTerms) {
    const leaseTerm = leaseTerms.find(lt => lt.id === selectedLeaseTermId);
    if (leaseTerm) {
      overwrittenBaseRent = leaseTerm.overwrittenBaseRent;
    }
  }
  return overwrittenBaseRent;
};

// Returns the selected lease term from one updated lease term list, in case that the baserent was altered, if not returns the one from the fee.
const getSelectedLeaseTerm = ({ feeLeaseTerms, updatedLeaseTerms, selectedLeaseTermId }) => {
  if (updatedLeaseTerms) {
    return updatedLeaseTerms.find(leaseTerm => leaseTerm.id === selectedLeaseTermId);
  }
  return feeLeaseTerms.find(leaseTerm => leaseTerm.id === selectedLeaseTermId);
};

export const setDepositsRelativeAmount = ({ additionalOneTimeFees, leaseTermsIds, selectedFee, selectedLeaseTerm, changeAll, updatedLeaseTerms, leaseTerms }) =>
  additionalOneTimeFees.map(periodFees => {
    periodFees.fees = periodFees.fees.map(fee => {
      if (fee.relativePrice && fee.leaseTerms) {
        if (!fee.relativeAmountsByLeaseTerm) {
          fee.relativeAmountsByLeaseTerm = [];
        }
        leaseTermsIds.forEach(selectedLeaseTermId => {
          // Case parent fee is feeType = IG and IG is inventoryType = unit, it has leaseTerms associated
          const leaseTerm = getSelectedLeaseTerm({
            feeLeaseTerms: fee.leaseTerms,
            updatedLeaseTerms,
            selectedLeaseTermId,
          });

          if (leaseTerm) {
            const overwrittenBaseRent = getOverwrittenBaseRentIfExists(leaseTerms, selectedLeaseTermId);
            const baseRent = overwrittenBaseRent || leaseTerm.adjustedMarketRent;

            const relativeAmountByLeaseTerm = createOrUpdateRelativeAmount({
              relativeAmountsByLeaseTerm: fee.relativeAmountsByLeaseTerm,
              leaseTermId: leaseTerm.id,
              amount: fee.amount,
              relativePrice: fee.relativePrice,
              isAdditional: fee.isAdditional,
              baseRent,
            });

            setSelectedRelativeAmount({
              selectedLeaseTerm, // This a specific selected lease term passed as a parameter when some event happens.
              leaseTermId: leaseTerm.id,
              relativeAmountByLeaseTerm,
              selectedFee,
              fee,
              changeAll,
            });
          }
        });
      }
      return fee;
    });
    return periodFees;
  });

export const isPetFee = fee => fee.type === DALTypes.FeeType.SERVICE && fee.quoteSectionName === DALTypes.QuoteSection.PET;

export const setLeaseTermsEndDate = (leaseTerms, leaseStartDate, timezone) => {
  if (!leaseStartDate) {
    return leaseTerms;
  }

  return leaseTerms.map(term => {
    term.endDate = getEndDateFromStartDate(leaseStartDate, term, timezone);
    return term;
  });
};

export const calculateNewLeaseTerms = updatedLeaseDurationInDays => {
  const termLength = updatedLeaseDurationInDays.as('months');
  const newLeaseTermLengths = [...new Set([Math.floor(termLength), Math.ceil(termLength)])].filter(x => x > 0);

  return newLeaseTermLengths;
};

export const getActiveRecurringChargesForQuote = recurringCharges => recurringCharges.filter(charge => !charge.endDate);

export const getActiveChargesForLeaseForm = (charges, leaseStartDate, timezone) =>
  charges.filter(charge => {
    const chargeEndDateMoment = charge?.endDate && toMoment(charge.endDate, { timezone });
    const leaseStartDateMoment = leaseStartDate && toMoment(leaseStartDate, { timezone });

    return !chargeEndDateMoment || chargeEndDateMoment.startOf('day').isSameOrAfter(leaseStartDateMoment.startOf('day'));
  });

export const extractFeeId = fee => fee.id.substring(0, fee.id.indexOf('>>') === -1 ? fee.id.length : fee.id.indexOf('>>'));

export const getSelectedFee = (selectedFees, fee) => {
  const feeId = extractFeeId(fee);
  return selectedFees.find(f => feeId === extractFeeId(f));
};

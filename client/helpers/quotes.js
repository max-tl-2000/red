/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import groupBy from 'lodash/groupBy';
import capitalize from 'lodash/capitalize';
import isEmpty from 'lodash/isEmpty';
import { USD } from '../../common/currency';
import { getCharges, getAdjFormOfPeriod, getTotalConcessions, flattenedChargeInfo, getSelectedFee } from '../../common/helpers/quotes';
import { DALTypes } from '../../common/enums/DALTypes';
import { SHORT_DATE_FORMAT, MONTH_DATE_YEAR_FORMAT } from '../../common/date-constants';
import { isDateInTheCurrentYear } from '../../common/helpers/date-utils';

import { formatMoney, formatNumber } from '../../common/money-formatter';
import { adjustmentText } from '../../common/helpers/adjustmentText';
import { termText, periodText, trans } from './quoteTextHelpers';
import { inventoryItemsStates } from '../../common/enums/inventoryStates';
import { formatPhone } from '../../common/helpers/phone-utils';
import { isInventoryLeasedOnPartyType } from '../../common/helpers/inventory';
import { toMoment, formatMoment, now } from '../../common/helpers/moment-utils';
import clsc from '../../common/helpers/coalescy';

const MONTH_30 = 30;
const MONTH_31 = 31;

const PS_30_DAY_MONTH = '30 day month';
const PS_CALENDAR_MONTH = 'Calendar month';

export const groupLeaseTermsByPeriod = leaseTerms => {
  const groupedItems = groupBy(leaseTerms, 'period');
  return Object.keys(groupedItems).map(key => ({
    periodName: key,
    array: groupedItems[key],
  }));
};

const getGroupLeaseNameByPeriod = period => {
  switch (period) {
    case DALTypes.LeasePeriod.MONTH:
      return t('MONTHLY');
    case DALTypes.LeasePeriod.WEEK:
      return t('WEEKLY');
    case DALTypes.LeasePeriod.DAY:
      return t('DAILY');
    case DALTypes.LeasePeriod.HOUR:
      return t('HOURLY');
    default:
      return period;
  }
};

export const getTermsByGroup = (groupId, groupName, terms) => {
  const termItems = terms.map(term => ({
    ...term,
    text: termText(term),
  }));
  const groupLeaseName = capitalize(getGroupLeaseNameByPeriod(groupName));
  return {
    id: groupId,
    text: `${groupLeaseName} ${t('PERIOD_LEASES')}`,
    items: termItems,
  };
};

export const isQuoteExpired = ({ expirationDate, timezone }) => expirationDate && toMoment(expirationDate, { timezone }).isBefore(now({ timezone }));

export const getDaysSinceQuoteWasPublished = (publishDate, timezone) => {
  const today = now({ timezone }).startOf('day');
  return today.diff(toMoment(publishDate, { timezone }).startOf('day'), 'days');
};

// communications is Immutable array
export const getPersonIdsWithQuoteComms = communications =>
  Array.from(
    communications.reduce((acc, comm) => {
      const isApplicationInviteCommunication = comm.category === DALTypes.CommunicationCategory.APPLICATION_INVITE;
      if (comm.category === DALTypes.CommunicationCategory.QUOTE || isApplicationInviteCommunication) {
        acc.add(comm.persons[0]);
      }
      return acc;
    }, new Set()),
  );

export const getQuoteCommunicationCreationDateForParty = (communications, partyId) =>
  Array.from(
    communications.reduce((acc, comm) => {
      if (comm.category === DALTypes.CommunicationCategory.QUOTE && comm.parties.includes(partyId)) {
        acc.add(comm.created_at);
      }
      return acc;
    }, new Set()),
  );

/*
 * returns the status of a quote
 * dates from the API come as an ISO representation
 */
const quoteStatus = quote => {
  const { publishDate, expirationDate, propertyTimezone: timezone } = quote;
  const isDraft = !publishDate;

  let status;
  if (isQuoteExpired({ expirationDate, timezone })) {
    status = t('EXPIRED');
  } else if (isDraft) {
    status = t('DRAFT');
  } else {
    const dateFormat = isDateInTheCurrentYear(expirationDate, timezone) ? SHORT_DATE_FORMAT : MONTH_DATE_YEAR_FORMAT;
    status = t('EXPIRES_AT', {
      date: formatMoment(expirationDate, { format: dateFormat, timezone, includeZone: false }),
    });
  }
  return status;
};

/*
 * Returns the amount with the decimal digits that it gets
 */
const getFixedAmount = (amount, decimalDigits) => parseFloat(amount.toFixed(decimalDigits));

const isInventoryHeldByCurrentParty = (inventoryOnHold, quote) => inventoryOnHold.partyId === quote.partyId;

const samePartyHoldStatusMap = {
  [DALTypes.InventoryOnHoldReason.LEASE]: {
    text: 'ON_LEASE_HOLD_FOR_PARTY',
    info: true,
  },
  [DALTypes.InventoryOnHoldReason.AUTOMATIC]: {
    text: 'ON_HOLD_FOR_PARTY',
    info: true,
  },
  [DALTypes.InventoryOnHoldReason.MANUAL]: {
    text: 'ON_HOLD_FOR_PARTY',
    info: true,
  },
};

const otherPartyHoldStatusMap = {
  [DALTypes.InventoryOnHoldReason.LEASE]: {
    text: 'ON_LEASE_HOLD',
    warn: true,
  },
  [DALTypes.InventoryOnHoldReason.AUTOMATIC]: {
    text: 'ON_HOLD',
    warn: true,
  },
  [DALTypes.InventoryOnHoldReason.MANUAL]: {
    text: 'ON_HOLD',
    warn: true,
  },
};

const getStatusListFromInventoryHolds = (inventoryHolds, quote) =>
  inventoryHolds.reduce((acc, hold) => {
    const { reason } = hold;
    const onHoldStatus = isInventoryHeldByCurrentParty(hold, quote) ? samePartyHoldStatusMap[reason] : otherPartyHoldStatusMap[reason];

    if (!onHoldStatus) return acc;

    onHoldStatus.text = t(onHoldStatus.text);

    acc.push(onHoldStatus);
    return acc;
  }, []);

export const isInventoryWithNullPrice = (inventory, quote) => {
  const inventoryHasNoPrice = inventory && !inventory.marketRent && !inventory.renewalMarketRent;
  const quoteIsNotPublished = quote && !quote.publishDate;
  return inventoryHasNoPrice && quoteIsNotPublished;
};

const getStatusListFromInventory = (inventory, quote) => {
  if (!isInventoryWithNullPrice(inventory, quote)) return [];

  return [
    {
      text: t('PRICE_NOT_AVAILABLE'),
      warn: true,
    },
  ];
};

const getStatusListForLeasedInventory = inventory => {
  if (inventory.state === DALTypes.InventoryState.VACANT_READY_RESERVED) {
    return [
      {
        text: t('ON_LEASE_HOLD'),
        warn: true,
      },
    ];
  }

  return [];
};

export const getInventoryHeldByReason = (inventoryHolds, reason) => inventoryHolds.find(inventoryOnHold => inventoryOnHold.reason === reason);
export const getOtherPartiesInventoryHolds = (inventoryHolds, partyId) => inventoryHolds.filter(inventoryHold => inventoryHold.partyId !== partyId);

/*
 * returns the status of a quote on quote list
 */
export const getQuoteStatusForQuoteList = (quote, quotePromotions) => {
  const { publishDate, expirationDate, inventory, propertyTimezone: timezone } = quote;
  const { inventoryHolds } = inventory;
  const statusList = [];

  const isDraft = publishDate === null;
  if (isDraft) {
    statusList.push({
      info: true,
      text: t('DRAFT'),
    });
  }

  const isExpired = isQuoteExpired({ expirationDate, timezone });
  if (isExpired) {
    statusList.push({
      info: true,
      text: t('EXPIRED'),
    });
  }

  const statusListFromInventory = getStatusListFromInventory(inventory, quote);
  statusList.push(...statusListFromInventory);

  const statusListFromInventoryHolds = getStatusListFromInventoryHolds(inventoryHolds, quote);
  statusList.push(...statusListFromInventoryHolds);

  const statusListForLeasedInventory = getStatusListForLeasedInventory(inventory);
  statusList.push(...statusListForLeasedInventory);

  if (
    quotePromotions.some(quotePromotion => quotePromotion.quoteId === quote.id && quotePromotion.promotionStatus === DALTypes.PromotionStatus.PENDING_APPROVAL)
  ) {
    statusList.push({
      info: true,
      text: t('PENDING_APPROVAL'),
    });
  }

  return statusList;
};

const isInventoryHeldByOtherPartyExceptRenewed = (partyIdWithHeldInventory, currentPartyId) =>
  partyIdWithHeldInventory && partyIdWithHeldInventory !== currentPartyId;

const getInventoryHeldByOtherPartyModel = ({ inventoryHolds, quotePartyId, state, executedLease = {}, workflowName }) => {
  const _executedLease = state === DALTypes.InventoryState.OCCUPIED && workflowName === DALTypes.WorkflowName.NEW_LEASE ? {} : executedLease;
  const { partyId: partyIdWithHeldInventory } = _executedLease;

  const isInventoryReservedOrOccupied = isInventoryLeasedOnPartyType(state, { workflowName });

  if (isInventoryHeldByOtherPartyExceptRenewed(partyIdWithHeldInventory, quotePartyId) && isInventoryReservedOrOccupied) {
    return {
      partyId: partyIdWithHeldInventory,
      msg: t('INVENTORY_UNAVAILABLE_EXECUTED_LEASE_HOLDS_MSG', { agent: _executedLease.agentName }),
    };
  }

  const otherPartiesInventoryHolds = getOtherPartiesInventoryHolds(inventoryHolds, quotePartyId);

  if (!otherPartiesInventoryHolds.length && !isInventoryReservedOrOccupied) return undefined;

  const otherPartyManualHold =
    getInventoryHeldByReason(otherPartiesInventoryHolds, DALTypes.InventoryOnHoldReason.MANUAL) ||
    getInventoryHeldByReason(otherPartiesInventoryHolds, DALTypes.InventoryOnHoldReason.AUTOMATIC);
  const otherPartyLeaseHold = getInventoryHeldByReason(otherPartiesInventoryHolds, DALTypes.InventoryOnHoldReason.LEASE);

  if (isInventoryReservedOrOccupied) {
    return {
      partyId: null,
      msg: t('INVENTORY_RESERVED_MSG'),
    };
  }

  if (otherPartyManualHold && otherPartyLeaseHold) {
    return {
      partyId: otherPartyLeaseHold.partyId,
      msg: t('INVENTORY_UNAVAILABLE_MANUAL_AND_LEASE_HOLDS_MSG', { agent: otherPartyLeaseHold.agentName }),
    };
  }

  if (otherPartyManualHold) {
    return {
      partyId: otherPartyManualHold.partyId,
      msg: t('INVENTORY_UNAVAILABLE_MANUAL_HOLD_MSG', { agent: otherPartyManualHold.agentName }),
    };
  }

  return {
    partyId: otherPartyLeaseHold.partyId,
    msg: t('INVENTORY_UNAVAILABLE_LEASE_HOLD_MSG', { agent: otherPartyLeaseHold.agentName }),
  };
};

export const getInventoryHoldStatus = (quote, workflowName = DALTypes.WorkflowName.NEW_LEASE) => {
  const {
    inventory: { inventoryHolds, state, executedLease },
  } = quote;
  const quotePartyId = quote.partyId;
  const inventoryManualHold =
    getInventoryHeldByReason(inventoryHolds, DALTypes.InventoryOnHoldReason.MANUAL) ||
    getInventoryHeldByReason(inventoryHolds, DALTypes.InventoryOnHoldReason.AUTOMATIC);
  const isManuallyHeldByThisParty = inventoryManualHold && inventoryManualHold.partyId === quotePartyId;

  const inventoryHeldModel = getInventoryHeldByOtherPartyModel({ inventoryHolds, quotePartyId, state, executedLease, workflowName });
  return { inventoryHeldModel, isManuallyHeldByThisParty, isHeldByOtherParty: !!inventoryHeldModel };
};

const getPeriodName = term => t(trans[term.period]);

const getMonthlyFeeAmountForBillableDays = (feeAmount, billableDays) => (feeAmount / MONTH_30) * billableDays;

const calculateRelativeAdjustment = (adjustedMarketRent, relativeAdjustment) => (adjustedMarketRent / 100) * relativeAdjustment;

const sortByOptionalAndAlphabetically = (a, b) => a.optional - b.optional || a.displayName.localeCompare(b.displayName);

const getMaxAmountLimit = (adjustedMarketRent, relativeAdjustment, absoluteAdjustment, floorCeilingAmount) => {
  if (floorCeilingAmount > 0) return floorCeilingAmount;
  if (absoluteAdjustment > 0) {
    return getFixedAmount(absoluteAdjustment, 2);
  }
  return formatNumber(calculateRelativeAdjustment(adjustedMarketRent, relativeAdjustment), { thousand: '' });
};

const quoteSectionRepresentation = quoteSection => {
  const text =
    {
      application: t('APPLICATION'),
      inventory: t('INVENTORY'),
      parking: t('PARKING'),
      service: t('SERVICE'),
      deposit: t('DEPOSIT'),
      appliance: t('APPLIANCES'),
      pet: t('PET'),
      penalty: t('PENALTY'),
      storage: t('STORAGE'),
      utility: t('UTILITY'),
    }[quoteSection] || t('NO_QUOTE_SECTION_NAME');

  return text;
};

const setSelectedStateOfFeesForPeriod = (arrayFees, periodName, state) =>
  arrayFees.map(period => {
    if (period.name === periodName) {
      const fees = period.fees.map(fee => {
        if (state) {
          fee.visible = state;
          fee.selected = state;
        } else if (fee.firstFee) {
          fee.visible = !state;
          fee.selected = fee.isAdditional;
        } else {
          fee.visible = state;
          fee.selected = state;
        }
        if (fee.concessions && fee.concessions.length > 0) {
          fee.concessions.forEach(concession => {
            concession.selected = state;
          });
        }
        return fee;
      });
      period.fees = fees;
    }
    return period;
  });

const setSelectedInventories = (feeArray, periodName, fee, selectedInventories) => {
  const children = fee.children || [];
  return feeArray.map(period => {
    if (period.name === periodName) {
      const fees = period.fees.map(f => {
        if (f.id === fee.id) {
          if (selectedInventories.length) {
            f.quantity = selectedInventories.length;
            f.amount = selectedInventories.reduce((result, inventory) => result + inventory.marketRent, 0);
          } else {
            f.quantity = 1;
            f.amount = fee.price;
          }
          f.selectedInventories = selectedInventories;
        }
        if (children.some(c => c === f.id)) {
          if (f.isAdditional) {
            f.quantity = selectedInventories.length || 1;
            f.amount = f.quantity * f.price;
          }
        }
        return f;
      });
      period.fees = fees;
    }
    return period;
  });
};

export const isHoldDepositFee = fee => fee.feeType === DALTypes.FeeType.HOLD_DEPOSIT && fee.quoteSectionName === DALTypes.QuoteSection.DEPOSIT && fee.firstFee;
export const isPetDepositFee = fee => fee.name === DALTypes.FeeName.PET_DEPOSIT && fee.quoteSectionName === DALTypes.QuoteSection.DEPOSIT;
export const isServiceAnimalDepositFee = fee => fee.name === DALTypes.FeeName.SERVICE_ANIMAL_DEPOSIT && fee.quoteSectionName === DALTypes.QuoteSection.DEPOSIT;

/*
 * Exported for testing purposes only
 */
const setStatesConcessionsForSelectedFees = (selectedConcessions, concessions) => {
  concessions.forEach(concession => {
    const selectedConcession = selectedConcessions.find(c => concession.id === c.id);
    if (selectedConcession) {
      concession.selected = selectedConcession.selected;
      concession.amountVariableAdjustment = selectedConcession.amountVariableAdjustment;
    }
  });
  return concessions;
};

const setStatesAdditionalAndOneTimeFees = (additionalOneTimeFees, quote) =>
  additionalOneTimeFees.map(periodFees => {
    const periodName = !isEmpty(quote.selections) ? quote.selections.selectedAdditionalAndOneTimeCharges.name : null;
    if (periodFees.name === periodName) {
      let fees = periodFees.fees.map(fee => {
        const selectedFee = !isEmpty(quote.selections) && getSelectedFee(quote.selections.selectedAdditionalAndOneTimeCharges.fees, fee);
        if (selectedFee) {
          if (selectedFee.selectedConcessions) {
            fee.concessions = setStatesConcessionsForSelectedFees(selectedFee.selectedConcessions, fee.concessions);
          }
          if (fee.selectedInventories) {
            fee.selectedInventories = selectedFee.selectedInventories || [];
          }

          fee = {
            ...fee,
            visible: true,
            selected: true,
            quantity: selectedFee.quantity,
            amount: clsc(selectedFee.variableAdjustmentAmount, fee.variableAdjustmentAmount, fee.price * selectedFee.quantity),
            variableAdjustmentAmount: clsc(selectedFee.variableAdjustmentAmount, fee.variableAdjustmentAmount),
            originalTotalAmount: clsc(selectedFee.originalTotalAmount, fee.originalTotalAmount),
          };
        }
        return fee;
      });
      const feesWithChildren = fees.reduce((resultFees, fee) => {
        if (fee.children && fee.selected) {
          resultFees.push(...fee.children);
        }
        return resultFees;
      }, []);

      fees = fees.map(fee => {
        const visible = feesWithChildren.some(f => f === fee.id);
        if (visible) {
          if (fee.isAdditional) {
            const parentFee = fees.find(f => f.id === fee.id);
            fee.quantity = parentFee.quantity;
            fee.amount = fee.variableAdjustmentAmount || fee.quantity * fee.price;
          }
          fee = { ...fee, visible };
        }
        return fee;
      });

      periodFees.fees = fees;
    }
    return periodFees;
  });

const { code: currency } = USD;

export const formatToMoneyString = amount => formatMoney({ amount, currency }).result;

export const toMoneyObject = amount => formatMoney({ amount, currency });

const formatAgent = user => ({
  fullName: user.fullName,
  phone: formatPhone(user.displayPhoneNumber),
  email: user.displayEmail,
  title: user.metadata.businessTitle,
  avatarUrl: user.avatarUrl,
});

const getMinDepositAmount = selectedTerms =>
  selectedTerms.reduce((p, c) => {
    if (p.depositAmount < c.depositAmount) {
      return p;
    }
    return c;
  }, {});

const getMaxDepositAmount = selectedTerms =>
  selectedTerms.reduce((p, c) => {
    if (p.depositAmount > c.depositAmount) {
      return p;
    }
    return c;
  }, {});

const getDepositRelativeAmountForSelectedLeaseTerms = (fee, selectedLeaseTermIds) => {
  const selectedTerms = [];
  selectedLeaseTermIds.forEach(selectedLeaseTerm => {
    const relativeAmountByLeaseTerm = fee.relativeAmountsByLeaseTerm.find(ra => ra.leaseTermId === selectedLeaseTerm);
    const lt = fee.leaseTerms.find(term => term.id === selectedLeaseTerm);
    if (relativeAmountByLeaseTerm && lt) {
      selectedTerms.push({
        ...lt,
        depositAmount: relativeAmountByLeaseTerm.amount,
        relativeAmountByLeaseTerm,
      });
    }
  });
  const max = getMaxDepositAmount(selectedTerms);
  const min = getMinDepositAmount(selectedTerms);

  if (max.depositAmount === min.depositAmount) {
    return { depositAmount: min.depositAmount };
  }
  return { leaseTerms: selectedTerms };
};

const getIdsOfDefaultLeaseTerms = (leaseTerms, defaultTermLengths, leaseState) =>
  leaseTerms.reduce((acc, term) => {
    if (
      (term.period === DALTypes.LeasePeriod.MONTH && defaultTermLengths && defaultTermLengths.includes(term.termLength)) ||
      leaseState === DALTypes.LeaseState.RENEWAL
    ) {
      acc.push(term.id);
    }

    return acc;
  }, []);

const getGroupLabelByStateAndCompOrigin = (state, origin) => {
  switch (origin) {
    case DALTypes.InventorySelectorCases.SCHEDULE_APPOINTMENT:
      switch (state) {
        case DALTypes.InventoryState.MODEL:
          return { name: t('MODEL_AND_INTEREST_UNITS'), order: 1 };
        case DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED:
        case DALTypes.InventoryState.VACANT_RESERVED:
        case DALTypes.InventoryState.VACANT_MAKE_READY:
        case DALTypes.InventoryState.VACANT_READY:
          return { name: t('AVAILABLE_FOR_TOUR'), order: 2 };
        case DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED:
        case DALTypes.InventoryState.OCCUPIED_NOTICE:
        case DALTypes.InventoryState.OCCUPIED:
          return { name: t('NOT_AVAILABLE_FOR_TOUR'), order: 3 };
        default:
      }
      break;
    case DALTypes.InventorySelectorCases.INVENTORY_SELECTION:
      switch (state) {
        case DALTypes.InventoryState.MODEL:
          return { name: t('MODEL_AND_INTEREST_UNITS'), order: 1 };
        case DALTypes.InventoryState.OCCUPIED_NOTICE:
        case DALTypes.InventoryState.VACANT_MAKE_READY:
        case DALTypes.InventoryState.VACANT_READY:
          return { name: t('AVAILABLE_FOR_RENTING'), order: 2 };
        case DALTypes.InventoryState.OCCUPIED_NOTICE_RESERVED:
        case DALTypes.InventoryState.OCCUPIED:
        case DALTypes.InventoryState.VACANT_MAKE_READY_RESERVED:
        case DALTypes.InventoryState.VACANT_RESERVED:
        case DALTypes.InventoryState.DOWN:
          return { name: t('NOT_AVAILABLE_FOR_RENTING'), order: 3 };
        default:
      }
      break;
    default:
  }
  return '';
};

const groupAndSortItemsByAvailability = (items, origin) => {
  if (!items) {
    return items;
  }
  const mapItems = items.reduce((acc, item) => {
    const grouplabel = getGroupLabelByStateAndCompOrigin(item.state, origin);
    const groupId = grouplabel.name;
    acc.set(groupId, {
      id: groupId,
      order: grouplabel.order,
      name: groupId,
      items: [...((acc.get(groupId) || {}).items || []), item],
    });
    return acc;
  }, new Map());
  const groupedItems = [...mapItems.values()];
  groupedItems.sort((a, b) => a.order - b.order);

  return groupedItems;
};

const formatInventoryItems = (items, origin) => {
  let groupedInventoryItems = [];
  if (items) {
    const stateFilteredItems = items.filter(item => inventoryItemsStates.includes(item.state)); // Filters if the state applies for the inventory selection
    groupedInventoryItems = groupAndSortItemsByAvailability(stateFilteredItems, origin);
  }
  return groupedInventoryItems;
};

export const getInventoryShorthand = ({ buildingName, inventoryName }) => (buildingName ? `${buildingName}-${inventoryName}` : inventoryName);

export {
  MONTH_30,
  MONTH_31,
  PS_30_DAY_MONTH,
  PS_CALENDAR_MONTH,
  quoteStatus,
  termText,
  getAdjFormOfPeriod,
  getPeriodName,
  adjustmentText,
  sortByOptionalAndAlphabetically,
  getMaxAmountLimit,
  quoteSectionRepresentation,
  calculateRelativeAdjustment,
  setSelectedStateOfFeesForPeriod,
  getCharges,
  setStatesAdditionalAndOneTimeFees,
  periodText,
  getMonthlyFeeAmountForBillableDays,
  formatAgent,
  getDepositRelativeAmountForSelectedLeaseTerms,
  getMaxDepositAmount,
  getMinDepositAmount,
  getTotalConcessions,
  flattenedChargeInfo,
  setStatesConcessionsForSelectedFees,
  getIdsOfDefaultLeaseTerms,
  setSelectedInventories,
  getFixedAmount,
  formatInventoryItems,
  getGroupLabelByStateAndCompOrigin,
};

export const enhanceInventory = inventory => {
  const { building, property } = inventory;
  return {
    ...inventory,
    buildingShorthand: building.name,
    buildingName: building.displayName,
    propertyName: property.name,
    propertyDisplayName: property.displayName,
    fullQualifiedName: `${property.name}-${building.name}-${inventory.name}`,
  };
};

export const getTranslatedScreeningRecommendations = (recommendations = []) =>
  recommendations.map(({ text }) => {
    if (text === DALTypes.ScreeningRecommendation.ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION) {
      return { text: t('ERROR_ADDRESS_UNPARSABLE_RECOMMENDATION') };
    }

    if (text === DALTypes.ScreeningRecommendation.GENERIC_ERROR_RECOMMENDATION) {
      return { text: t('GENERIC_ERROR_RECOMMENDATION') };
    }

    return { text };
  });

const isThereAnyLeaseTermAndFee = selections =>
  selections &&
  selections.selectedLeaseTerms.length &&
  selections.selectedAdditionalAndOneTimeCharges &&
  selections.selectedAdditionalAndOneTimeCharges.fees &&
  selections.selectedAdditionalAndOneTimeCharges.fees.length;

export const getUnitDepositAmount = quote => {
  let unitDepositAmount = 0;
  if (!quote || !quote.selections) return 0;
  if (isThereAnyLeaseTermAndFee(quote.selections)) {
    const firstLeaseTermId = quote.selections.selectedLeaseTerms[0].id;
    const unitDepositFee = quote.selections.selectedAdditionalAndOneTimeCharges.fees.find(fee => fee.isUnitDepositFee);
    if (unitDepositFee) {
      // If relative fee
      if (unitDepositFee.relativeAmountsByLeaseTerm) {
        const relativeAmount = unitDepositFee.relativeAmountsByLeaseTerm.find(
          relativeAmountByLeaseTerm => relativeAmountByLeaseTerm.leaseTermId === firstLeaseTermId,
        );
        unitDepositAmount = relativeAmount.amount;
      } else {
        unitDepositAmount = unitDepositFee.amount;
      }
    } else {
      console.warn('>>> NO deposit found from selections ', quote.selections);
    }
  }
  return parseFloat(unitDepositAmount);
};

const excludedExternalChargeCodes = ['EXE'];

export const excludeExternalChargeCodes = charges => (charges || []).filter(c => !excludedExternalChargeCodes.includes(c.code));

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { t } from 'i18next';
import get from 'lodash/get';
import range from 'lodash/range';
import { getFeesByPropertyId } from '../../dal/feeRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getFixedAmount } from '../../../common/helpers/number';
import {
  applyMonthlyConcessions,
  calculateProratedAmountToPayPerFee,
  getMonthlyBasePayments,
  isUnitDepositFee,
  getConcessionValue,
  extractFeeId,
} from '../../../common/helpers/quotes';
import { PS_CALENDAR_MONTH, isPetDepositFee, isServiceAnimalDepositFee, isHoldDepositFee } from '../../../client/helpers/quotes';
import { formatMoney } from '../../../common/money-formatter';
import { getEnhancedLeaseObject } from './setsMapping';
import logger from '../../../common/helpers/logger';
import { getLeaseSettingsForProperty, naturalGasProvidedProperties, submeterAddendumProperties, utilityAddendumProperties } from './propertySetting';
import trim from '../../../common/helpers/trim';
import { toMoment } from '../../../common/helpers/moment-utils';
import { ServiceError } from '../../common/errors';
import { loadPartyMembers } from '../../dal/partyRepo';

const getSubTotalOfMoveinCharges = ({
  unitDeposit,
  moveInRent,
  totalPetOneTimeServiceFee,
  totalPetDeposit,
  moveinAdditionalRent,
  totalConcessionOnMoveinCharges,
}) => unitDeposit + moveInRent + totalPetOneTimeServiceFee + totalPetDeposit + moveinAdditionalRent - totalConcessionOnMoveinCharges;

const getTotalMoveInCharges = ({
  unitDeposit,
  moveInRent,
  totalPetDeposit,
  totalPetOneTimeServiceFee,
  totalHoldDeposit,
  moveinAdditionalRent,
  totalConcessionOnMoveinCharges,
}) => unitDeposit + moveInRent + totalPetOneTimeServiceFee + totalPetDeposit + moveinAdditionalRent - (totalHoldDeposit + totalConcessionOnMoveinCharges);

const getFees = fees => {
  const holdDepositAmount = (fees.find(f => f.name === 'holdDeposit') || {}).absolutePrice || 0;
  const applicationFeeAmount = (fees.find(f => f.name === 'singleAppFee') || {}).absolutePrice || 0;
  const nsfFee = (fees.find(f => f.name === 'nsfFee') || {}).absolutePrice || 0;
  const lateFee = (fees.find(f => f.name === 'lateFee') || {}).absolutePrice || 0;
  const petFee = (fees.find(f => f.name === 'PetFee') || {}).absolutePrice || 0;
  const holdDeposit = (fees.find(f => f.name === 'holdDeposit') || {}).absolutePrice || 0;
  const petDNARegistrationFee = (fees.find(f => f.name === 'petDNARegistrationFee') || {}).absolutePrice || 0;

  return {
    holdDepositAmount: parseFloat(holdDepositAmount),
    applicationFeeAmount: parseFloat(applicationFeeAmount),
    nsfFee: parseFloat(nsfFee),
    lateFee: parseFloat(lateFee),
    petFee: parseFloat(petFee),
    holdDeposit: parseFloat(holdDeposit),
    petDNARegistrationFee: parseFloat(petDNARegistrationFee),
  };
};

const enhanceCharges = (ctx, { selectedCharges, allCharges, period }) => {
  if (allCharges === null || !period) return selectedCharges;

  Object.keys(selectedCharges).forEach(chargeKey => {
    for (const chargeServicePeriod of Object.values(allCharges)) {
      if (chargeServicePeriod.name === period) {
        const selectedFeeId = extractFeeId({ id: chargeKey });
        const item = chargeServicePeriod.fees.find(f => extractFeeId(f) === selectedFeeId);

        if (item) {
          selectedCharges[chargeKey].quoteSectionName = item.quoteSectionName;
          selectedCharges[chargeKey].name = item.name;
          selectedCharges[chargeKey].displayName = item.displayName;
          selectedCharges[chargeKey].feeType = item.feeType;
          selectedCharges[chargeKey].firstFee = item.firstFee;
          selectedCharges[chargeKey].servicePeriod = item.servicePeriod;
          break;
        } else {
          logger.error({ ctx, selectedCharges, allCharges, period }, `selected ${chargeKey} was not found in allCharges`);
          throw new ServiceError({
            token: 'LEASE_CHARGES_ERROR',
            status: 412,
            data: { selectedCharges, allCharges, period },
          });
        }
      }
    }
  });
  return selectedCharges;
};

const getChargesByType = (additionalCharges, quoteSectionName) =>
  Object.keys(additionalCharges).reduce(
    (total, key) => total + (additionalCharges[key].quoteSectionName === quoteSectionName ? parseFloat(additionalCharges[key].amount || 0) : 0),
    0,
  );

const getChargeAmount = charge => (charge && charge.amount && charge.quantity ? parseFloat(charge.amount) / parseFloat(charge.quantity) : 0);

const getOneItemChargeByName = (additionalCharges, chargeName) => {
  const charge = Object.keys(additionalCharges)
    .map(chargeKey => additionalCharges[chargeKey])
    .find(c => c.name === chargeName);
  return charge && charge.amount && charge.quantity ? parseFloat(charge.amount) / parseFloat(charge.quantity) : 0;
};

const getChargeQuantityByName = (additionalCharges, chargeName) => {
  const charge = Object.values(additionalCharges).find(c => c.name === chargeName);
  return (charge && charge.quantity) || 0;
};

const getInventoryItemByQuoteSection = (additionalCharges, quoteSection) =>
  Object.entries(additionalCharges).reduce((acc, [_key, charge]) => {
    if (charge.quoteSectionName !== quoteSection) return acc;

    const { displayName, quantity } = charge;
    const marketRent = getChargeAmount(charge);

    const chargeInfo = { marketRent, displayName, complimentary: false };
    const { selectedInventories } = charge;

    if (selectedInventories) {
      selectedInventories.forEach(inv => acc.push({ ...inv, ...chargeInfo }));
    } else {
      range(quantity).forEach(() => acc.push(chargeInfo));
    }
    return acc;
  }, []);

const getStorageSpaces = additionalCharges => getInventoryItemByQuoteSection(additionalCharges, DALTypes.QuoteSection.STORAGE);
const getParkingSpaces = additionalCharges => getInventoryItemByQuoteSection(additionalCharges, DALTypes.QuoteSection.PARKING);

const getChargesByNamePrefix = (ctx, additionalCharges, prefix) => {
  const lcPrefix = prefix.toLowerCase();
  return Object.keys(additionalCharges).reduce((total, key) => {
    const charge = additionalCharges[key] || {};
    const startsWithPrefix = trim(charge.name).toLowerCase().startsWith(lcPrefix);

    let chargeAmount = 0;

    if (startsWithPrefix) {
      chargeAmount = parseFloat(charge.amount || 0);
      if (isNaN(chargeAmount)) {
        const err = new Error('AMOUNT_PARSE_ERROR'); // just to have a nice stack
        logger.warn({ ctx, charge, prefix, additionalCharges, err }, 'Trying to parse an amount produced a NaN value');
        chargeAmount = 0;
      }
    }

    return total + chargeAmount;
  }, 0);
};

const getChargesByNameMatching = (ctx, additionalCharges, stringToContain) => {
  const lcStringToContain = stringToContain.toLowerCase();
  return Object.keys(additionalCharges).reduce((total, key) => {
    const charge = additionalCharges[key] || {};
    const containsString = charge.name && trim(charge.name.toLowerCase()).includes(lcStringToContain);

    let chargeAmount = 0;

    if (containsString) {
      chargeAmount = parseFloat(charge.amount || 0);
      if (isNaN(chargeAmount)) {
        const err = new Error('AMOUNT_PARSE_ERROR');
        logger.warn({ ctx, charge, stringToContain, additionalCharges, err }, 'Trying to parse an amount produced a NaN value');
        chargeAmount = 0;
      }
    }

    return total + chargeAmount;
  }, 0);
};

const getMoveInRent = (moveInDate, rent, timezone) => {
  const moveInDay = toMoment(moveInDate, { timezone }).get('date');
  const proratedRent = calculateProratedAmountToPayPerFee(moveInDate, rent, { timezone });
  return moveInDay >= 25 ? proratedRent + parseFloat(rent || 0) : proratedRent;
};

export const getDepositAmount = (oneTimeCharges, leaseTermId, depositTypeValidator) => {
  const depositCharge = Object.values(oneTimeCharges).find(charge => depositTypeValidator(charge)) || {};
  const findRelativeAmountsByLeaseTerms = (depositCharge.relativeAmountsByLeaseTerm || []).find(a => a.leaseTermId === leaseTermId) || {};

  if (depositCharge.amount >= 0) return depositCharge.amount;
  if (!depositCharge.amount || !findRelativeAmountsByLeaseTerms.amount) return 0;

  return findRelativeAmountsByLeaseTerms.amount;
};

const getSecurityDepositAmount = (oneTimeCharges, leaseTermId) => getDepositAmount(oneTimeCharges, leaseTermId, isUnitDepositFee);
const getHoldDepositAmount = (oneTimeCharges, leaseTermId) => getDepositAmount(oneTimeCharges, leaseTermId, isHoldDepositFee);
const getPetDepositAmount = (oneTimeCharges, leaseTermId) => getDepositAmount(oneTimeCharges, leaseTermId, isPetDepositFee);
const getServiceAnimalDepositAmount = (oneTimeCharges, leaseTermId) => getDepositAmount(oneTimeCharges, leaseTermId, isServiceAnimalDepositFee);

export const getTotalConcessionsOnMoveInCharges = (leaseStartDate, paymentsForPeriods, timezone) => {
  const rentStartDay = toMoment(leaseStartDate, { timezone }).get('date');
  const months = rentStartDay < 25 ? 1 : 2;
  const periodsPayments = paymentsForPeriods.filter((pp, index) => index < months);

  return periodsPayments.reduce((acc, current) => {
    if (!current.appliedConcessions) return acc;

    current.appliedConcessions.forEach(appliedConcession => {
      if (appliedConcession) acc += appliedConcession.amount;
    });

    return acc;
  }, 0);
};

const getMoveinRentEndDate = (leaseStartDate, timezone) => {
  const rentStartDay = toMoment(leaseStartDate, { timezone }).get('date');
  return rentStartDay >= 25
    ? toMoment(leaseStartDate, { timezone }).add(1, 'month').endOf('month').startOf('day').format()
    : toMoment(leaseStartDate, { timezone }).endOf('month').startOf('day').format();
};

export const getLeaseTermPaymentsByPeriods = ({ leaseTerm, leaseStartDate, leaseEndDate, prorationStrategy, selectedConcessions, timezone, unitRent }) => {
  const updatedLeaseTerm = { ...leaseTerm, endDate: leaseEndDate, adjustedMarketRent: unitRent || leaseTerm.adjustedMarketRent };

  const paymentsForPeriods = getMonthlyBasePayments(updatedLeaseTerm, leaseStartDate, prorationStrategy || PS_CALENDAR_MONTH, timezone);
  return applyMonthlyConcessions(updatedLeaseTerm.adjustedMarketRent, selectedConcessions, leaseTerm.termLength, paymentsForPeriods, leaseStartDate, timezone);
};

export const getSelectedConcessions = (concessions, leaseConcessions) => {
  const concessionsIds = Object.keys(leaseConcessions);
  if (!concessionsIds.length) return [];

  return concessionsIds.map(concessionId => {
    const concession = concessions.find(con => con.id === concessionId);
    concession.selected = true;
    if (concession.variableAdjustment) {
      concession.amountVariableAdjustment = leaseConcessions[concessionId].amountVariableAdjustment;
      concession.variableAmountUpdatedByAgent = leaseConcessions[concessionId].variableAmountUpdatedByAgent;
    }
    return concession;
  });
};

const getConcessionsMonthsAndAmounts = ({ paymentsForPeriods, concession, leaseTerm, publishedLease }) => {
  const { termLength, adjustedMarketRent, overwrittenBaseRent } = leaseTerm;

  return paymentsForPeriods.reduce(
    (acc, current, index) => {
      if (!current.appliedConcessions) return acc;

      const appliedConcession = current.appliedConcessions.find(ac => ac.concessionId === concession.id);

      if (appliedConcession) {
        acc.months.push(current.timeframe);
        acc.monthlyAmount = index === 1 ? appliedConcession.amount : acc.monthlyAmount;
      }

      return acc;
    },
    {
      months: [],
      totalAmount: getConcessionValue(concession, { amount: publishedLease.unitRent || overwrittenBaseRent || adjustedMarketRent, length: termLength }, true),
      monthlyAmount: 0,
    },
  );
};

const formatMoneyUSD = amount => formatMoney({ amount: getFixedAmount(amount, 2), currency: 'USD' }).result;

const getConcessionsAmount = ({ paymentsForPeriods, selectedConcessions, leaseTerm, publishedLease }) => {
  const getOutputMessage = concession => {
    const { months, totalAmount, monthlyAmount } = getConcessionsMonthsAndAmounts({ paymentsForPeriods, concession, leaseTerm, publishedLease });

    const oneTimeTemplate = () =>
      `Resident shall receive a prorated one-time concession of ${formatMoneyUSD(totalAmount)} off the rent from ${months.join(', ')}.`;
    const recurringTemplate = () =>
      `Resident shall receive a prorated concession of ${formatMoneyUSD(monthlyAmount)} per month off the rent from ${months[0]} through ${
        months[months.length - 1]
      }.`;
    return concession.recurring ? recurringTemplate() : oneTimeTemplate();
  };

  return selectedConcessions.map(concession => getOutputMessage(concession));
};

const getConcessionsTotalAmount = ({ paymentsByPeriods, selectedConcessions, leaseTerm, publishedLease }) =>
  selectedConcessions.reduce(
    (total, current) => {
      const { totalAmount } = getConcessionsMonthsAndAmounts({ paymentsForPeriods: paymentsByPeriods, concession: current, leaseTerm, publishedLease });
      current.recurring ? (total.recurring += totalAmount) : (total.oneTime += totalAmount);

      return total;
    },
    { oneTime: 0, recurring: 0 },
  );

const getFirstReccurringConcession = selectedConcessions => selectedConcessions.find(concession => concession.recurring);

const getConcessionsDescription = ({ paymentsForPeriods, concessionsIds, concessions, leaseTerm, publishedLease }) => {
  const getOutputMessage = concession => {
    const { months } = getConcessionsMonthsAndAmounts({ paymentsForPeriods, concession, leaseTerm, publishedLease });
    const concessionType = concession.recurring ? 'Recurring' : 'One-time';
    const concessionMonths = concession.recurring ? `from ${months[0]} through ${months[months.length - 1]}` : `during ${months.join(', ')}`;
    return `${concessionType} concession ${concessionMonths}`;
  };
  return concessionsIds.map(cId => getOutputMessage(concessions.find(con => con.id === cId)));
};

const getConcessionTypes = selectedConcessions => {
  let hasRecurringConcessions = false;
  let hasOneTimeConcessions = false;
  if (selectedConcessions.some(c => c.recurring)) {
    hasRecurringConcessions = true;
  }
  if (selectedConcessions.some(c => c.recurring === false)) {
    hasOneTimeConcessions = true;
  }
  return { hasRecurringConcessions, hasOneTimeConcessions };
};

const getConcessionsAmountAndDescription = ({ concessions, publishedLease, paymentsByPeriods, leaseTerm }) => {
  const leaseConcessions = publishedLease.concessions;
  const concessionsIds = Object.keys(leaseConcessions);
  if (!concessionsIds.length) return {};

  const selectedConcessions = getSelectedConcessions(concessions, leaseConcessions);

  const concessionsDescription = getConcessionsDescription({ paymentsForPeriods: paymentsByPeriods, concessionsIds, concessions, leaseTerm, publishedLease });
  const concessionsAmount = getConcessionsAmount({ paymentsForPeriods: paymentsByPeriods, selectedConcessions, leaseTerm, publishedLease });

  const { hasRecurringConcessions, hasOneTimeConcessions } = getConcessionTypes(selectedConcessions);
  return { concessionsDescription, concessionsAmount, hasRecurringConcessions, hasOneTimeConcessions };
};

const getPartyMemberAddress = (personId, memberType, personsApplications = []) => {
  const personApplication = personsApplications.find(pa => pa.personId === personId);
  if (personApplication) {
    const personApplicationData = personsApplications.find(pa => pa.personId === personId).applicationData;
    const addressObj = personApplicationData.address && personApplicationData.address.enteredByUser;
    const address = `${addressObj.line1}${addressObj.line2 ? `, ${addressObj.line2}` : ''}`;
    const cityStateZip = `${addressObj.city}, ${addressObj.state}, ${addressObj.postalCode}`;
    return personApplicationData.haveInternationalAddress
      ? {
          address: personApplicationData.addressLine,
          cityStateZip: '',
        }
      : {
          address: memberType === DALTypes.MemberType.GUARANTOR ? `${address}, ${cityStateZip}` : address,
          cityStateZip: memberType === DALTypes.MemberType.GUARANTOR ? '' : cityStateZip,
        };
  }
  return { address: '', cityStateZip: '' };
};

const baselineDataForPartyMember = (partyMember, personsApplications = []) => {
  const personApplication = personsApplications.find(pa => pa.personId === partyMember.personId);
  return {
    id: partyMember.id,
    name: partyMember.fullName,
    email: partyMember.contactInfo.defaultEmail,
    phone1: partyMember.contactInfo.defaultPhone,
    phone2: (partyMember.contactInfo.phones.find(ph => ph.value !== partyMember.contactInfo.defaultPhone) || {}).value,
    location: getPartyMemberAddress(partyMember.personId, partyMember.memberType, personsApplications).address,
    dateOfBirth: personApplication && personApplication.applicationData.dateOfBirth,
  };
};

export const buildInitialBaseline = async (
  ctx,
  {
    partyMembers,
    partyPets,
    partyVehicles,
    personsApplications,
    additionalConditions,
    leaseTemplate,
    children,
    insuranceChoices,
    publishedQuoteLeaseData,
    propertyName,
    isCorporateParty,
    isEmployee,
    isRenewalLease,
    companyName,
    timezone,
  },
) => {
  const hasConcessions = !!publishedQuoteLeaseData.concessions[0] || !!publishedQuoteLeaseData.chargeConcessions[0];

  const baselineData = {
    timezone,
    residents: partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.RESIDENT).map(pm => baselineDataForPartyMember(pm, personsApplications)),
    guarantors: partyMembers.filter(pm => pm.memberType === DALTypes.MemberType.GUARANTOR).map(pm => baselineDataForPartyMember(pm, personsApplications)),
    occupants: [],
    partyRepresentative: [],
    children: children.map(c => ({
      ...c,
      name: c.info.fullName,
    })),
    pets: partyPets.map(p => ({
      id: p.id,
      name: p.info.name,
      type: p.info.type,
      breed: p.info.breed,
      weight: t(p.info.size),
      sex: t(p.info.sex),
      age: p.info.age,
      color: p.info.color,
      isServiceAnimal: p.info.isServiceAnimal,
    })),
    vehicles: partyVehicles.map(v => ({
      id: v.id,
      name: v.info.makeAndModel,
      makeModel: v.info.makeAndModel,
      year: v.info.makeYear,
      license: v.info.tagNumber,
      state: v.info.state,
      color: v.info.color,
    })),
    additionalConditions,
    hasConcessions,
    propertyName,
    isCorporateParty,
    isEmployee,
    isRenewalLease,
    companyName,
  };

  if (insuranceChoices && insuranceChoices.length) {
    baselineData.defaultInsuranceSelected = insuranceChoices[0].info.defaultInsuranceSelected;
  }

  const { documents } = getEnhancedLeaseObject(ctx, leaseTemplate.templateData, baselineData, false);
  const trimmedDocuments = Object.keys(documents).reduce((acc, documentId) => {
    const { fields, ...rest } = documents[documentId];
    acc[documentId] = rest;
    return acc;
  }, {});

  baselineData.documents = trimmedDocuments;
  return baselineData;
};

const throwExceptionIfAmountIsNotANumber = (ctx, amount, name) => {
  if (isNaN(amount)) {
    logger.error({ amount, ctx }, `${name} has an invalid amount.`);
    throw new Error('The baseline data is invalid.');
  }
};

const getTotalAdditionalRent = additionalCharges =>
  Object.keys(additionalCharges).length
    ? Object.keys(additionalCharges).reduce((sum, value, index, chargeIds) => {
        const chargeId = chargeIds[index];
        return sum + parseFloat(additionalCharges[chargeId].amount);
      }, 0)
    : 0;

const getNumberOfBedrooms = inventory => {
  const inventoryType = inventory.layout && inventory.layout.inventoryType;
  if (inventoryType !== DALTypes.InventoryType.UNIT) return '';
  const numOfBedrooms = inventory.layout.numBedrooms;
  return numOfBedrooms === 0 ? 'Studio' : `${numOfBedrooms}BR`;
};

const getUtilityFlag = (propertiesWithUtility, propertyName) => (propertiesWithUtility.includes(propertyName) ? 'X' : '');

const addOtherInfoToBaseLine = (baselineData, infoToAdd) => {
  const {
    propertySettings,
    rentersInsuranceFacts,
    publishedLease,
    totalPetRent,
    totalPetDeposit,
    moveInPetRent,
    propertyName,
    occupants,
    partyRepresentative,
  } = infoToAdd;

  const baseline = { ...baselineData };
  baseline.occupants = occupants;
  baseline.partyRepresentative = partyRepresentative;
  baseline.officeWorkingTime = propertySettings.officeWorkingTime;
  baseline.buyInsuranceFlag = rentersInsuranceFacts === 'buyInsuranceFlag' ? 'X' : '';
  baseline.takeOwnerInsuranceFlag = rentersInsuranceFacts === 'takeOwnerInsuranceFlag' ? 'X' : '';
  baseline.hasConcessions = !!Object.keys(publishedLease.concessions || {})[0];
  baseline.hasPets = !!(totalPetRent || totalPetDeposit || moveInPetRent);
  baseline.countersignerDescriptor = propertySettings.countersignerDescriptor;
  baseline.electricityProvidedFlag = ''; // false for all properties
  baseline.waterProvidedFlag = ''; // false for all properties
  baseline.naturalGasProvidedFlag = getUtilityFlag(naturalGasProvidedProperties, propertyName);
  baseline.cableTvProvidedFlag = ''; // false for all properties
  baseline.internetProvidedFlag = ''; // false for all properties
  baseline.submeterAddendumFlag = getUtilityFlag(submeterAddendumProperties, propertyName);
  baseline.utilityAddendumFlag = getUtilityFlag(utilityAddendumProperties, propertyName);
  baseline.waterSubmeteredFlag = 'X';
  baseline.electricitySubmeteredFlag = '';
  baseline.naturalGasSubmeteredFlag = '';
  baseline.leadDisclosureClause = propertySettings.leadDisclosureClause;

  return baseline;
};

export const enhanceBaseline = async (
  ctx,
  { publishedTerm: leaseTerm, inventory, concessions, additionalAndOneTimeCharges, propertyAddress, unitAddress, buildingAddress, partyId },
  baselineData,
) => {
  const { name: propertyName } = inventory.property;
  const fees = await getFeesByPropertyId(ctx, inventory.propertyId);
  const { publishedLease, timezone } = baselineData;
  const {
    leaseStartDate,
    moveInDate,
    leaseEndDate,
    unitRent,
    termLength,
    rentersInsuranceFacts,
    selectedOccupants = [],
    selectedPartyRepresentativeId = '',
  } = publishedLease;
  leaseTerm.originalTermLength = leaseTerm.termLength;
  leaseTerm.termLength = termLength;
  const { applicationFeeAmount, nsfFee, lateFee, holdDeposit: defaultHoldDeposit } = getFees(fees);

  const partyMembers = await loadPartyMembers(ctx, partyId);

  const occupants = partyMembers.filter(pm => selectedOccupants.find(id => id === pm.id)).map(pm => baselineDataForPartyMember(pm));
  const partyRepresentative = partyMembers.filter(pm => selectedPartyRepresentativeId === pm.id).map(pm => baselineDataForPartyMember(pm));
  const additionalCharges = enhanceCharges(ctx, {
    selectedCharges: publishedLease.additionalCharges,
    allCharges: additionalAndOneTimeCharges,
    period: leaseTerm.period,
  });

  const oneTimeCharges = enhanceCharges(ctx, {
    selectedCharges: publishedLease.oneTimeCharges,
    allCharges: additionalAndOneTimeCharges,
    period: leaseTerm.period,
  });

  const totalPetRent = getChargesByType(additionalCharges, DALTypes.QuoteSection.PET);
  const totalStorageRent = getChargesByType(additionalCharges, DALTypes.QuoteSection.STORAGE);
  const totalParkingRent = getChargesByType(additionalCharges, DALTypes.QuoteSection.PARKING);

  const petRentQuantity = getChargeQuantityByName(additionalCharges, DALTypes.FeeName.PET_RENT);
  const petRent = getOneItemChargeByName(additionalCharges, DALTypes.FeeName.PET_RENT);

  const serviceAnimalQuantity = getChargeQuantityByName(additionalCharges, DALTypes.FeeName.SERVICE_ANIMAL_RENT);
  const serviceAnimalRent = getOneItemChargeByName(additionalCharges, DALTypes.FeeName.SERVICE_ANIMAL_RENT);

  const totalAdditionalRent = getTotalAdditionalRent(additionalCharges);
  throwExceptionIfAmountIsNotANumber(ctx, totalAdditionalRent, 'totalAdditionalRent');

  const moveInPetRent = getMoveInRent(leaseStartDate, totalPetRent, timezone);
  throwExceptionIfAmountIsNotANumber(ctx, moveInPetRent, 'moveInPetRent');

  const moveInRent = getMoveInRent(leaseStartDate, unitRent, timezone);
  throwExceptionIfAmountIsNotANumber(ctx, moveInRent, 'moveInRent');

  const unitDeposit = parseFloat(getSecurityDepositAmount(oneTimeCharges, leaseTerm.id));
  throwExceptionIfAmountIsNotANumber(ctx, unitDeposit, 'unitDeposit');

  const holdDeposit = parseFloat(getHoldDepositAmount(oneTimeCharges, leaseTerm.id));
  throwExceptionIfAmountIsNotANumber(ctx, holdDeposit, 'holdDeposit');

  const petDeposit = parseFloat(getPetDepositAmount(oneTimeCharges, leaseTerm.id)) / Math.max(petRentQuantity, 1);
  throwExceptionIfAmountIsNotANumber(ctx, petDeposit, 'petDeposit');

  const serviceAnimalDeposit = parseFloat(getServiceAnimalDepositAmount(oneTimeCharges, leaseTerm.id)) / Math.max(serviceAnimalQuantity, 1);
  throwExceptionIfAmountIsNotANumber(ctx, serviceAnimalDeposit, 'serviceAnimalDeposit');

  const totalPetDeposit =
    getChargesByNamePrefix(ctx, oneTimeCharges, DALTypes.FeeName.PET_DEPOSIT) +
    getChargesByNamePrefix(ctx, oneTimeCharges, DALTypes.FeeName.SERVICE_ANIMAL_DEPOSIT);
  throwExceptionIfAmountIsNotANumber(ctx, totalPetDeposit, 'totalPetDeposit');

  const totalPetDNARegistrationFee = getChargesByNamePrefix(ctx, oneTimeCharges, 'petDNARegistrationFee');
  throwExceptionIfAmountIsNotANumber(ctx, totalPetDeposit, 'totalPetDNARegistrationFee');

  const totalUpcharges = getChargesByNameMatching(ctx, additionalCharges, 'upcharge');
  throwExceptionIfAmountIsNotANumber(ctx, totalUpcharges, 'totalUpcharges');

  const totalUtilityCharges = getChargesByNameMatching(ctx, additionalCharges, 'utility');
  throwExceptionIfAmountIsNotANumber(ctx, totalUtilityCharges, 'totalUtilityCharges');

  const totalApplianceCharges = getChargesByNameMatching(ctx, additionalCharges, 'appliance');
  throwExceptionIfAmountIsNotANumber(ctx, totalApplianceCharges, 'totalApplianceCharges');

  const prorationStrategy = get(inventory, 'property.settings.quote.prorationStrategy', null);
  const selectedConcessions = getSelectedConcessions(concessions, publishedLease.concessions);
  const paymentsByPeriods = getLeaseTermPaymentsByPeriods({
    leaseTerm,
    leaseStartDate,
    leaseEndDate,
    prorationStrategy,
    selectedConcessions,
    timezone,
    unitRent,
  });

  // TODO: quick fix for CPM-8006, need to check whether this is something we should be doing all the time.
  // We basically ensure that we if the prorated value for the concession is beigger than 1st month rent, then at most we give the discount on first month rent
  const concessionOnMoveinCharges = getTotalConcessionsOnMoveInCharges(leaseStartDate, paymentsByPeriods, timezone);

  const totalConcessionOnMoveinCharges = concessionOnMoveinCharges > moveInRent ? moveInRent : concessionOnMoveinCharges;
  throwExceptionIfAmountIsNotANumber(ctx, totalConcessionOnMoveinCharges, 'totalConcessionOnMoveinCharges');

  const moveinRentEndDate = getMoveinRentEndDate(leaseStartDate, timezone);

  const overallPetFee = getChargesByNamePrefix(ctx, oneTimeCharges, DALTypes.FeeName.PET_FEE);
  throwExceptionIfAmountIsNotANumber(ctx, overallPetFee, 'overallPetFee');

  const overallServiceAnimalFee = getChargesByNamePrefix(ctx, oneTimeCharges, DALTypes.FeeName.SERVICE_ANIMAL_FEE);
  throwExceptionIfAmountIsNotANumber(ctx, overallPetFee, 'overallServiceAnimalFee');

  const totalPetFee = overallPetFee + overallServiceAnimalFee;
  throwExceptionIfAmountIsNotANumber(ctx, totalPetFee, 'totalPetFee');

  const adjustedPetFee = overallPetFee / Math.max(petRentQuantity, 1);
  const adjustedServiceAnimalFee = overallServiceAnimalFee / Math.max(serviceAnimalQuantity, 1);

  const adjustedAdminFee = getChargesByNamePrefix(ctx, oneTimeCharges, 'AdminFee');

  const adjustedAccountActivationFee = baselineData.isRenewalLease ? 0 : getChargesByNamePrefix(ctx, oneTimeCharges, 'AccountActivationFee');

  const totalHoldDeposit = holdDeposit === 0 || holdDeposit ? holdDeposit : defaultHoldDeposit;
  throwExceptionIfAmountIsNotANumber(ctx, totalHoldDeposit, 'totalHoldDeposit');

  const totalMonthlyRent = unitRent + totalAdditionalRent;

  const moveinAdditionalRent = getMoveInRent(leaseStartDate, totalAdditionalRent, timezone);
  throwExceptionIfAmountIsNotANumber(ctx, moveinAdditionalRent, 'totalAdditionalRent');

  const numberOfBedrooms = getNumberOfBedrooms(inventory);

  const propertySettings = getLeaseSettingsForProperty(propertyName);

  const totalPetOneTimeServiceFee = totalPetDNARegistrationFee + totalPetFee;

  const subTotalOfMoveinCharges = getSubTotalOfMoveinCharges({
    unitDeposit,
    moveInRent,
    totalPetOneTimeServiceFee,
    totalPetDeposit,
    moveinAdditionalRent,
    totalConcessionOnMoveinCharges,
  });

  const totalMoveInCharges = getTotalMoveInCharges({
    unitDeposit,
    moveInRent,
    totalPetDeposit,
    totalPetOneTimeServiceFee,
    totalHoldDeposit,
    moveinAdditionalRent,
    totalConcessionOnMoveinCharges,
  });

  const otherLeaseTermFlag = termLength !== 12 && termLength !== 1 ? 'X' : '';
  const otherLeaseTerm = otherLeaseTermFlag === 'X' ? termLength : '';
  const {
    concessionsDescription,
    concessionsAmount: concessionsAmountPeriod,
    hasRecurringConcessions,
    hasOneTimeConcessions,
  } = getConcessionsAmountAndDescription({
    concessions,
    publishedLease,
    paymentsByPeriods,
    leaseTerm,
  });

  const { complimentaryItems = [] } = inventory;

  const getComplimentaryItemsByType = itemType =>
    complimentaryItems
      .filter(i => i.type === itemType)
      .map(item => ({
        buildingText: item.secondaryName,
        displayName: item.name,
        marketRent: 0,
        complimentary: true,
      }));

  const complimentaryParkingSpaces = getComplimentaryItemsByType(DALTypes.InventoryType.PARKING);
  const complimentaryStorageSpaces = getComplimentaryItemsByType(DALTypes.InventoryType.STORAGE);

  const additionalParkingSpaces = getParkingSpaces(additionalCharges);
  const additionalStorages = getStorageSpaces(additionalCharges);
  const storageSpaces = additionalStorages.concat(complimentaryStorageSpaces);
  const parkingSpaces = additionalParkingSpaces.concat(complimentaryParkingSpaces);
  const { oneTime: oneTimeTotalConcessionAmount, recurring: recurringTotalConcessionAmount } = getConcessionsTotalAmount({
    paymentsByPeriods,
    selectedConcessions,
    leaseTerm,
    publishedLease,
  });
  const leaseLength = termLength;
  const recurringConcessionLeaseLength = recurringTotalConcessionAmount > 0 ? termLength : null;
  const concessionInstallment = recurringTotalConcessionAmount > 0 ? recurringTotalConcessionAmount / leaseLength : null;
  const firstReccurringConcession = getFirstReccurringConcession(selectedConcessions);
  const recurrenceCount =
    firstReccurringConcession && firstReccurringConcession.recurringCount > 0 ? firstReccurringConcession.recurringCount : recurringConcessionLeaseLength;

  baselineData.quote = {
    propertyName: inventory.property.displayName,
    propertyAddress,
    propertyPhone: propertySettings.propertyPhone || inventory.property.displayPhone,
    unitAddress,
    buildingAddress,
    totalConcessionOnMoveinCharges,
    unitName: `${inventory.building.displayName}-${inventory.name}`,
    leaseTerm: `${termLength} ${leaseTerm.period}s`,
    leaseStartDate,
    leaseEndDate,
    moveinRentEndDate,
    unitRent,
    monthlyRate: leaseTerm.adjustedMarketRent,
    unitDeposit,
    applicationFeeAmount,
    rentDueDay: propertySettings.rentDueDay,
    barbecuePolicy: propertySettings.barbecuePolicy,
    asbestosLocations: propertySettings.asbestosLocations,
    totalPetRent,
    totalStorageRent,
    totalParkingRent,
    nsfFee,
    petRent,
    petRentQuantity,
    petDeposit,
    serviceAnimalQuantity,
    lateFee,
    totalPetDeposit,
    serviceAnimalRent,
    subTotalOfMoveinCharges,
    totalAdditionalRent,
    totalMonthlyRent,
    moveinAdditionalRent,
    totalHoldDeposit,
    numberOfBedrooms,
    concessionsAmountPeriod,
    concessionsDescription,
    hasRecurringConcessions: hasRecurringConcessions ? 'X' : '',
    hasOneTimeConcessions: hasOneTimeConcessions ? 'X' : '',
    moveInPetRent,
    moveInDate,
    moveInRent,
    totalMoveInCharges,
    totalPetFee,
    totalPetDNARegistrationFee,
    totalPetOneTimeServiceFee,
    inventoryId: inventory.id,
    inventoryType: inventory.type,
    unitFullQualifiedName: `${propertyName}-${inventory.building.displayName}-${inventory.name}`,
    accept12MonthLeaseTermFlag: termLength === 12 ? 'X' : '',
    reject12MonthLeaseTermFlag: termLength !== 12 ? 'X' : '',
    monthToMonthLeaseTermFlag: termLength === 1 ? 'X' : '',
    otherLeaseTermFlag,
    otherLeaseTerm,
    parkingSpaces,
    storageSpaces,
    oneTimeTotalConcessionAmount,
    recurringTotalConcessionAmount,
    leaseLength,
    concessionInstallment,
    recurringConcessionLeaseLength,
    recurrenceCount,
    adminFee: adjustedAdminFee,
    accountActivationFee: adjustedAccountActivationFee,
    petFee: adjustedPetFee,
    serviceAnimalFee: adjustedServiceAnimalFee,
    totalUpcharges,
    totalUtilityCharges,
    totalApplianceCharges,
  };

  return addOtherInfoToBaseLine(baselineData, {
    occupants,
    partyRepresentative,
    propertySettings,
    rentersInsuranceFacts,
    publishedLease,
    totalPetRent,
    totalPetDeposit,
    moveInPetRent,
    propertyName,
  });
};

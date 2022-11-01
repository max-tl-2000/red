/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import difference from 'lodash/difference';
import merge from 'lodash/merge';
import { formatMoney } from '../../../common/money-formatter';
import { toMoment, parseAsInTimezone } from '../../../common/helpers/moment-utils';
import { bluemoonFieldMapping } from './bluemoon/fieldsMapping';
import { LeaseProviderName } from '../../../common/enums/enums';
import logger from '../../../common/helpers/logger';
import nullish from '../../../common/helpers/nullish';

const fieldDefaults = {
  mandatory: false,
  readOnly: false,
  type: 'Text',
  showOnForm: true,
  value: '',
};

const getCustomFieldsDefaults = (fields = [], fieldsMapping) => {
  const customFields = difference(Object.keys(fields), Object.keys(fieldsMapping));

  const defaultValuesForCustomFields = customFields.reduce((acc, c) => {
    acc[c] = { ...fieldDefaults };
    return acc;
  }, {});
  return defaultValuesForCustomFields;
};

export const fieldsMapping = (ctx, templateData, partyInformation) => {
  const {
    residents,
    guarantors,
    quote,
    vehicles,
    pets,
    officeWorkingTime,
    occupants,
    children,
    buyInsuranceFlag,
    takeOwnerInsuranceFlag,
    countersignerDescriptor,
    electricityProvidedFlag,
    waterProvidedFlag,
    naturalGasProvidedFlag,
    cableTvProvidedFlag,
    internetProvidedFlag,
    submeterAddendumFlag,
    utilityAddendumFlag,
    waterSubmeteredFlag,
    electricitySubmeteredFlag,
    naturalGasSubmeteredFlag,
    leadDisclosureClause,
    companyName,
    isCorporateParty,
    timezone,
  } = partyInformation;

  const serviceAnimals = pets.filter(p => p.isServiceAnimal);
  const nonServiceAnimals = pets.filter(p => !p.isServiceAnimal);

  const amountFormat = amount => formatMoney({ amount, currency: 'USD' }).result;

  const guarantorNames = guarantors.reduce((acc, guarantor) => [...acc, guarantor.name], []).join(', ');
  const getParkingSpaceValue = (idx, parkingSpaces = []) => parkingSpaces[idx] && parkingSpaces[idx].buildingText;
  const getParkingSpaceRent = (idx, parkingSpaces = []) => parkingSpaces[idx] && amountFormat(parkingSpaces[idx].marketRent);
  const getParkingFlag = (idx, parkingSpaces = []) => (parkingSpaces[idx] && parkingSpaces[idx].complimentary ? 'X' : '');
  const getParkingType = (idx, parkingSpaces = []) => parkingSpaces[idx] && parkingSpaces[idx].displayName;

  const { parkingSpaces } = quote;
  const getResidentName = i => (!isCorporateParty && residents[i] && residents[i].name) || '';

  const getOccupantName = i => occupants[i] && occupants[i].name;

  const getChildName = i => children[i] && children[i].name;

  // please note that dob is being stored here as YYYY-MM-DD and not as a full ISO srting so we need to use parseAsInTimezone in this case
  const getOccupantDOB = i =>
    occupants[i]?.dateOfBirth ? parseAsInTimezone(occupants[i].dateOfBirth, { format: 'YYYY-MM-DD', timezone: 'UTC' }).format('MM/DD/YYYY') : '';

  const mapping = {
    ACCEPT12MONTHLEASETERMFLAG: {
      value: quote.accept12MonthLeaseTermFlag,
    },
    ASBESTOSLOCATIONS: {
      value: quote.asbestosLocations,
    },
    BUILDINGADDRESS: {
      value: quote.buildingAddress,
    },
    BUYINSURANCEFLAG: {
      value: buyInsuranceFlag,
    },
    CARPORTNUMBERS: {
      value: '', // not in pilot V1
    },
    CONCESSIONAMOUNTPERIOD1: {
      value: quote.concessionsAmountPeriod && quote.concessionsAmountPeriod[0],
    },
    CONCESSIONAMOUNTPERIOD2: {
      value: quote.concessionsAmountPeriod && quote.concessionsAmountPeriod[1],
    },
    CONCESSIONAMOUNTPERIOD3: {
      value: quote.concessionsAmountPeriod && quote.concessionsAmountPeriod[2],
    },
    CONCESSIONAMOUNTPERIOD4: {
      value: quote.concessionsAmountPeriod && quote.concessionsAmountPeriod[3],
    },
    CONCESSIONDESCRIPTION1: {
      value: quote.concessionsDescription && quote.concessionsDescription[0],
    },
    CONCESSIONDESCRIPTION2: {
      value: quote.concessionsDescription && quote.concessionsDescription[1],
    },
    CONCESSIONDESCRIPTION3: {
      value: quote.concessionsDescription && quote.concessionsDescription[2],
    },
    CONCESSIONDESCRIPTION4: {
      value: quote.concessionsDescription && quote.concessionsDescription[3],
    },
    RECURRINGRENTCONCESSIONTYPEFLAG: {
      value: quote.hasRecurringConcessions,
    },
    ONETIMERENTCONCESSIONTYPEFLAG: {
      value: quote.hasOneTimeConcessions,
    },
    CONCESSIONINSTALLMENT: {
      value: quote.concessionInstallment,
      formatter: amountFormat,
    },
    RECURRINGCONCESSIONLEASELENGTH: {
      value: quote.recurringConcessionLeaseLength,
    },
    COUNTERSIGNERDESCRIPTOR: {
      value: countersignerDescriptor,
    },
    GARAGENUMBERS: {
      value: '', // not in pilot V1
    },
    LATEFEE: {
      value: quote.lateFee,
      formatter: amountFormat,
    },
    LEADDISCLOSURECLAUSE: {
      value: leadDisclosureClause,
    },
    LEASECREATEDON: {
      value: quote.leaseStartDate, // TODO: Needs to be replaced by the published date
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    LEASEFROM: {
      value: quote.leaseStartDate,
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    LEASEFROMDAY: {
      value: toMoment(quote.leaseStartDate, { timezone }).format('Do'),
    },
    LEASEFROMMONTH: {
      value: toMoment(quote.leaseStartDate, { timezone }).format('MMMM, YYYY'),
    },
    LEASETO: {
      value: quote.leaseEndDate,
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    LEASELENGTH: {
      value: quote.leaseLength,
    },
    LESSEE1PHONE1: {
      value: residents[0] && residents[0].phone1,
    },
    LESSEE1PHONE2: {
      value: residents[0] && residents[0].phone2,
    },
    LESSEENAME1: {
      value: getResidentName(0) || companyName,
    },
    LESSEENAME2: {
      value: getResidentName(1),
    },
    LESSEENAME3: {
      value: getResidentName(2),
    },
    LESSEENAME4: {
      value: getResidentName(3),
    },
    LESSEENAME5: {
      value: getResidentName(4),
    },
    LESSEENAME6: {
      value: getResidentName(5),
    },
    LESSEENAME7: {
      value: getResidentName(6),
    },
    LESSEEEMAIL1: {
      value: residents[0] && residents[0].email,
    },
    LESSEEEMAIL2: {
      value: residents[1] && residents[1].email,
    },
    LESSEEEMAIL3: {
      value: residents[2] && residents[2].email,
    },
    LESSEEEMAIL4: {
      value: residents[3] && residents[3].email,
    },
    LESSEEEMAIL5: {
      value: residents[4] && residents[4].email,
    },
    LESSEEEMAIL6: {
      value: residents[5] && residents[5].email,
    },
    LESSEEEMAIL7: {
      value: residents[6] && residents[6].email,
    },
    MONTHTOMONTHLEASETERMFLAG: {
      value: quote.monthToMonthLeaseTermFlag,
    },
    MOVEINADDITIONALRENT: {
      value: quote.moveinAdditionalRent,
      formatter: amountFormat,
    },
    MOVEINDATE: {
      value: quote.moveInDate,
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    MOVEINDATELONG: {
      value: quote.moveInDate,
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    MOVEINDAY: {
      value: toMoment(quote.moveInDate, { timezone }).format('Do'),
    },
    MOVEINMONTH: {
      value: toMoment(quote.moveInDate, { timezone }).format('MMM, YYYY'),
    },
    MOVEINPETRENT: {
      value: quote.moveInPetRent,
      formatter: amountFormat,
    },
    MOVEINRENTENDDATE: {
      value: quote.moveinRentEndDate,
      formatter: v => toMoment(v, { timezone }).format('MMM DD, YYYY'),
    },
    MOVEINUNITRENT: {
      value: quote.moveInRent,
      formatter: amountFormat,
    },
    MOVEINUNITRENT_N: {
      value: quote.moveInRent,
    },
    NSFFEE: {
      value: quote.nsfFee,
      formatter: amountFormat,
    },
    PETRENT1: {
      value: quote.petRent,
      formatter: amountFormat,
    },
    PETFEE1: {
      value: quote.petFee,
      formatter: amountFormat,
    },
    PETDEPOSIT1: {
      value: quote.petDeposit,
      formatter: amountFormat,
    },
    NUMBEROFBEDROOMS: {
      value: quote.numberOfBedrooms,
    },
    OCCUPANTNAME1: {
      value: getOccupantName(0),
    },
    OCCUPANTDOB1: {
      value: getOccupantDOB(0),
    },
    OCCUPANTNAME2: {
      value: getOccupantName(1),
    },
    OCCUPANTDOB2: {
      value: getOccupantDOB(1),
    },
    OCCUPANTNAME3: {
      value: getOccupantName(2),
    },
    OCCUPANTDOB3: {
      value: getOccupantDOB(2),
    },
    OCCUPANTNAME4: {
      value: getOccupantName(3),
    },
    OCCUPANTDOB4: {
      value: getOccupantDOB(3),
    },
    OCCUPANTNAME5: {
      value: getOccupantName(4),
    },
    OCCUPANTDOB5: {
      value: getOccupantDOB(4),
    },
    OCCUPANTNAME6: {
      value: getOccupantName(5),
    },
    OCCUPANTDOB6: {
      value: getOccupantDOB(5),
    },
    OCCUPANTNAME7: {
      value: getOccupantName(6),
    },
    OCCUPANTDOB7: {
      value: getOccupantDOB(6),
    },
    OCCUPANTNAMES: {
      value: occupants.map(c => c.name).join(', '),
    },
    CHILDNAME1: {
      value: getChildName(0),
    },
    CHILDNAME2: {
      value: getChildName(1),
    },
    CHILDNAME3: {
      value: getChildName(2),
    },
    CHILDNAME4: {
      value: getChildName(3),
    },
    CHILDNAME5: {
      value: getChildName(4),
    },
    CHILDNAME6: {
      value: getChildName(5),
    },
    CHILDRENNAMES: {
      value: children.map(c => c.name).join(', '),
    },
    OFFICEDAYS1: {
      value: officeWorkingTime.officeDays1,
    },
    OFFICEDAYS2: {
      value: officeWorkingTime.officeDays2,
    },
    OFFICEDAYS3: {
      value: officeWorkingTime.officeDays3,
    },
    OFFICEHOURS1: {
      value: officeWorkingTime.officeHours1,
    },
    OFFICEHOURS2: {
      value: officeWorkingTime.officeHours2,
    },
    OFFICEHOURS3: {
      value: officeWorkingTime.officeHours3,
    },
    OTHERLEASETERM: {
      value: quote.otherLeaseTerm,
    },
    OTHERLEASETERMFLAG: {
      value: quote.otherLeaseTermFlag,
    },
    BARBECUEPOLICY: {
      value: quote.barbecuePolicy,
    },
    PARKINGNUMBERS: {
      value: '', // not in pilot v1
    },
    PARKINGSPACE1: {
      value: getParkingSpaceValue(0, parkingSpaces),
    },
    PARKINGSPACE2: {
      value: getParkingSpaceValue(1, parkingSpaces),
    },
    PARKINGSPACE3: {
      value: getParkingSpaceValue(2, parkingSpaces),
    },
    PARKINGSPACE4: {
      value: getParkingSpaceValue(3, parkingSpaces),
    },
    PARKINGSPACE5: {
      value: getParkingSpaceValue(4, parkingSpaces),
    },
    PARKINGRENT1: {
      value: getParkingSpaceRent(0, parkingSpaces),
    },
    PARKINGRENT2: {
      value: getParkingSpaceRent(1, parkingSpaces),
    },
    PARKINGRENT3: {
      value: getParkingSpaceRent(2, parkingSpaces),
    },
    PARKINGRENT4: {
      value: getParkingSpaceRent(3, parkingSpaces),
    },
    PARKINGRENT5: {
      value: getParkingSpaceRent(4, parkingSpaces),
    },
    COMPLIMENTARYPARKINGFLAG1: {
      value: getParkingFlag(0, parkingSpaces),
    },
    COMPLIMENTARYPARKINGFLAG2: {
      value: getParkingFlag(1, parkingSpaces),
    },
    COMPLIMENTARYPARKINGFLAG3: {
      value: getParkingFlag(2, parkingSpaces),
    },
    COMPLIMENTARYPARKINGFLAG4: {
      value: getParkingFlag(3, parkingSpaces),
    },
    COMPLIMENTARYPARKINGFLAG5: {
      value: getParkingFlag(4, parkingSpaces),
    },
    PARKINGSPACETYPE1: {
      value: getParkingType(0, parkingSpaces),
    },
    PARKINGSPACETYPE2: {
      value: getParkingType(1, parkingSpaces),
    },
    PARKINGSPACETYPE3: {
      value: getParkingType(2, parkingSpaces),
    },
    PARKINGSPACETYPE4: {
      value: getParkingType(3, parkingSpaces),
    },
    PARKINGSPACETYPE5: {
      value: getParkingType(4, parkingSpaces),
    },
    PROPERTYPHONE: {
      value: quote.propertyPhone,
    },
    PETAGE1: {
      value: pets[0] && pets[0].age,
    },
    PETAGE2: {
      value: pets[1] && pets[1].age,
    },
    PETAGE3: {
      value: pets[2] && pets[2].age,
    },
    PETBREED1: {
      value: pets[0] && pets[0].breed,
    },
    PETBREED2: {
      value: pets[1] && pets[1].breed,
    },
    PETBREED3: {
      value: pets[2] && pets[2].breed,
    },
    PETCOLOR1: {
      value: pets[0] && pets[0].color,
    },
    PETCOLOR2: {
      value: pets[1] && pets[1].color,
    },
    PETCOLOR3: {
      value: pets[2] && pets[2].color,
    },
    PETLICENSE1: {
      value: pets[0] && pets[0].license,
    },
    PETLICENSE2: {
      value: pets[1] && pets[1].license,
    },
    PETLICENSE3: {
      value: pets[2] && pets[2].license,
    },
    PETNAME1: {
      value: pets[0] && pets[0].name,
    },
    PETNAME2: {
      value: pets[1] && pets[1].name,
    },
    PETNAME3: {
      value: pets[2] && pets[2].name,
    },
    PETSEX1: {
      value: pets[0] && pets[0].sex,
    },
    PETSEX2: {
      value: pets[1] && pets[1].sex,
    },
    PETSEX3: {
      value: pets[2] && pets[2].sex,
    },
    PETTYPE1: {
      value: pets[0] && pets[0].type,
    },
    PETTYPE2: {
      value: pets[1] && pets[1].type,
    },
    PETTYPE3: {
      value: pets[2] && pets[2].type,
    },
    PETWEIGHT1: {
      value: pets[0] && pets[0].weight,
    },
    PETWEIGHT2: {
      value: pets[1] && pets[1].weight,
    },
    PETWEIGHT3: {
      value: pets[2] && pets[2].weight,
    },
    SERVICEANIMALNAME1: {
      value: serviceAnimals[0] && serviceAnimals[0].name,
    },
    SERVICEANIMALNAME2: {
      value: serviceAnimals[1] && serviceAnimals[1].name,
    },
    SERVICEANIMALNAME3: {
      value: serviceAnimals[2] && serviceAnimals[2].name,
    },
    SERVICEANIMALNAME4: {
      value: serviceAnimals[3] && serviceAnimals[3].name,
    },
    SERVICEANIMALNAME5: {
      value: serviceAnimals[4] && serviceAnimals[4].name,
    },
    SERVICEANIMALTYPE1: {
      value: serviceAnimals[0] && serviceAnimals[0].type,
    },
    SERVICEANIMALTYPE2: {
      value: serviceAnimals[1] && serviceAnimals[1].type,
    },
    SERVICEANIMALTYPE3: {
      value: serviceAnimals[2] && serviceAnimals[2].type,
    },
    SERVICEANIMALTYPE4: {
      value: serviceAnimals[3] && serviceAnimals[3].type,
    },
    SERVICEANIMALTYPE5: {
      value: serviceAnimals[4] && serviceAnimals[4].type,
    },
    SERVICEANIMALBREED1: {
      value: serviceAnimals[0] && serviceAnimals[0].breed,
    },
    SERVICEANIMALBREED2: {
      value: serviceAnimals[1] && serviceAnimals[1].breed,
    },
    SERVICEANIMALBREED3: {
      value: serviceAnimals[2] && serviceAnimals[2].breed,
    },
    SERVICEANIMALBREED4: {
      value: serviceAnimals[3] && serviceAnimals[3].breed,
    },
    SERVICEANIMALBREED5: {
      value: serviceAnimals[4] && serviceAnimals[4].breed,
    },
    SERVICEANIMALSEX1: {
      value: serviceAnimals[0] && serviceAnimals[0].sex,
    },
    SERVICEANIMALSEX2: {
      value: serviceAnimals[1] && serviceAnimals[1].sex,
    },
    SERVICEANIMALSEX3: {
      value: serviceAnimals[2] && serviceAnimals[2].sex,
    },
    SERVICEANIMALSEX4: {
      value: serviceAnimals[3] && serviceAnimals[3].sex,
    },
    SERVICEANIMALSEX5: {
      value: serviceAnimals[4] && serviceAnimals[4].sex,
    },
    SERVICEANIMALLICENSE1: {
      value: serviceAnimals[0] && serviceAnimals[0].license,
    },
    SERVICEANIMALLICENSE2: {
      value: serviceAnimals[1] && serviceAnimals[1].license,
    },
    SERVICEANIMALLICENSE3: {
      value: serviceAnimals[2] && serviceAnimals[2].license,
    },
    SERVICEANIMALLICENSE4: {
      value: serviceAnimals[3] && serviceAnimals[3].license,
    },
    SERVICEANIMALLICENSE5: {
      value: serviceAnimals[4] && serviceAnimals[4].license,
    },
    SERVICEANIMALAGE1: {
      value: serviceAnimals[0] && serviceAnimals[0].age,
    },
    SERVICEANIMALAGE2: {
      value: serviceAnimals[1] && serviceAnimals[1].age,
    },
    SERVICEANIMALAGE3: {
      value: serviceAnimals[2] && serviceAnimals[2].age,
    },
    SERVICEANIMALAGE4: {
      value: serviceAnimals[3] && serviceAnimals[3].age,
    },
    SERVICEANIMALAGE5: {
      value: serviceAnimals[4] && serviceAnimals[4].age,
    },
    SERVICEANIMALWEIGHT1: {
      value: serviceAnimals[0] && serviceAnimals[0].weight,
    },
    SERVICEANIMALWEIGHT2: {
      value: serviceAnimals[1] && serviceAnimals[1].weight,
    },
    SERVICEANIMALWEIGHT3: {
      value: serviceAnimals[2] && serviceAnimals[2].weight,
    },
    SERVICEANIMALWEIGHT4: {
      value: serviceAnimals[3] && serviceAnimals[3].weight,
    },
    SERVICEANIMALWEIGHT5: {
      value: serviceAnimals[4] && serviceAnimals[4].weight,
    },
    SERVICEANIMALCOLOR1: {
      value: serviceAnimals[0] && serviceAnimals[0].color,
    },
    SERVICEANIMALCOLOR2: {
      value: serviceAnimals[1] && serviceAnimals[1].color,
    },
    SERVICEANIMALCOLOR3: {
      value: serviceAnimals[2] && serviceAnimals[2].color,
    },
    SERVICEANIMALCOLOR4: {
      value: serviceAnimals[3] && serviceAnimals[3].color,
    },
    SERVICEANIMALCOLOR5: {
      value: serviceAnimals[4] && serviceAnimals[4].color,
    },
    SERVICEANIMALRENT1: {
      value: serviceAnimals[0] && quote.serviceAnimalRent,
      formatter: amountFormat,
    },
    SERVICEANIMALRENT2: {
      value: serviceAnimals[1] && quote.serviceAnimalRent,
      formatter: amountFormat,
    },
    SERVICEANIMALRENT3: {
      value: serviceAnimals[2] && quote.serviceAnimalRent,
      formatter: amountFormat,
    },
    SERVICEANIMALRENT4: {
      value: serviceAnimals[3] && quote.serviceAnimalRent,
      formatter: amountFormat,
    },
    SERVICEANIMALRENT5: {
      value: serviceAnimals[4] && quote.serviceAnimalRent,
      formatter: amountFormat,
    },
    SERVICEANIMALFEE1: {
      value: serviceAnimals[0] && quote.serviceAnimalFee,
      formatter: amountFormat,
    },
    SERVICEANIMALFEE2: {
      value: serviceAnimals[1] && quote.serviceAnimalFee,
      formatter: amountFormat,
    },
    SERVICEANIMALFEE3: {
      value: serviceAnimals[2] && quote.serviceAnimalFee,
      formatter: amountFormat,
    },
    SERVICEANIMALFEE4: {
      value: serviceAnimals[3] && quote.serviceAnimalFee,
      formatter: amountFormat,
    },
    SERVICEANIMALFEE5: {
      value: serviceAnimals[4] && quote.serviceAnimalFee,
      formatter: amountFormat,
    },
    SERVICEANIMALDEPOSIT1: {
      value: serviceAnimals[0] && quote.serviceAnimalDeposit,
      formatter: amountFormat,
    },
    SERVICEANIMALDEPOSIT2: {
      value: serviceAnimals[1] && quote.serviceAnimalDeposit,
      formatter: amountFormat,
    },
    SERVICEANIMALDEPOSIT3: {
      value: serviceAnimals[2] && quote.serviceAnimalDeposit,
      formatter: amountFormat,
    },
    SERVICEANIMALDEPOSIT4: {
      value: serviceAnimals[3] && quote.serviceAnimalDeposit,
      formatter: amountFormat,
    },
    SERVICEANIMALDEPOSIT5: {
      value: serviceAnimals[4] && quote.serviceAnimalDeposit,
      formatter: amountFormat,
    },
    NONSERVICEANIMALNAME1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].name,
    },
    NONSERVICEANIMALNAME2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].name,
    },
    NONSERVICEANIMALNAME3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].name,
    },
    NONSERVICEANIMALTYPE1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].type,
    },
    NONSERVICEANIMALTYPE2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].type,
    },
    NONSERVICEANIMALTYPE3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].type,
    },
    NONSERVICEANIMALBREED1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].breed,
    },
    NONSERVICEANIMALBREED2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].breed,
    },
    NONSERVICEANIMALBREED3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].breed,
    },
    NONSERVICEANIMALSEX1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].sex,
    },
    NONSERVICEANIMALSEX2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].sex,
    },
    NONSERVICEANIMALSEX3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].sex,
    },
    NONSERVICEANIMALLICENSE1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].license,
    },
    NONSERVICEANIMALLICENSE2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].license,
    },
    NONSERVICEANIMALLICENSE3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].license,
    },
    NONSERVICEANIMALAGE1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].age,
    },
    NONSERVICEANIMALAGE2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].age,
    },
    NONSERVICEANIMALAGE3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].age,
    },
    NONSERVICEANIMALWEIGHT1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].weight,
    },
    NONSERVICEANIMALWEIGHT2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].weight,
    },
    NONSERVICEANIMALWEIGHT3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].weight,
    },
    NONSERVICEANIMALCOLOR1: {
      value: nonServiceAnimals[0] && nonServiceAnimals[0].color,
    },
    NONSERVICEANIMALCOLOR2: {
      value: nonServiceAnimals[1] && nonServiceAnimals[1].color,
    },
    NONSERVICEANIMALCOLOR3: {
      value: nonServiceAnimals[2] && nonServiceAnimals[2].color,
    },
    PROPERTYADDRESS: {
      value: quote.propertyAddress,
    },
    PROPERTYNAME: {
      value: quote.propertyName,
    },
    REJECT12MONTHLEASETERMFLAG: {
      value: quote.reject12MonthLeaseTermFlag,
    },
    RENTDUEDAY: {
      value: quote.rentDueDay,
    },
    STORAGESPACE1: {
      value: '', // not in pilot V1
    },
    STORAGESPACE2: {
      value: '', // not in pilot V1
    },
    STORAGESPACE3: {
      value: '', // not in pilot V1
    },
    SUBTOTALOFMOVEINCHARGES: {
      value: quote.subTotalOfMoveinCharges,
      formatter: amountFormat,
    },
    TAKEOWNERINSURANCEFLAG: {
      value: takeOwnerInsuranceFlag,
    },
    ELECTRICITYPROVIDEDFLAG: {
      value: electricityProvidedFlag,
    },
    WATERPROVIDEDFLAG: {
      value: waterProvidedFlag,
    },
    NATURALGASPROVIDEDFLAG: {
      value: naturalGasProvidedFlag,
    },
    CABLETVPROVIDEDFLAG: {
      value: cableTvProvidedFlag,
    },
    INTERNETPROVIDEDFLAG: {
      value: internetProvidedFlag,
    },
    SUBMETERADDENDUMFLAG: {
      value: submeterAddendumFlag,
    },
    UTILITYADDENDUMFLAG: {
      value: utilityAddendumFlag,
    },
    TOTALUPCHARGEFEES: {
      value: quote.totalUpcharges,
      formatter: amountFormat,
    },
    UNITRENTWITHUPCHARGES: {
      value: quote.unitRent + quote.totalUpcharges,
      formatter: amountFormat,
    },
    UNITRENTWITHRECURRINGCONCESSION: {
      value: quote.unitRent - quote.concessionInstallment,
      formatter: amountFormat,
    },
    TOTALUTILITYFEES: {
      value: quote.totalUtilityCharges,
      formatter: amountFormat,
    },
    TOTALAPPLIANCEFEES: {
      value: quote.totalApplianceCharges,
      formatter: amountFormat,
    },
    WATERSUBMETEREDFLAG: {
      value: waterSubmeteredFlag,
    },
    ELECTRICITYSUBMETEREDFLAG: {
      value: electricitySubmeteredFlag,
    },
    NATURALGASSUBMETEREDFLAG: {
      value: naturalGasSubmeteredFlag,
    },
    TOTALADDITIONALRENT: {
      value: quote.totalAdditionalRent,
      formatter: amountFormat,
    },
    TOTALHOLDDEPOSIT: {
      value: quote.totalHoldDeposit,
      formatter: amountFormat,
    },
    TOTALMONTHLYRENT: {
      value: quote.totalMonthlyRent,
      formatter: amountFormat,
    },
    TOTALONETIMECONCESSIONAMOUNT: {
      value: quote.oneTimeTotalConcessionAmount > 0 ? quote.oneTimeTotalConcessionAmount : null,
      formatter: amountFormat,
    },
    ONETIMECONCESSIONAPPLIEDMONTH: {
      value: quote.oneTimeTotalConcessionAmount > 0 ? toMoment(quote.leaseStartDate).format('MMMM, YYYY') : null,
    },
    TOTALRECURRINGCONCESSIONAMOUNT: {
      value: quote.recurringTotalConcessionAmount > 0 ? quote.recurringTotalConcessionAmount : null,
      formatter: amountFormat,
    },
    NUMBEROFRECURRINGCONCESSIONINSTALLMENTS: {
      value: quote.recurrenceCount,
    },
    TOTALCONCESSIONONMOVEINCHARGES: {
      value: quote.totalConcessionOnMoveinCharges,
      formatter: amountFormat,
    },
    TOTALMOVEINCHARGES: {
      value: quote.totalMoveInCharges,
      formatter: amountFormat,
    },
    TOTALPARKINGRENT: {
      value: quote.totalParkingRent,
      formatter: amountFormat,
    },
    TOTALPETDEPOSIT: {
      value: quote.totalPetDeposit,
      formatter: amountFormat,
    },
    TOTALPETDNAREGISTRATIONFEE: {
      value: quote.totalPetDNARegistrationFee,
      formatter: amountFormat,
    },
    TOTALPETFEE: {
      value: quote.totalPetFee,
      formatter: amountFormat,
    },
    TOTALPETONETIMESERVICEFEE: {
      value: quote.totalPetOneTimeServiceFee,
      formatter: amountFormat,
    },
    LEASEADMINISTRATIVEFEE: {
      value: quote.adminFee,
      formatter: amountFormat,
    },
    ACCOUNTACTIVATIONFEE: {
      value: quote.accountActivationFee,
      formatter: amountFormat,
    },
    TOTALPETRENT: {
      value: quote.totalPetRent,
      formatter: amountFormat,
    },
    TOTALSTORAGERENT: {
      value: quote.totalStorageRent,
      formatter: amountFormat,
    },
    UNITADDRESS: {
      value: quote.unitAddress,
    },
    UNITDEPOSIT: {
      value: quote.unitDeposit,
      formatter: amountFormat,
    },
    UNITNAME: {
      value: quote.unitName,
    },
    UNITRENT: {
      value: quote.unitRent,
      formatter: amountFormat,
    },
    VCOLOR1: {
      value: vehicles[0] && vehicles[0].color,
    },
    VCOLOR2: {
      value: vehicles[1] && vehicles[1].color,
    },
    VCOLOR3: {
      value: vehicles[2] && vehicles[2].color,
    },
    VLICPLATE1: {
      value: vehicles[0] && vehicles[0].license,
    },
    VLICPLATE2: {
      value: vehicles[1] && vehicles[1].license,
    },
    VLICPLATE3: {
      value: vehicles[2] && vehicles[2].license,
    },
    VMAKEMODEL1: {
      value: vehicles[0] && vehicles[0].makeModel,
    },
    VMAKEMODEL2: {
      value: vehicles[1] && vehicles[1].makeModel,
    },
    VMAKEMODEL3: {
      value: vehicles[2] && vehicles[2].makeModel,
    },
    VSTATE1: {
      value: vehicles[0] && vehicles[0].state,
    },
    VSTATE2: {
      value: vehicles[1] && vehicles[1].state,
    },
    VSTATE3: {
      value: vehicles[2] && vehicles[2].state,
    },
    VYEAR1: {
      value: vehicles[0] && vehicles[0].year,
    },
    VYEAR2: {
      value: vehicles[1] && vehicles[1].year,
    },
    VYEAR3: {
      value: vehicles[2] && vehicles[2].year,
    },
    GUARANTORNAMES: {
      value: guarantorNames,
    },
    GUARANTORADDRESS1: { value: '' },
    GUARANTORDOB1: { value: '' },
    GUARANTORNAME1: { value: '' },
    GUARANTORPHONE1: { value: '' },
  };

  const constructPetFields = (petsData, maxNo = 3) => {
    const petMapping = [
      { name: 'PETAGE', field: 'age' },
      { name: 'PETBREED', field: 'breed' },
      { name: 'PETCOLOR', field: 'color' },
      { name: 'PETLICENSE', field: 'license' },
      { name: 'PETNAME', field: 'name' },
      { name: 'PETSEX', field: 'sex' },
      { name: 'PETTYPE', field: 'type' },
      { name: 'PETWEIGHT', field: 'weight' },
    ];
    const result = petsData.reduce((acc, current, index) => {
      if (index >= maxNo) return acc;

      // this will construct the { PETAGE1: value: 1 } objects
      const fieldValuePair = petMapping.reduce((res, c) => {
        const fieldName = `${c.name}${index + 1}`; // PETAGE1, PETAGE2 etc
        const value = petsData[index] && petsData[index][c.field];
        return { ...res, [fieldName]: { value } };
      }, {});

      acc = {
        ...acc,
        ...fieldValuePair,
      };
      return acc;
    }, {});
    return result;
  };

  const enhanceFieldsWithDefaults = fieldsToEnhance =>
    Object.keys(fieldsToEnhance).reduce((acc, c) => {
      const fte = fieldsToEnhance[c];
      if (fte.formatter && !nullish(fte.value)) {
        fte.formattedValue = fte.formatter(fte.value);
      }
      acc[c] = { ...fieldDefaults, ...fte };
      return acc;
    }, {});

  const mapGuarantor = ({ location, dateOfBirth, name, phone1 }) => ({
    GUARANTORADDRESS1: location,
    GUARANTORDOB1: dateOfBirth,
    GUARANTORNAME1: name,
    GUARANTORPHONE1: phone1,
  });

  const guarantorFields = (guarantors || []).reduce((acc, guarantor) => {
    acc[guarantor.id] = mapGuarantor(guarantor);
    return acc;
  }, {});

  // Collect the fields when present at the document level
  const setDocFields = Object.keys(templateData.documents).reduce((accFields, key) => {
    const { fields } = templateData.documents[key];
    Object.keys(fields || {}).reduce((allFields, field) => {
      allFields[field] = fields[field];
      return allFields;
    }, accFields);
    return accFields;
  }, {});

  const MAX_NUMBER_OF_PETS_ON_LEASE = 7;
  const petFields = constructPetFields(pets, MAX_NUMBER_OF_PETS_ON_LEASE);
  const enhancedMapping = enhanceFieldsWithDefaults({ ...mapping, ...petFields });
  const customFields = getCustomFieldsDefaults(setDocFields, enhancedMapping);
  const setGlobalFields = templateData.globalFields || {};
  const bluemoonMergedMapping =
    templateData.leaseProvider === LeaseProviderName.BLUEMOON
      ? Object.keys(bluemoonFieldMapping).reduce((acc, key) => {
          const bmField = setGlobalFields[key];
          const fieldMapping = bluemoonFieldMapping[key];
          const result = enhancedMapping[fieldMapping.mapping] || customFields[fieldMapping.mapping];
          let value =
            fieldMapping.formatter && !nullish(result.value) ? fieldMapping.formatter(result.value, { timezone }) : result.formattedValue || result.value;
          if (bmField.maxLength && value?.length && value.length > bmField.maxLength) {
            logger.error({ ctx, bmField, fieldMapping, value }, `Leasing field too long for Bluemoon api: maxLength: ${bmField.maxLength} value: ${value}`);
            value = value.substring(value.length - bmField.maxLength);
          }
          acc[key] = { ...result, value };
          return acc;
        }, {})
      : {};

  const result = {
    ...merge(setDocFields, enhancedMapping),
    guarantorFields: {
      ...guarantorFields,
    },
    ...customFields,
    globalFields: bluemoonMergedMapping,
  };

  return result;
};

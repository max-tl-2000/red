/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../common/enums/DALTypes';
import { LA_TIMEZONE } from '../../common/date-constants';

export const mockApplicantData = [
  {
    legalName: 'Kathe Johnson',
    preferredName: 'Kathe J.',
    email: 'qatest+kathejohnson@reva.tech',
    dateOfBirth: '03/30/1985',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Kathe Johnson',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'John Doe',
    preferredName: 'John D.',
    email: 'ens7m.test@inbox.testmail.app',
    dateOfBirth: '03/30/1985',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'John Doe',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Joice Taylor',
    preferredName: 'Joice T.',
    email: 'qatest+joicetaylor@reva.tech',
    dateOfBirth: '03/30/1983',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Joice Taylor',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Lilli Brown',
    preferredName: 'Lilli B.',
    email: 'qatest+lillibrown@reva.tech',
    dateOfBirth: '05/19/1988',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Lilli Brown',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Oliver Smit',
    preferredName: 'Oliver S.',
    email: 'qatest+oliversmit@reva.tech',
    dateOfBirth: '06/09/1990',
    grossIncome: '4000',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Oliver Smit',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Julia Stevens',
    preferredName: 'Julia Stevens',
    email: 'qatest+juliastevens@reva.tech',
    phone: '+1 908 505 6524',
    formattedPhone: '(908) 505-6524',
    dateOfBirth: '03/30/1985',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Julia Stevens',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Henry Simpson',
    email: 'qatest+henrysimpson@reva.tech',
    preferredName: 'Henry Simpson',
    dateOfBirth: '03/30/1985',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Henry Simpson',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Maurice Walker',
    preferredName: 'Maurice Walker',
    email: 'qatest+mauricewalker@reva.tech',
    phone: '+1 908 505 6525',
    formattedPhone: '(908) 505-6525',
    dateOfBirth: '06/24/1980',
    grossIncome: '35000',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 2,
    cardInfo: {
      name: 'Maurice Walker',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '07',
      expirationYear: '2026',
    },
  },
  {
    legalName: 'Dariana Wells',
    preferredName: 'Dariana W.',
    email: 'qatest+darianawells@reva.tech',
    dateOfBirth: '06/09/1990',
    grossIncome: '4000',
    addressLine1: '422 Massachusetts Avenue Northwest',
    ownerName: 'qaOwnerName',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Dariana Wells',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Conn Ewald',
    preferredName: 'Conn E.',
    email: 'qatest+connewald@reva.tech',
    dateOfBirth: '06/09/1990',
    grossIncome: '4000',
    addressLine1: '422 Massachusetts Avenue Northwest',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    memberType: DALTypes.MemberType.RESIDENT,
    index: 1,
    cardInfo: {
      name: 'Conn Ewald',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
];

export const LeaseTypes = {
  NEW_LEASE: 'New lease',
  RENEWAL_LEASE: 'Renewal lease',
  TRANSFER_LEASE: 'Transfer lease',
  CORPORATE_LEASE: 'Corporate lease',
};

export const mockPartyData = {
  partyInfo: {
    properties: [
      {
        name: 'swparkme',
        displayName: 'Parkmerced Apartments',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'cove',
        displayName: 'The Cove at Tiburon',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'horizon',
        displayName: 'Empyrean Horizon',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'acme',
        displayName: 'Acme Apartments',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'sierra',
        displayName: 'Sierra Norte',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'coastal',
        displayName: 'Coastal Palace',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'seascape',
        displayName: 'Seascape Sunset',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
      {
        name: 'lakefront',
        displayName: 'Lakefront Beacon',
        timezone: LA_TIMEZONE,
        leaseTypes: [LeaseTypes.NEW_LEASE, LeaseTypes.TRANSFER_LEASE],
      },
    ],
    channel: 'Email',
  },
  contactInfoArray: [
    {
      legalName: 'Kathe Johnson',
      email: 'qatest+kathejohnson@reva.tech',
      phone: '+1 908 555 4625',
      formattedPhone: '(908) 555-4625',
      preferredName: 'Kathe J.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'John Doe',
      email: 'ens7m.test@inbox.testmail.app',
      phone: '+1 908 555 4620',
      formattedPhone: '(908) 555-4620',
      preferredName: 'John D.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Joice Taylor',
      email: 'qatest+joicetaylor@reva.tech',
      phone: '+1 908 522 6520',
      formattedPhone: '(908) 522-6520',
      preferredName: 'Joice T.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Lilli Brown',
      email: 'qatest+lillibrown@reva.tech',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
      preferredName: 'Lilli B.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Mathew Gates',
      email: 'qatest+mathewgates@reva.tech',
      phone: '+1 908 505 6520',
      formattedPhone: '(908) 505-6520',
      preferredName: 'Mathew G.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Oliver Smit',
      email: 'qatest+oliversmit@reva.tech',
      phone: '+1 908 555 4682',
      formattedPhone: '(908) 555-4682',
      preferredName: 'Oliver S.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Dariana Wells',
      email: 'qatest+darianawells@reva.tech',
      phone: '+1 908 555 5682',
      formattedPhone: '(908) 555-5682',
      preferredName: 'Dariana W.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
    {
      legalName: 'Conn Ewald',
      email: 'qatest+connewald@reva.tech',
      phone: '+1 908 444 5682',
      formattedPhone: '(908) 444-5682',
      preferredName: 'Conn E.',
      memberType: DALTypes.MemberType.RESIDENT,
      index: 1,
    },
  ],
  qualificationInfo: {
    bedrooms: '4+ beds',
    numBedsOption: '#FOUR_PLUS_BEDS',
    dropdownLeaseType: 'Employee',
    incomeQuestion: 'Yes',
    moveInTimeQuestion: '1 - 2 months',
    moveInTimeQuestionId: 'NEXT_2_MONTHS',
    companyQualificationInfo: {
      numberOfUnits: '1',
      leaseTerm: '9 months',
    },
  },
  qualificationInfoAcme: {
    bedrooms: '1 bed',
    numBedsOption: '#ONE_BED',
    dropdownLeaseType: 'Employee',
    incomeQuestion: 'Yes',
    moveInTimeQuestion: '1 - 2 months',
    moveInTimeQuestionId: 'NEXT_2_MONTHS',
    companyQualificationInfo: {
      numberOfUnits: '1',
      leaseTerm: '9 months',
    },
  },
  qualificationInfoSierra: {
    bedrooms: '2 beds',
    numBedsOption: '#TWO_BEDS',
    dropdownLeaseType: 'Employee',
    incomeQuestion: 'Yes',
    moveInTimeQuestion: '1 - 2 months',
    moveInTimeQuestionId: 'NEXT_2_MONTHS',
    companyQualificationInfo: {
      numberOfUnits: '1',
      leaseTerm: '3 months',
    },
  },
  companyInfo: {
    companyName: 'Reva',
    contactName: 'Josh Helpman',
    email: 'qatest+joshhelpman@reva.tech',
    phone: '+1 908 555 4570',
    formattedPhone: '(908) 555-4570',
  },
  occupantInfo: [
    {
      legalName: 'Michael Johnson',
      email: 'qatest+michaeljohnson@reva.tech',
      phone: '+1 908 555 4580',
      formattedPhone: '(908) 555-4580',
      preferredName: 'Michael J.',
    },
    {
      legalName: 'John Doe',
      email: 'qatest+johndoe@reva.tech',
      phone: '+1 908 555 2360',
      formattedPhone: '(908) 555-2360',
      preferredName: 'John D.',
    },
  ],
};

export const mockGuarantorInfo = [
  {
    legalName: 'Kattie Smith',
    email: 'qatest+kattiesmith@reva.tech',
    phone: '+51 984 745 999',
    preferredName: 'Kattie S.',
    dateOfBirth: '03/30/1985',
    grossIncome: '3500',
    addressLine1: '422 Massachusetts Avenue Northwest',
    city: 'Washington',
    state: 'Massachusetts (MA)',
    zipCode: '02474',
    privateDocuments: [],
    sharedDocuments: [],
    memberType: DALTypes.MemberType.GUARANTOR,
    index: 1,
    cardInfo: {
      name: 'Kattie Smith',
      number: '4242424242424242',
      cvv: '122',
      expirationDate: '03',
      expirationYear: '2025',
    },
  },
  {
    legalName: 'Mary Doe',
    email: 'qatest+marydoe@reva.tech',
    phone: '+1 908 522 2360',
    preferredName: 'Mary D.',
  },
];
const hasSpecials = true;
const parkmercedLeaseTerms1001 = [
  { term: '1 month', rentAmount: '$13,374' },
  { term: '3 months', rentAmount: '$12,153' },
  { term: '6 months', hasSpecials, rentAmount: '$12,764' },
  { term: '9 months', hasSpecials, rentAmount: '$12,458' },
  { term: '12 months', hasSpecials, rentAmount: '$12,153' },
  { term: '15 months', rentAmount: '$12,153' },
  { term: '24 months', hasSpecials, rentAmount: '$11,543' },
];

const parkmercedLeaseTerms1019 = [
  { term: '1 month', rentAmount: '$7,628' },
  { term: '3 months', rentAmount: '$6,933' },
  { term: '6 months', hasSpecials, rentAmount: '$7,280' },
  { term: '9 months', hasSpecials, rentAmount: '$7,107' },
  { term: '12 months', hasSpecials, rentAmount: '$6,933' },
  { term: '15 months', rentAmount: '$6,933' },
  { term: '24 months', hasSpecials, rentAmount: '$6,585' },
];

const parkmercedLeaseTerms1019WeekOne = [
  { term: '1 month', rentAmount: '$2,414' },
  { term: '3 months', rentAmount: '$2,012' },
  { term: '6 months', hasSpecials, rentAmount: '$2,213' },
  { term: '9 months', hasSpecials, rentAmount: '$2,113' },
  { term: '12 months', hasSpecials, rentAmount: '$2,012' },
  { term: '15 months', rentAmount: '$2,012' },
  { term: '24 months', hasSpecials, rentAmount: '$1,811' },
];

const parkmercedLeaseTerms1010 = [
  { term: '1 month', hasSpecials, rentAmount: '$9,709' },
  { term: '3 months', hasSpecials, rentAmount: '$8,125' },
  { term: '6 months', hasSpecials, rentAmount: '$8,917' },
  { term: '9 months', hasSpecials, rentAmount: '$8,521' },
  { term: '12 months', hasSpecials, rentAmount: '$8,125' },
  { term: '15 months', hasSpecials, rentAmount: '$8,125' },
  { term: '24 months', hasSpecials, rentAmount: '$7,333' },
];

const parkmercedLeaseTerms1010WeekOne = [
  { term: '1 month', hasSpecials, rentAmount: '$5,618' },
  { term: '3 months', hasSpecials, rentAmount: '$4,702' },
  { term: '6 months', hasSpecials, rentAmount: '$5,160' },
  { term: '9 months', hasSpecials, rentAmount: '$4,931' },
  { term: '12 months', hasSpecials, rentAmount: '$4,702' },
  { term: '15 months', hasSpecials, rentAmount: '$4,702' },
  { term: '24 months', hasSpecials, rentAmount: '$4,244' },
];

const parkmercedLeaseTermsBallantineRenewal = [
  { term: '1 month', rentAmount: '$2,450' },
  { term: '6 months', hasSpecials, rentAmount: '$2,246' },
  { term: '9 months', hasSpecials, rentAmount: '$2,144' },
  { term: '12 months', hasSpecials, rentAmount: '$2,042' },
  { term: '15 months', rentAmount: '$2,042' },
];
const parkmercedLeaseTerms125 = [
  { term: '1 month', hasSpecials, rentAmount: '$4,450' },
  { term: '3 months', hasSpecials, rentAmount: '$4,042' },
  { term: '6 months', hasSpecials, rentAmount: '$4,246' },
  { term: '9 months', hasSpecials, rentAmount: '$4,144' },
  { term: '12 months', hasSpecials, rentAmount: '$4,042' },
  { term: '12 months', hasSpecials, rentAmount: '$4,042' },
  { term: '15 months', hasSpecials, rentAmount: '$2,042' },
  { term: '24 months', hasSpecials, rentAmount: '$3,838' },
];
const parkmercedLeaseTerms1013 = [
  { term: '6 months', rentAmount: '$8,795' },
  { term: '9 months', rentAmount: '$8,395' },
  { term: '12 months', hasSpecials, rentAmount: '$7,995' },
  { term: '18 months', rentAmount: '$7,596' },
];
const horizonLeaseTerms1001 = [
  { term: '3 months', rentAmount: '$1,316' },
  { term: '6 months', rentAmount: '$1,249' },
  { term: '9 months', rentAmount: '$1,182' },
  { term: '12 months', hasSpecials, rentAmount: '$1,115' },
];
const horizonLeaseTerms4003 = [
  { term: '3 months', rentAmount: '$5,787' },
  { term: '6 months', rentAmount: '$5,493' },
  { term: '9 months', rentAmount: '$5,198' },
  { term: '12 months', hasSpecials, rentAmount: '$4,904' },
];
const coveLeaseTerms = [
  { term: '3 months' },
  { term: '4 months' },
  { term: '5 months' },
  { term: '6 months' },
  { term: '7 months' },
  { term: '8 months' },
  { term: '9 months' },
  { term: '10 months' },
  { term: '11 months' },
  { term: '12 months' },
  { term: '13 months' },
  { term: '14 months' },
];
const acmeLeaseTerms101 = [
  { term: '1 month', rentAmount: '$1,156' },
  { term: '3 months', rentAmount: '$1,156' },
  { term: '4 months', rentAmount: '$1,156' },
  { term: '5 months', rentAmount: '$1,156' },
  { term: '6 months', rentAmount: '$1,156' },
  { term: '7 months', rentAmount: '$1,156' },
  { term: '8 months', rentAmount: '$1,156' },
  { term: '9 months', rentAmount: '$1,156' },
  { term: '10 months', rentAmount: '$1,156' },
  { term: '11 months', rentAmount: '$1,156' },
  { term: '12 months', hasSpecials, rentAmount: '$1,156' },
  { term: '13 months', hasSpecials, rentAmount: '$1,156' },
  { term: '14 months', hasSpecials, rentAmount: '$1,156' },
];
const sierraLeaseTerms103 = [
  { term: '3 months', rentAmount: '$1,040' },
  { term: '4 months', rentAmount: '$1,040' },
  { term: '5 months', rentAmount: '$1,040' },
  { term: '6 months', rentAmount: '$1,040' },
  { term: '7 months', rentAmount: '$1,040' },
  { term: '8 months', rentAmount: '$1,040' },
  { term: '9 months', rentAmount: '$1,040' },
  { term: '10 months', rentAmount: '$1,040' },
  { term: '11 months', rentAmount: '$1,040' },
  { term: '12 months', rentAmount: '$1,040' },
];
const sierraLeaseTerms104 = [
  { term: '3 months', rentAmount: '$1,040' },
  { term: '4 months', rentAmount: '$1,040' },
  { term: '5 months', rentAmount: '$1,040' },
  { term: '6 months', rentAmount: '$1,040' },
  { term: '7 months', rentAmount: '$1,040' },
  { term: '8 months', rentAmount: '$1,040' },
  { term: '9 months', rentAmount: '$1,040' },
  { term: '10 months', rentAmount: '$1,040' },
  { term: '11 months', rentAmount: '$1,040' },
  { term: '12 months', rentAmount: '$1,040' },
];
const coveLeaseTerms001 = coveLeaseTerms.map(leaseTerm => ({ rentAmount: '$5,911', ...leaseTerm }));
const coveLeaseTerms005 = coveLeaseTerms.map(leaseTerm => ({ rentAmount: '$3,449', ...leaseTerm }));
const coveLeaseTerms008 = coveLeaseTerms.map(leaseTerm => ({ rentAmount: '$4,706', ...leaseTerm }));
const coveLeaseTerms009 = coveLeaseTerms.map(leaseTerm => ({ rentAmount: '$6,800', ...leaseTerm }));

const mockQuoteData = [
  {
    unitName: '1001',
    state: 'Notice',
    displayName: '3711-101 19th Ave, Unit 1001, San Francisco, CA 94132',
    layout: '4 beds, 3.5 baths, 1979 sqft, Abbot',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: 'Includes Complimentary',
        item: 'Locker, Storage large(s240)',
      },
      leaseTerms: parkmercedLeaseTerms1001,
    },
  },
  {
    unitName: '1019',
    leaseUnitName: 'swparkme-350AR-1019',
    state: 'Ready now',
    displayName: '3711-101 19th Ave, Unit 1019, San Francisco, CA 94132',
    increasedLeasePrice: '$4,002.00',
    leaseComplimentaryInfo: '3 beds, 3 baths (swparkme-350AR-1019)',
    layout: '3 beds, 3 baths, 2195 sqft, Abigton',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTerms1019,
    },
  },
  {
    unitName: '1019',
    weekNum: 1,
    leaseUnitName: 'swparkme-350AR-1019',
    state: 'Ready now',
    displayName: '3711-101 19th Ave, Unit 1019, San Francisco, CA 94132',
    increasedLeasePrice: '$4,002.00',
    leaseComplimentaryInfo: '3 beds, 3 baths (swparkme-350AR-1019)',
    layout: '3 beds, 3 baths, 2195 sqft, Abigton',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTerms1019WeekOne,
    },
  },
  {
    unitName: '1010',
    weekNum: 1,
    state: 'Notice',
    displayName: '3711-101 19th Ave, Unit 1010, San Francisco, CA 94132',
    layout: '4 beds, 3.5 baths, 1979 sqft, Abbot',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: 'Includes Complimentary',
        item: 'Parking indoor(p100)',
      },
      leaseTerms: parkmercedLeaseTerms1010WeekOne,
    },
  },
  {
    unitName: '1010',
    state: 'Notice',
    displayName: '3711-101 19th Ave, Unit 1010, San Francisco, CA 94132',
    layout: '4 beds, 3.5 baths, 1979 sqft, Abbot',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: 'Includes Complimentary',
        item: 'Parking indoor(p100)',
      },
      leaseTerms: parkmercedLeaseTerms1010,
    },
  },
  {
    unitName: '001SALT',
    leaseUnitName: 'cove-1-001SALT',
    leasePrice: '$3,421.00',
    increasedLeasePrice: '$5,800.00',
    leaseComplimentaryInfo: '1 bed, 1 bath (cove-1-001SALT)',
    state: 'Ready now',
    displayName: '1 Salt Landing, Belvedere Tiburon, CA 94920',
    layout: '1 bed, 1 bath, 640 sqft, 1x1 c',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: coveLeaseTerms001,
    },
  },
  {
    unitName: '005SALT',
    leaseUnitName: 'cove-1-005SALT',
    leasePrice: '$3,449.00',
    increasedLeasePrice: '$5,800.00',
    leaseComplimentaryInfo: '1 bed,  1 bath  (cove-1-005SALT)',
    state: 'Ready now',
    displayName: '5 Salt Landing, Belvedere Tiburon, CA 94920',
    layout: '1 bed, 1 bath, 595 sqft, 1x1 a',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: coveLeaseTerms005,
    },
  },
  {
    unitName: '006SALT',
    state: 'Ready now',
    displayName: '6 Salt Landing, Belvedere Tiburon, CA 94920',
    layout: '1 beds, 1 baths, 640 sqft, 1x1 c',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: coveLeaseTerms,
    },
  },
  {
    unitName: '008SALT',
    state: 'Ready now',
    displayName: '8 Salt Landing, Belvedere Tiburon, CA 94920',
    layout: '2 beds, 2 baths, 1080 sqft, 2x2 d',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: coveLeaseTerms008,
    },
  },
  {
    unitName: '009SALT',
    state: 'Ready now',
    displayName: '9 Salt Landing, Belvedere Tiburon, CA 94920',
    layout: '3 beds, 3 baths, 1375 sqft, 3x3 a',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: coveLeaseTerms009,
    },
  },
  {
    unitName: '1015',
    state: 'Notice',
    displayName: '3711-101 19th Ave, Unit 1015, San Francisco, CA 94132',
    layout: '2 beds, 2.5 baths, 1922 sqft, Ballantine',
    quote: {
      defaultLeaseTerm: '12 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTermsBallantineRenewal,
    },
  },
  {
    unitName: '1013',
    state: 'Ready now',
    displayName: '3711-101 19th Ave, Unit 1013, San Francisco, CA 94132',
    layout: '4 beds, 3.5 baths, 1979 sqft, Abbot',
    quote: {
      defaultLeaseTerm: '18 months',
      complimentaryItems: {
        textLabel: 'Includes Complimentary',
        item: 'Storage large(s100)',
      },
      leaseTerms: parkmercedLeaseTerms1013,
    },
  },
  {
    unitName: '1013',
    weekNum: 1,
    leaseUnitName: 'swparkme-350AR-1013',
    state: 'Ready now',
    increasedLeasePrice: '$8,400.00',
    displayName: '3711-101 19th Ave, Unit 1013, San Francisco, CA 94132',
    layout: '4 beds, 3.5 baths, 1979 sqft, Abbot',
    quote: {
      defaultLeaseTerm: '18 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTerms1013,
    },
  },
  {
    unitName: '125',
    state: 'Ready now',
    displayName: '3711-102 19th Ave, Unit 125, San Francisco, CA 94132',
    layout: '2 beds, 2.5 baths, 1922 sqft, Ballantine',
    quote: {
      defaultLeaseTerm: '24 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTerms125,
    },
  },
  {
    unitName: '1016',
    state: 'Notice',
    displayName: 'Unit 1016, 3711-101 19th Ave',
    layout: '2 beds, 2.5 baths, 1922 sqft, Ballantine',
    startingAtPrice: '$1,888',
    quote: {
      defaultLeaseTerm: '12 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: parkmercedLeaseTermsBallantineRenewal,
    },
    lease: {
      unitInfo: 'Unit 1016, Building 350 Arballo, Parkmerced Apartments',
      unitLayout: '2 beds, 2.5 baths , 1922 sqft, Ballantine floorplan',
      propertyAddress: '3711 19th Ave, San Francisco, CA 94132',
    },
  },
  {
    unitName: '1001',
    weekNum: 1,
    leaseUnitName: 'horizon-c-1001',
    state: 'Notice',
    displayName: '550 Front St, Unit 1001, San Diego, CA 92101',
    increasedLeasePrice: '$4,002.00',
    leaseComplimentaryInfo: '3 beds, 3 baths (swparkme-350AR-1019)',
    layout: '1 bed, 1 bath, 789 sqft, Cumulus',
    quote: {
      defaultLeaseTerm: '12 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: horizonLeaseTerms1001,
      termLength: 12,
    },
  },
  {
    unitName: '4003',
    state: 'Ready now',
    displayName: '550 Front St, Unit 4003, San Diego, CA 92101',
    layout: '4 beds, 2.5 baths, 1538 sqft, Cirrostratus',
    quote: {
      defaultLeaseTerm: '12 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: horizonLeaseTerms4003,
    },
  },
  {
    unitName: '101',
    state: 'Ready now',
    displayName: '1007 Mountain Drive, Unit 101, San Francisco, CA 94940',
    layout: 'Studio, 1 bath, 570 sqft, S1',
    quote: {
      defaultLeaseTerm: '1 month',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: acmeLeaseTerms101,
    },
  },
  {
    unitName: '103',
    state: 'Ready now',
    displayName: '3109 E Bragstad Dr, Unit 103, Sioux City, ND 57103',
    layout: '2 beds, 2 baths, 1040 sqft, B1',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: sierraLeaseTerms103,
    },
  },
  {
    unitName: '104',
    state: 'Ready now',
    displayName: '3109 E Bragstad Dr, Unit 104, Sioux City, ND 57103',
    layout: '1 bed, 1 bath, 819 sqft, A2',
    quote: {
      defaultLeaseTerm: '3 months',
      complimentaryItems: {
        textLabel: '',
        item: '',
      },
      leaseTerms: sierraLeaseTerms104,
    },
  },
];

export const getMockedQuoteDataByUnit = (unitName, weekNum) => mockQuoteData.find(unit => unit.unitName === unitName && (!weekNum || weekNum === unit.weekNum));

export const getMockedContactInfoByEmail = email => {
  const contacts = mockPartyData.contactInfoArray.filter(applicant => applicant.email === email);
  return { ...contacts[0] };
};

export const getMockedApplicantDataByEmail = email => {
  const applicants = mockApplicantData.filter(applicant => applicant.email === email);
  return { ...applicants[0] };
};

export const getMockedGuarantorDataByEmail = email => mockGuarantorInfo.find(guarantor => guarantor.email === email);

export const getMockedOccupantInfoByEmail = email => mockPartyData.occupantInfo.find(occupant => occupant.email === email);

export const mockResidentInfo = {
  legalName: 'Ronald Wells',
  email: 'qatest+ronaldwells@reva.tech',
  phone: '+51 984 745 991',
  preferredName: 'Ronald P.',
};

export const mockAmenitiesData = [
  {
    highValue: 'Bike Rack/storage, Ceiling Fans, Fitness Center, Hardwood floors, Laundry Room, Parking Space, Pet Friendly, Upgraded kitchen',
    property:
      '24 Hour Emergency Maintenance, 24 Hour Lock-Out Service, Accept Digital Payments, Bike Rack/storage, Billiards, Boat Slip, Bocce Ball, Cable / Satellite, Catering Kitchen, Central Air, Clubhouse, Coffee Station, Common Room, Complementary Wifi in common area, Conference Center, Controlled Access, Creative Workspace, Deck, Doorman, EV Charging Station, Elevator, Enclosed Patio, Fire Pit Lounge, Fitness Classes, Garden (Garden seating), Golf Simulator, Green/Green Friendly, Kayak space, Laundry Room, Multimedia Room, Off Street Parking, On-Site Recycling, Package Service, Parking Space, Pet Washing Station, Pool, Private community, Recycling Center, Resident Internet Site and Application, Resident garden, Rooftop Lounge, Storage space, Tot Lot / Play Structure, Townhome, Wine Locker',
  },
  {
    highValue: 'Partial view',
    property:
      'Breathtaking views, EV charging stations, Easy access to the bay, Grand clubhouse, Indoor lounge with firepit, Indoor swimming pool, Overlooking Mt. Tamalpias, Private Marina, Private boat slips, State-of-the-art fitness center',
  },
];

export const agentsWithEmail = [
  {
    legalName: 'Charlene Stone',
    email: 'charlene@reva.tech',
  },
  {
    legalName: 'Felicia Sutton',
    email: 'felicia@reva.tech',
  },
  {
    legalName: 'Freddy Franks',
    email: 'freddy@reva.tech',
  },
  {
    legalName: 'Ida Munoz',
    email: 'ida@reva.tech',
  },
  {
    legalName: 'Kenny Cruz',
    email: 'kenny@reva.tech',
  },
  {
    legalName: 'Marguerite Rhodes',
    email: 'marguerite@reva.tech',
  },
  {
    legalName: 'Orlando Lowe',
    email: 'orlando@reva.tech',
  },
  {
    legalName: 'Spencer Cohen',
    email: 'spencer@reva.tech',
  },
  {
    legalName: 'Tanya Francis',
    email: 'tanya@reva.tech',
  },
  {
    legalName: 'Alice Altimes',
    email: 'alice@reva.tech',
  },
  {
    legalName: 'Gary Alvarez',
    email: 'gary@reva.tech',
  },
  {
    legalName: 'S.A.R.A.H. (SS)',
    email: 'sarah@reva.tech',
  },
  {
    legalName: 'Spencer Cohen',
    email: 'spencer@reva.tech',
  },
  {
    legalName: 'Josh Helpman',
    email: 'josh@reva.tech',
  },
  {
    legalName: 'Bill Smith',
    email: 'bill@reva.tech',
  },
  {
    legalName: 'Reva Admin',
    email: 'admin@reva.tech',
  },
];
export const getPartyOwnerEmailByName = agentName => agentsWithEmail.find(partyOwner => partyOwner.legalName === agentName).email;
export const getPartyOwnerNameByEmail = userEmail => agentsWithEmail.find(partyOwner => partyOwner.email === userEmail).legalName;

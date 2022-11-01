/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { range } from 'lodash'; // eslint-disable-line red/no-lodash
import { DALTypes } from '../../../common/enums/DALTypes';
import { request } from '../../../common/helpers/httpUtils';

const LEAD_EMAIL_DOMAIN = 'reva.tech';

const getEmailWithTestId = (emailName, testId) => {
  const usernameSuffix = testId ? `_${testId}` : '';
  const username = `qatest+${emailName}${usernameSuffix}`;
  return `${username}@${LEAD_EMAIL_DOMAIN}`;
};

const getEmailWithCloudEnv = emailName => `${process.env.CLOUD_ENV}+${emailName}@${LEAD_EMAIL_DOMAIN}`;

const contact = (type, value, metadata) => ({ type, value, metadata });
const phoneContact = phone => contact('phone', phone, { sms: true });
const getCloudEnvEmailContact = name => contact('email', getEmailWithCloudEnv(name));

const DEFAULT_QUALIFICATION_QUESTIONS = {
  moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
  groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
  cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
  numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
};

const DEFAULT_QUALIFICATION_QUESTIONS_COUPLE = {
  ...DEFAULT_QUALIFICATION_QUESTIONS,
  groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
};

const DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE = {
  moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS,
  groupProfile: DALTypes.QualificationQuestions.GroupProfile.CORPORATE,
  cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
  numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.THREE_BEDS],
};

const webMessage = contents => ({
  source: '',
  message: contents,
  messageType: DALTypes.CommunicationMessageType.WEB,
});

const officeHours = {
  numberOfDays: 28,
  offset: 7,
  officeMinStartHour: 9,
  officeMaxStartHour: 12,
  officeMinEndHour: 16,
  officeMaxEndHour: 18,
  teams: ['Swparkme L', 'BayAreaCenter L', 'tyrellHub', 'skylineLeasing', 'cloudLeasing', 'horizonLeasing'],
};

export const bigSampleData = (cfg, testId, size = 100) => {
  const emailContact = name => contact('email', getEmailWithTestId(name, testId));

  let i = 0;

  const phoneLastFourDigits = n => `${n}000`.substring(0, 4);

  const rawLeads = range(size).map(() => {
    const j = ++i;
    return {
      fullName: `Joe Rawlead${j}`,
      preferredName: `Joe${j}`,
      contactInfo: [emailContact(`joe${j}`), phoneContact(`1202555${phoneLastFourDigits(j)}`)],
    };
  });

  i = 0;
  const parties = range(size).map(() => {
    const j = ++i;
    const memberState = ['Lead', 'QualifiedLead', 'Prospect', 'Applicant', 'Lease', 'FutureResident'][j % 6];
    return {
      members: [
        {
          fullName: `Paul${j} Morgan`,
          preferredName: `Paul${j} M.`,
          memberType: 'Resident',
          memberState,
          contactInfo: [emailContact(`paul${j}`), phoneContact(`1518555${phoneLastFourDigits(j)}`)],
        },
        {
          fullName: `Brian${j} Scott`,
          preferredName: `Brian${j} S.`,
          memberType: 'Resident',
          memberState,
          contactInfo: [emailContact(`brian${j}`), phoneContact(`1410555${phoneLastFourDigits(j)}`)],
        },
        {
          fullName: `Johnathan${j} Burton`,
          preferredName: `John${j} B.`,
          memberType: 'Resident',
          memberState,
          contactInfo: [emailContact(`john${j}`), phoneContact(`1404555${phoneLastFourDigits(j)}`)],
        },
      ],
      appointments: [
        {
          daysOffset: '-2',
          startTime: '10:30:00',
          endTime: '11:30:00',
          note: 'this is a past complete appointment',
          isComplete: true,
        },
        {
          daysOffset: '-2',
          startTime: '10:30:00',
          endTime: '11:30:00',
          note: 'this is a past appointment',
        },
        {
          daysOffset: '0',
          startTime: '15:30:00',
          endTime: '16:30:00',
          note: 'this is an appointment for today ',
        },
        {
          daysOffset: '1',
          startTime: '13:30:00',
          endTime: '14:00:00',
          note: 'this is an appointment for tomorrow',
        },
      ],
      messages: [
        webMessage('Available this week-end'),
        {
          source: '',
          message: 'Need to postpone appointment',
          messageType: DALTypes.CommunicationMessageType.SMS,
        },
        {
          source: '',
          message: 'Will be late',
          messageType: DALTypes.CommunicationMessageType.SMS,
        },
      ],
      qualificationQuestions: {
        moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
        groupProfile: DALTypes.QualificationQuestions.GroupProfile.STUDENTS,
        cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
        numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.THREE_BEDS],
      },
    };
  });

  return {
    rawLeadsData: [
      {
        teamName: cfg.team1.name,
        userRegistrationEmail: cfg.team1.agent1,
        rawLeads,
      },
    ],
    partiesData: [
      {
        teamName: cfg.team1.name,
        userRegistrationEmail: cfg.team1.agent1,
        parties,
      },
    ],
    officeHours,
    userCalendarAccounts: cfg.userCalendarAccounts,
    teamCalendarAccounts: cfg.teamCalendarAccounts,
  };
};

export const sampleData = (cfg, testId) => {
  const emailContact = name => contact('email', getEmailWithTestId(name, testId));
  const baseSample = {
    rawLeadsData: [
      {
        teamName: cfg.team1.name,
        userRegistrationEmail: cfg.team1.agent1,
        rawLeads: [
          {
            fullName: 'Jeffrey Archer',
            preferredName: 'Jeffrey A.',
            contactInfo: [emailContact('jeffrey')],
          },
          {
            fullName: 'Maya Bond',
            preferredName: 'Maya B.',
            contactInfo: [emailContact('maya')],
          },
          {
            fullName: 'Robert Federer',
            preferredName: 'Robert F.',
            contactInfo: [emailContact('robert')],
          },
          {
            fullName: 'Annabel Cook',
            preferredName: 'Annabel C.',
            contactInfo: [emailContact('annabel')],
          },
        ],
      },
      {
        teamName: cfg.team1.name,
        userRegistrationEmail: cfg.team1.agent2,
        rawLeads: [
          {
            fullName: 'Douglas Adam',
            preferredName: 'Douglas A.',
            contactInfo: [phoneContact('16197384381'), emailContact('douglas')],
          },
          {
            fullName: 'Maria Black',
            preferredName: 'Maria B.',
            contactInfo: [emailContact('maria')],
          },
          {
            fullName: 'Chloe Brown',
            preferredName: 'Chloe B.',
            contactInfo: [emailContact('chloe')],
          },
        ],
      },
    ],
    partiesData: [
      // Bill Smith - begin (Parkmerced LA|LWA)
      {
        userRegistrationEmail: cfg.team1.agent1,
        teamName: cfg.team1.name,
        parties: [
          {
            members: [
              {
                fullName: 'James Hill',
                preferredName: 'James H.',
                contactInfo: [emailContact('james')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Richard Cooper',
                preferredName: 'Richard C.',
                contactInfo: [emailContact('richard')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [webMessage('Inquiry about services')],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              // don't set Q question so it appears in first column
              // cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Mason Miller',
                preferredName: 'Mason M.',
                contactInfo: [emailContact('mason')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Jasper Walker',
                preferredName: 'Jasper W.',
                contactInfo: [emailContact('jasper')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [webMessage('Available this week-end')],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              // don't set Q question so it appears in first column
              // cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Gabriel Collins',
                preferredName: 'Gabriel C.',
                contactInfo: [emailContact('gabriel')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Samuel Wood',
                preferredName: 'Samuel W.',
                contactInfo: [emailContact('samuel')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [
              {
                source: '',
                message: 'Will be late',
                messageType: DALTypes.CommunicationMessageType.SMS,
              },
            ],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
            },
          },
          {
            members: [
              {
                fullName: 'Paul Morgan',
                preferredName: 'Paul M.',
                contactInfo: [emailContact('paul')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Brian Scott',
                preferredName: 'Brian S.',
                contactInfo: [
                  {
                    type: 'email',
                    value: 'qatest+brian@reva.tech',
                  },
                ],
                memberType: 'Occupant',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past appointment',
              },
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is an appointment for today ',
              },
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is an appointment for tomorrow',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.FOUR_PLUS_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'George Harrison',
                preferredName: 'George H.',
                contactInfo: [emailContact('george')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Gary Ward',
                preferredName: 'Gary W.',
                contactInfo: [emailContact('gary')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '16:30:00',
                endTime: '17:30:00',
                note: 'this is a complete appointment for today',
                isComplete: true,
              },
              {
                daysOffset: '0',
                startTime: '16:30:00',
                endTime: '17:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
            },
          },
          {
            members: [
              {
                fullName: 'Eli Foster',
                preferredName: 'Eli F.',
                contactInfo: [emailContact('eli')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Evan Stone',
                preferredName: 'Evan S.',
                contactInfo: [emailContact('evan')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            children: [
              {
                fullName: 'Brandon Hawkins',
                preferredName: 'Brandon',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a past appointment',
              },
              {
                daysOffset: '0',
                startTime: '13:30:00',
                endTime: '14:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
            },
          },
          {
            members: [
              {
                fullName: 'Jose Brooks',
                preferredName: 'Jose B.',
                contactInfo: [emailContact('jose')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            children: [
              {
                fullName: 'Frank Brooks',
                preferredName: 'Frank',
              },
            ],
            appointments: [
              {
                daysOffset: '3',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE,
            unitName: cfg.properties[cfg.team1.property].units[6],
            screeningRentAmount: 3500, // accept
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Dylan Butler',
                preferredName: 'Dylan B.',
                contactInfo: [emailContact('dylan')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Leo Watkins',
                preferredName: 'Leo W.',
                contactInfo: [emailContact('leo')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '1',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
            },
          },
          {
            members: [
              {
                fullName: 'Ken Roger',
                preferredName: 'Kane R.',
                contactInfo: [emailContact('Ken')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '12:30:00',
                endTime: '13:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE,
          },
          {
            members: [
              {
                fullName: 'Harold Smith',
                preferredName: 'Harold S.',
                contactInfo: [emailContact('harold')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '1',
                startTime: '16:00:00',
                endTime: '17:00:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              ...DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.FOUR_PLUS_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Chris Lewis',
                preferredName: 'Chris L.',
                contactInfo: [emailContact('chris')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
            unitName: cfg.properties[cfg.team1.property].units[7],
            // TODO: should be able to pull this from unit...
            screeningRentAmount: 3500, // accept
            newLeaseCreation: { shouldCreateLease: true },
          },
          {
            members: [
              {
                fullName: 'Peter Parker',
                preferredName: 'Peter P.',
                contactInfo: [emailContact('peter')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            unitName: cfg.properties[cfg.team1.property].units[0],
            screeningRentAmount: 7500, // DECLINED
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Ben King',
                preferredName: 'Ben K.',
                contactInfo: [emailContact('ben')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
              {
                fullName: 'Andy Lee',
                preferredName: 'Andy L.',
                contactInfo: [emailContact('andy')],
                memberType: 'Occupant',
                memberState: 'Lease',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
            unitName: cfg.properties[cfg.team1.property].units[1],
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Ashley Lopez',
                preferredName: 'Ashley L.',
                contactInfo: [emailContact('ashley')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
              {
                fullName: 'Bruce Mitchell',
                preferredName: 'Bruce M.',
                contactInfo: [emailContact('bruce')],
                memberType: 'Occupant',
                memberState: 'Lease',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
            unitName: cfg.properties[cfg.team1.property].units[0],
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Thomas Kendrick',
                preferredName: 'Thomas',
                contactInfo: [emailContact('thomas')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            unitName: cfg.properties[cfg.team1.property].units[0],
            screeningRentAmount: 7500, // DECLINED
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Giselle Calvin',
                preferredName: 'Giselle',
                contactInfo: [emailContact('giselle')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            children: [
              {
                fullName: 'Frank Calvin',
                preferredName: 'Frank',
              },
            ],
            appointments: [
              {
                daysOffset: '3',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE,
            unitName: cfg.properties[cfg.team1.property].units[6],
            screeningRentAmount: 3500, // accept
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Stuart Mackenzie',
                preferredName: 'Stuart',
                contactInfo: [emailContact('stuart')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '12:30:00',
                endTime: '13:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE,
          },
          {
            members: [
              {
                fullName: 'Cliff Alannah',
                preferredName: 'Cliff',
                contactInfo: [emailContact('cliff')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Shawnda Alannah',
                preferredName: 'Shawnda',
                contactInfo: [emailContact('shawnda')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '1',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
            },
          },
          {
            members: [
              {
                fullName: 'Aline Selina',
                preferredName: 'Aline',
                contactInfo: [emailContact('aline')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[8],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true },
            renewalLeaseCreation: { shouldCreateRenewalParty: true },
          },
          // scenario 2
          {
            members: [
              {
                fullName: 'Maria Garcia',
                preferredName: 'Maria',
                contactInfo: [emailContact('mariag')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[9],
            screeningRentAmount: 3500, // accept
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 6, shouldExecuteLease: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 5
          {
            members: [
              {
                fullName: 'Timmy Turner',
                preferredName: 'timmy',
                contactInfo: [emailContact('timmy')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[10],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 6 },
            excludeFromCucumberTenant: true,
          },
          // scenario 6
          {
            members: [
              {
                fullName: 'Tara Strong',
                preferredName: 'Tara',
                contactInfo: [emailContact('tara')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[11],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 6 },
            excludeFromCucumberTenant: true,
          },
          // scenario 20
          {
            members: [
              {
                fullName: 'Yogi Bear',
                preferredName: 'Yogi',
                contactInfo: [emailContact('yogi')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[13],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 21
          {
            members: [
              {
                fullName: 'Lester Coward',
                preferredName: 'Lester',
                contactInfo: [emailContact('lester')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[14],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 22
          {
            members: [
              {
                fullName: 'Jeffy Dahmer',
                preferredName: 'Jeffy',
                contactInfo: [emailContact('jeffy')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[15],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
              shouldExecuteRenewalLease: true,
              hasNotHitRenewalStartDate: true,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 23
          {
            members: [
              {
                fullName: 'Fred McFurry',
                preferredName: 'Fred',
                contactInfo: [emailContact('fred')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[16],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 24
          {
            members: [
              {
                fullName: 'Cecil Crumey',
                preferredName: 'Cecil',
                contactInfo: [emailContact('cecil')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[17],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 26
          {
            members: [
              {
                fullName: 'Betty Savis',
                preferredName: 'Betty',
                contactInfo: [emailContact('betty')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[18],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, isMovingOut: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
            },
            excludeFromCucumberTenant: true,
          },
        ],
      }, // Bill Smith - end
      // Danny Gogood - begin (Parkmerced LA|LWA|LCA)
      {
        userRegistrationEmail: cfg.team1.agent2,
        teamName: cfg.team1.name,
        parties: [
          {
            members: [
              {
                fullName: 'Andrew Carter',
                preferredName: 'Andrew C.',
                contactInfo: [emailContact('andrew')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
              {
                fullName: 'Peter Allen',
                preferredName: 'Peter A.',
                contactInfo: [emailContact('petera')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
            ],
            appointments: [
              {
                daysOffset: '-1',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Ryan Fisher',
                preferredName: 'Ryan F.',
                contactInfo: [emailContact('ryan')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Nicholas Cook',
                preferredName: 'Nicholas C.',
                contactInfo: [emailContact('nicholas')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '10:30:00',
                endTime: '11:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
          // scenario 10
          {
            members: [
              {
                fullName: 'Kath Soucie',
                preferredName: 'kath',
                contactInfo: [emailContact('kath')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[2],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3 },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 11
          {
            members: [
              {
                fullName: 'Trixie Tang',
                preferredName: 'Trixie',
                contactInfo: [emailContact('trixie')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[3],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 1 },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMTM: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 15
          {
            members: [
              {
                fullName: 'Clark Gravel',
                preferredName: 'Clark',
                contactInfo: [emailContact('clark')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[4],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMovingOut: true, isMovingOutDatePassed: true, shouldArchiveNewLeaseWf: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 17
          {
            members: [
              {
                fullName: 'Milton Squirrel',
                preferredName: 'Milton',
                contactInfo: [emailContact('milton')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            unitName: cfg.properties[cfg.team1.property].units[5],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMovingOut: true, isMovingOutDatePassed: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: { shouldCreateRenewalParty: true },
            excludeFromCucumberTenant: true,
          },
        ],
      }, // Danny Gogood - end
      // Alice Altimes - begin ------ Actually was Danny again: (Parkmerced , LA|LWA|LCA)
      {
        userRegistrationEmail: cfg.team1.agent2,
        teamName: cfg.team1.name,
        parties: [
          {
            members: [
              {
                fullName: 'Dan Brown',
                preferredName: 'Dan B.',
                contactInfo: [emailContact('dan')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Patricia Cornwell',
                preferredName: 'Patricia C.',
                contactInfo: [emailContact('patricia')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Kate Atkinson',
                preferredName: 'Kate A.',
                contactInfo: [emailContact('kate')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '11:30:00',
                endTime: '12:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Susan Albert',
                preferredName: 'Susan A.',
                contactInfo: [emailContact('susan')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Eric Albert',
                preferredName: 'Eric A.',
                contactInfo: [emailContact('eric')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '9:30:00',
                endTime: '10:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
          {
            members: [
              {
                fullName: 'Hilary Bailey',
                preferredName: 'Hilary B.',
                contactInfo: [emailContact('hilary')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Arthur Barnes',
                preferredName: 'Arthur B.',
                contactInfo: [emailContact('arthur')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
              {
                fullName: 'John Barnes',
                preferredName: 'John B.',
                contactInfo: [emailContact('john')],
                memberType: 'Resident',
                memberState: 'Lead',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Janet Asimov',
                preferredName: 'Janet A.',
                contactInfo: [emailContact('janet')],
                memberType: 'Resident',
                memberState: 'Lead',
                applicationStatus: 'completed',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '12:30:00',
                endTime: '13:00:00',
                note: 'this is the first appointment',
              },
              {
                daysOffset: '2',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is the second appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
        ],
      }, // Alice Altimes - end
      // Sally Smart - begin  (Parkmerced LM|LAA)
      {
        userRegistrationEmail: cfg.team1.agent3,
        teamName: cfg.team1.name,
        parties: [
          {
            members: [
              {
                fullName: 'Greg Bear',
                preferredName: 'Greg B.',
                contactInfo: [emailContact('greg')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Amy Bear',
                preferredName: 'Amy B.',
                contactInfo: [emailContact('amy')],
                memberType: 'Resident',
                memberState: 'Lead',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Kevin Andreson',
                preferredName: 'Kevin A.',
                contactInfo: [emailContact('kevin')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
              {
                fullName: 'Mike Doe',
                preferredName: 'Mike D.',
                contactInfo: [emailContact('mike')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '10:00:00',
                endTime: '10:30:00',
                note: 'this is the first completed appointment',
                isComplete: true,
              },
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              ...DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.FOUR_PLUS_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Charlie Tylor',
                preferredName: 'Charlie T.',
                contactInfo: [emailContact('charlie')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Emma Williams',
                preferredName: 'Emma W.',
                contactInfo: [emailContact('emma')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '9:30:00',
                endTime: '10:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
        ],
      }, // Sally Smart - end
      // Sara Jones - begin   (Hub LA|LWA)
      {
        userRegistrationEmail: cfg.hubTeam.agent1,
        teamName: cfg.hubTeam.name,
        parties: [
          {
            members: [
              {
                fullName: 'Rudy Trudie',
                preferredName: 'Rudy',
                contactInfo: [emailContact('rudy')],
                memberType: 'Resident',
                memberState: 'QualifiedLead',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Kaye Marissa',
                preferredName: 'Kaye',
                contactInfo: [emailContact('kaye')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Kenneth Desmond',
                preferredName: 'Ken',
                contactInfo: [emailContact('kenneth')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [webMessage('Inquiry about services')],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
          {
            members: [
              {
                fullName: 'Kimberly Royle',
                preferredName: 'Kim',
                contactInfo: [emailContact('kimberley')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Gordon Royle',
                preferredName: 'Gordon',
                contactInfo: [emailContact('gordon')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [webMessage('Available this week-end')],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_2_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Wilson Ramsey',
                preferredName: 'Wilson',
                contactInfo: [emailContact('wilson')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Alanna Garret',
                preferredName: 'Alanna',
                contactInfo: [emailContact('alanna')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:30:00',
                note: 'this is an appointment for tomorrow',
              },
            ],
            messages: [
              {
                source: '',
                message: 'Need to postpone appointment',
                messageType: DALTypes.CommunicationMessageType.EMAIL,
                from: 'qatest+wilson@reva.tech',
              },
            ],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property2,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Igor Luke',
                preferredName: 'Igor',
                contactInfo: [emailContact('igor')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Annie Colin',
                preferredName: 'Annie',
                contactInfo: [emailContact('annie')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [],
            messages: [
              {
                source: '',
                message: 'Will be late',
                messageType: DALTypes.CommunicationMessageType.SMS,
              },
            ],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
            },
          },
          {
            members: [
              {
                fullName: 'Barry Alesia',
                preferredName: 'Barry',
                contactInfo: [emailContact('barry')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Milford Kennith',
                preferredName: 'Milford',
                contactInfo: [
                  {
                    type: 'email',
                    value: 'qatest+milford@reva.tech',
                  },
                ],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '-2',
                startTime: '13:30:00',
                endTime: '14:30:00',
                note: 'this is a past appointment',
              },
              {
                daysOffset: '0',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is an appointment for today ',
              },
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is an appointment for tomorrow',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.ROOMMATES,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.THREE_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Liliana Aletha',
                preferredName: 'Liliana',
                contactInfo: [emailContact('liliana')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Dave Ward',
                preferredName: 'Dave',
                contactInfo: [emailContact('dave')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '16:30:00',
                endTime: '17:30:00',
                note: 'this is an complete appointment for today',
                isComplete: true,
              },
              {
                daysOffset: '0',
                startTime: '16:30:00',
                endTime: '17:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
            },
          },
          {
            members: [
              {
                fullName: 'Nikolas Trina',
                preferredName: 'Nikolas',
                contactInfo: [emailContact('nikolas')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Gwendoline Trina',
                preferredName: 'Gwen',
                contactInfo: [emailContact('gwendoline')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            children: [
              {
                fullName: 'Brandon Trina',
                preferredName: 'Brandon',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past appointment',
              },
              {
                daysOffset: '0',
                startTime: '13:30:00',
                endTime: '14:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property3,
            qualificationQuestions: {
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
            },
          },
          {
            members: [
              {
                fullName: 'Nathaniel Harriett',
                preferredName: 'Nathaniel',
                contactInfo: [emailContact('nathaniel')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
            ],
            appointments: [
              {
                daysOffset: '-2',
                startTime: '10:30:00',
                endTime: '11:30:00',
                note: 'this is a past complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '1',
                startTime: '15:00:00',
                endTime: '16:00:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_CORPORATE,
          },
          {
            members: [
              {
                fullName: 'Clemence Felix',
                preferredName: 'Clemence',
                contactInfo: [emailContact('clemence')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
              {
                fullName: 'Kristy Felix',
                preferredName: 'Kristy',
                contactInfo: [emailContact('kristy')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '12:30:00',
                endTime: '13:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property2,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Korey Haywood',
                preferredName: 'Korey',
                contactInfo: [emailContact('korey')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
              {
                fullName: 'Yolonda Haywood',
                preferredName: 'Yolonda',
                contactInfo: [emailContact('yolonda')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
            ],
            appointments: [
              {
                daysOffset: '5',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Randi Thomasina',
                preferredName: 'Randi',
                contactInfo: [emailContact('randi')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
              {
                fullName: 'Danielle Thomasina',
                preferredName: 'danielle',
                contactInfo: [emailContact('danielle')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '16:00:00',
                endTime: '16:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            unitName: cfg.properties[cfg.hubTeam.property1].units[1],
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Jameson Andre',
                preferredName: 'Jameson',
                contactInfo: [emailContact('jameson')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
              {
                fullName: 'Jackie Delma',
                preferredName: 'Jackie',
                contactInfo: [emailContact('jackie')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            unitName: cfg.properties[cfg.hubTeam.property1].units[0],
            newLeaseCreation: { shouldCreateLease: false },
          },
          {
            members: [
              {
                fullName: 'Lyla Schmidt',
                preferredName: 'Lyla S.',
                contactInfo: [emailContact('lyla')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
              {
                fullName: 'Natalia Banks',
                preferredName: 'Natalia B.',
                contactInfo: [emailContact('natalia')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '12:30:00',
                endTime: '13:30:00',
                note: 'this is an appointment for today',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
        ],
      }, // Sara Jones - end
      // Alice - begin    (Hub  PM|LAA|LCA)
      {
        userRegistrationEmail: cfg.hubTeam.agent2,
        teamName: cfg.hubTeam.name,
        parties: [
          {
            members: [
              {
                fullName: 'Jimmy Young',
                preferredName: 'Jimmy Y.',
                contactInfo: [emailContact('jimmy')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Dale Hamilton',
                preferredName: 'Dale H.',
                contactInfo: [emailContact('dale')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '15:00:00',
                endTime: '16:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Adam Stone',
                preferredName: 'Adam S.',
                contactInfo: [emailContact('adam')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Billy Jenkins',
                preferredName: 'Billy J.',
                contactInfo: [emailContact('billy')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '16:30:00',
                endTime: '17:30:00',
                note: 'this is the first appointment',
              },
            ],
            shouldAssignProperty: true,
            propertyName: cfg.team1.property,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
        ],
      }, // Alice - end
      // Tanya Francis - begin  (Cove LA|LWA and Hub LA|LWA)
      {
        userRegistrationEmail: cfg.hubTeam.agent3,
        teamName: cfg.hubTeam.name,
        parties: [
          {
            members: [
              {
                fullName: 'Jayden Holder',
                preferredName: 'Jayden',
                contactInfo: [emailContact('jayden')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            messages: [webMessage('Ready to apply')],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Alexander Baker',
                preferredName: 'Alexander B.',
                contactInfo: [emailContact('alexander')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
              {
                fullName: 'Benjamin Green',
                preferredName: 'Benjamin G.',
                contactInfo: [emailContact('benjamin')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:30:00',
                note: 'this is an appointment for tomorrow',
              },
            ],
            messages: [
              {
                source: '',
                message: 'Need to postpone appointment',
                messageType: DALTypes.CommunicationMessageType.EMAIL,
                from: 'qatest+benjamin@reva.tech',
              },
            ],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Lindsay Smith',
                preferredName: 'Lindsay S.',
                contactInfo: [emailContact('lindsay')],
                memberType: 'Resident',
                memberState: 'Lease',
              },
            ],
            messages: [webMessage('Ready to apply')],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Courtney Holder',
                preferredName: 'Courtney',
                contactInfo: [emailContact('courtney')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            messages: [webMessage('Ready to apply')],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Jonathan Burton',
                preferredName: 'Jon B.',
                contactInfo: [emailContact('jonathan')],
                memberType: 'Resident',
                memberState: 'QualifiedLead',
              },
            ],
            appointments: [],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.NO,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Ivy Burton',
                preferredName: 'Ivy B.',
                contactInfo: [emailContact('ivy')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
              {
                fullName: 'Angelina Stanley',
                preferredName: 'Angelina S.',
                contactInfo: [emailContact('angelina')],
                memberType: 'Resident',
                memberState: 'FutureResident',
              },
            ],
            appointments: [
              {
                daysOffset: '5',
                startTime: '17:00:00',
                endTime: '17:30:00',
                note: 'this is a future appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.hubTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
        ],
      }, // Tanya Francis - end
      // Training agent1 (University) - begin   TU1  (Acme LA|LWA|LSM)
      {
        userRegistrationEmail: cfg.universityTeam.agent1,
        teamName: cfg.universityTeam.name,
        parties: [
          // scenario 3
          {
            members: [
              {
                fullName: 'James Johnson',
                preferredName: 'James',
                contactInfo: [emailContact('jamesj')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[0],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 1, shouldExecuteLease: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 4
          {
            members: [
              {
                fullName: 'Allen Wright',
                preferredName: 'Allen',
                contactInfo: [emailContact('allen')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[1],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 6 },
            excludeFromCucumberTenant: true,
          },
          // scenario 8
          {
            members: [
              {
                fullName: 'Drake Bell',
                preferredName: 'Drake',
                contactInfo: [emailContact('drake')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[2],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, additionalChargeName: 'UndergroundParking' },
            excludeFromCucumberTenant: true,
          },
          // scenario 9
          {
            members: [
              {
                fullName: 'Alec Baldwin',
                preferredName: 'Alec',
                contactInfo: [emailContact('alec')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[3],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 1, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, isMTM: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 12
          {
            members: [
              {
                fullName: 'Russell Brand',
                preferredName: 'Russell',
                contactInfo: [emailContact('russell')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[4],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, isExtension: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 16
          {
            members: [
              {
                fullName: 'Jack Bunny',
                preferredName: 'Jack',
                contactInfo: [emailContact('jack')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[5],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, isMovingOut: true },
            renewalLeaseCreation: { shouldCreateRenewalParty: true },
            excludeFromCucumberTenant: true,
          },
          // scenario 19
          {
            members: [
              {
                fullName: 'Troy McClure',
                preferredName: 'Troy',
                contactInfo: [emailContact('troy')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[6],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
              shouldExecuteRenewalLease: true,
            },
            excludeFromCucumberTenant: true,
          },
          // scenario 25
          {
            members: [
              {
                fullName: 'Casey Strangle',
                preferredName: 'Casey',
                contactInfo: [emailContact('casey')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.universityTeam.property,
            unitName: cfg.properties[cfg.universityTeam.property].units[7],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, shouldArchiveNewLeaseWf: true, isMovingOut: true },
            renewalLeaseCreation: {
              shouldCreateRenewalParty: true,
              shouldPublishRenewalLetter: true,
              shouldPublishRenewalLease: true,
              renewalLeaseLength: 6,
            },
            excludeFromCucumberTenant: true,
          },
        ],
      }, // Training agent1- end
    ],
    officeHours,
    userCalendarAccounts: cfg.userCalendarAccounts,
    teamCalendarAccounts: cfg.teamCalendarAccounts,
  };

  if (cfg.multiPropertyTeam) {
    baseSample.rawLeadsData.push({
      teamName: cfg.multiPropertyTeam.name,
      userRegistrationEmail: cfg.multiPropertyTeam.agent1,
      rawLeads: [
        {
          fullName: 'Ethan Norman',
          preferredName: 'Ethan',
          contactInfo: [emailContact('ethan')],
        },
      ],
    });

    baseSample.partiesData = baseSample.partiesData.concat([
      // Melanie
      {
        userRegistrationEmail: cfg.multiPropertyTeam.agent1,
        teamName: cfg.multiPropertyTeam.name,
        parties: [
          {
            members: [
              {
                fullName: 'Dorinda Humphrey',
                preferredName: 'Dorinda H.',
                contactInfo: [emailContact('dorinda')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
              {
                fullName: 'Dex Langdon',
                preferredName: 'Dex L.',
                contactInfo: [emailContact('dex')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
            ],
            appointments: [
              {
                daysOffset: '-1',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first complete appointment',
                isComplete: true,
              },
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Ryan Fisher',
                preferredName: 'Ryan F.',
                contactInfo: [emailContact('ryan')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Emmaline Radcliff',
                preferredName: 'Emmaline R.',
                contactInfo: [emailContact('emmaline')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '10:30:00',
                endTime: '11:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property1,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS,
          },
          {
            members: [
              {
                fullName: 'Levi Stidolph',
                preferredName: 'Levi',
                contactInfo: [emailContact('levi')],
                memberType: 'Resident',
                memberState: 'Lease',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property1,
            unitName: cfg.properties[cfg.multiPropertyTeam.property1].units[19],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 1 },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMTM: true },
            excludeFromCucumberTenant: true,
          },
          {
            members: [
              {
                fullName: 'Briana Carpenter',
                preferredName: 'Briana',
                contactInfo: [emailContact('briana')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property1,
            unitName: cfg.properties[cfg.multiPropertyTeam.property1].units[20],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMovingOut: true, isMovingOutDatePassed: true, shouldArchiveNewLeaseWf: true },
            excludeFromCucumberTenant: true,
          },
          {
            members: [
              {
                fullName: 'Carry Myers',
                preferredName: 'Carry',
                contactInfo: [emailContact('carry')],
                memberType: 'Resident',
                memberState: 'FutureResident',
                applicationStatus: 'completed',
              },
            ],
            appointments: [],
            messages: [
              {
                source: '',
                message: 'Move-out question',
                messageType: DALTypes.CommunicationMessageType.SMS,
              },
            ],
            qualificationQuestions: {
              moveInTime: DALTypes.QualificationQuestions.MoveInTime.NEXT_4_WEEKS,
              groupProfile: DALTypes.QualificationQuestions.GroupProfile.FAIR_MARKET,
              cashAvailable: DALTypes.QualificationQuestions.SufficientIncome.YES,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.TWO_BEDS],
            },
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property1,
            unitName: cfg.properties[cfg.multiPropertyTeam.property1].units[21],
            screeningRentAmount: 3500,
            newLeaseCreation: { shouldCreateLease: true, leaseLength: 3, shouldExecuteLease: true, isLeasePassed: true },
            activeLeaseCreation: { shouldCreateActiveLeaseParty: true, isMovingOut: true, isMovingOutDatePassed: false, shouldArchiveNewLeaseWf: true },
            renewalLeaseCreation: { shouldCreateRenewalParty: true },
            excludeFromCucumberTenant: true,
          },
        ],
      }, // End Melanie

      // Tom
      {
        userRegistrationEmail: cfg.multiPropertyTeam.agent2,
        teamName: cfg.multiPropertyTeam.name,
        parties: [
          {
            members: [
              {
                fullName: 'Isidore Pitt',
                preferredName: 'Isidore',
                contactInfo: [emailContact('isidore')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Chelle Sommer',
                preferredName: 'Chelle',
                contactInfo: [emailContact('chelle')],
                memberType: 'Resident',
                memberState: 'Lead',
                applicationStatus: 'opened',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '15:30:00',
                endTime: '16:30:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property2,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
          {
            members: [
              {
                fullName: 'Rosalie Shirley',
                preferredName: 'Rosalie S.',
                contactInfo: [emailContact('rosalie')],
                memberType: 'Resident',
                memberState: 'Prospect',
              },
              {
                fullName: 'Evie Albertson',
                preferredName: 'Evie A.',
                contactInfo: [emailContact('evie')],
                memberType: 'Resident',
                memberState: 'Lead',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '10:00:00',
                endTime: '10:30:00',
                note: 'this is the first completed appointment',
                isComplete: true,
              },
              {
                daysOffset: '1',
                startTime: '13:30:00',
                endTime: '14:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property2,
            qualificationQuestions: {
              ...DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
              numBedrooms: [DALTypes.QualificationQuestions.BedroomOptions.FOUR_PLUS_BEDS],
            },
          },
          {
            members: [
              {
                fullName: 'Gena Johns',
                preferredName: 'Gena J.',
                contactInfo: [emailContact('gena')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'opened',
              },
              {
                fullName: 'Lottie Garrard',
                preferredName: 'Lottie G.',
                contactInfo: [emailContact('lottie')],
                memberType: 'Resident',
                memberState: 'Applicant',
                applicationStatus: 'completed',
              },
            ],
            appointments: [
              {
                daysOffset: '0',
                startTime: '9:30:00',
                endTime: '10:00:00',
                note: 'this is the first appointment',
              },
            ],
            messages: [],
            shouldAssignProperty: true,
            propertyName: cfg.multiPropertyTeam.property2,
            qualificationQuestions: DEFAULT_QUALIFICATION_QUESTIONS_COUPLE,
          },
        ],
      }, // End Tom
    ]);
  }

  return baseSample;
};

export const generateRandomParty = async () => {
  // TODO: use offline version
  const [randomUser] = (
    await request('https://randomuser.me/api/?&inc=name&nat=us', {
      timeout: 5000,
    })
  ).results;
  const {
    name: { first, last },
  } = randomUser;
  const capStr = s => s[0].toUpperCase() + s.substring(1);
  const firstName = capStr(first);
  const lastName = capStr(last);
  const preferredName = firstName;
  const fullName = `${firstName} ${lastName}`;
  return {
    members: [
      {
        fullName,
        preferredName,
        contactInfo: [getCloudEnvEmailContact(first)],
        memberType: 'Resident',
        memberState: 'Applicant',
      },
    ],
    appointments: [],
    messages: [],
    qualificationQuestions: {
      moveInTime: DALTypes.QualificationQuestions.MoveInTime.BEYOND_4_MONTHS,
    },
    // TODO: make this configurable
    shouldAssignProperty: true,
    propertyName: 'swparkme',
    unitName: '1013',
    newLeaseCreation: { shouldCreateLease: false },
  };
};

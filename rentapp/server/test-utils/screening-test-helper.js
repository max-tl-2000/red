/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import xml2js from 'xml2js-es6-promise';
import { saveBusinessEntity } from '../../../server/dal/businessEntityRepo';
import { DALTypes } from '../../../common/enums/DALTypes';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { saveProperty } from '../../../server/dal/propertyRepo';
import {
  testCtx,
  createAUser,
  createAParty,
  createAnInventory,
  createAnAmenity,
  createAnAddress,
  createABuilding,
  addAmenityToInventory,
  createALeaseTerm,
  createALeaseName,
  createAInventoryGroup,
  createAPartyMember,
  createAPartyPet,
  createATeam,
  createATeamMember,
  createAQuote,
  createAFee,
  createAPerson,
  createATeamPropertyProgram,
  createAProperty,
} from '../../../server/testUtils/repoHelper';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { createAPersonApplication, createAnApplicationInvoice, createAPartyApplication } from './repo-helper';
import { readFileAsString } from '../../../common/helpers/file';
import { fillHandlebarsTemplate } from '../../../common/helpers/handlebars-utils';
import { handleParsedFADVResponse } from '../screening/fadv/screening-report-parser.ts';
import { createSubmissionResponse, createSubmissionRequest } from '../dal/fadv-submission-repo';
import { getSubmissionRequestId } from '../workers/screening/screening-helper';
import { ScreeningDecision } from '../../../common/enums/applicationTypes';
import logger from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';
import { FadvRequestTypes } from '../../../common/enums/fadvRequestTypes';

const defaultMemberSettings = {
  missingEmail: false,
  missingPhone: false,
  missingGuarantor: false,
  missingFullName: false,
  numberOfResidents: 1,
  numberOfGuarantors: 1,
  missingSsn: false,
  setNameAsEmail: false,
  setNameAsPhone: false,
};

const defaultQuoteSettings = {
  numberOfQuotes: 1,
  numberOfLeaseTerms: 1,
};

const defaultApplicantSettings = {
  hasInternationalAddress: false,
  hasItin: false,
};

const createTestMembers = async ({ party, settings }) => {
  const { setNameAsEmail, setNameAsPhone, missingFullName } = settings;
  const guarantorCi = Array(settings.numberOfGuarantors)
    .fill()
    .map((_, idx) =>
      enhance([
        { type: 'email', value: `lukeg${idx}@reva.tech` },
        { type: 'phone', value: '12025550163' },
      ]),
    );

  const guarantors = await Promise.all(
    Array(settings.numberOfGuarantors)
      .fill()
      .map(async (_, idx) => {
        let fullName = `Anakin Skywalker${idx}`;
        if (missingFullName) fullName = null;
        if (setNameAsEmail) fullName = guarantorCi[idx].defaultEmail;
        if (setNameAsPhone) fullName = '(506)888-888';

        return await createAPartyMember(party.id, {
          fullName,
          contactInfo: guarantorCi[idx],
          memberType: DALTypes.MemberType.GUARANTOR,
        });
      }),
  );

  const residentCi = Array(settings.numberOfResidents)
    .fill()
    .map((_, idx) =>
      enhance(
        [
          settings.missingEmail ? null : { type: 'email', value: `luke${idx}@reva.tech` },
          settings.missingPhone ? null : { type: 'phone', value: '12025550163' },
        ].filter(item => item),
      ),
    );

  const getGuaranteedBy = () => (guarantors.length && !settings.missingGuarantor ? guarantors[0].id : null);

  const residents = await Promise.all(
    Array(settings.numberOfResidents)
      .fill()
      .map(async (_, idx) => {
        let fullName = `Luke Skywalker${idx}`;
        if (missingFullName) fullName = null;
        if (setNameAsEmail) fullName = residentCi[idx].defaultEmail;
        if (setNameAsPhone) fullName = '(506)8585-888';
        return await createAPartyMember(party.id, {
          fullName,
          contactInfo: residentCi[idx],
          memberType: DALTypes.MemberType.RESIDENT,
          guaranteedBy: getGuaranteedBy(),
        });
      }),
  );

  return { residents, guarantors };
};

const createTestPropertyForLease = async (settings = { screening: { propertyName: '132660' } }) => {
  const address = await createAnAddress({});

  const businessEntity = await saveBusinessEntity(testCtx, {
    name: `The Starks ${v4()}`,
    type: DALTypes.BusinessEntityType.OWNER,
    addressId: address.id,
  });

  const property = {
    name: 'cove',
    propertyLegalName: 'The Cove',
    displayName: 'The Cove',
    owner: businessEntity.id,
    addressId: address.id,
    timezone: LA_TIMEZONE,
    settings,
  };

  return saveProperty(testCtx, property);
};

export const createTestBaseInfo = async ({ memberSettings, propertySettings } = {}) => {
  const settings = { ...defaultMemberSettings, ...memberSettings };

  const { id: userId } = await createAUser();

  const team = await createATeam({
    name: 'team',
    module: 'leasing',
    email: 'team1@reva.tech',
    phone: '12025550190',
  });
  await createATeamMember({
    teamId: team.id,
    userId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LCA.name],
    },
  });

  const property = await createTestPropertyForLease(propertySettings);

  await createATeamPropertyProgram({
    teamId: team.id,
    propertyId: property.id,
    commDirection: DALTypes.CommunicationDirection.OUT,
  });
  const party = await createAParty({
    userId,
    teams: [team.id],
    assignedPropertyId: property.id,
    ownerTeam: team.id,
  });
  const { guarantors, residents } = await createTestMembers({
    party,
    settings,
  });

  const pets = [await createAPartyPet(party.id)];

  return {
    userId,
    team,
    property,
    party,
    residents,
    guarantors,
    pets,
  };
};

const createTestQuote = async (party, inventory, leaseTerms, securityDepositAmount, concessions = []) => {
  const quoteId = v4();
  return await createAQuote(party.id, {
    id: quoteId,
    inventoryId: inventory.id,
    publishedQuoteData: {
      id: quoteId,
      leaseTerms: leaseTerms.map(leaseTerm => ({
        id: leaseTerm.id,
        adjustedMarketRent: 42,
        termLength: leaseTerm.termLength,
        concessions,
        chargeConcessions: [],
      })),
      inventoryId: inventory.id,
      publishDate: now().toDate(),
      expirationDate: now().add(12, 'months').toDate(),
      leaseStartDate: now().toDate(),
      additionalAndOneTimeCharges: {
        oneTimeCharges: [
          {
            displayName: 'Security deposit',
            quoteSectionName: 'deposit',
            isMinAndMaxRentDiff: false,
            relativeAmountsByLeaseTerm: [
              {
                amount: securityDepositAmount,
                selected: true,
                leaseTermId: leaseTerms[0].id,
              },
            ],
          },
        ],
        additionalCharges: [
          {
            amount: 42,
            quantity: 1,
            displayName: 'Air conditioner',
            quoteSectionName: 'appliance',
          },
        ],
      },
    },
    publishDate: now().toDate(),
  });
};

export const createTestQuotes = async ({ party, property, quoteSettings }) => {
  const settings = { ...defaultQuoteSettings, ...quoteSettings };

  const building = await createABuilding({ propertyId: property.id });
  const leaseName = await createALeaseName(testCtx, { propertyId: property.id });

  const fee = await createAFee({
    feeType: 'inventoryGroup',
    feeName: `fee1${v4()}`,
    absolutePrice: 100,
    propertyId: property.id,
  });

  const inventoryGroup = await createAInventoryGroup({
    name: `testInventoryGroup${v4()}`,
    propertyId: property.id,
    leaseNameId: leaseName.id,
    feeId: fee.id,
  });

  const leaseTerms = await Promise.all(
    Array(settings.numberOfLeaseTerms)
      .fill()
      .map(
        async (_, idx) =>
          await createALeaseTerm({
            leaseNameId: leaseName.id,
            propertyId: property.id,
            termLength: idx * 2 + 2,
          }),
      ),
  );

  const inventory = await createAnInventory({
    propertyId: property.id,
    buildingId: building.id,
    inventoryGroupId: inventoryGroup.id,
    externalId: '01-BARB-23',
  });

  const amenity = await createAnAmenity({
    id: v4(),
    category: 'inventory',
    propertyId: property.id,
  });

  await addAmenityToInventory(testCtx, inventory.id, amenity.id);

  const securityDepositAmount = 42;

  const quotes = await Promise.all(
    Array(settings.numberOfQuotes)
      .fill()
      .map(async () => await createTestQuote(party, inventory, leaseTerms, securityDepositAmount)),
  );
  return {
    quotes,
    securityDepositAmount,
    leaseTerms,
    inventory,
  };
};

export const createScreeningTestData = async ({ quoteSettings, memberSettings = {}, applicantSettings, maskSSN } = {}) => {
  const { userId, team, property, party, residents, guarantors, pets } = await createTestBaseInfo({ memberSettings });
  logger.trace({ userId, teamId: team.id, partyId: party.id }, 'created testBaseInfo');

  const { inventory, leaseTerms, quotes, securityDepositAmount } = await createTestQuotes({ party, property, quoteSettings });
  const { updatedApplicantsNames = [] } = memberSettings;
  const appSettings = { ...defaultApplicantSettings, ...applicantSettings };

  const holdDepositFee = await createAFee({
    feeType: 'holdDeposit',
    feeName: 'holdDeposit',
    absolutePrice: 42,
    propertyId: property.id,
  });
  const applicationFee = await createAFee({
    feeType: 'application',
    feeName: 'singleAppFee',
    absolutePrice: 43,
    propertyId: property.id,
  });

  const partyApplication = await createAPartyApplication(party.id, v4());

  const personApplications = [].concat(
    await Promise.all(
      residents.map(async (resident, idx) => {
        const { firstName = `rf${resident.fullName}`, lastName = `rl${resident.fullName}` } = updatedApplicantsNames[idx] || {};
        return await createAPersonApplication(
          {
            firstName,
            lastName,
            email: `luke${idx}@reva.tech`,
            dateOfBirth: now(),
            socSecNumber: appSettings.hasItin ? '921-56-4444' : '121-56-4444',
            otherApplicants: appSettings.otherApplicants || [],
            guarantors: appSettings.guarantors || [],
            haveInternationalAddress: appSettings.hasInternationalAddress,
          },
          resident.personId,
          party.id,
          partyApplication.id,
          false,
          null,
          false,
          maskSSN,
        );
      }),
    ),
    await Promise.all(
      guarantors.map(async (guarantor, idx) => {
        const { firstName = `gf${guarantor.fullName}`, lastName = `gl${guarantor.fullName}` } = updatedApplicantsNames[idx] || {};
        return await createAPersonApplication(
          {
            firstName,
            lastName,
            email: `lukeg${idx}@reva.tech`,
            dateOfBirth: now(),
            socSecNumber: appSettings.hasItin ? '921-56-4444' : '121-56-4444',
            otherApplicants: [],
            guarantors: [],
            haveInternationalAddress: appSettings.hasInternationalAddress,
          },
          guarantor.personId,
          party.id,
          partyApplication.id,
          false,
          null,
          false,
          maskSSN,
        );
      }),
    ),
  );

  const invoices = await Promise.all(
    personApplications.map(
      async personsApplication =>
        await createAnApplicationInvoice({
          applicationFeeId: applicationFee.id,
          applicationFeeAmount: applicationFee.absolutePrice,
          personApplicationId: personsApplication.id,
          holdDepositFeeId: holdDepositFee.id,
          holdDepositFeeIdAmount: holdDepositFee.absolutePrice,
        }),
    ),
  );

  return {
    party,
    property,
    team,
    inventory,
    residents,
    guarantors,
    pets,
    leaseTerms,
    userId,
    quotes,
    securityDepositAmount,
    holdDepositFee,
    applicationFee,
    personApplications,
    invoices,
  };
};

export const generateFADVResponse = async (
  tenantId,
  { scenarioFile, applicantIdentifier, applicantsIdentifiers, screeningRequestId, applicants, status, applicationDecision, basePath },
) => {
  const template = await readFileAsString(scenarioFile, basePath);
  const filledResponseTemplate = await fillHandlebarsTemplate(template, {
    tenantId,
    applicantIdentifier,
    applicantsIdentifiers,
    screeningRequestId,
    applicants,
    applicationDecision,
  });

  const parsedResponse = await xml2js(filledResponseTemplate);
  const response = await handleParsedFADVResponse({ tenantId }, parsedResponse);

  const submissionResponse = {
    submissionRequestId: getSubmissionRequestId({ tenantId }, response),
    rawResponse: parsedResponse,
    applicationDecision: response.ApplicationDecision,
    applicantDecision: response.ApplicantDecision,
    externalId: response.externalId,
    status,
  };

  return await createSubmissionResponse(tenantId, submissionResponse);
};

export const createPartyOfSinglePersonScreeningRequest = async (tenantId, additionalData) => {
  const userId = await createAUser().id;
  const { id: propertyId } = await createAProperty();
  const partyApplicationId = v4();

  const party = await createAParty({ userId, assignedPropertyId: propertyId });
  const partyId = party.id;
  await createAPartyApplication(partyId, partyApplicationId, {}, tenantId);

  const applicantName = 'Tyrion';
  const applicantLastName = 'Potter';

  const person = await createAPerson(applicantName, applicantLastName);
  const personId = person.id;
  const partyMember = await createAPartyMember(partyId, { fullName: applicantName, memberType: DALTypes.MemberType.RESIDENT, personId });
  const personApplication = await createAPersonApplication(
    { firstName: applicantName, lastName: applicantLastName, additionalData },
    personId || partyMember.personId,
    partyId,
  );
  const applicantId = personApplication.applicantId;

  const applicants = [
    {
      applicantId,
      lastName: applicantLastName,
      firstName: applicantName,
      decision: ScreeningDecision.APPROVED,
    },
  ];

  const ctx = { tenantId };
  const submissionRequest = await createSubmissionRequest(ctx, {
    partyApplicationId,
    propertyId,
    rawRequest: '',
    applicantData: { applicants },
    requestType: FadvRequestTypes.NEW,
  });
  return { partyId, personId, screeningRequestId: submissionRequest.id, applicantId, applicants, propertyId, partyApplicationId };
};

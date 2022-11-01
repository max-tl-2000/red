/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import v4 from 'uuid/v4';
import request from 'supertest';
import { mapSeries } from 'bluebird';
import { expect } from 'chai';
import sleep from '../../common/helpers/sleep';

import { DALTypes } from '../../common/enums/DALTypes';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { enhance } from '../../common/helpers/contactInfoUtils';
import { importLeaseTemplates } from '../workers/lease/importLeaseTemplatesHandler';
import { refreshUnitSearchView } from '../dal/searchRepo';
import { getPartyLeases } from '../dal/leaseRepo';
import { applyFeeToConcession } from '../dal/feeRepo';
import { signLease } from '../services/leases/leaseService';
import { createAPersonApplication } from '../../rentapp/server/test-utils/repo-helper';
import * as repoHelper from './repoHelper';
import { tenant } from './setupTestGlobalContext';
import app from '../api/api';
import { getAuthHeader, waitFor } from './apiHelper';
import { saveBusinessEntity } from '../dal/businessEntityRepo';
import { saveProperty } from '../dal/propertyRepo';
import { LA_TIMEZONE } from '../../common/date-constants';
import { PARTY_MESSAGE_TYPE, LEASE_MESSAGE_TYPE } from '../helpers/message-constants';
import { now } from '../../common/helpers/moment-utils';
import { getApplicantName } from '../../common/helpers/applicants-utils';

const LEASE_DELAY = 500;

export const checkForPartyDocumentEventToBeSent = (publishMsg, processed, msg) => {
  const documentMessage = msg.fields.routingKey === PARTY_MESSAGE_TYPE.DOCUMENT_HISTORY;
  if (documentMessage) {
    console.log({ publishMsg, processed }, 'checkForEvent');
  }
  const matched = processed && documentMessage;
  return matched;
};

export const startWaitingForEvents = (matcher, count = 1) => {
  const { resolvers, promises } = waitFor([...Array(count).keys()].map(_i => checkForPartyDocumentEventToBeSent));
  matcher.addWaiters(resolvers);
  return promises;
};

export const insertQuotePromotion = async (partyId, quoteId, leaseTermId) =>
  await repoHelper.createAQuotePromotion(partyId, DALTypes.PromotionStatus.APPROVED, quoteId, leaseTermId);

export const createTestProperty = async ({ timezone = LA_TIMEZONE, name = 'cove', externalId = 'cove' } = {}) => {
  const settings = {
    screening: { propertyName: '132660' },
    lease: { propertyName: '132660' },
    renewals: { renewalCycleStart: 30 },
    integration: { export: { newLease: true }, import: { residentData: false } },
    comms: { daysToRouteToALPostMoveout: 120 },
    rxp: { features: { paymentModule: true, maintenanceModule: true } },
  };
  const testCtx = { tenantId: tenant.id };
  const address = await repoHelper.createAnAddress({});
  const partyCohort = await repoHelper.createAPartyCohort({ name: 'testCohort', description: 'testCohortDescription' }, testCtx);

  const businessEntity = await saveBusinessEntity(testCtx, {
    name: `The Starks ${v4()}`,
    type: DALTypes.BusinessEntityType.OWNER,
    addressId: address.id,
  });

  const property = {
    name,
    propertyLegalName: 'The Cove',
    displayName: 'The Cove',
    owner: businessEntity.id,
    addressId: address.id,
    timezone,
    settings,
    externalId,
    partyCohortId: partyCohort.id,
    paymentProvider: {
      aptexx: {
        accountIds: {
          hold: 2,
          application: 1,
        },
      },
    },
  };

  return saveProperty(testCtx, property);
};

export const createTestConcessions = async (propertyId, feeId) => {
  const concession1 = await repoHelper.createAConcession({
    propertyId,
    name: 'concession1 non-recurring',
  });
  await applyFeeToConcession(
    { tenantId: tenant.id },
    {
      concessionId: concession1.id,
      feeId,
    },
  );

  const concession2 = await repoHelper.createAConcession({
    propertyId,
    name: 'concession2 recurring 2 months',
    recurring: true,
    recurringCount: 2,
  });
  await applyFeeToConcession(
    { tenantId: tenant.id },
    {
      concessionId: concession2.id,
      feeId,
    },
  );

  return [concession1, concession2];
};

export const createAResidentExperienceTeam = async ({ propertyName = 'cove' } = {}) => {
  const property = await createTestProperty({ name: propertyName });
  const residentServiceTeam = await repoHelper.createATeam({
    name: 'team2',
    module: 'residentServices',
    email: 'test1@test.a',
    phone: '15417544217',
    properties: property.name,
  });

  const residentServiceDispatcherUser = await repoHelper.createAUser();
  await repoHelper.createATeamMember({
    teamId: residentServiceTeam.id,
    userId: residentServiceDispatcherUser.id,
    roles: {
      functionalRoles: [FunctionalRoleDefinition.LAA.name, FunctionalRoleDefinition.LD.name],
    },
  });
  return {
    user: residentServiceDispatcherUser,
    team: residentServiceTeam,
    property,
  };
};

export const addGuarantorToParty = async (partyId, guarantorEmail = 'lukeg@reva.tech') => {
  const guarantorCi = enhance([
    { type: 'email', value: guarantorEmail },
    { type: 'phone', value: '12025550163' },
  ]);

  return await repoHelper.createAPartyMember(partyId, {
    fullName: 'Anakin Skywalker',
    contactInfo: guarantorCi,
    memberType: DALTypes.MemberType.GUARANTOR,
  });
};

export const createTestPartyData = async ({
  shouldAddGuarantorToParty = true,
  daysFromNow = 0,
  residentEmail = 'luke@reva.tech',
  timezone,
  guarantorEmail,
  isCorporateParty,
  workflowName = DALTypes.WorkflowName.NEW_LEASE,
  seedPartyId,
  backendMode,
  companyName,
} = {}) => {
  const user = await repoHelper.createAUser({ name: 'Foo' });
  const userId = user.id;

  const team = await repoHelper.createATeam({
    name: 'team',
    module: 'leasing',
    email: 'team1@reva.tech',
    phone: '12025550190',
  });
  await repoHelper.createATeamMember({
    teamId: team.id,
    userId,
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LCA.name, FunctionalRoleDefinition.LWA.name],
    },
  });

  const property = await createTestProperty({ timezone });
  const secondProperty = await createTestProperty({ timezone, name: 'Another Property', externalId: 'anotherPropExtId' });
  const partyData = {
    userId,
    teams: [team.id],
    assignedPropertyId: property.id,
    ownerTeam: team.id,
    leaseType: isCorporateParty ? DALTypes.PartyTypes.CORPORATE : DALTypes.PartyTypes.TRADITIONAL,
    workflowName,
    seedPartyId,
  };

  if (daysFromNow > 0) {
    partyData.metadata = {
      firstContactedDate: now({ timezone }).add(daysFromNow, 'days').toJSON(),
    };
  }

  const party = await repoHelper.createAParty(partyData);
  const company = await repoHelper.createACompany(companyName || 'Millennium_Falco');

  const residentCi = enhance([
    { type: 'email', value: residentEmail },
    { type: 'phone', value: '12025550163' },
  ]);
  const guarantors = shouldAddGuarantorToParty ? [await addGuarantorToParty(party.id, guarantorEmail)] : [];

  const residents = [
    await repoHelper.createAPartyMember(party.id, {
      fullName: backendMode === DALTypes.BackendMode.MRI ? 'Luke Skywalker' : 'Luke Skywalker "Jedi house"',
      contactInfo: residentCi,
      memberType: DALTypes.MemberType.RESIDENT,
      memberState: isCorporateParty ? DALTypes.PartyStateType.CONTACT : DALTypes.PartyStateType.APPLICANT,
      guaranteedBy: guarantors[0]?.id,
      ...(isCorporateParty ? { companyId: company.id } : {}),
    }),
  ];

  const pets = [await repoHelper.createAPartyPet(party.id)];
  const vehicles = [await repoHelper.createAPartyVehicle(party.id)];
  const children = [await repoHelper.createAPartyChild(party.id)];

  return {
    userId,
    user,
    team,
    property,
    secondProperty,
    party,
    residents,
    guarantors,
    pets,
    vehicles,
    children,
    company,
  };
};

export const createTestQuote = async ({
  property,
  inventoryGroup,
  leaseTerm,
  party,
  concessions = [],
  propertyDisplayName,
  inventoryName,
  inventoryExternalId,
  leaseStartDate,
}) => {
  const building = await repoHelper.createABuilding({ propertyId: property.id, displayName: propertyDisplayName });

  const inventory = await repoHelper.createAnInventory({
    propertyId: property.id,
    buildingId: building.id,
    inventoryGroupId: inventoryGroup.id,
    externalId: inventoryExternalId || '01-BARB-23',
    name: inventoryName,
  });

  const amenity = await repoHelper.createAnAmenity({
    id: v4(),
    category: 'inventory',
    propertyId: property.id,
  });

  await repoHelper.addAmenityToInventory({ tenantId: tenant.id }, inventory.id, amenity.id);

  await refreshUnitSearchView({ tenantId: tenant.id });
  const quoteId = v4();
  const quote = await repoHelper.createAQuote(party.id, {
    id: quoteId,
    inventoryId: inventory.id,
    propertyTimezone: LA_TIMEZONE,
    publishedQuoteData: {
      id: quoteId,
      leaseTerms: [
        {
          id: leaseTerm.id,
          adjustedMarketRent: 42,
          termLength: 12,
          concessions,
          chargeConcessions: [],
        },
      ],
      inventoryId: inventory.id,
      publishDate: now().toDate(),
      expirationDate: now().add(12, 'months').toDate(),
      leaseStartDate: leaseStartDate || now().toDate(),
      additionalAndOneTimeCharges: {
        oneTimeCharges: [
          {
            displayName: 'Security deposit',
            quoteSectionName: 'deposit',
            isMinAndMaxRentDiff: false,
            relativeAmountsByLeaseTerm: [
              {
                amount: 42, // securityDepositAmount,
                selected: true,
                leaseTermId: leaseTerm.id,
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

  return { inventory, amenity, quote: { ...quote, propertyId: property.id } };
};

const addPersonApplication = async (partyId, person, applicantSettings) => {
  const applicantName = getApplicantName(person.fullName);
  return await createAPersonApplication(
    {
      firstName: applicantName.firstName,
      middleName: applicantName.middleName,
      lastName: applicantName.lastName,
      email: person.contactInfo.defaultEmail,
      dateOfBirth: applicantSettings.dateOfBirth || now(),
      otherApplicants: [],
      guarantors: [],
      haveInternationalAddress: applicantSettings.hasInternationalAddress,
    },
    person.personId,
    partyId,
  );
};

export const createLeaseTestData = async ({
  applicantSettings = {},
  appSettings = {},
  daysFromNow = 0,
  residentEmail,
  propertyDisplayName,
  isCorporateParty,
  workflowName,
  seedPartyId,
  leaseStartDate,
  createSecondQuote = false,
  backendMode = DALTypes.BackendMode.Yardi,
} = {}) => {
  const { shouldInsertQuotePromotion = true, shouldAddGuarantorToParty = true, includeHoldDepositeFee = true } = appSettings;
  const { userId, user, team, property, secondProperty, party, residents, guarantors, pets, vehicles, company } = await createTestPartyData({
    shouldAddGuarantorToParty,
    daysFromNow,
    residentEmail,
    isCorporateParty,
    workflowName,
    seedPartyId,
    backendMode,
  });
  const holdDepositFee =
    includeHoldDepositeFee &&
    (await repoHelper.createAFee({
      feeType: 'holdDeposit',
      feeName: 'holdDeposit',
      absolutePrice: 42,
      propertyId: property.id,
      externalChargeCode: 'secdep',
      externalChargeAccount: '24000',
      externalChargeAccrualAccount: '12000',
      externalChargeNotes: 'Security Deposit',
      externalChargeRef: ':MoveIn',
    }));
  const applicationFee = await repoHelper.createAFee({
    feeType: 'application',
    feeName: 'singleAppFee',
    absolutePrice: 43,
    propertyId: property.id,
    externalChargeCode: 'appfee',
    externalChargeAccount: '48916',
    externalChargeAccrualAccount: '12000',
    externalChargeNotes: 'Application Fee (Lease Signed) :Reva',
    externalChargeRef: ':Applic',
    externalReceiptOffset: '10005',
    externalReceiptNotes: 'Application Fee :Reva',
    externalReceiptRef: ':Applic',
    externalReceiptAccount: '48916',
    externalReceiptAccrualAccount: '12000',
    externalWaiverOffset: '10005',
    externalWaiverNotes: 'Application Concession',
    externalWaiverRef: ':Applic',
    externalWaiverAccount: '48916',
    externalWaiverAccrualAccount: '12000',
  });

  const leaseName = await repoHelper.createALeaseName({ tenantId: tenant.id }, { propertyId: property.id });

  const fee = await repoHelper.createAFee({
    feeType: 'inventoryGroup',
    feeName: 'fee1',
    absolutePrice: 100,
    propertyId: property.id,
  });
  const concessions = await createTestConcessions(property.id, fee.id);
  const leaseTerm = await repoHelper.createALeaseTerm({
    leaseNameId: leaseName.id,
    propertyId: property.id,
    termLength: 12,
  });

  const inventoryGroup = await repoHelper.createAInventoryGroup({
    name: 'testInventoryGroup',
    propertyId: property.id,
    leaseNameId: leaseName.id,
    feeId: fee.id,
  });

  const secondInventoryGroup = await repoHelper.createAInventoryGroup({
    name: 'testInventoryGroup2',
    propertyId: secondProperty.id,
    leaseNameId: leaseName.id,
    feeId: fee.id,
    externalId: 'secondIGExternalId',
  });

  const { inventory, amenity, quote } = await createTestQuote({
    property,
    inventoryGroup,
    leaseTerm,
    party,
    concessions,
    propertyDisplayName,
    leaseStartDate,
  });

  const { inventory: secondInventory, quote: secondQuote } =
    createSecondQuote &&
    (await createTestQuote({
      property: secondProperty,
      inventoryGroup: secondInventoryGroup,
      leaseTerm,
      party,
      concessions,
      propertyDisplayName,
      leaseStartDate,
      inventoryName: 'secondInventory',
      inventoryExternalId: 'secondInventoryExtId',
    }));

  const personsApplications = shouldAddGuarantorToParty
    ? [await addPersonApplication(party.id, residents[0], applicantSettings), await addPersonApplication(party.id, guarantors[0], applicantSettings)]
    : [await addPersonApplication(party.id, residents[0], applicantSettings)];

  await importLeaseTemplates({ tenantId: tenant.id });

  return {
    party,
    property,
    secondProperty,
    team,
    inventory,
    secondInventory,
    inventoryGroup,
    secondInventoryGroup,
    residents,
    guarantors,
    pets,
    vehicles,
    leaseTerm,
    fee,
    amenityId: amenity.id,
    partyId: party.id,
    userId,
    user,
    concessions,
    quote,
    secondQuote,
    securityDepositAmount: 42,
    promotedQuote: shouldInsertQuotePromotion && (await insertQuotePromotion(party.id, quote.id, leaseTerm.id)),
    holdDepositFee,
    applicationFee,
    personsApplications,
    company,
  };
};

export const createLease = async (partyId, userId, promotedQuoteId, team) => {
  const { statusCode, body } = await request(app)
    .post(`/parties/${partyId}/leases`)
    .set(getAuthHeader(tenant.id, userId, team && [team]))
    .send({ promotedQuoteId });
  expect(statusCode).to.equal(200, 'Create lease is successful');
  return body;
};

export const publishLease = async ({ partyId, lease, userId, team, publishedLease, matcher, skipWaitingForEvents }) => {
  const queueConditionForPublish = (publishMsg, processed, msg) => {
    const matched = publishMsg.leaseData && publishMsg.leaseData.id === lease.id && processed && msg.fields.routingKey === LEASE_MESSAGE_TYPE.PUBLISH_LEASE;
    return matched;
  };

  const conditions = skipWaitingForEvents ? [queueConditionForPublish] : [queueConditionForPublish, checkForPartyDocumentEventToBeSent];
  const { resolvers, promises } = waitFor(conditions);
  matcher.addWaiters(resolvers);

  const { statusCode, body } = await request(app)
    .post(`/parties/${partyId}/leases/${lease.id}/publish`)
    .set(getAuthHeader(tenant.id, userId, team && [team]))
    .send({
      id: lease.id,
      baselineData: { ...lease.baselineData, publishedLease },
    });
  expect(statusCode).to.equal(200, 'Publish lease is successful');

  await sleep(LEASE_DELAY);
  await Promise.all(promises);
  return body;
};

export const signLeaseByAllPartyMembers = async (leaseId, partyId, matcher, waitForEvents = true) => {
  const partyLease = (await getPartyLeases({ tenantId: tenant.id }, partyId)).find(l => l.id === leaseId);
  const membersSignatures = partyLease.signatures.filter(item => item.partyMemberId);

  const ctx = { tenantId: tenant.id };
  const waiters = startWaitingForEvents(matcher, membersSignatures.length);
  await mapSeries(
    membersSignatures,
    async signature =>
      await signLease({
        ctx,
        envelopeId: signature.envelopeId,
        clientUserId: signature.metadata.clientUserId,
      }),
  );

  if (waitForEvents) {
    await sleep(LEASE_DELAY);
    await Promise.all(waiters);
  }
  return partyLease;
};

export const signLeaseByOneMember = async (leaseId, partyId) => {
  const partyLease = (await getPartyLeases({ tenantId: tenant.id }, partyId)).find(l => l.id === leaseId);
  const memberSignature = partyLease.signatures.find(item => item.partyMemberId);

  const ctx = { tenantId: tenant.id };

  await signLease({
    ctx,
    envelopeId: memberSignature.envelopeId,
    clientUserId: memberSignature.metadata.clientUserId,
  });

  return partyLease;
};

export const counterSignLease = async (leaseId, partyId, matcher, waitForEvents = true) => {
  const partyLease = (await getPartyLeases({ tenantId: tenant.id }, partyId)).find(l => l.id === leaseId);
  const countersignerSignature = partyLease.signatures.filter(item => item.userId);

  const waiters = startWaitingForEvents(matcher);
  const ctx = { tenantId: tenant.id };
  await mapSeries(countersignerSignature, async signature => {
    await signLease({
      ctx,
      envelopeId: signature.envelopeId,
      clientUserId: signature.metadata.clientUserId,
    });
  });
  if (waitForEvents) {
    await sleep(LEASE_DELAY);
    await Promise.all(waiters);
  }
  return partyLease;
};

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import random from 'lodash/random';
import range from 'lodash/range';
import round from 'lodash/round';
import sample from 'lodash/sample';
import { mapSeries } from 'bluebird';
import { hash } from '../../helpers/crypto';
import * as repoHelper from '../../testUtils/repoHelper';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import { REVA_ADMIN_EMAIL } from '../../../common/auth-constants';
import config from '../../config';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getUserByEmail } from '../../dal/usersRepo';
import * as randomUtils from '../../testUtils/random';
import { getLayoutsWhereNameIn } from '../../dal/layoutRepo';
import { getAmenities } from '../../dal/amenityRepo';
import { getSources } from '../../dal/sourcesRepo';

const LEAD_EMAIL_DOMAIN = 'reva.tech';
const roles = {
  mainRoles: [MainRoleDefinition.LA.name],
  functionalRoles: [FunctionalRoleDefinition.LD.name],
};
const managerFunctionalRoles = [FunctionalRoleDefinition.LAA.name, FunctionalRoleDefinition.LCA.name];

const maxNoOfProperties = 30000;

const layoutNames = ['Room1', 'Room2', 'Abigton', 'Ballantine', 'Abbot', 'Arton', 'Clipper', 'Mariner'];

const getLayouts = async ctx => await getLayoutsWhereNameIn(ctx, layoutNames);

const addDispatcherToTeam = async (ctx, { teamId, teamName, password, voiceMessageId }) => {
  const dispatcher = await repoHelper.createAUser({
    ctx,
    name: `${teamName} dispatcher`,
    email: `${teamName}-dispatcher@${LEAD_EMAIL_DOMAIN}`,
    password,
  });
  await repoHelper.createATeamMember({ ctx, teamId, userId: dispatcher.id, roles, voiceMessageId });
  return dispatcher;
};

const addManagerToTeam = async (ctx, { teamId, teamName, password, type, voiceMessageId, businessTitle }) => {
  const user = await repoHelper.createAUser({
    ctx,
    name: `${teamName} ${type} manager`,
    email: `${teamName}-${type.toLowerCase()}-manager@${LEAD_EMAIL_DOMAIN}`,
    password,
    businessTitle,
  });
  await repoHelper.createATeamMember({
    ctx,
    teamId,
    userId: user.id,
    roles: {
      mainRoles: [type],
      functionalRoles: managerFunctionalRoles,
    },
    voiceMessageId,
  });
  return user;
};

const addRevaAdminToTeam = async (ctx, { teamId, revaAdminId, voiceMessageId }) =>
  await repoHelper.createATeamMember({
    ctx,
    teamId,
    userId: revaAdminId,
    roles: {
      mainRoles: [MainRoleDefinition.RM.name],
      functionalRoles: [FunctionalRoleDefinition.LAA.name],
    },
    voiceMessageId,
  });

const getRandomUserData = (teamNumber, userNumber) => {
  const randomUserName = randomUtils.name().toLowerCase();
  return { userName: `user-${teamNumber}-${userNumber}-${randomUserName}`, userEmail: `${randomUserName}-${userNumber}@${LEAD_EMAIL_DOMAIN}` };
};

const termLengthValues = [1, 6, 9, 12];

const createLeaseTerms = async (ctx, propertyId, leaseNameId) =>
  await mapSeries(termLengthValues, async tl => await repoHelper.createALeaseTerm({ ctx, termLength: tl, leaseNameId, propertyId }));

const getAmenitiesByCategory = (amenities, category) => amenities.filter(a => a.category === category);

const createLease = async (ctx, propertyId) => {
  const lease = await repoHelper.createALeaseName(ctx, { propertyId });
  await createLeaseTerms(ctx, propertyId, lease.id);
  return lease;
};
const holdDepositFeeData = {
  feeType: DALTypes.FeeType.HOLD_DEPOSIT,
  leaseState: '',
  feeName: 'holdDeposit',
  absolutePrice: 500,
  displayName: 'Hold deposit',
  externalChargeCode: 'secdep',
};
const applicationFeeData = {
  feeType: DALTypes.FeeType.APPLICATION,
  feeName: 'singleAppFee',
  leaseState: '',
  absolutePrice: 43,
  displayName: 'Application fee',
  externalChargeCode: 'appfee',
  externalChargeAccount: '48916',
  externalChargeAccrualAccount: '12000',
  externalChargeNotes: 'Application Fee (Lease Signed) :Reva',
  externalChargeRef: ':Applic',
  externalReceiptAccount: '48916',
  externalReceiptAccrualAccount: '12000',
  externalReceiptNotes: 'Application Fee :Reva',
  externalReceiptRef: ':Applic',
  externalWaiverOffset: 'appwaive',
  externalWaiverAccount: '48918',
  externalWaiverAccrualAccount: '12000',
  externalWaiverNotes: 'Application Concession',
};

const apartmentFeeData = {
  feeType: DALTypes.FeeType.INVENTORY_GROUP,
  feeName: 'Apartment',
  displayName: 'Internal: Apartment with utilities included',
  quoteSectionName: 'inventory',
  externalChargeCode: 'baserent',
  leaseState: '',
};

const concessionData = {
  bakedIntoAppliedFeeFlag: true,
  relativeAdjustment: 2.5,
  name: 'Upshift in market rent',
};
const addUnitsAndBuildingToProperty = async (ctx, propertyId, addressId, indexTeam, noOfTeams, layouts, amenities) => {
  const buildingAmenities = getAmenitiesByCategory(amenities, DALTypes.AmenityCategory.BUILDING);
  const inventoryAmenities = getAmenitiesByCategory(amenities, DALTypes.AmenityCategory.INVENTORY);
  const lease = await createLease(ctx, propertyId);
  await repoHelper.createAFee({ ctx, ...holdDepositFeeData, propertyId });
  await repoHelper.createAFee({ ctx, ...applicationFeeData, propertyId });
  const apartmentFee = await repoHelper.createAFee({ ctx, ...apartmentFeeData, propertyId });
  const concession = await repoHelper.createAConcession({ ctx, ...concessionData, propertyId });
  await repoHelper.createAConcessionFee(ctx, concession.id, apartmentFee.id);

  await mapSeries(range(3), async b => {
    const building = await repoHelper.createABuilding({ ctx, displayName: `building ${indexTeam}-${b}`, propertyId, addressId });
    const buildingAmenity = sample(buildingAmenities);

    await repoHelper.addAmenityToBuilding(ctx, building.id, buildingAmenity.id);
    const inventoryGroupName = `inventoryGroup-${indexTeam}-${b}`;
    const inventoryGroup = await repoHelper.createAInventoryGroup({
      ctx,
      name: inventoryGroupName,
      propertyId,
      displayName: `Inventory Group for ${indexTeam}-${b}`,
      leaseNameId: lease.id,
      feeId: apartmentFee.id,
      externalid: inventoryGroupName,
    });
    await repoHelper.createAInventoryGroupAmenity(ctx, inventoryGroup.id, sample(inventoryAmenities).id);
    const layout = sample(layouts);
    await mapSeries(range(round(maxNoOfProperties / noOfTeams / 3)), async u => {
      const inventory = await repoHelper.createAnInventory({
        ctx,
        name: `unit-${indexTeam}-${b}-${u}`,
        propertyId,
        buildingId: building.id,
        floor: random(1, 4),
        inventoryGroupId: inventoryGroup.id,
        layoutId: layout.id,
        externalId: `unit-${indexTeam}-${b}-${u}`,
        rmsExternalId: '',
      });
      const inventoryAmenity = sample(inventoryAmenities);
      await repoHelper.addAmenityToInventory(ctx, inventory.id, inventoryAmenity.id);
    });
  });
};

const settings = {
  quote: {
    policyStatement: `To get the rates in this quote, please visit our leasing office
      or reach us at our phone number before your quote expires.\nA quote **does not** reserve a specific apartment,
      home or rentable item.\n\n* This quote is only valid for the specfied unit or rentable item, lease type and
      aplication type.\n* This quoted amount is guaranteed until this quote expires. If you make changes to the move-in date
       or the lease term, then your position in waitlist as well as the quoted amount may get changed.\n* Additional
        one-time fees, deposits or monthly charges may be required apart from the ones mentioned in this quote.\n* Actual
         fees/deposits and amounts may vary based upon policies and rates in effect at the time they are charged.`,
    expirationPeriod: 2,
    renewalLetterExpirationPeriod: 5,
    headerBackground: 'default',
    prorationStrategy: '30 day month',
  },
  calendar: { teamSlotDuration: 60 },
  inventory: { expectedMakeReadyDuration: 7 },
  screening: { propertyName: random(1000, 9999).toString(), incomePolicyRoommates: '', incomePolicyGuarantors: '' },
  leasing: { propertyName: random(1000, 9999).toString() },
  application: {
    descPets: 'Review property policies for pet related policies.',
    descVehicles: 'Review property policies for vehicle related policies.',
    descChildren: 'Children are minors who will be living with you and not financially responsible for rent obligations.',
    urlPropPolicy: '',
    descIncomeSource: 'Enter details about your income and other financial sources',
    descAddressHistory: 'Enter your current address and immediate previous address',
    descSharedDocuments: 'Upload any documents needed to support your application. Contact the propoerty if you have questions.',
    descPrivateDocuments: 'Upload any documents needed to support your application. Contact the propoerty if you have questions.',
  },
};

const addAgents = async (ctx, { teamIndex, password, teamId, voiceMessageId }) => {
  await mapSeries(range(2), async u => {
    const { userName, userEmail } = getRandomUserData(teamIndex, u);
    const user = await repoHelper.createAUser({
      ctx,
      name: userName,
      email: userEmail,
      isAdmin: false,
      password,
    });
    await repoHelper.createATeamMember({
      ctx,
      teamId,
      userId: user.id,
      voiceMessageId,
    });
  });
};

const addUsersToTeam = async (ctx, { teamId, teamIndex, teamName, password, voiceMessageId, revaAdminId }) => {
  await addDispatcherToTeam(ctx, { teamId, teamName, password, voiceMessageId });
  await addManagerToTeam(ctx, { teamId, teamName, password, type: MainRoleDefinition.RM.name, voiceMessageId, businessTitle: 'Regional Manager' });
  await addManagerToTeam(ctx, { teamId, teamName, password, type: MainRoleDefinition.PM.name, voiceMessageId, businessTitle: 'Property Manager' });
  await addRevaAdminToTeam(ctx, { teamId, revaAdminId, voiceMessageId });
  await addAgents(ctx, { teamIndex, password, teamId, voiceMessageId });
};

const addProgram = async (ctx, { team, teamIndex, source, property, voiceMessage }) => {
  const program = await repoHelper.createAProgram({
    ctx,
    name: `program${teamIndex}`,
    directEmailIdentifier: `program${teamIndex}`,
    directPhoneIdentifier: `1${random(1000000000, 9999999999)}`,
    source,
    team,
    property,
    voiceMessages: voiceMessage,
    onSiteLeasingTeam: team,
  });
  await repoHelper.createAProgramReferrer({ ctx, programId: program.id });
  await repoHelper.addATeamPropertyProgram(ctx, {
    teamId: team.id,
    propertyId: property.id,
    programId: program.id,
    commDirection: DALTypes.CommunicationDirection.OUT,
  });
};

export const insertHugeData = async (ctx, noOfTeams) => {
  const password = await hash(config.import.users.revaAdminPassword);
  const voiceMessage = await repoHelper.createVoiceMessages(ctx);
  const revaAdmin = await getUserByEmail(ctx, REVA_ADMIN_EMAIL);
  const layouts = await getLayouts(ctx);
  const amenities = await getAmenities(ctx);
  const sources = await getSources(ctx);

  await mapSeries(range(noOfTeams), async tm => {
    const property = await repoHelper.createAProperty(
      settings,
      { name: `property${tm}`, addressLine1: `address property ${tm}`, city: 'New York', postalCode: '10014', state: 'NY' },
      ctx,
    );
    await addUnitsAndBuildingToProperty(ctx, property.id, property.addressId, tm, noOfTeams, layouts, amenities);
    const teamName = `team-${tm}`;
    const team = await repoHelper.createATeam({
      ctx,
      name: teamName,
      email: `${teamName}@${LEAD_EMAIL_DOMAIN}`,
      phone: `1${random(1000000000, 9999999999)}`,
      properties: property.name,
    });
    await addProgram(ctx, { team, teamIndex: tm, source: sample(sources), property, voiceMessage });
    await addUsersToTeam(ctx, { teamId: team.id, teamIndex: tm, teamName, password, voiceMessageId: voiceMessage.id, revaAdminId: revaAdmin.id });
  });
};

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import { insertInto, initQuery, rawStatement } from '../database/factory';
import {
  createParty,
  createPartyMember,
  insertQuotePromotion,
  savePartyAdditionalInfo,
  getActivePartyMemberIdsByPartyId,
  createCompany,
} from '../dal/partyRepo';
import { savePartyEvent } from '../dal/partyEventsRepo';
import { createPerson, getPersonById } from '../dal/personRepo';
import { updateTenant, getTenantData } from '../dal/tenantsRepo';
import { admin, common } from '../common/schemaConstants';
import { saveExternalPhone } from '../dal/externalPhonesRepo';
import { saveActivityLog } from '../dal/activityLogRepo';
import { saveProperty } from '../dal/propertyRepo';
import { appointmentToTaskModel, appointmentToUserCalendarEventModel } from '../services/appointments';
import { saveBusinessEntity } from '../dal/businessEntityRepo';
import { saveAddress } from '../dal/addressRepo';
import { saveInventory, saveInventoryOnHold } from '../dal/inventoryRepo';
import { saveContactInfo } from '../dal/contactInfoRepo';
import { saveTeamData as saveTeam } from '../dal/teamsRepo';
import { saveSource } from '../dal/sourcesRepo';
import { createAsset } from '../dal/assetsRepo';
import { saveNavigationHistoryEntry } from '../dal/navigationHistoryRepo';
import { hash } from '../helpers/crypto';
import { sanitizeDirectEmailIdentifier } from '../../common/helpers/mails';
import { DALTypes } from '../../common/enums/DALTypes';
import { LA_TIMEZONE } from '../../common/date-constants';
import { ACTIVITY_TYPES, COMPONENT_TYPES } from '../../common/enums/activityLogTypes';
import * as random from './random';
import { tenant } from './test-tenant';
import { saveTask } from '../dal/tasksRepo';
import { saveUserEvent, saveTeamEvent } from '../dal/calendarEventsRepo';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';
import { createDocument } from '../dal/documentsRepo';
import { saveQuote } from '../dal/quoteRepo';
import { refreshUnitSearchView } from '../dal/searchRepo';
import { createCommonUser } from '../../auth/server/dal/common-user-repo';
import { saveProgram, updateProgram, saveProgramReferrer, saveTeamPropertyProgram, saveProgramReference, getProgramByName } from '../dal/programsRepo';
import { now, DATE_ISO_FORMAT, toMoment } from '../../common/helpers/moment-utils';
import { CalendarUserEventType } from '../../common/enums/calendarTypes';
import { getUsersAvailabilities, saveAvailability } from '../dal/floatingAgentsRepo';
import { saveCampaign } from '../dal/campaignsRepo';
import { saveCommsTemplate } from '../dal/commsTemplateRepo';
import { savePropertyPartySetting, saveScreeningCriteria } from '../dal/screeningCriteriaRepo';
import { parseDataSetUsingPropertyId } from '../import/rms/parsers/reva';
import { saveUnitsPricingUsingPropertyId } from '../dal/rmsPricingRepo';
import { saveActiveLeaseWorkflowData } from '../dal/activeLeaseWorkflowRepo';
import { RmsPricingEvents } from '../../common/enums/enums';
import { saveMarketingLayoutGroup } from '../dal/marketingLayoutGroupsRepo';
import { saveMarketingQuestion } from '../dal/marketingQuestionsRepo';
import { saveMarketingLayout } from '../dal/marketingLayoutsRepo';
import { saveMarketingAsset } from '../dal/marketingAssetsRepo';
import { addNewCommunication } from '../services/communication';
import { createPost, updatePostHeroImageIdByPostId } from '../dal/cohortCommsRepo';
import { createPublicDocument } from '../dal/publicDocumentRepo';
import { savePartyCohort } from '../dal/partyCohortRepo';

const { BackendMode } = DALTypes;

export const testCtx = tenant;

export const officeHoursAlwaysOff = {
  Monday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Tuesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Wednesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Thursday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Friday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Saturday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
  Sunday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 0 },
};

export const officeHoursAlwaysOn = {
  Monday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Tuesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Wednesday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Thursday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Friday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Saturday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
  Sunday: { startTimeOffsetInMin: 0, endTimeOffsetInMin: 1440 },
};

export const createAnAddress = async ({ addressLine1 = 'P. Sherman 42 Wallaby Way', postalCode = 'IDK', city = 'Sidney', state }, ctx = testCtx) =>
  await saveAddress(ctx, { addressLine1, postalCode, city, state });

export const createAPartyCohort = async (partyCohort, ctx = testCtx) => await savePartyCohort(ctx, partyCohort);

export const createAProperty = async (
  settings = {
    screening: { propertyName: '132660' },
    lease: { propertyName: '132660' },
    quote: { policyStatement: 'bla bla' },
    integration: { import: { unitPricing: false } },
    comms: { daysToRouteToALPostMoveout: 120 },
    appointment: { tourTypesAvailable: [DALTypes.TourTypes.IN_PERSON_TOUR] },
    application: { urlPropPolicy: 'testUrl' },
  },
  data = {},
  ctx = testCtx,
) => {
  const address = await createAnAddress(data, ctx);
  const partyCohort = await createAPartyCohort({ name: 'testCohort', description: 'testCohortDescription' }, ctx);
  const businessEntity = await saveBusinessEntity(ctx, {
    name: `The Starks ${newId()}`,
    type: DALTypes.BusinessEntityType.OWNER,
    addressId: address.id,
  });
  const name = data.name || data.propertyName || `Winterfell ${newId()}`;
  const property = {
    name,
    propertyLegalName: data && data.name ? data.name : `Brandon Stark ${newId()}`,
    displayName: name,
    owner: businessEntity.id,
    addressId: address.id,
    timezone: LA_TIMEZONE,
    settings,
    externalId: name,
    endDate: data.endDate || null,
    rmsExternalId: data.rmsExternalId || name,
    leasingOfficeAddress: `leasing office address for property ${name}`,
    startDate: new Date().toISOString(),
    APN: '91',
    MSANumber: 7400,
    MSAName: 'New York, NY',
    websiteDomain: data.websiteDomain,
    website: data.website || `${name}.com`,
    postMonth: new Date().toISOString(),
    geoLocation: { lat: 37.72236, lng: -122.47534 },
    partyCohortId: partyCohort.id,
  };
  return await saveProperty(ctx, property);
};

const createAPropertyScreeningCriterias = async (property, screeningCriterias, context) => {
  const createdScreeningCriterias = await Promise.all(
    screeningCriterias.map(
      async criteria =>
        await saveScreeningCriteria(context || testCtx, {
          ...omit(criteria.screeningCriteria, 'guarantorResidentRelationship'),
          name: criteria.name,
        }),
    ),
  );

  await Promise.all(
    createdScreeningCriterias.map(async screeningCriteria => {
      const propertyPartySetting = {
        propertyId: property.id,
        screeningCriteriaId: screeningCriteria.id,
        partyType: screeningCriteria.name.includes(DALTypes.PartyTypes.TRADITIONAL) ? DALTypes.PartyTypes.TRADITIONAL : DALTypes.PartyTypes.CORPORATE,
        inactive: false,
      };
      await savePropertyPartySetting(context || testCtx, propertyPartySetting);
    }),
  );
};

export const createAPropertyWithPartySettings = async (settings, screeningCriterias, context) => {
  const property = await createAProperty(settings, {}, context);
  await createAPropertyScreeningCriterias(property, screeningCriterias, context);

  return property;
};

export const createACampaign = async (name, displayName, description) => {
  const campaign = {
    name,
    displayName,
    description,
  };
  return await saveCampaign(testCtx, campaign);
};

export const createAnExternalPhone = async ({ number, displayName, teamIds = [], propertyId }) =>
  await saveExternalPhone(testCtx, {
    number,
    displayName,
    teamIds,
    propertyId,
  });

let teamNameIncrement = 0;

export const createATeam = async ({
  ctx = testCtx,
  name,
  module = DALTypes.ModuleType.LEASING,
  metadata: testMetadata = {},
  properties = '',
  functionalRoles,
  timeZone = 'America/Los_Angeles',
  officeHours = officeHoursAlwaysOn,
  callCenterPhoneNumber = '',
  inactiveFlag = false,
  externalCalendars,
  voiceMessage,
} = {}) => {
  const metadata = {
    callQueue: {},
    call: {},
    comms: {
      sendCalendarCommsFlag: true,
      ...testMetadata.comms,
    },
    ...testMetadata,
  };
  const theTeamName = name || `Some team ${++teamNameIncrement}`;
  const teamData = {
    name: theTeamName,
    displayName: theTeamName,
    module,
    description: '',
    properties,
    callCenterPhoneNumber,
    metadata,
    timeZone,
    officeHours,
    externalCalendars,
    voiceMessage,
    inactiveFlag,
  };
  const savedTeam = await saveTeam(ctx, teamData);
  return functionalRoles ? { ...savedTeam, functionalRoles } : savedTeam;
};

let userIncrement = 0;

export const createAUser = async ({
  ctx = testCtx,
  name,
  email,
  status,
  isAdmin = false,
  ringPhones = [],
  metadata = {},
  sipEndpoints,
  lastLoginAttempt,
  externalCalendars,
  password,
  businessTitle = 'Leasing Consultant',
  externalUniqueId,
  fullName,
  notAvailableSetAt,
} = {}) => {
  const pass = password || (await hash('123'));

  const finalName = name || `Foo${++userIncrement}`;
  const finalEmail = email || `foo${++userIncrement}@bar.com`;
  const fullNameFinal = fullName || finalName;

  const userData = {
    id: newId(),
    externalUniqueId: externalUniqueId || newId(),
    password: pass,
    fullName: fullNameFinal,
    preferredName: 'Bar',
    email: finalEmail,
    loginAttempts: 1,
    lastLoginAttempt,
    metadata: {
      isAdmin,
      businessTitle,
      ...omit(metadata, ['status', 'statusUpdatedAt', 'notAvailableSetAt', 'wrapUpCallTimeoutId', 'loginTimeoutId']),
    },
    sipEndpoints: JSON.stringify(sipEndpoints || [{ username: finalName, password: finalName, endpointId: finalName, isUsedInApp: true }]),
    ringPhones,
    externalCalendars,
  };

  const user = await insertInto(ctx.tenantId, 'Users', userData);

  const userStatusData = {
    id: newId(),
    userId: user.id,
    status: status || metadata?.status || DALTypes.UserStatus.AVAILABLE,
    statusUpdatedAt: metadata?.statusUpdatedAt || null,
    notAvailableSetAt: notAvailableSetAt || metadata?.notAvailableSetAt || null,
    wrapUpCallTimeoutId: metadata?.wrapUpCallTimeoutId || null,
    loginTimeoutId: metadata?.loginTimeoutId || null,
  };

  const userStatus = await insertInto(ctx.tenantId, 'UserStatus', userStatusData);

  return {
    ...user,
    metadata: {
      ...user.metadata,
      ...pick(userStatus, ['status', 'statusUpdatedAt', 'notAvailableSetAt', 'wrapUpCallTimeoutId', 'loginTimeoutId']),
    },
  };
};

export const createALeasingUser = async ({
  ctx = testCtx,
  name = 'Foo',
  email = `foo${newId()}@bar.com`,
  status = DALTypes.UserStatus.AVAILABLE,
  isAdmin = false,
  ringPhones = [],
  metadata,
} = {}) =>
  createAUser({
    ctx,
    name,
    email,
    status,
    isAdmin,
    ringPhones,
    metadata,
  });

// available options:
// createAssignedProperty (boolean): will create a new property and set party's
//    assigned property to it
export const createAParty = async (partyData = {}, context, options = {}) => {
  if (options.createAssignedProperty) {
    const { id: propertyId } = await createAProperty({}, {}, context);
    partyData.assignedPropertyId = propertyId;
  }
  const ctx = context || testCtx;
  partyData.workflowState =
    partyData?.workflowState ||
    (partyData?.endDate && DALTypes.WorkflowState.CLOSED) ||
    (partyData?.archiveDate && DALTypes.WorkflowState.ARCHIVED) ||
    DALTypes.WorkflowState.ACTIVE;

  partyData.ownerTeam = partyData?.ownerTeam || (await createATeam()).id;

  const party = await createParty(ctx, { id: newId(), ...partyData });

  const partyEvent = { partyId: party.id, event: 'PARTY_CREATED', userId: null, partyMemberId: null, metadata: {} };
  await savePartyEvent(ctx, partyEvent);
  return party;
};

export const createActiveLeaseData = async (activeLeaseData, context) => {
  const ctx = context || testCtx;
  return await saveActiveLeaseWorkflowData(ctx, activeLeaseData);
};

export const createAPartyMember = async (partyId, { fullName = 'Tyrion Lannister', memberType = DALTypes.MemberType.RESIDENT, ...rest } = {}, overrideCtx) => {
  const member = { fullName, memberType, preferredName: fullName, ...rest };
  return await createPartyMember(overrideCtx || testCtx, member, partyId);
};

export const createACompany = async displayName => await createCompany(testCtx, displayName);

export const createAPartyPet = (
  partyId,
  petInfo = {
    type: 'pet',
    info: {
      breed: 'Pomeranian',
      weight: '11 lbs',
      name: 'Matty',
      type: 'Dog',
    },
  },
) => savePartyAdditionalInfo(testCtx, { partyId, ...petInfo });

export const createAPartyVehicle = (
  partyId,
  carInfo = {
    type: 'car',
    info: {
      color: 'Red',
      state: 'IN',
      makeYear: '2014',
      tagNumber: 'CJ 01 WEX',
      makeAndModel: 'Ford F500',
    },
  },
) => savePartyAdditionalInfo(testCtx, { partyId, ...carInfo });

export const createAPartyChild = (
  partyId,
  childInfo = {
    type: 'child',
    info: {
      fullName: 'Bill Child',
      preferredName: 'Billy',
    },
  },
) => savePartyAdditionalInfo(testCtx, { partyId, ...childInfo });

export const createAPerson = async (fullName = 'Tyrion Lannister', preferredName = 'The Imp', contactInfo) =>
  await createPerson(testCtx, {
    fullName,
    preferredName,
    idType: 'VirtualPerson',
    contactInfo,
  });

export const createAPersonWithoutName = async contactInfo =>
  await createPerson(testCtx, {
    fullName: null,
    preferredName: null,
    idType: 'VirtualPerson',
    contactInfo,
  });

export const getAPerson = async id => await getPersonById(testCtx, id);

export const createAPersonContactInfo = async (personId, ...info) => await saveContactInfo(testCtx, info, personId);

export const createACommunicationEntry = async ({
  parties = [],
  persons = [],
  direction = DALTypes.CommunicationDirection.IN,
  type = DALTypes.CommunicationMessageType.EMAIL,
  threadId,
  category = DALTypes.CommunicationCategory.USER_COMMUNICATION,
  message = {
    text: 'Random text for testing purposes',
    subject: 'Test Subject',
    from: 'from@test.com',
    to: 'to@test.io',
  },
  userId,
  teams = [],
  messageId = newId(),
  unread = true,
  ...rest
} = {}) => {
  let messageEntity = {
    messageId,
    message,
    parties,
    persons,
    type,
    direction,
    threadId,
    userId,
    teams,
    unread,
    ...rest,
  };
  if (type === DALTypes.CommunicationMessageType.EMAIL) {
    messageEntity = { ...messageEntity, category };
  }
  return await addNewCommunication(testCtx, messageEntity);
};

export const createAnAdminUser = async userCtx => {
  const password = await hash('123');

  const userData = {
    id: newId(),
    externalUniqueId: newId(),
    password,
    email: `fuzz${++userIncrement}@bar.com`,
    fullName: 'Admin',
    preferredName: 'Bar',
    metadata: { isAdmin: true },
  };

  return await insertInto(userCtx.tenantId, 'Users', userData);
};

export const createATeamProperty = async (teamId, propertyId) => await insertInto(testCtx.tenantId, 'TeamProperties', { teamId, propertyId });

export const createASource = async (name, displayName, description, type) => {
  const source = {
    name,
    displayName,
    description,
    type,
  };
  return await saveSource(testCtx, source);
};

export const createACommonSource = async (name, type) => {
  const commonCtx = { tenantId: common.id };
  const query = 'INSERT INTO db_namespace."ProgramSources" ("name", "type") VALUES (:name, :type);';

  const row = await rawStatement(commonCtx, query, [{ name, type }]);
  return row;
};

export const ivrKeys = { callback: '5', voicemail: '1', transferToNumber: '9' };
export const ivrExternalNumber = '12025550196';

const getIVRVoiceMessages = (areMessagesMp3, emergencyItemName, voicemailItemName, callbackItemName) =>
  areMessagesMp3
    ? {
        afterHours: 'afterHoursIVR.mp3',
        unavailable: 'unavailableIVR.mp3',
      }
    : {
        afterHours: `The office is now closed. For emergencies press %${emergencyItemName}%. To leave a voice message press %${voicemailItemName}%. To request an agent call you back press %${callbackItemName}%.`,
        unavailable: `We're unavailable right now. For emergencies press %${emergencyItemName}%. To leave a voice message press %${voicemailItemName}%. To request an agent call you back press %${callbackItemName}%.`,
      };

const getNonIVRVoiceMessages = areMessagesMp3 =>
  areMessagesMp3
    ? {
        afterHours: 'afterHours.mp3',
        unavailable: 'unavailable.mp3',
      }
    : {
        afterHours: 'Thank you for calling our apartment community. The office is now closed.[record]',
        unavailable: "Hi!  We're unavailable right now.[record]",
      };

export const createVoiceMessages = async (ctx = testCtx, { transferToNumber = ivrExternalNumber, withIvrMessages, areMessagesMp3, messages } = {}) => {
  const callbackItemName = newId();
  const voicemailItemName = newId();
  const emergencyItemName = newId();
  await insertInto(ctx.tenantId, 'VoiceMenuItems', {
    id: newId(),
    name: callbackItemName,
    key: ivrKeys.callback,
    action: DALTypes.VoiceMenuAction.REQUEST_CALLBACK,
  });
  await insertInto(ctx.tenantId, 'VoiceMenuItems', {
    id: newId(),
    name: voicemailItemName,
    key: ivrKeys.voicemail,
    action: DALTypes.VoiceMenuAction.TRANSFER_TO_VOICEMAIL,
  });
  await insertInto(ctx.tenantId, 'VoiceMenuItems', {
    id: newId(),
    name: emergencyItemName,
    key: ivrKeys.transferToNumber,
    action: DALTypes.VoiceMenuAction.TRANSFER_TO_PHONE_NUMBER,
    number: transferToNumber,
  });

  const voiceMessages = withIvrMessages
    ? getIVRVoiceMessages(areMessagesMp3, emergencyItemName, voicemailItemName, callbackItemName)
    : getNonIVRVoiceMessages(areMessagesMp3);

  const [voiceMessage] = await initQuery(ctx)
    .insert({
      id: newId(),
      name: newId(),
      callQueueWelcome: `Thank you for calling our apartment community.
        Please hold while we connect you with the next available leasing agent.
        To leave a voice message press %${voicemailItemName}%.
        To request an agent call you back press %${callbackItemName}%.
        For emergencies press %${emergencyItemName}%. Thank you for your patience.`,
      callQueueUnavailable: `We apologize for the delay.
        Please leave a message and a leasing agent will return your call as soon as they come available`,
      callQueueClosing: 'Thank you for calling our apartment community. The office is now closed.',
      callBackRequestAck: 'Your call back request was registered. We will get back to you soon. Thank you!',
      callRecordingNotice: 'This phone call may be recorded for security and training purposes.',
      voicemail: 'Leave your message after the tone',
      holdingMusic: 'phone-hold-waltz-30s.mp3',
      ...voiceMessages,
      ...messages,
    })
    .into('VoiceMessages')
    .returning('*');

  return voiceMessage;
};

export const createAProgram = async ({
  ctx = testCtx,
  reportingDisplayName,
  name = 'program1',
  directEmailIdentifier = 'test.program',
  directPhoneIdentifier = '12223334444',
  path = 'direct',
  source,
  team,
  property,
  voiceMessages,
  onSiteLeasingTeam,
  endDate,
  metadata,
} = {}) => {
  const theSource = source || (await createASource('testSource', 'test source display name', 'desc', 'type'));
  const theTeam = team || (await createATeam());
  const theProperty = property || (await createAProperty());
  const theVoiceMessages = voiceMessages || (await createVoiceMessages());
  const theOnSiteLeasingTeam = onSiteLeasingTeam || (await createATeam());
  const commsForwardingData = {
    forwardingEnabled: false,
    forwardEmailToExternalTarget: null,
    forwardCallToExternalTarget: null,
    forwardSMSToExternalTarget: null,
  };
  const defaultMetadata = {
    defaultMatchingPath: null,
    requireMatchingPath: false,
    requireMatchingSource: false,
    defaultMatchingSourceId: null,
    commsForwardingData,
  };
  const dbProgram = await getProgramByName(ctx, name);

  const program = {
    name,
    displayName: name,
    reportingDisplayName: reportingDisplayName || name,
    description: name,
    sourceId: theSource.id,
    directEmailIdentifier,
    outsideDedicatedEmails: [`${directEmailIdentifier}@reva.tech`],
    displayEmail: `${directEmailIdentifier}@reva.tech`,
    directPhoneIdentifier,
    displayPhoneNumber: directPhoneIdentifier,
    onSiteLeasingTeamId: theOnSiteLeasingTeam.id,
    voiceMessageId: theVoiceMessages.id,
    campaignId: null,
    path,
    metadata: metadata || defaultMetadata,
    endDate,
    endDateSetOn: null,
    displayUrl: null,
  };

  return await saveProgram({ ctx, program, dbProgram, teamId: theTeam.id, propertyId: theProperty.id });
};

export const createAProgramReferrer = async ({
  ctx = testCtx,
  programId,
  order = '1.00',
  currentUrl = 'bing(.*).com(.*)',
  referrerUrl = 'google(.*).com(.*)',
  isDefault,
} = {}) =>
  saveProgramReferrer(ctx, {
    programId: programId || (await createAProgram()).id,
    order,
    currentUrl,
    referrerUrl,
    isDefault,
  });

export const createAProgramReference = async ({ parentProgramId, referenceProgramId, referenceProgramPropertyId }) =>
  saveProgramReference(testCtx, { parentProgramId, referenceProgramId, referenceProgramPropertyId });

export const createABuilding = async ({ ctx = testCtx, name, displayName, propertyId, addressId, floorCount = 1, type, externalId }) => {
  const theName = name || random.name();
  const data = {
    propertyId: propertyId || (await createAProperty()).id,
    name: theName,
    displayName: displayName || theName,
    addressId: addressId || (await createAnAddress({})).id,
    floorCount,
    type: type || DALTypes.BuildingType.SINGLE_FAMILY,
    startDate: new Date().toISOString(),
    surfaceArea: '10000',
    externalId: externalId || null,
  };
  return await insertInto(ctx.tenantId, 'Building', data);
};

export const createALeaseName = async (ctx = testCtx, { name, propertyId }) =>
  await insertInto(ctx.tenantId, 'LeaseName', {
    name: name || random.name(),
    propertyId: propertyId || (await createAProperty()).id,
    inventoryType: DALTypes.InventoryType.UNIT,
  });

export const createALeaseTerm = async ({ ctx = testCtx, termLength, leaseNameId, period, propertyId, state } = {}) =>
  await insertInto(ctx.tenantId, 'LeaseTerm', {
    termLength: termLength || 1,
    leaseNameId: leaseNameId || (await createALeaseName(ctx, { propertyId })).id,
    period: period || 'month',
    state: state === undefined ? DALTypes.LeaseState.NEW : state,
  });

export const createAInventoryGroupAmenity = async (ctx, inventoryGroupId, amenityId) =>
  await insertInto(ctx.tenantId, 'InventoryGroup_Amenity', { inventoryGroupId, amenityId });

export const createAInventoryGroup = async ({
  ctx = testCtx,
  name,
  propertyId,
  displayName,
  leaseNameId,
  feeId,
  externalId,
  basePriceMonthly,
  shouldCreateLeaseTerm = false,
  termLength,
  leaseState,
}) => {
  const theName = name || random.name();
  const currentLeaseNameId = leaseNameId || (await createALeaseName(ctx, { propertyId })).id;
  const currentPropertyId = propertyId || (await createAProperty({}, {}, ctx)).id;

  shouldCreateLeaseTerm &&
    (await createALeaseTerm({ ctx, termLength: termLength || 12, leaseNameId: currentLeaseNameId, propertyId: currentPropertyId, state: leaseState }));

  const data = {
    propertyId: currentPropertyId,
    name: theName,
    displayName: displayName || theName,
    leaseNameId: currentLeaseNameId,
    feeId: feeId || null,
    externalId: externalId || 'ig-external-id',
    basePriceMonthly: basePriceMonthly || 3500,
    primaryRentable: true,
    economicStatus: DALTypes.EconomicStatus.RESIDENTIAL,
    rentControl: true,
    inventoryType: DALTypes.InventoryType.UNIT,
  };
  return await insertInto(ctx.tenantId, 'InventoryGroup', data);
};

export const createAnInventoryItem = async ({
  building,
  inventoryGroup,
  externalId,
  rmsExternalId,
  inventoryName,
  type,
  state,
  shouldCreateLeaseTerm = false,
  leaseState,
} = {}) => {
  const buildingForItem = building || (await createABuilding({}));
  const inventoryGroupForItem = inventoryGroup || (await createAInventoryGroup({ shouldCreateLeaseTerm, leaseState }));

  return await saveInventory(testCtx, {
    propertyId: buildingForItem.propertyId,
    buildingId: buildingForItem.id,
    inventoryGroupId: inventoryGroupForItem.id,
    type: type || DALTypes.InventoryType.UNIT,
    name: inventoryName || `test inventory ${newId()}`,
    state: state || DALTypes.InventoryState.VACANT_READY,
    externalId,
    rmsExternalId,
  });
};

export const refreshUnitSearch = async () => await refreshUnitSearchView(testCtx);

export const createALayout = async ({
  id,
  name,
  propertyId,
  displayName,
  numBedrooms = 1,
  numBathrooms = 1,
  surfaceArea = 0,
  marketingLayoutId = null,
  marketingVideoAssets = [],
  marketing3DAssets = [],
}) =>
  await insertInto(testCtx.tenantId, 'Layout', {
    id,
    name: name || random.name(),
    propertyId: propertyId || (await createAProperty({})).id,
    marketingLayoutId,
    displayName: displayName || random.name(),
    numBedrooms,
    numBathrooms,
    surfaceArea,
    marketingVideoAssets,
    marketing3DAssets,
  });

export const createAnInventory = async ({
  ctx = testCtx,
  name,
  type,
  propertyId,
  buildingId,
  description = null,
  floor = null,
  inventoryGroupId,
  layoutId = null,
  parentInventory = null,
  state = null,
  multipleItemTotal = null,
  externalId = null,
  rmsExternalId = null,
  address = '',
  availabilityDate = null,
  shouldCreateLeaseTerm = false,
  termLength,
} = {}) => {
  const thePropertyId = propertyId || (await createAProperty()).id;
  const data = {
    propertyId: thePropertyId,
    type: type || DALTypes.InventoryType.UNIT,
    name: name || 'test-unit',
    buildingId: buildingId || (await createABuilding({ propertyId: thePropertyId })).id,
    description,
    floor,
    inventoryGroupId: inventoryGroupId || (await createAInventoryGroup({ propertyId: thePropertyId, shouldCreateLeaseTerm, termLength })).id,
    layoutId: layoutId || (await createALayout({ propertyId: thePropertyId })).id,
    parentInventory,
    state: state || DALTypes.InventoryState.VACANT_READY,
    multipleItemTotal,
    externalId,
    rmsExternalId,
    address,
    availabilityDate,
  };
  return await saveInventory(ctx, data);
};

export const addAmenityToInventory = async (ctx, inventoryId, amenityId) =>
  await insertInto(ctx.tenantId, 'Inventory_Amenity', {
    inventoryId,
    amenityId,
  });

export const addAmenityToBuilding = async (ctx, buildingId, amenityId) =>
  await insertInto(ctx.tenantId, 'Building_Amenity', {
    buildingId,
    amenityId,
  });

export const createAnAmenity = async ({
  ctx = testCtx,
  id,
  name,
  category,
  subCategory,
  displayName,
  description = null,
  propertyId = null,
  highValueFlag = false,
  infographicName,
  order = 0,
  hidden = false,
}) =>
  await insertInto(ctx.tenantId, 'Amenity', {
    id,
    name: name || random.name(),
    category: category || DALTypes.AmenityCategory.INVENTORY,
    subCategory: subCategory || DALTypes.AmenitySubCategory.ACCESSIBILITY,
    displayName: displayName || random.name(),
    description,
    propertyId,
    highValue: highValueFlag,
    infographicName,
    order,
    hidden,
  });

export const createAnAppointment = async appointment => {
  appointment.startDate = appointment.startDate || toMoment('2016-12-14T16:30:00Z').toISOString(); // new Date('12-14-2016 16:30:00');
  appointment.endDate = appointment.endDate || toMoment('2016-12-14T17:30:00Z').toISOString(); // new Date('12-14-2016 17:30:00');
  appointment.metadata = {
    ...(appointment.metadata || {}),
    appointmentCreatedFrom:
      appointment.metadata && appointment.metadata.appointmentCreatedFrom ? appointment.metadata.appointmentCreatedFrom : DALTypes.AppointmentCreatedFrom.REVA,
  };

  if (appointment?.tenantId) {
    testCtx.tenantId = appointment.tenantId;
    delete appointment.tenantId;
  }

  if (appointment?.loadActivePartyMembers) {
    appointment.partyMembers = await getActivePartyMemberIdsByPartyId(testCtx, appointment.partyId);
  }

  const task = appointmentToTaskModel(appointment);
  const savedTask = await saveTask(testCtx, task);

  if (appointment.state !== DALTypes.TaskStates.CANCELED) {
    const userEvent = appointmentToUserCalendarEventModel(savedTask);
    await saveUserEvent(testCtx, userEvent);
  }

  return savedTask;
};

export const createUserEvent = async ({ userId, startDate, endDate, metadata = { type: CalendarUserEventType.PERSONAL } }) =>
  await saveUserEvent(testCtx, { userId, startDate, endDate, metadata });

export const createTeamEvent = async ({ teamId, startDate, endDate }) => await saveTeamEvent(testCtx, { teamId, startDate, endDate, externalId: newId() });

export const createAnActivityLog = async (userId, partyId) =>
  await saveActivityLog(testCtx, [
    {
      component: COMPONENT_TYPES.APPOINTMENT,
      type: ACTIVITY_TYPES.NEW,
      details: {
        Notes: 'first note',
      },
      context: {
        users: [userId],
        parties: [partyId],
      },
    },
  ]);

export const setAssociatedFees = async (primaryFee, associatedFee, isAdditional) =>
  await insertInto(testCtx.tenantId, 'Associated_Fee', { primaryFee, associatedFee, isAdditional });

export const createAFee = async ({
  ctx = testCtx,
  id = newId(),
  absolutePrice,
  feeName,
  displayName,
  propertyId,
  feeType,
  servicePeriod,
  depositInterestFlag = false,
  externalChargeCode,
  externalChargeAccount,
  externalChargeAccrualAccount,
  externalChargeNotes,
  externalChargeRef,
  externalReceiptOffset,
  externalReceiptNotes,
  externalReceiptRef,
  externalReceiptAccount,
  externalReceiptAccrualAccount,
  quoteSectionName,
  firstFee,
  externalWaiverOffset,
  externalWaiverNotes,
  externalWaiverRef,
  externalWaiverAccount,
  externalWaiverAccrualAccount,
  marketingQuestionId,
  maxQuantityInQuote,
}) => {
  const fee = await insertInto(ctx.tenantId, 'Fee', {
    id,
    name: feeName,
    absolutePrice,
    propertyId: propertyId || (await createAProperty({})).id,
    displayName: displayName || random.name(),
    feeType: feeType || DALTypes.FeeType.APPLICATION,
    servicePeriod,
    depositInterest: depositInterestFlag,
    externalChargeCode,
    externalChargeAccount,
    externalChargeAccrualAccount,
    externalChargeNotes,
    externalChargeRef,
    externalReceiptOffset,
    externalReceiptNotes,
    externalReceiptRef,
    externalReceiptAccount,
    externalReceiptAccrualAccount,
    externalWaiverOffset,
    externalWaiverNotes,
    externalWaiverRef,
    externalWaiverAccount,
    externalWaiverAccrualAccount,
    quoteSectionName,
    marketingQuestionId,
    maxQuantityInQuote,
  });
  fee.firstFee = firstFee;
  return fee;
};

export const createAConcession = async ({
  ctx = testCtx,
  id = newId(),
  propertyId,
  name,
  displayName = name,
  recurring = false,
  recurringCount = 0,
  bakedIntoAppliedFeeFlag = false,
  externalChargeCode = 'brconces',
  matchingCriteria = null,
  startDate = new Date(),
  account = '4000',
  relativeAdjustment = 0,
  absoluteAdjustment = 0,
  nonRecurringAppliedAt = 'first',
  subAccount = '0',
  relativeDefaultAdjustment = 0,
  absoluteDefaultAdjustment = 0,
}) =>
  await insertInto(ctx.tenantId, 'Concession', {
    id,
    name,
    displayName,
    propertyId: propertyId || (await createAProperty({})).id,
    recurring,
    recurringCount,
    bakedIntoAppliedFeeFlag,
    externalChargeCode,
    matchingCriteria,
    startDate,
    account,
    relativeAdjustment,
    absoluteAdjustment,
    nonRecurringAppliedAt,
    subAccount,
    relativeDefaultAdjustment,
    absoluteDefaultAdjustment,
  });
export const createAConcessionFee = async (ctx, concessionId, feeId) => await insertInto(ctx.tenantId, 'Concession_Fee', { concessionId, feeId });

export const createAnAsset = async entity => {
  const asset = {
    uuid: newId(),
    entity,
  };
  return await createAsset(testCtx, asset, { shouldCreatePhysicalAsset: true, checksum: '95d1d2e14401cc8f8554621bb06b01c8' });
};

export const createATask = async task => {
  const userIds = task.userIds || [(await createAUser({ ctx: testCtx, name: 'Default Task User' })).id];
  const rawTask = {
    name: task.name,
    partyId: task.partyId,
    state: task.state || DALTypes.TaskStates.ACTIVE,
    category: task.category || DALTypes.TaskCategories.PARTY,
    metadata: task.metadata || {},
    userIds,
    dueDate: task.dueDate || new Date(),
  };
  return await saveTask(testCtx, rawTask);
};

export const createADocument = async (ctx, document) => await createDocument(ctx, document);

export const createAPublicDocument = async (ctx, document, { shouldCreatePhysicalPublicDocument, checksum } = {}) =>
  await createPublicDocument(ctx, document, { shouldCreatePhysicalPublicDocument, checksum });

export const updatePostPublicDocument = async (ctx, postId, publicDocumentId) => await updatePostHeroImageIdByPostId(ctx, postId, publicDocumentId);

const defaultQuoteData = {
  publishedQuoteData: {
    leaseTerms: [],
    publishDate: new Date(),
    expirationDate: new Date(),
    leaseStartDate: new Date(),
    additionalAndOneTimeCharges: {
      oneTimeCharges: [],
      additionalCharges: [],
    },
  },
};

export const createAQuote = async (partyId, quoteData = defaultQuoteData) => {
  const inventoryId = quoteData.inventoryId || (await createAnInventory()).id;

  const quote = {
    inventoryId,
    partyId,
    propertyTimezone: LA_TIMEZONE,
    ...quoteData,
  };
  return await saveQuote(testCtx, quote);
};

export const createAQuotePromotion = async (partyId, status, quoteId, leaseTermId) => {
  const leaseTermCreated = await createALeaseTerm({});
  const quoteCreatedId = quoteId || (await createAQuote(partyId)).id;

  const quotePromotion = {
    partyId,
    quoteId: quoteCreatedId,
    leaseTermId: leaseTermId || leaseTermCreated.id,
    promotionStatus: status || DALTypes.PromotionStatus.APPROVED,
  };
  return await insertQuotePromotion(testCtx, quotePromotion);
};

export const createAnInventoryOnHold = async (inventoryId, partyId, heldBy, startDate, endDate, reason, quotable) => {
  const inventoryOnHold = {
    id: newId(),
    inventoryId,
    partyId,
    startDate: startDate || now(),
    endDate,
    reason: reason || DALTypes.InventoryOnHoldReason.MANUAL,
    heldBy,
    quotable: quotable || true,
  };

  return await saveInventoryOnHold(testCtx, inventoryOnHold);
};

export const createAPublishedQuote = async partyId => {
  const leaseTermCreated = await createALeaseTerm({});
  const leaseTerms = [{ termLength: leaseTermCreated.termLength, adjustedMarketRent: 1000, leaseNameId: leaseTermCreated.leaseNameId }];
  return await createAQuote(partyId, { publishDate: new Date(), publishedQuoteData: { publishDate: new Date(), leaseTerms } });
};

export const createACommonUser = async ({ tenantId, fullName, preferredName, email, personId }) => {
  const rawUser = {
    fullName,
    preferredName,
    email,
    metadata: {},
  };
  return await createCommonUser({ tenantId }, personId, rawUser);
};

export const createANavigationHistoryEntry = async entry => await saveNavigationHistoryEntry(testCtx, entry);

let programIncrement = 0;

const addProgram = async (ctx, programData) =>
  await initQuery(ctx)
    .insert({
      ...programData,
      directEmailIdentifier: sanitizeDirectEmailIdentifier(programData.directEmailIdentifier || null),
    })
    .into('Programs')
    .returning('*');

let teamMemberIncrement = 0;

export const createATeamMember = async ({
  ctx = testCtx,
  teamId,
  userId,
  roles = {
    mainRoles: [MainRoleDefinition.LA.name],
    functionalRoles: [FunctionalRoleDefinition.LWA.name],
  },
  directEmailIdentifier = `dev-stuff${++teamMemberIncrement}`,
  directPhoneIdentifier = `123456789${++teamMemberIncrement}`,
  outsideDedicatedEmails = [],
  inactive = false,
  voiceMessageId,
}) => {
  const { mainRoles, functionalRoles } = roles;
  const teamMemberData = {
    id: newId(),
    teamId,
    userId,
    mainRoles,
    functionalRoles,
    directEmailIdentifier: sanitizeDirectEmailIdentifier(directEmailIdentifier),
    directPhoneIdentifier,
    outsideDedicatedEmails,
    inactive,
    voiceMessageId: voiceMessageId || (await createVoiceMessages()).id,
  };

  return await insertInto(ctx.tenantId, 'TeamMembers', teamMemberData);
};

export const createAUserAndTeam = async ({ userParams = {}, teamParams = {}, propertyId, roles, isTeamMemberInactive } = {}) => {
  const user = await createAUser(userParams);
  const team = await createATeam(teamParams);
  await createATeamMember({ teamId: team.id, userId: user.id, roles, inactive: isTeamMemberInactive });

  let newProperty;
  if (!propertyId) {
    newProperty = await createAProperty();
  }
  await createATeamProperty(team.id, propertyId || newProperty.id);

  return { team, user };
};

export const createADispatcher = async propertyId =>
  await createAUserAndTeam({
    roles: {
      mainRoles: [MainRoleDefinition.LA.name],
      functionalRoles: [FunctionalRoleDefinition.LD.name],
    },
    propertyId,
  });

export const addATeamPropertyProgram = async (ctx, { teamId, propertyId, programId, commDirection }) =>
  await saveTeamPropertyProgram(ctx, { teamId, propertyId, programId, commDirection });

export const createATeamPropertyProgram = async ({
  ctx = testCtx,
  teamId,
  propertyId,
  onSiteLeasingTeamId,
  commDirection,
  directEmailIdentifier = null,
  displayEmail = null,
  outsideDedicatedEmails = [],
  directPhoneIdentifier = null,
  displayPhoneNumber = '12345678901',
  source = { name: `source${programIncrement}`, displayName: `source${programIncrement}`, type: 'source' },
  transferToNumber,
  voiceMessageId,
  programEndDate = null,
  programFallbackId = null,
}) => {
  const { id: sourceId } = await saveSource(ctx, source);
  const programName = `program${++programIncrement}`;
  const programDisplayName = `program${++programIncrement}`;
  const programDescription = `program${++programIncrement}`;
  const commsForwardingData = {
    forwardingEnabled: false,
    forwardEmailToExternalTarget: null,
    forwardCallToExternalTarget: null,
    forwardSMSToExternalTarget: null,
  };
  const metadata = {
    defaultMatchingPath: null,
    requireMatchingPath: false,
    requireMatchingSource: false,
    defaultMatchingSourceId: null,
    commsForwardingData,
  };

  const [program] = await addProgram(ctx, {
    id: newId(),
    name: programName,
    displayName: programDisplayName,
    reportingDisplayName: programDisplayName,
    description: programDescription,
    onSiteLeasingTeamId,
    sourceId,
    directEmailIdentifier,
    displayEmail,
    outsideDedicatedEmails,
    directPhoneIdentifier,
    displayPhoneNumber,
    voiceMessageId: voiceMessageId || (await createVoiceMessages(ctx, { transferToNumber })).id,
    path: 'direct',
    metadata,
    endDate: programEndDate,
    programFallbackId,
  });
  const teamPropertyProgram = await addATeamPropertyProgram(ctx, { teamId, propertyId, programId: program.id, commDirection });

  return { ...teamPropertyProgram, programName };
};

const getTestTenant = async () => await getTenantData(testCtx);

const updateTestTenant = async (metadata, settings) => {
  const adminCtx = { tenantId: admin.id };
  const { tenantId } = testCtx;
  return await updateTenant(adminCtx, tenantId, { metadata, settings });
};

export const toggleEnableRenewalsFeature = async enabled => {
  const { settings, metadata } = await getTestTenant();
  settings.features = { ...settings.features, enableRenewals: enabled };
  await updateTestTenant(metadata, settings);
};

export const toggleExtCalendarFeature = async enabled => {
  const { settings, metadata } = await getTestTenant();
  settings.features = { ...settings.features, enableExternalCalendarIntegration: enabled };
  metadata.externalCalendars = enabled ? { integrationEnabled: true, access_token: newId() } : {};
  await updateTestTenant(metadata, settings);
};

export const toggleSendIcsAttachmentFeature = async enabled => {
  const { settings, metadata } = await getTestTenant();
  settings.features = { ...settings.features, enableIcsAttachment: enabled };
  await updateTestTenant(metadata, settings);
};

export const getTenant = async () => await getTenantData(testCtx);

export const setTenantBackendIntegration = async (backendMode = BackendMode.NONE) => {
  const adminCtx = { tenantId: admin.id };
  const { tenantId } = testCtx;
  const { metadata } = await getTenantData(testCtx);

  const backendIntegration = { name: backendMode };

  // Delete cache to avoid affect integration test
  delete testCtx.cache;

  await updateTenant(adminCtx, tenantId, { metadata: { ...metadata, backendIntegration } });
};

export const enableHoneypotTrap = async () => {
  const adminCtx = { tenantId: admin.id };
  const { tenantId } = testCtx;
  const { settings } = await getTenantData(testCtx);
  settings.features = { ...settings.features, enableHoneypotTrap: true };

  await updateTenant(adminCtx, tenantId, { settings });
};

export const createAvailability = async (teamMemberId, day, modifiedBy) => await saveAvailability(testCtx, { teamMemberId, day, modifiedBy });
export const getAvailabilitiesForUsers = async (userIds, startDate, endDate) => await getUsersAvailabilities(testCtx, [userIds], startDate, endDate);

export const createACommTemplate = async name => {
  const template = {
    id: newId(),
    name,
    displayName: 'template-display-name',
    description: 'template-description',
    emailSubject: 'Template Subject',
    emailTemplate: '<mjml><mj-body>Email template body<mj-body></mjml>',
    smsTemplate: 'Sms template body',
  };

  return await saveCommsTemplate(testCtx, template);
};

export const saveUnitsRevaPricing = async (inventories, pricingType = DALTypes.LeaseState.NEW) =>
  await mapSeries(inventories, async ({ propertyId }) => {
    const { units: unitsPrices } = await parseDataSetUsingPropertyId(testCtx, propertyId);
    const unitsPricing = pricingType === DALTypes.LeaseState.RENEWAL ? unitsPrices.map(price => ({ ...price, renewalDate: now().toISOString() })) : unitsPrices;
    await saveUnitsPricingUsingPropertyId(testCtx, { unitsPricing, propertyId, rmsPricingEvent: RmsPricingEvents.REVA_IMPORT });
  });

export const createInventoryProcess = async () => {
  const property = await createAProperty();
  const layout = await createALayout({});

  const building = await createABuilding({ propertyId: property.id });

  const inventoryGroup = await createAInventoryGroup({
    propertyId: property.id,
  });

  const inventory = await createAnInventory({
    buildingId: building.id || null,
    layoutId: layout.id,
    propertyId: property.id,
    inventoryGroupId: inventoryGroup.id,
  });

  await createAnAmenity({
    id: newId(),
    category: 'inventory',
    propertyId: property.id,
  });

  const buildingAmenity = await createAnAmenity({
    id: newId(),
    category: 'building',
    propertyId: property.id,
  });

  const inventoryAmenity = await createAnAmenity({
    id: newId(),
    propertyId: property.id,
  });

  await addAmenityToBuilding(testCtx, building.id, buildingAmenity.id);
  await addAmenityToInventory(testCtx, inventory.id, inventoryAmenity.id);
  await saveUnitsRevaPricing([inventory]);
  await refreshUnitSearch();

  return inventory;
};

export const createAMarketingLayoutGroup = async (name, order = 0) => {
  const theName = name || random.name();
  const layoutGroup = {
    id: newId(),
    name: theName,
    displayName: `${theName} layout group`,
    description: `${theName} layout group description`,
    shortDisplayName: theName,
    order,
  };
  return await saveMarketingLayoutGroup(testCtx, layoutGroup);
};

export const createAMarketingQuestion = async (data = {}) => {
  const {
    name,
    displaySectionQuestion = 'defaultDisplayQuestions',
    displayPrimaryQuestion = 'Do you have pets',
    displayPrimaryQuestionDescription = 'pets',
    displayFollowupQuestion = 'How many pets?',
    inputTypeForFollowupQuestion = 'count',
    inactive = false,
    displayOrder = 1,
  } = data;

  const theName = name || random.name();
  const questionData = {
    id: newId(),
    name: theName,
    displaySectionQuestion,
    displayPrimaryQuestion,
    displayPrimaryQuestionDescription,
    displayFollowupQuestion,
    inputTypeForFollowupQuestion,
    enumValues: [],
    inactive,
    displayOrder,
  };
  return await saveMarketingQuestion(testCtx, questionData);
};

export const createAMarketingLayout = async (data = {}) => {
  const theName = data.name || random.name();
  const layout = {
    id: newId(),
    name: theName,
    propertyId: data.propertyId || (await createAProperty()).id,
    marketingLayoutGroupId: data.marketingLayoutGroupId || (await createAMarketingLayoutGroup()).id,
    displayName: `${theName} layout`,
    description: `${theName} layout description`,
    order: data.order || 0,
  };
  return await saveMarketingLayout(testCtx, layout);
};

export const createAMarketingAsset = async (data = {}) => {
  const theName = data.name || random.name();
  const marketingAsset = {
    id: newId(),
    name: theName,
    type: data.type || DALTypes.MarketingAssetType.VIDEO,
    url: `${theName}.com`,
    displayName: `${theName} marketing asset`,
    displayDescription: `${theName} marketing asset description`,
    altTag: '',
  };
  return await saveMarketingAsset(testCtx, marketingAsset);
};

export const makeProgramInactive = async programName => {
  const threeMonthsAgo = now().add(-3, 'months').startOf('day').format(DATE_ISO_FORMAT);

  const delta = { endDate: threeMonthsAgo };
  return await updateProgram(testCtx, programName, delta);
};

export const createAMRIExport = async ({
  ctx = testCtx,
  id = newId(),
  partyId,
  request = '{"headers":{"Authorization":"Basic fakeauth=","Content-Type":"application/xml"},"timeout":90000,"method":"post"}',
  response = null,
  url = 'https://fake.api.customerold.com/mri_api/api//ConfirmLease?$format=xml',
  api = null,
  requestBody = null,
  created_at,
}) => {
  const query = `
    INSERT INTO db_namespace."MRIExportTracking" ("id", "partyId", "request", "response", "url", "api", "requestBody", "created_at") 
    VALUES (:id, :partyId, :request, :response, :url, :api, :requestBody, :created_at );
  `;
  const row = await rawStatement(ctx, query, [{ id, partyId, request, response, url, api, requestBody, created_at }]);
  return row;
};

export const createAPost = async ({
  postId,
  category,
  subCategory,
  title,
  message,
  sentAt = null,
  sentBy = null,
  createdBy,
  updatedBy,
  retractedAt = null,
  createdAt,
  updatedAt,
  metadata,
}) => {
  const post = {
    id: postId || newId(),
    category,
    subCategory,
    title: title || 'test-post-title',
    message: message || 'test-post-message',
    sentAt,
    sentBy,
    createdBy,
    updatedBy,
    retractedAt,
    createdAt: createdAt || now(),
    updatedAt: updatedAt || now(),
    metadata,
  };
  return await createPost(testCtx, post);
};

export const createAPartyGroup = async () => await insertInto(testCtx.tenantId, 'PartyGroup', { id: newId() });

export const createAPostRecipient = async (postId, personId, propertyId) => {
  const id = newId();
  const personIdForPost = personId || (await createAPerson()).id;
  const propertyIdIdForPost = propertyId || (await createAProperty()).id;

  const { id: partyGroupId } = await createAPartyGroup();

  !personId &&
    (await createACommonUser({
      tenantId: testCtx.tenantId,
      fullName: 'Jackie Brown',
      preferredName: 'Jackie',
      email: 'jackie@bro.wn',
      personId: personIdForPost,
    }));

  return await insertInto(testCtx.tenantId, 'PostRecipient', {
    id,
    personId: personIdForPost,
    propertyId: propertyIdIdForPost,
    partyGroupId,
    postId,
    status: DALTypes.PostRecipientStatus.SENT,
  });
};

export const createADirectMessage = async ({
  category = DALTypes.CommunicationCategory.USER_COMMUNICATION,
  direction = DALTypes.CommunicationDirection.OUT,
  unread = true,
  partyId,
  directMessage,
  type = DALTypes.CommunicationMessageType.DIRECT_MESSAGE,
  userId,
  personId,
  threadId,
  teamId,
}) => {
  const teamIdToUse = teamId || (await createATeam()).id;
  const messageEntity = {
    message: directMessage,
    unread,
    type,
    parties: [partyId],
    userId,
    direction,
    persons: [personId],
    category,
    threadId: threadId || newId(),
    teams: [teamIdToUse],
    messageId: newId(),
    partyOwner: userId,
  };
  return await addNewCommunication(testCtx, messageEntity);
};

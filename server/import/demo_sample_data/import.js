/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import newId from 'uuid/v4';
import { mapSeries } from 'bluebird';
import { createParty, createPartyMember, createRawLead, getUnitsFiltersFromQuestions } from '../../dal/partyRepo';
import { refreshUnitSearchView } from '../../dal/searchRepo';
import { saveAppointment } from '../../services/appointments';
import { importTenantData as importInventoryFromXlsFile } from '../../workers/upload/uploadInventoryHandler.js';
import { getUserByEmail } from '../../dal/usersRepo';
import { getTeamBy, updateTeam } from '../../dal/teamsRepo';
import { saveToken } from '../../dal/tokensRepo';
import { getPropertyByName, updateProperty } from '../../dal/propertyRepo';
import { enhance } from '../../../common/helpers/contactInfoUtils';
import { sampleData, bigSampleData, generateRandomParty } from './sample-data';
import { DALTypes } from '../../../common/enums/DALTypes';
import { LA_TIMEZONE } from '../../../common/date-constants';
import { performPartyStateTransition } from '../../services/partyStatesTransitions';
import { savePartyAdditionalInfo, archiveParty } from '../../services/party';
import { getFeesByPropertyId } from '../../dal/feeRepo';
import {
  createOrUpdatePersonApplication,
  completePersonApplication,
  updatePersonApplicationPaymentCompleted,
} from '../../../rentapp/server/services/person-application';
import { createLeaseForParty, publishLeaseForParty, createAndPublishQuote, signLeaseByAllPartyMembers, counterSignLease } from './importHelper';
import { createActiveLeaseParty, createRenewalLeaseParty } from '../../services/workflows';
import { saveActiveLeaseWfData } from '../../services/activeLease';
import { addNewCommunication } from '../../services/communication';
import { updateInventory, updateInventoriesWithAvailabilityOffset } from '../../dal/inventoryRepo';
import { updateActiveLeaseData } from '../../dal/activeLeaseWorkflowRepo';
import * as commonUserService from '../../../auth/server/services/common-user';
import { AdditionalInfoTypes } from '../../../common/enums/partyTypes';
import { getApplyNowUrlForPerson } from '../../helpers/quotes';
import { createApplicationInvoice } from '../../../rentapp/server/services/application-invoices';
import { getValidFeesByName } from '../../services/fees';
import { importLeaseTemplates } from '../../workers/lease/importLeaseTemplatesHandler';
import logger from '../../../common/helpers/logger';
import { runInTransaction } from '../../database/factory';
import { now } from '../../../common/helpers/moment-utils';
import envVal from '../../../common/helpers/env-val';
import { getTenant, updateTenant } from '../../services/tenantService';
import { insertHugeData } from './hugeSampleData';
import { sendMessage } from '../../services/pubsub';
import { APP_EXCHANGE, IMPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { getPartyApplicationByPartyId, updatePartyApplicationApplicationData } from '../../../rentapp/server/services/party-application';
import sleep from '../../../common/helpers/sleep';
import { DEFAULT_WEBSITES_TOKEN_ID } from '../../../common/auth-constants';
import { doCalendarIntegration } from './demoCalendarIntegration';
import { saveRenewalMovingOutEvent } from '../../services/partyEvent';
import { removeAllDataFromRecurringJobs } from '../../dal/jobsRepo';
import { workflowCycleProcessor } from '../../workers/party/workflowCycleHandler';
import cucumberConfig from '../../../cucumber/config';
import { updateDecisionServiceBackend } from '../../dal/subscriptionsRepo';

const ASSETS_ZIP = './server/import/demo_sample_data/reva-sample.zip';
const DEMO_MARKETING_TOKEN_ID = '992587c0-49c8-4cf8-8fac-f955c0520755';
const DEMO_RASA_TOKEN_ID = '7c3b450a-9abb-4e80-99ba-929f8d96a773';
const DEMO_STAGING_RASA_TOKEN_ID = '45dded24-a494-4546-8870-37566b4e1fa7';
const collegeYearVacateReason = 'CC';

const triggerAssetsImport = async tenantId =>
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: IMPORT_MESSAGE_TYPE.UPLOAD_ASSETS,
    message: {
      tenantId,
      filePath: ASSETS_ZIP, // Default assets
      metadata: {
        files: [ASSETS_ZIP],
      },
    },
    ctx: { tenantId },
  });

const insertRawLeads = async (ctx, rawLeadsData) =>
  rawLeadsData &&
  (await mapSeries(rawLeadsData, async teamRawLeadsData => {
    await runInTransaction(async trx => {
      const trxCtx = { ...ctx, trx };
      const team = await getTeamBy(trxCtx, {
        name: teamRawLeadsData.teamName,
      });
      const user = await getUserByEmail(trxCtx, teamRawLeadsData.userRegistrationEmail);

      if (team && user) {
        for (const rawLeadData of teamRawLeadsData.rawLeads) {
          const person = {
            ...rawLeadData,
            contactInfo: enhance(rawLeadData.contactInfo),
          };

          const lead = await createRawLead({
            ctx: trxCtx,
            personData: person,
            teamsForParty: [team.id],
            collaboratorTeams: [team.id],
            userId: user.id,
          });
          await performPartyStateTransition(trxCtx, lead.id);
        }
      } else {
        logger.debug(
          { tenantId: ctx.tenantId, teamRawLeadsData },
          `Team ${teamRawLeadsData.teamName} or user ${teamRawLeadsData.userRegistrationEmail} does not exists. No Raw Leads will be inserted.`,
        );
      }
    });
  }));

const saveMembers = async (ctx, members, partyId) => {
  const partyMemberIds = [];
  const persons = [];

  await mapSeries(members, async member => {
    const guest = { ...member, contactInfo: enhance(member.contactInfo) };
    const dbPartyMember = await createPartyMember(ctx, guest, partyId);
    partyMemberIds.push(dbPartyMember.id);
    persons.push({
      personId: dbPartyMember.personId,
      preferredName: dbPartyMember.preferredName,
      applicationStatus: member.applicationStatus || '',
      contactInfo: dbPartyMember.contactInfo,
    });
  });

  return {
    partyMemberIds,
    persons,
  };
};

const saveChildren = async (ctx, children = [], partyId) =>
  await mapSeries(children, async child => {
    const childInfo = {
      info: child,
      partyId,
      type: AdditionalInfoTypes.CHILD,
    };
    const createdChild = await savePartyAdditionalInfo(ctx, childInfo);
    return createdChild;
  });

const createApplications = async (ctx, persons, members, partyId, quoteId) => {
  for (const person of persons) {
    if (person.applicationStatus) {
      const application = {
        personId: person.personId,
        partyId,
        applicationData: {
          firstName: person.preferredName,
          // the rest of these fields dont really matter for demo data, but are
          // needed to trigger screening
          lastName: 'Peterson',
          email: person.contactInfo.defaultEmail || 'norm@cheers.bar',
          grossIncome: '1234',
          addressLine1: '112 ½ Beacon Street',
          city: 'Boston',
          state: 'MA',
          zip: '02108',
        },
        additionalData: {
          skipSection: {
            skipIncomeSourcesSection: true,
            skipAddressHistorySection: true,
            skipDisclosuresSection: true,
            skipPrivateDocumentsSection: true,
            skipRentersInsuranceSection: true,
          },
        },
      };

      const partyApplicationData = {
        skipSection: {
          skipChildrenSection: true,
          skipPetsSection: true,
          skipVehiclesSection: true,
          skipSharedDocumentsSection: true,
        },
      };

      const app = await createOrUpdatePersonApplication(ctx, application);
      const { id: partyApplicationId } = await getPartyApplicationByPartyId(ctx, partyId);
      await updatePartyApplicationApplicationData(ctx, partyApplicationId, partyApplicationData);

      if (person.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED) {
        const fees = await getValidFeesByName(ctx, 'singleAppFee');
        await createApplicationInvoice(ctx, {
          quoteId,
          applicationFeeAmount: 50,
          personApplicationId: app.id,
          applicationFeeId: fees[0].id,
          paymentCompleted: true,
        });
        await updatePersonApplicationPaymentCompleted(ctx, app.id, true);
        await completePersonApplication(ctx, app.id);
        const commonUserRaw = {
          personId: person.personId,
          tenantId: ctx.tenantId,
          applicationId: 'application',
        };
        // this is needed for areas that assume commonUser was created upon payment
        await commonUserService.createCommonUser(ctx, commonUserRaw);
      }
    }
  }
};

const setUtcDate = (daysOffset, time) => {
  const timeValues = time.split(':');
  const daysOffsetInt = parseInt(daysOffset, 10);

  // The sample data is imported for California
  const result = now({ timezone: LA_TIMEZONE }).startOf('day').utc();
  if (daysOffsetInt < 0) {
    result.subtract(-daysOffsetInt, 'd');
  } else {
    result.add(daysOffsetInt, 'd');
  }
  result.add(timeValues[0], 'h');
  result.add(timeValues[1], 'm');

  return result.toDate();
};

const getAssignedProperty = async (ctx, { shouldAssignProperty, propertyName }) => {
  if (!shouldAssignProperty || !propertyName) return {};

  return (await getPropertyByName(ctx, propertyName)) || {};
};

const getLeaseEndDate = ({ leaseLength, isLeasePassed, workflowName = DALTypes.WorkflowName.NEW_LEASE, hasNotHitRenewalStartDate, renewalLeaseLength }) => {
  if (workflowName === DALTypes.WorkflowName.RENEWAL) {
    return now()
      .add(renewalLeaseLength * 30, 'days')
      .toDate();
  }

  if (isLeasePassed) {
    return hasNotHitRenewalStartDate ? now().toDate() : now().add(-1, 'days').toDate();
  }

  if (leaseLength) {
    return now()
      .add(30 * leaseLength, 'days')
      .toDate();
  }

  return now().add(180, 'days').toDate();
};

const getLeaseStartDate = ({ leaseLength, isLeasePassed, workflowName = DALTypes.WorkflowName.NEW_LEASE, hasNotHitRenewalStartDate }) => {
  if (workflowName === DALTypes.WorkflowName.RENEWAL) {
    return hasNotHitRenewalStartDate ? now().add(1, 'days').toDate() : now().toDate();
  }

  if (isLeasePassed && leaseLength) {
    return now()
      .add(-30 * leaseLength, 'days')
      .toDate();
  }

  return now().toDate();
};

const saveMTMActiveLeaseData = async (ctx, { published, activeLeasePartyId, lease, dbParty, termLength, shouldExecuteLease = false }) => {
  const activeLeaseWfData = await saveActiveLeaseWfData(ctx, {
    leaseId: lease.id,
    activeLeasePartyId,
    baselineData: published.baselineData,
    termLength,
    rolloverPeriod: DALTypes.RolloverPeriod.M2M,
  });

  if (shouldExecuteLease) {
    await archiveParty(ctx, { partyId: dbParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.CREATED_ONE_MONTH_LEASE });
  }
  return activeLeaseWfData;
};

const saveIsExtensionActiveLeaseData = async (ctx, { published, activeLeasePartyId, lease, dbParty, termLength, shouldExecuteLease = false }) => {
  const activeLeaseWfData = await saveActiveLeaseWfData(ctx, {
    leaseId: lease.id,
    activeLeasePartyId,
    baselineData: published.baselineData,
    termLength,
    isExtension: true,
  });

  const computedExtensionEndDate = now().add(1, 'month').toDate();

  await updateActiveLeaseData(ctx, activeLeasePartyId, { ...activeLeaseWfData.leaseData, computedExtensionEndDate });

  if (shouldExecuteLease) {
    await archiveParty(ctx, { partyId: dbParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });
  }

  return activeLeaseWfData;
};

const isBackendModeNone = tenant => {
  const backendMode = tenant?.metadata?.backendIntegration?.name;
  return ![DALTypes.BackendMode.MRI, DALTypes.BackendMode.MRI_NO_EXPORT, DALTypes.BackendMode.YARDI].includes(backendMode);
};

const saveIsMovingOutActiveLeaseData = async (ctx, { published, activeLeasePartyId, lease, termLength, isMovingOutDatePassed }) => {
  const movingOutData = {
    vacateDate: isMovingOutDatePassed ? now().add(-1, 'days').toDate() : now().add(1, 'days').toDate(),
    dateOfNotice: now().add(-10, 'days').toDate(),
    notes: collegeYearVacateReason,
    moveOutConfirmed: isMovingOutDatePassed,
  };

  const activeLeaseWfData = await saveActiveLeaseWfData(ctx, {
    leaseId: lease.id,
    activeLeasePartyId,
    baselineData: published.baselineData,
    metadata: movingOutData,
    state: DALTypes.ActiveLeaseState.MOVING_OUT,
    termLength,
  });

  return activeLeaseWfData;
};

const handleCreateActiveLeaseParty = async (
  ctx,
  { activeLeaseCreation, leaseLength, published, dbParty, lease, propertyId, shouldExecuteLease, additionalChargeName },
) => {
  const { id: activeLeasePartyId } = await createActiveLeaseParty(ctx, { seedPartyId: dbParty.id });
  const fees = await getFeesByPropertyId(ctx, propertyId);
  if (additionalChargeName) {
    const additionalCharge = fees.find(fee => fee.name === additionalChargeName);
    published.baselineData.publishedLease.additionalCharges = {
      [fees[0].id]: { ...fees[0], quantity: 1, amount: 100 },
      [additionalCharge.id]: { ...additionalCharge, quantity: 1, amount: 100 },
    };
  } else {
    published.baselineData.publishedLease.additionalCharges = {
      [fees[0].id]: { ...fees[0], quantity: 1, amount: 100 },
    };
  }

  const { isMTM = false, isExtension = false, isMovingOut = false, isMovingOutDatePassed = false } = activeLeaseCreation || {};

  if (isMTM) {
    await saveMTMActiveLeaseData(ctx, { published, activeLeasePartyId, lease, dbParty, termLength: leaseLength, shouldExecuteLease });
  } else if (isExtension) {
    await saveIsExtensionActiveLeaseData(ctx, { published, activeLeasePartyId, lease, dbParty, termLength: leaseLength, shouldExecuteLease });
  } else if (isMovingOut) {
    await saveIsMovingOutActiveLeaseData(ctx, { published, activeLeasePartyId, lease, termLength: leaseLength, isMovingOutDatePassed });
  } else {
    await saveActiveLeaseWfData(ctx, {
      leaseId: lease.id,
      activeLeasePartyId,
      baselineData: published.baselineData,
      termLength: leaseLength,
    });
  }
  return activeLeasePartyId;
};

const handleCreateRenewalLeaseParty = async (ctx, { partyJson, activeLeasePartyId }) => {
  const renewalParty = await createRenewalLeaseParty(ctx, activeLeasePartyId);
  const {
    shouldPublishRenewalLetter = false,
    shouldPublishRenewalLease = false,
    shouldExecuteRenewalLease = false,
    renewalLeaseLength,
    hasNotHitRenewalStartDate,
  } = partyJson?.renewalLeaseCreation || {};

  if (shouldPublishRenewalLetter) {
    const publishedQuote = await createAndPublishQuote(ctx, {
      partyId: renewalParty.id,
      propertyName: partyJson.propertyName,
      unitName: partyJson.unitName,
      rentAmount: partyJson.screeningRentAmount,
      leaseState: DALTypes.LeaseState.RENEWAL,
      leaseLength: renewalLeaseLength,
    });

    if (shouldPublishRenewalLease) {
      const lease = await createLeaseForParty(ctx, renewalParty.id, publishedQuote);
      const leaseStartDate = getLeaseStartDate({ workflowName: renewalParty.workflowName, hasNotHitRenewalStartDate });
      const leaseEndDate = getLeaseEndDate({ workflowName: renewalParty.workflowName, renewalLeaseLength });
      if (lease) {
        const published = {
          id: lease.id,
          baselineData: {
            ...lease.baselineData,
            publishedLease: {
              leaseStartDate,
              moveInDate: leaseStartDate,
              leaseEndDate,
              moveinRentEndDate: leaseEndDate,
              unitRent: 500,
              rentersInsuranceFacts: 'buyInsuranceFlag',
              concessions: {},
              additionalCharges: {},
              oneTimeCharges: {},
            },
          },
        };
        await publishLeaseForParty(ctx, renewalParty.id, published);
      }

      if (shouldExecuteRenewalLease) {
        await signLeaseByAllPartyMembers(ctx, lease.id, renewalParty.id);
        await counterSignLease(ctx, lease.id, renewalParty.id);
      }
    }
  }

  if (partyJson?.activeLeaseCreation?.isMovingOut) {
    await sleep(500);
    await saveRenewalMovingOutEvent(ctx, { partyId: renewalParty.id });
  }

  await performPartyStateTransition(ctx, renewalParty.id);
};

const importParty = async (ctx, adminUserId, partyJson, teamId, tenant) => {
  const { cucumber } = cucumberConfig;
  if (partyJson.excludeFromCucumberTenant && cucumber.tenantName === tenant.name) return {};

  const { qualificationQuestions = {} } = partyJson;
  const { id: propertyId } = await getAssignedProperty(ctx, partyJson);

  const bedroomOptions = DALTypes.QualificationQuestions.BedroomOptions;
  const enhancedQQ = {
    ...qualificationQuestions,
    numBedrooms: (qualificationQuestions.numBedrooms || []).map(nb => Object.keys(bedroomOptions).find(key => bedroomOptions[key] === nb)),
  };

  const party = {
    state: DALTypes.PartyStateType.CONTACT,
    userId: adminUserId,
    teams: [teamId],
    qualificationQuestions: enhancedQQ,
    metadata: {
      creationType: DALTypes.PartyCreationTypes.SYSTEM,
    },
    assignedPropertyId: propertyId,
    ownerTeam: teamId,
    storedUnitsFilters: getUnitsFiltersFromQuestions(enhancedQQ, { timezone: LA_TIMEZONE }), // TODO: Remove the hard coded LA_TIMEZONE
  };

  const dbParty = await createParty(ctx, party);
  const { persons, partyMemberIds } = await saveMembers(ctx, partyJson.members, dbParty.id);
  await saveChildren(ctx, partyJson.children, dbParty.id);

  let publishedQuote = {};
  const hasUnitSelected = partyJson.propertyName && partyJson.unitName;

  const { shouldCreateLease = false, leaseLength, shouldExecuteLease = false, isLeasePassed = false } = partyJson?.newLeaseCreation || {};

  if (hasUnitSelected) {
    publishedQuote = await createAndPublishQuote(ctx, {
      partyId: dbParty.id,
      propertyName: partyJson.propertyName,
      unitName: partyJson.unitName,
      rentAmount: partyJson.screeningRentAmount,
      leaseLength,
    });
  }
  await createApplications(ctx, persons, partyJson.members, dbParty.id, publishedQuote.id);

  if (hasUnitSelected && shouldCreateLease) {
    // TODO: introduce possibility of quote not yet promoted
    const lease = await createLeaseForParty(ctx, dbParty.id, publishedQuote);
    const leaseStartDate = getLeaseStartDate({ leaseLength, isLeasePassed });
    const leaseEndDate = getLeaseEndDate({ leaseLength, isLeasePassed, hasNotHitRenewalStartDate: partyJson?.renewalLeaseCreation?.hasNotHitRenewalStartDate });
    if (lease) {
      const published = {
        id: lease.id,
        baselineData: {
          ...lease.baselineData,
          publishedLease: {
            leaseStartDate,
            moveInDate: leaseStartDate,
            leaseEndDate,
            moveinRentEndDate: leaseEndDate,
            unitRent: 500,
            rentersInsuranceFacts: 'buyInsuranceFlag',
            concessions: publishedQuote.concessions.reduce((acc, concession) => {
              const concessionId = concession.id;
              acc[concessionId] = { ...concession, amount: Math.sqrt(concession.relativeAdjustment * concession.relativeAdjustment) };
              return acc;
            }, {}),
            additionalCharges: {},
            oneTimeCharges: {},
          },
        },
      };

      await publishLeaseForParty(ctx, dbParty.id, published);

      if (shouldExecuteLease) {
        await signLeaseByAllPartyMembers(ctx, lease.id, dbParty.id);
        await counterSignLease(ctx, lease.id, dbParty.id);
        await updateInventory(ctx, publishedQuote.inventoryId, { state: DALTypes.InventoryState.OCCUPIED });
      }

      const activeLeaseCreation = partyJson?.activeLeaseCreation;
      const { shouldCreateActiveLeaseParty = false, shouldArchiveNewLeaseWf = false, isMTM = false, isExtension = false, additionalChargeName = null } =
        activeLeaseCreation || {};

      if (shouldCreateActiveLeaseParty) {
        const activeLeasePartyId = await handleCreateActiveLeaseParty(ctx, {
          activeLeaseCreation,
          leaseLength,
          published,
          dbParty,
          lease,
          propertyId,
          shouldExecuteLease,
          additionalChargeName,
        });

        if (shouldArchiveNewLeaseWf) {
          await sleep(500);
          await archiveParty(ctx, { partyId: dbParty.id, archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED });
        }

        const renewalLeaseCreation = partyJson?.renewalLeaseCreation;
        if (renewalLeaseCreation?.shouldCreateRenewalParty && !isMTM && !isExtension && isBackendModeNone(tenant)) {
          await handleCreateRenewalLeaseParty(ctx, { partyJson, activeLeasePartyId });
        }
      }
    } else {
      logger.debug(`Creating a lease failed for party=${dbParty.id} and property=${partyJson.propertyName}`);
    }
  }

  partyJson.appointments &&
    (await mapSeries(partyJson.appointments, async appointment => {
      const appt = {
        partyId: dbParty.id,
        partyMembers: partyMemberIds,
        startDate: setUtcDate(appointment.daysOffset, appointment.startTime),
        endDate: setUtcDate(appointment.daysOffset, appointment.endTime),
        salesPersonId: adminUserId,
        note: appointment.note,
        state: appointment.isComplete ? DALTypes.TaskStates.COMPLETED : DALTypes.TaskStates.ACTIVE,
      };
      await saveAppointment(ctx, appt);
    }));

  partyJson.messages &&
    (await mapSeries(partyJson.messages, async msg => {
      msg.alias = {
        source: msg.source,
      };

      let commEntry = {
        message: {
          source: msg.source,
          text: msg.message,
          from: msg.from,
          rawMessageData: msg,
        },
        unread: true,
        parties: [dbParty.id],
        persons: persons.map(person => person.personId),
        teams: [teamId],
        type: msg.messageType,
        messageId: newId(),
        direction: DALTypes.CommunicationDirection.IN,
      };

      commEntry =
        msg.messageType === DALTypes.CommunicationMessageType.EMAIL
          ? {
              ...commEntry,
              category: DALTypes.CommunicationCategory.USER_COMMUNICATION,
            }
          : commEntry;

      await addNewCommunication(ctx, commEntry);
    }));

  await performPartyStateTransition(ctx, dbParty.id);
  return { party: dbParty, persons, quoteId: publishedQuote.id };
};

const insertParties = async (ctx, partiesData, tenant) =>
  await mapSeries(partiesData, async userPartiesData => {
    const user = await getUserByEmail(ctx, userPartiesData.userRegistrationEmail);
    const team = await getTeamBy(ctx, {
      name: userPartiesData.teamName,
    });

    if (user && team) {
      for (const userPartyData of userPartiesData.parties) {
        await importParty(ctx, user.id, userPartyData, team.id, tenant);
      }
    } else {
      logger.debug(`User ${userPartiesData.userRegistrationEmail} does not exists. No parties will be inserted for him.`);
    }
  });

const insertTokens = async ctx => await saveToken(ctx, { token: DEMO_MARKETING_TOKEN_ID, expiry_date: now().add(10, 'year'), type: 'demo marketing token' });
const insertTestCafeWebSiteTokens = async ctx =>
  await saveToken(ctx, { token: DEFAULT_WEBSITES_TOKEN_ID, expiry_date: now().add(10, 'year'), type: 'testcafe websites token' });
const insertRasaTokens = async ctx => await saveToken(ctx, { token: DEMO_RASA_TOKEN_ID, expiry_date: now().add(10, 'year'), type: 'Rasa token' });
const insertRasaStagingTokens = async ctx =>
  await saveToken(ctx, { token: DEMO_STAGING_RASA_TOKEN_ID, expiry_date: now().add(10, 'year'), type: 'Rasa demo-staging token' });

const refreshViews = async tenantId => {
  logger.info({ tenantId }, 'refreshViews');
  await refreshUnitSearchView({ tenantId });

  logger.info({ tenantId }, 'refreshView done indexing things');
  return { processed: true };
};

const updateFadvProperties = async ctx => {
  const fadvProperties = [
    { id: 149035, name: 'acme' },
    { id: 148543, name: 'cove' },
    { id: 148546, name: 'lark' },
    { id: 148544, name: 'sierra' },
    { id: 148545, name: 'swparkme' },
    { id: 148545, name: 'skyline' },
    { id: 148545, name: 'cloud' },
    { id: 148545, name: 'horizon' },
    { id: 148545, name: 'coastal' },
    { id: 148545, name: 'seascape' },
    { id: 148545, name: 'lakefront' },
  ];

  await mapSeries(fadvProperties, async fadvProperty => {
    const { id, settings = {} } = (await getPropertyByName(ctx, fadvProperty.name)) || {};
    if (!id) return;

    await updateProperty(
      ctx,
      { id },
      {
        settings: {
          ...settings,
          screening: {
            ...(settings.screening || {}),
            propertyName: fadvProperty.id,
          },
          lease: {
            ...(settings.lease || {}),
            propertyName: fadvProperty.id,
          },
        },
      },
    );
  });
};

const updateFadvSettings = async (tenant, fadvSettings) => {
  const { settings = {} } = tenant;
  await updateTenant(tenant.id, {
    settings: {
      ...settings,
      screening: {
        ...(settings.screening || {}),
        ...fadvSettings,
      },
    },
  });

  await updateFadvProperties({ tenantId: tenant.id });
};

const setScreeningSettingsOnProdFadvConfig = async tenantId => {
  const tenant = await getTenant({ tenantId });
  const { leasingProviderMode = DALTypes.LeasingProviderMode.FAKE } = tenant.metadata || {};
  if (leasingProviderMode !== DALTypes.LeasingProviderMode.FADV_PROD) return;

  const screeningSettingsOnDemoEnv = {
    originatorId: envVal('DEMO_FADV_ORIGINATOR_ID'),
    username: envVal('DEMO_FADV_USERNAME'),
    password: envVal('DEMO_FADV_PASSWORD'),
  };

  if (!screeningSettingsOnDemoEnv.originatorId) return;

  logger.debug(`Setting screening settings on prodFadvConfig ${tenantId}`);
  await updateFadvSettings(tenant, screeningSettingsOnDemoEnv);
};

const getTenantLeasingProviderMode = async tenantId => {
  const tenant = await getTenant({ tenantId });
  const leasingProviderMode = tenant?.metadata?.leasingProviderMode || DALTypes.LeasingProviderMode.FAKE;
  return leasingProviderMode;
};

const updateTenantLeasingProviderMode = async (tenantId, leasingProviderMode) => await updateTenant(tenantId, { metadata: { leasingProviderMode } });

const updateTeamMetadata = async ctx => {
  // TODO: Christophe: once round robin works correctly this value should be changed to ROUND_ROBIN
  const teamMetadata = [{ teamName: 'cloudSkylineLeasing', metadata: { callRoutingStrategy: DALTypes.CallRoutingStrategy.EVERYBODY } }];

  await mapSeries(teamMetadata, async teamJSONData => {
    const { id } = await getTeamBy(ctx, { name: teamJSONData.teamName });
    if (!id) return;
    await updateTeam(ctx, id, { metadata: teamJSONData.metadata });
  });
};

export const createDataForDemo = async (ctx, tenantId, importInventory, testId, bigDataCount, noOfTeams) => {
  logger.debug(`[IMPORT SAMPLE] Inserting sample data for tenant ${tenantId}`);
  const context = {
    tenantId,
    host: ctx.host.replace(ctx.tenantId, ctx.tenantName),
    protocol: ctx.protocol,
    tenantName: ctx.tenantName,
  };

  const log = { ctx, tenantId, importInventory, testId, bigDataCount, noOfTeams };
  if (importInventory === true) {
    const inventoryFilePath = 'server/import/__tests__/resources/Inventory.xlsx';
    const originalLeasingProviderMode = await getTenantLeasingProviderMode(tenantId);

    logger.debug(`[IMPORT SAMPLE] Importing units for tenant ${tenantId}`);
    const importInventoryRes = await importInventoryFromXlsFile({
      tenantId,
      inputWorkbookPath: inventoryFilePath,
    });
    logger.debug({ importInventoryRes }, '[IMPORT SAMPLE] Importing units finished');

    logger.trace(log, '[IMPORT SAMPLE] set screening settings');
    await setScreeningSettingsOnProdFadvConfig(tenantId);

    // TODO: There is an issue with corticon introduce_yourself task that is not consistently showing
    logger.trace(log, '[IMPORT SAMPLE] disable corticon tasks and use old tasks instead');
    await updateDecisionServiceBackend({ tenantId }, 'reva');

    logger.trace(log, '[IMPORT SAMPLE] trigger assets import');
    await triggerAssetsImport(tenantId);
    await sleep(200);

    logger.trace(log, '[IMPORT SAMPLE] set leasing provider mode to FAKE');
    await updateTenantLeasingProviderMode(tenantId, DALTypes.LeasingProviderMode.FAKE);
    await sleep(200);

    logger.trace(log, '[IMPORT SAMPLE] Update team call routing strategy');
    await updateTeamMetadata({ tenantId });

    logger.trace(log, '[IMPORT SAMPLE] import lease template');
    await importLeaseTemplates({ tenantId });
    await sleep(200);

    logger.trace(log, '[IMPORT SAMPLE] refresh views');
    await refreshViews(tenantId);

    logger.trace(log, '[IMPORT SAMPLE] insert tokens ');
    await insertTokens(context);
    await insertTestCafeWebSiteTokens(context);
    await insertRasaTokens(context);
    await insertRasaStagingTokens(context);

    if (noOfTeams > 10) {
      await insertHugeData(context, noOfTeams);
    }

    logger.trace({ tenantId, bigDataCount }, '[IMPORT SAMPLE] Creating sample data: parties and raw leads');
    // sample data 0, 0
    // big sample data 0, 100
    // huge data 88, 1000

    let cfg = {};
    const isDemoTenant = ctx.tenantName?.startsWith('demo');

    // sampleData can take some data as configuration: teams, users, etc.
    // Demo tenants should use the skyline property instead of parkmerced
    if (isDemoTenant) {
      cfg = {
        team1: {
          name: 'skylineLeasing',
          agent1: 'ed@reva.tech',
          agent2: 'brittany@reva.tech',
          agent3: 'tina@reva.tech',
          property: 'skyline',
        },
        hubTeam: {
          name: 'tyrellHub',
          agent1: 'anish@reva.tech',
          agent2: 'mia@reva.tech',
          agent3: 'keaton@reva.tech',
          property1: 'skyline',
          property2: 'cloud',
          property3: 'horizon',
        },
        multiPropertyTeam: {
          name: 'cloudSkylineLeasing',
          agent1: 'melanie@reva.tech',
          agent2: 'tom@reva.tech',
          property1: 'skyline',
          property2: 'cloud',
        },
        properties: {
          skyline: {
            units: [
              '1003',
              '1005',
              '4000',
              '2002',
              '507',
              '501',
              '1000',
              '4003',
              '1002',
              '509',
              '2000',
              '4006',
              '508',
              '502',
              '503',
              '504',
              '505',
              '506',
              '2004',
              '2007',
              '2008',
              '4002',
            ],
            availabilityOffsets: { 2: ['1004'], 4: ['3001'], 6: ['1000', '3006', '4001', '4004'] },
          },
          cloud: {
            availabilityOffsets: { 1: ['4004'], 8: ['2000'], 10: ['1006', '2004', '3003'] },
          },
          horizon: {
            availabilityOffsets: { 2: ['4000'], 8: ['1001', '2001'], 10: ['1006'] },
          },
        },
      };
      await updateInventoriesWithAvailabilityOffset(context, cfg.properties);
    } else {
      cfg = {
        team1: {
          name: 'Swparkme L',
          agent1: 'bill@reva.tech',
          agent2: 'danny@reva.tech',
          agent3: 'sally@reva.tech',
          property: 'swparkme',
        },
        hubTeam: {
          name: 'BayAreaCenter L',
          agent1: 'sara@reva.tech',
          agent2: 'alice@reva.tech',
          agent3: 'tanya@reva.tech',
          property1: 'swparkme',
          property2: 'lark',
          property3: 'cove',
        },
        properties: {
          swparkme: {
            units: [
              '1013',
              '1019',
              '1014',
              '1017',
              '507',
              '501',
              '1010',
              '1001',
              '1016',
              '509',
              '1002',
              '1012',
              '508',
              '502',
              '503',
              '504',
              '505',
              '506',
              '510',
            ],
          },
        },
      };
    }

    // TODO: do it for university as well so that university tenant is faster to create so that we don't create all teh parkmerced data that is not used in university
    cfg = { ...cfg, universityTeam: { name: 'Acme L', agent1: 'tu1@reva.tech', property: 'acme' } };
    cfg.properties.acme = { units: ['102', '104', '107', '109', '114', '156', '157', '162'] };

    // Calendars
    cfg = {
      ...cfg,
      userCalendarAccounts: [
        { userEmail: 'bill@reva.tech', calendarAccount: 'bill@revad.onmicrosoft.com' },
        { userEmail: 'danny@reva.tech', calendarAccount: 'danny@revad.onmicrosoft.com' },
        { userEmail: 'brittany@reva.tech', calendarAccount: 'brittany@revad.onmicrosoft.com' },
        { userEmail: 'ed@reva.tech', calendarAccount: 'tom@revad.onmicrosoft.com' },
        { userEmail: 'tom@reva.tech', calendarAccount: 'tom@revad.onmicrosoft.com' },
      ],
      teamCalendarAccounts: [
        { teamName: 'Swparkme L', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'Lark L', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'skylineLeasing', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'cloudLeasing', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'horizonLeasing', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'tyrellHub', calendarAccount: 'teams@revad.onmicrosoft.com' },
        { teamName: 'cloudSkylineLeasing', calendarAccount: 'teams@revad.onmicrosoft.com' },
      ],
    };

    const { rawLeadsData, partiesData, officeHours, userCalendarAccounts, teamCalendarAccounts } = bigDataCount
      ? bigSampleData(cfg, testId, bigDataCount)
      : sampleData(cfg, testId);

    // this is the normal refresh with sample data. need to do calendar integration for the demo enviroment, demo tenant
    logger.trace(log, '[IMPORT SAMPLE] calendar integration');
    await doCalendarIntegration(ctx, { tenantId, officeHours, userCalendarAccounts, teamCalendarAccounts });

    logger.trace(log, '[IMPORT SAMPLE] insert raw leads');
    await insertRawLeads(context, rawLeadsData);

    const tenantCtx = { tenantId };
    const tenant = await getTenant(tenantCtx, tenantId);

    logger.trace(log, '[IMPORT SAMPLE] insert parties');
    await insertParties(context, partiesData, tenant);
    logger.trace(log, '[IMPORT SAMPLE] insert parties DONE');

    if (!bigDataCount && tenant.isTrainingTenant) {
      await removeAllDataFromRecurringJobs(tenantCtx);
      await workflowCycleProcessor(tenantCtx);
    }

    logger.trace(log, '[IMPORT SAMPLE] set leasing provider mode to original value');
    await updateTenantLeasingProviderMode(tenantId, originalLeasingProviderMode);
    await sleep(200);

    logger.trace(log, '[IMPORT SAMPLE] import lease template');
    await importLeaseTemplates({ tenantId });
    await sleep(200);

    logger.debug(log, `[IMPORT SAMPLE] Import units for tenant ${tenantId} .. done`);
  }

  logger.debug(log, `[IMPORT SAMPLE] Inserting sample data for tenant ${tenantId} .. done`);
};

export const importRandomParty = async (ctx, userId, teamId) => {
  logger.debug(JSON.stringify({ ctx, userId, teamId }), 'importDummyParty');
  const partyData = await generateRandomParty();
  const {
    party,
    persons: [person],
    quoteId,
  } = await importParty(ctx, userId, partyData, teamId);
  const { personId, preferredName: personName } = person;
  const { id: partyId } = party;

  const applyNowUrl = await getApplyNowUrlForPerson(ctx, {
    quoteId,
    personId,
    personName,
    partyId,
  });
  return { applyNowUrl, party, person };
};

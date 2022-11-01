/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';

import difference from 'lodash/difference';
import { runInTransaction } from '../../database/factory';
import loggerModule from '../../../common/helpers/logger';
import {
  startActiveLeaseWorkflow,
  createRenewalLeaseParty,
  getEligibleNewLeasePartyIdsToArchive,
  getEligibleRenewalPartyIdsToArchive,
  createOneMonthActiveLease,
  setExtensionOnActiveLease,
  archiveMovingOutActiveLease,
  createActiveLeaseFromRenewalWorkFlow,
} from '../../services/workflows';
import { archiveParty } from '../../services/party';
import {
  getEligibleLeasesForRenewal,
  getEligibleLeasesForOneMonthLeaseTerm,
  getEligibleActiveLeaseForExtension,
  getEligibleMovingOutActiveLeaseForExtension,
  getMovingOutActiveLeases,
  getActiveLeaseWfsWithoutConfirmedMoveIn,
} from '../../dal/activeLeaseWorkflowRepo';
import { getEligibleNewLeasesForActiveLeaseWorkflow, getEligibleRenewalLeasesForActiveLeaseWorkflow, voidLease } from '../../services/leases/leaseService';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getTenantData } from '../../dal/tenantsRepo';
import { getActivePartiesByPartyGroupIds } from '../../dal/partyRepo';
import { getProperties, getPropertyByExternalId } from '../../dal/propertyRepo';
import { updateExtensionLeasesEndDate } from '../../services/activeLease';
import { getRenewalLeasesToBeVoidedOnVacateDate } from '../../dal/leaseRepo';
import { addRenewalActivityLog } from '../../helpers/activityLogHelper';
import { getAllActiveMovingOutPrimaryExternalIds, getLastImportedEntriesByPropertyExternalId, getPartyWorkflows } from '../../dal/import-repo';
import { getRecurringJobByName } from '../../dal/jobsRepo';
import { now } from '../../../common/helpers/moment-utils';
import { YEAR_MONTH_DAY_FORMAT } from '../../../common/date-constants';
import { getPropertiesToImport } from '../importActiveLeases/importActiveLeasesHandler';

const logger = loggerModule.child({ subType: 'workflowCycleHandler' });

const startRenewalLeaseWorkflow = async (ctx, { leaseId, partyId: seedPartyId }) => {
  try {
    logger.trace({ ctx, leaseId, seedPartyId }, 'startRenewalLeaseWorkflow - input params');
    await runInTransaction(async innerTrx => {
      const innerCtx = { trx: innerTrx, ...ctx };

      await createRenewalLeaseParty(innerCtx, seedPartyId);
      await addRenewalActivityLog(innerCtx, {
        partyId: seedPartyId,
        renewalStatus: DALTypes.CreateManualRenewalStatus.SPAWNED,
        createdByType: DALTypes.CreatedByType.SYSTEM,
      });
    });
  } catch (error) {
    await addRenewalActivityLog(ctx, {
      partyId: seedPartyId,
      renewalStatus: DALTypes.CreateManualRenewalStatus.NOT_SPAWNED,
      createdByType: DALTypes.CreatedByType.SYSTEM,
    });
    logger.error({ ctx, error, leaseId, seedPartyId }, 'startRenewalLeaseWorkflow - error');
  }
};

const voidRenewalsOnVacateDate = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'voidRenewalsOnVacateDate - start');

  const renewalLeasesToBeVoided = await getRenewalLeasesToBeVoidedOnVacateDate(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace({ ctx, renewalLeasesToBeVoided: renewalLeasesToBeVoided.length }, 'voidRenewalsOnVacateDate - number of renewal leases that will be voided');

  await mapSeries(renewalLeasesToBeVoided, async (leaseId, index) => {
    try {
      await voidLease(ctx, leaseId, true);
      logger.trace({ ctx, leaseId, total: renewalLeasesToBeVoided.length, current: index + 1 }, 'voidRenewalsOnVacateDate - progress');
    } catch (error) {
      logger.error({ ctx, leaseId, error }, 'voidRenewalsOnVacateDate - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'voidRenewalsOnVacateDate - done');
};

const rolloverActiveLeaseToMTM = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'rolloverActiveLeaseToMTM - start');

  const activeLeaseIdsForOneMonthLease = await getEligibleLeasesForOneMonthLeaseTerm(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace(
    { ctx, numberOfActiveLeasesForOneMonthLease: activeLeaseIdsForOneMonthLease.length },
    'rolloverActiveLeaseToMTM - number of active workflows that will pass to one month lease',
  );

  await mapSeries(activeLeaseIdsForOneMonthLease, async (seedPartyId, index) => {
    try {
      await createOneMonthActiveLease(ctx, seedPartyId);
      logger.trace({ ctx, partyId: seedPartyId, total: activeLeaseIdsForOneMonthLease.length, current: index + 1 }, 'rolloverActiveLeaseToMTM - progress');
    } catch (error) {
      logger.error({ ctx, seedPartyId, error }, 'rolloverActiveLeaseToMTM - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'rolloverActiveLeaseToMTM - done');
};

const rolloverActiveLeaseToExtension = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'rolloverActiveLeaseToExtension - start');

  const activeLeaseIdsForExtension = await getEligibleActiveLeaseForExtension(ctx, { propertyIdsFilter, partyGroupIdFilter });
  const futureMovingOutActiveLeases = await getEligibleMovingOutActiveLeaseForExtension(ctx, { propertyIdsFilter, partyGroupIdFilter });

  logger.trace(
    {
      ctx,
      numberOfActiveLeasesForExtension: activeLeaseIdsForExtension.length,
      numberOfFutureMovigOutLeasesForExtension: futureMovingOutActiveLeases.length,
    },
    'rolloverActiveLeaseToExtension - number of active leases that will be extended',
  );

  const activeLeasesToProcess = [...activeLeaseIdsForExtension, ...futureMovingOutActiveLeases];

  await mapSeries(activeLeasesToProcess, async (activeLeaseWfDataId, index) => {
    try {
      await setExtensionOnActiveLease(ctx, activeLeaseWfDataId);
      logger.trace({ ctx, partyId: activeLeaseWfDataId, total: activeLeasesToProcess.length, current: index + 1 }, 'rolloverActiveLeaseToExtension - progress');
    } catch (error) {
      logger.error({ ctx, activeLeaseWfDataId, error }, 'rolloverActiveLeaseToExtension failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'rolloverActiveLeaseToExtension - done');
};

const archiveMovingOutActiveLeases = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveMovingOutActiveLeases - start');

  const movingOutActiveLeases = await getMovingOutActiveLeases(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace({ ctx, numberOfMovingOutActiveLeasesArchive: movingOutActiveLeases.length }, 'archiveMovingOutActiveLeases - number of moving out leases');

  await mapSeries(movingOutActiveLeases, async ({ partyId: activeLeasePartyId }, index) => {
    try {
      await archiveMovingOutActiveLease(ctx, activeLeasePartyId);
      logger.trace({ ctx, partyId: activeLeasePartyId, total: movingOutActiveLeases.length, current: index + 1 }, 'archiveMovingOutActiveLeases - progress');
    } catch (error) {
      logger.error({ ctx, activeLeasePartyId, error }, 'archiveMovingOutActiveLeases - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveMovingOutActiveLeases - done');
};

const archiveMoveInNotConfirmedWorkflows = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveMoveInNotConfirmedLeases - start');

  const workflowsWithoutConfirmedMoveIn = await getActiveLeaseWfsWithoutConfirmedMoveIn(ctx, propertyIdsFilter, partyGroupIdFilter);
  const parties = await getActivePartiesByPartyGroupIds(
    ctx,
    workflowsWithoutConfirmedMoveIn.map(wf => wf.partyGroupId),
  );

  await mapSeries(parties, async party => {
    await archiveParty(ctx, {
      partyId: party.id,
      workflowName: party.workflowName,
      archiveReasonId: DALTypes.ArchivePartyReasons.MOVEIN_NOT_CONFIRMED,
    });
  });

  logger.trace({ ctx, partyGroupIdFilter }, 'archiveMoveInNotConfirmedLeases - donex§');
};

const createActiveLeasesFromNewLeases = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createActiveLeasesFromNewLeases - start');

  const newLeasesForActiveLeaseWf = await getEligibleNewLeasesForActiveLeaseWorkflow(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace(
    { ctx, numberOfActiveWf: newLeasesForActiveLeaseWf.length },
    'createActiveLeasesFromNewLeases - number of active workflows to process from new leases',
  );

  if (!newLeasesForActiveLeaseWf.length) return;

  const properties = await getProperties(ctx);

  await mapSeries(newLeasesForActiveLeaseWf, async (item, index) => {
    try {
      const importResidentsEnabled = properties.find(p => p.id === item.assignedPropertyId).settings?.integration?.import?.residentData;
      await startActiveLeaseWorkflow(ctx, { ...item, sendResidentInvite: true }, importResidentsEnabled);
      logger.trace({ ctx, partyId: item.partyId, total: newLeasesForActiveLeaseWf.length, current: index + 1 }, 'createActiveLeasesFromNewLeases - progress');
    } catch (error) {
      logger.error({ ctx, item, error }, 'createActiveLeasesFromNewLeases failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createActiveLeasesFromNewLeases - done');
};

const isRenewalEnabled = tenantSettings => tenantSettings?.features?.enableRenewals;

const createActiveLeasesFromRenewals = async (ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings }) => {
  if (!isRenewalEnabled(tenantSettings)) return;

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createActiveLeasesFromRenewals - start');

  const renewalLeasesForActiveLeaseWf = await getEligibleRenewalLeasesForActiveLeaseWorkflow(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace(
    { ctx, numberOfActiveWf: renewalLeasesForActiveLeaseWf.length },
    'createActiveLeasesFromRenewals - number of active workflows to process from renewal leases',
  );

  await mapSeries(renewalLeasesForActiveLeaseWf, async (item, index) => {
    try {
      await createActiveLeaseFromRenewalWorkFlow(ctx, item);
      logger.trace(
        { ctx, partyId: item.partyId, total: renewalLeasesForActiveLeaseWf.length, current: index + 1 },
        'createActiveLeasesFromRenewals - progress',
      );
    } catch (error) {
      logger.error({ ctx, item, error }, 'createActiveLeasesFromRenewals - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createActiveLeasesFromRenewals - done');
};

const createRenewalsFromActiveLeases = async (ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings }) => {
  if (!isRenewalEnabled(tenantSettings)) return;

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createRenewalsFromActiveLeases - start');

  const leasesForRenewalWf = await getEligibleLeasesForRenewal(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace({ ctx, numberOfRenewalWf: leasesForRenewalWf.length }, 'createRenewalsFromActiveLeases - number of renewal workflows to process');

  await mapSeries(leasesForRenewalWf, async (item, index) => {
    try {
      await startRenewalLeaseWorkflow(ctx, item);
      logger.trace({ ctx, partyId: item.partyId, total: leasesForRenewalWf.length, current: index + 1 }, 'createRenewalsFromActiveLeases - progress');
    } catch (error) {
      logger.error({ ctx, item, error }, 'createRenewalsFromActiveLeases - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'createRenewalsFromActiveLeases - done');
};

const archiveNewLeases = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveNewLeases - start');

  const newLeasePartyIdsToArchive = await getEligibleNewLeasePartyIdsToArchive(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace(
    { ctx, numberOfNewLeasePartiesToArchive: newLeasePartyIdsToArchive.length },
    'archiveNewLeases - number of new lease party workflows to archive that concluded to an executed lease',
  );

  await mapSeries(newLeasePartyIdsToArchive, async (partyId, index) => {
    try {
      await archiveParty(ctx, {
        partyId,
        workflowName: DALTypes.WorkflowName.NEW_LEASE,
        archiveReasonId: DALTypes.ArchivePartyReasons.RESIDENT_CREATED,
      });
      logger.trace({ ctx, partyId, total: newLeasePartyIdsToArchive.length, current: index + 1 }, 'archiveNewLeases - progress');
    } catch (error) {
      logger.error({ ctx, partyId, error }, 'archiveNewLeases - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveNewLeases - done');
};

const archiveRenewals = async (ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings }) => {
  if (!isRenewalEnabled(tenantSettings)) return;

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveRenewals - start');

  const renewalPartyIdsToArchive = await getEligibleRenewalPartyIdsToArchive(ctx, { propertyIdsFilter, partyGroupIdFilter });
  logger.trace(
    { ctx, numberOfRenewalPartiesToArchive: renewalPartyIdsToArchive.length },
    'archiveRenewals - number of renewal party workflows to archive that concluded to an executed lease',
  );

  await mapSeries(renewalPartyIdsToArchive, async (partyId, index) => {
    try {
      await archiveParty(ctx, {
        partyId,
        workflowName: DALTypes.WorkflowName.RENEWAL,
        archiveReasonId: DALTypes.ArchivePartyReasons.RENEWAL_LEASE_STARTED,
      });
      logger.trace({ ctx, partyId, total: renewalPartyIdsToArchive.length, current: index + 1 }, 'archiveRenewals - progress');
    } catch (error) {
      logger.error({ ctx, partyId, error }, 'archiveRenewals - failed');
    }
  });

  logger.trace({ ctx, propertyIdsFilter, partyGroupIdFilter }, 'archiveRenewals - done');
};

const archiveActiveWorkflowsForOutdatedPrimaryExternalIds = async (ctx, { propertyIdsFilter, partyGroupIdFilter }) => {
  logger.trace({ ctx }, 'archiveActiveWorkflowsForOutdatedPrimaryExternalIds - Archive active parties for primaryExternalIds that were not received on sync');

  if (propertyIdsFilter || partyGroupIdFilter) {
    logger.trace(
      { ctx, propertyIdsFilter, partyGroupIdFilter },
      'archiveActiveWorkflowsForOutdatedPrimaryExternalIds - Workflow processing was manually triggered for a property/party group - will not run',
    );
    return;
  }

  const today = now().format(YEAR_MONTH_DAY_FORMAT);
  const propertiesToCheck = await getPropertiesToImport(ctx);
  const {
    metadata: { progress = {} },
  } = await getRecurringJobByName(ctx, DALTypes.Jobs.ImportAndProcessPartyWorkflows);
  const propertiesWithSuccessfulImportToday = propertiesToCheck.filter(p => progress[p.externalId]?.lastSuccessfulSyncDate === today);

  if (!propertiesWithSuccessfulImportToday.length) {
    logger.trace({ ctx }, 'archiveActiveWorkflowsForOutdatedPrimaryExternalIds - No properties with successful import today - will not run');
    return;
  }

  await mapSeries(propertiesWithSuccessfulImportToday, async property => {
    const activePrimaryExternalIds = await getAllActiveMovingOutPrimaryExternalIds(ctx, property.externalId);
    const receivedExternalIds = (
      await getLastImportedEntriesByPropertyExternalId(ctx, {
        propertyExternalId: property.externalId,
        lastSuccessfulSyncDateForProperty: today,
        processedEntriesOnly: false,
      })
    ).map(entry => entry.primaryExternalId);

    if (!receivedExternalIds.length) {
      logger.trace(
        { ctx, propertyExternalId: property.externalId },
        'archiveActiveWorkflowsForOutdatedPrimaryExternalIds - No entries retrieved for property - will not run',
      );
      return;
    }

    const outdatedPrimaryExternalIds = difference(activePrimaryExternalIds, receivedExternalIds);

    const partiesToArchive = await getPartyWorkflows(ctx, { externalIds: outdatedPrimaryExternalIds, excludeInactive: true });
    logger.trace(
      { ctx, propertyExternalId: property.externalId, numberOfActivePartiesToArchive: partiesToArchive.length },
      'archiveActiveWorkflowsForOutdatedPrimaryExternalIds - number of active parties to archive for not receiving the primaryExternalId on sync',
    );

    await mapSeries(partiesToArchive, async party => {
      await archiveParty(ctx, {
        partyId: party.id,
        workflowName: party.workflowName,
        archiveReasonId: DALTypes.ArchivePartyReasons.PRIMARY_EXTERNAL_ID_NOT_RECEIVED_ON_SYNC,
      });
    });
  });
};

export const workflowCycleProcessor = async payload => {
  const { tenantId, partyGroupIdFilter, propertyId: externalPropertyId } = payload;
  const ctx = { tenantId };
  logger.trace(
    {
      ctx,
      workflowCycleProcessorPayload: { externalPropertyId, partyGroupIdFilter },
    },
    'workflowCycleProcessor - input params',
  );

  try {
    const property = externalPropertyId && (await getPropertyByExternalId(ctx, externalPropertyId));
    const propertyIdsFilter = property && [property.id];
    const { settings: tenantSettings } = await getTenantData(ctx);

    await voidRenewalsOnVacateDate(ctx, { propertyIdsFilter, partyGroupIdFilter });

    await rolloverActiveLeaseToMTM(ctx, { propertyIdsFilter, partyGroupIdFilter });
    await rolloverActiveLeaseToExtension(ctx, { propertyIdsFilter, partyGroupIdFilter });

    await archiveMovingOutActiveLeases(ctx, { propertyIdsFilter, partyGroupIdFilter });
    await updateExtensionLeasesEndDate(ctx, { propertyIdsFilter, partyGroupIdFilter });

    await createActiveLeasesFromNewLeases(ctx, { propertyIdsFilter, partyGroupIdFilter });
    await createActiveLeasesFromRenewals(ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings });
    await createRenewalsFromActiveLeases(ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings });

    await archiveNewLeases(ctx, { propertyIdsFilter, partyGroupIdFilter });
    await archiveRenewals(ctx, { propertyIdsFilter, partyGroupIdFilter, tenantSettings });

    await archiveActiveWorkflowsForOutdatedPrimaryExternalIds(ctx, { propertyIdsFilter, partyGroupIdFilter });

    await archiveMoveInNotConfirmedWorkflows(ctx, { propertyIdsFilter, partyGroupIdFilter });

    logger.trace({ ctx, payload }, 'workflowCycleProcessor - done');
  } catch (error) {
    logger.error({ ctx, error }, 'workflowCycleProcessor - error');
    return { processed: false };
  }

  return { processed: true };
};

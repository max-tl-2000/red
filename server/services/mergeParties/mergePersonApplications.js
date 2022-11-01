/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';

import { DALTypes } from '../../../common/enums/DALTypes';
import * as mergeRepo from '../../dal/mergePartyRepo';
import { sendApplicantInformationToScreen } from '../../../rentapp/server/services/person-application';
import loggerModule from '../../../common/helpers/logger';
import { now } from '../../../common/helpers/moment-utils';
import { savePersonApplicationMergedEvent } from '../partyEvent';

const logger = loggerModule.child({ subType: 'mergePartiesService' });

const movePersonApplicationsThatAreJustInMergedParty = async (ctx, basePartyId, mergedPartyId) => {
  const mergedPartyPersonsApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, mergedPartyId, { excludeRemovedMembers: true });
  if (!mergedPartyPersonsApplications.length) return [];

  const basePartyPersonsApplications = (await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId)) || [];
  const { id: basePartyApplicationId } = await mergeRepo.getPartyApplicationByPartyId(ctx, basePartyId);
  const personApplicationsIdsJustInMergedParty = mergedPartyPersonsApplications
    .filter(pa => !basePartyPersonsApplications.some(a => pa.personId === a.personId))
    .map(fa => fa.id);
  const delta = { partyId: basePartyId, partyApplicationId: basePartyApplicationId };
  const result = await mergeRepo.updatePersonApplicationsBulk(ctx, personApplicationsIdsJustInMergedParty, delta);
  return result || [];
};

const movePersonApplicationsAndInvoicesThatAreJustInMergedParty = async (ctx, basePartyId, mergedPartyId) => {
  const movedPersonApplications = await movePersonApplicationsThatAreJustInMergedParty(ctx, basePartyId, mergedPartyId);
  if (!movedPersonApplications.length) return { invoices: [], personApplications: [] };

  const { partyApplicationId } = movedPersonApplications[0];
  const movedPersonApplicationsIds = movedPersonApplications.map(a => a.id);
  const personApplicationInvoicesIdsToUpdate = (await mergeRepo.getApplicationInvoicesByPersonApplicationIds(ctx, movedPersonApplicationsIds)).map(i => i.id);
  const invoices = (await mergeRepo.updateApplicationInvoicesBulk(ctx, personApplicationInvoicesIdsToUpdate, { partyApplicationId })) || [];
  return { invoices, personApplications: movedPersonApplications };
};

const movePersonApplicationInvoicesToBaseParty = async (ctx, basePartyId, mergedPartyId) => {
  const mergedPartyPersonsApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, mergedPartyId, {
    includeMerged: true,
    excludeRemovedMembers: true,
  });

  if (!mergedPartyPersonsApplications.length) return [];

  const basePartyPersonsApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId);
  const { partyApplicationId: basePartyApplicationId } = basePartyPersonsApplications[0];
  const { partyApplicationId: mergedPartyApplicationId } = mergedPartyPersonsApplications[0];

  const mergedPartyPersonsApplicationInvoices = await mergeRepo.getApplicationInvoicesByPartyApplicationId(ctx, mergedPartyApplicationId);
  if (!mergedPartyPersonsApplicationInvoices.length) return [];

  const result = await mapSeries(mergedPartyPersonsApplicationInvoices, async inv => {
    const mergedPartyApplication = mergedPartyPersonsApplications.find(mpa => mpa.id === inv.personApplicationId);
    if (!mergedPartyApplication) return {};

    const { id: targetPersonApplicationID } = basePartyPersonsApplications.find(a => mergedPartyApplication.personId === a.personId);
    const invoiceDelta = {
      id: inv.id,
      personApplicationId: targetPersonApplicationID,
      partyApplicationId: basePartyApplicationId,
    };
    return await mergeRepo.updateApplicationInvoice(ctx, invoiceDelta);
  });
  return result.filter(r => r.id);
};

const isPersonAppComplete = applicationStatus => applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED;

const isPersonAppInSecondPhase = personApp => personApp.applicationStatus === DALTypes.PersonApplicationStatus.PAID || personApp.paymentCompleted === true;

const isMergedPersonAppMoreAdvanced = (basePersonApp, mergedPersonApp) =>
  !isPersonAppComplete(basePersonApp.applicationStatus) && !isPersonAppInSecondPhase(basePersonApp) && isPersonAppInSecondPhase(mergedPersonApp);

const shouldUpdatePersonApp = (basePersonApp, mergedPersonApp) => {
  const isBasePersonAppComplete = isPersonAppComplete(basePersonApp.applicationStatus);
  const isMergedPersonAppComplete = isPersonAppComplete(mergedPersonApp.applicationStatus);
  const mergedPersonAppIsMoreAdvanced = isMergedPersonAppMoreAdvanced(basePersonApp, mergedPersonApp);
  return !isBasePersonAppComplete && (isMergedPersonAppComplete || mergedPersonAppIsMoreAdvanced);
};

const getPersonAppDelta = (basePersonApp, mergedPersonApp) =>
  shouldUpdatePersonApp(basePersonApp, mergedPersonApp)
    ? {
        id: basePersonApp.id,
        paymentCompleted: mergedPersonApp.paymentCompleted,
        applicationStatus: mergedPersonApp.applicationStatus,
        applicationData: mergedPersonApp.applicationData,
        additionalData: mergedPersonApp.additionalData,
      }
    : {};

const updateBasePersonApplicationsFromMergedPartyApplications = async (ctx, basePartyId, mergedPartyId) => {
  const basePartyPersonsApps = await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId);
  const mergedPartyPersonsApps = await mergeRepo.getPersonApplicationsByPartyId(ctx, mergedPartyId, { excludeRemovedMembers: true });

  const basePartyAppsUpdates = mergedPartyPersonsApps
    .map(mergedPersonApp => {
      const basePersonApp = basePartyPersonsApps.find(bpa => bpa.personId === mergedPersonApp.personId);

      if (!basePersonApp) return false;

      const applicationUpdates = getPersonAppDelta(basePersonApp, mergedPersonApp);

      return isEmpty(applicationUpdates) ? false : applicationUpdates;
    })
    .filter(a => a);

  return await mapSeries(basePartyAppsUpdates, async au => await mergeRepo.updatePersonApplication(ctx, au));
};

const isAnyApplicationChangedToPaid = (initialBasePersonsAppl, resultPersonsAppl) =>
  resultPersonsAppl.some(ra => {
    const personApplBeforeMerge = initialBasePersonsAppl.find(ia => ia.personId === ra.personId);
    const isApplPaidBeforeMerge = personApplBeforeMerge && personApplBeforeMerge.paymentCompleted;
    return !isApplPaidBeforeMerge && ra.paymentCompleted;
  });

const isAnyApplicationChangedToComplete = (initialBasePersonsAppl, resultPersonsAppl) =>
  resultPersonsAppl.some(ra => {
    const personApplBeforeMerge = initialBasePersonsAppl.find(ia => ia.personId === ra.personId);
    const isApplCompleteBeforeMerge = personApplBeforeMerge && personApplBeforeMerge.applicationStatus === DALTypes.PersonApplicationStatus.COMPLETED;
    return !isApplCompleteBeforeMerge && ra.paymentCompleted;
  });

const markUnusedApplicationsAsEnded = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId }, 'Looking to determine if any apps need to be ended due to parties merge');

  const orderedApplicationStates = [
    DALTypes.PersonApplicationStatus.NOT_SENT,
    DALTypes.PersonApplicationStatus.SENT,
    DALTypes.PersonApplicationStatus.OPENED,
    DALTypes.PersonApplicationStatus.PAID,
    DALTypes.PersonApplicationStatus.COMPLETED,
  ];

  const applications = [
    ...(await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId)),
    ...(await mergeRepo.getPersonApplicationsByPartyId(ctx, mergedPartyId, { excludeRemovedMembers: true })),
  ];
  const personIds = uniq(applications.map(app => app.personId));

  await mapSeries(personIds, async personId => {
    const personApps = applications.filter(app => app.personId === personId);

    if (personApps.length > 1) {
      const mostAdvancedApp = personApps.sort(
        (a, b) => orderedApplicationStates.indexOf(b.applicationStatus) - orderedApplicationStates.indexOf(a.applicationStatus),
      )[0];

      const appsToMarkAsEnded = personApps.filter(item => item.id !== mostAdvancedApp.id);

      logger.trace({ ctx, personId, mostAdvancedApp }, 'Determined application that survives after parties merge');
      logger.trace({ ctx, personId, appsToMarkAsEnded }, 'Determined applications to mark as ended due to parties merge');

      await mergeRepo.updatePersonApplicationsBulk(
        ctx,
        appsToMarkAsEnded.map(item => item.id),
        {
          endedAsMergedAt: now().toDate(),
        },
      );
    }
  });
};

export const mergePersonApplications = async (ctx, basePartyId, mergedPartyId) => {
  logger.trace({ ctx, basePartyId, mergedPartyId }, 'mergePersonApplications - params');
  const start = new Date().getTime();

  const initialBaseApplications = await mergeRepo.getPersonApplicationsByPartyId(ctx, basePartyId);

  const {
    invoices: invoicesMovedWithApplication,
    personApplications: movedPersonApplications,
  } = await movePersonApplicationsAndInvoicesThatAreJustInMergedParty(ctx, basePartyId, mergedPartyId);
  const invoicesMovedWithoutApplication = await movePersonApplicationInvoicesToBaseParty(ctx, basePartyId, mergedPartyId);
  const updatedPersonApplications = await updateBasePersonApplicationsFromMergedPartyApplications(ctx, basePartyId, mergedPartyId);
  const mergedApplications = [...movedPersonApplications, ...updatedPersonApplications];

  const { authUser } = ctx;
  const userId = authUser && authUser.id;
  ctx.userId = userId;

  const messagesToSend = isAnyApplicationChangedToPaid(initialBaseApplications, mergedApplications)
    ? [{ messagePromise: sendApplicantInformationToScreen, args: [ctx, { partyId: basePartyId }] }]
    : [];

  await savePersonApplicationMergedEvent(ctx, {
    partyId: basePartyId,
    userId: ctx.authUser.id,
    metadata: {
      handlePromoteApplicationTask: isAnyApplicationChangedToComplete(initialBaseApplications, mergedApplications),
    },
  });

  const result = {
    invoices: [...invoicesMovedWithApplication, ...invoicesMovedWithoutApplication],
    personApplications: {
      applications: [...movedPersonApplications, ...updatedPersonApplications],
      messagesToSend,
    },
  };

  await markUnusedApplicationsAsEnded(ctx, basePartyId, mergedPartyId);

  const end = new Date().getTime();
  logger.trace({ ctx, duration: end - start }, 'mergePersonApplications - duration');
  return result;
};

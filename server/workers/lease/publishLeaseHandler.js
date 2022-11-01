/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import newId from 'uuid/v4';
import pick from 'lodash/pick';
import flattenDeep from 'lodash/flattenDeep';
import { saveLeaseSignatures, getLeaseById, updateLease } from '../../dal/leaseRepo';
import { getUsersWithRoleFromPartyOwnerTeam, getUserById } from '../../dal/usersRepo';
import { getPartyOwner, loadParty } from '../../dal/partyRepo';
import { performPartyStateTransition } from '../../services/partyStatesTransitions';
import { setPrimaryTenant } from '../../services/export';
import { getTenant } from '../../services/tenantService';
import LeaseProviderFactory from '../../services/leases/leaseProviderFactory';
import { FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';
import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { runInTransaction } from '../../database/factory';
import { sendMessageToCompleteFollowupPartyTasks } from '../../helpers/taskUtils';

const logger = loggerModule.child({ subType: 'publishLease' });
const leaseProviderFactory = new LeaseProviderFactory();

const publishLeaseForGuarantors = async ({ ctx, leaseId, documents, guarantors, guarantorFields, host, user, globalFields, residentEnvelopeId }) => {
  logger.trace({ ctx, leaseId, guarantors, host }, 'publishLeaseForGuarantors');
  return await mapSeries(guarantors, async (guarantor, index) => {
    const guarantorDocId = Object.keys(documents || {}).find(docId => documents[docId].isIncluded && documents[docId].guarantorOnly);

    const document = documents[guarantorDocId] || {};

    Object.keys(document.fields || {}).reduce((acc, fieldId) => {
      const customFields = guarantorFields[guarantor.id];
      if (customFields && customFields[fieldId]) {
        acc[fieldId].value = customFields[fieldId];
      }

      return acc;
    }, document.fields);
    let newDoc = {};
    if (guarantorDocId) {
      newDoc = {
        [guarantorDocId]: document,
      };
    }

    const leaseProvider = await leaseProviderFactory.getProvider(ctx);
    const guarantorIndex = index + 2;
    const { statuses, envelopeId } = await leaseProvider.createEnvelope(
      ctx,
      leaseId,
      [guarantor],
      host,
      newDoc,
      user.fullName,
      globalFields,
      residentEnvelopeId,
      guarantorIndex,
    );
    return statuses.map(recipientStatus => {
      const id = newId();
      const { token, counterSigner, clientUserId } = recipientStatus;
      logger.trace({ ctx, leaseId, host, envelopeId, token, counterSigner }, 'publishLeaseForGuarantors - received envelope');
      return {
        id,
        leaseId,
        partyMemberId: counterSigner ? null : guarantor.id,
        userId: counterSigner ? user.id : null,
        signUrl: token,
        envelopeId,
        metadata: recipientStatus,
        clientUserId,
      };
    });
  });
};

const publishLeaseToLeaseProvider = async (ctx, leaseData, host, user) => {
  logger.trace({ ctx, leaseId: leaseData.id, partyId: leaseData.partyId, host, userId: user?.id }, 'publishLeaseToLeaseProvider (or BM)');
  const partyMembers = leaseData.residents;
  const residents = partyMembers.filter(member => member.memberType === DALTypes.MemberType.RESIDENT);

  const lease = await getLeaseById(ctx, leaseData.id);
  const { globalFields = {}, documents, guarantorFields } = lease.leaseData;

  const residentDocIds = Object.keys(documents || {}).filter(docId => documents[docId].isIncluded && !documents[docId].guarantorOnly);
  const residentDocs = pick(documents || {}, residentDocIds);

  const leaseId = lease.id;
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  const { statuses, envelopeId } = await leaseProvider.createEnvelope(ctx, leaseId, residents, host, residentDocs, user.fullName, globalFields);

  const signatures = statuses.map((recipientStatus, index) => {
    const id = newId();
    const { clientUserId, status, token, counterSigner } = recipientStatus;
    logger.trace({ ctx, leaseId, host, fadvLeaseStatus: status, envelopeId, index, clientUserId }, 'publishLeaseToLeaseProvider / BM - received envelope');

    return {
      id,
      leaseId,
      partyMemberId: counterSigner ? null : residents[index].id,
      userId: counterSigner ? user.id : null,
      signUrl: token,
      clientUserId,
      envelopeId,
      metadata: recipientStatus,
    };
  });

  const guarantors = partyMembers.filter(member => member.memberType === DALTypes.MemberType.GUARANTOR);
  const guarantorSignatures = await publishLeaseForGuarantors({
    ctx,
    leaseId,
    documents: documents || {},
    guarantors,
    guarantorFields,
    host,
    user,
    globalFields,
    residentEnvelopeId: envelopeId,
  });
  return flattenDeep([signatures, guarantorSignatures]);
};

// TODO: why does host come in msg and not determined later on?
export const publishLease = async msg => {
  const { msgCtx, tenantId, leaseData, host } = msg;
  const partyId = leaseData.residents[0].partyId;
  const leaseId = leaseData.id;
  logger.trace({ ctx: msgCtx, leaseId, partyId, host }, 'publishLease');

  try {
    const ctx = { ...msgCtx, tenantId };
    const userIds = await getUsersWithRoleFromPartyOwnerTeam(ctx, partyId, FunctionalRoleDefinition.LCA.name);
    const userId = await getPartyOwner(ctx, partyId);
    const counterSignerId = userIds.find(u => u === userId) || userIds[0];
    logger.trace({ ctx, leaseId: leaseData.id, userId, counterSignerId }, 'publishLease');
    const counterSigner = await getUserById(ctx, counterSignerId);
    const signatures = await publishLeaseToLeaseProvider(ctx, leaseData, host, counterSigner);

    if (!signatures || !signatures.length) {
      logger.trace({ ctx, leaseId: leaseData.id }, 'publishLease - call to provider failed');
      return { processed: true };
    }

    const party = await loadParty(ctx, partyId);
    const updatedLease = await runInTransaction(async trx => {
      ctx.trx = trx;
      await saveLeaseSignatures(ctx, signatures);
      const updated = await updateLease(
        ctx,
        {
          id: leaseId,
          status: DALTypes.LeaseStatus.SUBMITTED,
        },
        trx,
      );

      const {
        metadata: { backendIntegration },
      } = await getTenant(ctx);
      if (backendIntegration && backendIntegration.name === DALTypes.BackendMode.YARDI) {
        // this generates the primary tenant code, to be used for uploading the signed lease PDFs to FTP
        await setPrimaryTenant(ctx, { partyId, partyMembers: party.partyMembers, propertyId: party.assignedPropertyId });
      }

      await performPartyStateTransition(ctx, partyId);

      await sendMessageToCompleteFollowupPartyTasks(ctx, [updated.partyId]);

      notify({
        ctx,
        event: eventTypes.LEASE_PUBLISHED,
        data: { partyId, leaseId },
        routing: { teams: party.teams },
      });

      notify({
        ctx,
        event: eventTypes.LEASE_UPDATED,
        data: { partyId },
        routing: { teams: party.teams },
      });

      return updated;
    }, ctx);
    logger.info({ ctx, partyId, leaseId: updatedLease.id }, 'Published lease to provider successfully.');
  } catch (error) {
    logger.error({ ctx: msgCtx, error, msg }, 'Error while publishing lease.');
    notify({
      ctx: msgCtx,
      event: eventTypes.LEASE_PUBLISHED,
      data: { leaseId, error },
    });
  }

  return { processed: true };
};

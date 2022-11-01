/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import url from 'url';
import { mapSeries } from 'bluebird';
import {
  updateLease,
  getPartyLeases,
  getLeaseById,
  updateLeaseSignature,
  getLeaseSignatureById,
  getPropertyForLease,
  getLeaseSignatureByEnvelopeIdAndClientUserId,
  doesLeaseHaveWetSignedEnvelope,
  getLeaseSignatureStatuses,
} from '../../dal/leaseRepo';
import { loadPartyMemberByIds, loadPartyAgent } from '../../dal/partyRepo';
import { addLeaseActivityLog } from '../../services/leases/leaseActivityLog';
import * as leaseService from '../../services/leases/leaseService';
import { getSignatureUrl } from '../../services/leases/urls';
import { loadPartyById } from '../../services/party';
import * as validators from '../helpers/validators';
import { ServiceError } from '../../common/errors';
import { DALTypes } from '../../../common/enums/DALTypes';
import { decodeJWTToken } from '../../../common/server/jwt-helpers';
import { sanitizeUser } from '../../services/users';
import { exists } from '../../database/factory';
import { notify } from '../../../common/server/notificationClient';
import eventTypes from '../../../common/enums/eventTypes';
import { ACTIVITY_TYPES } from '../../../common/enums/activityLogTypes';
import { getS3Provider } from '../../workers/upload/s3Provider';
import { getSignedDocumentsForLease } from '../../dal/documentsRepo';
import loggerModule from '../../../common/helpers/logger';
import { sendPartyUpdatedNotification } from '../../helpers/party';
import { importActiveLeaseByPartyId } from '../../services/importActiveLeases/force-import';
import { getActiveLeaseWorkflowDataByPartyId } from '../../dal/activeLeaseWorkflowRepo';
import { APP_EXCHANGE, JOBS_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';
import { jobIsInProgress } from '../../services/helpers/jobs';
import { createJob } from '../../services/jobs.js';
import { isSignatureStatusSigned } from '../../../common/helpers/lease';
import LeaseProviderFactory from '../../services/leases/leaseProviderFactory';

const leaseProviderFactory = new LeaseProviderFactory();

const logger = loggerModule.child({ subType: 'leasesAPI' });

export const validateLease = async (ctx, leaseId) => {
  logger.trace({ ctx, leaseId }, 'validateLease');
  validators.uuid(leaseId, 'INCORRECT_LEASE_ID');
  const lease = await exists(ctx.tenantId, 'Lease', leaseId);
  if (!lease) {
    throw new ServiceError({
      token: 'LEASE_NOT_FOUND',
      status: 404,
    });
  }
};

export const validateSignature = async (ctx, signature) => {
  logger.trace({ ctx, signature }, 'validateSignature');

  const sign = await getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, signature.envelopeId, signature.clientUserId);
  if ([DALTypes.LeaseSignatureStatus.SIGNED, DALTypes.LeaseSignatureStatus.WET_SIGNED, DALTypes.LeaseSignatureStatus.VOIDED].includes(sign.status)) {
    throw new ServiceError({
      token: 'Lease signature status in incorrect state to be signed',
      status: 412,
    });
  }
};

export const loadLeasesForParty = async req => {
  const ctx = req;
  const { partyId } = req.params;

  logger.trace({ ctx }, 'loadLeasesForParty');
  await validators.party(ctx, partyId);
  return getPartyLeases(ctx, partyId);
};

export const patchLease = async req => {
  const ctx = req;
  logger.trace({ ctx }, 'patchLease');
  const { partyId, leaseId } = req.params;
  await validators.party(ctx, partyId);

  await validateLease(ctx, leaseId);

  const { lease } = req.body;
  const updated = await updateLease(ctx, { id: leaseId, lease });

  const party = await loadPartyById(ctx, partyId);
  notify({
    ctx,
    event: eventTypes.LEASE_UPDATED,
    data: { partyId },
    routing: { teams: party.teams },
  });

  return omit(updated, ['versions']);
};

// TODO: we should not be getting hostname as a parameter here
export const publishLease = async req => {
  const ctx = req;
  const { partyId, leaseId } = req.params;
  const { hostname } = req;
  logger.trace({ ctx, leaseId, hostname }, 'publishLease');
  const lease = req.body;

  validators.defined(hostname, 'MISSING_HOSTNAME');
  validators.defined(lease, 'MISSING_LEASE');
  validators.defined(lease.id, 'MISSING_LEASE');
  await validators.party(ctx, partyId);
  await validateLease(ctx, leaseId);

  const originalLease = await getLeaseById(ctx, leaseId);
  const updatedLease = await leaseService.publishLease(ctx, hostname, lease);

  await addLeaseActivityLog(ctx, updatedLease, ACTIVITY_TYPES.UPDATE, undefined, originalLease);

  const party = await loadPartyById(ctx, partyId);
  notify({
    ctx,
    event: eventTypes.LEASE_UPDATED,
    data: { partyId },
    routing: { teams: party.teams },
  });

  return omit(updatedLease, ['versions']);
};

export const createLease = req => {
  const ctx = req;
  const { promotedQuoteId, applicationId } = req.body;
  return leaseService.createLease(ctx, promotedQuoteId, applicationId);
};

export const emailLease = async req => {
  const ctx = req;
  const { leaseId } = req.params;
  const { partyMemberIds } = req.body;
  logger.trace({ ctx, leaseId, partyMemberIds }, 'emailLease');
  await validateLease(ctx, leaseId);
  const lease = await getLeaseById(ctx, leaseId);
  const partyMembers = await loadPartyMemberByIds(ctx, partyMemberIds);
  await mapSeries(partyMembers, async partyMember => {
    logger.trace({ ctx, leaseId, partyMember }, 'emailing lease to partyMember - getting signature url');
    const { signatureId } = await getSignatureUrl(ctx, leaseId, partyMember.id);
    logger.trace({ ctx, leaseId, partyMember, signatureId }, 'emailing lease to partyMember - updating signature');
    await updateLeaseSignature(ctx, { status: DALTypes.LeaseSignatureStatus.SENT }, { id: signatureId });

    logger.trace({ ctx, leaseId, partyMember, signatureId }, 'emailing lease to partyMember - adding lease activity');
    // Contact Back and Introduce Yourself will be completed since the contract sending is sent communication
    await addLeaseActivityLog(ctx, lease, ACTIVITY_TYPES.EMAIL, partyMember.fullName);

    const party = await loadPartyById(ctx, partyMember.partyId);
    notify({
      ctx,
      event: eventTypes.LEASE_UPDATED,
      data: { partyId: partyMember.partyId },
      routing: { teams: party.teams },
    });
  });

  const partyMembersWithEmails = partyMembers.filter(partyMember => partyMember.contactInfo.defaultEmail);
  const partyMemberIdsWithEmails = partyMembersWithEmails.map(partyMember => partyMember.id);
  await leaseService.sendLeaseMail(ctx, lease, partyMemberIdsWithEmails);
};

const generateStepperFlags = async (ctx, leaseId, clientUserId) => {
  const signatures = await getLeaseSignatureStatuses(ctx, leaseId);
  const hasThisPersonSigned = isSignatureStatusSigned(signatures.find(s => s.clientUserId === clientUserId).status);
  const haveAllResidentsSigned = !signatures.some(s => s.partyMemberId && !isSignatureStatusSigned(s.status));
  const haveAllCounterSignersSigned = !signatures.some(s => !s.partyMemberId && !isSignatureStatusSigned(s.status));
  const isLeaseExecuted = haveAllCounterSignersSigned && haveAllResidentsSigned;

  return { hasThisPersonSigned, haveAllResidentsSigned, haveAllCounterSignersSigned, isLeaseExecuted };
};

export const voidLease = async req => {
  const ctx = req;
  const { partyId, leaseId } = req.params;
  logger.trace({ ctx, partyId, leaseId }, 'voidLease');

  await validateLease(ctx, leaseId);

  const voidedLease = await leaseService.closeLease(ctx, leaseId, partyId);
  return voidedLease;
};

export const getResidentSignatureToken = async req => {
  const ctx = req;
  const { token } = req.query;
  const { signatureId } = decodeJWTToken(token);
  logger.trace({ ctx, signatureId }, 'Retrieving contract signature tokens from external sources(email)');
  const leaseSignature = await getLeaseSignatureById(ctx, signatureId);
  if (!leaseSignature) {
    throw new ServiceError({
      token: 'LEASE_SIGNATURE_DOES_NOT_EXIST',
      status: 412,
      data: leaseSignature,
    });
  }
  const {
    envelopeId,
    metadata: { clientUserId },
  } = leaseSignature;

  logger.trace({ ctx, signatureId, envelopeId, clientUserId }, 'Retrieving contract signature tokens from external sources(email)');

  let ret;
  try {
    ret = await leaseService.getSignerToken(ctx, envelopeId, clientUserId, req.hostname, false);
  } catch (error) {
    logger.trace({ ctx, error }, 'getResidentSignatureToken got error, enhancing with stepper flags');
    const stepperFlags = await generateStepperFlags(ctx, leaseSignature.leaseId, leaseSignature.clientUserId);
    logger.trace({ ctx, stepperFlags }, 'getResidentSignatureToken generated stepper flags -- rethrowing');
    error.data = { ...(error.data || {}), ...stepperFlags };
    throw error;
  }
  return ret;
};

export const getInOfficeSignatureToken = async req => {
  const ctx = req;
  const { envelopeId, clientUserId } = req.params;
  const { hostname } = req;

  logger.trace({ ctx, envelopeId, clientUserId }, 'Retrieving contract signature tokens inOfficeSignature=true');

  return await leaseService.getSignerToken(ctx, envelopeId, clientUserId, hostname, true);
};

export const getLeaseStatus = async req => {
  const ctx = req;
  const { leaseId } = req.params;
  logger.trace({ ctx, leaseId }, 'Retrieving contract status');
  await validateLease(ctx, leaseId);

  const leaseProvider = await leaseProviderFactory.getProvider(ctx);
  const { propertyId } = await getPropertyForLease(ctx, leaseId);
  await leaseProvider.syncSignatureStatuses(ctx, propertyId);

  return await leaseService.updateLeaseStatus(ctx, leaseId);
};

export const getLeaseAdditionalData = async req => {
  const ctx = req;
  const { leaseId } = req.params;
  logger.trace({ ctx, params: req.params }, 'Retrieving lease addtional data params');
  await validateLease(ctx, leaseId);

  return await leaseService.getLeaseAdditionalData(ctx, leaseId);
};

export const wetSign = async req => {
  const ctx = req;
  const { partyId, leaseId } = req.params;
  const { signature } = req.body;
  logger.trace({ ctx, partyId, leaseId }, 'wetSign');

  await validateLease(ctx, leaseId);
  await validators.party(ctx, partyId);
  await validateSignature(ctx, signature);

  await leaseService.markAsWetSigned(ctx, leaseId, partyId, signature);
};

export const updateEnvelopeStatus = async req => {
  const { hostname } = url.parse(req.headers.host) || req.hostname;
  const ctx = { ...req, hostname };
  const { token } = req.query;
  const tokenParams = decodeJWTToken(token);

  logger.trace({ ctx, tokenParams, hostname }, 'updateEnvelopeStatus action start');
  const { leaseId, envelopeId, clientUserId, action, signerId, signatureType, view, ...unexpectedTokenParams } = tokenParams;
  validators.defined(clientUserId, 'MISSING_CLIENT_USER_ID');
  validators.defined(leaseId, 'MISSING_LEASE_ID');
  validators.defined(envelopeId, 'MISSING_ENVELOPE_ID');
  validators.defined(action, 'MISSING_ACTION');

  logger.trace({ ctx, leaseId, envelopeId, clientUserId, action, signerId, signatureType, view, unexpectedTokenParams }, 'updateEnvelopeStatus token params');

  const lease = await getLeaseById(ctx, leaseId);
  const signature = await getLeaseSignatureByEnvelopeIdAndClientUserId(ctx, envelopeId, clientUserId);
  logger.trace({ ctx, signature }, 'updateEnvelopeStatus - existing signature');

  const user = await loadPartyAgent(ctx, lease.partyId);
  const property = await getPropertyForLease(ctx, lease.id);
  const metadata = {
    user: {
      fullName: user.fullName,
      title: user.metadata && user.metadata.businessTitle,
      phone: user.displayPhoneNumber,
      email: user.displayEmail,
      avatar: (await sanitizeUser(ctx, user)).avatarUrl,
    },
    property: { name: property.displayName },
  };

  if (lease.status === DALTypes.LeaseStatus.VOIDED || !signature || signature.status === DALTypes.LeaseSignatureStatus.VOIDED) {
    return { ...metadata, updateStatus: DALTypes.LeaseStatus.VOIDED };
  }

  const envelopeStatusUpdateResponse = await leaseService.updateSignatureStatus({
    ctx,
    envelopeId,
    lease,
    clientUserId,
    recipientStatus: action.toUpperCase(),
    userName: user.fullName,
    email: user.email,
    signerId,
    inOfficeSignature: signatureType === 'inOffice',
    view,
  });

  // I hate doing this here (we should have the information earlier in the call), but leaseService
  // needs refactoring so I'm putting it here to avoid doing risky throwaway work there
  const stepperFlags = await generateStepperFlags(ctx, leaseId, clientUserId);
  logger.trace({ ctx, ...stepperFlags }, 'updateEnvelopeStatus - final status before return');

  return {
    ...stepperFlags,
    updateStatus: envelopeStatusUpdateResponse[0].recipientStatus,
    envelopeStatusUpdateResponse,
    ...metadata,
  };
};

const downloadLease = async (req, leaseId, isPreview = false) => {
  const ctx = req;
  logger.trace({ ctx, leaseId, isPreview }, 'downloadLease');
  if (!leaseId) {
    throw new ServiceError({
      status: 400,
      token: 'MISSING_LEASE',
    });
  }

  await validateLease(ctx, leaseId);

  let stream;
  let filename;
  if (isPreview) {
    stream = await leaseService.getLeaseDocumentStream(ctx, leaseId);
    filename = `${leaseId}.pdf`;
  } else {
    const [doc] = await getSignedDocumentsForLease(ctx, leaseId);
    logger.trace({ ctx, leaseId, doc }, 'got signed document for lease');
    if (!doc) {
      // if lease is partially wet-signed, then the digitally signed document would have been returned above
      const reason = (await doesLeaseHaveWetSignedEnvelope(ctx, leaseId)) ? 'WETSIGNED_LEASE_DOCUMENT_NOT_AVAILABLE' : 'NO_LEASE_DOCUMENT_AVAILABLE';
      logger.warn({ ctx, leaseId, reason }, 'no lease document found!');
      throw new ServiceError({
        status: 412,
        token: reason,
      });
    }

    stream = getS3Provider().downloadSignedLease(ctx, doc.uuid, leaseId);
    filename = doc.metadata.uploadFileName;
  }

  return {
    type: 'stream',
    filename,
    stream,
  };
};

// TODO: rename, as this will also be used for token-based agent download
export const downloadLeaseForResident = async req => {
  const ctx = req;
  const { token } = req.query;
  const params = decodeJWTToken(token);

  const { leaseId } = params;
  logger.trace({ ctx, leaseId }, 'downloadLeaseForResident');

  return await downloadLease(ctx, leaseId);
};

export const downloadLeaseForAgent = async req => {
  const { leaseId } = req.params;
  const ctx = req;
  logger.trace({ ctx, leaseId }, 'downloadLeaseForAgent');
  return await downloadLease(ctx, leaseId);
};

export const downloadPreviewLeaseForAgent = async req => {
  const ctx = req;
  const { token } = req.query;
  const params = decodeJWTToken(token);

  const { leaseId } = params;
  logger.trace({ ctx, leaseId }, 'downloadPreviewLeaseForAgent');

  return await downloadLease(ctx, leaseId, true);
};

export const importMovingOut = async req => {
  const ctx = req;
  const { partyId: renewalPartyId } = req.params;
  logger.trace({ ctx, partyId: renewalPartyId }, 'importMovingOut - input params');

  const { seedPartyId } = await loadPartyById(ctx, renewalPartyId);
  await importActiveLeaseByPartyId(ctx, seedPartyId);
  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, seedPartyId);

  if (!activeLeaseData) {
    logger.error({ ctx, partyId: renewalPartyId }, 'importMovingOut - no activeLeaseData for the renewal party');
  }

  if (activeLeaseData && activeLeaseData.state !== DALTypes.ActiveLeaseState.MOVING_OUT) {
    throw new ServiceError({
      status: 412,
      token: 'NO_VACATE_DATE_IN_MRI',
    });
  }

  logger.trace({ ctx, partyId: renewalPartyId, activeLeaseData }, 'importMovingOut - done');
  return await sendPartyUpdatedNotification(ctx, renewalPartyId);
};

export const importCancelMoveout = async req => {
  const ctx = req;
  const { partyId: renewalPartyId } = req.params;
  logger.trace({ ctx, partyId: renewalPartyId }, 'importCancelMoveout - input params');

  const { seedPartyId } = await loadPartyById(ctx, renewalPartyId);
  await importActiveLeaseByPartyId(ctx, seedPartyId);
  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, seedPartyId);

  if (!activeLeaseData) {
    logger.error({ ctx, partyId: renewalPartyId }, 'importCancelMoveout - no activeLeaseData for the renewal party');
  }

  if (activeLeaseData && activeLeaseData.state === DALTypes.ActiveLeaseState.MOVING_OUT) {
    throw new ServiceError({
      status: 412,
      token: 'NOT_MARKED_FOR_CANCEL_IN_MRI',
    });
  }

  logger.trace({ ctx, partyId: renewalPartyId, activeLeaseData }, 'importCancelMoveout - done');
  return await sendPartyUpdatedNotification(ctx, renewalPartyId);
};

const createJobEntry = async ctx => {
  if (await jobIsInProgress(ctx, DALTypes.Jobs.AssignActiveLeaseToRSTeams)) {
    throw new ServiceError({
      token: 'REASSIGN_ACTIVE_LEASES_TO_RS_ALREADY_IN_PROGRESS',
      status: 412,
    });
  }

  const jobDetails = {
    name: DALTypes.Jobs.AssignActiveLeaseToRSTeams,
    category: DALTypes.JobCategory.MigrateData,
  };

  return (await createJob(ctx, {}, jobDetails)).id;
};

export const reassignActiveLeasesToRS = async req => {
  const ctx = req;
  const { tenantId } = req;
  logger.trace({ ctx }, 'manually requested by admin - reassignActiveLeasesToRS');

  const manuallyTriggeredJobId = await createJobEntry(ctx);
  await sendMessage({
    exchange: APP_EXCHANGE,
    key: JOBS_MESSAGE_TYPE.ASSIGN_AL_TO_RS_TEAM,
    message: {
      tenantId,
      isManualRequest: true,
      manuallyTriggeredJobId,
    },
    ctx,
  });
};

// This is called only from active lease page (not sure why).  The partyId in the params is the partyId of
// the new lease party (this should not be passed, it should be looked up on the backend)
export const voidExecutedLease = async req => {
  const ctx = req;
  const { partyId, leaseId } = req.params;
  // TODO: why is backendMode passed in from client!?!?
  const { activeLeasePartyId, propertyExternalId, partyGroupId, backendMode } = req.body;
  logger.trace({ ctx, partyId, leaseId, activeLeasePartyId, propertyExternalId, partyGroupId, backendMode }, 'voidExecutedLease');

  await validateLease(ctx, leaseId);
  await validators.party(ctx, partyId);
  await validators.party(ctx, activeLeasePartyId);

  await importActiveLeaseByPartyId(ctx, activeLeasePartyId);
  const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeasePartyId);

  if (activeLeaseData?.metadata?.moveInConfirmed) return { moveInAlreadyConfirmed: true, navigateToPartyId: '' };

  const unarchivedPartyId = await leaseService.voidExecutedLease(ctx, leaseId, partyId);
  return { navigateToPartyId: unarchivedPartyId };
};

export const syncLeaseSignatures = async req => {
  const ctx = req;
  const { leaseId } = req.params;
  const { partyId, clientUserId } = req.body;
  logger.trace({ ctx, leaseId, partyId, clientUserId, body: req.body }, 'syncLeaseSignatures');

  await validateLease(ctx, leaseId);

  partyId && (await validators.party(ctx, partyId));
  const updatedSignatures = await leaseService.syncLeaseSignatures(ctx, leaseId, partyId);
  logger.trace({ ctx, leaseId, partyId, clientUserId, updatedSignatures }, 'syncLeaseSignatures - got updatedSignatures');
  const signatureForClient = updatedSignatures.find(s => s.clientUserId === clientUserId);
  if (!signatureForClient) {
    logger.error({ ctx, leaseId, partyId, clientUserId }, 'clientUserId not found');
    throw new ServiceError({
      token: 'CLIENT_NOT_FOUND',
      status: 404,
    });
  }
  return signatureForClient;
};

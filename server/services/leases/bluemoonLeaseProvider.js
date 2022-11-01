/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { Readable } from 'stream';
import { mapSeries } from 'bluebird';
import newId from 'uuid/v4';
import loggerModule from '../../../common/helpers/logger';
import apiClient from './bluemoon/apiClient';
import trim from '../../../common/helpers/trim';
import { DALTypes } from '../../../common/enums/DALTypes';
import { getCtxCache, setCtxCache } from '../../../common/server/ctx-cache';
import { updateEnvelopeStatusInDb } from './leaseService';
import * as eventService from '../partyEvent';
import {
  getExternalPropertyIdForLease,
  insertOrUpdateLeaseTemplate,
  getLeasesForBMSyncByPropertyId,
  getLeaseSignatureStatuses,
  updateLeaseSignature,
  saveLeaseSignatures,
  updateBMPendingSignatures,
  getLeaseSignaturesByEnvelopeId,
} from '../../dal/leaseRepo';
import { getHostnameFromTenantId } from './urls';
import LeaseProvider from './leaseProvider';
import { LeaseProviderName } from '../../../common/enums/enums';
import { runInTransaction } from '../../database/factory';
import { paths, constructUrl } from '../../../common/helpers/paths';
import { createJWTToken } from '../../../common/server/jwt-helpers';
import { toMoment } from '../../../common/helpers/moment-utils';
import { getVoidLeaseEmailRecipients, allMembersSigned, buildBluemoonEnvelopeId, extractFromBluemoonEnvelopeId } from '../../../common/helpers/lease';
import { getPartyMembersByPartyIds } from '../../dal/partyRepo';

import { getUserById } from '../../dal/usersRepo';
import { getAvatarInitials } from '../../../common/helpers/avatar-helpers';

const logger = loggerModule.child({ subType: 'leaseServiceProvider/bluemoon' });

const statusesCachePath = envelopeId => `leases.getEnvelopeStatus[${envelopeId}].statuses`;

const shouldFilterDoc = doc => !doc.online_only && doc.section === 'lease' && doc.type === 'standard';

// Other and custom documetnts may have to be dealt with later
export const convertLeaseTemplate = bluemoonFormSet => {
  // format that is in fadv fields: "type": "Text", "tabLabel": "LEASETO", "mandatory": false, "displayName": ""
  // TODO: Had to remove "formId": "BLUEMOON_COMMUNITYRULES" because it causes issues when trying to create a lease with this form in standard forms
  const getRankedDocuments = docs => docs.filter(shouldFilterDoc).map(doc => doc.name);
  const sets = {
    sets: {
      1: {
        setName: 'Blue moon docs',
        // documents: [...getRankedDocuments(bluemoonFormSet.lease), ...getRankedDocuments(bluemoonFormSet.other)],   TODO: FOR now ignore the others as it causes errors
        documents: getRankedDocuments(bluemoonFormSet.forms.lease),
        formSetOrder: '0',
      },
    },
  };

  const convertDocuments = docs =>
    docs.reduce((acc, doc) => {
      if (shouldFilterDoc(doc)) {
        acc[doc.name] = {
          formId: doc.name,
          displayName: doc.label,
          section: doc.section,
        };
      }
      return acc;
    }, {});
  const documents = {
    // documents: { ...convertDocuments(bluemoonFormSet.forms.lease), ...convertDocuments(bluemoonFormSet.forms.other) },   TODO: FOR now ignore the others as it causes errors
    documents: convertDocuments(bluemoonFormSet.forms.lease),
  };

  // For Bluemoon we will keep the fields at the global level.
  // The consuming code should check whether the fields are at the document level or global one and act accordingly
  const convertFields = fields =>
    fields.reduce((acc, field) => {
      acc[field.name] = {
        type: field.format,
        tabLabel: field.name,
        section: field.section,
        format: field.format,
        default: field.default,
        choices: field.choices,
        maxLength: field.maxlength,
      };
      return acc;
    }, {});
  const fields = {
    globalFields: convertFields(bluemoonFormSet.fields),
  };

  return { leaseProvider: LeaseProviderName.BLUEMOON, ...sets, ...documents, ...fields };
};

const extractFields = globalFields =>
  Object.keys(globalFields)
    .filter(key => 'value' in globalFields[key])
    .reduce(
      (res, key) => {
        res.valueFields[key] = globalFields[key];
        if (globalFields[key].kind === 'custom') {
          res.customFields[key] = globalFields[key].value;
        } else {
          res.standardFields[key] = globalFields[key].value;
        }
        return res;
      },
      { standardFields: {}, customFields: {}, valueFields: {} },
    );

const createBMSignersFromRecipients = recipients =>
  recipients.reduce((res, recipient) => {
    // eslint-disable-next-line camelcase
    res.push({ email: recipient.contactInfo.defaultEmail, external_id: recipient.id });
    return res;
  }, []);

// returns JWT token that contains all auth/data needed to tell Reva to update signature status
// (either to complete or denied)
// note this function is used for both signers and countersigners
// signerId is PM id (for residents) or userId (for countersigners)
const getLeaseActionToken = ({ action, leaseId, envelopeId, inOfficeSignature, clientUserId, signerId, expiresIn = '7d' }) =>
  createJWTToken(
    {
      leaseId,
      envelopeId,
      clientUserId,
      action,
      signerId,
      // TODO: how does this apply to BM?  What constant should be used?
      signatureType: inOfficeSignature ? 'in-office' : 'email',
    },
    { expiresIn },
  );

const getSignUrl = async (ctx, envelopeId, clientUserId, hostname = '') => {
  if (!hostname) hostname = await getHostnameFromTenantId(ctx, ctx.tenantId);
  const { bmESignId: lastBmESignId } = extractFromBluemoonEnvelopeId(envelopeId);

  // we don't use constructUrl here because clientUserId is not parameterized properly in paths.js
  return lastBmESignId ? `https://${hostname}/leases/${envelopeId}/sign/${clientUserId}` : '';
};

// TODO move these into common location since they are not BM specific
// This is only used during createEnvelope, after (possiblying) generating the esig request
// the envelopeId will be used to decide if signUrl should be set or not
const constructStatusForResidentRecipient = async (ctx, recipient, index, { hostname = '', envelopeId }) => {
  const clientUserId = recipient.memberType === DALTypes.MemberType.RESIDENT ? `Resident${index}` : `Guarantor${index}`;
  const status = 'Created';
  const userName = escape(trim(recipient.fullName));
  const email = recipient.contactInfo.defaultEmail;
  const residentSignUrl = await getSignUrl(ctx, envelopeId, clientUserId, hostname);

  return {
    clientUserId,
    recipientId: recipient.id,
    status,
    token: residentSignUrl, // This is NOT a token
    counterSigner: false,
    userName,
    email,
  };
};

const constructStatusForCounterSigner = async (ctx, { envelopeId, counterSignerName, hostname = '', shouldCreateCustomBMLeaseId, guarantorIndex = 1 }) => {
  const index = shouldCreateCustomBMLeaseId ? guarantorIndex : 1;
  const clientUserId = `CounterSigner${index}`;
  const counterSignerSignUrl = await getSignUrl(ctx, envelopeId, clientUserId, hostname);
  const status = 'Created';
  return {
    clientUserId,
    userName: counterSignerName,
    counterSigner: true,
    status,
    token: counterSignerSignUrl, // This is NOT a token
  };
};

// signatureStatuses is a map with keys that are bmLeaseIds
const getLastBmSignatureStatusForLease = (ctx, signatureStatuses, bmLeaseId) => {
  logger.trace({ ctx, bmLeaseId, signatureStatuses }, 'getLastBmSignatureStatusForLease');
  const bmLeaseSignatures = signatureStatuses[bmLeaseId];

  if (!bmLeaseSignatures) {
    logger.warn({ ctx, bmLeaseId, signatureStatuses }, 'getLastBmSignatureStatusForLease Found no lease signatures for lease');
    return {};
  }

  const bmESignIds = Object.keys(bmLeaseSignatures);
  const latestESign = bmESignIds
    .map(eSignId => ({ bmESignId: eSignId, ...bmLeaseSignatures[eSignId] }))
    .sort((a, b) => toMoment(b.createdAt).diff(toMoment(a.createdAt)))[0];
  if (latestESign) {
    latestESign.bmESignIds = bmESignIds;
  }

  logger.trace({ ctx, bmLeaseId, latestESign }, 'getLastBmSignatureStatusForLease returning');
  return latestESign;
};

const renewLeaseSignatures = async (ctx, bmSigners, { newEnvelopeId, lease, status, oldEnvelopeId }) => {
  const { id: leaseId, partyId, baselineData } = lease;

  logger.trace({ ctx, newEnvelopeId, oldEnvelopeId, leaseId }, 'renewLeaseSignatures');

  const oldSignatures = await getLeaseSignatureStatuses(ctx, leaseId);
  const voidedSignatures = await updateLeaseSignature(ctx, { status: DALTypes.LeaseSignatureStatus.VOIDED }, { leaseId, envelopeId: oldEnvelopeId });

  const signaturesToUpdate = bmSigners?.length ? bmSigners : voidedSignatures;
  const signatures = await mapSeries(signaturesToUpdate, async signature => {
    const id = newId();

    const { clientUserId } = signature;
    const token = await getSignUrl(ctx, newEnvelopeId, clientUserId);

    const voidSignature = voidedSignatures.find(oldRevaSignature => oldRevaSignature.metadata.clientUserId === clientUserId);
    const { partyMemberId, userId } = voidSignature;
    const metadata = bmSigners?.length ? signature : signature.metadata;

    return {
      id,
      leaseId,
      partyMemberId,
      userId,
      signUrl: token,
      clientUserId,
      envelopeId: newEnvelopeId,
      metadata: { ...metadata, token },
      status,
    };
  });

  await saveLeaseSignatures(ctx, signatures);

  const sentToOrSignedBy = getVoidLeaseEmailRecipients(oldSignatures);
  const partyMembers = await getPartyMembersByPartyIds(ctx, [partyId]);
  const allPartyMembersSigned = allMembersSigned(partyMembers, oldSignatures);

  const termLength = baselineData?.publishedLease?.termLength || null;
  const leaseStartDate = lease?.baselineData?.publishedLease?.leaseStartDate || null;

  sentToOrSignedBy?.length &&
    (await eventService.saveLeaseVersionCreatedEvent(ctx, {
      partyId,
      userId: (ctx.authUser || {}).id,
      metadata: {
        leaseId,
        sentToOrSignedBy,
        allPartyMembersSigned,
        termLength,
        leaseStartDate,
      },
    }));
};

const renewWetLeaseSignatures = async (ctx, lease, { revaBmLeaseId, revaBmESignId }) => {
  const oldEnvelopeId = buildBluemoonEnvelopeId(revaBmLeaseId, revaBmESignId);
  const oldSignaturesByEnvelopeId = await getLeaseSignaturesByEnvelopeId(ctx, oldEnvelopeId);

  await renewLeaseSignatures(ctx, [], {
    lease,
    newEnvelopeId: revaBmLeaseId,
    status: DALTypes.LeaseSignatureStatus.NOT_SENT,
    oldEnvelopeId,
  });

  await mapSeries(oldSignaturesByEnvelopeId, async oldSignature => {
    if (oldSignature.status !== DALTypes.LeaseSignatureStatus.WET_SIGNED) return;
    await updateLeaseSignature(
      ctx,
      { status: DALTypes.LeaseSignatureStatus.WET_SIGNED },
      { leaseId: lease.id, envelopeId: revaBmLeaseId, clientUserId: oldSignature.clientUserId },
    );
  });
};

// covers the cases 2.2, 3.1 from algo
const handleNoESignaturesReceived = async (ctx, lease, { revaBmLeaseId, revaBmESignId, lastBmSignatures }) => {
  if (!revaBmESignId) return;

  if (lease.status !== DALTypes.LeaseStatus.EXECUTED) {
    await renewLeaseSignatures(ctx, lastBmSignatures.signers, {
      lease,
      newEnvelopeId: revaBmLeaseId,
      status: DALTypes.LeaseSignatureStatus.NOT_SENT,
      oldEnvelopeId: buildBluemoonEnvelopeId(revaBmLeaseId, revaBmESignId),
    });
  }
  return;
};

// covers the cases: 2.1, 3.3, 3.4 from algo
const handleMismatchBMEnvelopeId = async (ctx, lease, partyId, { newEnvelopeId, revaBmESignId, revaBmLeaseId, lastBmESignId, lastBmSignatures }) => {
  if (!revaBmESignId) {
    await mapSeries(lastBmSignatures.signers, async bmSignature => {
      logger.trace({ ctx, newEnvelopeId, oldEnvelopeId: revaBmLeaseId, leaseId: lease.id }, 'handleMismatchBMEnvelopeId about to updateBMPendingSignatures');

      const { clientUserId } = bmSignature;

      const signUrl = await getSignUrl(ctx, newEnvelopeId, clientUserId);
      await updateBMPendingSignatures(ctx, revaBmLeaseId, clientUserId, { signUrl, newEnvelopeId });
    });
  }

  if (revaBmESignId && revaBmESignId !== lastBmESignId) {
    if (lease.status === DALTypes.LeaseStatus.EXECUTED) {
      // TODO: CPM-19971 slack alert
      logger.error({ ctx, partyId, revaLeaseId: lease.id, revaBmLeaseId, revaBmESignId, lastBmESignId }, 'Executed lease with changed signatures in BM');
    } else {
      await renewLeaseSignatures(ctx, lastBmSignatures.signers, {
        lease,
        newEnvelopeId,
        status: DALTypes.LeaseSignatureStatus.NOT_SENT,
        oldEnvelopeId: buildBluemoonEnvelopeId(revaBmLeaseId, revaBmESignId),
      });
    }
  }

  return;
};

const handleWetSignedEnvelopes = async (ctx, lease, propertyId, { revaBmLeaseId, revaBmESignId }, { bmESignIds }) => {
  if (revaBmESignId) {
    await renewWetLeaseSignatures(ctx, lease, { revaBmLeaseId, revaBmESignId });
  }

  await mapSeries(bmESignIds, async eSignId => {
    logger.trace({ ctx, eSignId, propertyId, revaBmLeaseId }, 'BM signature to delete because of wet signed');
    const envelopeId = buildBluemoonEnvelopeId(revaBmLeaseId, eSignId);
    await apiClient.deleteLeaseESignatureRequest(ctx, propertyId, lease.id, envelopeId, eSignId);
  });
};

//  CG: Algo
//   1. Get the envelopeId of oldSignatures that are not voided
//   2. If the envelopeId is leaseId only (pending state), then
//             - If bmESignId is defined, then assign the new envelopeId combining both, and add the signUrl (note that this is also added to the metadata), and we call updateEnvelopeStatus (this is an update to an existing reva signature set)
//             - If bmESignId is not defined, then there is nothing to do, we leave as is
//   3. If the envelopeId has the mbESignId in the envelopeId, then
//             - If bmESignId is not defined and the lease is not executed yet, void the older lease signatures and create a pending set of signatures. Re-use the same userId as the previous signature set, and no need to delete the bluemoon one in this case. We may ahve to store sentToOrSignedBy so that when we receive an eSignId we could resend automatically the email
//             - If both eSignIds are the same, we should do a check to see whether the status are the same for each signature. If different, call updateEnvelopeStatus
//             - If the eSignIds are different and the lease is already executed in Reva, alert with a log error and slack alert
//             - If the eSignIds are different and the lease is not executed yet in Reva, then
//                      - Void the older lease signatures using updateLeaseSignature, (the delete of the eSignature is handle a bit after using bmESignIds
//                      - Add a new set of signatures with the envelopeId set using both leaseId and eSignId, and the signUrl exists. If the status between this new set and the data we received in statuses is different, then call updateEnvelopeStatus. The userId would be the same as the one for the previous active leaseSignature.
//    4. If the lease is wet signed, delete all signatures from BM and renew all signatures in case that we already had signatures synced in Reva.

const updateSignatureSets = async (
  ctx,
  lease,
  propertyId,
  { revaBmLeaseId, revaBmESignId, hasWetSignedEnvelope },
  { lastBmESignId, bmESignIds, lastBmSignatures },
) => {
  const { id: revaLeaseId, partyId } = lease;

  logger.trace(
    { ctx, revaLeaseId, partyId, revaBmLeaseId, revaBmESignId, hasWetSignedEnvelope, lastBmESignId, bmESignIds, lastBmSignatures },
    'updateSignatureSets',
  );
  if (hasWetSignedEnvelope) {
    await handleWetSignedEnvelopes(ctx, lease, propertyId, { revaBmLeaseId, revaBmESignId }, { bmESignIds });
    return;
  }

  if (!lastBmESignId) {
    await handleNoESignaturesReceived(ctx, lease, { revaBmLeaseId, revaBmESignId, lastBmSignatures });
    return;
  }

  const newEnvelopeId = buildBluemoonEnvelopeId(revaBmLeaseId, lastBmESignId);
  await handleMismatchBMEnvelopeId(ctx, lease, partyId, { newEnvelopeId, revaBmESignId, lastBmESignId, lastBmSignatures, revaBmLeaseId });

  logger.trace({ lease, newEnvelopeId, signers: lastBmSignatures.signers }, 'updateSignatureSets about to update reva db');
  await updateEnvelopeStatusInDb(ctx, lease, newEnvelopeId, lastBmSignatures.signers);

  const idsToDelete = bmESignIds.filter(id => id !== lastBmESignId);
  await mapSeries(idsToDelete, async eSignId => {
    logger.trace({ ctx, eSignId, propertyId }, 'Old bm signature to delete');
    const envelopeId = buildBluemoonEnvelopeId(revaBmLeaseId, eSignId);
    await apiClient.deleteLeaseESignatureRequest(ctx, propertyId, lease.id, envelopeId, eSignId);
  });

  logger.trace({ ctx, partyId, revaLeaseId, newEnvelopeId, revaBmESignId }, 'addNewSignatureSet');
};

const isLeaseCreatedForGuarantors = recipients => recipients.some(r => r.memberType === DALTypes.MemberType.GUARANTOR);

const buildGuarantorLeaseId = (residentEnvelopeId, guarantorIndex) => residentEnvelopeId.concat(`Guarantor${guarantorIndex}`);

export default class BluemoonLeaseProvider extends LeaseProvider {
  constructor() {
    super();
    this.providerName = LeaseProviderName.BLUEMOON;
  }

  getFormSetsList = async (ctx, property) => {
    const { id: propertyId, externalId } = property;
    logger.trace({ ctx, property }, 'Fetching lease forms');

    const bmTemplateData = await apiClient.getFormSet(ctx, propertyId, externalId);
    const templateData = convertLeaseTemplate(bmTemplateData);

    if (!templateData.documents || !templateData.globalFields) {
      // hopefully this will produce a more informative error message than a simple TypeError message
      // since this should be catch by the surrounding try/catch block
      throw new Error('Missing FormSet prop. Probably missing lease templates or a template refresh error');
    }

    return await runInTransaction(async innerTrx => {
      const innerCtx = { ...ctx, trx: innerTrx };

      // TODO: to fix. I get teh following error: invalid input syntax for type json when setting requet and response
      const template = { propertyId, request: {}, response: {}, templateData };
      await insertOrUpdateLeaseTemplate(innerCtx, template, false);
    }, ctx).catch(error => {
      logger.error({ ctx, error, property }, 'failed to get form sets list from Bluemoon');
      throw error;
    });
  };

  // note, recipients here only includes residents, not countersigner
  createEnvelope = async (ctx, leaseId, recipients, hostname, documents, counterSignerName, globalFields = {}, residentEnvelopeId = '', guarantorIndex) => {
    try {
      const { propertyName: bmPropertyId, revaPropertyId, bmAutoESignatureRequest } = await getExternalPropertyIdForLease(ctx, leaseId);

      // Build 3 objects. One that contains the list of fields with values for debugging, one that is the custom fields, and the last one the standard fieds
      const { standardFields, customFields, valueFields } = extractFields(globalFields);

      logger.trace(
        { ctx, leaseId, hostname, counterSignerName, bmPropertyId, bmAutoESignatureRequest, recipients, documents, valueFields, standardFields, customFields },
        'Creating lease (bluemoon)',
      );

      const shouldCreateCustomBMLeaseId = !bmAutoESignatureRequest && residentEnvelopeId && isLeaseCreatedForGuarantors(recipients);

      let bmLeaseId;
      if (shouldCreateCustomBMLeaseId) {
        bmLeaseId = buildGuarantorLeaseId(residentEnvelopeId, guarantorIndex);
      } else bmLeaseId = await apiClient.createLease(ctx, revaPropertyId, leaseId, bmPropertyId, standardFields, customFields);

      logger.trace(
        { ctx, leaseId, bmLeaseId, hostname, counterSignerName, bmPropertyId, recipients, valueFields, standardFields, customFields },
        'Created lease (bluemoon)',
      );

      // Dependig on integration setting, the list of documents is built either from Reva, or from Bluemoon directly
      // (in which case, the agent creates the signature request from Bluemon's UI).
      let envelopeId = bmLeaseId;
      const documentList = Object.keys(documents);
      if (bmAutoESignatureRequest && documentList.length) {
        // TODO: TODELETE: jsut limiting to 3 documents so that we don't have to many to sign while developing
        const standardFormNames = Object.keys(documents).slice(-3);
        const signers = createBMSignersFromRecipients(recipients);

        // TODO: rename createLeaseESignatureRequest to something like createESignatureRequest
        const bmESignId = await apiClient.createLeaseESignatureRequest(ctx, revaPropertyId, leaseId, bmLeaseId, standardFormNames, signers, null, null);

        envelopeId = buildBluemoonEnvelopeId(bmLeaseId, bmESignId);
      } else {
        logger.trace({ ctx, bmAutoESignatureRequest, documentList }, 'skipped creation of esignature request');
      }

      const residentStatuses = await mapSeries(recipients, async (r, index) => {
        const newIndex = guarantorIndex || index + 1;
        return await constructStatusForResidentRecipient(ctx, r, newIndex, { hostname, envelopeId });
      });

      logger.trace(
        { ctx, leaseId, residentStatuses, hostname, counterSignerName, bmPropertyId, recipients, valueFields, standardFields, customFields },
        'Created resident statuses',
      );

      const countersignerStatus = await constructStatusForCounterSigner(ctx, {
        hostname,
        envelopeId,
        counterSignerName,
        shouldCreateCustomBMLeaseId,
        guarantorIndex,
      });
      logger.trace(
        { ctx, leaseId, countersignerStatus, hostname, counterSignerName, bmPropertyId, recipients, valueFields, standardFields, customFields },
        'Created countersigner status',
      );
      const statuses = [...residentStatuses, countersignerStatus];

      return { statuses, envelopeId };
    } catch (error) {
      logger.error({ ctx, error, leaseId }, 'failed to create envelope');
      throw error;
    }
  };

  // returns the URL that the "preparing lease..." dialog will redirect to when the countersigner does
  // indeed need to verify the lease document
  // TODO: clientUserId should not be necessary - remove it
  getCounterSignerToken = async (ctx, leaseId, envelopeId, clientUserId, counterSignerName, counterSignerEmail, hostname, counterSignerId, leaseExecuted) => {
    try {
      const { propertyName: bmPropertyId, revaPropertyDisplayName } = await getExternalPropertyIdForLease(ctx, leaseId);

      logger.trace(
        { ctx, bmPropertyId, leaseId, envelopeId, clientUserId, counterSignerName, counterSignerEmail, hostname, counterSignerId, leaseExecuted },
        'Fetching countersigner token',
      );

      const envelopeStatuses = getCtxCache(ctx, statusesCachePath(envelopeId));
      const statusArr = envelopeStatuses.filter(status => status.clientUserId === clientUserId);
      if (!statusArr.length) {
        logger.error(
          { ctx, leaseId, envelopeId, clientUserId, envelopeStatuses },
          'failed to get counter signer token - Could not find the clientUserId in the statuses',
        );
        throw new Error('failed to get counter signer token - Could not find the clientUserId in the statuses');
      }

      // counterSignerToken here is a JWT token, not a link
      const countersignerToken = getLeaseActionToken({
        action: DALTypes.LeaseStatusEvent.COMPLETED,
        leaseId,
        envelopeId,
        inOfficeSignature: true,
        signerId: counterSignerId,
        clientUserId: 'CounterSigner1', // use passed in one instead?
      });
      // This will return a URL to the "executeLease" view, with a redirect to the "confirmLease" view upon confirmation
      const baseURL = new URL(constructUrl(paths.REVIEW_LEASE, hostname, { envelopeId, token: countersignerToken }));
      const executeURL = new URL(constructUrl(paths.EXECUTE_LEASE, hostname, { envelopeId, token: countersignerToken }));
      executeURL.searchParams.set('propertyName', revaPropertyDisplayName);
      baseURL.searchParams.set('propertyName', revaPropertyDisplayName);
      baseURL.searchParams.set('executionURL', executeURL.toString());
      logger.trace({ ctx, bmPropertyId, leaseId, envelopeId, baseURL }, 'created signed URL to review lease');

      return baseURL.toString();
    } catch (error) {
      logger.error({ ctx, error, leaseId, envelopeId, clientUserId }, 'failed to get the counter signer token');
      throw error;
    }
  };

  getSignedDocuments = async (ctx, revaLeaseId, envelopeId) => {
    try {
      const { revaPropertyId } = await getExternalPropertyIdForLease(ctx, revaLeaseId);
      const { bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);

      let base64Pdf = '';
      if (bmESignId) {
        logger.trace({ ctx, revaPropertyId, revaLeaseId, envelopeId }, 'BM getSignedDocuments about to call getPdf');
        const pdfDocBinary = await apiClient.getPdf(ctx, revaPropertyId, revaLeaseId, envelopeId, bmESignId);
        logger.trace(
          { ctx, revaPropertyId, revaLeaseId, envelopeId, type: typeof pdfDocBinary, objkeys: Object.keys(pdfDocBinary), documentLength: pdfDocBinary.length },
          'Fetched document',
        );
        // TODO modify caller so that we can return stream or unencoded binary
        base64Pdf = pdfDocBinary.toString('base64');
      } else {
        logger.trace({ ctx, revaPropertyId, revaLeaseId, envelopeId }, 'Skipping fetch of pdf because envelopeId has no eSig');
      }
      return { pdfBytes: base64Pdf };
    } catch (error) {
      logger.error({ ctx, error, revaLeaseId, envelopeId }, 'BM failed to get the signed document');
      return { error: 'failed to fetch the document' };
    }
  };

  getLeaseDocumentStream = async (ctx, revaLeaseId, envelopeId) => {
    try {
      const { revaPropertyId } = await getExternalPropertyIdForLease(ctx, revaLeaseId);
      const { bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);
      logger.trace({ ctx, revaPropertyId, revaLeaseId, envelopeId }, 'BM getSignedDocuments about to call getPdf');
      const pdfDocBinary = await apiClient.getPdf(ctx, revaPropertyId, revaLeaseId, envelopeId, bmESignId);
      return new Readable({
        read() {
          this.push(pdfDocBinary);
          this.push(null);
        },
      });
    } catch (error) {
      logger.error({ ctx, error, revaLeaseId, envelopeId }, 'BM failed to get stream for the signed document');
      return { error: 'failed to fetch the document' };
    }
  };

  // This is only called by getSignerToken in leaseService when the lease is already voided
  // This is the equivalent URL to the one sent to Docusign as the "completion" URL
  getLeaseConfirmationUrl = async (ctx, { leaseId, envelopeId, clientUserId, recipient, host, signerId, inOfficeSignature }) => {
    try {
      const { propertyName: bmPropertyId } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, bmPropertyId, leaseId, envelopeId, clientUserId, host, recipient, signerId, inOfficeSignature }, 'Get completedUrl');

      // token here is a JWT token, not a link
      const token = getLeaseActionToken({
        action: DALTypes.LeaseStatusEvent.COMPLETED,
        leaseId,
        envelopeId,
        inOfficeSignature,
        signerId,
        clientUserId,
      });
      const confirmationUrl = constructUrl(paths.SIGNATURE_CONFIRMATION, host, { token });
      logger.trace({ ctx, confirmationUrl }, 'getLeaseConfirmationUrl returning');
      return confirmationUrl;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId, clientUserId }, 'failed to get the completedUrl');
      throw error;
    }
  };

  // Only done for partyMembers. getCounterSignerToken is used for the countersigner
  // TODO: rename to reflect it is only for residents (this is same as in FADV)
  getSignerToken = async (ctx, leaseId, envelopeId, clientUserId, _recipient, hostname, signerId, inOfficeSignature) => {
    try {
      const { propertyName: bmPropertyId } = await getExternalPropertyIdForLease(ctx, leaseId);
      logger.trace({ ctx, bmPropertyId, leaseId, envelopeId, clientUserId, hostname, signerId, inOfficeSignature }, 'Get signer tokens lease envelope');

      const envelopeStatuses = getCtxCache(ctx, statusesCachePath(envelopeId));
      logger.trace(
        { ctx, bmPropertyId, leaseId, envelopeId, clientUserId, hostname, signerId, inOfficeSignature, envelopeStatuses },
        'Get signer tokens got statuses',
      );

      const statusArr = envelopeStatuses.filter(status => status.clientUserId === clientUserId);

      if (statusArr.length <= 0) {
        logger.error(
          { ctx, leaseId, envelopeId, clientUserId, envelopeStatuses },
          'failed to get signer tokens - Could not find the clientUserId in the statuses',
        );
      }

      logger.trace(
        { ctx, bmPropertyId, leaseId, envelopeId, clientUserId, hostname, signerId, inOfficeSignature, statusArr },
        'get signer tokens status matching signer',
      );
      return statusArr[0].signatureLink;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId, clientUserId }, 'failed to get signer tokens');
      throw error;
    }
  };

  getEnvelopeStatus = async (ctx, leaseId, envelopeId, requestorData = {}) => {
    try {
      const { propertyName: bmPropertyId, revaPropertyId } = await getExternalPropertyIdForLease(ctx, leaseId);
      const { bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);
      if (!bmESignId) return [];

      const statuses = await apiClient.getLeaseESignatureRequest(ctx, revaPropertyId, leaseId, envelopeId, bmESignId, requestorData);
      logger.trace({ ctx, requestorData, leaseId, envelopeId, bmESignId, bmPropertyId }, 'Get envelope status');

      // Use the ctx cache to provde the signature Urls to the getToken function
      setCtxCache(ctx, statusesCachePath(envelopeId), statuses);

      return statuses;
    } catch (error) {
      logger.error({ error, ctx, leaseId, envelopeId }, 'failed to get envelope status');
      throw error;
    }
  };

  executeLease = async (ctx, revaLeaseId, envelopeId, signerId, requestorData = {}) => {
    const signer = await getUserById(ctx, signerId);
    const signerInitials = getAvatarInitials(signer.fullName);

    try {
      const { propertyName: bmPropertyId, revaPropertyId } = await getExternalPropertyIdForLease(ctx, revaLeaseId);
      const { bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);
      logger.trace({ ctx, signer, requestorData, revaLeaseId, envelopeId, bmESignId, bmPropertyId }, 'about to execute lease in BM');
      const { executed: executeSuccessful } = await apiClient.executeLease(
        ctx,
        revaPropertyId,
        revaLeaseId,
        envelopeId,
        bmESignId,
        signer.fullName,
        signerInitials,
        signer.metadata.businessTitle,
      );
      logger.trace({ ctx, requestorData, executeSuccessful, revaLeaseId, envelopeId, bmESignId, bmPropertyId }, 'back from executeLease in BM');
      // This indicates that BM thinks the lease was already executed.  This should never happen because we sync the status
      // before executing lease, unless two people execute a lease at almost exactly the same time
      if (!executeSuccessful) throw new Error('Bluemoon execute lease returned false');
      return executeSuccessful;
    } catch (error) {
      logger.error({ error, ctx, revaLeaseId, envelopeId }, 'failed to execute lease');
      throw error;
    }
  };

  // EnvelopeIds assumes that each value has only one occurrence
  voidLease = async (ctx, leaseId, envelopeIds = []) => {
    const { propertyName, revaPropertyId } = await getExternalPropertyIdForLease(ctx, leaseId);
    logger.trace({ ctx, leaseId, envelopeIds, bmPropertyId: propertyName }, 'voidLease');

    await mapSeries(envelopeIds, async envelopeId => {
      try {
        const { bmLeaseId, bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);
        bmESignId && (await apiClient.deleteLeaseESignatureRequest(ctx, revaPropertyId, leaseId, envelopeId, bmESignId));
        !envelopeId.includes(DALTypes.MemberType.GUARANTOR) && (await apiClient.deleteLease(ctx, revaPropertyId, leaseId, envelopeId, bmLeaseId));
      } catch (error) {
        logger.error({ error, ctx, leaseId, envelopeIds }, 'failed to void lease');
        // Note: do not throw as we don't want to block Reva on this error
        // because the only issu is that bluemoon will have more data tahn it should,
        // but it won't break the use case as a new lease/esignature would be created
      }
    });
  };

  // retrieves all Reva leases for the specified property from our DB,
  // and all BM signatures from BM, then updates the Reva signatures for those leases from
  // the BM data
  syncSignatureStatuses = async (ctx, propertyId) => {
    try {
      logger.trace({ ctx, propertyId }, 'Sync all lease signatures for property');

      const revaLeases = (await getLeasesForBMSyncByPropertyId(ctx, propertyId)) || [];
      if (!revaLeases.length) return [];

      const statuses = await apiClient.getAllESignatureStatuses(ctx, propertyId);

      await mapSeries(revaLeases, async revaLease => {
        const { envelopeId, hasWetSignedEnvelope = false, ...lease } = revaLease;
        const { bmLeaseId: revaBmLeaseId, bmESignId: revaBmESignId } = extractFromBluemoonEnvelopeId(envelopeId);

        const { bmESignId: lastBmESignId = '', bmESignIds = [], ...lastBmSignatures } = getLastBmSignatureStatusForLease(ctx, statuses, revaBmLeaseId);
        await updateSignatureSets(
          ctx,
          lease,
          propertyId,
          { revaBmLeaseId, revaBmESignId, hasWetSignedEnvelope },
          { lastBmESignId, bmESignIds, lastBmSignatures },
        );
      });

      return statuses;
    } catch (error) {
      logger.error({ error, ctx, propertyId }, 'failed to get all signatures for property');
      throw new Error(error);
    }
  };

  syncSignatureStatusesAfterSigningIfNeeded = async (ctx, propertyId, envelopeId) => {
    logger.trace({ ctx, propertyId, envelopeId }, 'syncSignatureStatusesAfterSigningIfNeeded');

    const { bmLeaseId, bmESignId } = extractFromBluemoonEnvelopeId(envelopeId);

    if (bmLeaseId && bmESignId) {
      logger.trace({ ctx, bmLeaseId, bmESignId }, 'Envelope contains both leaseId and signatureId');
      await this.syncSignatureStatuses(ctx, propertyId);
    }
  };
}

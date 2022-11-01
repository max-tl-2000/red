/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { v4 as newId } from 'uuid';
import path from 'path';
import pdfMerge from 'pdf-merge';
import flatten from 'lodash/flatten';
import { getLeaseById } from '../../dal/leaseRepo';
import { createDocument as saveDocument, getSignedDocumentsForLease } from '../../dal/documentsRepo';
import LeaseProviderFactory from '../../services/leases/leaseProviderFactory';
import { getTenant } from '../../services/tenantService';
import { getS3Provider } from '../upload/s3Provider';
import { getPrivateBucket, getKeyPrefixForSignedLeaseDocuments, getEncryptionKeyId } from '../upload/uploadUtil';

import { getNameForExportedLease } from '../../services/helpers/party';
import { write, mkdirp } from '../../../common/helpers/xfs';
import config from '../../config';
import workerConfig from '../config';
import { APP_EXCHANGE, EXPORT_MESSAGE_TYPE } from '../../helpers/message-constants';
import { sendMessage } from '../../services/pubsub';

import loggerModule from '../../../common/helpers/logger';
import { execConcurrent } from '../../../common/helpers/exec-concurrent';
import sleep from '../../../common/helpers/sleep.js';

import { envelopeIdsForLease } from '../../services/leases/leaseService';

const MILISECONDS_TO_WAIT_BEFORE_DOWNLOADING_DOCUMENT = 5000;
const logger = loggerModule.child({ subType: 'fetchSignedLeaseHandler' });
const leaseProviderFactory = new LeaseProviderFactory();

const createDocument = async (ctx, documentId, metadata) => {
  const document = {
    uuid: documentId,
    accessType: 'private',
    metadata,
    context: 'signed-lease',
  };

  return await saveDocument(ctx, document);
};

const options = {
  acl: 'private',
  encryptionType: 'aws:kms',
  keyId: getEncryptionKeyId(),
};

const documentsAlreadyFetched = async (ctx, leaseId) => {
  const result = await getSignedDocumentsForLease(ctx, leaseId);
  return result && result.length > 0;
};

const saveSignedDocumentsToTemp = async (ctx, leaseId, leasesFolder) => {
  const envelopeIds = await envelopeIdsForLease(ctx, leaseId);
  logger.trace({ ctx, leaseId, leasesFolder, envelopeIds }, 'saving lease documents to EFS');

  // TODO: why is this going to provider instead of to leaseService.  This shouldn't know about providers.
  const leaseProvider = await leaseProviderFactory.getProvider(ctx);

  // We use a sleep here so that we are sure that docusign finished completing the document
  await sleep(MILISECONDS_TO_WAIT_BEFORE_DOWNLOADING_DOCUMENT);

  const tempLeaseFiles = (
    await execConcurrent(envelopeIds, async ({ envelopeId, isForGuarantor }) => {
      const { pdfBytes, error } = await leaseProvider.getSignedDocuments(ctx, leaseId, envelopeId);
      if (error) {
        logger.error({ ctx, error, leaseId, envelopeId }, 'failed to fetch lease document for envelope');
        return null;
      }
      if (!pdfBytes) {
        logger.warn({ ctx, leaseId, envelopeId }, 'No pdf found for this envelope - pdf will not be included');
        return null;
      }

      logger.trace({ ctx, leaseId, envelopeId }, 'fetched lease documents for envelope');
      const uuid = newId();
      const docBuffer = Buffer.from(pdfBytes, 'base64');
      const filepath = path.join(leasesFolder, uuid);
      const name = `Lease_${leaseId}_${envelopeId}`;
      await write(filepath, docBuffer, 'binary');

      logger.trace({ ctx, leaseId, envelopeId, filepath }, 'saved lease document');
      return {
        filepath,
        envelopeId,
        isForGuarantor,
        name,
        docBuffer,
      };
    })
  ).filter(lf => lf !== null);

  logger.trace({ ctx, leaseId, envelopeIds }, 'saved all lease documents');

  return flatten(tempLeaseFiles);
};

const uploadToS3 = async (ctx, leaseId, docBuffer) => {
  const keyPrefix = getKeyPrefixForSignedLeaseDocuments(ctx.tenantId, leaseId);
  const docId = newId();
  const key = `${keyPrefix}/${docId}`;
  const bucket = getPrivateBucket();
  const s3Response = await getS3Provider().saveBuffer(ctx, bucket, key, docBuffer, options);
  logger.trace({ ctx, leaseId, key, s3Response }, 'saved lease document to s3');

  return { key, docId };
};

export const fetchSignedLeaseDocuments = async ({ msgCtx, tenantId, leaseId }) => {
  logger.trace({ ctx: msgCtx, leaseId }, 'Fetching signed documents');

  if (workerConfig.isIntegration) {
    logger.trace({ ctx: msgCtx, leaseId }, 'Skipping fetching of signed documents for integration tests.');
    return { processed: true };
  }

  if (await documentsAlreadyFetched(msgCtx, leaseId)) {
    logger.trace({ ctx: msgCtx, leaseId }, 'Signed documents were already fetched.');
    return { processed: true };
  }

  try {
    const lease = await getLeaseById(msgCtx, leaseId);
    const leaseFolder = path.join(path.resolve(config.aws.efsRootFolder), tenantId, 'signedLeases', 'tmp', leaseId);
    await mkdirp(leaseFolder);

    const leaseFiles = await saveSignedDocumentsToTemp(msgCtx, leaseId, leaseFolder);
    const files = leaseFiles.sort(file => (file.isForGuarantor ? 1 : -1)).map(file => file.filepath);

    let docBuffer;
    if (!files.length) {
      // the current case for this is wet-signed leases (which currently do not have pdfs, but could in the
      // future fetching the signed wet-documents).  Any other case in which
      // lease document fetch fails are expected to throw an exception
      logger.trace({ ctx: msgCtx, leaseId }, 'no lease documents available');
      return { processed: true };
    }
    if (files.length > 1) {
      logger.trace({ tenantId, leaseId, files, leaseFolder }, 'merging lease documents');
      docBuffer = await pdfMerge(files);
      logger.trace({ ctx: msgCtx, leaseId, length: docBuffer.length }, 'lease documents merged');
    } else {
      docBuffer = leaseFiles[0].docBuffer;
    }

    const uploadFileName = await getNameForExportedLease(msgCtx, lease);
    const filepath = path.join(leaseFolder, uploadFileName);
    await write(filepath, docBuffer, 'binary');
    logger.trace({ ctx: msgCtx, leaseId, filepath }, 'merged lease document saved to EFS');

    const { key, docId } = await uploadToS3(msgCtx, leaseId, docBuffer);

    const metadata = {
      path: key,
      uploadFileName,
      leaseId,
      envelopeIds: [...new Set(leaseFiles.map(doc => doc.envelopeId))],
      documentNames: leaseFiles.map(doc => doc.name),
    };
    const doc = await createDocument(msgCtx, docId, metadata);
    logger.trace({ ctx: msgCtx, leaseId, doc }, 'leases document saved');

    const {
      settings: { features },
    } = await getTenant(msgCtx);

    if (features && features.exportLeaseViaFtp) {
      logger.trace({ ctx: msgCtx, leaseId, filepath }, 'exporting to FTP merged lease document');
      await sendMessage({
        exchange: APP_EXCHANGE,
        key: EXPORT_MESSAGE_TYPE.SIGNED_LEASE_DOCUMENT,
        message: { tenantId, filepath, uploadFileName, leaseId, leaseFolder },
        ctx: { tenantId },
      });
    } else {
      logger.warn({ ctx: msgCtx, leaseId, filepath }, 'exporting signed lease to FTP is disabled');
    }
  } catch (error) {
    logger.error({ ctx: msgCtx, leaseId, error }, 'Failed to fetch signed documents');
    return { processed: false };
  }

  logger.trace({ ctx: msgCtx, leaseId }, 'Signed Documents fetching processed');
  return { processed: true };
};

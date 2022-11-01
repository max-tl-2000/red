/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uuid from 'uuid/v4';
import loggerInstance from '../../../common/helpers/logger';

import { uploadBase64Image } from '../../../server/workers/upload/uploadAssetsHandler';
import { ServiceError } from '../../../server/common/errors';
import { getLeaseInfoForPerson } from '../dal/lease-repo';
import { getPaymentProviderSettingsByPropertyId } from '../dal/property-repo';
import { getPaymentProvider } from '../helpers/paymentHelpers';
import { revaAttachmentsString } from '../payment-providers/constants';
import { getResidentState } from '../helpers/resident';
import { ResidentPropertyState } from '../../../common/enums/residentPropertyStates';

const logger = loggerInstance.child({ subType: 'Resident - MaintenanceService' });

let getGetLeaseInfoForPersonFunc = getLeaseInfoForPerson;
const getGetLeaseInfoForPersonFunction = () => getGetLeaseInfoForPersonFunc;
export const setGetLeaseInfoForPersonFunction = func => (getGetLeaseInfoForPersonFunc = func);
export const resetGetLeaseInfoForPersonFunction = () => (getGetLeaseInfoForPersonFunc = getLeaseInfoForPerson);

const allowOnlyCurrentResidentOnInventoryId = async (ctx, personId, propertyId, inventoryId) => {
  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);
  const currentLease = leaseInfoList.find(l => l.inventoryId === inventoryId);
  const residentState = getResidentState(currentLease);
  if (residentState !== ResidentPropertyState.CURRENT) {
    logger.trace({ ctx, personId, propertyId, inventoryId }, 'action allowed only for current resident on unit');
    throw new ServiceError({ token: 'RESIDENT_NOT_AUTHORIZED', status: 403 });
  }
};

const appendAttachmentsToDescription = (attachmentUrls, description) => {
  const urls = attachmentUrls.reduce((finalString, attachmentUrl) => `${finalString + attachmentUrl.url}\n`, '');

  return `${description}\n${revaAttachmentsString}\n${urls}`;
};

export const createMaintenanceTicket = async (ctx, { propertyId, personId, maintenanceRequest }) => {
  const maintenanceRequestForLogging = {
    ...maintenanceRequest,
    attachments: maintenanceRequest.attachments.map(a => ({ ...a, contentData: a.contentData.slice(0, 100) })),
  };

  logger.trace({ ctx, personId, propertyId, maintenanceRequest: maintenanceRequestForLogging }, 'createMaintenanceTicket started!');
  const { inventoryId, attachments, description } = maintenanceRequest;

  await allowOnlyCurrentResidentOnInventoryId(ctx, personId, propertyId, inventoryId);

  try {
    let attachmentUrls;
    if (attachments?.length) {
      const attachmentsInfo = attachments.map(a => a.metadata);

      logger.info({ ctx, attachmentsInfo }, 'Uploading maintenance attachments');

      attachmentUrls = await Promise.all(
        attachments.map(async attachment => ({
          metadata: attachment.metadata,
          url: await uploadBase64Image(ctx, {
            base64Data: attachment.contentData,
            metadata: attachment.metadata,
            key: uuid(),
          }),
        })),
      );

      maintenanceRequest.description = appendAttachmentsToDescription(attachmentUrls, description);

      logger.info({ ctx, attachmentUrls }, 'Uploaded maintenance attachments successfully');
    }

    const paymentProvider = await getPaymentProvider(ctx);
    const leaseInfoList = await getLeaseInfoForPerson(ctx, personId, propertyId);
    // TODO: temporary solution until the correct leasInfo/integrationId selection is implemented
    const leaseInfo = leaseInfoList.filter(l => l.inventoryId === inventoryId)[0];

    return await paymentProvider.createMaintenanceRequest(ctx, leaseInfo, maintenanceRequest);
  } catch (error) {
    logger.error({ ctx, error, maintenanceRequest }, 'failed to create maintenance ticket');
    throw new ServiceError({ token: 'CREATE_MAINTENANCE_TICKET_ERROR', status: 500 });
  }
};

export const getMaintenanceInfo = async (ctx, { propertyId, personId, commonUserId, testDataUnits }) => {
  logger.trace({ ctx, personId, commonUserId, propertyId }, 'getMaintenanceInfo started!');
  const leaseInfoList = await getGetLeaseInfoForPersonFunction()(ctx, personId, propertyId);

  const paymentProvider = await getPaymentProvider(ctx, testDataUnits);
  return await paymentProvider.getMaintenanceInformation(ctx, leaseInfoList);
};

export const getAptexxMaintenanceTypes = async (ctx, { clientId, accountId }) => {
  if (!clientId || !accountId) {
    logger.error({ ctx }, 'getAptexxMaintenanceTypes - Missing required params');
    throw new ServiceError({ token: 'MISSING_REQUIRED_PARAMS', status: 400 });
  }

  logger.trace({ ctx, clientId, accountId }, 'getAptexxMaintenanceTypes started!');

  const paymentProvider = await getPaymentProvider(ctx);
  return await paymentProvider.getMaintenanceTypes(ctx, { clientId, accountId });
};

export const getMaintenanceTypes = async (ctx, { propertyId }) => {
  logger.trace({ ctx, propertyId }, 'getMaintenanceTypes started!');

  const { aptexx = {} } = await getPaymentProviderSettingsByPropertyId(ctx, propertyId);
  if (!aptexx.maintenanceTypes) {
    throw new ServiceError({ token: 'MAINTENANCE_TYPES_NOT_AVAILABLE' });
  }

  return aptexx.maintenanceTypes;
};

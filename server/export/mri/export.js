/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';
import sleep from '../../../common/helpers/sleep';
import { DALTypes } from '../../../common/enums/DALTypes';
import { archiveExternalInfo } from '../../services/externalPartyMemberInfo';
import { getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { NoRetryError } from '../../common/errors';
import { isPrimaryTenantAResidentInMRI } from './mriIntegration';

import { createResidentialInteractionsMapper } from './mappers/residentialInteractions';
import { createApplicationPaymentMapper } from './mappers/applicationPayment';
import { createApplicationDepositPaymentMapper } from './mappers/applicationDepositPayment';
import { createSelectUnitMapper } from './mappers/selectUnit';
import { createRentDetailsMapper } from './mappers/rentDetails';
import { createRentableItemsAndFeesMapper } from './mappers/rentableItemsAndFees';
import { createAcceptLeaseMapper } from './mappers/acceptLease';
import { createAssignItemsMapper } from './mappers/assignItems';
import { createConfirmLeaseMapper } from './mappers/confirmLease';
import { createVoidLeaseMapper } from './mappers/voidLease';
import { createRenewalOfferMapper } from './mappers/renewalOffer';
import { createAcceptRenewalOfferMapper } from './mappers/acceptRenewalOffer';
import { createCancelRenewalOfferMapper } from './mappers/cancelRenewalOffer';
import { createClearSelectedUnitMapper } from './mappers/clearSelectedUnit';

import { ApiProviders } from '../../helpers/mriIntegration';
import {
  exportGuestCard,
  exportCoOccupants,
  removeCoResident,
  exportPets,
  exportVehicles,
  exportGeneric,
  exportRentables,
  executeAssignItems,
  confirmLease,
  renewalOffer,
} from './mriExporters';

import { isCorporateParty } from '../../../common/helpers/party-utils';
import loggerModule from '../../../common/helpers/logger';
import { deleteMriExportQueueMessageById, getOldestExportMessageByPartyId, updateMRIExportQueueMessageById } from '../../dal/mri-export-repo';
const logger = loggerModule.child({ subType: 'export/mri' });

export const ExportType = {
  GuestCard: {
    fileType: DALTypes.MriExportTypes.GUEST_CARD,
  },
  CoOccupants: {
    fileType: DALTypes.MriExportTypes.CO_OCCUPANTS,
  },
  RemoveCoresident: {
    fileType: DALTypes.MriExportTypes.REMOVE_CORESIDENT,
  },
  ResidentialInteractions: {
    fileType: DALTypes.MriExportTypes.RESIDENTIAL_INTERACTIONS,
  },
  ApplicationPayment: {
    fileType: DALTypes.MriExportTypes.APPLICATION_PAYMENT,
    apiProvider: ApiProviders.MRI_API,
    requestTemplate: 'application-payment-request-template.xml',
    mapper: createApplicationPaymentMapper,
  },
  ApplicationDepositPayment: {
    fileType: DALTypes.MriExportTypes.APPLICATION_DEPOSIT_PAYMENT,
    apiProvider: ApiProviders.MRI_API,
    requestTemplate: 'application-payment-request-template.xml',
    mapper: createApplicationPaymentMapper,
  },
  PetInformation: {
    fileType: DALTypes.MriExportTypes.PET_INFORMATION,
  },
  VehicleInformation: {
    fileType: DALTypes.MriExportTypes.VEHICLE_INFORMATION,
  },
  SelectUnit: {
    fileType: DALTypes.MriExportTypes.SELECT_UNIT,
  },
  RentDetails: {
    fileType: DALTypes.MriExportTypes.RENT_DETAILS,
  },
  RentableItemsAndFees: {
    fileType: DALTypes.MriExportTypes.RENTABLE_ITEMS_AND_FEES,
  },
  AcceptLease: {
    fileType: DALTypes.MriExportTypes.ACCEPT_LEASE,
  },
  ConfirmLease: {
    fileType: DALTypes.MriExportTypes.CONFIRM_LEASE,
  },
  AssignItems: {
    fileType: DALTypes.MriExportTypes.ASSIGN_ITEMS,
  },
  VoidLease: {
    fileType: DALTypes.MriExportTypes.VOID_LEASE,
  },
  RenewalOffer: {
    fileType: DALTypes.MriExportTypes.RENEWAL_OFFER,
  },
  AcceptRenewalOffer: {
    fileType: DALTypes.MriExportTypes.ACCEPT_RENEWAL_OFFER,
  },
  CancelRenewalOffer: {
    fileType: DALTypes.MriExportTypes.CANCEL_RENEWAL_OFFER,
  },
  ClearSelectedUnit: {
    fileType: DALTypes.MriExportTypes.CLEAR_SELECTED_UNIT,
  },
};

const getDataToLog = (ctx, error, data) => ({
  ctx,
  error,
  data: {
    partyId: data.party?.id,
    externalId: data.externalInfo?.externalId,
    primaryMemberName: data.primaryTenant?.fullName,
  },
});

const handleSelectUnitError = async (ctx, error, data) => {
  const alreadyAssignedErrorMsg = 'The selected prospect is already assigned to the given Unit';
  const occupyDatePriorToUnitAvailabilityDateError = 'is prior to the Unit available date';
  const selectedUnitNotAvailable = 'The selected unit is not currently available';
  const leaseTermNotAvailableForUnit = 'The specified lease term is not available for the selected unit';

  const dataToLog = getDataToLog(ctx, error, data);

  if (error.message.includes(alreadyAssignedErrorMsg)) {
    logger.warn(dataToLog, 'Export MRI - prospect already assigned error -> SelectUnit step skipped');
  } else if (error.message.includes(occupyDatePriorToUnitAvailabilityDateError)) {
    logger.error(dataToLog, 'Export MRI - occupy date is prior to the unit available date');
    throw new NoRetryError(`Export MRI - SelectUnit failed because occupy date is prior to the unit available date: ${JSON.stringify(dataToLog)}`);
  } else if (error.message.includes(selectedUnitNotAvailable)) {
    logger.error(dataToLog, 'Export MRI - selected unit is not available');
    throw new NoRetryError(`Export MRI - SelectUnit failed because the selected unit is not available: ${JSON.stringify(dataToLog)}`);
  } else if (error.message.includes(leaseTermNotAvailableForUnit)) {
    logger.error(dataToLog, 'Export MRI - lease term is not available for the selected unit');
    throw new NoRetryError(`Export MRI - SelectUnit failed because the lease term is not available for the selected unit: ${JSON.stringify(dataToLog)}`);
  } else {
    logger.info(dataToLog, 'Export MRI - other error in SelectUnit - will sleep 4 minutes and then retry');
    await sleep(4 * 60000);
    logger.info(dataToLog, 'Export MRI - back from sleeping after error');
    throw error;
  }
};

const handleConfirmLeaseError = async (ctx, error, data) => {
  const moveinAlreadyScheduledErrorMsg = 'Movein already scheduled';

  const dataToLog = getDataToLog(ctx, error, data);

  if (error.message.includes(moveinAlreadyScheduledErrorMsg)) {
    logger.warn(dataToLog, 'Export MRI - movein already scheduled in MRI -> ConfirmLease step skipped');
  } else {
    // TODO: don't do this in integration tests, as the error cause will not be clear
    logger.info(dataToLog, 'Export MRI - other error in SelectUnit - will sleep 4 minutes and then retry');
    await sleep(4 * 60000);
    logger.info(dataToLog, 'Export MRI - back from sleeping after error');
    throw error;
  }
};

const processStepByFileType = async (ctx, { fileType, msgCtx, data, partyMember }) => {
  switch (fileType) {
    case DALTypes.MriExportTypes.GUEST_CARD:
      await exportGuestCard(msgCtx, data, partyMember);
      break;
    case DALTypes.MriExportTypes.CO_OCCUPANTS:
      await exportCoOccupants(msgCtx, data, partyMember);
      break;
    case DALTypes.MriExportTypes.REMOVE_CORESIDENT:
      await removeCoResident(msgCtx, data, partyMember);
      break;
    case DALTypes.MriExportTypes.RESIDENTIAL_INTERACTIONS:
      await exportGeneric(msgCtx, data, {
        apiType: 'MRI_S-PMRM_ResidentialInteractionsByNameID',
        mapper: createResidentialInteractionsMapper,
        requestTemplate: 'residential-interactions-request-template.xml',
      });
      break;
    case DALTypes.MriExportTypes.APPLICATION_PAYMENT:
      await exportGeneric(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'Payment',
        mapper: createApplicationPaymentMapper,
        requestTemplate: 'application-payment-request-template.xml',
      });
      break;
    case DALTypes.MriExportTypes.APPLICATION_DEPOSIT_PAYMENT:
      await exportGeneric(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'Payment',
        mapper: createApplicationDepositPaymentMapper,
        requestTemplate: 'application-payment-request-template.xml',
      });
      break;
    case DALTypes.MriExportTypes.PET_INFORMATION:
      await exportPets(msgCtx, data);
      break;
    case DALTypes.MriExportTypes.VEHICLE_INFORMATION:
      await exportVehicles(msgCtx, data);
      break;
    case DALTypes.MriExportTypes.SELECT_UNIT:
      try {
        await exportGeneric(msgCtx, data, {
          apiType: 'MRI_S-PMRM_SelectUnit',
          mapper: createSelectUnitMapper,
          requestTemplate: 'select-unit-request-template.xml',
        });
      } catch (e) {
        await handleSelectUnitError(msgCtx, e, data);
      }
      break;
    case DALTypes.MriExportTypes.RENT_DETAILS:
      await exportGeneric(msgCtx, data, {
        apiType: 'MRI_S-PMRM_ModifyRentDetails',
        mapper: createRentDetailsMapper,
        requestTemplate: 'rent-details-request-template.xml',
        queryParams: { NAMEID: data.externalInfo.externalId },
      });
      break;
    case DALTypes.MriExportTypes.RENTABLE_ITEMS_AND_FEES:
      await exportRentables(msgCtx, data, {
        apiType: 'MRI_S-PMRM_ModifyRentableItemsAndFees',
        mapper: createRentableItemsAndFeesMapper,
        requestTemplate: 'rentables-request-template.xml',
      });
      break;
    case DALTypes.MriExportTypes.ACCEPT_LEASE:
      await exportGeneric(msgCtx, data, {
        apiType: 'MRI_S-PMRM_AcceptLease',
        mapper: createAcceptLeaseMapper,
        requestTemplate: 'accept-lease-request-template.xml',
      });
      break;
    case DALTypes.MriExportTypes.CONFIRM_LEASE:
      try {
        await confirmLease(msgCtx, data, {
          apiProvider: ApiProviders.MRI_API,
          apiType: 'ConfirmLease',
          requestTemplate: 'confirm-lease-request-template.xml',
          mapper: createConfirmLeaseMapper,
        });
      } catch (e) {
        await handleConfirmLeaseError(msgCtx, e, data);
      }
      break;
    case DALTypes.MriExportTypes.RENEWAL_OFFER:
      await renewalOffer(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'RenewalOffer',
        requestTemplate: 'renewal-offer-request-template.xml',
        mapper: createRenewalOfferMapper,
      });
      break;
    case DALTypes.MriExportTypes.ACCEPT_RENEWAL_OFFER:
      await exportGeneric(msgCtx, data, {
        apiType: 'MRI_S-PMRM_AcceptRenewalOffer',
        requestTemplate: 'accept-renewal-offer-request-template.xml',
        mapper: createAcceptRenewalOfferMapper,
        isUpdate: true,
      });
      break;
    case DALTypes.MriExportTypes.CANCEL_RENEWAL_OFFER:
      await exportGeneric(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'CancelRenewalOffer',
        requestTemplate: 'cancel-renewal-offer-request-template.xml',
        mapper: createCancelRenewalOfferMapper,
      });
      break;
    case DALTypes.MriExportTypes.ASSIGN_ITEMS:
      await executeAssignItems(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'AssignItems',
        requestTemplate: 'assign-items-request-template.xml',
        mapper: createAssignItemsMapper,
      });
      break;
    case DALTypes.MriExportTypes.VOID_LEASE:
      await exportGeneric(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'VoidLease',
        requestTemplate: 'void-lease-request-template.xml',
        mapper: createVoidLeaseMapper,
      });
      if (data.party.leaseType === DALTypes.PartyTypes.CORPORATE && data.externalInfo.id) {
        await archiveExternalInfo(ctx, data.externalInfo);
      }
      break;
    case DALTypes.MriExportTypes.CLEAR_SELECTED_UNIT:
      await exportGeneric(msgCtx, data, {
        apiProvider: ApiProviders.MRI_API,
        apiType: 'ClearSelectedUnit',
        requestTemplate: 'clear-selected-unit-request-template.xml',
        mapper: createClearSelectedUnitMapper,
      });
      break;
    default:
      throw new Error(`Invalid MRI export type: ${fileType}`);
  }
};

const getNextStep = steps => steps.find(x => !x.done);

const markStepAsDone = async (ctx, { index, messageId, data, exportSteps }) => {
  exportSteps.find(e => e.index === index).done = true;
  await updateMRIExportQueueMessageById(ctx, messageId, { exportData: { data, exportSteps } });
};

export const exportToMri = async payload => {
  let primaryTenantInResidentState;

  const { partyId, msgCtx: ctx } = payload;
  const messageToProcess = await getOldestExportMessageByPartyId(ctx, partyId);

  if (!messageToProcess) {
    logger.info({ ctx, partyId }, 'Export MRI - all messages for this party are completed');
    return { processed: true };
  }

  const {
    exportData: { exportSteps, data, mriExportAction, sessionStartTime },
  } = messageToProcess;
  const msgCtx = { ...ctx, sessionStartTime };

  if (
    [DALTypes.MriExportAction.APPLICATION_PAYMENT, DALTypes.MriExportAction.HOLD_INVENTORY].includes(mriExportAction) ||
    (mriExportAction === DALTypes.MriExportAction.SIGN_LEASE && data.workflowName !== DALTypes.WorkflowName.RENEWAL)
  ) {
    primaryTenantInResidentState = await isPrimaryTenantAResidentInMRI(ctx, data);
  }

  if (!primaryTenantInResidentState) {
    logger.info({ ctx: msgCtx, partyId, exportSteps }, 'Export MRI - processing export types');
    let nextStep = getNextStep(exportSteps);
    while (nextStep) {
      const { index, fileType, partyMember } = nextStep || {};
      try {
        logger.info({ ctx: msgCtx, currentStep: fileType, ...pick(data, ['partyMember', 'primaryTenant']) }, 'Export MRI - current step');

        const leaseId = isCorporateParty(data.party) ? (data.lease || {}).id : null;
        const externals = await getAllExternalInfoByPartyForMRI(msgCtx, data.party.id, data.property.id, leaseId);
        data.externals = externals;

        await processStepByFileType(ctx, { fileType, msgCtx, data, partyMember });
        await markStepAsDone(ctx, { index, messageId: messageToProcess.id, exportSteps, data });
        nextStep = getNextStep(exportSteps);
      } catch (error) {
        logger.error({ ctx: msgCtx, error, currentStep: fileType, exportSteps }, 'Export MRI - error');
        await updateMRIExportQueueMessageById(ctx, messageToProcess.id, {
          status: DALTypes.MRIExportQueueStatus.ERROR,
          response: { messsage: error.message, stack: error.stack, code: error.code },
          count: messageToProcess.count + 1,
        });
        throw error;
      }
    }
  } else {
    logger.info({ ctx: msgCtx, partyId, exportSteps, mriExportAction }, 'Export MRI - skipping export, primary tenant is already a resident in MRI');
  }

  logger.info({ ctx: msgCtx, exportSteps }, 'Export MRI - all steps are completed');
  await deleteMriExportQueueMessageById(ctx, messageToProcess.id);
  return await exportToMri(payload);
};

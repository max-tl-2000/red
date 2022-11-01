/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import pick from 'lodash/pick';

import { ExportType } from './export';
import { getExternalIdsForUser } from '../../services/users';
import { getAllExternalInfoByPartyForMRI } from '../../dal/exportRepo';
import { completedAppointmentsWithInventory } from '../../helpers/party';
import { getPartyData, getCompanyName, isPartyInApplicantState, getAppointmentInventory } from '../common-export-utils';
import { getExternalInfo, generateGuestCardsExportSteps, addIndex, processExportMessage } from './mri-export-utils';
import { isPrimaryTenantAResidentInMRI } from './mriIntegration';

import { shouldExportExternalUniqueId } from '../helpers';

import loggerModule from '../../../common/helpers/logger';
import { DALTypes } from '../../../common/enums/DALTypes';
const logger = loggerModule.child({ subType: 'export/mri' });

export const getData = async (ctx, partyDocument, appointment) => {
  const partyData = await getPartyData(ctx, partyDocument);
  const { primaryTenant, externalInfo, party } = await getExternalInfo(ctx, partyDocument);
  const externals = await getAllExternalInfoByPartyForMRI(ctx, partyDocument.id, partyDocument.assignedPropertyId);
  const companyName = getCompanyName(partyDocument, primaryTenant.id);

  const externalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, partyDocument.userId);

  const tourAgentExternalIds = await getExternalIdsForUser(ctx, partyDocument.ownerTeam, appointment.userIds[0]);

  const shouldExportExternalUniqueIdForAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, partyDocument.userId);
  const shouldExportExternalUniqueIdForTourAgent = await shouldExportExternalUniqueId(ctx, partyDocument.ownerTeam, appointment.userIds[0]);

  const inventoryId = appointment.metadata.inventories[0];

  const partyShouldBeExportedAsApplicant = isPartyInApplicantState(partyDocument.invoices);

  return {
    tenantId: ctx.tenantId,
    primaryTenant,
    ...partyData,
    party,
    companyName,
    appointment: {
      metadata: pick(appointment.metadata, ['endDate']),
    },
    appointmentInventory: await getAppointmentInventory(ctx, { inventoryId }, partyData),
    userExternalUniqueId: externalIds.externalUniqueId,
    teamMemberExternalId: externalIds.externalId,
    tourAgentUserExternalId: tourAgentExternalIds.externalUniqueId,
    tourAgentTeamMemberExternalId: tourAgentExternalIds.externalId,
    shouldExportExternalUniqueIdForAgent,
    shouldExportExternalUniqueIdForTourAgent,
    externalInfo,
    externals,
    partyShouldBeExportedAsApplicant,
  };
};

export const exportMriAppointmentCompleted = async (ctx, partyDocument, exportEvent, extraPayload) => {
  try {
    let exportSteps;

    const partyId = partyDocument && partyDocument.id;
    const { appointmentId } = exportEvent.metadata;

    const appointments = completedAppointmentsWithInventory(partyDocument.tasks || []);

    if (appointments.length !== 1) {
      logger.trace({ ctx, partyId, appointmentId, exportEvent }, 'Not the first completed tour with an inventory, skipping export');
      return;
    }

    logger.info({ ctx, partyId, appointmentId, exportEvent }, 'Export to MRI - starting export on the first tour completed');

    const appointment = appointments.find(a => a.id === appointmentId);
    if (!appointment) {
      logger.trace({ ctx, partyId, appointmentId, exportEvent }, 'Appointment is not completed or does not have an inventory, skipping export');
      return;
    }

    const data = await getData(ctx, partyDocument, appointment);
    const primaryTenantInResidentState = await isPrimaryTenantAResidentInMRI(ctx, data);

    // In the case the party is already in a resident state in MRI, we skip guest card exports.
    if (primaryTenantInResidentState) {
      logger.trace({ ctx, partyId, appointmentId, exportEvent }, 'Primary tenant is already a resident in MRI, we will only export the appointment completion');

      exportSteps = addIndex([ExportType.ResidentialInteractions]);
    } else {
      const guestCardSteps = await generateGuestCardsExportSteps(ctx, partyDocument, data);
      exportSteps = addIndex([...guestCardSteps, ExportType.ResidentialInteractions]);
    }

    await processExportMessage(ctx, {
      partyId,
      data,
      exportSteps,
      extraPayload,
      mriExportAction: DALTypes.MriExportAction.FIRST_APPOINTMENT_COMPLETED,
    });
  } catch (error) {
    logger.error({ ctx, error, partyId: partyDocument.id }, 'Export MRI - on the first appointment completed - error');
    throw error;
  }
};

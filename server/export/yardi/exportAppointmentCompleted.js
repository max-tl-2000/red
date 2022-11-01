/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getPartyData, getCompanyName } from '../common-export-utils';
import { isExportEnabled, exportData, ExportType } from './export';
import { getExecutedLease, getQuoteForLease, getComms, getInventoryToExport } from './dataGathering';
import { computeExternalInfo, getApplicationByPersonId } from './helpers';
import { DALTypes } from '../../../common/enums/DALTypes';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'export' });

export const exportOnAppointmentCompleted = async (ctx, partyDocument, exportEvent) => {
  try {
    if (!(await isExportEnabled(ctx))) return;

    const partyId = partyDocument && partyDocument.id;
    const { appointmentId } = exportEvent.metadata;

    const appointments = (partyDocument.tasks || []).filter(
      task => task.name === DALTypes.TaskNames.APPOINTMENT && task.state === DALTypes.TaskStates.COMPLETED,
    );
    if (appointments.length !== 1) {
      logger.trace({ ctx, partyId, appointmentId, exportEvent }, 'Not the first completed tour, skipping export');
      return;
    }

    logger.info({ ctx, partyId, appointmentId, exportEvent }, 'Exporting party on appointment completed');

    const partyData = await getPartyData(ctx, partyDocument);
    const { inventory, quotePromotion } = await getInventoryToExport(ctx, partyDocument, { partyData });
    const { party, primaryTenant, externalInfo } = await computeExternalInfo(ctx, { partyDocument, inventory });

    const application = getApplicationByPersonId(partyDocument, primaryTenant.personId);
    const invoice = application && partyDocument.invoices?.find(inv => inv.personApplicationId === application?.id);

    const lease = getExecutedLease(partyDocument);
    const quote = getQuoteForLease(partyDocument, lease);

    const leaseTerm = quote && quote.publishedQuoteData.leaseTerms.find(lt => lt.id === lease.leaseTermId);

    const { primaryTenantComms, firstShowDate } = await getComms(ctx, partyDocument, primaryTenant);
    const companyName = getCompanyName(partyDocument, primaryTenant.id);

    const data = {
      tenantId: ctx.tenantId,
      party,
      ...partyData,
      primaryTenantComms,
      firstShowDate,
      quotePromotion,
      application,
      lease,
      leaseTerm,
      invoice,
      inventory,
      partyMember: primaryTenant,
      companyName,
      externalInfo,
    };
    const exportTypes = [ExportType.ResProspects];
    const exportLogs = await exportData(ctx, exportTypes, data);

    logger.info({ ctx, partyId, exportLogs, exportEvent }, 'Exporting party on appointment completed - success');
  } catch (error) {
    logger.error({ ctx, partyId: partyDocument.id, error, exportEvent }, 'Exporting party on appointment completed - error');
    throw error;
  }
};

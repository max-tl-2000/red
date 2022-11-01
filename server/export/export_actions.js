/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import get from 'lodash/get';
import logger from '../../common/helpers/logger';
import { now } from '../../common/helpers/moment-utils';
import { DALTypes } from '../../common/enums/DALTypes';
import { exportOnPartyClosed } from './yardi/exportPartyClosed';
import { exportOnAppointmentCompleted } from './yardi/exportAppointmentCompleted';
import { exportOnApplicationPaid } from './yardi/exportApplicationPaid';
import { exportOnApplicationFeeRefunded } from './yardi/exportApplicationFeeRefunded';
import { exportOnPartyMerged } from './yardi/exportPartyMerged';
import { exportOnManuallyUnitHeld } from './yardi/exportManuallyUnitHeld';
import { exportOnUnitReleased } from './yardi/exportUnitReleased';
import { exportOnLeaseSigned } from './yardi/exportLeaseSigned';
import { exportOnLeaseVoided } from './yardi/exportLeaseVoided';
import { runExportOneToManys } from './yardi/exportOneToManys';
import { exportOnReassignedProperty } from './yardi/exportReassignedProperty';

import { getTenant } from '../services/tenantService';

import { exportMriAppointmentCompleted } from './mri/exportMriAppointmentCompleted';
import { exportMriApplicationPayment } from './mri/exportMriApplicationPayment';
import { exportMriSignedLease } from './mri/exportMriSignedLease';
import { exportMriVoidedLease } from './mri/exportMriVoidedLease';
import { exportMriUnitHeld, exportMriUnitReleased } from './mri/exportMriUnitHeld';
import { exportMriEditedLease } from './mri/exportMRIEditedLease';

import { getPropertyById } from '../dal/propertyRepo';

const handleEvents = async (req, partyDocument, eventsMapping, partyEvents, extraPayload) =>
  await mapSeries(partyEvents, async partyEvent => {
    logger.trace({ ctx: req, partyId: partyDocument.id, documentVersion: partyDocument.version, partyEvent }, 'export handleEvents');

    const func = eventsMapping[partyEvent.event];
    if (!func) return Promise.resolve();

    return await func(req, partyDocument, partyEvent, extraPayload);
  });

const handleYardiExport = async req => {
  const documentVersion = req.body.version;
  const partyDocument = req.body;
  logger.trace({ ctx: req, partyId: partyDocument.id, documentVersion }, 'handleYardiExport');

  const partyEvents = partyDocument.events;

  if (!partyEvents || !partyEvents.length) {
    logger.warn({ ctx: req, partyId: partyDocument.id, documentVersion }, 'no PartyEvents were found for this document.');
    return 200;
  }

  const eventsMapping = {
    [DALTypes.PartyEventType.PARTY_CLOSED]: exportOnPartyClosed,
    [DALTypes.PartyEventType.APPOINTMENT_COMPLETED]: exportOnAppointmentCompleted,
    [DALTypes.PartyEventType.PARTY_MERGED]: exportOnPartyMerged,
    [DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED]: exportOnApplicationPaid,
    [DALTypes.PartyEventType.APPLICATION_TRANSACTION_UPDATED]: exportOnApplicationFeeRefunded,
    [DALTypes.PartyEventType.UNIT_HELD]: exportOnManuallyUnitHeld,
    [DALTypes.PartyEventType.UNIT_RELEASED]: exportOnUnitReleased,
    [DALTypes.PartyEventType.LEASE_SIGNED]: exportOnLeaseSigned,
    [DALTypes.PartyEventType.LEASE_VOIDED]: exportOnLeaseVoided,
    [DALTypes.PartyEventType.PARTY_REASSIGNED_PROPERTY]: exportOnReassignedProperty,
  };

  await handleEvents(req, partyDocument, eventsMapping, partyEvents);

  return 200;
};

export const handleExportOneToManys = async req => await runExportOneToManys(req);

const handleMRIExport = async req => {
  const documentVersion = req.body.version;
  const partyDocument = req.body;
  logger.trace({ ctx: req, partyId: partyDocument.id, documentVersion }, 'handleMRIExport');

  const partyEvents = partyDocument.events;

  if (!partyEvents || !partyEvents.length) {
    logger.warn({ ctx: req, partyId: partyDocument.id, documentVersion }, 'no PartyEvents were found for this document.');
    return 200;
  }

  const eventsMapping = {
    [DALTypes.PartyEventType.APPOINTMENT_COMPLETED]: exportMriAppointmentCompleted,
    [DALTypes.PartyEventType.APPLICATION_PAYMENT_PROCESSED]: exportMriApplicationPayment,
    [DALTypes.PartyEventType.LEASE_SIGNED]: exportMriSignedLease,
    [DALTypes.PartyEventType.LEASE_VOIDED]: exportMriVoidedLease,
    [DALTypes.PartyEventType.LEASE_VERSION_CREATED]: exportMriEditedLease,
    [DALTypes.PartyEventType.UNIT_HELD]: exportMriUnitHeld,
    [DALTypes.PartyEventType.UNIT_RELEASED]: exportMriUnitReleased,
  };

  const sessionStartTime = now();
  const ctx = { ...req, sessionStartTime };

  return await handleEvents(ctx, partyDocument, eventsMapping, partyEvents, { sessionStartTime });
};

const getTenantBackendMode = tenant => get(tenant, 'metadata.backendIntegration.name', DALTypes.BackendMode.NONE);

const shouldSkipExportToERP = tenant => (getTenantBackendMode(tenant) && get(tenant, 'metadata.backendIntegration.skipExportToERP', false)) || false;

const propertyHasExportEnabled = async req => {
  const partyDocument = req.body;

  const property = await getPropertyById({ tenantId: req.tenantId }, partyDocument.assignedPropertyId);
  const newLeaseExportEnabled = get(property, 'settings.integration.export.newLease');
  const renewalExportEnabled = get(property, 'settings.integration.export.renewalLease');

  // based on 'newLeaseExport - if this is off, it behaves like the MRI integration is turned off for the property.' from CPM-15273
  if (!newLeaseExportEnabled) return false;

  if (newLeaseExportEnabled && partyDocument.workflowName === DALTypes.WorkflowName.NEW_LEASE) return true;
  if (renewalExportEnabled && partyDocument.workflowName === DALTypes.WorkflowName.RENEWAL) return true;

  return false;
};

export const handleExport = async ctx => {
  const tenant = await getTenant(ctx);
  const backendMode = getTenantBackendMode(tenant);
  if (shouldSkipExportToERP(tenant)) return 404;
  if (!(await propertyHasExportEnabled(ctx))) {
    return 404;
  }

  switch (backendMode) {
    case DALTypes.BackendMode.YARDI:
      return await handleYardiExport(ctx);
    case DALTypes.BackendMode.MRI:
      return await handleMRIExport(ctx);
    case DALTypes.BackendMode.NONE:
    default:
      return 404;
  }
};

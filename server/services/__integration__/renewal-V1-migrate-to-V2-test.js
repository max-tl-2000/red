/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { createAPerson, createAUser, createAParty, createAPartyMember, createAProperty } from '../../testUtils/repoHelper';
import { DALTypes } from '../../../common/enums/DALTypes';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import { createActiveLeaseParty } from '../workflows';
import { linkRenewalV1ToActiveLease } from '../renewalV1Migration';
import { getPartyBy } from '../../dal/partyRepo';
import { saveIntegrationSetting } from '../../dal/propertyRepo';

describe('/renewal V1 migrate to V2', () => {
  let user;
  let person;
  let property;
  const ctx = { tenantId: tenant.id };

  const createNewLeaseParty = async (partyType = DALTypes.PartyTypes.TRADITIONAL) => {
    const newLeaseParty = await createAParty({
      userId: user.id,
      assignedPropertyId: property.id,
      workflowName: DALTypes.WorkflowName.NEW_LEASE,
      state: DALTypes.PartyStateType.RESIDENT,
      leaseType: partyType,
    });
    const newLeasePartyMember = await createAPartyMember(newLeaseParty.id, { personId: person.id });

    const activeLeaseParty = await createActiveLeaseParty(ctx, { seedPartyId: newLeaseParty.id });
    return { newLeaseParty, activeLeaseParty, newLeasePartyMember };
  };

  const createAnActiveLeaseParty = async partyGroupId => {
    const activeLeaseParty = await createAParty({
      userId: user.id,
      assignedPropertyId: property.id,
      workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
      state: DALTypes.PartyStateType.RESIDENT,
      partyGroupId,
      metadata: { isImported: true },
    });
    await createAPartyMember(activeLeaseParty.id, { personId: person.id });

    return activeLeaseParty;
  };

  const createInFlightRenewalV1 = async partyGroupId => {
    const renewalParty = await createAParty({
      userId: user.id,
      assignedPropertyId: property.id,
      workflowName: DALTypes.WorkflowName.RENEWAL,
      state: DALTypes.PartyStateType.PROSPECT,
      partyGroupId,
      metadata: { V1RenewalState: DALTypes.V1RenewalState.UNUSED },
    });
    const partyMember = await createAPartyMember(renewalParty.id, { personId: person.id });

    return { renewalParty, partyMember };
  };

  const createRenewalV1WithFutureStartDate = async partyGroupId => {
    const renewalParty = await createAParty({
      userId: user.id,
      assignedPropertyId: property.id,
      workflowName: DALTypes.WorkflowName.RENEWAL,
      state: DALTypes.PartyStateType.RESIDENT,
      partyGroupId,
      metadata: { V1RenewalState: DALTypes.V1RenewalState.UNUSED },
    });
    const partyMember = await createAPartyMember(renewalParty.id, { personId: person.id });

    return { renewalParty, partyMember };
  };

  const createResidentRenewalV1 = async partyGroupId => {
    const renewalParty = await createAParty({
      userId: user.id,
      assignedPropertyId: property.id,
      workflowName: DALTypes.WorkflowName.RENEWAL,
      state: DALTypes.PartyStateType.RESIDENT,
      partyGroupId,
      metadata: { V1RenewalState: DALTypes.V1RenewalState.RESIDENT_OR_FUTURE_RESIDENT },
    });
    await createAPartyMember(renewalParty.id, { personId: person.id });
    const activeLeaseParty = await createActiveLeaseParty(ctx, { seedPartyId: renewalParty.id });

    return { renewalParty, activeLeaseParty };
  };

  beforeEach(async () => {
    property = await createAProperty();
    person = await createAPerson();

    user = await createAUser();
  });

  describe('New Lease in resident state and an inflight renewal V1', () => {
    it('should set the seed party on inflight renewal and update V1renewalState in metadata', async () => {
      const { newLeaseParty, activeLeaseParty } = await createNewLeaseParty();
      const { renewalParty: inFlightRenewal } = await createInFlightRenewalV1(newLeaseParty.partyGroupId);
      await linkRenewalV1ToActiveLease(ctx);

      const renewalMigratedToV2 = await getPartyBy(ctx, { id: inFlightRenewal.id });
      expect(renewalMigratedToV2.seedPartyId).to.equal(activeLeaseParty.id);
      expect(renewalMigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
    });
  });

  describe('New Lease in future resident state, two renewal V1 in resident state and an in flight renewal V1', () => {
    it('should migrate to renewal V2 all renewals V1', async () => {
      const { newLeaseParty, activeLeaseParty } = await createNewLeaseParty();
      const { renewalParty: renewalResidentParty1, activeLeaseParty: activeLeaseRenewalParty1 } = await createResidentRenewalV1(newLeaseParty.partyGroupId);
      const { renewalParty: renewalResidentParty2, activeLeaseParty: activeLeaseRenewalParty2 } = await createResidentRenewalV1(newLeaseParty.partyGroupId);
      const { renewalParty: inFlightRenewal } = await createInFlightRenewalV1(newLeaseParty.partyGroupId);

      await linkRenewalV1ToActiveLease(ctx);

      const renewalResident1MigratedToV2 = await getPartyBy(ctx, { id: renewalResidentParty1.id });
      const renewalResident2MigratedToV2 = await getPartyBy(ctx, { id: renewalResidentParty2.id });
      const renewalInFlightMigratedToV2 = await getPartyBy(ctx, { id: inFlightRenewal.id });

      expect(renewalResident1MigratedToV2.seedPartyId).to.equal(activeLeaseParty.id);
      expect(renewalResident1MigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);

      expect(renewalResident2MigratedToV2.seedPartyId).to.equal(activeLeaseRenewalParty1.id);
      expect(renewalResident2MigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);

      expect(renewalInFlightMigratedToV2.seedPartyId).to.equal(activeLeaseRenewalParty2.id);
      expect(renewalInFlightMigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
    });
  });

  describe('An Active Lease that is resulted from import and an in flight Renewal', () => {
    it('should migrate to renewal V2 and use Active Lease as seed party', async () => {
      const { renewalParty: inFlightRenewal } = await createInFlightRenewalV1();
      const activeLeaseParty = await createAnActiveLeaseParty(inFlightRenewal.partyGroupId);

      await linkRenewalV1ToActiveLease(ctx);

      const renewalInFlightMigratedToV2 = await getPartyBy(ctx, { id: inFlightRenewal.id });

      expect(renewalInFlightMigratedToV2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
      expect(renewalInFlightMigratedToV2.seedPartyId).to.equal(activeLeaseParty.id);
    });
  });

  describe('An imported active lease and two renewals with start date in future', () => {
    it('should archive the first created renewal and migrate to V2 the second one', async () => {
      const { renewalParty: firsFutureStartDateRenewal } = await createRenewalV1WithFutureStartDate();
      const { renewalParty: secondFutureStartDateRenewal } = await createRenewalV1WithFutureStartDate(firsFutureStartDateRenewal.partyGroupId);
      const activeLeaseParty = await createAnActiveLeaseParty(firsFutureStartDateRenewal.partyGroupId);

      await linkRenewalV1ToActiveLease(ctx);

      const firstRenewal = await getPartyBy(ctx, { id: firsFutureStartDateRenewal.id });
      const secondRenewal = await getPartyBy(ctx, { id: secondFutureStartDateRenewal.id });

      expect(firstRenewal.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      expect(secondRenewal.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
      expect(secondRenewal.seedPartyId).to.equal(activeLeaseParty.id);
    });
  });

  describe('Just an in flight Renewal V1 without an imported active lease', () => {
    it('should not archive the renewal party if the property import resident data is not set to true', async () => {
      const { renewalParty: inFlightRenewal } = await createInFlightRenewalV1();

      await linkRenewalV1ToActiveLease(ctx);

      const updatedRenewal = await getPartyBy(ctx, { id: inFlightRenewal.id });

      expect(updatedRenewal.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
    });
    it('should archive the renewal party if the property import resident data is set to true', async () => {
      const { renewalParty: inFlightRenewal } = await createInFlightRenewalV1();
      await saveIntegrationSetting(ctx, property.id, { import: { residentData: true } });

      await linkRenewalV1ToActiveLease(ctx);

      const updatedRenewal = await getPartyBy(ctx, { id: inFlightRenewal.id });

      expect(updatedRenewal.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      expect(updatedRenewal.metadata.archiveReasonId).to.equal(DALTypes.ArchivePartyReasons.IN_FLIGHT_RENEWAL_V1_WITH_NO_RELATED_ACTIVE_LEASE);
    });
  });

  describe('A Renewal V1 in resident state with an Active Lease generated from it', () => {
    it('will not update the Renewal party', async () => {
      const { renewalParty, activeLeaseParty } = await createResidentRenewalV1();

      await linkRenewalV1ToActiveLease(ctx);

      const renewal = await getPartyBy(ctx, { id: renewalParty.id });
      const activeLease = await getPartyBy(ctx, { id: activeLeaseParty.id });

      expect(renewal.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.FIRST_PARTY_IS_RENEWAL);
      expect(activeLease).to.deep.equal(activeLeaseParty);
    });
  });

  describe('Two Renewal V1 parties in resident state', () => {
    it('will migrate the second Renewal to V2', async () => {
      const { renewalParty: renewalParty1, activeLeaseParty: activeLeaseParty1 } = await createResidentRenewalV1();
      const { renewalParty: renewalParty2, activeLeaseParty: activeLeaseParty2 } = await createResidentRenewalV1(renewalParty1.partyGroupId);

      await linkRenewalV1ToActiveLease(ctx);

      const renewal1 = await getPartyBy(ctx, { id: renewalParty1.id });
      const activeLease1 = await getPartyBy(ctx, { id: activeLeaseParty1.id });

      const updatedRenewal2 = await getPartyBy(ctx, { id: renewalParty2.id });
      const activeLease2 = await getPartyBy(ctx, { id: activeLeaseParty2.id });

      expect(renewal1.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.FIRST_PARTY_IS_RENEWAL);
      expect(activeLease1.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);

      expect(updatedRenewal2.seedPartyId).to.equal(activeLeaseParty1.id);
      expect(updatedRenewal2.metadata.V1RenewalState).to.equal(DALTypes.V1RenewalState.MIGRATED_TO_V2);
      expect(activeLease2).to.deep.equal(activeLeaseParty2);
    });
  });
});

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import chai from 'chai';
import sinonChai from 'sinon-chai';
import newId from 'uuid/v4';

import { getPartyBy, loadPartyMembersBy, getPartyAdditionalInfoByPartyId, updateParty, createParty, getPartiesByWorkflowAndState } from '../../dal/partyRepo';
import { getQuotesByPartyId } from '../../dal/quoteRepo';
import { saveTeamData } from '../../dal/teamsRepo';
import { saveIntegrationSetting } from '../../dal/propertyRepo';
import { getActiveLeaseWorkflowDataByPartyId, saveActiveLeaseWorkflowData } from '../../dal/activeLeaseWorkflowRepo';
import { archiveParty } from '../party';
import { DALTypes } from '../../../common/enums/DALTypes';
import { now, toMoment } from '../../../common/helpers/moment-utils';
import { DATE_US_FORMAT } from '../../../common/date-constants';
import { testCtx as ctx, createATask, createATeamMember, createAUser } from '../../testUtils/repoHelper';
import { createAResidentExperienceTeam } from '../../testUtils/leaseTestHelper';
import {
  createNewLeaseParty,
  callProcessWorkflowsJob,
  setupMsgQueueAndWaitFor,
  createActiveLeaseParty,
  createRenewalPartyWithQuote,
  createActiveLeasePartyFromNewLease,
} from '../../testUtils/partyWorkflowTestHelper';
import { getLeaseById } from '../../dal/leaseRepo';
import { getTasks } from '../../dal/tasksRepo';
import { createRenewalLeaseParty } from '../workflows';
import { getKeyByValue } from '../../../common/enums/enumHelper';
import { getAllExceptionReports } from '../../dal/exceptionReportRepo';
import { getPartyApplicationByPartyId } from '../../../rentapp/server/dal/party-application-repo';
import { getPersonApplicationsByPartyId } from '../../../rentapp/server/dal/person-application-repo';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../../common/acd/rolesDefinition';

chai.use(sinonChai);
const expect = chai.expect;

describe('Process workflows', () => {
  const getResident = members => members.find(pm => pm.memberType === DALTypes.MemberType.RESIDENT);
  const getGuarantor = members => members.find(pm => pm.memberType === DALTypes.MemberType.GUARANTOR);

  beforeEach(async () => await setupMsgQueueAndWaitFor([], ['lease']));

  describe('Create an active lease workflow', () => {
    describe('given a New Lease workflow for which the lease was submitted', () => {
      it('should not create an Active Lease Workflow if the lease start date is in the future', async () => {
        const leaseStartDate = now().add(10, 'days').format(DATE_US_FORMAT);
        await createNewLeaseParty({ leaseStartDate, shouldSignLease: false });
        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
        const renewalLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.undefined;
        expect(renewalLeaseParty).to.be.undefined;
      });

      it('should create an Active Lease Workflow if the lease start date is in the past', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        await createNewLeaseParty({ leaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        const { user: residentServiceDispatcherUser, team: residentServiceTeam } = await createAResidentExperienceTeam();

        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
        const renewalLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.ok;
        expect(renewalLeaseParty).to.be.ok;
        expect(residentServiceDispatcherUser.id).to.equal(activeLeaseParty.userId);
        expect(residentServiceTeam.id).to.equal(activeLeaseParty.ownerTeam);
      });
    });

    describe('given a New Lease workflow for which the lease was submitted', () => {
      it('should create an Active Lease Workflow with the same owner team if no active resident service team is available for the property', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        await createNewLeaseParty({ leaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        // Create a resident service team for a different property
        await createAResidentExperienceTeam({ propertyName: 'test' });
        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.ok;
        expect(newLeaseParty.ownerTeam).to.equal(activeLeaseParty.ownerTeam);
      });
    });

    describe('given a New Lease workflow for which the lease was submitted', () => {
      it('should create an Active Lease Workflow with the owner team being the resident service team from the property', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        await createNewLeaseParty({ leaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        // Create a resident service team for the same property
        const { team } = await createAResidentExperienceTeam({ propertyName: 'cove' });
        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.ok;
        expect(activeLeaseParty.ownerTeam).to.equal(team.id);
      });
    });

    describe('given a New Lease workflow with an inactive team for which the lease was submitted', () => {
      it('should create an Active Lease Workflow with the owner team being the active leasing team from the property', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { property } = await createNewLeaseParty({ leaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        const data = {
          name: 'B Team',
          displayName: 'A Team',
          description: 'A group of veterans...',
          module: 'leasing',
          directEmailIdentifier: 'a@team.com',
          directPhoneIdentifier: '12025550196',
          timeZone: 'America/Los_Angeles',
          inactiveFlag: false,
          properties: property.name,
          outsideDedicatedEmails: '',
        };
        const activeTeam = await saveTeamData(ctx, { ...data, inactiveFlag: false });
        const user = await createAUser({ name: 'Agent' });
        await createATeamMember({
          teamId: activeTeam.id,
          userId: user.id,
          roles: {
            mainRoles: [MainRoleDefinition.LA.name],
            functionalRoles: [FunctionalRoleDefinition.LWA.name, FunctionalRoleDefinition.LD.name],
          },
        });
        await saveTeamData(ctx, { ...data, name: 'team', displayName: 'team', inactiveFlag: true });

        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.ok;
        expect(activeLeaseParty.ownerTeam).to.equal(activeTeam.id);
      });
    });

    describe('given a New Lease workflow for which the lease was executed', () => {
      it('should not create an Active Lease if the lease start date is in the future', async () => {
        const leaseStartDate = now().add(10, 'days').format(DATE_US_FORMAT);
        const { leaseId } = await createNewLeaseParty({ leaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        const lease = await getLeaseById(ctx, leaseId);
        expect(lease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);
        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
        const renewalLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.undefined;
        expect(renewalLeaseParty).to.be.undefined;
      });

      it('should create an Active Lease Workflow with attached entities if the lease start date is in the past', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

        const { leaseId } = await createNewLeaseParty({
          leaseStartDate,
          leaseEndDate,
          shouldSignLease: true,
          shouldCounterSignLease: true,
        });

        const lease = await getLeaseById(ctx, leaseId);
        expect(lease.status).to.equal(DALTypes.LeaseStatus.EXECUTED);

        await callProcessWorkflowsJob();

        const newLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.NEW_LEASE });
        const activeLeaseParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });
        const renewalParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });

        expect(newLeaseParty).to.be.ok;
        expect(activeLeaseParty).to.be.ok;
        expect(renewalParty).to.be.undefined;

        expect(activeLeaseParty.seedPartyId).to.equal(newLeaseParty.id);
        expect(activeLeaseParty.state).to.equal(DALTypes.PartyStateType.RESIDENT);
        expect(activeLeaseParty.userId).to.be.equal(newLeaseParty.userId);
        expect(activeLeaseParty.partyGroupId).to.be.equal(newLeaseParty.partyGroupId);

        const newLeasePartyMembers = await loadPartyMembersBy(ctx, q => q.where('partyId', newLeaseParty.id));
        const activeLeasePartyMembers = await loadPartyMembersBy(ctx, q => q.where('partyId', activeLeaseParty.id));

        expect(newLeasePartyMembers.length).to.equal(activeLeasePartyMembers.length);

        const newLeaseResidentMember = getResident(newLeasePartyMembers);
        const newLeaseGuarantorMember = getGuarantor(newLeasePartyMembers);
        const activeLeaseResidentMember = getResident(activeLeasePartyMembers);
        const activeLeaseGuarantorMember = getGuarantor(activeLeasePartyMembers);

        expect(newLeaseResidentMember.id).to.not.equal(activeLeaseResidentMember.id);
        expect(newLeaseResidentMember.personId).to.equal(activeLeaseResidentMember.personId);
        expect(newLeaseGuarantorMember.id).to.not.equal(activeLeaseGuarantorMember.id);
        expect(newLeaseGuarantorMember.personId).to.equal(activeLeaseGuarantorMember.personId);
        expect(activeLeaseResidentMember.guaranteedBy).to.be.equal(activeLeaseGuarantorMember.id);

        const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);

        expect(activeLeaseData.leaseId).to.equal(leaseId);
        expect(activeLeaseData.leaseData.leaseStartDate).to.equal(leaseStartDate);
        expect(activeLeaseData.leaseData.leaseEndDate).to.equal(leaseEndDate);

        const newLeaseAdditionalInfo = await getPartyAdditionalInfoByPartyId(ctx, newLeaseParty.id);
        const activeLeaseAdditionalInfo = await getPartyAdditionalInfoByPartyId(ctx, activeLeaseParty.id);

        expect(newLeaseAdditionalInfo.length).to.not.equal(0);
        expect(activeLeaseAdditionalInfo.length).to.equal(newLeaseAdditionalInfo.length);
      });
    });
  });

  describe('Create a renewal workflow', () => {
    describe('given an Active Lease Workflow with a lease that expires after the number of days set in property settings renewalCycleStart', () => {
      it('should not create a renewal workflow', async () => {
        const leaseStartDate = now().format(DATE_US_FORMAT);

        const leaseEndDate = now().add(100, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty, propertyRenewalCycleStart } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });

        expect(now().add(propertyRenewalCycleStart, 'days').isBefore(leaseEndDate)).to.be.true;

        expect(activeLeaseParty).to.be.ok;

        await callProcessWorkflowsJob();

        const renewalLeaseWorkflow = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });
        expect(renewalLeaseWorkflow).to.be.undefined;
      });
    });

    describe('given an Month to Month Active Lease Workflow', () => {
      it('should not create a renewal workflow for active lease with rollover period', async () => {
        const leaseStartDate = now().format(DATE_US_FORMAT);
        const leaseEndDate = now().add(10, 'days').format(DATE_US_FORMAT);
        const rolloverPeriod = DALTypes.RolloverPeriod.M2M;

        const { activeLeaseParty, propertyRenewalCycleStart } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate, rolloverPeriod });

        expect(now().add(propertyRenewalCycleStart, 'days').isAfter(leaseEndDate)).to.be.true;

        expect(activeLeaseParty).to.be.ok;

        await callProcessWorkflowsJob();

        const renewalParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });
        expect(renewalParty).to.be.undefined;
      });
    });

    describe('given an Active Lease Workflow with a lease that expires before the number of days set in property settings renewalCycleStart', () => {
      it('should create a renewal workflow with attached entities', async () => {
        const leaseStartDate = now().format(DATE_US_FORMAT);

        const leaseEndDate = now().add(10, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty, propertyRenewalCycleStart } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });

        expect(now().add(propertyRenewalCycleStart, 'days').isAfter(leaseEndDate)).to.be.true;

        expect(activeLeaseParty).to.be.ok;

        await callProcessWorkflowsJob();

        const renewalParty = await getPartyBy(ctx, { workflowName: DALTypes.WorkflowName.RENEWAL });
        expect(renewalParty).to.be.ok;

        const partyApplication = await getPartyApplicationByPartyId(ctx, renewalParty.id);
        const personApplications = await getPersonApplicationsByPartyId(ctx, renewalParty.id);

        expect(partyApplication).to.be.undefined;
        expect(personApplications.length).to.equal(0);

        expect(renewalParty.seedPartyId).to.equal(activeLeaseParty.id);
        expect(renewalParty.state).to.equal(DALTypes.PartyStateType.PROSPECT);
        expect(renewalParty.partyGroupId).to.be.equal(activeLeaseParty.partyGroupId);

        const activeLeasePartyMembers = await loadPartyMembersBy(ctx, q => q.where('partyId', activeLeaseParty.id));
        const renewalPartyMembers = await loadPartyMembersBy(ctx, q => q.where('partyId', renewalParty.id));

        expect(activeLeasePartyMembers.length).to.equal(renewalPartyMembers.length);

        const activeLeaseResidentMember = getResident(activeLeasePartyMembers);
        const activeLeaseGuarantorMember = getGuarantor(activeLeasePartyMembers);
        const renewalResidentMember = getResident(renewalPartyMembers);
        const renewalGuarantorMember = getGuarantor(renewalPartyMembers);

        expect(renewalResidentMember.id).to.not.equal(activeLeaseResidentMember.id);
        expect(renewalResidentMember.personId).to.equal(activeLeaseResidentMember.personId);
        expect(renewalGuarantorMember.id).to.not.equal(activeLeaseGuarantorMember.id);
        expect(renewalGuarantorMember.personId).to.equal(activeLeaseGuarantorMember.personId);
        expect(activeLeaseResidentMember.guaranteedBy).to.be.equal(activeLeaseGuarantorMember.id);

        const activeLeaseAdditionalInfo = await getPartyAdditionalInfoByPartyId(ctx, activeLeaseParty.id);
        const renewalAdditionalInfo = await getPartyAdditionalInfoByPartyId(ctx, renewalParty.id);

        expect(activeLeaseAdditionalInfo.length).to.not.equal(0);
        expect(activeLeaseAdditionalInfo.length).to.equal(renewalAdditionalInfo.length);
      });
    });
  });

  describe('Archive a new lease workflow', () => {
    describe('given a new lease workflow with one executed lease that has the lease start date in the past and no active tasks', () => {
      it('should archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENT_CREATED);

        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(party.archiveDate).not.to.be.null;
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });

    describe('given a new lease workflow with one executed lease that has the lease start date in the past', () => {
      it('should archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });

        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENT_CREATED);

        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(party.archiveDate).not.to.be.null;
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });

    describe('given a new lease workflow with one executed lease that has the lease start date in the past and one active task', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });

        const manualTaskData = {
          name: 'Manual task',
          category: DALTypes.TaskCategories.MANUAL,
          partyId: newLeaseParty.id,
        };

        await createATask(manualTaskData);

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const allTasks = await getTasks(ctx);
        expect(allTasks.length).to.equal(1);
        expect(allTasks[0].category).to.equal(DALTypes.TaskCategories.MANUAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a new lease workflow with one executed lease that has the lease start date in the future', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a new lease workflow with a lease that is not executed', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate, shouldCounterSignLease: false });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a new lease workflow with a lease that is executed', () => {
      it('should not archive the workflow if the active lease was not spawned', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty, inventoryId, property } = await createNewLeaseParty({
          leaseStartDate,
          shouldSignLease: true,
          shouldCounterSignLease: true,
        });
        await createActiveLeaseParty({ inventoryId });

        await saveIntegrationSetting(ctx, property.id, { import: { residentData: true } });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const newLeaseParties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.NEW_LEASE, DALTypes.WorkflowState.ACTIVE);
        const activeLeaseParties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowState.ACTIVE);

        expect(newLeaseParties.length).to.equal(1);
        expect(activeLeaseParties.length).to.equal(1);
        expect(newLeaseParties[0].partyGroupId).to.not.equal(activeLeaseParties[0].partyGroupId);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a new lease traditional workflow with a lease that is executed', () => {
      it('should archive the workflow if two active leases were spawned and one is already archived', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty, property } = await createNewLeaseParty({
          leaseStartDate,
          shouldSignLease: true,
          shouldCounterSignLease: true,
        });

        const { activeLeaseParty: activeLeaseParty1 } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

        const { activeLeaseParty: activeLeaseParty2 } = await createActiveLeasePartyFromNewLease({ newLeaseParty });

        expect(newLeaseParty.partyGroupId).to.equal(activeLeaseParty1.partyGroupId);
        expect(newLeaseParty.partyGroupId).to.equal(activeLeaseParty2.partyGroupId);

        await archiveParty(ctx, { partyId: activeLeaseParty1.id, archiveReasonId: DALTypes.ArchivePartyReasons.CORRESPONDING_LEASE_DOCUMENT_WAS_VOIDED });
        await saveIntegrationSetting(ctx, property.id, { import: { residentData: true } });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const activeNewLeaseParties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.NEW_LEASE, DALTypes.WorkflowState.ACTIVE);
        const activeLeaseParties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowState.ACTIVE);
        const archivedActiveLeaseParties = await getPartiesByWorkflowAndState(ctx, DALTypes.WorkflowName.ACTIVE_LEASE, DALTypes.WorkflowState.ARCHIVED);

        expect(activeNewLeaseParties.length).to.equal(0);
        expect(activeLeaseParties.length).to.equal(1);
        expect(archivedActiveLeaseParties.length).to.equal(1);

        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENT_CREATED);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(party.archiveDate).not.to.be.null;
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });
  });

  describe('Archive a renewal workflow', () => {
    describe('given a renewal workflow with one executed lease that has the lease start date in the past and no active tasks', () => {
      it('should archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });
        await updateParty(ctx, { id: newLeaseParty.id, workflowName: DALTypes.WorkflowName.RENEWAL });
        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RENEWAL_LEASE_STARTED);

        expect(party.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(party.archiveDate).not.to.be.null;
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });

    describe('given a renewal workflow with one executed lease that has the lease start date in the past and one active migrate move in documents task', () => {
      it('should archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });
        await updateParty(ctx, { id: newLeaseParty.id, workflowName: DALTypes.WorkflowName.RENEWAL });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });

        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RENEWAL_LEASE_STARTED);

        expect(party.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(party.archiveDate).not.to.be.null;
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });

    describe('given a renewal workflow with one executed lease that has the lease start date in the past and one active task', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });
        await updateParty(ctx, { id: newLeaseParty.id, workflowName: DALTypes.WorkflowName.RENEWAL });

        const manualTaskData = {
          name: 'Manual task',
          category: DALTypes.TaskCategories.MANUAL,
          partyId: newLeaseParty.id,
        };

        await createATask(manualTaskData);

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        const allTasks = await getTasks(ctx);
        expect(allTasks.length).to.equal(1);
        expect(allTasks[0].category).to.equal(DALTypes.TaskCategories.MANUAL);
        expect(party.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a renewal workflow with one executed lease that has the lease start date in the future', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate });
        await updateParty(ctx, { id: newLeaseParty.id, workflowName: DALTypes.WorkflowName.RENEWAL });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        expect(party.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a renewal workflow with a lease that is not executed', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(-1, 'days').format(DATE_US_FORMAT);
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate, shouldCounterSignLease: false });
        await updateParty(ctx, { id: newLeaseParty.id, workflowName: DALTypes.WorkflowName.RENEWAL });

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: newLeaseParty.id });
        expect(party.workflowName).to.equal(DALTypes.WorkflowName.RENEWAL);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given a party that is marked as moving out', () => {
      it('should archive the workflow if the confirmed vacate date is in the past and lease end date in future', async () => {
        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const vacateDate = now().add(-1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseEndDate });
        const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

        // mark active lease as moving out
        const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
        await saveActiveLeaseWorkflowData(ctx, {
          ...activeLeaseData,
          metadata: {
            ...activeLeaseData.metadata,
            dateOfTheNotice: '2019-07-10',
            vacateDate,
            moveOutConfirmed: true,
          },
        });

        await callProcessWorkflowsJob();
        const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.RESIDENTS_HAVE_MOVED_OUT);
        expect(updatedRenewalParty.archiveDate).not.to.be.null;
        expect(updatedRenewalParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(updatedRenewalParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
        const updateActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
        expect(updateActiveLeaseParty.archiveDate).not.to.be.null;
        expect(updateActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(updateActiveLeaseParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });

      it('should mark the active lease as extension if the lease end date is in the past and the vacate date is in the future', async () => {
        const leaseEndDate = now().add(-1, 'days').format(DATE_US_FORMAT);

        const vacateDate = now().add(4, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseEndDate });

        // mark active lease as moving out
        const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
        await saveActiveLeaseWorkflowData(ctx, {
          ...activeLeaseData,
          state: DALTypes.ActiveLeaseState.MOVING_OUT,
          metadata: {
            ...activeLeaseData.metadata,
            dateOfTheNotice: '2019-07-10',
            vacateDate,
          },
        });

        await callProcessWorkflowsJob();
        const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
        expect(updatedActiveLeaseParty.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);

        const updatedActiveLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
        expect(updatedActiveLeaseData.isExtension).to.be.true;
      });
    });
  });

  describe('Archive an active lease workflow', () => {
    describe('given an active lease workflow with lease in extension period', () => {
      it('should not archive the workflow if the lease is not marked as moving out', async () => {
        const leaseStartDate = now().add(-10, 'days').toISOString();

        const leaseEndDate = now().add(-1, 'days').toISOString();

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate, isExtension: true });
        expect(activeLeaseParty).to.be.ok;

        await callProcessWorkflowsJob();
        const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
      });
    });

    describe('given an active lease workflow', () => {
      it('should archive the workflow when a new active lease is created for the same unit if the residents sync is off', async () => {
        const newLeaseStartDate = now().toISOString();

        // create the new lease
        const { party: newLeaseParty } = await createNewLeaseParty({ leaseStartDate: newLeaseStartDate, shouldSignLease: true, shouldCounterSignLease: true });
        expect(newLeaseParty).to.be.ok;
        const quotes = await getQuotesByPartyId(ctx, newLeaseParty.id);

        // create the active lease
        const activeLeaseParty = await createParty(ctx, {
          id: newId(),
          userId: newLeaseParty.userId,
          workflowName: DALTypes.WorkflowName.ACTIVE_LEASE,
          assignedPropertyId: newLeaseParty.assignedPropertyId,
          state: DALTypes.PartyStateType.RESIDENT,
          ownerTeam: newLeaseParty.ownerTeam,
        });

        const activeLeaseStartDate = now().add(-10, 'days').toISOString();

        const activeLeaseEndDate = now().add(1, 'days').toISOString();

        await saveActiveLeaseWorkflowData(ctx, {
          created_at: activeLeaseParty.created_at,
          leaseId: null,
          leaseData: {
            leaseStartDate: activeLeaseStartDate,
            leaseEndDate: activeLeaseEndDate,
            inventoryId: quotes[0].inventoryId,
          },
          partyId: activeLeaseParty.id,
        });

        await callProcessWorkflowsJob();
        const activeLeaseWorkflow = await getPartyBy(ctx, { id: activeLeaseParty.id });
        expect(activeLeaseWorkflow.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
      });
    });

    describe('given an active lease workflow with a lease that is not expired', () => {
      it('should not archive the workflow', async () => {
        const leaseStartDate = now().add(-10, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate });

        expect(activeLeaseParty).to.be.ok;

        await callProcessWorkflowsJob();

        const party = await getPartyBy(ctx, { id: activeLeaseParty.id });
        expect(party.workflowName).to.equal(DALTypes.WorkflowName.ACTIVE_LEASE);
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ACTIVE);
        expect(party.archiveDate).to.be.null;
      });
    });

    describe('given an active lease workflow with a lease has not received the move in confirmation from MRI', () => {
      it('should archive that active lease with MOVEIN_NOT_CONFIRMED reason', async () => {
        const leaseStartDate = now().add(-10, 'days').format(DATE_US_FORMAT);

        const moveInDate = now().add(-8, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate, moveInDate });
        const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

        expect(activeLeaseParty).to.be.ok;
        expect(renewalParty).to.be.ok;

        await callProcessWorkflowsJob();

        const alp = await getPartyBy(ctx, { id: activeLeaseParty.id });
        const rlp = await getPartyBy(ctx, { id: renewalParty.id });
        expect(alp.archiveDate).is.not.null;
        expect(alp.metadata.archiveReasonId).to.equal('MOVEIN_NOT_CONFIRMED');
        expect(rlp.archiveDate).is.not.null;
        expect(rlp.metadata.archiveReasonId).to.equal('MOVEIN_NOT_CONFIRMED');
      });

      it('should not create an exception report if that party is already marked as added to an exception report', async () => {
        const leaseStartDate = now().add(-10, 'days').format(DATE_US_FORMAT);

        const moveInDate = now().add(-8, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty, activeLeaseWorkflowData } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate, moveInDate });
        expect(activeLeaseParty).to.be.ok;

        const updatedMetadata = { ...activeLeaseWorkflowData.metadata, wasAddedToExceptionReport: true };
        await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData, metadata: updatedMetadata });

        await callProcessWorkflowsJob();

        const exceptionReports = await getAllExceptionReports(ctx);
        expect(exceptionReports.length).to.equal(0);
      });
    });

    describe('given an active lease workflow with a lease has received the move in confirmation from MRI', () => {
      it('should not create an exception report with that party', async () => {
        const leaseStartDate = now().add(-10, 'days').format(DATE_US_FORMAT);

        const moveInDate = now().add(-8, 'days').format(DATE_US_FORMAT);

        const leaseEndDate = now().add(1, 'days').format(DATE_US_FORMAT);

        const { activeLeaseParty, activeLeaseWorkflowData } = await createActiveLeaseParty({ leaseStartDate, leaseEndDate, moveInDate });
        expect(activeLeaseParty).to.be.ok;

        const updatedMetadata = { ...activeLeaseWorkflowData.metadata, moveInConfirmed: true };
        await saveActiveLeaseWorkflowData(ctx, { ...activeLeaseWorkflowData, metadata: updatedMetadata });

        await callProcessWorkflowsJob();

        const exceptionReports = await getAllExceptionReports(ctx);
        expect(exceptionReports.length).to.equal(0);
      });
    });
  });

  describe('Active lease in extension period', () => {
    describe('given an active lease with a renewal for which there is no published quote by the end of the active lease', () => {
      it('should mark the active lease as extension, compute extended lease end date and archive the renewal workflow', async () => {
        const leaseEndDate = now().add(-1, 'days').toISOString();

        const { activeLeaseParty, timezone } = await createActiveLeaseParty({ leaseEndDate });
        const renewalParty = await createRenewalLeaseParty(ctx, activeLeaseParty.id);

        await callProcessWorkflowsJob();

        const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
        expect(activeLeaseData.isExtension).to.equal(true);
        expect(activeLeaseData.leaseData.leaseEndDate).to.eql(leaseEndDate);
        expect(activeLeaseData.leaseData.computedExtensionEndDate).to.eql(toMoment(leaseEndDate, { timezone }).add(1, 'month').toISOString());

        const party = await getPartyBy(ctx, { id: renewalParty.id });
        expect(party.workflowState).to.equal(DALTypes.WorkflowState.ARCHIVED);
        const archiveReasonIdResult = getKeyByValue(
          DALTypes.ArchivePartyReasons,
          DALTypes.ArchivePartyReasons.CURRENT_LEASE_IN_PAST_AND_NO_PUBLISH_QUOTE_ON_RENEWAL,
        );
        expect(party.metadata.archiveReasonId).to.equal(archiveReasonIdResult);
      });
    });

    describe('given an active lease that is in extension period', () => {
      it('should not create a renewal workflow automatically', async () => {
        const leaseEndDate = now().add(-1, 'days').toISOString();

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseEndDate, isExtension: true });
        const activeLeaseData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeLeaseParty.id);
        expect(activeLeaseData.isExtension).to.equal(true);

        await callProcessWorkflowsJob();

        const renewalParty = await getPartyBy(ctx, { seedPartyId: activeLeaseParty.id });
        expect(renewalParty).to.be.undefined;
      });

      describe('with a renewal that has a published renewal letter', () => {
        it('should create one month active lease, archive the extended active lease and renewal party', async () => {
          const computedExtensionEndDate = now().add(-1, 'days').toISOString();

          const { activeLeaseParty } = await createActiveLeaseParty({ computedExtensionEndDate, isExtension: true });
          const { renewalParty } = await createRenewalPartyWithQuote({ activeLeasePartyId: activeLeaseParty.id });

          await callProcessWorkflowsJob();
          const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
          const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
          const activeOneMonthLeaseParty = await getPartyBy(ctx, { seedPartyId: activeLeaseParty.id, workflowName: DALTypes.WorkflowName.ACTIVE_LEASE });

          const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CREATED_ONE_MONTH_LEASE);

          expect(updatedActiveLeaseParty.workflowState).to.be.equal(DALTypes.WorkflowState.ARCHIVED);
          expect(updatedActiveLeaseParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

          expect(updatedRenewalParty.workflowState).to.be.equal(DALTypes.WorkflowState.ARCHIVED);
          expect(updatedRenewalParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

          expect(activeOneMonthLeaseParty.workflowState).to.be.equal(DALTypes.WorkflowState.ACTIVE);
        });
      });
    });
  });

  describe('Transition to one month lease', () => {
    describe('given an active lease with lease end date in past and a renewal party that has a published renewal letter', () => {
      it('should create one month active lease and archive the current active lease party and the renewal associated with it', async () => {
        const leaseEndDate = now().add(-1, 'days').toISOString();

        const { activeLeaseParty } = await createActiveLeaseParty({ leaseEndDate });
        const { renewalParty } = await createRenewalPartyWithQuote({ activeLeasePartyId: activeLeaseParty.id });

        await callProcessWorkflowsJob();
        const updatedActiveLeaseParty = await getPartyBy(ctx, { id: activeLeaseParty.id });
        const updatedRenewalParty = await getPartyBy(ctx, { id: renewalParty.id });
        const activeOneMonthLeaseParty = await getPartyBy(ctx, { seedPartyId: activeLeaseParty.id, workflowState: DALTypes.WorkflowState.ACTIVE });

        const archiveReasonIdResult = getKeyByValue(DALTypes.ArchivePartyReasons, DALTypes.ArchivePartyReasons.CREATED_ONE_MONTH_LEASE);

        expect(updatedActiveLeaseParty.workflowState).to.be.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(updatedActiveLeaseParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

        expect(updatedRenewalParty.workflowState).to.be.equal(DALTypes.WorkflowState.ARCHIVED);
        expect(updatedRenewalParty.metadata.archiveReasonId).to.equal(archiveReasonIdResult);

        expect(activeOneMonthLeaseParty.workflowState).to.be.equal(DALTypes.WorkflowState.ACTIVE);

        const oneMonthActiveLeaseWorkflowData = await getActiveLeaseWorkflowDataByPartyId(ctx, activeOneMonthLeaseParty.id);
        expect(oneMonthActiveLeaseWorkflowData.rolloverPeriod).to.be.equal(DALTypes.RolloverPeriod.M2M);
      });
    });
  });
});

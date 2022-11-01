/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import sinon from 'sinon';
import { mapSeries } from 'bluebird';
import { expect } from 'chai';
import range from 'lodash/range';
import omit from 'lodash/omit';
import {
  testCtx as ctx,
  createATeam,
  createAProperty,
  createASource,
  createVoiceMessages,
  createACampaign,
  makeProgramInactive,
  createAProgram,
} from '../../testUtils/repoHelper';
import { tenant } from '../../testUtils/setupTestGlobalContext';
import {
  importPrograms,
  PROGRAM_FALLBACK,
  PROGRAM_FALLBACK_NONE,
  END_DATE,
  REACTIVATED_PROGRAM,
  INACTIVE_TEAM_ERROR,
  TEAM,
  ON_SITE_LEASING_TEAM,
} from '../inventory/programs';
import { importProgramReferrers } from '../inventory/programReferrers';
import { getPrograms, getTeamPropertyPrograms, getProgramReferrers } from '../../dal/programsRepo';
import { getTenantReservedPhoneNumbers, updateTenantPhoneNumbers } from '../../dal/tenantsRepo';
import { updateTeam } from '../../dal/teamsRepo';
import { getOneWhere } from '../../database/factory';
import { isPhoneValid } from '../../../common/helpers/validations/phone';
import { getPhoneNumber } from '../../helpers/phoneUtils';
import config from '../../config';
import { getValidationMessagesForPlaceholders } from '../inventory/phoneUtils';
import { detachProgramPhoneNumbers } from '../../workers/communication/detachPhoneNumbersHandler';

import { now, toMoment } from '../../../common/helpers/moment-utils';

describe('inventory/programs', () => {
  let property;
  let team;
  let team2;
  let source;
  let voiceMessage;
  let campaign;
  const commsForwardingData = {
    forwardingEnabledFlag: false,
    forwardEmailToExternalTarget: '',
    forwardCallToExternalTarget: '',
    forwardSMSToExternalTarget: '',
  };
  const metadata = {
    defaultMatchingPath: null,
    requireMatchingPathFlag: true,
    requireMatchingSourceFlag: true,
    defaultMatchingSource: null,
    activatePaymentPlan: true,
    gaIds: '',
    gaActions: '',
  };
  beforeEach(async () => {
    property = await createAProperty();
    team = await createATeam({
      name: 'testTeam1',
      module: 'leasing',
      email: 'leasing_email1',
      phone: '16504375757',
    });
    team2 = await createATeam({
      name: 'testTeam2',
      module: 'leasing',
      email: 'leasing_email2',
      phone: '16504375758',
    });
    source = await createASource('testSource', 'test source display name', 'desc', 'type');
    voiceMessage = await createVoiceMessages();
    campaign = await createACampaign('Campaign1', 'Campaign1DN', 'Campaign Description');
  });

  describe('when importing a new program', () => {
    it('will save the program', async () => {
      const source2 = await createASource('testSource2', 'test source display name2', 'desc2', 'type2');
      const firstProgram = {
        name: 'Program1',
        displayName: 'Program1DN',
        reportingDisplayName: 'Program1DN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        directPhoneIdentifier: '%phone[0]%',
        displayPhoneNumber: '%phone[0]%',
        displayEmail: 'program1@reva.tech',
        displayUrl: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const secondProgram = {
        name: 'Program2',
        displayName: 'Program2DN',
        reportingDisplayName: 'Program2DN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source2.name,
        directEmailIdentifier: 'test.program2',
        outsideDedicatedEmails: 'test_email2@reva.tech',
        directPhoneIdentifier: '%phone[1]%',
        displayPhoneNumber: '%phone[1]%',
        displayEmail: 'program2@reva.tech',
        displayUrl: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: firstProgram,
          index: 1,
        },
        {
          data: secondProgram,
          index: 2,
        },
      ];
      await importPrograms(ctx, programRows);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(2);

      const dbFirstProgram = await getOneWhere(ctx.tenantId, 'Programs', { name: firstProgram.name });
      expect(dbFirstProgram.name).to.equal(firstProgram.name);
      expect(dbFirstProgram.displayName).to.equal(firstProgram.displayName);
      expect(dbFirstProgram.reportingDisplayName).to.equal(firstProgram.reportingDisplayName);
      expect(dbFirstProgram.path).to.equal(firstProgram.path);
      expect(dbFirstProgram.description).to.equal(firstProgram.description);
      expect(dbFirstProgram.directEmailIdentifier).to.equal(firstProgram.directEmailIdentifier);
      expect(dbFirstProgram.outsideDedicatedEmails[0]).to.equal(firstProgram.outsideDedicatedEmails);
      expect(isPhoneValid(dbFirstProgram.directPhoneIdentifier)).to.equal(true);
      expect(isPhoneValid(dbFirstProgram.displayPhoneNumber)).to.equal(true);
      expect(dbFirstProgram.displayEmail).to.equal(firstProgram.displayEmail);
      expect(dbFirstProgram.voiceMessageId).to.equal(voiceMessage.id);
    });
  });

  describe('when importing a program that has an invalid campaign', () => {
    it('will not save the program', async () => {
      const source2 = await createASource('testSource2', 'test source display name2', 'desc2', 'type2');

      const firstProgram = {
        name: 'Program1',
        displayName: 'Program1DN',
        reportingDisplayName: 'Program1DN',
        description: 'Program description',
        campaign: campaign.name,
        team: team.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        directPhoneIdentifier: '%phone[0]%',
        displayPhoneNumber: '%phone[0]%',
        displayEmail: 'program1@reva.tech',
        displayUrl: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const secondProgram = {
        name: 'Program2',
        displayName: 'Program2DN',
        reportingDisplayName: 'Program2DN',
        description: 'Program description',
        campaign: 'some-campaign-name',
        team: team.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source2.name,
        directEmailIdentifier: 'test.program2',
        outsideDedicatedEmails: 'test_email2@reva.tech',
        directPhoneIdentifier: '%phone[1]%',
        displayPhoneNumber: '%phone[1]%',
        displayEmail: 'program2@reva.tech',
        displayUrl: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: firstProgram,
          index: 1,
        },
        {
          data: secondProgram,
          index: 2,
        },
      ];
      await importPrograms(ctx, programRows);
      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);
      expect(programs[0].displayName).to.equal('Program1DN');
      expect(programs[0].campaignId).to.equal(campaign.id);
    });
  });

  describe('when importing an already imported program', () => {
    it('will not update the existing one if the changes are in team, primartyProperty or source', async () => {
      const programRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone[0]%',
            displayPhoneNumber: '%phone[0]%',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRow);

      const teamPropertyPrograms = await getTeamPropertyPrograms(ctx);
      expect(teamPropertyPrograms.length).to.equal(1);
      expect(teamPropertyPrograms[0].teamId).to.equal(team.id);

      const updatedprogramRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program1NewDescription',
            team: team2.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'new_test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            directPhoneIdentifier: '%phone[1]%',
            displayPhoneNumber: '%phone[1]%',
            displayUrl: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];

      await importPrograms(ctx, updatedprogramRow);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);
      expect(programs[0].description).to.equal('Program description');
      expect(programs[0].directEmailIdentifier).to.equal('test.program');

      const property2 = await createAProperty();
      const updatedProgramRow2 = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program1NewDescription',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property2.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'new_test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            directPhoneIdentifier: '%phone[1]%',
            displayPhoneNumber: '%phone[1]%',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];

      await importPrograms(ctx, updatedProgramRow2);

      const programs2 = await getPrograms(ctx);
      expect(programs2.length).to.equal(1);
      expect(programs2[0].description).to.equal('Program description');
      expect(programs2[0].directEmailIdentifier).to.equal('test.program');

      const source2 = await createASource('testSource2', 'test source display name2', 'desc', 'type2');
      const updatedProgramRow3 = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program1NewDescription',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source2.name,
            directEmailIdentifier: 'new_test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            directPhoneIdentifier: '%phone[1]%',
            displayPhoneNumber: '%phone[1]%',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            enableBotResponseOnCommunications: false,
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];

      await importPrograms(ctx, updatedProgramRow3);

      const programs3 = await getPrograms(ctx);
      expect(programs3.length).to.equal(1);
      expect(programs3[0].description).to.equal('Program description');
      expect(programs3[0].directEmailIdentifier).to.equal('test.program');
    });
    it('will update the existing one if the changes are not on team, primartyProperty or source', async () => {
      const programRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            displayEmail: '',
            displayUrl: '',
            outsideDedicatedEmails: 'test_email@reva.tech',
            directPhoneIdentifier: '%phone[1]%',
            displayPhoneNumber: '%phone[1]%',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            enableBotResponseOnCommunications: false,
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRow);

      const teamPropertyPrograms = await getTeamPropertyPrograms(ctx);
      expect(teamPropertyPrograms.length).to.equal(1);
      expect(teamPropertyPrograms[0].teamId).to.equal(team.id);

      const newVoiceMessage = await createVoiceMessages();
      const updatedprogramRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            description: 'Program1NewDescription',
            reportingDisplayName: 'Program1DN',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'new_test.program',
            displayEmail: '',
            displayUrl: '',
            outsideDedicatedEmails: 'test_email2@reva.tech',
            directPhoneIdentifier: '%phone[1]%',
            displayPhoneNumber: '%phone[1]%',
            voiceMessage: newVoiceMessage.name,
            path: 'direct',
            programFallback: '',
            selectedProperties: '',
            enableBotResponseOnCommunications: false,
            endDate: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];

      await importPrograms(ctx, updatedprogramRow);

      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);

      const programs = await getPrograms(ctx);

      expect(programs.length).to.equal(1);
      expect(programs[0].description).to.equal('Program1NewDescription');
      expect(programs[0].directEmailIdentifier).to.equal('new_test.program');
      expect(programs[0].outsideDedicatedEmails).to.deep.equal(['test_email2@reva.tech']);
      expect(programs[0].directPhoneIdentifier).to.equal(phoneNumbers[1].phoneNumber);
      expect(programs[0].displayPhoneNumber).to.equal(phoneNumbers[1].phoneNumber);
      expect(programs[0].voiceMessageId).to.equal(newVoiceMessage.id);
    });
  });

  describe('when importing a program with a area code placeholder and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const programRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": ["650", "123", "707"]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            programFallback: '',
            selectedProperties: '',
            endDate: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRow);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length - 1);

      const usedNumber = tenantFreeNumbersBeforeImport.filter(a => !tenantFreeNumbersAfterImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const addedProgram = programs[0];

      expect(addedProgram.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(addedProgram.directPhoneIdentifier.substring(1, 4) === 650);
    });
  });

  describe('when importing a program with one area code placeholder and tenant has no corresponding phone available', () => {
    it('if the area code is invalid no number will be found and it will throw an error', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const programRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": ["999"]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            programFallback: '',
            selectedProperties: '',
            endDate: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      const { invalidFields } = await importPrograms(ctx, programRow);
      expect(invalidFields[0].invalidFields[0].name).to.equal('INVALID_DIRECT_PHONE_IDENTIFIER');

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length);
    });
  });

  describe('when importing a program with one area code placeholder and tenant has no corresponding phone available', () => {
    it('if the area code valid it will buy the missing number', async () => {
      const tenantNumbersBeforeImport = await getTenantReservedPhoneNumbers(ctx);

      const programRow = [
        {
          data: {
            name: 'Program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": ["907"]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRow);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);

      const tenantNumbersAfterImport = await getTenantReservedPhoneNumbers(ctx);

      expect(tenantNumbersBeforeImport.length + 1).to.equal(tenantNumbersAfterImport.length);

      const usedNumber = tenantNumbersAfterImport.filter(a => !tenantNumbersBeforeImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const addedProgram = programs[0];

      expect(addedProgram.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(addedProgram.directPhoneIdentifier.substring(1, 4) === 907);
    });
  });

  describe('when importing twice a program with a area code placeholder and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);
      const programRow = [
        {
          data: {
            name: 'program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": ["650", "123", "707"]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRow);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersBeforeImport.length - 1);

      const usedNumber = tenantFreeNumbersBeforeImport.filter(a => !tenantFreeNumbersAfterImport.some(b => b.phoneNumber === a.phoneNumber))[0];
      const addedProgram = programs[0];

      expect(addedProgram.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(addedProgram.directPhoneIdentifier.substring(1, 4) === 650);

      const programRowSecondTime = [
        {
          data: {
            name: 'program1',
            displayName: 'Program1DN',
            reportingDisplayName: 'Program1DN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": ["650", "123", "707"]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];

      await importPrograms(ctx, programRowSecondTime);

      const programs2 = await getPrograms(ctx);
      expect(programs2.length).to.equal(1);

      const tenantFreeNumbersAfterImport2 = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(tenantFreeNumbersAfterImport2.length);

      const addedProgram2 = programs[0];

      expect(addedProgram2.directPhoneIdentifier).to.equal(usedNumber.phoneNumber);
      expect(addedProgram2.directPhoneIdentifier.substring(1, 4) === 650);
    });
  });

  describe('when importing a program with a area code placeholder with *  and tenant has a corresponding phone available', () => {
    it('will choose the first phone number for the desired pattern', async () => {
      const tenantFreeNumbersBeforeImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      const programRows = range(tenantFreeNumbersBeforeImport.length - 1).map(i => ({
        data: {
          name: `program${i}`,
          displayName: `program${i}DN`,
          reportingDisplayName: `program${i}DN`,
          description: 'Program description',
          team: team.name,
          campaign: campaign.name,
          primaryProperty: property.name,
          onSiteLeasingTeam: team.name,
          source: source.name,
          directEmailIdentifier: `test${i}DN.email`,
          outsideDedicatedEmails: `test${i}DN.email@reva.tech`,
          displayEmail: '',
          displayUrl: '',
          directPhoneIdentifier: `%phone[${i}]%`,
          displayPhoneNumber: '',
          voiceMessage: voiceMessage.name,
          path: 'direct',
          enableBotResponseOnCommunications: false,
          endDate: '',
          programFallback: '',
          selectedProperties: '',
          ...metadata,
          ...commsForwardingData,
        },
        index: i,
      }));

      await importPrograms(ctx, programRows);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(programRows.length);

      const tenantFreeNumbersAfterImport = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport.length).to.equal(1);

      const unusedNumber = tenantFreeNumbersAfterImport[0];

      const programRowSecondTime = [
        {
          data: {
            name: 'program-x',
            displayName: 'ProgramXDN',
            reportingDisplayName: 'ProgramXDN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone["area_code_preferences": [*]]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRowSecondTime);

      const programs2 = await getPrograms(ctx);
      expect(programs2.length).to.equal(tenantFreeNumbersBeforeImport.length);
      const tenantFreeNumbersAfterImport2 = (await getTenantReservedPhoneNumbers(ctx)).filter(n => !n.isUsed);

      expect(tenantFreeNumbersAfterImport2.length).to.equal(0);

      const addedProgram2 = programs2.find(p => p.name === 'program-x');

      expect(addedProgram2.directPhoneIdentifier).to.equal(unusedNumber.phoneNumber);
    });
  });

  describe('when importing programs with phones', () => {
    it('will determine correct phones based on the placeholders and if numbers are used', async () => {
      const tenantReservedPhoneNumbers = [
        { phoneNumber: '16504466743' },
        { phoneNumber: '14083379248' },
        { phoneNumber: '12093258716' },
        { phoneNumber: '15093258699' },
        { phoneNumber: '19513964504' },
      ];

      await updateTenantPhoneNumbers(ctx, tenant, tenantReservedPhoneNumbers);

      // Should return no error if the phoneAliasToIgnore is used as phone number'
      const ignorePhoneAlias = config.import.phoneAliasToIgnore;
      let phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: ignorePhoneAlias });
      let result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: ignorePhoneAlias, determinedNumber: phoneNumber });
      expect(result).to.be.empty;

      // Should return no error if a valid phone alias is used
      const validPhoneAlias = '%phone[1]%';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: validPhoneAlias });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: validPhoneAlias, determinedNumber: phoneNumber });
      expect(result).to.be.empty;

      // Should return error message if the phone placeholder index is out of reserved phone numbers range'
      const invalidIndexPhoneAlias = '%phone[5]%';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: invalidIndexPhoneAlias });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: invalidIndexPhoneAlias, determinedNumber: phoneNumber });
      expect(result).to.include('Invalid');
      expect(result).to.include('Phone numbers reserved are between index: 0 and 4');

      // Should return no error if a valid phone number is used
      const validPhoneNumber = tenantReservedPhoneNumbers[0].phoneNumber;
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: validPhoneNumber });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: validPhoneNumber, determinedNumber: phoneNumber });
      expect(result).to.be.empty;

      // Should return error message if an invalid phone number is used
      const invalidPhoneNumber = '12333';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber, determinedNumber: phoneNumber });
      expect(result).to.include('is invalid');

      // Should return error message if a phone number that is not reserved is used
      const invalidPhoneNumber2 = '16504466740';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber2 });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber2, determinedNumber: phoneNumber });
      expect(result).to.include('is not reserved for this tenant');

      // Should return error message if an invalid format for phone or invalid value is used
      let invalidPhoneNumber3 = '(951) 396-4504';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber3 });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber3, determinedNumber: phoneNumber });
      expect(result).to.include('is invalid!');

      invalidPhoneNumber3 = '+19513964504';
      phoneNumber = await getPhoneNumber({ ctx, tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber3 });
      result = getValidationMessagesForPlaceholders({ tenantReservedPhoneNumbers, excelPhoneNumber: invalidPhoneNumber3, determinedNumber: phoneNumber });
      expect(result).to.include('is invalid!');
    });
  });
  describe('when importing a set of programs', () => {
    it('will assign phone numbers based on rankings', async () => {
      const tenantReservedPhoneNumbers = [
        { phoneNumber: '16504466743' },
        { phoneNumber: '14083379248' },
        { phoneNumber: '12093258716' },
        { phoneNumber: '15093258699' },
        { phoneNumber: '19513964504' },
      ];

      const directPhoneIdentifierArray = [
        '16504466743',
        '',
        '%phone[1]%',
        '%phone["area_code_preferences": [*]]%',
        '%phone["area_code_preferences": ["509", *]]%',
        '%phone["area_code_preferences": ["209", "406"]]%',
        '%phone["area_code_preferences": ["209", "406"]]%',
        '%phone["area_code_preferences": [*]]%',
        '%phone["area_code_preferences": [*]]%',
      ];

      await updateTenantPhoneNumbers(ctx, tenant, tenantReservedPhoneNumbers);

      const programRows = await mapSeries(range(9), async i => ({
        data: {
          name: `p${i}`,
          displayName: `p${i}`,
          reportingDisplayName: `p${i}`,
          description: `p${i} description`,
          team: team.name,
          campaign: campaign.name,
          primaryProperty: property.name,
          onSiteLeasingTeam: team.name,
          source: source.name,
          directEmailIdentifier: `p${i}.program`,
          outsideDedicatedEmails: `p${i}@reva.tech`,
          displayEmail: '',
          displayUrl: '',
          directPhoneIdentifier: directPhoneIdentifierArray[i],
          displayPhoneNumber: '',
          voiceMessage: voiceMessage.name,
          path: 'direct',
          enableBotResponseOnCommunications: false,
          endDate: '',
          programFallback: '',
          selectedProperties: '',
          ...metadata,
          ...commsForwardingData,
        },
        index: i,
      }));

      await importPrograms(ctx, programRows);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(9);

      const tenantNumbersAfterImport = await getTenantReservedPhoneNumbers(ctx);

      expect(tenantNumbersAfterImport.length).to.equal(8);
      expect(tenantNumbersAfterImport.filter(t => !t.isUsed).length).to.equal(0);

      const boughtNumbers = tenantNumbersAfterImport.filter(t => !tenantReservedPhoneNumbers.map(tb => tb.phoneNumber).includes(t.phoneNumber));

      expect(boughtNumbers.length).to.equal(3);

      expect(programs.find(p => p.name === programRows[0].data.name).directPhoneIdentifier).to.equal('16504466743');
      expect(programs.find(p => p.name === programRows[1].data.name).directPhoneIdentifier).to.be.null;
      expect(programs.find(p => p.name === programRows[2].data.name).directPhoneIdentifier).to.equal('14083379248');
      expect(programs.find(p => p.name === programRows[5].data.name).directPhoneIdentifier).to.equal('12093258716');
      expect(programs.find(p => p.name === programRows[4].data.name).directPhoneIdentifier).to.equal('15093258699');
      expect(programs.find(p => p.name === programRows[3].data.name).directPhoneIdentifier).to.equal('19513964504');

      expect(boughtNumbers.some(bn => bn.phoneNumber === programs.find(p => p.name === programRows[6].data.name).directPhoneIdentifier)).to.be.true;
      expect(boughtNumbers.some(bn => bn.phoneNumber === programs.find(p => p.name === programRows[7].data.name).directPhoneIdentifier)).to.be.true;
      expect(boughtNumbers.some(bn => bn.phoneNumber === programs.find(p => p.name === programRows[8].data.name).directPhoneIdentifier)).to.be.true;
    });
  });
  describe('when a program has reached the end date', () => {
    it('a new program can be imported using the same phone number', async () => {
      const tenantReservedPhoneNumbers = [
        { phoneNumber: '16504466743' },
        { phoneNumber: '14083379248' },
        { phoneNumber: '12093258716' },
        { phoneNumber: '15093258699' },
        { phoneNumber: '19513964504' },
      ];

      const directPhoneIdentifierArray = ['%phone[0]%', '%phone[1]%'];

      await updateTenantPhoneNumbers(ctx, tenant, tenantReservedPhoneNumbers);

      const programRows = await mapSeries(range(2), async i => ({
        data: {
          name: `p${i}`,
          displayName: `p${i}`,
          reportingDisplayName: `p${i}`,
          description: `p${i} description`,
          team: team.name,
          campaign: campaign.name,
          primaryProperty: property.name,
          onSiteLeasingTeam: team.name,
          source: source.name,
          directEmailIdentifier: `p${i}.program`,
          outsideDedicatedEmails: `p${i}@reva.tech`,
          displayEmail: '',
          displayUrl: '',
          directPhoneIdentifier: directPhoneIdentifierArray[i],
          displayPhoneNumber: '',
          voiceMessage: voiceMessage.name,
          path: 'direct',
          enableBotResponseOnCommunications: false,
          endDate: '',
          programFallback: '',
          selectedProperties: '',
          ...metadata,
          ...commsForwardingData,
        },
        index: i,
      }));

      await importPrograms(ctx, programRows);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(2);

      const tenantNumbersAfterImport = await getTenantReservedPhoneNumbers(ctx);
      expect(tenantNumbersAfterImport.filter(t => !t.isUsed).length).to.equal(3);

      await makeProgramInactive(programRows[0].data.name);
      await detachProgramPhoneNumbers(ctx);

      const tenantNumbersAfterDetach = await getTenantReservedPhoneNumbers(ctx);
      expect(tenantNumbersAfterDetach.filter(t => !t.isUsed).length).to.equal(4);
      const programRowSecondTime = [
        {
          data: {
            name: 'program-x',
            displayName: 'ProgramXDN',
            reportingDisplayName: 'ProgramXDN',
            description: 'Program description',
            team: team.name,
            campaign: campaign.name,
            primaryProperty: property.name,
            onSiteLeasingTeam: team.name,
            source: source.name,
            directEmailIdentifier: 'test.program',
            outsideDedicatedEmails: 'test_email@reva.tech',
            displayEmail: '',
            displayUrl: '',
            directPhoneIdentifier: '%phone[0]%',
            displayPhoneNumber: '',
            voiceMessage: voiceMessage.name,
            path: 'direct',
            enableBotResponseOnCommunications: false,
            endDate: '',
            programFallback: '',
            selectedProperties: '',
            ...metadata,
            ...commsForwardingData,
          },
          index: 1,
        },
      ];
      await importPrograms(ctx, programRowSecondTime);

      const programsSecondTime = await getPrograms(ctx);

      const tenantNumbersAfterSecondImport = await getTenantReservedPhoneNumbers(ctx);
      expect(tenantNumbersAfterSecondImport.filter(t => !t.isUsed).length).to.equal(3);

      expect(programsSecondTime.filter(p => p.directPhoneIdentifier === '16504466743').length).to.equal(2);
    });
  });

  describe('once a program has an end date', () => {
    it('should be able to update the endDate', async () => {
      const initialEndDate = now().add(10, 'days').format('MM/DD/YYYY'); // end date set but program is still active
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      await importPrograms(ctx, programRows);
      let programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(initialEndDate);

      const newEndDate = now().format('MM/DD/YYYY');
      programRows[0].data.endDate = newEndDate;
      await importPrograms(ctx, programRows);
      programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(newEndDate);
    });
  });

  describe('once a program has an end date', () => {
    it('should throw an error on import if the endDate is removed', async () => {
      const endDate = now().add(-10, 'days').format('MM/DD/YYYY');
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      await importPrograms(ctx, programRows);
      let programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(endDate);

      programRows[0].data.endDate = '';
      const importResult = await importPrograms(ctx, programRows);
      const error = importResult.invalidFields[0].invalidFields[0];
      expect(error.name).to.equal(END_DATE);
      expect(error.message).to.equal(REACTIVATED_PROGRAM);

      programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(endDate);
    });
  });

  describe('once a program has reached an end date', () => {
    it('should be able to update the fallback program and other fields', async () => {
      const initialEndDate = now().add(-10, 'days').format('MM/DD/YYYY'); // end date set but program is still active
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];
      await importPrograms(ctx, programRows);
      let programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);
      const programAfterFirstImport = programs[0];

      await detachProgramPhoneNumbers(ctx);

      const newEndDate = now().add(10, 'days').startOf('day');

      const newProgram = await createAProgram({ name: 'programNew', directEmailIdentifier: 'test.program2' });

      const programImportData2 = {
        ...programImportData,
        endDate: newEndDate.format('MM/DD/YYYY'),
        displayName: 'new program display name',
        reportingDisplayName: 'newName',
        description: 'newDescription',
        directPhoneIdentifier: phoneNumbers[2].phoneNumber,
        displayPhoneNumber: phoneNumbers[2].phoneNumber,
        forwardingEnabledFlag: true,
        forwardEmailToExternalTarget: 'test@reva.tech',
        forwardCallToExternalTarget: phoneNumbers[2].phoneNumber,
        forwardSMSToExternalTarget: phoneNumbers[2].phoneNumber,
        enableBotResponseOnCommunications: true,
        programFallback: newProgram.name,
      };

      const programRows2 = [
        {
          data: programImportData2,
          index: 1,
        },
      ];

      await importPrograms(ctx, programRows2);
      programs = await getPrograms(ctx);
      const programAfterSecondImport = programs.find(p => p.name === programImportData.name);

      const valuesThatCanBeDifferent = [
        'programFallbackId',
        'displayName',
        'endDate',
        'reportingDisplayName',
        'description',
        'displayPhoneNumber',
        'metadata',
        'enableBotResponseOnCommunications',
        'updated_at',
      ];

      expect(omit(programAfterFirstImport, valuesThatCanBeDifferent)).to.deep.equal(omit(programAfterSecondImport, valuesThatCanBeDifferent));
      expect(programAfterSecondImport.programFallbackId).to.equal(newProgram.id);
      expect(programAfterSecondImport.displayName).to.equal(programImportData2.displayName);
      expect(programAfterSecondImport.description).to.equal(programImportData2.description);

      expect(programAfterSecondImport.endDate.toISOString()).to.equal(newEndDate.toISOString());
      expect(programAfterSecondImport.displayPhoneNumber).to.equal(programImportData2.displayPhoneNumber);
      // phone numbers are not changed
      expect(programAfterSecondImport.directPhoneIdentifier).to.equal(programImportData.directPhoneIdentifier);
      expect(programAfterSecondImport.enableBotResponseOnCommunications).to.equal(programImportData2.enableBotResponseOnCommunications);

      const metadataAfterImport = programAfterSecondImport.metadata;

      expect(metadataAfterImport.commsForwardingData.forwardingEnabled).to.equal(programImportData2.forwardingEnabledFlag);
      expect(metadataAfterImport.commsForwardingData.forwardSMSToExternalTarget.join(',')).to.equal(programImportData2.forwardSMSToExternalTarget);
      expect(metadataAfterImport.commsForwardingData.forwardCallToExternalTarget).to.equal(programImportData2.forwardCallToExternalTarget);
      expect(metadataAfterImport.commsForwardingData.forwardEmailToExternalTarget.join(',')).to.equal(programImportData2.forwardEmailToExternalTarget);
    });
  });

  describe('once a program has reached an end date', () => {
    it('should not be able to add a phone number to it', async () => {
      const initialEndDate = now().add(-10, 'days').format('MM/DD/YYYY'); // end date set but program is still active
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: '',
        displayPhoneNumber: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];
      await importPrograms(ctx, programRows);
      let programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);

      programImportData.directPhoneIdentifier = phoneNumber;
      programImportData.displayPhoneNumber = phoneNumber;

      const programRows2 = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      await importPrograms(ctx, programRows2);
      programs = await getPrograms(ctx);
      const programAfterSecondImport = programs.find(p => p.name === programImportData.name);

      expect(programAfterSecondImport.directPhoneIdentifier).to.be.null;
      expect(programAfterSecondImport.displayPhoneNumber).to.equal(phoneNumber);
      const phoneNumbers2 = await getTenantReservedPhoneNumbers(ctx);
      const unusedPhoneNumber = phoneNumbers2.find(p => p.phoneNumber === phoneNumber);
      expect(unusedPhoneNumber.isUsed).to.be.undefined;
      expect(unusedPhoneNumber.phoneNumber).to.equal(phoneNumber);
    });
  });

  describe('once a program has a phone number', () => {
    it('updating it will throw an error', async () => {
      const initialEndDate = now().add(10, 'days').format('MM/DD/YYYY'); // end date set but program is still active
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      await importPrograms(ctx, programRows);
      let programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(initialEndDate);

      const newEndDate = now().format('MM/DD/YYYY');
      programRows[0].data.endDate = newEndDate;
      await importPrograms(ctx, programRows);
      programs = await getPrograms(ctx);
      expect(toMoment(programs[0].endDate).format('MM/DD/YYYY')).to.equal(newEndDate);
    });
  });

  describe('importing an inactive program without a fallback', () => {
    it('will add the program and not update the fallback', async () => {
      const endDate = now().add(10, 'days').format('MM/DD/YYYY');
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate,
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      const importResult = await importPrograms(ctx, programRows);
      const error = importResult.invalidFields[0].invalidFields[0];
      expect(error.name).to.equal(PROGRAM_FALLBACK);
      expect(error.message).to.equal(
        `Deactivated program ${programImportData.name} needs to fallback to another active program or to ${PROGRAM_FALLBACK_NONE}`,
      );
    });
  });

  describe('importing an inactive program with an invalid fallback', () => {
    it('will not add the invalid program', async () => {
      const endDate = now().add(10, 'days').format('MM/DD/YYYY');
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate,
        programFallback: 'test',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      const importResult = await importPrograms(ctx, programRows);

      const error = importResult.invalidFields[0].invalidFields[0];
      expect(error.name).to.equal(PROGRAM_FALLBACK);
      expect(error.message).to.equal(`Deactivated program ${programImportData.name} has invalid program fallback ${programImportData.programFallback}`);

      const programs = await getPrograms(ctx);
      expect(programs).to.have.length(0);
    });
  });

  describe('importing an inactive program with a valid fallback', () => {
    it('will add both programs', async () => {
      const endDate = now().add(10, 'days').format('MM/DD/YYYY');
      const phoneNumbers = await getTenantReservedPhoneNumbers(ctx);
      const { phoneNumber } = phoneNumbers[0];
      const { phoneNumber: fallbackPhoneNumber } = phoneNumbers[1];

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: phoneNumber,
        displayPhoneNumber: phoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate,
        programFallback: 'testP',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const validFallbackProgram = {
        name: 'testP',
        displayName: 'ProgramTDN',
        reportingDisplayName: 'ProgramTDN',
        description: 'Program description fallback',
        team: team.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: team.name,
        source: source.name,
        directEmailIdentifier: 'test.fallbackprogram',
        outsideDedicatedEmails: 'fallbacktest_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: fallbackPhoneNumber,
        displayPhoneNumber: fallbackPhoneNumber,
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
        {
          data: validFallbackProgram,
          index: 2,
        },
      ];

      await importPrograms(ctx, programRows);

      const programs = await getPrograms(ctx);
      expect(programs).to.have.length(2);
    });
  });

  describe('if a program has an end date in the future or no end date ', () => {
    it('should not be able have an inactive team and on site leasing team assigned to it', async () => {
      const initialEndDate = now().add(10, 'days').format('MM/DD/YYYY');

      const teamInactive = await createATeam({ name: 'inactiveTeam', inactiveFlag: true });

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: teamInactive.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: teamInactive.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: '',
        displayPhoneNumber: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: '',
        programFallback: '',
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programImportData2 = {
        ...programImportData,
        name: 'testProgram2',
        displayName: 'ProgramXDN2',
        reportingDisplayName: 'ProgramXDN2',
        description: 'Program description2',
        directEmailIdentifier: 'test.program2',
        outsideDedicatedEmails: 'test_email2@reva.tech',
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
        {
          data: programImportData2,
          index: 2,
        },
      ];

      const result = await importPrograms(ctx, programRows);

      expect(result.invalidFields).to.not.be.undefined;
      expect(result.invalidFields.length).to.equal(2);

      const firstRowError = result.invalidFields.find(r => r.index === 1);
      expect(firstRowError.invalidFields.length).to.equal(2);

      const teamError = firstRowError.invalidFields.find(f => f.name === TEAM);
      const leasingError = firstRowError.invalidFields.find(f => f.name === ON_SITE_LEASING_TEAM);

      expect(teamError.message).to.equal(INACTIVE_TEAM_ERROR);
      expect(leasingError.message).to.equal(INACTIVE_TEAM_ERROR);

      const secondRowError = result.invalidFields.find(r => r.index === 2);

      expect(secondRowError.invalidFields.length).to.equal(2);
      const teamError2 = firstRowError.invalidFields.find(f => f.name === TEAM);
      const leasingError2 = firstRowError.invalidFields.find(f => f.name === ON_SITE_LEASING_TEAM);
      expect(teamError2.message).to.equal(INACTIVE_TEAM_ERROR);
      expect(leasingError2.message).to.equal(INACTIVE_TEAM_ERROR);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);
    });
  });

  describe('if a program is inactive', () => {
    it('should be able to have an inactive team and on site leasing team assigned to it', async () => {
      const initialEndDate = now().add(-10, 'days').format('MM/DD/YYYY');

      const teamInactive = await createATeam({ name: 'inactiveTeam' });

      const programImportData = {
        name: 'testProgram',
        displayName: 'ProgramXDN',
        reportingDisplayName: 'ProgramXDN',
        description: 'Program description',
        team: teamInactive.name,
        campaign: campaign.name,
        primaryProperty: property.name,
        onSiteLeasingTeam: teamInactive.name,
        source: source.name,
        directEmailIdentifier: 'test.program',
        outsideDedicatedEmails: 'test_email@reva.tech',
        displayEmail: '',
        displayUrl: '',
        directPhoneIdentifier: '',
        displayPhoneNumber: '',
        voiceMessage: voiceMessage.name,
        path: 'direct',
        enableBotResponseOnCommunications: false,
        endDate: initialEndDate,
        programFallback: PROGRAM_FALLBACK_NONE,
        selectedProperties: '',
        ...metadata,
        ...commsForwardingData,
      };

      const programRows = [
        {
          data: programImportData,
          index: 1,
        },
      ];

      const result = await importPrograms(ctx, programRows);
      expect(result.invalidFields.length).to.equal(0);

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(1);

      await updateTeam(ctx, teamInactive.id, { endDate: now().toISOString() });

      const newEndDate = now().add(-5, 'days').format('MM/DD/YYYY');
      programRows[0].data.endDate = newEndDate;

      const result2 = await importPrograms(ctx, programRows);
      expect(result2.invalidFields.length).to.equal(0);
    });
  });

  describe('when importing a program with forwarding enabled', () => {
    const getProgramRow = commsForwardingData2 => [
      {
        data: {
          name: 'Program1',
          displayName: 'Program1DN',
          reportingDisplayName: 'Program1DN',
          description: 'Program description',
          team: team.name,
          campaign: campaign.name,
          primaryProperty: property.name,
          onSiteLeasingTeam: team.name,
          source: source.name,
          directEmailIdentifier: 'test.program',
          outsideDedicatedEmails: 'test_email@reva.tech',
          displayEmail: '',
          displayUrl: '',
          directPhoneIdentifier: '%phone[0]%',
          displayPhoneNumber: '',
          voiceMessage: voiceMessage.name,
          path: 'direct',
          enableBotResponseOnCommunications: false,
          endDate: '',
          programFallback: '',
          selectedProperties: '',
          ...metadata,
          ...commsForwardingData2,
        },
        index: 1,
      },
    ];

    it('the forwardEmailToExternalTarget, forwardCallToExternalTarget, forwardSMSToExternalTarget fields need to be set', async () => {
      const commsForwardingData2 = {
        forwardingEnabledFlag: 'X',
        forwardEmailToExternalTarget: '',
        forwardCallToExternalTarget: '',
        forwardSMSToExternalTarget: '',
      };

      const programRow = getProgramRow(commsForwardingData2);

      const { invalidFields } = await importPrograms(ctx, programRow);

      const errors = invalidFields[0].invalidFields.map(i => i.message);

      expect(errors.length).to.equal(4);

      expect(errors).to.include('REQUIRED_EXTERNAL_TARGET_FOR_EMAILS');
      expect(errors).to.include('REQUIRED_EXTERNAL_TARGET_FOR_CALLS');
      expect(errors).to.include('REQUIRED_EXTERNAL_TARGET_FOR_SMS');
      expect(errors).to.include('INVALID_FIELD');

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);
    });

    it('the forwardEmailToExternalTarget must be a valid email', async () => {
      const commsForwardingData2 = {
        forwardingEnabledFlag: 'X',
        forwardEmailToExternalTarget: 'invalid',
        forwardCallToExternalTarget: '16504466743',
        forwardSMSToExternalTarget: '16504466743',
      };

      const programRow = getProgramRow(commsForwardingData2);
      const { invalidFields } = await importPrograms(ctx, programRow);

      const error = invalidFields[0].invalidFields[0];

      expect(error.message).to.equal('INVALID_MAIL_ARRAY');
      expect(error.name).to.equal('forwardEmailToExternalTarget');

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);
    });

    it('the forwardCallToExternalTarget must be a valid phone', async () => {
      const commsForwardingData2 = {
        forwardingEnabledFlag: 'X',
        forwardEmailToExternalTarget: 'test@reva.tech',
        forwardCallToExternalTarget: '1650446',
        forwardSMSToExternalTarget: '16504466743',
      };

      const programRow = getProgramRow(commsForwardingData2);
      const { invalidFields } = await importPrograms(ctx, programRow);

      const error = invalidFields[0].invalidFields[0];

      expect(error.message).to.equal('INVALID_FIELD');
      expect(error.name).to.equal('forwardCallToExternalTarget');

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);
    });

    it('the forwardSMSToExternalTarget must be a valid phone or email', async () => {
      const commsForwardingData2 = {
        forwardingEnabledFlag: 'X',
        forwardEmailToExternalTarget: 'test@reva.tech',
        forwardCallToExternalTarget: '16504466743',
        forwardSMSToExternalTarget: '1650446',
      };

      let programRow = getProgramRow(commsForwardingData2);
      const { invalidFields } = await importPrograms(ctx, programRow);

      let error = invalidFields[0].invalidFields[0];

      expect(error.message).to.contain('INVALID_FIELD');
      expect(error.name).to.equal('forwardSMSToExternalTarget');

      commsForwardingData2.forwardSMSToExternalTarget = 'mails';

      programRow = getProgramRow(commsForwardingData2);
      const { invalidFields: invalidFields2 } = await importPrograms(ctx, programRow);

      error = invalidFields2[0].invalidFields[0];

      expect(error.message).to.contain('INVALID_FIELD');
      expect(error.name).to.equal('forwardSMSToExternalTarget');

      const programs = await getPrograms(ctx);
      expect(programs.length).to.equal(0);
    });
  });
});

describe('inventory/referrers', () => {
  const importProgram = async () => {
    const source = await createASource('testSource', 'test source display name', 'desc', 'type');
    const team = await createATeam();
    const property = await createAProperty();
    const voiceMessage = await createVoiceMessages();
    const campaign = await createACampaign('Campaign1', 'Campaign1DN', 'Campaign Description');
    const metadata = {
      defaultMatchingPath: null,
      requireMatchingPathFlag: true,
      requireMatchingSourceFlag: true,
      defaultMatchingSource: null,
      activatePaymentPlan: true,
      gaIds: '',
      gaActions: '',
    };
    const commsForwardingData = {
      forwardingEnabledFlag: false,
      forwardEmailToExternalTarget: '',
      forwardCallToExternalTarget: '',
      forwardSMSToExternalTarget: '',
    };

    const programRows = [
      {
        data: {
          name: 'Program1',
          displayName: 'Program1DN',
          reportingDisplayName: 'Program1DN',
          description: 'Program description',
          team: team.name,
          campaign: campaign.name,
          primaryProperty: property.name,
          onSiteLeasingTeam: team.name,
          source: source.name,
          directEmailIdentifier: 'test.program',
          displayEmail: '',
          displayUrl: '',
          outsideDedicatedEmails: 'test_email@reva.tech',
          directPhoneIdentifier: '%phone[0]%',
          displayPhoneNumber: '%phone[0]%',
          voiceMessage: voiceMessage.name,
          path: 'direct',
          enableBotResponseOnCommunications: false,
          endDate: '',
          programFallback: '',
          selectedProperties: '',
          ...metadata,
          ...commsForwardingData,
        },
        index: 1,
      },
    ];
    await importPrograms(ctx, programRows);
  };

  describe('when importing a new program referrer', () => {
    describe('when fields are invalid', () => {
      it('will not save the referrer', async () => {
        await importProgram();

        const referrerRows = [
          {
            data: { program: 'Program1', order: '1.01', currentUrl: '[bing', referrerUrl: '[test', description: 'a random text', inactive: false },
            index: 1,
          },
        ];

        await importProgramReferrers(ctx, referrerRows);
        const referrers = await getProgramReferrers(ctx);
        expect(referrers.length).to.equal(0);
      });
    });

    it('will save the referrer', async () => {
      await importProgram();
      const [{ id: programId }] = await getPrograms(ctx);

      const referrerData = {
        order: '1.01',
        currentUrl: 'bing(.*).com(.*)',
        referrerUrl: 'google(.*).com(.*)',
        description: 'a random text',
      };

      const referrerRows = [
        {
          data: { program: 'Program1', defaultFlag: true, inactiveFlag: false, ...referrerData },
          index: 1,
        },
      ];

      await importProgramReferrers(ctx, referrerRows);
      const referrers = await getProgramReferrers(ctx);
      expect(referrers.length).to.equal(1);

      sinon.assert.match(referrers[0], { programId, ...referrerData });
    });
  });

  describe('when importing an existing program referrer', () => {
    it('will update the existing referrer', async () => {
      await importProgram();
      const [{ id: programId }] = await getPrograms(ctx);

      const referrerData = {
        order: '1.02',
        currentUrl: 'bing(.*).com(.*)',
        referrerUrl: 'google(.*).com(.*)',
        description: 'a random text',
      };

      const referrerRows = [
        {
          data: { program: 'Program1', defaultFlag: true, inactiveFlag: false, ...referrerData },
          index: 1,
        },
      ];

      await importProgramReferrers(ctx, referrerRows);

      const newReferrerData = {
        order: '1.02',
        currentUrl: 'duckduckgo(.*).com(.*)',
        referrerUrl: 'yahoo(.*).com(.*)',
        description: 'a random text',
      };

      const newReferrerRows = [
        {
          data: { program: 'Program1', defaultFlag: true, inactiveFlag: false, ...newReferrerData },
          index: 1,
        },
      ];

      await importProgramReferrers(ctx, newReferrerRows);
      const referrers = await getProgramReferrers(ctx);
      expect(referrers.length).to.equal(1);

      sinon.assert.match(referrers[0], { programId, ...newReferrerData });
    });
  });
});

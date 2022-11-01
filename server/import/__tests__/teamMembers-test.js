/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import newUUID from 'uuid/v4';
import { MainRoleDefinition } from '../../../common/acd/rolesDefinition';
const { mockModules } = require('test-helpers/mocker').default(jest);

describe('when import teamMembers sheet', () => {
  let customTeamMembersValidations;

  beforeEach(() => {
    jest.resetModules();
    mockModules({
      '../../dal/teamsRepo.js': {
        getTeamBy: jest.fn(),
        areAllRolesValid: jest.fn(() => true),
      },
      '../../dal/usersRepo.js': {
        getUserByExternalUniqueId: jest.fn(),
      },

      '../../dal/voiceMessageRepo.js': {
        getVoiceMessageByName: jest.fn(),
      },

      '../../dal/tenantsRepo.js': {
        getTenantReservedPhoneNumbers: jest.fn(),
      },
    });

    const teamMembers = require('../inventory/teamMembers'); // eslint-disable-line global-require

    customTeamMembersValidations = teamMembers.customTeamMembersValidations;
  });

  it('when importing members from teamMembers sheet should not throw an error', async () => {
    const member = {
      team: 'theHU',
      userUniqueId: 'skahn',
      roles: MainRoleDefinition.LM.name,
      voiceMessage: 'voiceMessage1',
      userId: newUUID(),
      voiceMessageId: newUUID(),
      teamId: newUUID(),
    };

    const result = await customTeamMembersValidations({
      member,
      members: [member],
      tenantReservedPhoneNumbers: [],
    });

    expect(result.validation.length).to.equal(0);
  });
});

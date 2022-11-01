/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { expect } from 'chai';
import { getInvalidTeams } from '../helpers/dataSanityCheck';
import { getFunctionalRoleNames, getMandatoryFunctionalRoles, getFunctionalRolesHavingMaxMembersLimit } from '../../../common/acd/rolesDefinition';

describe('dataSanityCheck-test', () => {
  const functionalRoles = getFunctionalRoleNames();
  const mandatoryFunctionalRoles = getMandatoryFunctionalRoles();
  const functionalRolesWithMaxLimit = getFunctionalRolesHavingMaxMembersLimit();

  describe('when there is no member in team', () => {
    it('the result should contain all mandatory functional roles', () => {
      const teams = [
        {
          displayName: 'T1',
          teamMembers: [],
        },
      ];

      const validationResult = getInvalidTeams(teams);
      expect(validationResult[0].team).to.equal(teams[0].displayName);
      expect(validationResult[0].noMemberWithRoles.sort()).to.deep.equal(mandatoryFunctionalRoles.sort());
    });
  });

  describe('when there is no missing mandatory functional role in team', () => {
    describe('and all functional roles are taken by the same member', () => {
      it('the result should contain no errors', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles: mandatoryFunctionalRoles,
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult.length).to.equal(0);
      });
    });

    describe('and functional roles are taken by different members', () => {
      it('the result should contain no errors', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles: mandatoryFunctionalRoles[0],
              },
              {
                functionalRoles: mandatoryFunctionalRoles.slice(1),
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult.length).to.equal(0);
      });
    });
  });

  describe('when only one mandatory functional role is taken', () => {
    it('the result should contain a list with the other functional roles', () => {
      const teams = [
        {
          displayName: 'T1',
          teamMembers: [
            {
              functionalRoles: mandatoryFunctionalRoles.sort()[0],
            },
          ],
        },
      ];

      const validationResult = getInvalidTeams(teams);
      expect(validationResult[0].noMemberWithRoles.sort()).to.deep.equal(mandatoryFunctionalRoles.slice(1).sort());
    });
  });

  describe('when there should be only one member with the same role (eg. LD) in team', () => {
    const firstRoleWithMaxLimit = functionalRolesWithMaxLimit[0];

    describe('and the role is taken by only one member', () => {
      it('the result should contain no errors', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles: firstRoleWithMaxLimit,
              },
              {
                functionalRoles: functionalRoles.filter(role => role !== firstRoleWithMaxLimit),
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult.length).to.equal(0);
      });
    });

    describe('and the role is taken by two members', () => {
      it('the result should contain a list with the missing functional roles and a list with the roles taken by multiple members', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles: firstRoleWithMaxLimit,
              },
              {
                functionalRoles,
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult[0].tooManyMembersWithRoles).to.deep.equal(['LD']);
      });
    });
  });

  describe('when there can be more than one member with the same role (eg. LAA, LCD) in team', () => {
    describe('and the role is taken by only one member', () => {
      it('the result should contain no errors', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles,
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult.length).to.equal(0);
      });
    });

    describe('and the role is taken by two members', () => {
      it('the result should contain no errors', () => {
        const teams = [
          {
            displayName: 'T1',
            teamMembers: [
              {
                functionalRoles,
              },
              {
                functionalRoles: functionalRoles.find(role => !functionalRolesWithMaxLimit.includes(role)),
              },
            ],
          },
        ];

        const validationResult = getInvalidTeams(teams);
        expect(validationResult.length).to.equal(0);
      });
    });
  });
});

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import omit from 'lodash/omit';
import partition from 'lodash/partition';
import { mapSeries } from 'bluebird';
import { getProperties } from '../../dal/propertyRepo';
import { getNewEndedPrograms, updateProgram } from '../../dal/programsRepo';
import { now } from '../../../common/helpers/moment-utils';
import { FunctionalRoleDefinition, getMandatoryFunctionalRoles, getFunctionalRolesHavingMaxMembersLimit } from '../../../common/acd/rolesDefinition';
import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'dataSanityCheck' });

const isRoleInUseByTooManyMembers = (teamMembers, roleName) => {
  const membersHavingRole = teamMembers.filter(member => member.functionalRoles.includes(roleName));
  const role = FunctionalRoleDefinition[roleName];

  return role.maxMembersWithThisRole ? membersHavingRole.length > role.maxMembersWithThisRole : false;
};

const isRoleInUse = (teamMembers, roleName) => teamMembers.some(member => member.functionalRoles.includes(roleName));

const getMandatoryFunctionalRolesNotUsed = teamMembers => {
  // the team should have at least one member with these roles
  const mandatoryFunctionalRoles = getMandatoryFunctionalRoles();

  return mandatoryFunctionalRoles.reduce((result, roleName) => (isRoleInUse(teamMembers, roleName) ? result : [...result, roleName]), []);
};

const getFunctionalRolesUsedByTooManyMembers = teamMembers => {
  // the team should have {max} members with these roles
  const functionalRolesWithMaxLimit = getFunctionalRolesHavingMaxMembersLimit();

  return functionalRolesWithMaxLimit.reduce((result, roleName) => (isRoleInUseByTooManyMembers(teamMembers, roleName) ? [...result, roleName] : result), []);
};

export const getInvalidTeams = teams =>
  teams.reduce((sanityCheckResult, team) => {
    const activeTeamMembers = team.teamMembers.filter(tm => !tm.inactive);
    const noMemberWithRoles = getMandatoryFunctionalRolesNotUsed(activeTeamMembers);
    const tooManyMembersWithRoles = getFunctionalRolesUsedByTooManyMembers(activeTeamMembers);

    if (noMemberWithRoles.length || tooManyMembersWithRoles.length) {
      return [
        ...sanityCheckResult,
        {
          team: team.displayName,
          noMemberWithRoles: noMemberWithRoles.length ? noMemberWithRoles : undefined,
          tooManyMembersWithRoles: tooManyMembersWithRoles.length ? tooManyMembersWithRoles : undefined,
        },
      ];
    }
    return sanityCheckResult;
  }, []);

// teamsPropertiesPrograms: { teamId, teamName, propertyId, propertyName, programId, commDirection, programName, displayEmail, displayPhoneNumber }
export const getInvalidOutCommSetup = (teamsPropertiesCombinations, outPrograms) => {
  const isOutProgramWithNoPhone = (teamId, propertyId) =>
    outPrograms.some(oc => oc.propertyId === propertyId && oc.teamId === teamId && !oc.displayPhoneNumber);

  const teamsPropertiesWithInvalidPrograms = teamsPropertiesCombinations.reduce((acc, tpc) => {
    const { teamId, propertyId } = tpc;
    if (isOutProgramWithNoPhone(teamId, propertyId)) {
      const program = outPrograms.find(c => c.teamId === teamId && c.propertyId === propertyId);
      return [
        ...acc,
        {
          programName: program.name,
          errorMessage: `No phone number set in 'displayPhoneNumber' field for program: ${program.name} in 'Programs' sheet`,
        },
      ];
    }
    return acc;
  }, []);

  return teamsPropertiesWithInvalidPrograms;
};

const getInvalidEndedDefaultPrograms = (newInactivePrograms, properties) =>
  newInactivePrograms.reduce((acc, program) => {
    const defaultProgramForProperties = properties.filter(prop => {
      const { defaultOutgoingProgram, defaultPropertyProgram } = prop.settings.comms;
      return (
        !prop.inactive &&
        ((defaultOutgoingProgram && program.id === defaultOutgoingProgram) || (defaultPropertyProgram && program.id === defaultPropertyProgram))
      );
    });

    if (defaultProgramForProperties.length) {
      return [
        ...acc,
        {
          programName: program.name,
          errorMessage: `End date was set on ${program.name} but the program is used as default program for properties: ${defaultProgramForProperties
            .map(p => p.name)
            .join(', ')}`,
        },
      ];
    }
    return acc;
  }, []);

const getInvalidEndedOutPrograms = (newInactivePrograms, outPrograms) =>
  newInactivePrograms.reduce((acc, program) => {
    const inactiveOutProgram = outPrograms.find(op => program.id === op.programId);

    if (inactiveOutProgram) {
      return [
        ...acc,
        {
          programName: program.name,
          errorMessage: `End date was set on ${program.name} but the program is used as outgoing program.`,
        },
      ];
    }
    return acc;
  }, []);

export const validateAndUpdateNewEndedPrograms = async (ctx, outPrograms) => {
  const newInactivePrograms = await getNewEndedPrograms(ctx);
  const properties = await getProperties(ctx);

  const invalidInactiveDefaultPrograms = getInvalidEndedDefaultPrograms(newInactivePrograms, properties);
  const invalidInactiveOutPrograms = getInvalidEndedOutPrograms(newInactivePrograms, outPrograms);

  const inactiveProgramsErrors = [...invalidInactiveDefaultPrograms, ...invalidInactiveOutPrograms];
  const [endedPrograms, invalidEndedPrograms] = partition(newInactivePrograms, nip => !inactiveProgramsErrors.some(ip => ip.programName === nip.name));

  await mapSeries(endedPrograms, async program => {
    const endProgramData = {
      endDate: program.metadata.tentativeEndDate,
      endDateSetOn: now().toISOString(),
      metadata: omit(program.metadata, ['tentativeEndDate']),
    };
    try {
      await updateProgram(ctx, program.name, endProgramData);
    } catch (error) {
      logger.error({ ctx, error, program, endProgramData }, 'validateAndUpdateNewEndedPrograms - save program endDate error');

      invalidEndedPrograms.push(program);
    }
  });

  await mapSeries(invalidEndedPrograms, async program => await updateProgram(ctx, program.name, { metadata: omit(program.metadata, ['tentativeEndDate']) }));

  return inactiveProgramsErrors;
};

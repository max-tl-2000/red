/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import { saveTeamMember, areAllRolesValid, getExtendedTeamMembers, getTeamsFromTenant } from '../../dal/teamsRepo';
import { getUsers } from '../../dal/usersRepo';
import { getTenantReservedPhoneNumbers } from '../../dal/tenantsRepo';
import { getAllVoiceMessages } from '../../dal/voiceMessageRepo';
import { validate, Validation, convertStringValueToArray } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getValidationMessagesForPlaceholders, getPhoneRankForRow } from './phoneUtils';
import { handleUserDeactivationInTeam } from '../../services/teamMembers';
import { CalendarActionTypes } from '../../../common/enums/calendarTypes';
import { addMessage } from '../../helpers/externalCalendarUtils';
import { isCalendarIntegrationEnabled } from '../../services/externalCalendars/cronofyService';
import { updateStatusForUsers } from '../../services/users';
import { getAllWhere } from '../../database/factory';
import { spreadsheet } from '../../../common/helpers/spreadsheet';
import { FunctionalRoleDefinition, MainRoleDefinition } from '../../../common/acd/rolesDefinition';
import { deleteAllTeamMemberAvailabilities } from '../../dal/floatingAgentsRepo';
import { isPhoneAreaPreferencesPlaceHolder, getPhoneNumber } from '../../helpers/phoneUtils';
import { replaceEmptySpaces } from '../../../common/helpers/utils';
import { extractValuesFromCommaSeparatedString } from '../../../common/helpers/strings';
import { PhoneOwnerType } from '../../../common/enums/enums';
import eventTypes from '../../../common/enums/eventTypes';
import { DALTypes } from '../../../common/enums/DALTypes';
import { notify } from '../../../common/server/notificationClient';
import { getInvalidTeams } from '../helpers/dataSanityCheck';
import { sanitizeDirectEmailIdentifier } from '../../../common/helpers/mails';

const USER_UNIQUE_ID = 'userUniqueId';
const INVALID_USER_UNIQUE_ID = 'INVALID_USER_UNIQUE_ID_FOR_MEMBER';
const MEMBER_TEAM = 'team';
const INVALID_TEAM = 'INVALID_TEAM_SPECIFIED_FOR_MEMBER';
const ROLES = 'roles';
const INVALID_ROLES = 'INVALID_ROLES_SPECIFIED_FOR_MEMBER';
const PHONENO = 'directPhoneIdentifier';
const DUPLICATE_USER_IN_TEAM = 'DUPLICATE_USER_IN_TEAM';
const VOICE_MESSAGE = 'Voice Message';
const INVALID_VOICE_MESSAGE = 'Invalid voice message';
const LAA_ACCESS_LEVELS = 'LAA Access Levels';
const INVALID_LAA_ACCESS_LEVELS = 'Invalid LAA Access Level specified';
const INVALID_LAA_ACCESS_LEVELS_ASSIGNED = 'LAA Access Levels cannot be assigned to a user that is not LAA';

import loggerModule from '../../../common/helpers/logger';

const logger = loggerModule.child({ subType: 'phoneUtils' });

const membersRequiredFields = [
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'userUniqueId',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'roles',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'externalId',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'inactiveFlag',
    validation: [Validation.BOOLEAN],
    maxLength: DBColumnLength.State,
  },
  {
    fieldName: 'directEmailIdentifier',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Email,
  },
  {
    fieldName: 'outsideDedicatedEmails',
    validation: [Validation.MAIL_ARRAY],
    maxLength: DBColumnLength.DESCRIPTION,
  },
  {
    fieldName: 'directPhoneIdentifier',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Description,
  },
  {
    fieldName: 'voiceMessage',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const isDeactivatedTeamMember = (existingTeamMember, member, validation) => {
  if (validation.length > 0) return false;
  return existingTeamMember && !existingTeamMember.inactive && member.inactiveFlag;
};

export const customTeamMembersValidations = async ({ member, members, tenantReservedPhoneNumbers }) => {
  const validation = [];

  if (!member.teamId) {
    validation.push({
      name: MEMBER_TEAM,
      message: INVALID_TEAM,
    });
  }

  if (!member.userId) {
    validation.push({
      name: USER_UNIQUE_ID,
      message: INVALID_USER_UNIQUE_ID,
    });
  }

  const areRolesValid = await areAllRolesValid(member.userRoles);
  if (!areRolesValid) {
    validation.push({
      name: ROLES,
      message: INVALID_ROLES,
    });
  }

  if (!member.voiceMessageId) {
    validation.push({
      name: VOICE_MESSAGE,
      message: INVALID_VOICE_MESSAGE,
    });
  }

  const existingTeamMember = member.dbMember;
  if (existingTeamMember && existingTeamMember.directPhoneIdentifier && isPhoneAreaPreferencesPlaceHolder(member.directPhoneIdentifier)) {
    member.directPhoneIdentifier = existingTeamMember.directPhoneIdentifier;
  }

  if (member.directPhoneIdentifier) {
    const validationError = getValidationMessagesForPlaceholders({
      tenantReservedPhoneNumbers,
      excelPhoneNumber: member.directPhoneIdentifier.toString(),
      determinedNumber: member.programDirectPhoneIdentifier,
      ownerType: PhoneOwnerType.TEAM_MEMBER,
      ownerId: existingTeamMember?.id,
    });

    if (validationError) {
      validation.push({
        name: PHONENO,
        message: validationError,
      });
    }
  }

  if (member.userRoles) {
    if (member.userRoles.includes(FunctionalRoleDefinition.LAA.name)) {
      if (
        member.laaAccessLevels.length &&
        !member.laaAccessLevels.every(role =>
          [DALTypes.LAAAccessLevels.APPROVED_SCREENING, DALTypes.LAAAccessLevels.CONDITIONAL_SCREENING, DALTypes.LAAAccessLevels.DENIED_SCREENING].includes(
            role,
          ),
        )
      ) {
        validation.push({
          name: LAA_ACCESS_LEVELS,
          message: INVALID_LAA_ACCESS_LEVELS,
        });
      }
    } else if (member.laaAccessLevels.length) {
      validation.push({
        name: LAA_ACCESS_LEVELS,
        message: INVALID_LAA_ACCESS_LEVELS_ASSIGNED,
      });
    }
  }

  // check for team/user duplication
  const isUserDuplicatedInTeam = members.filter(m => m.userUniqueId === member.userUniqueId && m.team === member.team).length > 1;
  if (isUserDuplicatedInTeam) {
    validation.push({
      name: MEMBER_TEAM,
      message: DUPLICATE_USER_IN_TEAM,
    });
  }

  return {
    validation,
    deactivatedTeamMember: isDeactivatedTeamMember(existingTeamMember, member, validation) ? { userId: member.userId, teamId: member.teamId } : null,
  };
};

const handleTeamMemberDeactivations = async (ctx, deactivatedTeamMembers) =>
  await mapSeries(deactivatedTeamMembers, async teamMember => await handleUserDeactivationInTeam(ctx, teamMember.userId, teamMember.teamId));

const syncCalendarAccounts = async (ctx, members, action) => await mapSeries(members, async member => await addMessage(ctx, action, member.externalUniqueId));

const getInactiveUsers = async (teamMembers, users) => {
  const activeUsers = users.filter(u => teamMembers.some(tm => tm.userId === u.id && !tm.inactive));
  return users.filter(u => !activeUsers.some(au => au.id === u.id));
};

const handleCalendarSyncOnTeamMembers = async (ctx, dbTeamMembers) => {
  if (await isCalendarIntegrationEnabled(ctx)) {
    const users = await getUsers(ctx);
    const inactiveUsersBeforeProcessing = await getInactiveUsers(dbTeamMembers, users);
    const currentTeamMembers = await getAllWhere(ctx, 'TeamMembers', {});
    const inactiveUsersAfterProcessing = await getInactiveUsers(currentTeamMembers, users);
    const inactiveUsers = inactiveUsersAfterProcessing.filter(
      u => !inactiveUsersBeforeProcessing.some(ib => u.id === ib.id) && u.externalCalendars && u.externalCalendars.revaCalendarId,
    );

    await syncCalendarAccounts(ctx, inactiveUsers, CalendarActionTypes.REMOVE_ACCOUNT);

    const activeUsersWithNoSetup = users.filter(
      u =>
        !inactiveUsersAfterProcessing.some(iu => iu.id === u.id) &&
        u.externalCalendars &&
        u.externalCalendars.calendarAccount &&
        !u.externalCalendars.revaCalendarId,
    );

    await syncCalendarAccounts(ctx, activeUsersWithNoSetup, CalendarActionTypes.ADD_ACCOUNT);

    const activeUsersWithRemovedAccount = users.filter(
      u =>
        !inactiveUsersAfterProcessing.some(iu => iu.id === u.id) &&
        u.externalCalendars &&
        !u.externalCalendars.calendarAccount &&
        u.externalCalendars.revaCalendarId,
    );

    await syncCalendarAccounts(ctx, activeUsersWithRemovedAccount, CalendarActionTypes.REMOVE_ACCOUNT);
  }
};

const getWorkingAgentsFromTeamMembers = teamMembers =>
  teamMembers.filter(t => t.inactive === false && t.functionalRoles.includes(FunctionalRoleDefinition.LWA.name));

const getTeamMembersForRemovingAvailabilities = (currentTeamMembers, teamsWhereUserWasMadeInactive) => {
  if (teamsWhereUserWasMadeInactive.length === 0) return [];
  const inactivitiesWhereUserWasAgent = currentTeamMembers.filter(g => teamsWhereUserWasMadeInactive.some(i => i.teamId === g.teamId));

  if (currentTeamMembers.length - inactivitiesWhereUserWasAgent.length > 1) {
    // user is still agent in more than one team so we only remove the availabilities for the ones where he was made inactive
    return inactivitiesWhereUserWasAgent.map(i => i.id);
  }
  // user was made inactive in all the teams or he only remains active in one, so he is no longer a multi team user and we need to delete all the availabilities
  return currentTeamMembers.map(i => i.id);
};

const removeFloatingAgentsAvailabilities = async (ctx, deactivatedTeamMembers, dbTeamMembers) => {
  if (!deactivatedTeamMembers || deactivatedTeamMembers.length === 0) return;
  let teamMembersToRemove = [];
  const dbAgentsBeforeImport = getWorkingAgentsFromTeamMembers(dbTeamMembers);
  const groupedAgents = groupBy(dbAgentsBeforeImport, tm => tm.userId);
  const multiTeamAgents = Object.keys(groupedAgents).filter(group => groupedAgents[group].length > 1);

  await mapSeries(multiTeamAgents, async group => {
    const teamsWhereUserWasMadeInactive = deactivatedTeamMembers.filter(t => t.userId === group);
    teamMembersToRemove = teamMembersToRemove.concat(getTeamMembersForRemovingAvailabilities(groupedAgents[group], teamsWhereUserWasMadeInactive));
  });
  await deleteAllTeamMemberAvailabilities(ctx, teamMembersToRemove);
};

const shouldReassignPartiesForInactiveUsers = true;

const getDirectPhoneIdentifier = async (ctx, { directPhoneIdentifier, tenantReservedPhoneNumbers, dbMember }) => {
  if (dbMember && dbMember.directPhoneIdentifier && isPhoneAreaPreferencesPlaceHolder(replaceEmptySpaces(directPhoneIdentifier.toString()))) {
    return dbMember.directPhoneIdentifier;
  }
  return await getPhoneNumber({
    ctx,
    tenantReservedPhoneNumbers,
    excelPhoneNumber: directPhoneIdentifier,
    ownerType: PhoneOwnerType.TEAM_MEMBER,
    ownerId: dbMember?.id,
  });
};

const enhanceTeamMembers = async ({ ctx, members, dbMembers }) => {
  logger.trace({ ctx }, 'enhancing team members with phone information');
  const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);
  const dbTeams = await getTeamsFromTenant(ctx.tenantId, false);
  const dbUsers = await getUsers(ctx);
  const dbVoiceMessages = await getAllVoiceMessages(ctx);

  return await mapSeries(members, async row => {
    logger.trace({ ctx, rowIndex: row.index, team: row.data.team, user: row.data.userUniqueId }, 'determining phone information for team member');
    const teamMemberData = row.data;
    const { directPhoneIdentifier } = teamMemberData;

    const team = dbTeams.find(t => t.name === teamMemberData.team);
    const user = dbUsers.find(u => u.externalUniqueId === teamMemberData.userUniqueId);

    const userRoles = extractValuesFromCommaSeparatedString(teamMemberData.roles);
    const laaAccessLevels = teamMemberData.laaAccessLevels ? extractValuesFromCommaSeparatedString(teamMemberData.laaAccessLevels) : [];
    const voiceMessage = dbVoiceMessages.find(v => v.name === teamMemberData.voiceMessage);

    const dbMember = team && user && dbMembers.find(m => m.teamId === team.id && m.userId === user.id);

    const programDirectPhoneIdentifier = await getDirectPhoneIdentifier(ctx, {
      directPhoneIdentifier,
      tenantReservedPhoneNumbers,
      dbMember,
    });

    if (programDirectPhoneIdentifier) {
      if (!tenantReservedPhoneNumbers.some(t => t.phoneNumber === programDirectPhoneIdentifier)) {
        tenantReservedPhoneNumbers.push({ phoneNumber: programDirectPhoneIdentifier, isUsed: true });
      } else {
        tenantReservedPhoneNumbers.map(t => {
          if (t.phoneNumber === programDirectPhoneIdentifier) t.isUsed = true;
          return t;
        });
      }
    }

    return {
      ...row,
      data: {
        ...row.data,
        programDirectPhoneIdentifier,
        teamId: team?.id,
        dbMember,
        userRoles,
        laaAccessLevels,
        userId: user?.id,
        voiceMessageId: voiceMessage?.id,
      },
    };
  });
};

const enhanceMembersWithRankInformation = members =>
  members.map(m => ({
    ...m,
    data: {
      ...m.data,
      rank: getPhoneRankForRow(m.data.directPhoneIdentifier),
    },
  }));

const constructTeamsForDataSanityValidation = teamMembers => {
  const modulesForTeams = {};
  const groupedByTeam = teamMembers.reduce((acc, teamMember) => {
    // exclude reva admin from this validation
    if (teamMember.externalUniqueId?.trim?.() === 'reva') return acc;

    if (!modulesForTeams[teamMember.teamName]) {
      modulesForTeams[teamMember.teamName] = teamMember.module;
    }

    acc[teamMember.teamName] = [...(acc[teamMember.teamName] || []), teamMember];
    return acc;
  }, {});
  const res = Object.entries(groupedByTeam).map(([key, value]) => ({
    displayName: key,
    module: modulesForTeams[key],
    teamMembers: value || [],
  }));
  return res;
};

export const additionalTeamMembersValidation = async ctx => {
  const dbTeamMembers = await getExtendedTeamMembers(ctx);
  const teams = constructTeamsForDataSanityValidation(dbTeamMembers);

  const invalidTeams = getInvalidTeams(teams);

  if (!invalidTeams.length) return [];

  throw new Error(`Team members sheet not imported\n. INVALID TEAMS: ${JSON.stringify(invalidTeams, null, 2)}`);
};

const getInactiveUserIds = async (deactivatedMembers, dbTeamMembers) =>
  deactivatedMembers.reduce((ids, deactivatedMember) => {
    if (!ids.includes(deactivatedMember.userId)) {
      const countUserInTeamMembers = dbTeamMembers.filter(teamMember => teamMember.userId === deactivatedMember.userId && teamMember.inactive === false).length;
      const countUserInDeactivatedTeamMembers = deactivatedMembers.filter(teamMember => teamMember.userId === deactivatedMember.userId).length;

      if (countUserInTeamMembers === countUserInDeactivatedTeamMembers) {
        ids.push(deactivatedMember.userId);
      }
    }

    return ids;
  }, []);

const prepareAndSaveTeamMember = async (ctx, member) => {
  const memberPhone = member.programDirectPhoneIdentifier || member.directPhoneIdentifier;

  const teamMemberToDbModel = {
    teamId: member.teamId,
    userId: member.userId,
    mainRoles: member.userRoles.filter(role => MainRoleDefinition[role]) || [],
    functionalRoles: member.userRoles.filter(role => FunctionalRoleDefinition[role]) || [],
    laaAccessLevels: member.laaAccessLevels,
    inactive: member.inactiveFlag,
    directPhoneIdentifier: memberPhone,
    directEmailIdentifier: sanitizeDirectEmailIdentifier(member.directEmailIdentifier),
    outsideDedicatedEmails: member.outsideDedicatedEmails,
    voiceMessageId: member.voiceMessageId,
    externalId: member.externalId,
  };
  await saveTeamMember(ctx, teamMemberToDbModel);
};

export const importTeamMembers = async (ctx, members) => {
  const dbTeamMembers = await getAllWhere(ctx, 'TeamMembers', {});
  const deactivatedTeamMembers = [];

  let teamMembersRanked = enhanceMembersWithRankInformation(members);
  teamMembersRanked = orderBy(teamMembersRanked, ['data.rank', 'data.directPhoneIdentifier'], ['asc', 'asc']);
  const enhancedMembers = await enhanceTeamMembers({ ctx, members: teamMembersRanked, dbMembers: dbTeamMembers });

  const tenantReservedPhoneNumbers = await getTenantReservedPhoneNumbers(ctx);
  const invalidFields = await validate(
    enhancedMembers,
    {
      requiredFields: membersRequiredFields,
      async onValidEntity(member) {
        const outsideDedicatedEmails = convertStringValueToArray(member.outsideDedicatedEmails);
        await prepareAndSaveTeamMember(ctx, { ...member, outsideDedicatedEmails });
      },
      async customCheck(member) {
        const { validation, deactivatedTeamMember } = await customTeamMembersValidations({
          member,
          members: members.map(m => m.data),
          tenantReservedPhoneNumbers,
        });
        deactivatedTeamMember && deactivatedTeamMembers.push(deactivatedTeamMember);
        return validation;
      },
    },
    ctx,
    spreadsheet.TeamMember.columns,
  );

  if (shouldReassignPartiesForInactiveUsers) {
    const deactivatedTeamMembersBeforeImport = dbTeamMembers.filter(tm => tm.inactive);
    const deactivatedTeamMembersAfterImport = deactivatedTeamMembers.filter(
      dt => !deactivatedTeamMembersBeforeImport.some(tm => tm.userId === dt.userId && tm.teamId === dt.teamId),
    );

    // We defer this until all team members have been imported, since we need to know the new roles acorss the teams.
    await handleTeamMemberDeactivations(ctx, deactivatedTeamMembersAfterImport);
  }

  await removeFloatingAgentsAvailabilities(ctx, deactivatedTeamMembers, dbTeamMembers);
  await handleCalendarSyncOnTeamMembers(ctx, dbTeamMembers);

  const inactiveUserIds = await getInactiveUserIds(deactivatedTeamMembers, dbTeamMembers);

  if (inactiveUserIds.length) {
    await updateStatusForUsers(ctx, inactiveUserIds, DALTypes.UserStatus.NOT_AVAILABLE);

    logger.info({ ctx, userIds: inactiveUserIds }, 'Forcing inactive users logout.');

    await notify({
      ctx,
      tenantId: ctx.tenantId,
      event: eventTypes.FORCE_LOGOUT,
      routing: { users: inactiveUserIds },
    });
  }

  return {
    invalidFields,
    inactiveUserIds,
  };
};

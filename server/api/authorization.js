/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import uniq from 'lodash/uniq';
import intersection from 'lodash/intersection';
import { allowedToModifyParty, allowedToReviewApplication, allowedAccessToCohortCommms } from '../../common/acd/access';
import { isAdmin, isCustomerAdmin, isRevaAdmin } from '../../common/helpers/auth';
import { Rights, SystemRoles } from '../../common/acd/rights';
import { loadParty, getCollaboratorsForParties } from '../dal/partyRepo';
import { getUserById } from '../dal/usersRepo';
import { loadUserById } from '../services/users';
import { getTeamsForUser, getTeamsForUsers, getTeamsByNames } from '../dal/teamsRepo';
import { getPropertiesAssociatedWithTeams } from '../dal/propertyRepo';
import loggerInstance from '../../common/helpers/logger';
import { getTenantSettings } from '../services/tenantService';

const logger = loggerInstance.child({ subType: 'authorization' });

const canLoadComms = async ({ req, user, party }) => {
  const collaborators = await getCollaboratorsForParties(req, [party.id]);
  const userIsCollaborator = collaborators.find(id => id === user.id);
  const userIsInSameTeam =
    intersection(
      party.teams,
      (user.teams || []).map(t => t.id),
    ).length > 0;
  return userIsCollaborator || userIsInSameTeam;
};

const canModifyParty = async ({ req, user, party }) => {
  const partyOwner = await loadUserById(req, party.userId);

  if (!partyOwner) {
    logger.trace({ ctx: req, user: user.fullName, party }, 'party owner has not been determined yet, user is not allowed to modify it');
    return false;
  }
  /*
  If the partyOwner is active, then we check users in the teams that the party owner is active in.
  If the partyOwner is active but not an active member of any team, OR the partyOwner is inactive,
   we check users in any team that the party owner was ever active in.
  */
  const includeTeamsWhereUserIsInactive = partyOwner.inactive;
  let ownerTeams = await getTeamsForUser(req, party.userId, includeTeamsWhereUserIsInactive);
  if (!ownerTeams.length) ownerTeams = await getTeamsForUser(req, party.userId, true);
  partyOwner.teams = ownerTeams;

  const associatedTeamNames = (user.teams || []).reduce((acc, team) => {
    const teamNames = ((team.metadata && team.metadata.associatedTeamNames.split(',')) || []).map(t => t.trim());
    return teamNames.length ? [...acc, ...teamNames] : acc;
  }, []);

  user.associatedTeams = await getTeamsByNames(req, uniq(associatedTeamNames));
  const userTeamIds = (user.teams || []).map(t => t.id);
  user.properties = await getPropertiesAssociatedWithTeams(req, userTeamIds);

  const ownerTeam = ownerTeams.find(team => team.id === party.ownerTeam);
  const associatedOwnerTeamNames = (ownerTeam?.metadata?.associatedTeamNames?.split(',') || []).map(t => t.trim());

  const teamsAllowedToModify = [
    ...(await getTeamsForUsers(req, [party.userId, ...party.collaborators], { excludeInactiveTeams: false })).map(t => t.id),
    ...ownerTeams.map(t => t.id),
    ...(await getTeamsByNames(req, uniq(associatedOwnerTeamNames))).map(t => t.id),
  ];

  return allowedToModifyParty(user, { ...party, teamsAllowedToModify });
};

const canReviewApplication = async ({ user, party }) => allowedToReviewApplication(user, party);

const isAdminOrCustomerAdmin = async ({ req }) => {
  const user = await getUserById(req, req.authUser.id);
  return isAdmin(user) || isCustomerAdmin(user);
};

const isRevaAdminUser = async ({ req }) => {
  const user = await loadUserById(req, req.authUser.id);
  return isRevaAdmin(user);
};

const canModifyPosts = async ({ req, user }) => {
  const { isTrainingTenant } = req;
  const tenantSettings = await getTenantSettings(req);
  return allowedAccessToCohortCommms({ ...user, features: tenantSettings?.features, isTrainingTenant });
};

const accessMap = {
  [Rights.MODIFY_PARTY]: canModifyParty,
  [Rights.REVIEW_APPLICATION]: canReviewApplication,
  [Rights.LOAD_COMMS]: canLoadComms,
  [Rights.MODIFY_POSTS]: canModifyPosts,
  [SystemRoles.IS_ADMIN_USER]: isAdminOrCustomerAdmin,
  [SystemRoles.IS_REVA_ADMIN_USER]: isRevaAdminUser,
};

export const hasRight = async (right, req, partyId) => {
  const user = req.authUser;
  const party = await loadParty(req, partyId);

  return accessMap[right]({ req, user, party });
};

export const requiresRight = right => async (req, res, next) => {
  try {
    const isAuthorized = await accessMap[right]({
      req,
      user: req.authUser,
      party: req.params.partyId ? await loadParty(req, req.params.partyId) : {},
    });

    if (!isAuthorized) {
      logger.warn({ ctx: req, partyId: req.params.partyId, userId: req.authUser.id }, 'ACD restriction');
      next({ status: 403, token: 'FORBIDDEN' });
    }
  } catch (e) {
    logger.warn(e);
    next({ status: 403, token: 'FORBIDDEN' });
  }

  next();
};

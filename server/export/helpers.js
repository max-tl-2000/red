/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import fromPairs from 'lodash/fromPairs';
import nullish from '../../common/helpers/nullish';
import { getTeamMemberByTeamAndUser } from '../dal/teamsRepo';
import { MainRoleDefinition, FunctionalRoleDefinition } from '../../common/acd/rolesDefinition';

export const mapDataToFields = (data, fields) => {
  const keys = Object.keys(fields);
  const pairs = keys
    .map(key => ({ key, field: fields[key] }))
    .map(f => {
      const { key, field } = f;
      const value = field.fn ? field.fn(data) : field;
      if (nullish(value) && field.isMandatory) {
        // missing mandatory value, fail the export
        throw new Error(`Export field is mandatory: ${key}`);
      }
      return [key, value];
    });

  return fromPairs(pairs);
};

export const shouldExportExternalUniqueId = async (ctx, ownerTeam, userId) => {
  const teamMember = await getTeamMemberByTeamAndUser(ctx, ownerTeam, userId);
  return teamMember.mainRoles.includes(MainRoleDefinition.LA.name) && !teamMember.functionalRoles.includes(FunctionalRoleDefinition.LD.name);
};

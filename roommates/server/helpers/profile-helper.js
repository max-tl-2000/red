/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTables } from '../../common/enums/dal-tables';

const getAllowedFieldsToSelect = options => {
  const basicFields = {
    user: ['id', 'updated_at'],
    roommateProfile: ['moveInDateFrom', 'moveInDateTo', 'preferredName', 'shouldKnowAboutMe', 'isActive'],
  };

  if (!options.isYourProfile && options.displayBasicFields) return basicFields;

  return {
    user: basicFields.user,
    roommateProfile: options.isYourProfile
      ? DALTables.TableColumns.ROOMMATE_PROFILE
      : DALTables.TableColumns.ROOMMATE_PROFILE.filter(field => field !== 'fullName'),
  };
};

const mapJsonProfileColumns = (column, allowedProfileFileds) =>
  DALTables.TableColumns.ROOMMATE_PROFILE.reduce((acc, roommateColumn) => {
    if (!allowedProfileFileds.some(field => field === roommateColumn)) {
      return acc;
    }

    acc.push(`"${DALTables.Tables.USERS}"."${column}" ->> '${roommateColumn}' as "${roommateColumn}"`);
    return acc;
  }, []);

const getField = (column, options) => {
  const allowedFields = getAllowedFieldsToSelect(options);
  if (column === DALTables.TableColumns.USERS.ROOMMATE_PROFILE) {
    return mapJsonProfileColumns(column, allowedFields.roommateProfile);
  }

  const isFieldAllowed = allowedFields.user.some(field => field === column);
  return isFieldAllowed && `"${DALTables.Tables.USERS}"."${column}"`;
};

export const buildSelectQuery = (columns, options = {}) =>
  Object.keys(columns).reduce((acc, key) => {
    const column = columns[key];
    const field = getField(column, options);
    if (!field) return acc;

    const previousFields = acc ? `${acc}, ` : '';
    return `${previousFields}${field}`;
  }, '');

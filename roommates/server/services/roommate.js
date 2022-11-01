/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getRoommates } from '../dal/roommate-repo';
import { DALTables } from '../../common/enums/dal-tables';
import { DALTypes } from '../../common/enums/dal-types';
import { commonSchema } from '../../../common/helpers/database';
import nullish from '../../../common/helpers/nullish';
const COMMON_SCHEMA = commonSchema;

/*  This are the rules to apply on the dynamic query filter
    The key represent the object property passed as parameter
    compareTo is the db column to compare
    operator is the comparison operator to be used between the compareTo and the operand(value of object property passed as parameter)
    except is a value to compare with the operand, if this is true it will skip rule
    convertToDate is a boolean that controls if an operand needs to be converted to date
    operand is a value that replaces the operand passed as parameter if its defined
    sqlOperator is the sql operator like OR/AND, if this is not defined the default is AND
 */
const rules = {
  preferLiveWith: [
    {
      compareTo: 'gender',
      operator: '=',
      except: DALTypes.PreferLiveWith.NO_PREFERENCE,
    },
  ],
  moveInDateFrom: [
    {
      compareTo: '"moveInDateTo"::timestamptz',
      operator: '>=',
      convertToDate: true,
    },
  ],
  moveInDateTo: [
    {
      compareTo: '"moveInDateFrom"::timestamptz',
      operator: '<=',
      convertToDate: true,
    },
  ],
  isActive: [{ compareTo: '"isActive"', operator: '=' }],
  gender: [
    { compareTo: '"preferLiveWith"', operator: '=' },
    {
      compareTo: '"preferLiveWith"',
      operator: '=',
      operand: DALTypes.PreferLiveWith.NO_PREFERENCE,
      sqlOperator: 'OR',
    },
  ],
};

const outerFilterRules = {
  contacted: [{ compareTo: '"contacted"', operator: '=' }],
};

const isRuleAvailableAndIsNotAnException = (rule, operand) => rule && rule.except !== operand;

const isDateAndValid = (rule, operand) => rule.convertToDate && operand !== '' && !nullish(operand);

const buildCondition = ({ rule, operand }) => {
  let column;
  if (isRuleAvailableAndIsNotAnException(rule, operand)) {
    if (isDateAndValid(rule, operand)) {
      column = `'${operand}'::timestamptz`;
    } else if (!rule.convertToDate) {
      column = rule.operand != null ? `'${rule.operand}'` : `'${operand}'`;
    }
  }

  return column ? `${rule.compareTo} ${rule.operator} ${column}` : '';
};

const addParentheses = (whereCondition, size, index) => {
  if (size <= 1) return whereCondition;

  if (index === 0) {
    return `(${whereCondition}`;
  }
  if (index === size - 1) {
    return `${whereCondition})`;
  }
  return whereCondition;
};

const buildConditions = (query, ruleList, operand) => {
  ruleList.forEach((rule, index) => {
    let whereCondition = buildCondition({ rule, operand });
    if (whereCondition) {
      whereCondition = addParentheses(whereCondition, ruleList.length, index);
      const sqlOperator = rule.sqlOperator || 'AND';
      query.where = query.where ? `${query.where} ${sqlOperator} ${whereCondition}` : whereCondition;
    }
  });
};

const buildFilterQuery = (filter, userId, rulesToApply, shouldGetLoggedUser) => {
  let filterQuery;
  const query = { where: null };

  if (filter != null) {
    const filterObject = JSON.parse(filter);
    Object.keys(filterObject).forEach(key => {
      const ruleList = rulesToApply[key];
      if (ruleList) {
        buildConditions(query, ruleList, filterObject[key]);
      }
    });
    const getLoggedUserFilter = shouldGetLoggedUser && userId ? ` OR id = '${userId}'` : '';
    filterQuery = query.where ? `${query.where}${getLoggedUserFilter}` : '';
  }

  return filterQuery;
};

// This are where conditions that should always apply
const buildConstantFilter = context => {
  console.log('context', context);
  const whenCurrentUserIsInactiveSQL = context.userId
    ? ` AND NOT EXISTS(SELECT "isActive" FROM
                                                                   (SELECT 
                                                                     "${DALTables.Tables.USERS}".id,
                                                                     "${DALTables.Tables.USERS}"."${DALTables.TableColumns.USERS.ROOMMATE_PROFILE}" ->> 'isActive' as "isActive" 
                                                                   FROM "${COMMON_SCHEMA}"."${DALTables.Tables.USERS}"
                                                                   WHERE id = '${context.userId}') AS U 
                                                                 WHERE "isActive" = 'false')`
    : '';

  let whereRaw = `"${DALTables.TableColumns.USERS.ROOMMATE_PROFILE}" @> '{"properties": [{"id": "${context.propertyId}", "tenant": {"id":"${context.tenantId}"}}]}' ${whenCurrentUserIsInactiveSQL}`;
  DALTables.TableColumns.ROOMMATE_PROFILE_REQUIRED_FIELDS.forEach(requiredField => {
    whereRaw = `${whereRaw} AND "${DALTables.TableColumns.USERS.ROOMMATE_PROFILE}" ->> '${requiredField}' <> ''`;
  });
  return whereRaw;
};

/* The next function used sixtax like '@>' and '->>' in order to do dinamyc filtering of JSONB
 * @> = contains
 * --> = extracts the value as TEXT
 */
export const getFilteredRoommates = (context, filter) => {
  const whereRaw = buildConstantFilter(context);

  const filterQuery = buildFilterQuery(filter, context.userId, rules, true);
  const outerFilterQuery = buildFilterQuery(filter, context.userId, outerFilterRules, false);

  return getRoommates(whereRaw, filterQuery, outerFilterQuery, context);
};

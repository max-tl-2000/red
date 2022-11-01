/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { savePropertyGroup, putParentGroupRef } from '../../dal/propertyGroupRepo.js';
import { validate, Validation } from './util.js';
import DBColumnLength from '../../utils/dbConstants.js';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const PROPERTY_GROUP_REQUIRED_FIELDS = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'owner',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'operator',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'parentGroup',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const PREREQUISITES_BEFORE_INSERT = [
  {
    field: 'owner',
    tableFieldName: 'name',
    table: 'BusinessEntity',
    idReceiver: 'owner',
  },
  {
    field: 'operator',
    tableFieldName: 'name',
    table: 'BusinessEntity',
    idReceiver: 'operator',
  },
];

const PREREQUISITES_AFTER_INSERT = [
  {
    field: 'parentGroup',
    tableFieldName: 'name',
    table: 'PropertyGroup',
    idReceiver: 'parentGroup',
  },
];

const savePropertyGroupData = async (ctx, propertyGroup) => {
  const record = await savePropertyGroup(ctx, {
    name: propertyGroup.name,
    displayName: propertyGroup.displayName,
    description: propertyGroup.description,
    owner: propertyGroup.owner,
    operator: propertyGroup.operator,
  });

  propertyGroup.id = record.id;
};

export const updateParentGroupRef = async (ctx, propertyGroups) =>
  validate(
    propertyGroups,
    {
      requiredFields: [],
      prerequisites: PREREQUISITES_AFTER_INSERT,
      async onValidEntity(propertyGroup) {
        if (propertyGroup.parentGroup) {
          await putParentGroupRef(ctx, propertyGroup.id, propertyGroup.parentGroup);
        }
      },
    },
    ctx,
  );

export const importPropertyGroups = async (ctx, propertyGroups) => {
  const validEntities = [];
  const invalidEntities = await validate(
    propertyGroups,
    {
      requiredFields: PROPERTY_GROUP_REQUIRED_FIELDS,
      prerequisites: PREREQUISITES_BEFORE_INSERT,
      async onValidEntity(propertyGroup, index) {
        await savePropertyGroupData(ctx, propertyGroup);
        validEntities.push({
          index,
          data: propertyGroup,
        });
      },
    },
    ctx,
    spreadsheet.PropertyGroup.columns,
  );

  const invalidParentGroups = await updateParentGroupRef(ctx, validEntities);

  return {
    invalidFields: invalidEntities.concat(invalidParentGroups),
  };
};

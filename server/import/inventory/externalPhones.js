/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getTeamsByNames } from '../../dal/teamsRepo';
import { getPropertyByName } from '../../dal/propertyRepo';
import { saveExternalPhone } from '../../dal/externalPhonesRepo';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const requiredFields = [
  {
    fieldName: 'name',
    validation: [Validation.NOT_EMPTY, Validation.PHONE_NUMBER],
    maxLength: DBColumnLength.Phone,
  },
  {
    fieldName: 'teams',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Note,
  },
  {
    fieldName: 'property',
    validation: [Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'displayName',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const getExternalPhone = async (ctx, { name, teams: teamNames, property, displayName }) => {
  const names = teamNames.split(',').map(n => n.trim());
  const teams = await getTeamsByNames(ctx, names);
  const teamIds = teams.map(t => t.id);
  const externalPhone = { number: name, displayName, teamIds };
  if (property) {
    const { id: propertyId } = await getPropertyByName(ctx, property);
    externalPhone.propertyId = propertyId;
  }
  return externalPhone;
};

export const importExternalPhones = async (ctx, data) => {
  const invalidFields = await validate(
    data,
    {
      requiredFields,
      async onValidEntity(entity) {
        const externalPhone = await getExternalPhone(ctx, entity);
        await saveExternalPhone(ctx, externalPhone);
      },
    },
    ctx,
    spreadsheet.ExternalPhone.columns,
  );

  return {
    invalidFields,
  };
};

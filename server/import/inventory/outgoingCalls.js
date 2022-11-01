/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { saveOutgoingTeamPropertyProgram, getProgramByName } from '../../dal/programsRepo';
import { getPropertyByName } from '../../dal/propertyRepo';
import { getTeamBy } from '../../dal/teamsRepo';
import { validate, Validation } from './util';
import DBColumnLength from '../../utils/dbConstants';
import { getAllWhere } from '../../database/factory';
import { DALTypes } from '../../../common/enums/DALTypes.js';
import { compareNames } from '../../helpers/importUtils';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

export const TEAM = 'team';
export const INVALID_TEAM = 'INVALID_TEAM_SPECIFIED_FOR_OUTGOING_PROGRAMS';
export const PROPERTY = 'selectProperty';
export const INVALID_PROPERTY = 'INVALID_PROPERTY_SPECIFIED_FOR_OUTGOING_PROGRAMS';
export const PROGRAM = 'selectProgram';
export const INVALID_PROGRAM = 'INVALID_SOURCE_SPECIFIED_FOR_OUTGOING_PROGRAMS';

const requiredFields = [
  {
    fieldName: 'team',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'property',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'program',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const customValidations = async (ctx, outgoingCall) => {
  const { team: teamName, property: propertyName, program: programName } = outgoingCall;
  const validation = [];

  const validTeam = await getTeamBy(ctx, { name: teamName });
  if (!validTeam) {
    validation.push({
      name: TEAM,
      message: INVALID_TEAM,
    });
  }

  if (outgoingCall.property) {
    const property = await getPropertyByName(ctx, propertyName);
    if (!property) {
      validation.push({
        name: PROPERTY,
        message: INVALID_PROPERTY,
      });
    }
  }

  if (outgoingCall.program) {
    const program = await getProgramByName(ctx, programName);
    if (!program) {
      validation.push({
        name: PROGRAM,
        message: INVALID_PROGRAM,
      });
    }
  }

  return validation;
};

const getRowsToBeSaved = ({ outgoingCalls, dbTeams, dbProperties, dbPrograms, dbTeamPropertyPrograms }) =>
  outgoingCalls.filter(row => {
    const { team: teamName, property: propertyName, program: programName } = row.data;

    const dbTeam = dbTeams.find(t => compareNames(t.name, teamName)) || {};
    const dbProperty = dbProperties.find(p => compareNames(p.externalId, propertyName)) || {};
    const dbProgram = dbPrograms.find(c => compareNames(c.name, programName)) || {};

    const existingTeamPropertyProgram = dbTeamPropertyPrograms.find(
      tpc =>
        tpc.teamId === dbTeam.id &&
        tpc.propertyId === dbProperty.id &&
        tpc.programId === dbProgram.id &&
        tpc.commDirection === DALTypes.CommunicationDirection.OUT,
    );
    return !existingTeamPropertyProgram;
  });

export const importOutgoingCalls = async (ctx, outgoingCalls) => {
  const dbTeams = await getAllWhere(ctx, 'Teams', {});
  const dbProperties = await getAllWhere(ctx, 'Property', {});
  const dbPrograms = await getAllWhere(ctx, 'Programs', {});
  const dbTeamPropertyPrograms = await getAllWhere(ctx, 'TeamPropertyProgram', {});

  const rowsToBeSaved = getRowsToBeSaved({ outgoingCalls, dbTeams, dbProperties, dbPrograms, dbTeamPropertyPrograms });

  const invalidFields = await validate(
    rowsToBeSaved,
    {
      requiredFields,
      async onValidEntity(outgoingCall) {
        await saveOutgoingTeamPropertyProgram(ctx, outgoingCall);
      },
      async customCheck(outgoingCall) {
        return await customValidations(ctx, outgoingCall);
      },
    },
    ctx,
    spreadsheet.OutgoingCall.columns,
  );

  return {
    invalidFields,
  };
};

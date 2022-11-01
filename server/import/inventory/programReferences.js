/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapSeries } from 'bluebird';
import groupBy from 'lodash/groupBy';
import DBColumnLength from '../../utils/dbConstants';
import { validate, Validation } from './util';
import { loadPrograms, saveProgramReference, deleteAllProgramReferences, getProgramReferences } from '../../dal/programsRepo';
import { spreadsheet } from '../../../common/helpers/spreadsheet';

const INVALID_PROGRAM = 'INVALID_PROGRAM';
const DUPLICATE_REFERENCE_PROPERTY = 'DUPLICATE_REFERENCE_PROPERTY_FOR_PROGRAM';
const REFERENCE_PROGRAM = 'referenceProgram';
const PARENT_PROGRAM = 'parentProgram';

const sourceRequiredFields = [
  {
    fieldName: 'parentProgram',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
  {
    fieldName: 'referenceProgram',
    validation: [Validation.NOT_EMPTY, Validation.ALPHANUMERIC],
    maxLength: DBColumnLength.Name,
  },
];

const prerequisites = [
  {
    field: 'parentProgram',
    tableFieldName: 'name',
    table: 'Programs',
    idReceiver: 'programId',
  },
  {
    field: 'referenceProgram',
    tableFieldName: 'name',
    table: 'Programs',
    idReceiver: 'programId',
  },
];
const getProgramByName = (name, dbPrograms) => dbPrograms.find(c => c.name === name.toLowerCase());

const enhanceProgramReferences = async (ctx, programReferences) => {
  const dbPrograms = await loadPrograms(ctx);
  return await mapSeries(programReferences, async pr => {
    const parentProgram = getProgramByName(pr.data.parentProgram, dbPrograms);
    const referenceProgram = getProgramByName(pr.data.referenceProgram, dbPrograms);
    const parentProgramId = parentProgram ? parentProgram.id : '';
    const referenceProgramId = referenceProgram ? referenceProgram.id : '';
    const referenceProgramPropertyId = referenceProgram ? referenceProgram.primaryPropertyId : '';
    return {
      ...pr,
      data: {
        index: pr.index,
        ...pr.data,
        parentProgramId,
        referenceProgramId,
        referenceProgramPropertyId,
        rowCombination: `${pr.data.parentProgram}#${referenceProgramPropertyId}`,
      },
    };
  });
};
const itemsChanged = (importProgramReferences, dbProgramReferences) => {
  if (importProgramReferences.length !== dbProgramReferences.length) return true;
  return !importProgramReferences.every(i =>
    dbProgramReferences.some(
      db =>
        db.parentProgramId === i.parentProgramId &&
        db.referenceProgramId === i.referenceProgramId &&
        db.referenceProgramPropertyId === i.referenceProgramPropertyId,
    ),
  );
};

const preliminaryValidation = async programReferences => {
  const invalidEntities = [];
  const grouppedPrograms = groupBy(programReferences, 'rowCombination');
  await mapSeries(Object.keys(grouppedPrograms), async group => {
    await mapSeries(grouppedPrograms[group], gc => {
      const invalidFields = [];
      if (grouppedPrograms[group].length > 1) {
        invalidFields.push({ name: PARENT_PROGRAM, message: DUPLICATE_REFERENCE_PROPERTY });
      }
      if (!gc.parentProgramId) {
        invalidFields.push({ name: PARENT_PROGRAM, message: INVALID_PROGRAM });
      }
      if (!gc.referenceProgramId) {
        invalidFields.push({ name: REFERENCE_PROGRAM, message: INVALID_PROGRAM });
      }
      if (invalidFields.length > 0) {
        invalidEntities.push({
          index: gc.index,
          invalidFields,
        });
      }
    });
  });
  return invalidEntities;
};

export const importProgramReferences = async (ctx, rows) => {
  const allProgramReferences = await enhanceProgramReferences(ctx, rows);
  const programReferencesData = allProgramReferences.map(pr => pr.data);
  const dbProgramReferences = await getProgramReferences(ctx);
  const existDifferencesAtImport = itemsChanged(programReferencesData, dbProgramReferences);
  if (!existDifferencesAtImport) return { invalidFields: [] };

  const invalidFields = await preliminaryValidation(programReferencesData);
  const validRows = allProgramReferences.filter(vr => !invalidFields.some(ie => ie.index === vr.index));

  await deleteAllProgramReferences(ctx);
  await validate(
    validRows,
    {
      requiredFields: sourceRequiredFields,
      prerequisites,
      async onValidEntity(programReference) {
        await saveProgramReference(ctx, programReference);
      },
    },
    ctx,
    spreadsheet.ProgramReferences.columns,
  );

  return {
    invalidFields,
  };
};

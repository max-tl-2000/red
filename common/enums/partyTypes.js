/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from './DALTypes';

export const AdditionalInfoTypes = {
  PET: 'pet',
  VEHICLE: 'car',
  CHILD: 'child',
  INSURANCE_CHOICE: 'insurance-choice',
};

export const displayedWorkflowNames = {
  newLease: 'New lease',
  activeLease: 'Active lease',
  renewal: 'Renewal',
  transfer: 'Transfer',
};

export const partyWfStatesSubset = {
  all: [DALTypes.WorkflowState.ACTIVE, DALTypes.WorkflowState.CLOSED, DALTypes.WorkflowState.ARCHIVED],
  active: [DALTypes.WorkflowState.ACTIVE],
  unarchived: [DALTypes.WorkflowState.ACTIVE, DALTypes.WorkflowState.CLOSED],
  archived: [DALTypes.WorkflowState.ARCHIVED],
};

export const partyCreationAllowedTeams = [DALTypes.ModuleType.LEASING, DALTypes.ModuleType.CALL_CENTER];

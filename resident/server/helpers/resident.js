/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { DALTypes } from '../../../common/enums/DALTypes';
import { ResidentPropertyState } from '../../../common/enums/residentPropertyStates';

export const getResidentState = ({ partyWorkflowState, partyState }) => {
  if (partyWorkflowState === DALTypes.WorkflowState.ARCHIVED) {
    return ResidentPropertyState.PAST;
  }
  if (partyWorkflowState === DALTypes.WorkflowState.ACTIVE && partyState === DALTypes.PartyStateType.RESIDENT) {
    return ResidentPropertyState.CURRENT;
  }
  if (partyWorkflowState === DALTypes.WorkflowState.ACTIVE && partyState === DALTypes.PartyStateType.FUTURERESIDENT) {
    return ResidentPropertyState.FUTURE;
  }
  return '';
};

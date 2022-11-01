/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { createSelector } from 'reselect';

const getOutPrograms = state => state.dataStore.get('outCommsProgram');
// TODO: merge this with the one in partySelectors
const getParty = (state, props) => state.dataStore.get('parties').get(props.partyId || props.prospectId);

export const getOutProgramSelector = () =>
  createSelector(
    [getOutPrograms, getParty],
    (outPrograms, party) => outPrograms.find(c => c.teamId === party.ownerTeam && c.propertyId === party.assignedPropertyId) || {},
  );

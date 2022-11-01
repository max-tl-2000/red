/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { mapDataToFields, formatDateForMRI, DEFAULT_EXTERNAL_UNIQUE_ID } from './utils';

const fields = {
  NameID: {
    fn: ({ externalInfo }) => externalInfo && externalInfo.externalId,
    isMandatory: true,
  },
  ActionDate: {
    fn: ({ appointment }) => formatDateForMRI(appointment.metadata.endDate),
    isMandatory: true,
  },
  ActionCodeID: 'SH',
  ActionDescription: {
    fn: ({ appointmentInventory }) => appointmentInventory && appointmentInventory.externalId,
  },
  LeasingAgentId: {
    fn: ({ tourAgentUserExternalId, tourAgentTeamMemberExternalId, teamMemberExternalId, shouldExportExternalUniqueIdForTourAgent }) => {
      if (!shouldExportExternalUniqueIdForTourAgent) return DEFAULT_EXTERNAL_UNIQUE_ID;
      if (tourAgentTeamMemberExternalId) return tourAgentTeamMemberExternalId;
      if (teamMemberExternalId) return teamMemberExternalId;
      return tourAgentUserExternalId;
    },
  },
};

export const createResidentialInteractionsMapper = data => mapDataToFields(data, fields);

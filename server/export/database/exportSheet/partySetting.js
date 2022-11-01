/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import { getTenantData } from '../../../dal/tenantsRepo';
import { buildDataPumpFormat } from '../../helpers/export';
import { DALTypes } from '../../../../common/enums/DALTypes';

export const exportPartySettings = async (ctx, { columnHeaders: columnHeadersOrdered }) => {
  const { partySettings } = await getTenantData(ctx);

  const settings = [
    {
      partyType: DALTypes.PartyTypes.TRADITIONAL,
      showOccupantMember: partySettings[DALTypes.PartyTypes.TRADITIONAL].showOccupantMember,
      holdDepositAccepted: partySettings[DALTypes.PartyTypes.TRADITIONAL].holdDepositAccepted,
      showEmergencyContactTask: partySettings[DALTypes.PartyTypes.TRADITIONAL].showEmergencyContactTask,
      residentOrPartyLevelGuarantor: partySettings[DALTypes.PartyTypes.TRADITIONAL].residentOrPartyLevelGuarantor,
    },
    {
      partyType: DALTypes.PartyTypes.CORPORATE,
      showOccupantMember: partySettings[DALTypes.PartyTypes.CORPORATE].showOccupantMember,
      holdDepositAccepted: partySettings[DALTypes.PartyTypes.CORPORATE].holdDepositAccepted,
      showEmergencyContactTask: partySettings[DALTypes.PartyTypes.CORPORATE].showEmergencyContactTask,
    },
  ];

  return buildDataPumpFormat(settings, columnHeadersOrdered);
};

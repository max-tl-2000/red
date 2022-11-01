/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { partyFromRaw } from '../../../common/helpers/party-utils.js';
import PartyGuests from '../PartyGuests/PartyGuests';

const GuestList = ({ guests, ...rest }) => {
  const party = partyFromRaw(guests);
  return <PartyGuests guests={party.orderedGuests} {...rest} />;
};

export default GuestList;

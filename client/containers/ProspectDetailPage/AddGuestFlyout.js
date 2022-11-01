/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Icon, Typography as T } from 'components';
import { partyFromRaw } from '../../../common/helpers/party-utils.js';

import { cf } from './AddGuestFlyout.scss';
import PartyGuests from '../../custom-components/PartyGuests/PartyGuests';

export default function AddGuestFlyout({ guestsList, triggerWidth, compact, onOpenManagePartyPage, isCorporateParty }) {
  const party = partyFromRaw(guestsList);
  const narrowSpace = triggerWidth < 135;

  const partyGuestsWidth = !compact ? triggerWidth : undefined;

  const tagElementStyle = {};

  if (compact && narrowSpace) {
    tagElementStyle.lineHeight = '1.9rem';
    tagElementStyle.fontSize = 16;
  }

  return (
    <div data-id="managePartyTrigger" className={cf('trigger')} onClick={onOpenManagePartyPage}>
      <PartyGuests
        compact={compact}
        inline
        guests={party.orderedGuests}
        lighter
        TagElementProps={{ style: tagElementStyle }}
        TagElement={T.Title}
        style={{ maxWidth: partyGuestsWidth }}
        isCorporateParty={isCorporateParty}
      />
      {!compact && (
        <span className={cf('trigger-arrow')}>
          <Icon id="iconToGoManageParty" style={{ display: 'inline-block' }} name="chevron-right" iconStyle="light" />
        </span>
      )}
    </div>
  );
}

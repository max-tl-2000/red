/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React from 'react';
import { t } from 'i18next';
import { Typography } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import WalkInThreadComponent from './WalkInThreadComponent';

const { SubHeader } = Typography;

const WalkinThreadFlyOut = ({ flyoutId, partyMembers, persons, partyId, participants, contactEvent }) => (
  <DockedFlyOut windowIconName="calendar-text" flyoutId={flyoutId} title={<SubHeader inline>{t('CONTACT_EVENT')}</SubHeader>}>
    <WalkInThreadComponent
      partyMembers={partyMembers}
      persons={persons}
      partyId={partyId}
      participants={participants}
      contactEvent={contactEvent}
      flyoutId={flyoutId}
    />
  </DockedFlyOut>
);

WalkinThreadFlyOut.propTypes = {
  flyoutId: PropTypes.string,
  partyMembers: PropTypes.object,
  persons: PropTypes.object,
  partyId: PropTypes.string,
  participants: PropTypes.object,
  contactEvent: PropTypes.object,
};

export default WalkinThreadFlyOut;

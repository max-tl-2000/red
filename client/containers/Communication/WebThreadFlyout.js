/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Typography } from 'components';
import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { getWebInquiryHeaderFromComm } from 'helpers/communications';
import WebThreadComponent from './WebThreadComponent';

const { SubHeader } = Typography;

// changed to arrow function and later export instead of a default export
// so the name of the component is shown in the developer tools while debugging
const WebThreadFlyOut = ({ flyoutId, communications, participant, timezone }) => (
  <DockedFlyOut
    id="webThreadFlyout"
    flyoutId={flyoutId}
    windowIconName="web"
    title={<SubHeader inline>{getWebInquiryHeaderFromComm(communications ? communications[0] : null)}</SubHeader>}>
    <WebThreadComponent communications={communications} participant={participant} timezone={timezone} />
  </DockedFlyOut>
);

export default WebThreadFlyOut;

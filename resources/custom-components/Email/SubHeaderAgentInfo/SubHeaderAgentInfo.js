/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Avatar from '../Avatar/Avatar';
import { Box } from '../../../../common/react-html-email-wrapper';
import { Caption, Link, SubHeader } from '../Typography/Typography';

const SubHeaderAgentInfo = contact => (
  <Box width="220" style={{ width: 220, verticalAlign: 'middle' }}>
    <tr>
      <td width="60" style={{ width: 60, verticalAlign: 'top' }}>
        {/* TODO: make an api to load the image from our servers, if the image is available get the one from cloudinary otherwise use a default one  */}
        <Avatar userName={contact.fullName} src={contact.avatarUrl ? contact.avatarUrl : ''} />
      </td>
      <td width="160" style={{ width: 160, textAlign: 'left', paddingLeft: 16, color: '#fff' }}>
        <SubHeader style={{ fontWeight: 500 }} lighter>
          {contact.fullName}
        </SubHeader>
        <Caption lighter>{contact.title}</Caption>
        <Caption lighter>
          <Link style={{ color: 'white' }} href={`tel:${contact.phone}`}>
            {contact.phone}
          </Link>
        </Caption>
        <Caption lighter>
          <Link style={{ color: 'white' }} href={`mailto:${contact.email}`}>
            {contact.email}
          </Link>
        </Caption>
      </td>
    </tr>
  </Box>
);

export default SubHeaderAgentInfo;

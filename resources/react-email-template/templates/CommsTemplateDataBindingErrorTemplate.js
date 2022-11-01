/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import { Box } from '../../../common/react-html-email-wrapper';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import { firstTextPadding } from '../commonStyles';
import { now, DATE_TIME_ISO_FORMAT } from '../../../common/helpers/moment-utils';

const { Text } = Typography;

export default emailInfo => {
  const { channels, missingTokens, templateName, recipients, partyId } = emailInfo;

  const renderHeaderCell = text => (
    <Text inline secondary>
      {text}
    </Text>
  );

  const renderMissingTokens = (token, index) => (
    <tr key={`key-${index}`} style={{ verticalAlign: 'top' }}>
      <td valign="top">{token}</td>
    </tr>
  );

  return (
    <Layout>
      <TopBar title="Reva" />
      <Text style={firstTextPadding}>
        Failed to deliver {templateName} to {recipients.join(', ')} in this party: {partyId}
      </Text>
      <Text style={firstTextPadding}>
        Reason for failure: Data binding error
        <br />
        Time of attempt: {now().format(DATE_TIME_ISO_FORMAT)}
        <br />
        Channel: {channels.join(', ')}
        <br />
      </Text>
      <Box style={{ width: '100%', padding: '24px' }} width="100%" cellPadding="6">
        <tr style={{ verticalAlign: 'top' }}>
          <td style={{ width: '20%', paddingLeft: '0px' }} valign="top">
            {renderHeaderCell('Missing Tokens')}
          </td>
        </tr>
        {missingTokens.map((token, index) => renderMissingTokens(token, index))}
      </Box>
    </Layout>
  );
};

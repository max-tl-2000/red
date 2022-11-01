/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import Button from '../../custom-components/Email/Button/Button';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import Footer from '../../custom-components/Email/Footer/Footer';

const { Text, Link } = Typography;
const GenericResetPasswordTemplate = ({
  url,
  emailTitle,
  appName,
  emailText,
  changePasswordButtonText,
  copyableLinkText,
  linkDurationText,
  footerText,
  footerLinks,
}) => (
  <Layout title={emailTitle}>
    <TopBar title={appName} />
    <Text style={{ padding: '56px 24px 24px 24px' }}>{emailText}</Text>
    <Button align="center" width="220" label={changePasswordButtonText} href={url} />
    <Text style={{ padding: '24px 0 15px 24px' }}>
      {copyableLinkText}{' '}
      <Link style={{ color: '#2196f3' }} href={url}>
        {url}
      </Link>
    </Text>
    <Text secondary style={{ padding: '0 0 24px 24px' }}>
      {linkDurationText}
    </Text>
    <Footer links={footerLinks} tallFooterText={footerText} />
  </Layout>
);

export default GenericResetPasswordTemplate;

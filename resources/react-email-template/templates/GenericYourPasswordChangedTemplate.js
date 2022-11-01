/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import Footer from '../../custom-components/Email/Footer/Footer';

const { Text } = Typography;
const GenericYourPasswordChangedTemplate = ({ emailTitle, appName, emailText, footerText, copyright, footerLinks }) => (
  <Layout title={emailTitle}>
    <TopBar title={appName} />
    <Text style={{ padding: '56px 24px 56px 24px' }}>{emailText}</Text>
    <Footer links={footerLinks} tallFooterText={footerText} allRightsReserved={copyright} />
  </Layout>
);

export default GenericYourPasswordChangedTemplate;

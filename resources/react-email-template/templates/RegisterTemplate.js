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
import SubHeaderAgentInfo from '../../custom-components/Email/SubHeaderAgentInfo/SubHeaderAgentInfo';
import { bodyMailBorder } from '../commonStyles';
import { formatPhone } from '../../../common/helpers/phone-utils';

const { Text, Link } = Typography;
const RegisterTemplate = ({
  url,
  emailTitle,
  shortAppDescription,
  emailHeader,
  inviteeGreeting,
  appInvitation,
  completeRegistrationButtonText,
  copyableLinkText,
  linkDurationText,
  footerText,
  copyright,
  footerLinks,
  agentInfo = {},
}) => {
  const subHeaderSection = (
    <SubHeaderAgentInfo
      fullName={agentInfo.fullName}
      title={agentInfo.businessTitle}
      phone={formatPhone(agentInfo.displayPhoneNumber)}
      email={agentInfo.email}
      avatarUrl={agentInfo.avatarUrl}
    />
  );
  return (
    <Layout title={emailTitle}>
      <TopBar title={emailHeader} subHeaderSection={subHeaderSection} tall rightSectionWidth={212} />
      <div style={{ borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        <Text style={{ padding: '32px 24px 12px 24px' }}>{inviteeGreeting}</Text>
        <Text style={{ padding: '0px 24px 24px 24px' }}>{appInvitation + shortAppDescription}</Text>
        <Button align={'center'} style={{ margin: '0 auto' }} width="220" label={completeRegistrationButtonText} href={url} />
        <Text style={{ padding: '24px 0 15px 24px' }}>
          {copyableLinkText}{' '}
          <Link style={{ color: '#2196f3' }} href={url}>
            {url}
          </Link>
        </Text>
        <Text secondary style={{ padding: '0 0 24px 24px' }}>
          {linkDurationText}
        </Text>
      </div>
      <Footer links={footerLinks} tallFooterText={footerText} allRightsReserved={copyright} />
    </Layout>
  );
};

export default RegisterTemplate;

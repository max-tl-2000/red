/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import Button from '../../custom-components/Email/Button/Button';
import Image from '../../custom-components/Email/Image/Image';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import SubHeaderAgentInfo from '../../custom-components/Email/SubHeaderAgentInfo/SubHeaderAgentInfo';
import Footer from '../../custom-components/Email/Footer/Footer';
import Card from '../../custom-components/Email/Card/Card';
import { greet } from '../../../common/helpers/strings';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import { bodyMailBorder } from '../commonStyles';
import { formatPhone } from '../../../common/helpers/phone-utils';

const { Text } = Typography;

const ApplicationInvitationTemplate = ({
  url,
  propertyInfo,
  agentInfo,
  program,
  contactInfo,
  footerText,
  copyright,
  footerLinks,
  message,
  message2,
  message3,
  signature,
  buttonLabel,
}) => {
  const contactName = contactInfo.preferredName || '';
  const headlineText = greet('Hi', contactName);
  const subHeaderSection = (
    <SubHeaderAgentInfo
      fullName={agentInfo.fullName}
      title={agentInfo.businessTitle}
      phone={formatPhone(program.displayPhoneNumber)}
      email={program.displayEmail}
      avatarUrl={agentInfo.avatarUrl}
    />
  );

  return (
    <Layout title="Rental application - Apply Now">
      <TopBar title={propertyInfo.propertyName} subHeaderSection={subHeaderSection} tall rightSectionWidth={212} />
      <Card style={{ background: '#eee', padding: 0, borderBottom: 'none', textAlign: 'center', borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        <Image alt={propertyInfo.propertyName} src={propertyInfo.imageUrl} width="100%" height="190px" />
      </Card>
      <Card style={{ borderBottom: 'none', borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        <Text style={{ margin: '12px 0 24px' }}>{headlineText}</Text>
        <Text style={{ margin: '12px 0' }}>{message}</Text>
        {message2 && <Text style={{ margin: '12px 0' }}>{message2}</Text>}
        {message3 && <Text style={{ margin: '12px 0' }}>{message3}</Text>}
        <Text style={{ margin: '12px 0 0' }}>{'Cheers,'}</Text>
        <Text style={{ margin: '0' }}>{signature}</Text>
        <div style={{ textAlign: 'center' }}>
          <Button width="auto" style={{ margin: '24px auto' }} label={buttonLabel} href={url} />
        </div>
      </Card>
      <Footer links={footerLinks} tallFooterText={footerText} allRightsReserved={copyright} />
    </Layout>
  );
};

export default ApplicationInvitationTemplate;

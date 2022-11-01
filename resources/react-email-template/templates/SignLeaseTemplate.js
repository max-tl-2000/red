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
import Card from '../../custom-components/Email/Card/Card';
import Footer from '../../custom-components/Email/Footer/Footer';
import { config } from '../../../common/publicImagesHelper';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import SubHeaderAgentInfo from '../../custom-components/Email/SubHeaderAgentInfo/SubHeaderAgentInfo';
import { greet } from '../../../common/helpers/strings';
import { bodyMailBorder } from '../commonStyles';
import { formatPhone } from '../../../common/helpers/phone-utils';
import { getEmailLayoutImage } from '../../../common/helpers/cloudinary';

const { Text, Caption } = Typography;

const SignLeaseTemplate = ({ tenantCommSettings, url, footerLinks, property, contactInfo, personInfo, inventory }) => {
  const subHeaderSection = (
    <SubHeaderAgentInfo
      fullName={contactInfo.fullName}
      title={contactInfo.businessTitle}
      phone={formatPhone(contactInfo.displayPhoneNumber)}
      email={contactInfo.displayEmailAddress}
      avatarUrl={contactInfo.avatarUrl}
    />
  );
  const doNotShareText =
    "This email contains a secure link to your lease, which may contain senstitive personal data. We recommend that you don't share this email with anyone. All financially liable party members will receive their own secure link.";
  const headlineText = greet('Hello', personInfo.fullName);
  const imageURL = getEmailLayoutImage(`${config.publicUrl}/email-sign-lease.png`);

  return (
    <Layout title="Sign Lease">
      <TopBar title={property.displayName} subHeaderSection={subHeaderSection} tall rightSectionWidth={212} />
      <div style={{ borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        <Card style={{ background: '#eee', padding: 0, borderBottom: 'none', textAlign: 'center' }}>
          <Image alt="Sign lease" src={imageURL} width="100%" height="190px" />
        </Card>
        <Card>
          <Text>{headlineText}</Text>
          <Text style={{ marginTop: '20px' }}>
            Your lease for {inventory.type} {inventory.name} at {property.displayName} is ready for your review and signature.
          </Text>
          <Button style={{ margin: '24px auto' }} width="auto" label="REVIEW AND SIGN LEASE" href={url} />
          <Caption secondary>{doNotShareText}</Caption>
        </Card>
      </div>
      <Footer links={footerLinks} tallFooterText={tenantCommSettings.footerNotice} />
    </Layout>
  );
};
export default SignLeaseTemplate;

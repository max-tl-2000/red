/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import Footer from '../../custom-components/Email/Footer/Footer';
import Card from '../../custom-components/Email/Card/Card';
import TopBar from '../../custom-components/Email/TopBar/TopBar';
import SubHeaderAgentInfo from '../../custom-components/Email/SubHeaderAgentInfo/SubHeaderAgentInfo';
import * as T from '../../custom-components/Email/Typography/Typography';
import { greet } from '../../../common/helpers/strings';
import { config } from '../../../common/publicImagesHelper';
import Image from '../../custom-components/Email/Image/Image';
import { bodyMailBorder } from '../commonStyles';
import { formatPhone } from '../../../common/helpers/phone-utils';
import { getEmailLayoutImage } from '../../../common/helpers/cloudinary';

const subHeaderSection = ({ sender, contactInfo, avatarUrl }) => (
  <SubHeaderAgentInfo
    avatarUrl={avatarUrl}
    fullName={sender.fullName}
    title={sender.metadata.businessTitle}
    phone={formatPhone(contactInfo.displayPhoneNumber)}
    email={contactInfo.displayEmailAddress}
  />
);

const VoidedLeaseTemplate = ({
  sender,
  contactInfo,
  preferredName,
  propertyName,
  inventoryName,
  inventoryType,
  avatarUrl,
  tenantCommSettings,
  footerLinks,
}) => {
  const headlineText = greet('Hello', preferredName);
  const imageURL = getEmailLayoutImage(`${config.publicUrl}/email-sign-lease.png`);

  return (
    <Layout>
      <TopBar title={propertyName || ''} subHeaderSection={subHeaderSection({ sender, contactInfo, avatarUrl })} tall rightSectionWidth={212} />
      <div style={{ borderLeft: bodyMailBorder, borderRight: bodyMailBorder }}>
        <Image alt="Sign lease" src={imageURL} width="100%" height="190px" />
        <Card style={{ borderTop: '1px', borderLeft: '0.5px', borderRight: '0.5px', borderBottom: 0, borderColor: '#fdfdfd' }}>
          <T.Text style={{ marginTop: '20px' }}>{headlineText}</T.Text>
          <T.Text style={{ marginTop: '20px' }}>
            Your lease for {inventoryType} {inventoryName} at {propertyName} was voided. Feel free to get in touch with the property or your leasing agent to
            get further information .
          </T.Text>
          <T.Text style={{ marginTop: '20px', marginBottom: '20px' }}>If you didn’t request this, you can ignore this email or let us know.</T.Text>
        </Card>
      </div>
      <Footer links={footerLinks} tallFooterText={tenantCommSettings.footerNotice} />
    </Layout>
  );
};

export default VoidedLeaseTemplate;

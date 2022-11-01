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
import { config } from '../../../common/publicImagesHelper';
import * as Typography from '../../custom-components/Email/Typography/Typography';
import { bodyMailBorder } from '../commonStyles';

const { Headline, SubHeader } = Typography;
const imageURL = `${config.publicUrl}/email-forgot-password.jpg`;

const ResetPasswordTemplate = ({ url }) => (
  <Layout title="Reset password">
    <TopBar title="Reva" />
    <div style={{ borderLeft: bodyMailBorder, borderRight: bodyMailBorder, borderBottom: bodyMailBorder }}>
      <Card style={{ background: '#eee', padding: 0, borderBottom: 'none', textAlign: 'center' }}>
        <Image alt="Reset password" src={imageURL} width="100%" height="190px" />
      </Card>
      <Card style={{ textAlign: 'center' }}>
        <Headline style={{ margin: '12px 0 24px' }}>Reset password</Headline>
        <SubHeader style={{ margin: '12px 0' }}>Everybody forgets their password now and then. We'll have you back on track in no time.</SubHeader>
        <Button width="auto" style={{ margin: '24px auto' }} label="CHANGE PASSWORD" href={url} />
      </Card>
    </div>
  </Layout>
);

export default ResetPasswordTemplate;

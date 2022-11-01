/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import Quote from '../../custom-components/Email/Quote/Quote';

const OtherApplicantInviteTemplate = templateData => (
  <Layout title="Other Applicant Invite Template">
    <Quote quoteData={templateData.quoteData} invitationText={templateData.invitationText} />
  </Layout>
);

export default OtherApplicantInviteTemplate;

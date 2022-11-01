/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../layout';
import Quote from '../../custom-components/Email/Quote/Quote';

const GuarantorInviteTemplate = templateData => (
  <Layout title="Guarantor invitation">
    <Quote quoteData={templateData.quoteData} invitationText="You are invited to be a guarantor for the rental below." />
  </Layout>
);

export default GuarantorInviteTemplate;

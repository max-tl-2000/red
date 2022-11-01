/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../../common/layout/layout';

const Index = ({ token, ...rest }) => (
  <Layout {...rest}>
    <div id="content" />
    {token && (
      <script
        dangerouslySetInnerHTML={{
          __html: `window.__appData = window.__appData || {}; window.__appData.token=${token}`,
        }}
      />
    )}
  </Layout>
);

export default Index;

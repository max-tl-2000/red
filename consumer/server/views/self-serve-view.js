/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../../../common/layout/layout';

const renderWidgetInitialization = (token, hostname, programEmailIdentifier, appointmentToken, action) =>
  `
  document.addEventListener('DOMContentLoaded', function domLoad() {
    __initBookAppointment('#widget', {
      campaignEmail: '${programEmailIdentifier}',
      domain: 'https://${hostname}',
      token: '${token}',
      appointmentToken: '${appointmentToken}',
      mode: '${action}'
    });
  });
  `.trim();

export const SelfServeView = ({ token, programEmailIdentifier, staticHostname, hostname, appointmentToken, action, ...rest }) => {
  const assets = [`https://${staticHostname}/thirdparty/self-serve/bookAppointmentWidget.min.js`];
  return (
    <Layout jsAssets={assets} {...rest}>
      <div id="widget" />
      <script
        dangerouslySetInnerHTML={{
          __html: renderWidgetInitialization(token, hostname, programEmailIdentifier, appointmentToken, action),
        }}
      />
    </Layout>
  );
};

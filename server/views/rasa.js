/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import Layout from '../../common/layout/layout';

const renderWidgetInitialization = ({ socketUrl }) =>
  `
  document.addEventListener('DOMContentLoaded', function domLoad() {
    sessionStorage.removeItem('chat_session');
    WebChat.default.init({
      selector: '#webchat',
      interval: 1000,
      socketUrl: '${socketUrl}',
      socketPath: '/socket.io/',
      title: 'Reva Test Chat',
      subtitle: 'Welcome!',
      inputTextFieldHint: 'Type a message...',
      connectingText: 'Waiting for server...',
      hideWhenNotConnected: true,
      fullScreenMode: false,
      showFullScreenButton: true,
      params: {
        images: {
          dims: {
            width: 300,
            height: 200,
          }
        },
        storage: 'session'
      },
    });
  });
  `.trim();

export const Rasa = ({ webChat, ...rest }) => {
  const jsAssets = [{ src: 'https://storage.googleapis.com/mrbot-cdn/webchat-v0.6.0.js', crossOrigin: undefined }];

  return (
    <Layout jsAssets={jsAssets} {...rest}>
      <div id="webchat" />
      <script
        dangerouslySetInnerHTML={{
          __html: renderWidgetInitialization(webChat),
        }}
      />
    </Layout>
  );
};

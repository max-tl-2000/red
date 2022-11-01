/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Iframe } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  [
    'onMessage',
    'Function',
    '',
    `
  The callback to be called when a message is received from within the iframe.
  By convention messages comming from within the iframes are expected to be valid JSON objects
  that have a type and data properties.

  Basically all child iframes should send a message like

  \`\`\`
  import { sendToParent } from 'helpers/postMessage';
  sendToParent({ type: 'MESSAGE_TYPE', data: 'some extra data' });
  \`\`\`

  when the message above is sent, then the onMessage callback will be fired with the object provided to sendToParent
  `,
  ],
];

export default class IframeDemo extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="Iframe demo">
        <PropertiesTable data={api} />
        <DemoSection title="Simple Iframe demo">
          <MDBlock>
            {`
                A simple Iframe demo shows how to use the onMessage callback to receive messages coming from within the iframe.

                This is very handy to implement functionality like the one we need for Auth content
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <Iframe src="/iframe-test/" style={ { width: '100%', height: 500 } } onMessage={ msg => console.log('>>> msg >>>', msg) } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Iframe src="/iframe-test/" style={{ width: '100%', height: 500 }} onMessage={msg => console.log('>>> msg >>>', msg)} />
        </DemoSection>
      </DemoPage>
    );
  }
}

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import SolidBanner from '../../../resources/custom-components/Email/SolidBanner/SolidBanner';
import PrettyPrint from '../DemoElements/PrettyPrint';
import * as T from '../../../resources/custom-components/Email/Typography/Typography';

const SolidBannerDemo = () => {
  const leftPanelObject = (
    <div>
      <T.SubHeader
        style={{
          margin: 0,
          padding: '16px 0px 0px 24px',
          color: '#fff',
          opacity: 0.7,
        }}>
        PAYMENT RECEIPT
      </T.SubHeader>
      <T.Headline style={{ margin: 0, paddingLeft: 24, color: '#fff' }}>Application process fee</T.Headline>
      <T.Text
        style={{
          margin: 0,
          padding: '0px 0px 16px 24px',
          fontWeight: 500,
          color: '#fff',
          opacity: 0.54,
        }}>
        this change will show as Sutros
      </T.Text>
    </div>
  );
  const rightPanelObject = (
    <div>
      <T.SubHeader
        style={{
          margin: 0,
          padding: '16px 0px 0px 24px',
          color: '#fff',
          opacity: 0.7,
        }}>
        AMOUNT
      </T.SubHeader>
      <T.Headline style={{ margin: 0, paddingLeft: 24, color: '#fff' }}>$120.00</T.Headline>
      <T.Text
        style={{
          margin: 0,
          padding: '0px 0px 16px 24px',
          fontWeight: 500,
          color: '#fff',
          opacity: 0.54,
        }}>
        Processed on 29th Aug, 2016
      </T.Text>
    </div>
  );
  return (
    <DemoPage title="Solid Banner">
      <DemoSection title="How do a I render a simple solid banner for emails?">
        <MDBlock>{`
         A simple solid banner for emails can be rendered using the \`Email/SolidBanner/\` component.
         This component is implemented using inline styles to make it usable in an email context.
         the leftPanelObject and rightPanelObject will contain the desired html for the cells inside the banner.
         <br />leftPanelObject = htmlcontent;
         <br />rightPanelObject = htmlcontent;
       `}</MDBlock>
        <PrettyPrint>
          {`
         <SolidBanner leftContent={ leftPanelObject } rightContent={ rightPanelObject } />
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ minHeight: 220 }}>
          <T.Text>Solid Banner</T.Text>
          <SolidBanner leftContent={leftPanelObject} rightContent={rightPanelObject} />
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default SolidBannerDemo;

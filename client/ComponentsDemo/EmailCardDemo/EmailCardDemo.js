/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import TopBar from '../../../resources/custom-components/Email/TopBar/TopBar';
import PrettyPrint from '../DemoElements/PrettyPrint';
import { Box } from '../../../common/react-html-email-wrapper';
import Avatar from '../../../resources/custom-components/Email/Avatar/Avatar';
import Card from '../../../resources/custom-components/Email/Card/Card';
import * as T from '../../../resources/custom-components/Email/Typography/Typography';

const CardDemo = () => {
  const subHeaderSection = (
    <Box width="220" style={{ width: 220 }}>
      <tr>
        <td valign="top" width="60" style={{ width: 60, verticalAlign: 'top' }}>
          <Avatar username="Jack Harkness" />
        </td>
        <td valign="top" width="160" style={{ verticalAlign: 'top', width: 160 }}>
          <T.SubHeader lighter>Jack Harkness</T.SubHeader>
          <T.Caption lighter>Property Manager</T.Caption>
          <T.Caption lighter>(345) 678-9012</T.Caption>
          <T.Caption lighter>jack.harkness@email.com</T.Caption>
        </td>
      </tr>
    </Box>
  );

  return (
    <DemoPage title="Card">
      <DemoSection title="How do a I render a Card for emails?">
        <MDBlock>{`
        An Card is an element that can be used to render a container with 24px padding by default.

        In emails box-shadows are not allowed, so this component has a default style with borders that try
        to simulate box-shadows.
       `}</MDBlock>
        <PrettyPrint>
          {`
          <div style={ { padding: '20px', overflow: 'hidden' } }>
            <TopBar title="PROPERTY NAME & LOGO" subHeaderSection={ subHeaderSection } tall rightSectionTopPadding={ 0 } rightSectionWidth={ 212 } />
            <Card style={ { textAlign: 'center', overflow: 'hidden' } }>
              <T.Headline>This is a simple card</T.Headline>
            </Card>
          </div>
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ padding: '20px', overflow: 'hidden' }}>
          <TopBar title="PROPERTY NAME & LOGO" subHeaderSection={subHeaderSection} tall rightSectionTopPadding={0} rightSectionWidth={212} />
          <Card style={{ textAlign: 'center', overflow: 'hidden' }}>
            <T.Headline>This is a simple card</T.Headline>
          </Card>
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default CardDemo;

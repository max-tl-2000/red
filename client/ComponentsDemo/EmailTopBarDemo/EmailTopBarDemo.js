/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import TopBar from '../../../resources/custom-components/Email/TopBar/TopBar';
import SubHeaderAgentInfo from '../../../resources/custom-components/Email/SubHeaderAgentInfo/SubHeaderAgentInfo';
import PrettyPrint from '../DemoElements/PrettyPrint';

const TopBarDemo = () => {
  // This is an example of how to use sub header with agent info
  const subHeaderSection = <SubHeaderAgentInfo fullName="Jack Harkness" title="Property Manager" phone="(345) 678-9012" email="jack.harkness@email.com" />;

  return (
    <DemoPage title="Email TopBar">
      <DemoSection title="How do a I render a TopBar for Emails?">
        <MDBlock>{`
        An email TopBar is a component that renders a simple TopBar element with 2 sections.
        It allows you to set a \`title\` and a \`subHeader\`. If needed it can also support
        custom content to the \`titleSection\` and \`subHeaderSection\`. if \`tall\` is specified
        the \`TopBar\` will be rendered as 96px height instead of the default 56px.
       `}</MDBlock>
        <PrettyPrint>
          {`
          <div style={ { padding: '20px', overflow: 'hidden' } }>
            <TopBar title="PROPERTY NAME" />
          </div>
          <div style={ { padding: '20px', overflow: 'hidden' } }>
            <TopBar title="PROPERTY NAME" subHeader="Appointment details" />
          </div>
          <div style={ { padding: '20px', overflow: 'hidden' } }>
            <TopBar title="PROPERTY NAME" subHeader="Another title" tall />
          </div>
          <div style={ { padding: '20px', overflow: 'hidden' } }>
            <TopBar title="PROPERTY NAME & LOGO" subHeaderSection={ subHeaderSection } tall rightSectionTopPadding={ 0 } rightSectionWidth={ 212 } />
          </div>
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ width: 680, padding: '20px', overflow: 'hidden' }}>
          <TopBar title="PROPERTY NAME" />
        </div>
        <div style={{ width: 680, padding: '20px', overflow: 'hidden' }}>
          <TopBar title="PROPERTY NAME" subHeader="Appointment details" />
        </div>
        <div style={{ width: 680, padding: '20px', overflow: 'hidden' }}>
          <TopBar title="PROPERTY NAME" subHeader="Another title" tall />
        </div>
        <div style={{ width: 680, padding: '20px', overflow: 'hidden' }}>
          <TopBar title="PROPERTY NAME & LOGO" subHeaderSection={subHeaderSection} tall rightSectionTopPadding={0} rightSectionWidth={212} />
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default TopBarDemo;

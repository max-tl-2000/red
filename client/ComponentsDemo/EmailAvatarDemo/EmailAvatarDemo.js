/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import Avatar from '../../../resources/custom-components/Email/Avatar/Avatar';
import PrettyPrint from '../DemoElements/PrettyPrint';

const AvatarDemo = () => (
  <DemoPage title="Avatar">
    <DemoSection title="How do I render an Avatar in emails?">
      <MDBlock>{`
        Use the \`Email/Avatar\` component. This component will render the initials of the name provided
        in circle with random colors.
        `}</MDBlock>
      <PrettyPrint>
        {`
            <Avatar userName={ 'Red Admin' } />
            <Avatar userName={ 'Roy Riojas' } />
            <Avatar userName={ 'Bill Mayers' } />
            <Avatar userName={ 'Vianca Vivens' } />
          `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Avatar userName={'Red Admin'} />
      <Avatar userName={'Roy Riojas'} />
      <Avatar userName={'Bill Mayers'} />
      <Avatar userName={'Vianca Vivens'} />
    </DemoSection>
  </DemoPage>
);

export default AvatarDemo;

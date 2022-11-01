/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import Button from '../../../resources/custom-components/Email/Button/Button';
import PrettyPrint from '../DemoElements/PrettyPrint';

const ButtonDemo = () => (
  <DemoPage title="Button">
    <DemoSection title="How do a I render a simple button for emails?">
      <MDBlock>{`
         A simple button for emails can be rendered using the \`Email/Button/\` component.

         This component is implemented using the \`<a>\` tag to make them simpler to style in an email context.
       `}</MDBlock>
      <PrettyPrint>
        {`
         <Button label="Demo action" href="http://google.com" />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Button label="Demo action" href="http://google.com" />
    </DemoSection>
  </DemoPage>
);

export default ButtonDemo;

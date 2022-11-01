/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import PromotionalFooter from '../../../resources/custom-components/Email/PromotionalFooter/PromotionalFooter';
import PrettyPrint from '../DemoElements/PrettyPrint';

const PromotionalFooterDemo = () => {
  const linksArray = [
    {
      imgUrl: 'https://www.myncu.com/wp-content/uploads/2014/11/android.png',
      storeUrl: 'https://play.google.com/store?hl=en',
    },
    {
      imgUrl: 'http://www.dunritehvac.net/content/images/app%20store%20icon%20light%20grey.png',
      storeUrl: 'https://itunes.apple.com/us/genre/ios/id36?mt=8',
    },
  ];
  const appTextString = 'App available on iPhones 5 and above and all Android smartphones';
  return (
    <DemoPage title="Promotional Footer">
      <DemoSection title="How do a I render a simple promotional footer for emails?">
        <MDBlock>{`
         A simple footer for emails can be rendered using the \`Promotional/Footer/\` component.
         This component is implemented using inline styles to make it usable in an email context.
         the links inside will use the following schema
         const linksArray = [
           { imgUrl: 'imgUrlstring', storeUrl: 'urltostore' },
           { imgUrl: 'imgUrlstring', storeUrl: 'urltostore' },
           ];
       `}</MDBlock>
        <PrettyPrint>
          {`
         <PromotionalFooter links={LinksArray} appTextString="appTextString" />
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ minHeight: 120 }}>
          <PromotionalFooter links={linksArray} appTextString={appTextString} />
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default PromotionalFooterDemo;

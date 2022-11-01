/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import Footer from '../../../resources/custom-components/Email/Footer/Footer';
import PrettyPrint from '../DemoElements/PrettyPrint';

const FooterDemo = () => {
  const linksArray = [
    { text: 'Privacy policy', url: 'http://google.com' },
    { text: 'Disclaimer', url: 'http://google.com' },
    { text: 'Contact Us', url: 'http://google.com' },
  ];
  const allRightsReservedText = '© 2016 Property name inc, 9876 Church st., Mountain View CA 94043.';
  const tallFooterText =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed a vehicula nunc, ut vehicula massa. Aliquam erat volutpat. Etiam nunc mi, commodo a est in, facilisis posuere nisl. Aenean mollis dolor sit amet massa facilisis interdum vitae ac ligula. Donec porttitor dolor vel ligula lacinia, a maximus erat viverra.';
  return (
    <DemoPage title="Footer">
      <DemoSection title="How do a I render a simple footer for emails?">
        <MDBlock>{`
         A simple footer for emails can be rendered using the \`Email/Footer/\` component.

         This component is implemented using inline styles to make it usable in an email context.

         the links inside will use the following schema
         const linksArray = [
           { text: 'Privacy policy', url: 'http://google.com' },
           { text: 'Disclaimer', url: 'http://google.com' },
           { text: 'Contact Us', url: 'http://google.com' },
           ];
          if you want to use the tall footer just add the tallFooterText property and it will show
       `}</MDBlock>
        <PrettyPrint>
          {`
         <Footer links={LinksArray} allRightsReserved="allRightsReservedTextString" />

         <Footer links={LinksArray} tallFooterText="tallFooterTextString" allRightsReserved="allRightsReservedTextString" />
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ minHeight: 120 }}>
          <Footer links={linksArray} allRightsReserved={allRightsReservedText} />
        </div>
        <div>
          <Footer links={linksArray} tallFooterText={tallFooterText} allRightsReserved={allRightsReservedText} />
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default FooterDemo;

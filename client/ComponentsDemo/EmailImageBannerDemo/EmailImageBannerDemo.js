/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { DemoSection, DemoPage, SubHeader, MDBlock } from '../DemoElements';
import ImageBanner from '../../../resources/custom-components/Email/ImageBanner/ImageBanner';
import PrettyPrint from '../DemoElements/PrettyPrint';
import * as T from '../../../resources/custom-components/Email/Typography/Typography';

const ImageBannerDemo = () => {
  const datePanelData = { startDate: '2017-02-22 15:00' };
  const inventoryImagePanelData = {
    imgUrl: 'http://www.journaldespalaces.com/images/Veranda.png',
    topText: '1701 North Tower, Parkmerced',
    bottomText: '2 beds, 2 baths, 1192 sqft, Andromeda floor plan',
  };
  const locationPanelData = {
    url: 'http://www.google.com',
    imgUrl: 'http://misionbautistacalifornia.com/wp-content/uploads/2016/08/inicio-imagen-mapa.jpg',
  };
  return (
    <DemoPage title="Image Banner">
      <DemoSection title="How do a I render a simple immage banner for emails?">
        <MDBlock>{`
         A simple image banner for emails can be rendered using the \`Email/ImageBanner/\` component.

         This component is implemented using inline styles to make it usable in an email context.

         the datePanel objects inside will use the following schema
         const datePanelData = { month: 'January', day: '15', year: '2016', time: '10:30 am' };

         the inventoryImagePanel objects inside will use the following schema
         const inventoryImagePanelData = { imgUrl: 'http://www.journaldespalaces.com/images/Veranda.png', topText: '1701 North Tower, Parkmerced', bottomText: '2 beds, 2 baths, 1192 sqft, Andromeda floor plan' };

       `}</MDBlock>
        <PrettyPrint>
          {`
         <ImageBanner datePanelData={ datePanelData } inventoryImagePanelData={ inventoryImagePanelData } />

         <ImageBanner locationPanelData={ locationPanelData } />
        `}
        </PrettyPrint>
        <SubHeader>Result</SubHeader>
        <div style={{ display: 'block', minHeight: 220 }}>
          <T.Text>Image Banner</T.Text>
          <ImageBanner datePanelData={datePanelData} inventoryImagePanelData={inventoryImagePanelData} />
        </div>
        <div style={{ display: 'block', minHeight: 220 }}>
          <T.Text>Location Banner</T.Text>
          <ImageBanner locationPanelData={locationPanelData} />
        </div>
      </DemoSection>
    </DemoPage>
  );
};

export default ImageBannerDemo;

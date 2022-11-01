/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

import SvgAccount from '../../../resources/icons/account-available.svg';

export default class SVGDemo extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="SVG Demo">
        <DemoSection title="SVG Demo">
          <MDBlock>
            {`
                Loading an svg is as simple as importing it directly
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  import SvgAccount from '../../../resources/icons/account-available.svg'; // path to the svg file

                  <SvgAccount width={ 24 } height={ 24 } style={ { display: 'block' } } />
                  <SvgAccount width={ 48 } height={ 48 } style={ { display: 'block' } } />
                  <SvgAccount width={ 64 } height={ 64 } style={ { display: 'block' } } />
                  <SvgAccount width={ 128 } height={ 128 } style={ { display: 'block' } } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <SvgAccount width={24} height={24} style={{ display: 'block' }} />
          <SvgAccount width={48} height={48} style={{ display: 'block' }} />
          <SvgAccount width={64} height={64} style={{ display: 'block' }} />
          <SvgAccount width={128} height={128} style={{ display: 'block' }} />
        </DemoSection>
      </DemoPage>
    );
  }
}

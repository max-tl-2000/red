/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PreloaderBlock from 'components/PreloaderBlock/PreloaderBlock';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  ['size', 'String', 'normal', 'The size of the preloader: `small`, `normal` and  `big`'],
  ['style', 'Object', '', 'The style of the PreloaderBlock. It can be used to change the default height of the Preloader block'],
];

export default class PreloaderBlockDemo extends Component { // eslint-disable-line
  render() {
    return (
      <DemoPage title="PreloaderBlock">
        <PropertiesTable data={api} />
        <DemoSection title="How to render a PreloaderBlock">
          <MDBlock>
            {`
                a PreloaderBlock can be used to let the user know that there is some processing
                that is taking place and that will might take some time.

                PreloaderBlock will render a preloader centered in a box of certain minimun height
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                 `}
          </PrettyPrint>
          <SubHeader>Small Preloader</SubHeader>
          <PreloaderBlock size="small" />
          <SubHeader>Normal Preloader</SubHeader>
          <PreloaderBlock size="normal" />
          <SubHeader>Big Preloader</SubHeader>
          <PreloaderBlock size="big" />
        </DemoSection>
      </DemoPage>
    );
  }
}

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';

import { IconButton } from 'components';
import { icons } from 'components/Icon/Icon';
import { DemoSection, DemoPage, SubHeader, MDBlock, PrettyPrint } from '../DemoElements';

export default class IconButtonDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="IconButton">
        <DemoSection title="Light IconButton">
          <p className="p">Buttons with black foreground color for light backgrounds</p>
          <PrettyPrint className="javascript">
            {`
                  <IconButton iconName="oneOf([
                                '${icons.join("',\n              '")}'])"
                              id="string"
                              disabled="bool"
                              className="string"
                              iconStyle="oneOf(['light', 'dark'])
                              />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {icons.map(icon => (
            <IconButton key={icon} iconName={icon} />
          ))}
        </DemoSection>
        <DemoSection title="Dark IconButton">
          <p className="p">Buttons with white foreground color for dark backgrounds</p>
          <PrettyPrint className="javascript">
            {`
                  <IconButton iconName="oneOf([
                                '${icons.join("',\n              '")}'])"
                              id="string"
                              disabled="bool"
                              className="string"
                              iconStyle="oneOf(['light', 'dark'])
                              />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ background: 'black', padding: 10 }}>
            {icons.map(icon => (
              <IconButton key={icon} iconName={icon} iconStyle="light" />
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Intensity">
          <MDBlock>
            {`
                  Intensity is either \`normal\` or \`disabled\`. Normal is the default,
                  and disabled can be set using the \`disabled\` property
                 `}
          </MDBlock>
          <PrettyPrint>
            {`
                    <div style={ { padding: '.5rem' } }>
                      <IconButton iconName="home" />
                      <IconButton iconName="home" disabled />
                    </div>
                    <div style={ { padding: '.5rem', background: 'black' } }>
                      <IconButton iconName="home" iconStyle="light" />
                      <IconButton iconName="home" disabled iconStyle="light" />
                    </div>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ padding: '.5rem' }}>
            <IconButton iconName="home" />
            <IconButton iconName="home" disabled />
          </div>
          <div style={{ padding: '.5rem', background: 'black' }}>
            <IconButton iconName="home" iconStyle="light" />
            <IconButton iconName="home" disabled iconStyle="light" />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

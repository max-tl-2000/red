/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { AutoSize, Typography } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';
import { cf } from './AutoSize.scss';

const { Title, Text } = Typography;

export default class AutoSizeDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {};
  }

  render() {
    return (
      <DemoPage title="AutoSize">
        <DemoSection title="AutoSize Element">
          <MDBlock>
            {`
                   The AutoSize Element keeps track of the size of the container and re-render the content of the children if the size of the parent has changed.
                 `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <AutoSize breakpoints={null}>
                   { ({ width, height }) => {
                       const size = \`\${width}, \${height}\`;
                       let gridType = 'small-grid';
                       if (width > 480) {
                         gridType = 'medium-grid';
                       }

                       if (width > 840) {
                         gridType = 'large-grid';
                       }

                       return <div>
                         <Title>Size: <Text inline secondary>{size}</Text>, <Text inline secondary>{gridType}</Text></Title>
                         <div className={ cf('grid', gridType) }>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('left-panel') }>cell than span others</div>
                          </div>
                       </div>;
                     } }
                 </AutoSize>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <AutoSize breakpoints={null}>
            {({ width, height }) => {
              const size = `${width}, ${height}`;
              let gridType = 'small';
              if (width > 480) {
                gridType = 'medium';
              }

              if (width > 840) {
                gridType = 'large';
              }

              return (
                <div>
                  <Title>
                    Size:{' '}
                    <Text inline secondary>
                      {size}
                    </Text>
                    ,{' '}
                    <Text inline secondary>
                      {gridType}
                    </Text>
                  </Title>
                  <div className={cf('grid', gridType)}>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('cell')}>cell</div>
                    <div className={cf('left-panel')}>cell</div>
                  </div>
                </div>
              );
            }}
          </AutoSize>

          <DemoSection title="AutoSize using breakpoints">
            <MDBlock>{`
                    The \`breakpoints\` property controls whether the \`AutoSize\` element needs to be render on every change or if it
                    only needs to be render when the layout based on the breakpoints change.
                    `}</MDBlock>
            <PrettyPrint>
              {`
                    <AutoSize breakpoints={ { 'small-grid': [0, 480], 'medium-grid': [481, 840], 'large-grid': [840, Infinity] } }>
                      { ({ width, height, breakpoint: gridType }) => {
                       const size = \`\${width}, \${height}\`;
                       return <div>
                         <Title>Size: <Text inline secondary>{size}</Text>, <Text inline secondary>{gridType}</Text></Title>
                         <div className={ cf('grid', gridType) }>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('cell') }>cell</div>
                            <div className={ cf('left-panel') }>cell</div>
                          </div>
                       </div>;
                     } }
                    </AutoSize>
                    `}
            </PrettyPrint>
            <SubHeader>Result</SubHeader>
            <AutoSize
              breakpoints={{
                small: [0, 480],
                medium: [481, 840],
                large: [840, Infinity],
              }}>
              {({ width, height, breakpoint: gridType }) => {
                const size = `${width}, ${height}`;
                return (
                  <div>
                    <Title>
                      Size:{' '}
                      <Text inline secondary>
                        {size}
                      </Text>
                      ,{' '}
                      <Text inline secondary>
                        {gridType}
                      </Text>
                    </Title>
                    <div className={cf('grid', gridType)}>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('cell')}>cell</div>
                      <div className={cf('left-panel')}>cell</div>
                    </div>
                  </div>
                );
              }}
            </AutoSize>
          </DemoSection>
        </DemoSection>
      </DemoPage>
    );
  }
}

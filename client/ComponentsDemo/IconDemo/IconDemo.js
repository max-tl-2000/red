/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import Icon, { icons } from 'components/Icon/Icon';
import rand from 'helpers/rand';
import { cf } from './IconDemo.scss';

import { DemoSection, DemoPage, MDBlock, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import IconAnimTest from './IconAnimTest';

export default class IconDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Icons">
        <DemoSection title="Animation Tester">
          <MDBlock>
            {`
                Select two icons to morph between them in a looped sequence
                `}
          </MDBlock>
          <IconAnimTest />
        </DemoSection>

        <DemoSection title="basic jsx">
          <PrettyPrint className="html">
            {`<Icon name="oneOf(['${icons.join("',\n                   '")}'])"
                         id="string"
                         className="string"
                         duration="number"
                         easing="string"
                         rotation="oneOf(['clock', 'counterclock', 'none'])"
                         iconStyle="oneOf(['light', 'dark'])"
                         style="object"
                    />`}
          </PrettyPrint>
        </DemoSection>
        <DemoSection title="Icons list">
          <p className="p">The following shows all the available icons </p>
          <PrettyPrint className="html">
            {`
                 <div className={ cf('menu-bar') }>
                    { icons.map((icon) => <div key={ icon } className={ cf('icon-row') }>
                                            <div className={ cf('ico') }>
                                              <Icon name={ icon } />
                                            </div>
                                            <p className="p">
                                              { icon }
                                            </p>
                                          </div>) }
                 </div>
                 `}
          </PrettyPrint>

          <div className={cf('menu-bar')}>
            {icons.map(icon => (
              <div key={icon} className={cf('icon-row')}>
                <div className={cf('ico')}>
                  <Icon name={icon} />
                </div>
                <p className="p">{icon}</p>
              </div>
            ))}
          </div>
        </DemoSection>
        <DemoSection title="Random Size for the icons">
          <p className="p">The following shows how to make the icons to be rendered at any size</p>
          <PrettyPrint className="html">
            {`
                 <div className={ cf('menu-bar') }>
                    { icons.map((icon) => {
                       const size = rand(30, 90);
                       return <div key={ icon } className={ cf('ri-item') }>
                                <div>
                                  <Icon name={ icon } style={ { width: size, height: size } } />
                                </div>
                              </div>;
                       }) }
                 </div>
                 `}
          </PrettyPrint>

          <div className={cf('menu-bar')}>
            {icons.map(icon => {
              const size = rand(30, 90);
              return (
                <div key={icon} className={cf('ri-item')}>
                  <div>
                    <Icon name={icon} style={{ width: size, height: size }} />
                  </div>
                </div>
              );
            })}
          </div>
        </DemoSection>
        <DemoSection title="Black Background">
          <p className="p">The following shows how to render icons on a dark background</p>
          <PrettyPrint className="html">
            {`
                 <div className={ cf('vertical-bar') }>
                   { icons.map((icon) => <div key={ icon } className={ cf('ico') }>
                                           <Icon name={ icon } iconStyle="light" />
                                         </div>) }
                 </div>
                 `}
          </PrettyPrint>
          <div className={cf('vertical-bar')}>
            {icons.map(icon => (
              <div key={icon} className={cf('ico')}>
                <Icon name={icon} iconStyle="light" />
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Intensity">
          <MDBlock>
            {`
                  Intensity is controlled by two properties: \`primary\` (.87 opacity) and \`secondary\` (.54 opacity)
                 `}
          </MDBlock>
          <PrettyPrint>
            {`
                     <div style={ { padding: '.5rem' } }>
                       <Icon name="home" />
                       <Icon name="home" disabled />
                     </div>
                     <div style={ { padding: '.5rem', background: 'black' } }>
                      <Icon name="home" iconStyle="light" />
                      <Icon name="home" disabled iconStyle="light" />
                    </div>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ padding: '.5rem' }}>
            <Icon name="home" />
            <Icon name="home" disabled />
          </div>
          <div style={{ padding: '.5rem', background: 'black' }}>
            <Icon name="home" iconStyle="light" />
            <Icon name="home" disabled iconStyle="light" />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

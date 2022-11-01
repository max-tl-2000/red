/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { CardMenu, CardMenuItem } from 'components';
import notifier from 'helpers/notifier/notifier';
import MDBlock from '../DemoElements/MDBlock';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import { cf } from './styles.scss';

export default class CardMenuDemo extends Component {
  onClick() {
    notifier.info('in event handler');
  }

  handleSelect({ action }) {
    notifier.info(`handle select ${action}`);
  }

  render() {
    return (
      <DemoPage title="CardMenu">
        <DemoSection title="Default">
          <PrettyPrint className="html">
            {`
            <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')}>
              <CardMenuItem text="Lorem" />
              <CardMenuItem text="Ipsum" />
            </CardMenu>
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('menu-container')}>
            <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')}>
              <CardMenuItem text="Lorem" />
              <CardMenuItem text="Ipsum" />
            </CardMenu>
          </div>
        </DemoSection>

        <DemoSection title="Hiding and disabling menu items">
          <PrettyPrint className="html">
            {`<CardMenu iconName="dots-vertical">
              <CardMenuItem text="Lorem" />
              { false && <CardMenuItem text="Ipsum" /> }
              <CardMenuItem disabled={ true } text="Dolor" />
            </CardMenu>`}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('menu-container')}>
            <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')}>
              <CardMenuItem text="Lorem" />
              {false && <CardMenuItem text="Ipsum" />}
              <CardMenuItem disabled={true} text="Dolor" />
            </CardMenu>
          </div>
        </DemoSection>

        <DemoSection title="Click handling">
          <PrettyPrint className="html">
            {`
            <CardMenu iconName="dots-vertical">
              <CardMenuItem text="Lorem" onClick={ this.onClick } />
              <CardMenuItem text="Ipsum" onClick={ this.onClick } disabled={ true } />
            </CardMenu>

            onClick() {
              console.log('in event handler')
            }`}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('menu-container')}>
            <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')}>
              <CardMenuItem text="Lorem" onClick={this.onClick} />
              <CardMenuItem text="Ipsum" onClick={this.onClick} disabled={true} />
            </CardMenu>
          </div>
        </DemoSection>

        <DemoSection title="Rendering icons">
          <MDBlock>{`
            CardMenu can render icons setting the \`iconName\` property to any of the Icons available in the Icons section.

            CardMenu also exposes an event called \`onSelect\` this event can be used to listen to the selected element in the \`CardMenuItem\` list.

          `}</MDBlock>
          <PrettyPrint className="html">
            {`
              <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')} onSelect={this.handleSelect}>
                <CardMenuItem text="Share" iconName="share" action="Share" />
                <CardMenuItem text="Add attachment" iconName="attachment" action="AddAttachement" />
                <CardMenuItem text="Print this page" iconName="printer" action="Print" />
                <CardMenuItem disabled text="Call forward" iconName="call-forward" action="CallForward" />
              </CardMenu>
            `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('menu-container')}>
            <CardMenu iconName="dots-vertical" iconClassName={cf('demo-button')} onSelect={this.handleSelect}>
              <CardMenuItem text="Share" iconName="share" action="Share" />
              <CardMenuItem text="Add attachment" iconName="attachment" action="AddAttachement" />
              <CardMenuItem text="Print this page" iconName="printer" action="Print" />
              <CardMenuItem disabled text="Call forward" iconName="call-forward" action="CallForward" />
            </CardMenu>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Icon, Button, ActionButton, ActionMenu, ActionMenuItem, Switch, IconButton } from 'components';
import { DemoSection, DemoPage, MDBlock, PrettyPrint, SubHeader } from '../DemoElements';
import { cf } from './styles.scss';

export default class ButtonDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.state = {};
  }

  handleRequest = () => {
    console.log('maintenance requested');
    this.refs.actionMenuDemo.close();
  };

  log(source) {
    return () => console.log('Log comming from ', source);
  }

  render() {
    return (
      <DemoPage title="Buttons">
        <DemoSection title="Buttons and different states">
          <p className="p">The following shows the different states of both primary and secondary buttons both flat and raised ones</p>
          <PrettyPrint className="html">
            {`
                  <Button
                    type="oneOf(['flat','raised'])"
                    btnRole="oneOf(['primary', 'secondary'])"
                    label="string"
                    disabled="boolean, deafult: false"
                    className="string"
                    />

                  <Button
                    type="oneOf(['flat','raised'])"
                    btnRole="oneOf(['primary', 'secondary'])">
                    <Icon name="calendar" /><span>Custom content here</span>
                  </Button>
                `}
          </PrettyPrint>
          <table className={cf('buttons-table')}>
            <tbody>
              <tr>
                <td colSpan="2">FLAT BUTTONS</td>
                <td colSpan="2">RAISED BUTTONS</td>
              </tr>
              <tr>
                <td>Primary</td>
                <td>Secondary</td>
                <td>Primary</td>
                <td>Secondary</td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="NORMAL" />
                </td>
                <td>
                  <Button type="flat" label="NORMAL" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="NORMAL" />
                </td>
                <td>
                  <Button type="raised" label="NORMAL" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="focused" className="focused" />
                </td>
                <td>
                  <Button type="flat" label="focused" className="focused" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="focused" className="focused" />
                </td>
                <td>
                  <Button type="raised" label="focused" className="focused" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="hovered" className="hovered" />
                </td>
                <td>
                  <Button type="flat" label="hovered" className="hovered" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="hovered" className="hovered" />
                </td>
                <td>
                  <Button type="raised" label="hovered" className="hovered" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="pressed" className="pressed" />
                </td>
                <td>
                  <Button type="flat" label="pressed" className="pressed" btnRole="secondary" />
                </td>
                <td>
                  <Button type="raised" label="pressed" className="pressed" />
                </td>
                <td>
                  <Button type="raised" label="pressed" className="pressed" btnRole="secondary" />
                </td>
              </tr>
              <tr>
                <td>
                  <Button type="flat" label="disabled" disabled />
                </td>
                <td>
                  <Button type="flat" label="disabled" btnRole="secondary" disabled />
                </td>
                <td>
                  <Button type="raised" label="disabled" disabled />
                </td>
                <td>
                  <Button type="raised" label="disabled" btnRole="secondary" disabled />
                </td>
              </tr>
            </tbody>
          </table>
        </DemoSection>

        <DemoSection title="Action Button">
          <p className="p">An action button is used to create floating buttons. The base markup is shown below</p>
          <PrettyPrint className="html">
            {`
                  <ActionButton size="oneOf(['large', 'small'])"
                                onClick={this.handleTouch}>
                    <Icon name="plus" />
                  </ActionButton>
                 `}
          </PrettyPrint>
          <ActionButton size="large" onClick={this.log('actionButton')}>
            <Icon name="plus" />
          </ActionButton>
        </DemoSection>

        <DemoSection title="Action Button Large">
          <p className="p">A simple large action button</p>
          <PrettyPrint className="html">
            {`
                  <ActionButton size="large"
                                onClick={this.handleTouch}>
                    <Icon name="plus" />
                  </ActionButton>
                  `}
          </PrettyPrint>
          <ActionButton size="large" onClick={this.log('actionButton')}>
            <Icon name="plus" />
          </ActionButton>
        </DemoSection>
        <DemoSection title="Action Button Small" className={cf('regular-buttons')}>
          <p className="p">Simple small action buttons</p>
          <PrettyPrint className="html">
            {`
                  <ActionButton size="small"
                                onClick={this.handleTouch}>
                    <Icon name="fire" />
                  </ActionButton>
                  `}
          </PrettyPrint>
          <ActionButton onClick={this.log('action item fire')}>
            <Icon name="fire" />
          </ActionButton>
          <ActionButton onClick={this.log('action item calendar')}>
            <Icon name="calendar" />
          </ActionButton>
          <ActionButton onClick={this.log('action item account')}>
            <Icon name="account" />
          </ActionButton>
        </DemoSection>
        <DemoSection title="Action Menu (or FAB)">
          <MDBlock>{`This is a demo of an action menu With some options. The location of the button can be controlled
                   with css using the \`btnClassName\` prop.

                   By default menu items are left aligned. Setting the \`rightAligned\` property in the \`ActionMenu\` will make
                   every menu item to be shown as right aligned.`}</MDBlock>
          <PrettyPrint className="html">
            {`
                  <ActionMenu ref="actionMenuDemo"
                              icon="plus"
                              iconOpen="close"
                              rightAligned={ true }
                              btnClassName={ cf('action-menu-trigger') }>
                    <ActionMenuItem icon="fire"
                                    text="Request maintenance"
                                    onClick={ () => this.refs.actionMenuDemo.close() } />
                    <ActionMenuItem icon="calendar" text="Schedule appointment" />
                    <ActionMenuItem icon="account" text="New Party" />
                  </ActionMenu>`}
          </PrettyPrint>
          <ActionMenu ref="actionMenuDemo" icon="plus" iconOpen="close" rightAligned={true} btnClassName={cf('action-menu-trigger')}>
            <ActionMenuItem icon="fire" text="Request maintenance" onClick={this.handleRequest} />
            <ActionMenuItem icon="calendar" text="Schedule appointment" />
            <ActionMenuItem icon="account" text="New Party" />
          </ActionMenu>
        </DemoSection>

        <DemoSection title="Button with loading state">
          <MDBlock>{`
                  Some times when some process takes some time, it might be desirable to render \`Buttons\` in a loading state.
                  Setting the \`loading\` prop to true will hide the text and render a loading element

                  Click on the button below to change the loading state.
                `}</MDBlock>
          <PrettyPrint>
            {`
                    <Switch label="Show loading state" onChange={ (checked) => this.setState({ loading: checked }) } />
                    <div style={ { padding: '10px 0' } }>
                      <Button style={ { marginRight: 10 } } label="Process Order" loading={ this.state.loading } />
                      <Button style={ { marginRight: 10 } } btnRole="secondary" label="Sign In" loading={ this.state.loading } />
                      <Button style={ { marginRight: 10 } } type="flat" label="Process Order" loading={ this.state.loading } />
                      <Button style={ { marginRight: 10 } } type="flat" btnRole="secondary" label="Sign In" loading={ this.state.loading } />
                      <IconButton style={ { marginRight: 10 } } iconName="home" loading={ this.state.loading } />
                      <div style={ { verticalAlign: 'top', width: 40, height: 40, display: 'inline-block', background: '#000' } }>
                        <IconButton iconStyle="light" iconName="plus" loading={ this.state.loading } />
                      </div>
                    </div>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Switch label="Show loading state" onChange={checked => this.setState({ loading: checked })} />
          <div style={{ padding: '10px 0' }}>
            <Button style={{ marginRight: 10 }} label="Process Order" loading={this.state.loading} />
            <Button style={{ marginRight: 10 }} btnRole="secondary" label="Sign In" loading={this.state.loading} />
            <Button style={{ marginRight: 10 }} type="flat" label="Process Order" loading={this.state.loading} />
            <Button style={{ marginRight: 10 }} type="flat" btnRole="secondary" label="Sign In" loading={this.state.loading} />
            <IconButton style={{ marginRight: 10 }} iconName="home" loading={this.state.loading} loaderStyle="darker" />
            <div
              style={{
                verticalAlign: 'top',
                width: 40,
                height: 40,
                display: 'inline-block',
                background: '#000',
              }}>
              <IconButton iconStyle="light" iconName="plus" loading={this.state.loading} />
            </div>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

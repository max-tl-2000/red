/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Switch } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class SwitchDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      demoChecked: false,
    };
  }

  render() {
    return (
      <DemoPage title="Switch">
        <DemoSection title="Simplest">
          <p className="p">A simple switch using REDisrupt styles</p>
          <PrettyPrint className="javascript">
            {`
                  <Switch />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch />
          </div>
        </DemoSection>
        <DemoSection title="With a label">
          <p className="p">Using a label on the right</p>
          <PrettyPrint className="javascript">
            {`
                  <Switch label="My awesome switch"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch label="My Awesome switch" />
          </div>
        </DemoSection>

        <DemoSection title="Disabled">
          <p className="p">Disabled switch</p>
          <PrettyPrint className="javascript">
            {`
                  <Switch label="My awesome switch" disabled />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch label="My Awesome switch" disabled />
          </div>
        </DemoSection>

        <DemoSection title="With a really long label">
          <p className="p">Really long label</p>
          <PrettyPrint className="javascript">
            {`
                  <Switch label="Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch
              label="Lorem ipsum dolor sit amet, consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
consectetur adipiscing elit.eckbox"
            />
          </div>
        </DemoSection>

        <DemoSection title="Toggling the properties from outside">
          <p className="p">To check props cause the component to render the correct new state</p>
          <PrettyPrint className="javascript">
            {`
                  <Switch label="Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch checked={this.state.demoChecked} label="I will change based on whatever value is checked on the other switch" />
            <br />
            <Switch
                    onChange={ () => this.setState({demoChecked: !this.state.demoChecked}) }  // eslint-disable-line
              label="Change the value"
            />
          </div>
        </DemoSection>

        <DemoSection title="With a label on the other side">
          <PrettyPrint className="javascript">
            {`
                  <Switch label="Lorem ipsum dolor sit amet" reverse />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Switch label="Lorem ipsum dolor sit amet" reverse />
          </div>
        </DemoSection>

        <DemoSection title="on a darker background">
          <PrettyPrint className="javascript">
            {`
                  <Switch label="Lorem ipsum dolor sit amet" reverse foregroundMode="light" />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <div style={{ background: '#1e88e5', padding: '1.5rem 2rem' }}>
              <Switch label="Lorem ipsum dolor sit amet" reverse foregroundMode="light" />
            </div>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

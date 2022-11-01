/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Radio } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class RadioDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      demoChecked: false,
    };
  }

  render() {
    return (
      <DemoPage title="Radio">
        <DemoSection title="Simplest">
          <p className="p">A simple radio using REDisrupt styles</p>
          <PrettyPrint className="javascript">
            {`
                  <Radio />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Radio />
          </div>
        </DemoSection>
        <DemoSection title="With a label">
          <p className="p">Using a label on the right</p>
          <PrettyPrint className="javascript">
            {`
                  <Radio label="My awesome radio"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Radio label="My Awesome radio" />
          </div>
        </DemoSection>

        <DemoSection title="Disabled">
          <p className="p">Render a disabled radio</p>
          <PrettyPrint className="javascript">
            {`
                  <Radio label="My awesome radio" disabled/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Radio label="My Awesome radio" disabled />
          </div>
        </DemoSection>

        <DemoSection title="With a really long label">
          <p className="p">Really long label</p>
          <PrettyPrint className="javascript">
            {`
                  <Radio label="Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Radio
              label="Lorem ipsum dolor sit amet, consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
consectetur adipiscing elit.eckbox"
            />
          </div>
        </DemoSection>

        <DemoSection title="Toggling the properties from outside">
          <p className="p">To check props cause the component to render the correct new state</p>
          <PrettyPrint className="javascript">
            {`
                  <Radio label="Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Radio checked={this.state.demoChecked} label="I will change based on whatever value is checked on the other radio" />
            <br />
            <Radio
                    onChange={ () => this.setState({demoChecked: !this.state.demoChecked}) }  // eslint-disable-line
              label="Change the value"
            />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

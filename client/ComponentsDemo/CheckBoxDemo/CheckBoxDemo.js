/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { CheckBox } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class CheckBoxDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      demoChecked: false,
    };
  }

  render() {
    return (
      <DemoPage title="CheckBox">
        <DemoSection title="Simplest">
          <p className="p">A simple checkbox using REDisrupt styles</p>
          <PrettyPrint className="javascript">
            {`
                    <CheckBox />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox />
          </div>
        </DemoSection>
        <DemoSection title="With a label">
          <p className="p">Using a label on the right</p>
          <PrettyPrint className="javascript">
            {`
                  <CheckBox label="My awesome checkbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox label="My Awesome checkbox" />
          </div>
        </DemoSection>

        <DemoSection title="Disabled">
          <p className="p">Disabled checkbox</p>
          <PrettyPrint className="javascript">
            {`
                  <CheckBox label="My awesome checkbox" disabled />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox label="My Awesome checkbox" disabled />
          </div>
        </DemoSection>

        <DemoSection title="With a really long label">
          <p className="p">Really long label</p>
          <PrettyPrint className="javascript">
            {`
                  <CheckBox label="Lorem ipsum dolor sit amet, consectetur adipiscing
                                   elit.eckbox Lorem ipsum dolor sit amet, consectetur
                                   adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox
              label="Lorem ipsum dolor sit amet, consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
consectetur adipiscing elit.eckbox"
            />
          </div>
        </DemoSection>

        <DemoSection title="Toggling the properties from outside">
          <p className="p">To check props cause the component to render the correct new state</p>
          <PrettyPrint className="javascript">
            {`
                  <CheckBox label="Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox Lorem ipsum dolor sit amet,
                    consectetur adipiscing elit.eckbox"/>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox checked={this.state.demoChecked} label="I will change based on whatever value is checked on the other checkbox" />
            <br />
            <CheckBox
                    onChange={ () => this.setState({demoChecked: !this.state.demoChecked}) }  // eslint-disable-line
              label="Change the value"
            />
          </div>
        </DemoSection>

        <DemoSection title="CheckBox using a different icon">
          <p className="p">Useful for cases when a special check is required (like on the top of a table)</p>
          <PrettyPrint className="javascript">
            {`
                <CheckBox type="checkAll" />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <CheckBox type="checkAll" />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

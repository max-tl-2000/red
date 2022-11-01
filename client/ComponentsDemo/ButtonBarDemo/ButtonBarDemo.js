/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { ButtonBar, Dropdown, AutoSize, Switch } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';
import { cf } from './ButtonBarDemo.scss';

export default class ButtonBarDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.bedroomsData = ['studio', '1 bed', '2 beds', '3 beds', '4+ beds'].map(label => ({ id: label, text: label }));

    this.bathroomsData = ['1 bathroom', '1.5 bathrooms', '2 bathrooms', '3 bathrooms'].map(label => ({ id: label, text: label }));

    this.state = {
      useButtonWidth: false,
    };
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    return (
      <DemoPage id={theId} title="ButtonBar">
        <DemoSection title="ButtonBar">
          <MDBlock>
            {`
                  The \`ButtonBar\` is a component used to pick values from a small set of possible options.

                  Same as \`SelectionGroup\` and \`Dropdown\` this component has a \`items\` prop that expects an array
                  with the following structure:
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  [ {id, text}, {id, text}, {id, text}, ... ]
                 `}
          </PrettyPrint>
          <MDBlock>
            {`
                  If the data structure does not have those \`id\`, \`text\` fields the prop \`textField\` and \`valueField\` can be used instead

                  **Important:** When there are more than five options use a \`Dropdown\` component. Or when the parent container is too small to fit
                  a ButtonBar.
                 `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <ButtonBar label="Bedrooms"
                          items={ this.bedroomsData }
                          selectedValue={ this.state.bedrooms }
                          onChange={ ({ ids }) => this.setState({ bedrooms: ids }) }
                          multiple
                          />;
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>

          <AutoSize className={cf('container')}>
            {({ breakpoint }) => do {
              if (breakpoint !== 'small') {
                <ButtonBar
                  label="Bedrooms"
                  items={this.bedroomsData}
                  selectedValue={this.state.bedrooms}
                  onChange={({ ids }) => this.setState({ bedrooms: ids })}
                  multiple
                />;
              } else {
                <Dropdown
                  label="Bedrooms"
                  selectedValue={this.state.bedrooms}
                  onChange={({ ids }) => this.setState({ bedrooms: ids })}
                  items={this.bedroomsData}
                  multiple
                />;
              }
            }}
          </AutoSize>

          <DemoSection title="Aligning items">
            <MDBlock>{`
                  By default, ButtonBar display mode is \`block\`. Which means it will take up to \`100%\` of the parent element.
                  The options will be distributed evenly inside the selector.

                  This can create some issues to layout elements that have different number of options side by side.
                  Check the following example:

                  `}</MDBlock>
            <PrettyPrint>
              {`
                    <ButtonBar label="Bedrooms"
                          items={ this.bedroomsData }
                          className={ cf({ 'my-button-bar': this.state.useButtonWidth }) }
                          selectedValue={ this.state.bedrooms }
                          onChange={ ({ ids }) => this.setState({ bedrooms: ids }) }
                          multiple
                          />
                    <ButtonBar label="Bathrooms"
                          items={ this.bathroomsData }
                          className={ cf({ 'my-button-bar': this.state.useButtonWidth }) }
                          selectedValue={ this.state.bathrooms }
                          onChange={ ({ ids }) => this.setState({ bathrooms: ids }) }
                          multiple
                          />
                   `}
            </PrettyPrint>
            <SubHeader>Result</SubHeader>
            <div className={cf('demo-container')}>
              <Switch
                label="Set button width"
                checked={this.state.useButtonWidth}
                onChange={checked => {
                  console.log('checked', checked);
                  this.setState({ useButtonWidth: checked });
                }}
              />
              <ButtonBar
                label="Bedrooms"
                items={this.bedroomsData}
                className={cf({ 'my-button-bar': this.state.useButtonWidth })}
                selectedValue={this.state.bedrooms}
                onChange={({ ids }) => this.setState({ bedrooms: ids })}
                multiple
              />
              <ButtonBar
                label="Bathrooms"
                items={this.bathroomsData}
                className={cf({ 'my-button-bar': this.state.useButtonWidth })}
                selectedValue={this.state.bathrooms}
                onChange={({ ids }) => this.setState({ bathrooms: ids })}
                multiple
              />
            </div>
          </DemoSection>
        </DemoSection>
      </DemoPage>
    );
  }
}

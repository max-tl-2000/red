/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { FlyOutAmountEditor } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock } from '../DemoElements';

export default class FlyOutAmountEditorDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      amount1: 300,
      amount2: 400,
    };
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);
    const { amount1, amount2 } = this.state;

    return (
      <DemoPage id={theId} title="FlyOutAmountEditor">
        <DemoSection title="Simple Amount Editor">
          <MDBlock>
            {`
                The following is an example of a simple amout editor component.FlyOutAmountEditorDemo.js

                This will receive the following parameters:

                - \`moneySign\`: it can be used to change the label at the left of the textfield. Default \`$\`.
                  It can be changed to something like: \`$/Month\`
                - \`periodic\`: If the amount is periodic, a total savings will be calculated and shown at the left of the TextBox.
                - \`period\`: The period to be used for the calculated savings. Default 12
                - \`invalidInputError\`: The error to be shown when the input is not a number
                - \`greaterThanMaxError\`: The error to be shown when the input is greated than the provided maximum
                - \`max\`: The maximum value to be allowed by this editor
                - \`onLabelClick\`: Event that fires when the label is clicked. If provided the FlyOut won't open unless an \`open\` property is
                    provided. Also \`onCloseRequest\` will be fired to close  Check the example that use the parent state.
                - \`onCloseRequest\`: Event that fires when FlyOut requires to be closed
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <SubHeader>Simple check of maximum value</SubHeader>
                   <div style={ { textAlign: 'right' } }>
                      <FlyOutAmountEditor value={ amount1 }
                                          max={ 400 }
                                          invalidInputError="Only numbers please"
                                          greaterThanMaxError="Verify the amount is not bigger than max"
                                          onChange={ ({ value }) => this.setState({ amount1: value }) } />
                   </div>
                   <SubHeader>Calculate the Savings in a given period</SubHeader>
                   <div style={ { textAlign: 'right', minHeight: 300 } }>
                      <FlyOutAmountEditor value={ amount2 }
                                          invalidInputError="Only numbers please"
                                          greaterThanMaxError="Verify the amount is not bigger than max"
                                          periodic
                                          period={ 12 }
                                          prefix="$/Month"
                                          max={ 400 }
                                          onChange={ ({ value }) => this.setState({ amount2: value }) } />
                   </div>
                 `}
          </PrettyPrint>
          <SubHeader>Simple check of maximum value</SubHeader>
          <div style={{ textAlign: 'right' }}>
            <FlyOutAmountEditor
              value={amount1}
              max={400}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              onChange={({ value }) => this.setState({ amount1: value })}
            />
          </div>
          <SubHeader>Calculate the Savings in a given period</SubHeader>
          <div style={{ textAlign: 'right' }}>
            <FlyOutAmountEditor
              value={amount2}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              periodic
              period={12}
              prefix="$/Month"
              max={400}
              onChange={({ value }) => this.setState({ amount2: value })}
            />
          </div>
          <SubHeader>Opening it using parent state (Controlled mode)</SubHeader>
          <div style={{ textAlign: 'right' }}>
            <FlyOutAmountEditor
              value={this.state.amount3}
              open={this.state.amountOverlayOpen}
              onLabelClick={() => this.setState({ amountOverlayOpen: true })}
              onCloseRequest={() => this.setState({ amountOverlayOpen: false })}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              periodic
              period={12}
              prefix="$/Month"
              max={400}
              onChange={({ value }) => this.setState({ amount3: value })}
            />
          </div>

          <SubHeader>Show the increase or decrease of the value as percentage (relative to an originalValue)</SubHeader>
          <div style={{ textAlign: 'right' }}>
            <FlyOutAmountEditor
              value={this.state.amount6}
              open={this.state.amountOverlayOpen3}
              onLabelClick={() => this.setState({ amountOverlayOpen3: true })}
              onCloseRequest={() => this.setState({ amountOverlayOpen3: false })}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              showPercentage
              originalValue={500}
              max={1000}
              onChange={({ value }) => this.setState({ amount6: value })}
            />
          </div>

          <SubHeader>Checking max and min</SubHeader>
          <div style={{ textAlign: 'right' }}>
            <FlyOutAmountEditor
              value={this.state.amount4}
              min={100}
              max={300}
              open={this.state.amountOverlayOpen2}
              onLabelClick={() => this.setState({ amountOverlayOpen2: true })}
              onCloseRequest={() => this.setState({ amountOverlayOpen2: false })}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              lowerThanMinError="Verify the amount is not lesser than min"
              onChange={({ value }) => this.setState({ amount4: value })}
            />
          </div>

          <SubHeader>Showing a reset button</SubHeader>
          <div style={{ textAlign: 'right', minHeight: 300 }}>
            <FlyOutAmountEditor
              value={this.state.amount5}
              min={100}
              max={900}
              originalValue={500}
              open={this.state.amountOverlayOpen4}
              onLabelClick={() => this.setState({ amountOverlayOpen4: true })}
              onCloseRequest={() => this.setState({ amountOverlayOpen4: false })}
              invalidInputError="Only numbers please"
              greaterThanMaxError="Verify the amount is not bigger than max"
              lowerThanMinError="Verify the amount is not lesser than min"
              onChange={({ value }) => this.setState({ amount5: value })}
            />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

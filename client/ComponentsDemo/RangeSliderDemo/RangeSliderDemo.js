/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { RangeSlider } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class RangeSliderDemo extends Component {
  state = {};

  singleSliderFn = value => console.log(value);

  singleSliderLabelFn = value => console.log(value);

  dualSliderFn = value => console.log(value);

  render() {
    return (
      <DemoPage title="Single and Dual Range Slider Demo">
        <DemoSection title="Single Range Slider">
          <PrettyPrint className="html">
            {`
                  <RangeSlider
                      connect="lower"
                      range={ { min: 1, max: 100 } }
                      val={ { min: 1 } }
                      onChange={ (args) => this.singleSliderFn(args) } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider connect="lower" range={{ min: 1, max: 100 }} val={{ min: 1 }} onChange={args => this.singleSliderFn(args)} />
        </DemoSection>

        <DemoSection title="Single Range Slider With Label">
          <PrettyPrint className="html">
            {`
                  <RangeSlider
                      label="label"
                      connect="lower"
                      className={ 'noLabelSlider' }
                      range={ { min: 1, max: 100 } }
                      val={ { min: 1 } }
                      onChange={ (args) => this.singleSliderLabelFn(args) } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider
            label="label"
            connect="lower"
            className={'noLabelSlider'}
            range={{ min: 1, max: 100 }}
            val={{ min: 1 }}
            onChange={args => this.singleSliderLabelFn(args)}
          />
        </DemoSection>

        <DemoSection title="Single Range Slider With Input Field">
          <PrettyPrint className="html">
            {`
                  <RangeSlider
                      connect="lower"
                      input={ true }
                      range={ { min: 1, max: 100 } }
                      val={ { min: 1 } }
                      onChange={ (args) => this.singleSliderFn(args) } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider connect="lower" input={true} range={{ min: 1, max: 100 }} val={{ min: 1 }} onChange={args => this.singleSliderFn(args)} />
        </DemoSection>

        <DemoSection title="Dual Range Slider">
          <PrettyPrint className="html">
            {`
                <RangeSlider
                    connect={ true }
                    step={ 5 }
                    range={ { min: 1, max: 100 } }
                    val={ { min: 1, max: 100 } }
                    onChange={ (args) => this.dualSliderFn(args) } />
               `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider connect={true} step={5} range={{ min: 1, max: 100 }} val={{ min: 1, max: 100 }} onChange={args => this.dualSliderFn(args)} />
        </DemoSection>
        <DemoSection title="Dual Range Slider with max and min range calculated using step">
          <PrettyPrint className="html">
            {`
                <RangeSlider connect={ true }
                            step={ 250 }
                            normalizeRange
                            range={ { min: 2012, max: 4582 } }
                            onChange={ (args) => this.dualSliderFn(args) } />
               `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider connect={true} step={250} label="Demo dual" normalizeRange range={{ min: 2012, max: 4582 }} onChange={args => this.dualSliderFn(args)} />
        </DemoSection>

        <DemoSection title="Dual Range Slider with Label">
          <PrettyPrint className="html">
            {`
                  <RangeSlider
                      label="Dual Slider Label"
                      connect={ true }
                      step={ 5 }
                      range={ { min: 1, max: 100 } }
                      val={ { min: 1, max: 100 } }
                      onChange={ (args) => this.dualSliderFn(args) } />
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider
            label="Dual Slider Label"
            connect={true}
            className={'noLabelSlider'}
            range={{ min: 1, max: 100 }}
            val={{ min: 1, max: 100 }}
            onChange={args => this.dualSliderFn(args)}
          />
        </DemoSection>

        <DemoSection title="Dual Range Slider With Input">
          <PrettyPrint className="html">
            {`
                    <RangeSlider
                        connect={ true }
                        step={ 5 }
                        input={ true }
                        range={ { min: 1, max: 100 } }
                        val={ { min: 1, max: 100 } }
                        onChange={ (args) => this.dualSliderFn(args) } />
                    `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <RangeSlider
            connect={true}
            input={true}
            step={5}
            range={{ min: 1, max: 100 }}
            val={{ min: 1, max: 100 }}
            onChange={args => this.dualSliderFn(args)}
          />
        </DemoSection>
      </DemoPage>
    );
  }
}

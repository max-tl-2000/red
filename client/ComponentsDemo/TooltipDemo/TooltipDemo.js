/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { Button, Tooltip } from 'components';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class TooltipDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Tooltip">
        <DemoSection title="Simple Tooltip">
          <p className="p">Simple tooltip</p>
          <PrettyPrint className="javascript">
            {`
                <Tooltip text="Show a simple tooltip">
                  <Button label="Show a tooltip" />
                </Tooltip>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Tooltip text="Show a simple tooltip">
              <Button label="Show a tooltip" />
            </Tooltip>
          </div>
        </DemoSection>

        <DemoSection title="Tooltip locations">
          <p className="p">
            Toolips can be located using the <code>position</code> property which do the same as the <code>expandTo</code> property.
          </p>
          <PrettyPrint className="javascript">
            {`
                   <Tooltip text="Show a tooltip at right" position="right">
                     <Button label="Show on right" />
                   </Tooltip>
                   <Tooltip text="Show a tooltip on top" position="top">
                     <Button style={{ marginLeft: 10 }} label="Show on top" />
                   </Tooltip>
                   <Tooltip text="Show a tooltip at bottom" position="bottom">
                     <Button style={{ marginLeft: 10 }} label="Show at bottom" />
                   </Tooltip>
                   <Tooltip text="Show a tooltip at left" position="left">
                     <Button style={{ marginLeft: 10 }} label="Show at left" />
                   </Tooltip>
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Tooltip text="Show a tooltip at right" position="right">
              <Button label="Show on right" />
            </Tooltip>
            <Tooltip text="Show a tooltip on top" position="top">
              <Button style={{ marginLeft: 10 }} label="Show on top" />
            </Tooltip>
            <Tooltip text="Show a tooltip at bottom" position="bottom">
              <Button style={{ marginLeft: 10 }} label="Show at bottom" />
            </Tooltip>
            <Tooltip text="Show a tooltip at left" position="left">
              <Button style={{ marginLeft: 10 }} label="Show at left" />
            </Tooltip>
          </div>
        </DemoSection>

        <DemoSection title="Tooltip custom html">
          <p className="p">
            The <code>text</code> property can receive also a React component to be render inside the tooltip
          </p>
          <PrettyPrint className="javascript">
            {`
                 <Tooltip text={<h3>Extra text here</h3>} position="right">
                   <Button label="Show a tooltip" />
                 </Tooltip>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Tooltip text={<h3>Extra text here</h3>} position="right">
              <Button label="Show a tooltip" />
            </Tooltip>
          </div>
        </DemoSection>

        <DemoSection title="Tooltip custom delay">
          <p className="p">
            The <code>hoverDelay</code> property can be used to control how fast the tooltip will be shown. Values are in milliseconds.
          </p>
          <PrettyPrint className="javascript">
            {`
                 <Tooltip text="This tooltip is shown immediately on hover" hoverDelay={0}>
                   <Button label="Show a tooltip fast" />
                 </Tooltip>
                 <Tooltip text="This tooltip is shown after 1s" hoverDelay={1000}>
                   <Button style={{ marginLeft: 10 }} label="Wait for 1s" />
                 </Tooltip>
                 <Tooltip text="This tooltip is shown after .5s" hoverDelay={500}>
                   <Button style={{ marginLeft: 10 }} label="Wait for .5s" />
                 </Tooltip>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div>
            <Tooltip text="This tooltip is shown immediately on hover" hoverDelay={0}>
              <Button label="Show a tooltip fast" />
            </Tooltip>
            <Tooltip text="This tooltip is shown after 1s" hoverDelay={1000}>
              <Button style={{ marginLeft: 10 }} label="Wait for 1s" />
            </Tooltip>
            <Tooltip text="This tooltip is shown after .5s" hoverDelay={500}>
              <Button style={{ marginLeft: 10 }} label="Wait for .5s" />
            </Tooltip>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

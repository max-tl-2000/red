/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';
import { Button, InlineConfirm } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';
import { cf } from './InlineConfirmDemo.scss';

const api = [
  ['content', 'String|Element', '', 'The content of the Confirm Dialog'],
  ['overlayClassName', 'String', '', 'The classname to add to the overlay'],
  [
    'positionArgs',
    'Object',
    '',
    `
  An object with the following interface:

  \`\`\`
  interface IPositionArgs {
    my: String, // 'left top' | 'right top' | 'right bottom' | etc.
    at: String, // 'left top' | 'right top' | 'right bottom' | etc.
  };
  \`\`\`
  `,
  ],
  [
    'expandTo',
    'String',
    "'bottom'",
    `
  Where will the dialog expand towards.

  Possible values are:
  - 'bottom'
  - 'bottom-right'
  - 'bottom-left'
  - 'top'
  - 'top-right'
  - 'top-left'
  - 'right'
  - 'right-bottom'
  - 'right-top'
  - 'left'
  - 'left-bottom'
  - 'left-top'
  `,
  ],
  ['onCancelClick', 'Function', '', 'An event that will fire whenever the Cancel button is clicked'],
  ['onOKClick', 'Function', '', 'An event that will fire whenever the OK button is clicked'],
  ['btnOKDisabled', 'Boolean', '', 'Whether the OK button should be disabled or not'],
  ['btnCancelDisabled', 'Boolean', '', 'Whether the OK button should be disabled or not'],
  ['lblCancel', 'String', 'CANCEL', "The text of the Cancel button. If empty string is provided the button won't be rendered"],
  ['lblOK', 'String', 'OK', "The text of the OK button. If empty string is provided the button won't be rendered"],
];

export default class InlineConfirmDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    return (
      <DemoPage id={theId} title="InlineConfirm">
        <PropertiesTable data={api} />
        <DemoSection title="What's an InlineConfirm component?">
          <MDBlock>
            {`
                The \`InlineConfirm\` component is a wrapper over \`FlyOut\` to show an inline confirmation. This can be used
                to provide the users a second chance to decide if they actually want to continue with the action they initiated.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                   <div className={ cf('buttonBar') }>
                     <InlineConfirm positionArgs={ { my: 'left top', at: 'left top' } } expandTo="bottom-right" content="Are you sure you want to start this engine?" onOKClick={ () => console.log('>>> let's start the engine!') }>
                       <Button label="Start Engine" />
                     </InlineConfirm>
                     <InlineConfirm content="Are you sure you want to start this engine?" onOKClick={ () => console.log('>>> let's start the engine!') }>
                       <Button label="Start Engine" />
                     </InlineConfirm>
                     <InlineConfirm positionArgs={ { my: 'right top', at: 'right top' } } expandTo="bottom-left" content="Are you sure you want to start this engine?" onOKClick={ () => console.log('>>> let's start the engine!') }>
                       <Button label="Start Engine" />
                     </InlineConfirm>
                   </div>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div className={cf('buttonBar')}>
            <InlineConfirm
              positionArgs={{ my: 'left top', at: 'left top' }}
              expandTo="bottom-right"
              content="Are you sure you want to start this engine?"
              onOKClick={() => console.log(">>> let's start the engine!")}>
              <Button label="Start Engine" />
            </InlineConfirm>
            <InlineConfirm content="Are you sure you want to start this engine?" onOKClick={() => console.log(">>> let's start the engine!")}>
              <Button label="Start Engine" />
            </InlineConfirm>
            <InlineConfirm
              positionArgs={{ my: 'right top', at: 'right top' }}
              expandTo="bottom-left"
              content="Are you sure you want to start this engine?"
              onOKClick={() => console.log(">>> let's start the engine!")}>
              <Button label="Start Engine" />
            </InlineConfirm>
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

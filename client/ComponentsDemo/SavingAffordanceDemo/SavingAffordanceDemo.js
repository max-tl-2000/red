/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import SavingAffordance, { savingState } from 'components/SavingAffordance/SavingAffordance';
import Button from 'components/Button/Button';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const api = [
  ['id', 'String', '', 'The id of the component'],
  ['className', 'String', '', 'The className of the component'],
  ['lblSaveStart', 'String', 'Saving...', 'The text to be shown when there is a saving operation to report.'],
  ['lblSaveDone', 'String', 'All changes saved', 'The text to be shown when the saving operation is done.'],
  ['lighter', 'Boolean', 'false', 'Whether to use a lighter foreground color. Useful to be used on darker themes.'],
  [
    'matcher',
    'Function|RegExp',
    '',
    `
  A function used to filter which requests should generate a saving message to appear or a regular expression to match.
  If a function is provided it will receive a request object. The \`resource\` field could be used to determine
  if the request should generate a \`Saving...\` message or if it should be ignored.
  `,
  ],
];

let counter = 0;

export default class SavingAffordanceDemo extends Component {
  handleClick(resource) {
    counter++;
    // the id identifies uniquely a remote call
    const id = `${Date.now()}_${counter}`;
    // the remote call is done to a given resource
    // in the ApiClient file a resource is created
    // from the method + the path to the resource
    savingState.notifyStart({ id, resource });
    setTimeout(() => savingState.notifyEnd({ id, resource }), 2000);
  }

  render() {
    return (
      <DemoPage title="SavingAffordance">
        <PropertiesTable data={api} />
        <DemoSection title="How should the SavingAffordance be used?">
          <MDBlock>
            {`
                  This component has 2 parts. One is a model that it is notified of all
                  \`post\`/\`patch\`/\`delete\`/\`put\` methods. In the red application this is
                  done automatically in \`client/apiClient.js\`.

                  The other part is the component itself, which can be just dropped into any React tree
                  if a \`matcher\` is not specified all remote calls (except \`get\` ones) will cause
                  a \`saving...\` message to appear. After no more saving calls are pending the saving message
                  will disappear. If a \`matcher\` is specified, only if a call to that given resource is perform
                  the \`saving...\` message will appear. Other remote calls will be ignored
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <Button label="Test Saving Affordance" onClick={ () => this.handleClick('patch_/test/path') } />
                  <SavingAffordance matcher={ /test\\/path/ } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button label="Test Saving Affordance" onClick={() => this.handleClick('patch_/test/path')} />
          <SavingAffordance matcher={/test\/path/} />
        </DemoSection>

        <DemoSection title="How to render the saving affordance in a small screen?">
          <MDBlock>
            {`
                  Use the \`compressed\` prop. Setting it to \`true\` will make the \`SavingAffordance\` to use
                  icons instead of text.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <Button label="Test compressed mode" onClick={ () => this.handleClick('patch_/test/another') } />
                  <SavingAffordance compressed matcher={ /test\\/another/ } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Button label="Test compressed mode" onClick={() => this.handleClick('patch_/test/another1')} />
          <SavingAffordance compressed matcher={/test\/another1/} />
        </DemoSection>

        <DemoSection title="How to render the saving affordance over a darker theme?">
          <MDBlock>
            {`
                  Use the \`lighter\` prop. Setting it to \`true\` will make the \`SavingAffordance\` to use
                  white foreground colors.
                `}
          </MDBlock>
          <PrettyPrint>
            {`
                  <Button label="Test Saving Affordance" onClick={ () => this.handleClick('patch_/test/path') } />
                  <SavingAffordance matcher={ /test\\/path/ } />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <div style={{ background: '#333', padding: 10 }}>
            <Button label="Test over darker theme" onClick={() => this.handleClick('patch_/test/another2')} />
            <SavingAffordance lighter={true} compressed matcher={/test\/another2/} />
          </div>
          <div style={{ background: '#333', padding: 10 }}>
            <Button label="Test over darker theme" onClick={() => this.handleClick('patch_/test/another3')} />
            <SavingAffordance lighter={true} matcher={/test\/another3/} />
          </div>
        </DemoSection>
      </DemoPage>
    );
  }
}

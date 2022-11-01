/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { DemoSection, DemoPage, MDBlock, SubHeader, PropertiesTable } from '../DemoElements';
import PrettyPrint from '../DemoElements/PrettyPrint';
import * as Typography from '../../../resources/custom-components/Email/Typography/Typography';

const { Text, Headline, Link } = Typography;

const createDemoElement = ({ name, description, fontSize }) => {
  const Ele = Typography[name];
  return (
    <DemoSection key={name} title={name}>
      <Headline style={{ marginBottom: 20 }}>
        font size:{' '}
        <Headline inline highlight>
          {fontSize}
        </Headline>
      </Headline>
      {description && <Text bold>{description}</Text>}
      <PrettyPrint>
        {`
             <div style={ { padding: 20 } }>
               <div>
                 <${name}>This is an example of the "${name}" element</${name}>
               </div>
               <div>
                 <${name}>These two "${name}" elements are rendered inline <${name} inline highlight>and this one is highlighted</${name}></${name}>
               </div>
               <div>
                 <${name} inline bold>this sentence is using bold</${name}>
               </div>
               <div style={ { width: 320 } }>
                 <${name} ellipsis>this is a long sentence that will be truncated and ellipsis will be used</${name}>
               </div>
               <div>
                 <${name} error>this sentence is using the error prop</${name}>
               </div>
               <div>
                 <${name} inline disabled>This sentence is in disabled style</${name}>
               </div>

             </div>
             <div style={ { padding: 20, background: 'black' } }>
               <div>
                 <${name} lighter>This is an example of the "${name}" element</${name}>
               </div>
               <div>
                 <${name} lighter inline>These two "${name}" elements are rendered inline</${name}> <${name} lighter inline highlight>and this one is highlighted</${name}>
               </div>
               <div>
                 <${name} lighter inline bold>this sentence is using bold</${name}>
               </div>
               <div style={ { width: 320 } }>
                 <${name} lighter ellipsis>this is a long sentence that will be truncated and ellipsis will be used</${name}>
               </div>
               <div>
                 <${name} lighter error>this sentence is using the error prop</${name}>
               </div>
               <div>
                 <${name} lighter inline>This sentence is in primary style</${name}> <${name} lighter inline secondary highlight>This sentence is in secondary style</${name}>
               </div>
               <div>
                 <${name} disabled lighter>This sentence is in disabled style</${name}>
               </div>
             </div>
            `}
      </PrettyPrint>
      <SubHeader>Example of usage</SubHeader>
      <div style={{ padding: 20 }}>
        <div>
          <Ele>
            <Link href="about:blank">Demo of the "{name}" typography element used in a link</Link>
          </Ele>
        </div>
        <div>
          <Ele>This is an example of the "{name}" element</Ele>
        </div>
        <div>
          <Ele>
            This two "{name}" elements are rendered inline{' '}
            <Ele inline highlight>
              and this one is highlighted
            </Ele>
          </Ele>
        </div>
        <div>
          <Ele inline bold>
            this sentence is using bold
          </Ele>
        </div>
        <div style={{ width: 320 }}>
          <Ele ellipsis>this is a long sentence that will be truncated and ellipsis will be used</Ele>
        </div>
        <div>
          <Ele error>this sentence is using the error prop</Ele>
        </div>
        <div>
          <Ele inline disabled>
            This sentence is in disabled style
          </Ele>
        </div>
      </div>
      <div style={{ padding: 20, background: 'black' }}>
        <div>
          <Ele>
            <Link href="about:blank">Demo of the "{name}" typography element used in a link</Link>
          </Ele>
        </div>
        <div>
          <Ele lighter>This is an example of the "{name}" element</Ele>
        </div>
        <div>
          <Ele lighter inline>
            This two "{name}" elements are rendered inline
          </Ele>{' '}
          <Ele lighter inline highlight>
            and this one is highlighted
          </Ele>
        </div>
        <div>
          <Ele lighter inline bold>
            this sentence is using bold
          </Ele>
        </div>
        <div style={{ width: 320 }}>
          <Ele lighter ellipsis>
            this is a long sentence that will be truncated and ellipsis will be used
          </Ele>
        </div>
        <div>
          <Ele lighter error>
            this sentence is using the error prop
          </Ele>
        </div>
        <div>
          <Ele lighter inline>
            This sentence is in primary style
          </Ele>{' '}
          <Ele lighter inline secondary highlight>
            This sentence is in secondary style
          </Ele>
        </div>
        <div>
          <Ele disabled lighter>
            This sentence is in disabled style
          </Ele>
        </div>
      </div>
    </DemoSection>
  );
};

const elements = [
  {
    name: 'Text',
    fontSize: '13px',
    description: 'Most of the text in the app should use this Element',
  },
  {
    name: 'TextHeavy',
    fontSize: '13px',
    description: 'TextHeavy is just an alias for `<Text bold>{ children }</Text>`',
  },
  { name: 'SubHeader', fontSize: '15px' },
  { name: 'Caption', fontSize: '12px' },
  { name: 'Title', fontSize: '20px' },
  { name: 'Headline', fontSize: '24px' },
];

const api = [
  ['secondary', 'bool', 'false', 'if set to true the text will render as secondary style'],
  ['bold', 'bool', 'false', 'if set to true the text will render as font-weight: 500, (bold)'],
  ['highlight', 'bool', 'false', 'if set to true the text will render as highlight text'],
  [
    'ellipsis',
    'bool',
    'false',
    'if set to true the text will generate an ellipsis if text does not fit. **Important**: The parent component need to have style.width set',
  ],
  ['error', 'bool', 'false', 'if set to true the text will render as error text'],
  ['lighter', 'bool', 'false', 'if set to true the text will render the text with lighter foreground'],
  ['disabled', 'bool', 'false', 'if set to true the text will render the text as disabled'],
  ['className', 'string', '', 'set a custom class on the element'],
];

export default class TypographyDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Email Typography">
        <DemoSection title="What are the Email Typography elements?">
          <MDBlock>{`
                 Typography elements are the ones that should be used whenever we need to render some text in emails.
                 They are built using inline styles so they can be used inside emails.

                 The benefits from using them are:
                 - Text will be consistent all across all the emails
                 - Common behavior like truncation/ellipsis is implemented as part of the component
                 - Css styles can be managed by the components and changing styles is implemented using flags
               `}</MDBlock>
        </DemoSection>
        <PropertiesTable data={api} />
        <DemoSection title="Typography elements">
          <MDBlock>{`
                There are two common text elements as React Components \`Text\`, \`TextHeavy\`
                \`SubHeader\`, \`Caption\`, \`Title\` and \`Headline\`.

                - all components have a \`inline\` property that will render them as \`spans.\`
                - all components support \`ellipsis\` property to limit the text that is diplayed
                  to the width of the container and display '...' at the end. **Make sure you set
                  the width on the parent container for this to work**
                - \`Text\` component also support \`secondary\`, \`highlight\`, \`error\` and \`disabled\`.
                - all components also have a \`className\` property to customize them further if required
               `}</MDBlock>
        </DemoSection>
        {elements.map(element => createDemoElement(element))}
      </DemoPage>
    );
  }
}

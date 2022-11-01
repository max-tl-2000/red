/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { TextBox } from 'components';
import debounce from 'debouncy';
import { DemoSection, DemoPage, MDBlock, PrettyPrint, SubHeader } from '../DemoElements';
import { cf } from './TextBoxDemo.scss';
import Field from '../../components/Form/Field';
import { dateMask, money } from '../../components/TextBox/masks';

export default class TextBoxDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);

    this.state = {
      controlledValue: '',
    };

    this.handleChange = debounce(this.handleChange, 300, this);
  }

  handleChange(args) {
    this.setState({
      controlledValue: args.value,
    });
  }

  render() {
    const state = this.state || {};
    const controlledValue = state.controlledValue;

    return (
      <DemoPage title="TextBox">
        <DemoSection title="How to render required/optional TextBox">
          <MDBlock>{`
                A \`<TextBox />\` can be marked as \`required\` or \`optional\`, the text or \`React\` component to be used as
                the mark can be configured specifying the \`requiredmark\` or \`optionalMark\` accordingly. By default \`requiredMark\` is \`*\`
                and \`optionalMark\` is \`(optional)\`

                Only one of the properties can be used a time, if both are specified as true an error will be thrown.
                `}</MDBlock>
          <PrettyPrint>
            {`
                   <Field inline columns={ 4 }>
                     <TextBox label="Email" showClear required wide />
                   </Field>
                   <Field inline columns={ 4 } last>
                     <TextBox label="Email" showClear optional wide />
                   </Field>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Field inline columns={4}>
            <TextBox label="Email" showClear required wide />
          </Field>
          <Field inline columns={4} last>
            <TextBox label="Email" showClear optional wide />
          </Field>
        </DemoSection>

        <DemoSection title="How to show an icon on the left?">
          <MDBlock>{`
                TextBox allow us to show an icon on the left of the TextBox. Just set the property
                \`iconAffordance\` to the name of the icon to show.
                `}</MDBlock>
          <PrettyPrint>
            {`
                  <Field inline columns={ 6 }>
                    <TextBox wide label="Date of birth (normal affordance)" iconAffordance="calendar" showClear />
                  </Field>
                  <Field inline columns={ 6 } last>
                    <TextBox wide wideIcon label="Date of birth (wider affordance)" iconAffordance="calendar" showClear />
                  </Field>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Field inline columns={4}>
            <TextBox wide label="Date of birth (normal)" iconAffordance="calendar" showClear />
          </Field>
          <Field inline columns={4}>
            <TextBox wide wideIcon label="Date of birth (wider)" iconAffordance="calendar" showClear />
          </Field>
          <Field inline columns={4} last>
            <TextBox label="Email" showClear optional wide />
          </Field>
        </DemoSection>

        <DemoSection title="How to use a custom mask inside a TextBox">
          <MDBlock>{`
                TextBox allow us to use a mask. We use under the hook: http://igorescobar.github.io/jQuery-Mask-Plugin/

                The mask can be a string or an object. In case is an object it should conform to the following interface

                \`\`\`
                interface IMask {
                  mask: string,
                  maskOptions?: IMaskOptions,
                }

                interface IMaskOptions {
                  byPassKeys: Array<Number>,
                  translation: ITranslation,
                  clearIfNotMatch: Boolean,
                  reverse: Boolean,
                  selectOnFocus: Boolean,
                }

                interface ITranslation {
                  [propName:String]: ITranslationValue,
                }

                interface ITranslationValue {
                  pattern: RegExp,
                  optional?: Boolean,
                  reverse?: Boolean,
                }
                \`\`\`


                `}</MDBlock>
          <PrettyPrint>
            {`
                  <TextBox wide label="Date of birth" mask={ dateMask } placeholder="mm/dd/yyyy" showClear />
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Field columns={6}>
            <TextBox onChange={args => console.log('>>>>', args)} wide label="Date of birth" mask={dateMask} placeholder="mm/dd/yyyy" showClear />
          </Field>
          <Field columns={6}>
            <TextBox onChange={args => console.log('>>>>', args)} wide label="Gross income" mask={money} placeholder="$0.00" textAffordance={'$'} showClear />
          </Field>
        </DemoSection>

        <DemoSection title="The simplest textbox">
          <p className="p">The simplest textbox</p>
          <PrettyPrint className="html">
            {`
                <TextBox />
                `}
          </PrettyPrint>
          <TextBox />
        </DemoSection>

        <DemoSection title="A textbox that can clear its own value">
          <MDBlock>{`
                 Some times we need a textbox that show a "clear" affordance to quickly
                 clear the textbox value. This can be easily achieved by setting
                 the \`showClear\` boolean prop in the TextBox as shown below.

                 **Important:** This option will be ignored in case of a password field since in that case
                 we show an affordance to reveal the typed password.
               `}</MDBlock>
          <PrettyPrint className="html">
            {`
                <TextBox showClear />
                `}
          </PrettyPrint>
          <TextBox showClear />
        </DemoSection>

        <DemoSection title="Default">
          <p className="p">A textbox with label</p>
          <PrettyPrint className="html">
            {`
                <TextBox
                  label="Default"
                />
                `}
          </PrettyPrint>
          <TextBox label="Default" />
        </DemoSection>
        <DemoSection title="Password">
          <p className="p">A texbox type password</p>
          <PrettyPrint className="html">
            {`
                  <TextBox
                    label="Password"
                    value="some value"
                    type="password"
                  />
                  `}
          </PrettyPrint>
          <TextBox label="Password" value="some value" type="password" />
        </DemoSection>
        <DemoSection title="Disabled">
          <TextBox label="This is disabled" value="some value" type="text" disabled />
        </DemoSection>
        <DemoSection title="Controlled mode Label as placeholder">
          <TextBox label="Enter some text" value={controlledValue} type="text" onChange={this.handleChange} />
        </DemoSection>

        <DemoSection title="Label + Placeholder">
          <TextBox label="This is a label" placeholder="This is a placeholder" type="text" />
        </DemoSection>

        <DemoSection title="TextField in invalid state">
          <TextBox label="Forever fail" errorMessage="You should not do this" type="text" />
        </DemoSection>

        <DemoSection title="TextBox multiline">
          <p>The following shows how to use the textBox component to render a TextArea without label</p>
          <PrettyPrint className="html">
            {`
                  <TextBox placeholder="TextArea like demo"
                    defaultValue=""
                    style={ { width: '100%' } }
                    multiline
                    showClear
                  />
                  `}
          </PrettyPrint>
          <TextBox placeholder="TextArea like demo" defaultValue="" style={{ width: '100%' }} multiline showClear />
        </DemoSection>
        <DemoSection title="TextBox multiline with label">
          <p>The following shows how to use the textBox component to render a TextArea without label</p>
          <PrettyPrint className="html">
            {`
                  <TextBox placeholder="TextArea like demo"
                    label="my awesome textarea"
                    defaultValue=""
                    style={ { width: '100%' } }
                    multiline
                  />
                  `}
          </PrettyPrint>
          <TextBox placeholder="TextArea like demo" label="my awesome textarea" defaultValue="" style={{ width: '100%' }} multiline />
        </DemoSection>

        <DemoSection title="Multiline fixed height">
          <p>The following shows how to render a TextArea that will have a fixed number of rows</p>
          <PrettyPrint className="html">
            {`
                  <TextBox placeholder="Full Width TextBox (TextArea with several rows no autosize)"
                    defaultValue = ""
                    multiline
                    style={ { width: '100%' } }
                    numRows={ 4 }
                    autoResize={ false }
                  />
                  `}
          </PrettyPrint>
          <TextBox
            placeholder="Full Width TextBox (TextArea with several rows no autosize)"
            defaultValue=""
            multiline
            style={{ width: '100%' }}
            numRows={4}
            autoResize={false}
          />
        </DemoSection>

        <DemoSection title="Full Width TextBox">
          <p>
            The following shows how to make the textarea to expand to the container dimensions (autofill). Parent container needs to have{' '}
            <code>display:flex;</code>
          </p>
          <PrettyPrint className="html">
            {`
                  <section className={cf('layout-demo')}>
                    <TextBox placeholder="email" />
                    <TextBox placeholder="Full Width TextBox - TextArea expand to container dimensions"
                       defaultValue = ""
                       multiline
                       autoResize={false}
                       autoFill
                    />
                  </section>
                  `}
          </PrettyPrint>
          <section className={cf('layout-demo')}>
            <TextBox placeholder="email" />
            <TextBox placeholder="Full Width TextBox - TextArea expand to container dimensions" defaultValue="" multiline autoResize={false} autoFill />
          </section>
        </DemoSection>

        <DemoSection title="No underline">
          <MDBlock>{`
                    Sometimes we need a textfield without the underline and the focused animation.

                    To remove this line just set the property \`underline\` to \`false\`.
                    `}</MDBlock>
          <PrettyPrint>
            {`
                      <TextBox underline={ false } placeholder="Texfield with no underline" />
                    `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <TextBox underline={false} placeholder="Texfield with no underline" />
        </DemoSection>
      </DemoPage>
    );
  }
}

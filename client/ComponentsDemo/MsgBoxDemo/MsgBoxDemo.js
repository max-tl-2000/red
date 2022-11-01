/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';

import { Button, MsgBox, Typography, Switch } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const { Text } = Typography;

const api = [
  ['id', 'string', '', 'The id for the dialog'],
  ['open', 'boolean', 'false', 'whether the dialog should be open or not'],
  [
    'title',
    'string|object',
    '',
    `
  The title of the MsgBox, if provided the MsgBox will render a Header with a title.

  It is possible to pass other React components to the title apart from \`string\`. Like a \`Typography/Title\`
  `,
  ],
  [
    'content',
    'string|object',
    '',
    `
  The content to be shown inside the MsgBox.

  If more complex structure than a simple line of text is needed, you can pass
  A React component containing the Typography elements.

  It is also possible to use the \`children\` of the MsgBox to pass
  some content. Example:

  \`\`\`
  // simple string
  <MsgBox content="Hello world" />
  // complex content
  <MsgBox content={ <div><Title>Something here<Title></div> } />
  // same as before but using children
  <MsgBox>
    <div><Title>Something here<Title></div>
  </MsgBox>
  \`\`\`
  `,
  ],
  [
    'lblOK',
    'string',
    'OK',
    `
  The text for the OK button. Setting this to an empty string will hide the button.
  `,
  ],
  ['btnOKDisabled', 'boolean', 'false', 'Whether the OK button is disabled'],
  [
    'lblCancel',
    'boolean',
    'false',
    `
  The text for the Cancel button. Setting this to an empty string will hide the button.
  `,
  ],
  ['btnCancelDisabled', 'boolean', 'false', 'Whether the Cancel button is disabled'],
  ['btnExtraButtonDisabled', 'boolean', 'false', 'Whether the Extra button is disabled'],
  ['lblExtraButton', 'string', '', 'The text for the Extra button. If set a button will be created and will be rendered at the left of the dialog actions.'],
  [
    'extraButton',
    'object',
    '',
    `This will be used to render an extra button on the left of the DialogActions section.

    the object need to implement the following interface \`IMsgBoxButton\`
    \`\`\`
    interface IMsgBoxButton {
      // the label for the button that will be created
      label: string,
      // the command that will be passed to
      // the onCommand handler when the button is tapped
      command: string,
      // optional to disable/enable the extra button
      disabled?: boolean,
    }
    \`\`\`
    The command will be passed to the \`onCommand\` handler.
  `,
  ],
  ['overlayClassName', 'string', '', 'A class to pass to the DialogOverlay'],
  [
    'onCommand',
    'function',
    '',
    `
  An event that will fire whenever a button is clicked. This can be used to react to taps on the buttons. It fires after
  \`onOKClick\`, \`onCancelClick\` and \`onExtraButtonClick\`.

  The function has the following signature:
  \`\`\`

  interface IMsgBoxCommandArgs {
    // whether or not to autoClose the MsgBox
    autoClose: boolean,
    // the command token that indentify the
    // button that was tapped
    command: string,
  }

  function onCommand(args: IMsgBoxCommandArgs):void
  \`\`\`
  If the MsgBox needs to remain open after clicking a button, set \`args.autoClose = false\` inside the onCommand handler.
  `,
  ],
  [
    'onCancelClick',
    'function',
    '',
    `
  An event that will fire whenever the cancel button is clicked. It fires before \`onCommand\`.

  The function has the following signature:
  \`\`\`

  interface IMsgBoxCommandArgs {
    // whether or not to autoClose the MsgBox
    autoClose: boolean,
    // the command token that indentify the
    // button that was tapped
    command: string,
  }

  function onCancelClick(args: IMsgBoxCommandArgs):void
  \`\`\`
  If the MsgBox needs to remain open after clicking the button, set \`args.autoClose = false\` inside the \`onCancelClick\` handler.
  `,
  ],
  [
    'onOKClick',
    'function',
    '',
    `
  An event that will fire whenever the OK button is clicked. It fires before \`onCommand\`.

  The function has the following signature:
  \`\`\`

  interface IMsgBoxCommandArgs {
    // whether or not to autoClose the MsgBox
    autoClose: boolean,
    // the command token that indentify the
    // button that was tapped
    command: string,
  }

  function onOKClick(args: IMsgBoxCommandArgs):void
  \`\`\`
  If the MsgBox needs to remain open after clicking the button, set \`args.autoClose = false\` inside the \`onOKClick\` handler.
  `,
  ],
  [
    'onExtraButtonClick',
    'function',
    '',
    `
  An event that will fire whenever the OK button is clicked. It fires before \`onCommand\`.

  The function has the following signature:
  \`\`\`

  interface IMsgBoxCommandArgs {
    // whether or not to autoClose the MsgBox
    autoClose: boolean,
    // the command token that indentify the
    // button that was tapped
    command: string,
  }

  function onExtraButtonClick(args: IMsgBoxCommandArgs):void
  \`\`\`
  If the MsgBox needs to remain open after clicking the button, set \`args.autoClose = false\` inside the \`onExtraButtonClick\` handler.
  `,
  ],
  [
    'onCloseRequest',
    'function',
    '',
    `
  An event that will fire whenever the dialog component needs to be closed.

  The function has the following signature:
  \`\`\`

  interface IArgs {
    // the source of the close request, this
    // can be used to identify if the close request comes
    // from an element with [data-action="close"], source='dataAction' or
    // if the request comes from a tap away event, source='tapAway'
    source: string,
    // the target of the event
    target: DOMNode,
  }

  function onCloseRequest(args: IArgs):void
  \`\`\`

  The source can be used to decide if the dialog needs to be closed or not by inspecting
  the source and target properties
  `,
  ],
];

export default class MsgBoxDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {};
  }

  closeDialog(dialogId) {
    this.setState({ [`dialogOpen${dialogId}`]: false });
  }

  openDialog(dialogId) {
    this.setState({ [`dialogOpen${dialogId}`]: true });
  }

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);

    return (
      <DemoPage id={theId} title="MsgBox">
        <DemoSection title="What's a MsgBox">
          <MDBlock>
            {`
                  A \`MsgBox\` is a wrapper around the Dialog atom to make it simpler to use for
                  one of the most common use cases of a Dialog: **To show a Text message to the user**.
                `}
          </MDBlock>
          <PropertiesTable data={api} />
        </DemoSection>
        <DemoSection title="How to use it">
          <MDBlock>{`
                  Check the example below. This renders the simplest MsgBox possible:
                `}</MDBlock>
          <PrettyPrint>
            {`

                    // The following code is just for demo purposes,
                    // in the real app it is better to have
                    // proper methods to handle the close/open of the dialog
                    // like closeMyDialog/openMyDialog
                    // this is just so we can create several dialogs now for demo purposes.
                    closeDialog(dialogId) {
                      this.setState({ [\`dialogOpen$\{dialogId}\`]: false });
                    }

                    openDialog(dialogId) {
                      this.setState({ [\`dialogOpen$\{dialogId}\`]: true });
                    }

                    /* ======================================= */
                    { /* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */ }
                    <MsgBox open={ this.state.dialogOpen1 }
                        onCloseRequest={ () => this.closeDialog(1) }
                        content="Hello world!" />
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(1) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {/* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */}
          <MsgBox open={this.state.dialogOpen1} onCloseRequest={() => this.closeDialog(1)} content="Hello world!" />
          <Button label="Open MsgBox" onClick={() => this.openDialog(1)} />
        </DemoSection>

        <DemoSection title="How to show a Title and custom button text?">
          <PrettyPrint>
            {`
                    { /* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */ }
                    <MsgBox open={ this.state.dialogOpen2 }
                        title="Dessert time!"
                        onCloseRequest={ () => this.closeDialog(2) }
                        lblOK="Sure!"
                        lblCancel="No, Thanks!"
                        content="Do you want some cake?" />
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(2) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {/* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */}
          <MsgBox
            open={this.state.dialogOpen2}
            title="Dessert time!"
            onCloseRequest={() => this.closeDialog(2)}
            lblOK="Sure!"
            lblCancel="No, Thanks!"
            content="Do you want some cake?"
          />
          <Button label="Open MsgBox" onClick={() => this.openDialog(2)} />
        </DemoSection>
        <DemoSection title="How to do something when a button is clicked?">
          <PrettyPrint>
            {`
                    { /* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */ }
                    <MsgBox open={ this.state.dialogOpen3 }
                            title="Dessert time!"
                            onCloseRequest={ () => this.closeDialog(3) }
                            lblOK="Sure!"
                            onCommand={ ({ command }) => console.log('command!', command) }
                            lblCancel="No, Thanks!"
                            content="Do you want some cake?" />
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(3) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {/* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */}
          <MsgBox
            open={this.state.dialogOpen3}
            title="Dessert time!"
            onCloseRequest={() => this.closeDialog(3)}
            lblOK="Sure!"
            onCommand={({ command }) => console.log('command!', command)}
            lblCancel="No, Thanks!"
            content="Do you want some cake?"
          />
          <Button label="Open MsgBox" onClick={() => this.openDialog(3)} />
        </DemoSection>

        <DemoSection title="How to disable the OK button?">
          <PrettyPrint>
            {`
                    { /* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */ }
                    <MsgBox open={ this.state.dialogOpen4 }
                            title="Dessert time!"
                            onCloseRequest={ () => this.closeDialog(4) }
                            lblOK="Sure!"
                            btnOKDisabled={ !this.state.agree }
                            onCommand={ ({ command }) => console.log('command!', command) }
                            lblCancel="No, Thanks!">
                      <Text>Do you want some cake?</Text>
                      <Text secondary>You need to agree to the terms of service before proceeding</Text>
                      <Switch label="I agree" check={ this.state.agree } onChange={ () => this.setState({ agree: !this.state.agree }) } />
                    </MsgBox>
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(4) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {/* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */}
          <MsgBox
            open={this.state.dialogOpen4}
            title="Dessert time!"
            onCloseRequest={() => this.closeDialog(4)}
            lblOK="Sure!"
            btnOKDisabled={!this.state.agree}
            onCommand={({ command }) => console.log('command!', command)}
            lblCancel="No, Thanks!">
            <Text>Do you want some cake?</Text>
            <Text secondary>You need to agree to the terms of service before proceeding</Text>
            <Switch label="I agree" checked={this.state.agree} onChange={() => this.setState({ agree: !this.state.agree })} />
          </MsgBox>
          <Button label="Open MsgBox" onClick={() => this.openDialog(4)} />
        </DemoSection>
        <DemoSection title="How to show 3 buttons?">
          <PrettyPrint>
            {`
                    { /* onCloseRequest is important to keep the
                         state in sync with the state inside
                         the dialog. */ }
                    <MsgBox open={ this.state.dialogOpen5 }
                            title="Dessert time!"
                            onCloseRequest={ () => this.closeDialog(5) }
                            lblOK="Sure!"
                            btnOKDisabled={ !this.state.agree2 }
                            extraButton={ { label: 'Other options', command: 'OTHER_OPTIONS' } }
                            onCommand={ ({ command }) => console.log('command!', command) }
                            lblCancel="No, Thanks!">
                      <Text>Do you want some cake?</Text>
                      <Text secondary>You need to agree to the terms of service before proceeding</Text>
                      <Switch label="I agree" checked={ this.state.agree2 } onChange={ () => this.setState({ agree2: !this.state.agree2 }) } />
                    </MsgBox>
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(5) } />
                  `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          {/* onCloseRequest is important to keep the
                     state in sync with the state inside
                     the dialog. */}
          <MsgBox
            open={this.state.dialogOpen5}
            title="Dessert time!"
            onCloseRequest={() => this.closeDialog(5)}
            lblOK="Sure!"
            btnOKDisabled={!this.state.agree2}
            extraButton={{ label: 'Other options', command: 'OTHER_OPTIONS' }}
            onCommand={({ command }) => console.log('command!', command)}
            lblCancel="No, Thanks!">
            <Text>Do you want some cake?</Text>
            <Text secondary>You need to agree to the terms of service before proceeding</Text>
            <Switch label="I agree" checked={this.state.agree2} onChange={() => this.setState({ agree2: !this.state.agree2 })} />
          </MsgBox>
          <Button label="Open MsgBox" onClick={() => this.openDialog(5)} />
        </DemoSection>

        <DemoSection title="onOKClick, onCancelClick, onExtraButtonClick">
          <MDBlock>{`
                  There might be scenarios where passing a single callback for each action might introduce more boilerplate code. To avoid this
                  there are also click handlers per each one of the buttons \`onOKClick\`, \`onCancelClick\`, \`onExtraButtonClick\`.
                  Also to make it easier to create extra buttons, the label and disabled properties for the extra button can be set as properties of
                  the MsgBox: \`lblExtraButton\` and \`btnExtraButtonDisabled\`.
                  `}</MDBlock>
          <PrettyPrint>
            {`
                    <MsgBox open={ this.state.dialogOpen6 }
                            title="Dessert time!"
                            onCloseRequest={ () => this.closeDialog(6) }
                            lblOK="Sure!"
                            btnOKDisabled={ !this.state.agree3 }
                            lblExtraButton="Other options"
                            btnExtraButtonDisabled={ !this.state.agree3 }
                            onOKClick={ () => console.log('OK clicked') }
                            onCancelClick={ () => console.log('Cancel clicked') }
                            onExtraButtonClick={ () => console.log('ExtraButton clicked') }
                            lblCancel="No, Thanks!">
                      <Text>Do you want some cake?</Text>
                      <Switch label="I understand sugar can be harmful" checked={ this.state.agree3 } onChange={ () => this.setState({ agree3: !this.state.agree3 }) } />
                    </MsgBox>
                    <Button label="Open MsgBox" onClick={ () => this.openDialog(6) } />
                   `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <MsgBox
            open={this.state.dialogOpen6}
            title="Dessert time!"
            onCloseRequest={() => this.closeDialog(6)}
            lblOK="Sure!"
            btnOKDisabled={!this.state.agree3}
            lblExtraButton="Other options"
            btnExtraButtonDisabled={!this.state.agree3}
            onOKClick={() => console.log('OK clicked')}
            onCancelClick={() => console.log('Cancel clicked')}
            onExtraButtonClick={() => console.log('ExtraButton clicked')}
            lblCancel="No, Thanks!">
            <Text>Do you want some cake?</Text>
            <Switch label="I understand sugar can be harmful" checked={this.state.agree3} onChange={() => this.setState({ agree3: !this.state.agree3 })} />
          </MsgBox>
          <Button label="Open MsgBox" onClick={() => this.openDialog(6)} />
        </DemoSection>
      </DemoPage>
    );
  }
}

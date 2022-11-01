/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';

import clsc from 'helpers/coalescy';

import { Stepper, Step, StepContent, StepSummary, Typography, IconButton, Switch } from 'components';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';

const { Text } = Typography;

const stepperAPI = [
  ['id', 'String', '', 'The id for the stepper'],
  ['lblClose', 'String', '"CLOSE"', 'The label for the `Close` button. It can be overriden from the `StepContent` props'],
  ['lblNext', 'String', '"NEXT"', 'The label for the `Next` button. It can be overriden from the `StepContent` props'],
  ['lblDone', 'String', '"DONE"', 'The label for the `Done` button. It can be overriden from the `StepContent` props'],
  ['onComplete', 'Function', '', 'Callback called when the last step is closed after clicking `Done`'],
  [
    'onStepChange',
    'Function',
    '',
    `
   Callback called when the step has changed.
   The signature of the callback is:

   \`\`\`
   interface IStepChangeArgs {
     expanded: Boolean, // if the current step is expanded, use this to sync the state of the parent
     selectedIndex: Number // Index of the current open step
   }

   function onStepChange(args:IStepChangeArgs):void
   \`\`\`

   `,
  ],
  ['onCollapse', 'Function', '', 'Callback called when a step is closed'],
  ['onExpanding', 'Function', '', 'Callback called when the is about to be expanded'],
  ['onExpanded', 'Function', '', 'Callback called when the step was expanded'],
  ['expanded', 'Boolean', '', 'Whether or not the current step must be render as expanded'],
  ['cardClassName', 'String', '', 'Property to add a custom css class to the Card that is shown inside the StepContent'],
  ['nonLinear', 'Boolean', 'false', "If true the stepper won't force the user to visit previous steps to open a given step"],
];

const stepContentAPI = [
  ['title', 'String', '', 'The title of the StepContent'],
  ['expandedClassName', 'String', '', 'The class to be added to the Dialog in case of expanded'],
  ['helperText', 'String', '', 'The helper text to be shown below the title'],
  ['lblClose', 'String', '', 'The label for the `Close` button. Overrides the one defined in the `Stepper`'],
  ['lblNext', 'String', '', 'The label for the `Next` button. Overrides the one defined in the `Stepper`'],
  ['lblDone', 'String', '', 'The label for the `Done` button. Overrides the one defined in the `Stepper`'],
  ['lblExtraButton', 'String', '', 'The label for the `Extra` button, the one shown left aligned. Overrides the one defined in the `Stepper`'],
  ['btnNextDisabled', 'Boolean', 'false', 'Whether the `Next` button should be render as disabled'],
  ['btnDoneDisabled', 'Boolean', 'false', 'Whether the `Done` button should be render as disabled'],
  ['btnCloseDisabled', 'Boolean', 'false', 'Whether the `Close` button should be render as disabled'],
  ['btnExtraButtonDisabled', 'Boolean', 'false', 'Whether the `Extra` button should be render as disabled'],
  ['onExtraButtonTouch', 'Function', '', 'Callback executed when the button is touched'],
  [
    'onBeforeStepChange',
    'Function',
    '',
    `
    Callback to be executed before the step changes. It can be used to prevent the step change.

    \`\`\`
    interface IBeforeStepChangeArgs {
      cancel: Boolean,    // if set to true, the step change will be prevented
      toIndex: Number,    // the index of the step where the Stepper is changing
      fromIndex: Number,  // the index of the step where the user is changing step from
    }

    function onBeforeStepChange(args:IBeforeStepChangeArgs):void
    \`\`\`
  `,
  ],
  [
    'onBeforeStepClose',
    'Function',
    '',
    `
    Callback to be executed before the step is closed. It can be used to prevent the close.

    \`\`\`
    interface IBeforeStepCloseArgs {
      cancel: Boolean,        // if set to true, the step change will be prevented
      selectedIndex: Number,  // the index of the step being closed
    }

    function onBeforeStepClose(args:IBeforeStepCloseArgs):void
    \`\`\`
  `,
  ],
  ['container', 'Boolean', 'false', 'If true then the StepContent element will provide a default padding'],
  ['extraButtonClass', 'String', '', 'a class to be added to the `extra` Button element'],
  ['actionsClassName', 'String', '', 'a className to be added to the [data-component="card-actions"] element of the step'],
];

export default class StepperDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = {
      selectedIndex: -1,
      expanded: false,
    };
  }

  handleComplete = () => this.setState({ expanded: false });

  handleCollapse = () => this.setState({ expanded: false });

  toggleExpand = () =>
    this.setState({
      expanded: !this.state.expanded,
    });

  handleChange = ({ selectedIndex }) => this.setState({ selectedIndex });

  handleBeforeChange = args => {
    // setting this to true will prevent the step change
    args.cancel = !this.state.agree;
  };

  handleBeforeClose = args => {
    // setting this to true will prevent the close of the step
    args.cancel = !this.state.agree;
  };

  render() {
    const { id } = this.props;
    const theId = clsc(id, this.id);
    const { selectedIndex, expanded } = this.state;

    return (
      <DemoPage id={theId} title="Stepper">
        <DemoSection title="What's a stepper">
          <MDBlock>
            {`
                   A **Stepper** is a component used to show a small wizard or a multi step form.
                 `}
          </MDBlock>
          <PropertiesTable data={stepperAPI} />
          <PropertiesTable data={stepContentAPI} title="StepContent Properties" />
        </DemoSection>
        <DemoSection title="How can I make a stepper">
          <PrettyPrint>
            {`
                   <Stepper selectedIndex={ selectedIndex }
                            onComplete={ this.handleComplete }
                            expanded={ expanded }
                            onCollapse={ this.handleCollapse }
                            onStepChange={ this.handleChange }>
                     <Step sectionId="step1"
                           title="Name of Step 1"
                           onBeforeStepChange={ this.handleBeforeChange }
                           onBeforeStepClose={ this.handleBeforeClose }
                           btnNextDisabled={ !this.state.agree }>
                       <StepSummary><Text>Summary of step 1</Text></StepSummary>
                       <StepContent>
                         <div style={ { padding: '1rem', height: 500 } }>
                           <Switch label="Agree the terms and conditions... to continue or close the step!" checked={ this.state.agree } onChange={ (value) => this.setState({ agree: value }) } />
                           <div><IconButton iconName={ expanded ? 'arrow-compress' : 'arrow-expand' } onClick={ this.toggleExpand } /></div>
                           <Text secondary>Content of Step 1</Text>
                         </div>
                       </StepContent>
                     </Step>
                     <Step title="Name of Step 2"
                           helperText="Helper text Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean lacinia maximus turpis ac rutrum."
                           lblExtraButton="Expand"
                           onExtraButtonTouch={ () => console.log('extra action taken!') }
                           lblNext="Skip this step">

                       <StepSummary><Text>Summary Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean lacinia maximus turpis ac rutrum.</Text></StepSummary>
                       <StepContent>
                         <div style={ { padding: '1rem', height: 500 } }>
                           <Text secondary>Content of Step 2</Text>
                         </div>
                       </StepContent>
                     </Step>
                     <Step title="Name of Step 3"
                           helperText="helperText of Step 3">
                       <StepSummary><Text>Summary small here</Text></StepSummary>
                       <StepContent>
                         <div style={ { padding: '1rem', height: 500 } }>
                           <div><IconButton iconName={ expanded ? 'arrow-compress' : 'arrow-expand' } onClick={ this.toggleExpand } /></div>
                           <Text secondary>Content Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean lacinia maximus turpis ac rutrum.</Text>
                         </div>
                       </StepContent>
                     </Step>
                   </Stepper>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Stepper
            selectedIndex={selectedIndex}
            onComplete={this.handleComplete}
            expanded={expanded}
            onCollapse={this.handleCollapse}
            onStepChange={this.handleChange}>
            <Step
              sectionId="step1"
              title="Name of Step 1"
              onBeforeStepChange={this.handleBeforeChange}
              onBeforeStepClose={this.handleBeforeClose}
              btnNextDisabled={!this.state.agree}>
              <StepSummary>
                <Text>Summary of step 1</Text>
              </StepSummary>
              <StepContent>
                <div style={{ padding: '1rem', height: 500 }}>
                  <Switch
                    label="Agree the terms and conditions... to continue or close the step!"
                    checked={this.state.agree}
                    onChange={value => this.setState({ agree: value })}
                  />
                  <div>
                    <IconButton iconName={expanded ? 'arrow-compress' : 'arrow-expand'} onClick={this.toggleExpand} />
                  </div>
                  <Text secondary>Content of Step 1</Text>
                </div>
              </StepContent>
            </Step>
            <Step
              title="Name of Step 2"
              helperText="Helper text Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean lacinia maximus turpis ac rutrum."
              lblExtraButton="Expand"
              onExtraButtonTouch={() => console.log('extra action taken!')}
              lblNext="Skip this step">
              <StepSummary>
                <Text>
                  Summary Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec
                  faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean
                  lacinia maximus turpis ac rutrum.
                </Text>
              </StepSummary>
              <StepContent>
                <div style={{ padding: '1rem', height: 500 }}>
                  <Text secondary>Content of Step 2</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Name of Step 3" helperText="helperText of Step 3">
              <StepSummary>
                <Text>Summary small here</Text>
              </StepSummary>
              <StepContent>
                <div style={{ padding: '1rem', height: 500 }}>
                  <div>
                    <IconButton iconName={expanded ? 'arrow-compress' : 'arrow-expand'} onClick={this.toggleExpand} />
                  </div>
                  <Text secondary>
                    Content Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum faucibus ac enim sit amet commodo. Praesent porta nunc nec
                    faucibus feugiat. Donec in nunc congue orci vestibulum mattis. Proin sit amet libero fermentum, dictum diam posuere, varius nibh. Aenean
                    lacinia maximus turpis ac rutrum.
                  </Text>
                </div>
              </StepContent>
            </Step>
          </Stepper>
        </DemoSection>

        <DemoSection title="Can the helper text be hidden when step is open?">
          <MDBlock>{`
                Yes, it can. Set the \`stepOpenHelperText\` prop to \`''\` in each step if you want the helper text to be hidden.
               `}</MDBlock>
          <PrettyPrint>
            {`
                 <Stepper>
                 <Step title="Step 1" helperText="Helper text of Step 1">
                   <StepSummary><Text>Summary of Step 1</Text></StepSummary>
                   <StepContent container>
                     <div><Text>This content will be revealed when the stepper is opened</Text></div>
                   </StepContent>
                 </Step>
                 <Step title="Step 2" helperText="Helper text of Step 2">
                   <StepSummary><Text>Summary of Step 2</Text></StepSummary>
                   <StepContent container>
                     <div><Text>This content will be revealed when the stepper is opened</Text></div>
                   </StepContent>
                 </Step>
                 <Step title="Step 3" helperText="Helper text of Step 3">
                   <StepSummary><Text>Summary of Step 3</Text></StepSummary>
                   <StepContent container>
                     <div><Text>This content will be revealed when the stepper is opened</Text></div>
                   </StepContent>
                 </Step>
                 <Step title="Step 4" helperText="Helper text of Step 4">
                   <StepSummary><Text>Summary of Step 4</Text></StepSummary>
                   <StepContent container>
                     <div><Text>This content will be revealed when the stepper is opened</Text></div>
                   </StepContent>
                 </Step>
                 <Step title="Step 5" helperText="Helper text of Step 5">
                   <StepSummary><Text>Summary of Step 5</Text></StepSummary>
                   <StepContent container>
                     <div><Text>This content will be revealed when the stepper is opened</Text></div>
                   </StepContent>
                 </Step>
               </Stepper>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Stepper>
            <Step title="Step 1" helperText="Helper text of Step 1">
              <StepSummary>
                <Text>Summary of Step 1</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 2" helperText="Helper text of Step 2">
              <StepSummary>
                <Text>Summary of Step 2</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 3" helperText="Helper text of Step 3">
              <StepSummary>
                <Text>Summary of Step 3</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 4" helperText="Helper text of Step 4">
              <StepSummary>
                <Text>Summary of Step 4</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 5" helperText="Helper text of Step 5">
              <StepSummary>
                <Text>Summary of Step 5</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
          </Stepper>
        </DemoSection>

        <DemoSection title="Can the user open any step in any order?">
          <MDBlock>{`
                Yes. Just set the \`nonLinear\` property  on the \`Stepper\` component.
               `}</MDBlock>
          <PrettyPrint>
            {`
                   <Stepper nonLinear>
                     <Step title="Step 1" helperText="Helper text of Step 1">
                       <StepSummary><Text>Summary of Step 1</Text></StepSummary>
                       <StepContent container>
                         <div><Text>This content will be revealed when the stepper is opened</Text></div>
                       </StepContent>
                     </Step>
                     <Step title="Step 2" helperText="Helper text of Step 2">
                       <StepSummary><Text>Summary of Step 2</Text></StepSummary>
                       <StepContent container>
                         <div><Text>This content will be revealed when the stepper is opened</Text></div>
                       </StepContent>
                     </Step>
                     <Step title="Step 3" helperText="Helper text of Step 3">
                       <StepSummary><Text>Summary of Step 3</Text></StepSummary>
                       <StepContent container>
                         <div><Text>This content will be revealed when the stepper is opened</Text></div>
                       </StepContent>
                     </Step>
                     <Step disabled={ true } title="Step 4" helperText="Helper text of Step 4">
                       <StepSummary><Text>Summary of Step 4</Text></StepSummary>
                       <StepContent container>
                         <div><Text>This content will be revealed when the stepper is opened</Text></div>
                       </StepContent>
                     </Step>
                     <Step title="Step 5" helperText="Helper text of Step 5">
                       <StepSummary><Text>Summary of Step 5</Text></StepSummary>
                       <StepContent container>
                         <div><Text>This content will be revealed when the stepper is opened</Text></div>
                       </StepContent>
                     </Step>
                   </Stepper>
                 `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <Stepper nonLinear>
            <Step title="Step 1" helperText="Helper text of Step 1">
              <StepSummary>
                <Text>Summary of Step 1</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 2" helperText="Helper text of Step 2">
              <StepSummary>
                <Text>Summary of Step 2</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 3" helperText="Helper text of Step 3">
              <StepSummary>
                <Text>Summary of Step 3</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step disabled={true} title="Step 4" helperText="Helper text of Step 4">
              <StepSummary>
                <Text>Summary of Step 4</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
            <Step title="Step 5" helperText="Helper text of Step 5">
              <StepSummary>
                <Text>Summary of Step 5</Text>
              </StepSummary>
              <StepContent container>
                <div>
                  <Text>This content will be revealed when the stepper is opened</Text>
                </div>
              </StepContent>
            </Step>
          </Stepper>
        </DemoSection>
      </DemoPage>
    );
  }
}

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import { MsgBox, Button, Typography as T, FormattedMarkdown as TextBlock } from 'components';
import { observer, Observer } from 'mobx-react';
import Block from '../helpers/Block';

// TODO: move dialogModel to a common location
import DialogModel from '../../client/containers/PartyPageUnified/DialogModel';
import { now } from '../../common/helpers/moment-utils';

@observer
class WrapperWithObserver extends Component {
  constructor(props) {
    super(props);
    this.model = new DialogModel();
  }

  render() {
    const { model } = this;

    return (
      <div style={{ padding: '25px 0 50px' }}>
        <T.SubHeader>
          {'Last time this was rendered: '}
          <T.SubHeader inline bold>
            {now().format()}
          </T.SubHeader>
        </T.SubHeader>
        <Button label="Open Dialog" onClick={model.open} />
        <Observer>
          {() => <MsgBox onCloseRequest={model.close} title="Some Message" content={`Current time: ${now().format()}`} open={model.isOpen} />}
        </Observer>
      </div>
    );
  }
}

@observer // eslint-disable-next-line
class WrapperWithOutObserver extends Component {
  constructor(props) {
    super(props);
    this.model = new DialogModel();
  }

  render() {
    const { model } = this;

    return (
      <div style={{ padding: '25px 0 50px' }}>
        <T.SubHeader>
          {'Last time this was rendered: '}
          <T.SubHeader inline bold>
            {now().format()}
          </T.SubHeader>
        </T.SubHeader>
        <Button label="Open Dialog" onClick={model.open} />
        <MsgBox onCloseRequest={model.close} title="Some Message" content={`Current time: ${now().format()}`} open={model.isOpen} />
      </div>
    );
  }
}

storiesOf('Observer', module).add('Observer usage', () => (
  <Block>
    <T.FormattedBlock>
      <T.Title>Observer HOC</T.Title>
      <div style={{ marginBottom: '30px' }}>
        <TextBlock>
          {`
            Rendering dialogs have a downside if the state that is opened belongs to the parent component.
            Since any changes on state will make the entire render method to be executed.

            Ideally we should never do complex calculations in render methods, we should use \`@computed\` in mobx and selectors
            in the case of redux to prevent costly loops in the code. But sometimes this can't be avoided.

            Using a \`<Observer />\` block will encapsulate a component and will only re render its content
            if any of the observable content changes inside the observer. It is a very nice way to make
            dialogs to render independently of the main render component helping to reduce the perceived performance
            of a component will multiple dialogs like the party page.

            The following examples render a dialog. The parent component will render the date and time of the last render.

            The example without the Observable HOC will be rendered several times. While the other one not.
          `}
        </TextBlock>
      </div>

      <T.Title>Example without Observable HOC</T.Title>
      <TextBlock>{'Please note that the render method will execute everytime the dialog is opened and closed'}</TextBlock>
      <WrapperWithOutObserver />
      <T.Title>Example with Observable HOC</T.Title>
      <TextBlock>{`
        In this case the render method of the parent component will only be executed once.
      `}</TextBlock>
      <WrapperWithObserver />
    </T.FormattedBlock>
  </Block>
));

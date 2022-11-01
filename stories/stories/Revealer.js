/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import * as T from 'components/Typography/Typography';
import Button from 'components/Button/Button';
import Revealer from 'components/Revealer/Revealer';
import Block from '../helpers/Block';

class Wrapper extends Component {
  state = { show: true };

  handleClick = () => {
    const { show } = this.state;
    this.setState({ show: !show });
  };

  render() {
    const { show } = this.state;

    return (
      <div>
        <Revealer style={{ width: 300, height: 200, background: 'red' }} show={show} onEnter={action('onEnter')} onExit={action('onExit')}>
          <T.SubHeader lighter>Some nice content here</T.SubHeader>
        </Revealer>
        <Button label={show ? 'hide' : 'show'} onClick={this.handleClick} />
      </div>
    );
  }
}

storiesOf('Revealer', module).add('Simple Revealer', () => (
  <Block>
    <T.Title>Revealer component</T.Title>
    <T.Text>Revealer is just a simpler helper to show/hide elements and animate their entrance exit using css animations</T.Text>
    <T.Text>The main benefit of using it is that the element won't be rendered when not showing.</T.Text>
    <T.Title>
      Why not simply use <code>{'{ show && <Component /> }'}</code>?
    </T.Title>
    <T.Text>
      Main reason is that using that approach we can only use an entrance animation and not an exit one. Revealer will reveal elements playing both enter and
      exit animations
    </T.Text>
    <Wrapper />
  </Block>
));

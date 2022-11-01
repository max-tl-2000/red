/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { storiesOf } from '@storybook/react';
import { NotificationBanner, Button, Typography as T } from 'components';
import Block from '../helpers/Block';

class Wrapper extends Component {
  state = {
    showWarning: false,
  };

  close = () => {
    this.setState({ showWarning: false });
  };

  open = () => {
    this.setState({ showWarning: true });
  };

  toggle = () => {
    const { showWarning } = this.state;
    showWarning ? this.close() : this.open();
  };

  render() {
    return (
      <div>
        <Block>
          <Button label="Toggle Notification" onClick={this.toggle} />
        </Block>
        <Block>
          <NotificationBanner
            closeable
            onClose={this.close}
            visible={this.state.showWarning}
            content={() => (
              <T.Text raw>
                This Notification can be close and open{' '}
                <T.Link onClick={() => console.log('learn more action')} underline noDefaultColor>
                  Learn more
                </T.Link>
              </T.Text>
            )}
          />
        </Block>
      </div>
    );
  }
}

storiesOf('NotificationBanner', module)
  .addWithInfo(
    'Warning notification',
    'Warning notification',
    () => (
      <Block>
        <NotificationBanner content="This is a warning notification" type="warning" />
      </Block>
    ),
    { propTables: [NotificationBanner] },
  )
  .addWithInfo(
    'Info notification',
    'Info notification',
    () => (
      <Block>
        <NotificationBanner content="This is an info notification" type="info" />
      </Block>
    ),
    { propTables: [NotificationBanner] },
  )
  .addWithInfo(
    'Success notification',
    'Success notification',
    () => (
      <Block>
        <NotificationBanner content="This is an success notification" type="success" />
      </Block>
    ),
    { propTables: [NotificationBanner] },
  )
  .addWithInfo(
    'Closeable warning notification',
    'Closeable warning notification',
    () => (
      <Block>
        <NotificationBanner content="This is a warning notification" closeable={true} type="warning" />
      </Block>
    ),
    { propTables: [NotificationBanner] },
  )
  .addWithInfo(
    'Closeable info notification',
    'Closeable info notification',
    () => (
      <Block>
        <NotificationBanner content="This is a info notification" closeable={true} type="info" />
      </Block>
    ),
    { propTables: [NotificationBanner] },
  )
  .addWithInfo('Controlled mode', 'Controlled mode', () => <Wrapper />, {
    propTables: [NotificationBanner],
  });

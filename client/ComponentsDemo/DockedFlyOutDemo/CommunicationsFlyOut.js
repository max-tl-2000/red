/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import clsc from 'helpers/coalescy';

import DockedFlyOut from 'components/DockedFlyOut/DockedFlyOut';
import { Typography } from 'components';

const { Text } = Typography;
import Communications from './Communications';

const iconsBySection = {
  emails: 'email',
  calls: 'phone',
  messages: 'message-text',
};

export default class CommunicationsFlyOut extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
    this.state = { section: props.section };
  }

  static propTypes = {
    id: PropTypes.string,
  };

  _getIcon(section) {
    return iconsBySection[section];
  }

  handleChange = ({ section }) => {
    if (section === this.state.section) return;
    this.setState({ section });
  };

  render() {
    const { section } = this.state;
    const { id: propsId, flyoutId } = this.props;

    // use the provided id if provided or the default otherwise
    const id = clsc(propsId, this.id);

    return (
      <DockedFlyOut
        id={id}
        flyoutId={flyoutId}
        windowIconName={this._getIcon(section)}
        title={
          <div>
            <Text bold lighter inline>
              Ana
            </Text>{' '}
            <Text inline>(203) 567-9879</Text>
          </div>
        }>
        <Communications onChange={this.handleChange} section={section} />
      </DockedFlyOut>
    );
  }
}

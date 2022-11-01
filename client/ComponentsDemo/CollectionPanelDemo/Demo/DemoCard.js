/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Typography } from 'components';
import { cf } from './DemoCard.scss';
const { SubHeader, Caption } = Typography;

@observer
export default class DemoCard extends Component {
  static propTypes = {
    item: PropTypes.object,
    onItemSelected: PropTypes.func,
  };

  handleOnTouchTapItem = e => {
    const { onItemSelected, item } = this.props;
    onItemSelected && onItemSelected(e, item);
  };

  render() {
    const { item } = this.props;

    return (
      <div className={cf('mainContent')} onClick={this.handleOnTouchTapItem}>
        <SubHeader bold>{item.firstName}</SubHeader>
        <Caption>{item.lastName}</Caption>
      </div>
    );
  }
}

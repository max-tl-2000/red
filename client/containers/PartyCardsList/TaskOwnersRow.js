/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Typography as T } from 'components';

export default class TaskOwnersRow extends Component {
  static propTypes = {
    task: PropTypes.object,
    users: PropTypes.object,
    currentUser: PropTypes.object,
  };

  renderOwners = (ownerIds, users, currentUser) =>
    ownerIds.map((ownerId, index) => {
      const highlighted = ownerId === currentUser.id;
      const owner = users.get(ownerId);

      return (
        <T.Caption highlight={highlighted} inline key={owner.id}>
          {owner.fullName}
          {do {
            if (index !== ownerIds.length - 1) {
              <span>, </span>;
            }
          }}
        </T.Caption>
      );
    });

  render = () => {
    const { task, users, currentUser } = this.props;

    return <T.Caption secondary>{this.renderOwners([...new Set(task.userIds)], users, currentUser)}</T.Caption>;
  };
}

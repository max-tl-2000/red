/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import trim from 'helpers/trim';
import { cf, g } from './styles.scss';
import Icon from '../../components/Icon/Icon';

export default class DemoSection extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    const { id, className, title, children } = this.props;
    const linkId = id || trim(title).replace(/\s+/g, '_');

    return (
      <div className={cf('demo-container', g(className))}>
        <h5 id={linkId} className="textTitle" data-linkable={true}>
          <a className={cf('section-link')} href={`#${linkId}`}>
            <Icon name="link" />
          </a>
          {title}
        </h5>
        <section>{children}</section>
      </div>
    );
  }
}

/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import sass from 'node-sass';
import path from 'path';
import Field from './Field';
import { sortByCreationDate } from '../../../common/helpers/sortBy';

@observer
export default class CollectionPanel extends Component {
  static propTypes = {
    entityName: PropTypes.string,
    EntityComponent: PropTypes.func.isRequired,
    collectionViewModel: PropTypes.object.isRequired,
  };

  static styles = [
    sass.renderSync({ file: path.resolve(__dirname, './CollectionPanel.scss') }).css.toString(),
    sass.renderSync({ file: path.resolve(__dirname, './Typography.scss') }).css.toString(),
    ...Field.styles,
  ];

  renderItems = collectionItems => {
    const { EntityComponent } = this.props;
    return (
      <div>
        {collectionItems.sort(sortByCreationDate).map(item => (
          <Field key={item.id} className="field-divider" inline maxWidth={150}>
            <EntityComponent item={item} />
          </Field>
        ))}
      </div>
    );
  };

  render() {
    const {
      collectionViewModel: { items: collectionItems },
    } = this.props;
    return (
      <div>
        <div className="cards-section">{this.renderItems(collectionItems)}</div>
        <div />
      </div>
    );
  }
}

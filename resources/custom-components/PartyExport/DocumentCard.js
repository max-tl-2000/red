/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import createElement from './create-element';
const Text = createElement('text');
import { t } from 'i18next';
import { applicationDocumentTypes } from '../../../rentapp/common/application-constants';

@observer
export default class DocumentCard extends Component {
  static propTypes = {
    item: PropTypes.object,
  };

  getAccessType = accessType => (accessType === applicationDocumentTypes.PRIVATE_DOCUMENTS_TYPE ? t('PRIVATE') : t('SHARED'));

  render() {
    const { className, item } = this.props;

    return (
      <div className={`card ${className}`}>
        <div className="cardTextWrapper">
          <Text style={{ fontSize: 7 }}>{item.name}</Text>
          <Text style={{ fontSize: 7, color: '#A8A8A8' }}>{this.getAccessType(item.accessType)}</Text>
        </div>
      </div>
    );
  }
}

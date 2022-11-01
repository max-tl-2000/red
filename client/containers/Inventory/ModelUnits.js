/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Icon, Card, Typography as T } from 'components';
import { t } from 'i18next';
import ModelUnit from './ModelUnit';
import { cf } from './ModelUnits.scss';

export default class ModelUnits extends Component {
  displayMoreModelUnits = () => this.props.displayAllModelUnits();

  render() {
    const { models = [], partyId, timezone, collapsed, hasMoreThanTwoModels } = this.props;
    return (
      <Card className={cf('models')}>
        <T.Caption className={cf('resultCaptionGroup')}>{t('MODEL_UNIT_RESULT', { count: models.length })}</T.Caption>
        {models.map(inventory => (
          <ModelUnit key={inventory.id} partyId={partyId} inventory={inventory} timezone={timezone} />
        ))}
        {hasMoreThanTwoModels && (
          <div className={cf('collapse-trigger')} onClick={this.displayMoreModelUnits}>
            <div>
              <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} />
            </div>
          </div>
        )}
      </Card>
    );
  }
}

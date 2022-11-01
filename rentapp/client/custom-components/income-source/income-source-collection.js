/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { computed } from 'mobx';

import CollectionPanel from 'custom-components/CollectionPanel/CollectionPanel';
import IncomeSourceForm from './income-source-form';
import IncomeSourceCard from './income-source-card';
import { createIncomeSourceFormModel } from '../../models/income-source-form-model';
import { RentappTypes } from '../../../common/enums/rentapp-types';
import trim from '../../../../common/helpers/trim';

@observer
export default class IncomeSourceCollection extends Component {
  @computed
  get initialData() {
    const { viewModel, initialIncomeSource } = this.props;
    let data = {
      incomeSourceType: '',
      sourceDescription: '',
      employerName: '',
      jobTitle: '',
      startDate: '',
      managerName: '',
      managerPhone: '',
      hasInternationalAddress: false,
      addressLine: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zip: '',
    };

    if (!viewModel.hasItems) {
      data = {
        ...data,
        incomeSourceType: RentappTypes.IncomeSourceType.EMPLOYMENT,
        grossIncomeFrequency: trim(initialIncomeSource.grossIncomeFrequency) || RentappTypes.TimeFrames.YEARLY,
        grossIncome: initialIncomeSource.grossIncome >= 0 ? initialIncomeSource.grossIncome : '',
      };
    }

    return data;
  }

  static propTypes = {
    viewModel: PropTypes.object,
    initialIncomeSource: PropTypes.object,
  };

  setRef = (prop, instance) => {
    this[prop] = instance;
  };

  render = () => {
    const { initialData, props } = this;
    const { viewModel } = props;

    return (
      <CollectionPanel
        ref={node => this.setRef('collectionPanel', node)}
        entityLabel={'INCOME_SOURCE'}
        FormComponent={IncomeSourceForm}
        EntityComponent={IncomeSourceCard}
        contextMenuDefaults
        emptyMessageStyle={{ padding: '1rem 1.5rem' }}
        collectionViewModel={viewModel}
        createFormModel={createIncomeSourceFormModel}
        initialData={initialData}
      />
    );
  };
}

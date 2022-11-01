/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { Card, Typography as T, Button, CardActions } from 'components';
import { t } from 'i18next';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { observer, inject } from 'mobx-react';
import { updateParty, closeParty } from 'redux/modules/partyStore';
import { cf } from './LeaseFromExistingResident.scss';
import { toMoment } from '../../../common/helpers/moment-utils';

@connect(
  () => ({}),
  dispatch =>
    bindActionCreators(
      {
        updateParty,
        closeParty,
      },
      dispatch,
    ),
)
@inject('leasingNavigator')
@observer
class LeaseFromExistingResident extends Component {
  handleConfirmeIsLeasingRelated = () => {
    const { props } = this;
    props.updateParty({
      id: props.partyId,
      metadata: { leadFromExistingResident: false },
    });
  };

  handleClosePartyAsExistingResident = async () => {
    const { props } = this;
    await props.closeParty(props.partyId, 'ALREADY_A_RESIDENT');

    props.leasingNavigator.navigateToDashboard();
  };

  get partyMetadata() {
    const { party = {} } = this.props;
    const { metadata = {} } = party;
    return metadata;
  }

  get residentInfo() {
    return this.partyMetadata.residentInfo || {};
  }

  get isLeadFromExistingResident() {
    return this.partyMetadata.leadFromExistingResident;
  }

  render() {
    const { residentInfo, isLeadFromExistingResident } = this;
    const { timezone, property } = this.props;
    const isImportResidentDataOn = property?.settings?.integration?.import?.residentData;
    if (!residentInfo || !isLeadFromExistingResident) return null;

    return (
      <Card className={cf('existingResidentSection')}>
        <T.Text>
          {t('RESIDENT_IDENTIFIED_BY', {
            userName: residentInfo.userName,
            date: toMoment(residentInfo.created_at, { timezone }).format('DD MMM YYYY'),
          })}
        </T.Text>
        <T.Text>{t('LEASING_OR_EXISTING_RESIDENT')}</T.Text>
        <CardActions textAlign="right">
          <Button label={t('LEASING_RELATED')} type="flat" btnRole="secondary" onClick={this.handleConfirmeIsLeasingRelated} />
          {!isImportResidentDataOn && <Button label={t('CLOSE_AS_RESIDENT')} btnRole="primary" type="flat" onClick={this.handleClosePartyAsExistingResident} />}
        </CardActions>
      </Card>
    );
  }
}

export default LeaseFromExistingResident;

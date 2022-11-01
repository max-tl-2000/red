/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { SizeAware, Avatar, SavingAffordance } from 'components';
import { observer } from 'mobx-react';
import { observable, action, computed } from 'mobx';
import AddGuestFlyout from '../ProspectDetailPage/AddGuestFlyout';
import { cf } from './PartyTitle.scss';

@observer
export default class PartyTitle extends Component {
  @observable
  width;

  @action
  updateWidth = ({ width }) => {
    this.width = width;
  };

  @computed
  get compact() {
    return this.width <= 300;
  }

  openManagePartyPage = () => {
    const { onPartyTitleClick } = this.props;
    onPartyTitleClick && onPartyTitleClick();
  };

  render() {
    const { width = 0, props, updateWidth, compact } = this;
    const { partyIsClosed, partyMembers, isCorporateParty = false } = props;

    return (
      <SizeAware breakpoints={false} onSizeChange={updateWidth} style={{ width: '100%' }}>
        <div className={cf('members-trigger', { closed: partyIsClosed })}>
          {partyIsClosed && <Avatar className={cf('closedAffordance')} src="/closed-party.svg" />}
          <div className={cf('triggerWrapper')}>
            <AddGuestFlyout
              guestsList={partyMembers}
              triggerWidth={width}
              compact={compact}
              onOpenManagePartyPage={this.openManagePartyPage}
              isCorporateParty={isCorporateParty}
            />
            <SavingAffordance lighter compressed={compact} className={cf('saving-affordance')} matcher={/patch_\/tasks/} />
          </div>
        </div>
      </SizeAware>
    );
  }
}

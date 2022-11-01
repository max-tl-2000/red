/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';
import { Field, SizeAware } from 'components';
import PartyCard from './PartyCard';
import { allowedToModifyParty } from '../../../common/acd/access.js';

@observer
export default class PartyList extends Component {
  @observable
  breakpoint;

  @action
  updateBreakpoint = ({ breakpoint }) => {
    this.breakpoint = breakpoint;
  };

  @computed
  get meta() {
    if (this.breakpoint === 'small') return { cols: 12, itemsPerRow: 1 };
    if (this.breakpoint === 'medium') return { cols: 6, itemsPerRow: 2 };

    return { cols: 4, itemsPerRow: 3 };
  }

  render() {
    const { meta = {}, updateBreakpoint, props } = this;
    const { parties = [], onPartyClick, currentPersonId, currentUser, currentPerson, teams, members, users } = props;

    return (
      <SizeAware onBreakpointChange={updateBreakpoint}>
        {parties.map((party, i) => (
          <Field key={party.id} inline columns={meta.cols} last={(i + 1) % meta.itemsPerRow === 0}>
            <PartyCard
              party={party}
              onClick={onPartyClick}
              noMargin
              agent={users.find(user => user.id === (party.metadata || {}).closeAgentId)}
              currentPersonId={currentPersonId}
              currentPerson={currentPerson}
              teams={teams}
              members={members.filter(p => p.partyId === party.id)}
              disabled={!allowedToModifyParty(currentUser, party)}
            />
          </Field>
        ))}
      </SizeAware>
    );
  }
}

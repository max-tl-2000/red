/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { TwoPanelPage, LeftPanel, RightPanel, PreloaderBlock } from 'components';
import { Page } from '../../custom-components/page/page';
import { ApplicationStepper } from '../application-stepper/application-stepper';
import { ApplicationPanel } from '../application-panel/application-panel';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { ApplicationErrorBlock } from '../application/application-error-block';
import ApplicationUpdateDialog from '../application/application-update-dialog';

@inject('auth', 'application')
@observer
// eslint-disable-next-line react/prefer-stateless-function
export class ApplicationPage extends React.Component {
  // eslint-disable-next-line no-useless-constructor
  constructor(props, context) {
    super(props, context);
  }

  componentWillMount() {
    if (this.props.auth.isAuthenticated) {
      this.props.application.fetchApplicant({ reload: true });
    }
  }

  render() {
    const { quoteId, partyId, propertyId, propertyName, isApplicantRemovedFromParty, isPartyMemberMerged } = this.props.application;

    if (!isApplicantRemovedFromParty && !(quoteId && partyId) && !propertyId) {
      return <PreloaderBlock />;
    }

    return (
      <Page appBar={<RentAppBar title={propertyName} />}>
        {!isApplicantRemovedFromParty && (
          <TwoPanelPage responsiveState="row">
            <LeftPanel>
              <ApplicationStepper />
            </LeftPanel>
            <RightPanel padContent>{partyId && <ApplicationPanel reflow quoteId={quoteId} partyId={partyId} />}</RightPanel>
          </TwoPanelPage>
        )}
        <ApplicationErrorBlock />
        {isPartyMemberMerged && <ApplicationUpdateDialog open={isPartyMemberMerged} />}
      </Page>
    );
  }
}

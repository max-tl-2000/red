/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { observer, inject } from 'mobx-react';
import { TwoPanelPage, LeftPanel, RightPanel, CardMenu, CardMenuItem } from 'components';
import { t } from 'i18next';
import { Page } from '../../custom-components/page/page';
import { Application } from '../application/application';
import { ApplicationErrorBlock } from '../application/application-error-block';
import { ApplicationPanel } from '../application-panel/application-panel';
import { RentAppBar } from '../../custom-components/rentapp-bar/rentapp-bar';
import { push } from '../../../../client/helpers/navigator';

@inject('auth', 'application')
@observer
export class Welcome extends React.Component {
  handleSwitchApplication = async () => {
    const { auth } = this.props;
    push(`/applicationList/${auth.token}`);
  };

  renderAppBarActions = () => {
    const { application } = this.props;
    const { hasMultipleApplications } = application;
    if (!hasMultipleApplications) return <noscript />;

    return (
      <CardMenu iconName="dots-vertical" onSelect={this.handleContextMenuAction} iconStyle="light">
        {hasMultipleApplications && <CardMenuItem text={t('SWITCH_APPLICATION')} onClick={this.handleSwitchApplication} />}
      </CardMenu>
    );
  };

  render() {
    const { quoteId, partyId, propertyName, isApplicantRemovedFromParty, isMemberRemovedFromParty, isPartyClosed } = this.props.application;
    const shouldShowError = isApplicantRemovedFromParty || isMemberRemovedFromParty || isPartyClosed;

    return (
      <Page appBar={<RentAppBar propertyName={propertyName} appBarActions={this.renderAppBarActions()} />}>
        {!shouldShowError && (
          <TwoPanelPage responsiveState="row">
            <LeftPanel padContent>
              <Application />
            </LeftPanel>
            <RightPanel padContent>{partyId && <ApplicationPanel reflow displayPropertyPolicies={false} quoteId={quoteId} partyId={partyId} />}</RightPanel>
          </TwoPanelPage>
        )}
        <ApplicationErrorBlock />
      </Page>
    );
  }
}

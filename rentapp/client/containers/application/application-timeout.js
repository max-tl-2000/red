/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { Typography as T } from 'components';
import { t } from 'i18next';
import { AgentInfo } from '../../custom-components/agent-info/agent-info';
import { cf } from './application-timeout.scss';

@observer
export class ApplicationTimeout extends Component {
  componentDidMount = () => {
    this.fetchPartyAgentIfNeeded();
  };

  fetchPartyAgentIfNeeded = () => {
    const { agent, application } = this.props;
    if (agent.loadingAgent) return;
    !agent.isAgentReady && agent.fetchPartyAgent(application.partyId);
  };

  render = ({ agent } = this.props) => (
    <div>
      <T.SubHeader className={cf('dialog-content')}>{t('TIME_OUT_FIRST_CONTENT')}</T.SubHeader>
      <T.SubHeader className={cf('dialog-content')}>{t('TIME_OUT_SECOND_CONTENT')}</T.SubHeader>
      <div>{agent.isAgentReady && <AgentInfo agent={agent.agent} />}</div>
    </div>
  );
}

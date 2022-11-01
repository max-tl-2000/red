/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, Section } from 'components';
import { t } from 'i18next';
import { areRequiredFieldsFilled } from 'helpers/models/party';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { isChangePartyTypeDisabledForParty } from 'redux/selectors/partySelectors';
import { enableUpdatePartyTypeAction, updateParty } from 'redux/modules/partyStore';
import isEqual from 'lodash/isEqual';
import intersection from 'lodash/intersection';
import { observer } from 'mobx-react';
import { action } from 'mobx';
import { userHasPropertyAndTeamAndChannelSelections } from '../../redux/selectors/userSelectors';
import QualificationQuestions from '../../custom-components/QualificationQuestions/QualificationQuestions';
import { cf } from './QualificationQuestionsWrapper.scss';
import { getPartyTimezone } from '../../redux/selectors/partySelectors';

@connect(
  (state, props) => ({
    isChangePartyTypeDisabled: isChangePartyTypeDisabledForParty(state, props),
    currentUser: state.auth.user,
    selectedPropertyIds: state.unitsFilter.filters.propertyIds,
    hasPropertyAndTeamAndChannel: userHasPropertyAndTeamAndChannelSelections(state),
    timezone: getPartyTimezone(state, props),
  }),
  dispatch =>
    bindActionCreators(
      {
        enableUpdatePartyTypeAction,
        updateParty,
      },
      dispatch,
    ),
  null,
  { withRef: true },
)
@observer
export default class QualificationQuestionsWrapper extends Component {
  constructor(props) {
    super(props);
    const party = props.party || {};
    const { qualificationQuestions = {}, storedUnitsFilters = {} } = party;

    this.state = {
      qualificationQuestions,
      storedUnitsFilters,
    };
  }

  static propTypes = {
    qualificationQuestionsModel: PropTypes.object.isRequired,
  };

  tryEnableQualificationQuestionWarningMode = (enable = true) => {
    const { qualificationQuestionsModel } = this.props;
    if (!qualificationQuestionsModel) return false;
    const isWarningModeEnable = enable && qualificationQuestionsModel.shouldShowWarning;
    isWarningModeEnable && this.props.isChangePartyTypeDisabled && this.props.enableUpdatePartyTypeAction(false);
    qualificationQuestionsModel.setWarningMode(isWarningModeEnable);
    return isWarningModeEnable;
  };

  handleSaveQuestionsRequest = () => {
    if (this.tryEnableQualificationQuestionWarningMode(true)) return;
    this.handleSaveQuestions();
  };

  @action
  handleSaveQuestions = async () => {
    const { qualificationQuestions, storedUnitsFilters } = this.state;
    const { partyId: id, party, onQuestionsSave } = this.props;

    // only allow to update the party if we have a party object loaded
    // and only if this party is the same as the one in the partyId prop
    if (!id || !party || party.id !== id) return;

    const success = await this.props.updateParty({ id, qualificationQuestions, storedUnitsFilters });

    if (success) {
      await this.tryEnableQualificationQuestionWarningMode(false);
      await this.restoreQualificationQuestionsModel(qualificationQuestions);
      onQuestionsSave && onQuestionsSave();
    }
  };

  restoreQualificationQuestionsModel = qualificationQuestions => {
    const { qualificationQuestionsModel } = this.props;
    if (isEqual(qualificationQuestions, qualificationQuestionsModel.qualificationQuestions)) return;

    qualificationQuestionsModel.restoreData(qualificationQuestions, this.props.partyId);
  };

  getAssignedPropertyId = () => {
    const { selectedPropertyId, currentUser, selectedPropertyIds } = this.props;
    if (!currentUser) return undefined;
    if (selectedPropertyId) return selectedPropertyId;

    const properties = selectedPropertyIds || [];

    return properties[0];
  };

  getLeaseTermsForAssignedProperty = () => {
    const { party = {}, properties = [] } = this.props;
    const assignedProperyId = party.assignedPropertyId || this.getAssignedPropertyId();
    const assignedProperty = properties.find(property => property.id === assignedProperyId) || {};
    return assignedProperty.leaseTerms || [];
  };

  handleQuestionsAnswered = (data, filters) =>
    this.setState({
      qualificationQuestions: data,
      storedUnitsFilters: filters,
    });

  saveQuestionsAnswers = () => {
    const { storedUnitsFilters } = this.state;
    const { partyId, qualificationQuestionsModel, party, currentUser } = this.props;
    // only allow to update the party if we have a party object loaded
    // and only if this party is the same as the one in the partyId prop
    //
    // This check is needed to fix https://redisrupt.atlassian.net/browse/CPM-10626
    // basically what was happening here is that the model kept data from the a previous party
    // and we here were not checking if that data belong to the party identified by the id
    // the following check should prevent us saving qualification questions for the wrong party
    const partyChanged = !partyId || !party || party.id !== partyId;
    if (partyChanged) return;
    const qualificationQuestionsPartyChanged = qualificationQuestionsModel.partyId && qualificationQuestionsModel.partyId !== partyId;
    const currentUserNotInPartyTeams =
      intersection(
        currentUser.teams.map(team => team.id),
        party.teams,
      ).length === 0;

    if (qualificationQuestionsPartyChanged || currentUserNotInPartyTeams) return;

    this.props.updateParty({
      id: partyId,
      qualificationQuestions: qualificationQuestionsModel.qualificationQuestions,
      storedUnitsFilters,
    });
  };

  get qualificationQuestionsAndFilters() {
    const { storedUnitsFilters } = this.state;
    const { qualificationQuestionsModel } = this.props;
    return { qualificationQuestions: qualificationQuestionsModel.qualificationQuestions, storedUnitsFilters };
  }

  componentWillReceiveProps = nextProps => {
    if (this.props.partyId !== nextProps.partyId) {
      const { qualificationQuestions = {}, storedUnitsFilters = {} } = nextProps.party || {};

      this.setState({
        qualificationQuestions,
        storedUnitsFilters,
      });
    }
  };

  render() {
    const { party, hasPropertyAndTeamAndChannel, showLeaseTypeQuestion, qualificationQuestionsModel } = this.props;
    const { qualificationQuestions, storedUnitsFilters } = this.state;

    return (
      <Section data-id="qualificationQuestionsSection" title={t('QUALIFICATION_QUESTIONS_LABEL')} padContent={false}>
        <QualificationQuestions
          disabled={!hasPropertyAndTeamAndChannel && !party}
          model={qualificationQuestionsModel}
          unitsFilters={storedUnitsFilters}
          leaseTerms={this.getLeaseTermsForAssignedProperty()}
          onQuestionsAnswered={this.handleQuestionsAnswered}
          onSubmitAction={this.handleSaveQuestions}
          showLeaseTypeQuestion={showLeaseTypeQuestion}
          timezone={this.props.timezone}
        />
        <div className={cf('saveButton')}>
          <Button
            label={t('SAVE_AND_CONTINUE')}
            id="btnSaveAndContinue"
            btnRole={'primary'}
            onClick={this.handleSaveQuestionsRequest}
            disabled={!(party && areRequiredFieldsFilled(qualificationQuestions))}
          />
        </div>
      </Section>
    );
  }
}

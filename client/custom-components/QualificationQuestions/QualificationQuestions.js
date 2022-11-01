/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Form, SizeAware } from 'components';
import { observable, computed, action } from 'mobx';
import { observer } from 'mobx-react';
import { createMoveInFilter } from '../../../common/helpers/filters';
import { cf } from './QualificationQuestions.scss';
import UpdatePartyTypeDialog from '../PartyType/UpdatePartyTypeDialog';
import NumBedrooms from './NumBedroomsQuestion';
import GroupProfile from './GroupProfileQuestion';
import CashAvailable from './CashAvailableQuestion';
import MoveInTime from './MoveInTimeQuestion';
import NumberOfUnitsQuestion from './NumberOfUnitsQuestion';
import LeaseLength from './LeaseLengthQuestion';
import { DALTypes } from '../../../common/enums/DALTypes';

@observer
export default class QualificationQuestions extends Component {
  @observable
  breakpoint;

  @action
  updateBreakpoint = ({ breakpoint }) => {
    this.breakpoint = breakpoint;
  };

  @computed
  get cols() {
    const { breakpoint } = this;

    if (breakpoint === 'small') return 12;
    if (breakpoint === 'medium') return 7;

    return 6;
  }

  static propTypes = {
    model: PropTypes.object.isRequired,
    unitsFilters: PropTypes.object,
    leaseTerms: PropTypes.arrayOf(PropTypes.object),
    onQuestionsAnswered: PropTypes.func,
    onSubmitAction: PropTypes.func,
    showLeaseTypeQuestion: PropTypes.bool,
    isRenewalParty: PropTypes.bool,
  };

  static defaultProps = {
    leaseTerms: [],
    showLeaseTypeQuestion: true,
  };

  handleQuestionsAnswered = question => {
    this.props.model.updateFrom(question);
    this._raiseQuestionsAnswered();
  };

  // TODO: work for a future PR
  // this should not be needed
  // since we have access to the model
  // we know when the model change from that object directly
  // we should abstract it and provide an onChange event at the
  // model level not at the react component level.
  // Even that if we only use the onChange event to notify that
  // something change, that is done automatically by mobx so even
  // the onChange event is probably not needed
  _raiseQuestionsAnswered = () => {
    const { model, unitsFilters, timezone, onQuestionsAnswered } = this.props;
    const { qualificationQuestions = {} } = model;

    const filters = {
      ...unitsFilters,
      numBedrooms: qualificationQuestions.numBedrooms,
      moveInDate: createMoveInFilter(qualificationQuestions.moveInTime || null, { timezone }),
    };

    model.isCorporateGroupProfile && Object.assign(filters, { numberOfUnits: qualificationQuestions.numberOfUnits });

    onQuestionsAnswered && onQuestionsAnswered(qualificationQuestions, filters);
  };

  handleOnSubmit = () => {
    const { onSubmitAction } = this.props;
    onSubmitAction && onSubmitAction();
  };

  handleCloseUpdatePartyTypeDialog = () => {
    this.props.model.setWarningMode(false);
  };

  getExcludedOptionsForQuestion = questionName => {
    const { showLeaseTypeQuestion } = this.props;
    if (questionName !== GroupProfile.displayName || showLeaseTypeQuestion) return [];

    return [DALTypes.QualificationQuestions.GroupProfile.CORPORATE];
  };

  renderQualificationQuestions = () => {
    const { isRenewalParty } = this.props;
    const questions = isRenewalParty ? [GroupProfile] : [NumBedrooms, GroupProfile, CashAvailable, MoveInTime];

    if (this.props.model.isCorporateGroupProfile) {
      const { showLeaseTypeQuestion } = this.props;
      !showLeaseTypeQuestion && questions.splice(1, 1);
      const cashAvailableIndex = showLeaseTypeQuestion ? 2 : 1;
      questions.splice(cashAvailableIndex, 1, NumberOfUnitsQuestion);
      questions.push(LeaseLength);
    }

    const { model, disabled, readOnly } = this.props;
    const { qualificationQuestions = {} } = model;

    return questions.map((QuestionComponent, index) => {
      const key = QuestionComponent.displayName;
      const indexKey = `${key}-${index}`;

      if (key === 'NumberOfUnitsQuestion') {
        // onChange callack here is only needed because the questions are passed to the parent component
        // this should not be needed, mostly because the parent already have access to the qualificationsModel
        // (the model is passed down to this component) so he has access to all the changes from that object
        return (
          <QuestionComponent
            disabled={disabled}
            readOnly={readOnly}
            key={indexKey}
            field={model.fields.numberOfUnits}
            columns={this.cols}
            onChange={this._raiseQuestionsAnswered}
          />
        );
      }
      const properties = {
        leaseTerms: this.props.leaseTerms,
        [key]: qualificationQuestions[key],
        excludedOptions: this.getExcludedOptionsForQuestion(key),
        handleQuestionsAnswered: this.handleQuestionsAnswered,
        columns: this.cols,
        key: indexKey,
        readOnly,
        disabled: disabled || readOnly,
      };

      return <QuestionComponent {...properties} />;
    });
  };

  render() {
    const { updateBreakpoint } = this;

    return (
      <div>
        <Form className={cf('form')}>
          <SizeAware onBreakpointChange={updateBreakpoint}>{this.renderQualificationQuestions()}</SizeAware>
        </Form>
        <UpdatePartyTypeDialog
          isDialogOpen={this.props.model.showWarning}
          onSubmitAction={this.handleOnSubmit}
          onDialogClosed={this.handleCloseUpdatePartyTypeDialog}
        />
      </div>
    );
  }
}

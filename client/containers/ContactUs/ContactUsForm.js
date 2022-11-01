/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { TextBox, Button, Form, Typography, FormSummary } from 'components';

import { t } from 'i18next';
import { Field, reduxForm, SubmissionError, formValueSelector } from 'redux-form';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { sendContactUsData } from 'redux/modules/contactUs';
import notifier from 'helpers/notifier/notifier';
import { createQualificationQuestionsModel } from '../../helpers/models/qualificationQuestionsModel';

import { isPhoneValid } from '../../../common/helpers/validations/phone';
import { isEmailValid } from '../../../common/helpers/validations/email';
import { cf } from './ContactUsForm.scss';
import QualificationQuestions from '../../custom-components/QualificationQuestions/QualificationQuestions';

const { Title, Text, Caption } = Typography;

const formName = 'contactUs';
const formSelector = formValueSelector(formName);
const qualificationQuestionsModel = createQualificationQuestionsModel();

const validate = values => ({
  email: values.email && !isEmailValid(values.email) && 'INVALID_EMAIL_ADDRESS',
  phone: values.phone && !isPhoneValid(values.phone) && 'INVALID_PHONE_NUMBER',
});

const rfTextBox = ({ input, meta, highlighted, ...rest }) => (
  <TextBox
    onChange={({ value }) => input.onChange(value)}
    onBlur={input.onBlur}
    errorMessage={t((meta.touched && meta.error) || '')}
    value={input.value}
    className={cf((highlighted && 'highlighted') || '', 'inputsPadding')}
    {...rest}
  />
);

const rfQualificationQuestions = ({ input, ...rest }) => (
  <QualificationQuestions onQuestionsAnswered={answers => input.onChange(answers)} model={qualificationQuestionsModel} {...rest} />
);

@connect(
  state => ({
    serverSuccess: state.contactUsStore.success,
    serverError: state.contactUsStore.error,
    formData: formSelector(state, 'name', 'phone', 'email'),
  }),
  dispatch => bindActionCreators({ sendContactUsData }, dispatch),
)
class ContactUsForm extends Component {
  componentWillReceiveProps({ serverSuccess }) {
    if (serverSuccess && !this.props.serverSuccess) {
      const { name, email, phone } = this.props.formData;
      notifier.success(t('REQUEST_RECEIVED', { name: name || email || phone }));
      this.props.reset();
    }
  }

  submit = values => {
    if (!values.phone && !values.email) {
      return Promise.reject(
        new SubmissionError({
          _error: {
            type: 'phoneOrEmailRequired',
            text: 'PHONE_OR_EMAIL_REQUIRED',
          },
        }),
      );
    }
    const query = this.props.location.query;
    return this.props.sendContactUsData(values, query);
  };

  submitAndRequestApplication = values => {
    values.requestApplication = true;
    this.submit(values);
  };

  render() {
    const { pristine, invalid, submitting, handleSubmit, error, serverError } = this.props;

    const { type, text: clientError } = error || {};
    const highlightPhoneAndEmail = type === 'phoneOrEmailRequired';

    const { token, teamEmail } = this.props.location.query;

    return (
      <div className={cf('container')}>
        <div style={{ padding: '10px 15px', background: '#fff' }}>
          <Title>Contact Us test page</Title>
        </div>
        <div style={{ padding: '10px 15px', background: '#eee' }}>
          <Text bold>Query parameters</Text>
          {(!token || !teamEmail) && (
            <Text style={{ marginTop: '.5em' }} error>
              Please make sure to provide a token and teamEamil as query parameters
            </Text>
          )}
          {(!token || !teamEmail) && <Caption style={{ marginTop: '1em' }}>Example: ?teamEmail=parkmerced&token=someToken</Caption>}
          {teamEmail && (
            <Caption>
              <Caption inline bold>
                teamEmail:
              </Caption>
              {`  ${teamEmail}`}
            </Caption>
          )}
          {token && (
            <Caption>
              <Caption inline bold>
                token:
              </Caption>
              {`  ${token}`}
            </Caption>
          )}
        </div>
        <Form className={cf('form')}>
          <div className={cf('personInfo')}>
            <Field name="name" component={rfTextBox} label={t('YOUR_NAME')} showClear />
            <Field name="phone" component={rfTextBox} label={t('PHONE_NO')} highlighted={highlightPhoneAndEmail} showClear />
            <Field name="email" component={rfTextBox} label={t('EMAIL_ADDRESS')} highlighted={highlightPhoneAndEmail} showClear />
          </div>
          <Field name="message" component={rfTextBox} label={t('MESSAGE')} multiline numRows={2} />
          <Field name="qualificationQuestions" component={rfQualificationQuestions} />
          <div className={cf('inputsPadding')}>
            <div className={cf('formButtons')}>
              <Button label={t('SUBMIT')} disabled={pristine || invalid || submitting} onClick={handleSubmit(this.submit)} />
              {(clientError || serverError) && <FormSummary messages={[t(clientError), t(serverError)]} />}
            </div>
            <div className={cf('formButtons submitReqBtn')}>
              <Button
                label={t('SUBMIT_AND_REQUEST_APPLICATION')}
                disabled={pristine || invalid || submitting}
                onClick={handleSubmit(this.submitAndRequestApplication)}
              />
              {(clientError || serverError) && <FormSummary messages={[t(clientError), t(serverError)]} />}
            </div>
          </div>
        </Form>
      </div>
    );
  }
}

export default reduxForm({ form: formName, validate })(ContactUsForm);

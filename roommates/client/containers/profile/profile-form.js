/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import PropTypes from 'prop-types';
import React, { Component } from 'react';
import { Card, Form, TextBox, Field, Dropdown, Typography, Button, DateSelector, FlyOut, FlyOutOverlay } from 'components';
import { t } from 'i18next';
import { observer, inject } from 'mobx-react';
import { isObject } from 'helpers/type-of';
import { cf } from './profile-form.scss';
import { DALTypes } from '../../../common/enums/dal-types';
import { FormFieldType } from '../../../common/enums/form-constants';
import { SuggestedTopics } from './suggested-topics';
import { push } from '../../../../client/helpers/navigator';
import { LA_TIMEZONE } from '../../../../common/date-constants';
import { toMoment, now } from '../../../../common/helpers/moment-utils';

const { Caption } = Typography;

const getFormFields = (context, model) => {
  const { fields } = model;

  return [
    {
      type: FormFieldType.TEXT,
      columns: 12,
      footerComponent: (
        <Caption secondary style={{ marginBottom: 10 }}>
          {t('ROOMMATE_FULL_NAME_NOTE')}
        </Caption>
      ),
      style: { marginBottom: 4 },
      componentProps: {
        id: 'name',
        model: fields.fullName,
        label: t('FULL_NAME'),
        wide: true,
        onBlur: model.fillPreferredName,
      },
    },
    {
      type: FormFieldType.TEXT,
      columns: 12,
      componentProps: {
        id: 'preferredName',
        model: fields.preferredName,
        label: `${t('PREFERRED_NAME')} (${t('PUBLIC').toLowerCase()})`,
        wide: true,
      },
    },
    {
      labelComponent: <Caption secondary>{`${t('ROOMMATE_PREFERRED_MOVE_IN_DATE_RANGE')} (${t('PUBLIC').toLowerCase()})`}</Caption>,
      containerClassName: cf('inline'),
      fields: [
        {
          type: FormFieldType.DATESELECTOR,
          columns: 6,
          className: cf('field'),
          componentProps: {
            items: [],
            placeholder: t('FROM'),
            model: fields.moveInDateFrom,
            className: cf('not-padding-top'),
            wide: true,
            minDate: now(), // TODO: ask Avantica to consider the timezone here
          },
        },
        {
          type: FormFieldType.DATESELECTOR,
          className: cf('half-width', 'field'),
          componentProps: {
            items: [],
            placeholder: t('TO'),
            model: fields.moveInDateTo,
            className: cf('not-padding-top'),
            wide: true,
            minDate: new Date(fields.moveInDateFrom.value),
          },
        },
      ],
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.Gender,
        label: t('GENDER'),
        wide: true,
        model: fields.gender,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.Age,
        label: t('AGE'),
        wide: true,
        model: fields.age,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.CollegeYear,
        label: t('ROOMMATE_CURRENT_COLLEGE_YEAR'),
        wide: true,
        model: fields.collegeYear,
      },
    },
    {
      type: FormFieldType.TEXT,
      columns: 12,
      componentProps: {
        id: 'academicMajor',
        label: t('ROOMMATE_ACADEMIC_MAJOR'),
        optional: true,
        wide: true,
        model: fields.academicMajor,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.PreferLiveWith,
        label: t('ROOMMATE_LIVE_WITH'),
        wide: true,
        model: fields.preferLiveWith,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.LikeKeepApartment,
        label: t('ROOMMATE_KEEP_APARTMENT'),
        wide: true,
        model: fields.likeKeepApartment,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.NormallyWakeUp,
        label: t('ROOMMATE_NORMALLY_WAKE_UP'),
        wide: true,
        model: fields.normallyWakeUp,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.NormallyGoBed,
        label: t('ROOMMATE_NORMALLY_GO_BED'),
        wide: true,
        model: fields.normallyGoBed,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.LikeStudyIn,
        label: t('ROOMMATE_LIKE_STUDY'),
        optional: true,
        wide: true,
        model: fields.likeStudyIn,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.LikeHaveGatheringsInApartment,
        label: t('ROOMMATE_LIKE_GATHERINGS'),
        optional: true,
        wide: true,
        model: fields.likeHaveGatheringsInApartment,
      },
    },
    {
      type: FormFieldType.DROPDOWN,
      columns: 12,
      componentProps: {
        items: DALTypes.PreferPetFreeApartment,
        label: t('ROOMMATE_PET_FREE'),
        optional: true,
        wide: true,
        model: fields.preferPetFreeApartment,
      },
    },
    {
      type: FormFieldType.TEXT,
      columns: 12,
      footerComponent: <Caption secondary>{t('ROOMMATE_SHOULD_KNOW_NOTE')}</Caption>,
      style: { marginBottom: 4 },
      extraChild: (
        <FlyOut
          usePrevSiblingAsTrigger
          matchTriggerSize={false}
          expandTo="right-top"
          onPosition={args => {
            args.position.my = 'left+35 bottom-4';
          }}
          open={context.state.showSuggestedTopics}
          onCloseRequest={() => context.setState({ showSuggestedTopics: false })}>
          <FlyOutOverlay container={false} elevation={1}>
            <SuggestedTopics />
          </FlyOutOverlay>
        </FlyOut>
      ),
      componentProps: {
        id: 'shouldKnow',
        label: t('ROOMMATE_SHOULD_KNOW'),
        optional: true,
        optionalMark: `(${t('OPTIONAL')} ${t('AND')} ${t('PUBLIC')})`.toLowerCase(),
        wide: true,
        multiline: true,
        model: fields.shouldKnowAboutMe,
        onFocus: () => context.setState({ showSuggestedTopics: true }),
      },
    },
  ];
};

const getDropDownItems = items =>
  Object.keys(items).map(key => ({
    id: items[key],
    text: t(key),
  }));

// TODO: All the below helpers should go on field-helpers

const renderTextBox = ({
  model,
  label,
  placeholder,
  className,
  optional,
  id,
  type = 'text',
  disabled,
  wide,
  onBlur,
  onFocus,
  multiline,
  optionalMark,
} = {}) => (
  <TextBox
    value={model.value}
    id={id}
    placeholder={placeholder}
    label={label}
    optional={optional}
    required={!!model.required}
    className={className}
    wide={wide}
    type={type}
    multiline={multiline}
    optionalMark={optionalMark}
    showClear
    requiredMark={''}
    onBlur={(...args) => {
      model.waitForBlur && model.markBlurredAndValidate();
      onBlur && onBlur(...args);
    }}
    errorMessage={model.errorMessage}
    onChange={({ value }) => model.setValue(value)}
    onFocus={onFocus}
    disabled={disabled}
  />
);

const renderDropDown = ({ items, label, placeholder, model, disabled, optional, className, wide }) => {
  const dropDownItems = isObject(items) ? getDropDownItems(items) : items;
  return (
    <Dropdown
      items={dropDownItems}
      label={label}
      placeholder={placeholder}
      onChange={({ id }) => {
        model.value = id;
      }}
      selectedValue={model.value}
      errorMessage={model.errorMessage}
      wide={wide}
      optional={optional}
      disabled={disabled}
      className={className}
    />
  );
};

const getTransformedDate = (date, timezone) => (date && toMoment(date, { timezone })) || undefined;

const renderDateSelector = (context, { model, label, placeholder, className, wide, minDate }) => {
  const { timezone } = context.state;

  return (
    <DateSelector
      textBoxClassName={className}
      wide={wide}
      label={label}
      timezone={timezone}
      selectedDate={getTransformedDate(model.value, timezone)}
      onChange={day => {
        model.value = toMoment(day, { timezone });
      }}
      min={getTransformedDate(minDate, timezone)}
      isDateDisabled={context.isDateDisabled}
      placeholder={placeholder}
    />
  );
};

const renderField = (context, { type, columns, className, componentProps, style }, key) => (
  <Field key={key} columns={columns} className={className} style={style}>
    {type === FormFieldType.TEXT && renderTextBox(componentProps)}
    {type === FormFieldType.DROPDOWN && renderDropDown(componentProps)}
    {type === FormFieldType.DATESELECTOR && renderDateSelector(context, componentProps)}
  </Field>
);

const renderFormFields = (context, formFields) =>
  formFields.map((formField, index) => (
    // TODO: we need to use a real id in this case
    // eslint-disable-next-line react/no-array-index-key
    <div key={index}>
      {formField.labelComponent}
      <div className={formField.containerClassName}>
        {formField.fields && formField.fields.map((field, key) => renderField(context, field, key))}
        {!formField.fields && renderField(context, formField)}
        {formField.extraChild}
      </div>
      {formField.footerComponent}
    </div>
  ));

@inject('auth', 'profile')
@observer
export class ProfileForm extends Component { // eslint-disable-line
  static propTypes = {
    formModel: PropTypes.object,
  };

  constructor(props, context) {
    super(props, context);

    this.state = {
      showSuggestedTopics: false,
      timezone: this.props.auth.propertyTimezone || LA_TIMEZONE,
    };
  }

  componentWillMount() {
    this.props.profile.ProfileModel.setOnAppBarIconSectionClick(() => this.submit());
  }

  submitGAProfileCompleteEventIfFirstTime() {
    if (!this.props.isProfileCompleted && window.ga) {
      window.ga('send', 'event', 'profile', 'complete');
    }
  }

  submit = async () => {
    const { formModel } = this.props;
    const { user } = this.props.auth.authInfo;
    this.submitGAProfileCompleteEventIfFirstTime();
    await formModel.validate();
    if (formModel.valid) {
      const roommate = await this.props.profile.ProfileModel.submitProfileForm(user.id, formModel.serializedData);
      if (roommate) {
        push('/');
      }
    }
  };

  isDateDisabled = date => {
    const { timezone } = this.state;
    const today = now({ timezone });
    return today.isAfter(date, 'day');
  };

  render() {
    const { formModel } = this.props;
    const formFields = getFormFields(this, formModel);

    return (
      <div className={cf('profile-form')}>
        <Card className={cf('card')} container={false}>
          <Form>
            {renderFormFields(this, formFields)}
            <div className={cf('actions')}>
              <Button useWaves type="raised" btnRole="primary" label={t('DONE')} onClick={() => this.submit()} />
            </div>
          </Form>
        </Card>
      </div>
    );
  }
}

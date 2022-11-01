/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer, Observer } from 'mobx-react';
import { validatePhone } from 'helpers/phone-utils';
import { t } from 'i18next';
import trim from 'helpers/trim';
import { dateMask } from 'components/TextBox/masks';

import { createModel } from 'helpers/Form/FormModel';
import { Form, TextBox, FormSummary, SelectionGroup, Dropdown, Button, FormActions, PhoneTextBox, Field } from 'components';
import { VALID_DATE } from '../../../common/regex';

import { cf } from './FormDemo.scss';
import { toMoment } from '../../../common/helpers/moment-utils';
import DateSelector from '../../components/DateSelector/DateSelector';

const data = [
  {
    id: '1',
    text: 'Option 1',
  },
  {
    id: '2',
    text: 'Option 2 with some more text',
  },
  {
    id: '3',
    text: 'Option 3 normal',
  },
  {
    id: '4',
    text: 'Option 4 again with tons of text',
  },
];

const nested = [
  {
    id: '01',
    text: 'Group One',
    items: data,
  },
  {
    id: '04',
    text: 'Group Four',
    items: data.map(ele => ({
      ...ele,
      id: `${ele.id}_04`,
    })),
  },
];

@observer
export default class DemoForm extends Component {
  constructor(props, context) {
    super(props, context);

    // create model takes a hash that represent the fields
    // and a second hash for validators
    // With these to objects a model is a created that has
    // the following structure
    //
    // model = {
    //   get valid(),
    //   validating, // boolean, whethere we're currently perform a validation or not
    //   validate(), // a method that perform the field validations both sync/async
    //   fields: {} // a hash with the fields passed to createModel
    // }
    //
    // A field have the following structure
    // field = {
    //   interacted
    // }
    const model = createModel(
      {
        firstName: '',
        lastName: '',
        startDate: null,
        dob: '',
        dd1: '2',
        dd2: '3',
        dd3: [],
        sg1: [],
        sg2: [],
        sg3: '',
        phone: '',
      },
      {
        dob: {
          // translations were not used here since this is a demo only
          // the real code will have to use `t` for this string
          errorMessage: 'Please provide a valid date',
          fn: field => {
            if (!field.value) return true; // make it optional
            const dob = trim(field.value);
            return !!dob.match(VALID_DATE) && toMoment(dob, { format: 'MM/DD/YYYY' }).isValid();
          },
        },
        phone: {
          waitForBlur: true,
          // translations were not used here since this is a demo only
          // the real code will have to use `t` for this string
          errorMessage: 'Please provide a valid phone number',
          fn(field) {
            // if there are no values just ignore it
            if (!field.value) return true;
            const result = validatePhone(field.value);
            if (!result.valid) {
              // it is possible to modify the error message
              // returning an object with an error field
              return {
                error: t(result.reason),
              };
            }
            return true;
          },
        },
        firstName: {
          waitForBlur: true,
          required: 'Please enter your first name',
        },
        // validator descriptor
        lastName: {
          waitForBlur: true,
          // default error message. The error message can be
          // modified from the validation function as shown
          // by returning Promise.reject({ error: 'ERROR_MESSAGE_HERE'})
          //
          // translations were not used here since this is a demo only
          // the real code will have to use `t` for this string
          required: 'Please enter your lastName',
        },
        startDate: {
          required: 'Please enter a date',
          waitForBlur: true,
        },
        sg1: {
          // translations were not used here since this is a demo only
          // the real code will have to use `t` for this string
          required: 'Please select at least one',
          hasValue: val => Array.isArray(val) && val.length > 0,
          fn(field) {
            if (field.value.length === 4) {
              return {
                // translations were not used here since this is a demo only
                // the real code will have to use `t` for this string
                error: 'Please do not select all the options',
              };
            }
            return true;
          },
        },
      },
    );

    this.state = {
      model,
    };
  }

  render() {
    const { model } = this.state;
    const {
      fields: { firstName, lastName, startDate, dob, dd1, dd2, dd3, sg1, sg2, sg3, phone },
    } = model;

    return (
      <div className={cf('form-group')}>
        <Form className={cf('form')} title="A Sample Form">
          <Field inline columns={6}>
            <Observer>
              {() => (
                <TextBox
                  label="First Name"
                  wide
                  placeholder="John"
                  required
                  value={firstName.value}
                  onBlur={() => firstName.markBlurredAndValidate()}
                  onChange={args => firstName.setValue(args.value)}
                  errorMessage={firstName.errorMessage}
                />
              )}
            </Observer>
          </Field>
          <Field inline columns={6} last>
            <Observer>
              {() => (
                <TextBox
                  label="Last Name"
                  wide
                  required
                  placeholder="Doe"
                  value={lastName.value}
                  onBlur={() => lastName.markBlurredAndValidate()}
                  onChange={args => (lastName.value = args.value)}
                  errorMessage={lastName.errorMessage}
                />
              )}
            </Observer>
          </Field>
          <Field inline columns={6}>
            <Observer>
              {() => (
                <PhoneTextBox
                  label="Phone"
                  wide
                  required
                  onBlur={() => phone.markBlurredAndValidate()}
                  value={phone.value}
                  onChange={({ value }) => phone.setValue(value)}
                  errorMessage={phone.errorMessage}
                />
              )}
            </Observer>
          </Field>
          <Field inline columns={6} last>
            <Observer>
              {() => (
                <DateSelector
                  label="Start date"
                  wide
                  required
                  value={startDate.value}
                  onBlur={() => startDate.markBlurredAndValidate()}
                  onChange={value => startDate.setValue(value)}
                  errorMessage={startDate.errorMessage}
                />
              )}
            </Observer>
          </Field>
          <Field inline columns={6}>
            <Observer>
              {() => (
                <Dropdown
                  items={data}
                  wide
                  required
                  placeholder="Select one"
                  label="Multiple"
                  selectedValue={dd3.value}
                  multiple
                  onChange={args => dd3.setValue(args.ids)}
                />
              )}
            </Observer>
          </Field>
          <Field inline columns={6} last>
            <Observer>
              {() => <Dropdown items={data} wide placeholder="Select one" label="Items" selectedValue={dd1.value} onChange={args => dd1.setValue(args.id)} />}
            </Observer>
          </Field>
          <Field inline columns={6}>
            <Observer>
              {() => (
                <Dropdown items={data} wide placeholder="Select one" label="Other label" selectedValue={dd2.value} onChange={args => dd2.setValue(args.id)} />
              )}
            </Observer>
          </Field>
          <Field inline columns={6} last>
            <Observer>
              {() => (
                <TextBox
                  wide
                  mask={dateMask}
                  label="Date of birth"
                  placeholder="MM/DD/YYYY"
                  errorMessage={dob.errorMessage}
                  value={dob.value}
                  onBlur={() => dob.markBlurredAndValidate()}
                  onChange={({ value }) => dob.setValue(value)}
                />
              )}
            </Observer>
          </Field>
          <Field>
            <Observer>
              {() => (
                <SelectionGroup
                  label="Please select at least one option"
                  items={data}
                  required
                  multiple
                  columns={2}
                  selectedValue={sg1.value}
                  errorMessage={sg1.errorMessage}
                  onChange={args => sg1.setValue(args.ids)}
                />
              )}
            </Observer>
          </Field>
          <Field>
            <Observer>
              {() => <SelectionGroup label="Values" items={nested} multiple columns={2} selectedValue={sg2.value} onChange={args => sg2.setValue(args.ids)} />}
            </Observer>
          </Field>
          <Field>
            <Observer>
              {() => <SelectionGroup label="Data" items={data} columns={2} selectedValue={sg3.value} onChange={args => sg3.setValue(args.id)} />}
            </Observer>
          </Field>
          <FormActions>
            <Observer>
              {() => <Button label="Register" onClick={() => model.validate()} disabled={!model.valid || !model.interacted || !model.requiredAreFilled} />}
            </Observer>
          </FormActions>
          <Observer>{() => !model.valid && <FormSummary title="Validation errors:" messages={model.summary} />}</Observer>
        </Form>
        <pre className={cf('json')}>
          <Observer>
            {() => (
              <code>
                {`required filled: ${model.requiredAreFilled}`}
                <br />
                {`Interacted: ${model.interacted}`}
                <br />
                {`Valid: ${model.valid}`}
                <br />
                {`Summary: ${JSON.stringify(model.summary, null, 2)}`}
                <br />
                {`Data: ${JSON.stringify(model.serializedData, null, 2)}`}
              </code>
            )}
          </Observer>
        </pre>
      </div>
    );
  }
}

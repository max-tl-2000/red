/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import generateId from 'helpers/generateId';
import { DemoSection, DemoPage, SubHeader } from '../DemoElements';
import DemoForm from './DemoForm';
import PrettyPrint from '../DemoElements/PrettyPrint';

export default class FormDemo extends Component {
  constructor(props, context) {
    super(props, context);
    this.id = generateId(this);
  }

  render() {
    return (
      <DemoPage title="Form">
        <DemoSection title="Form example">
          <p className="p">A simple for example</p>
          <PrettyPrint className="javascript">
            {`
                   <Form className={ cf('form') } title="A Sample Form">
                     <Field inline columns={ 6 }>
                       <TextBox label="First Name"
                                wide
                                value={ firstName.value }
                                onBlur={ () => firstName.markBlurredAndValidate() }
                                onChange={ (args) => (firstName.value = args.value) }
                                errorMessage={ firstName.errorMessage } />
                     </Field>
                     <Field inline columns={ 6 } last>
                       <TextBox label="Last Name"
                              wide
                              value={ lastName.value }
                              onBlur={ () => lastName.markBlurredAndValidate() }
                              onChange={ (args) => (lastName.value = args.value) }
                              errorMessage={ lastName.errorMessage } />
                     </Field>
                     <Field inline columns={ 6 }>
                       <PhoneTextBox wide label="Phone"
                                   wide
                                   onBlur={ () => phone.markBlurredAndValidate() }
                                   value={ phone.value }
                                   onChange={ ({ value }) => (phone.value = value) }
                                   errorMessage={ phone.errorMessage } />
                     </Field>
                     <Field inline columns={ 6 } last>
                       <DateSelector label="Start date"
                              wide
                              value={ startDate.value }
                              onBlur={ () => startDate.markBlurredAndValidate() }
                              onChange={ value => startDate.setValue(value) }
                              errorMessage={ startDate.errorMessage } />
                     </Field>
                     <Field inline columns={ 6 } >
                       <Dropdown items={ data }
                               wide
                               placeholder="Select one"
                               label="Multiple"
                               selectedValue={ dd3.value }
                               multiple
                               onChange={ (args) => (dd3.value = args.ids) } />
                     </Field>
                     <Field inline columns={ 6 } last>
                       <Dropdown items={ data }
                                 wide
                                 placeholder="Select one"
                                 label="Items"
                                 selectedValue={ dd1.value }
                                 onChange={ (args) => (dd1.value = args.id) } />
                     </Field>
                     <Field inline columns={ 6 } >
                       <Dropdown items={ data }
                               wide
                               placeholder="Select one"
                               label="Other label"
                               selectedValue={ dd2.value }
                               onChange={ (args) => (dd2.value = args.id) } />
                     </Field>
                     <Field inline columns={ 6 } last>
                       <TextBox wide
                               mask={ '09/09/9999' }
                               label="Date of birth"
                               placeholder="MM/DD/YYYY"
                               errorMessage={ dob.errorMessage }
                               value={ dob.value }
                               onBlur={ () => dob.markBlurredAndValidate() }
                               onChange={ ({ value }) => (dob.value = value) } />
                     </Field>
                     <Field>
                       <SelectionGroup label="Please select at least one option"
                                     items={ data }
                                     multiple
                                     columns={ 2 }
                                     selectedValue={ sg1.value }
                                     errorMessage={ sg1.errorMessage }
                                     onChange={ (args) => (sg1.value = args.ids) } />
                     </Field>
                     <Field>
                       <SelectionGroup label="Please select at least one option"
                                     items={ nested }
                                     multiple
                                     columns={ 2 }
                                     selectedValue={ sg2.value }
                                     onChange={ (args) => (sg2.value = args.ids) } />
                     </Field>
                     <Field>
                        <SelectionGroup label="Please select one"
                                     items={ data }
                                     columns={ 2 }
                                     selectedValue={ sg3.value }
                                     onChange={ (args) => (sg3.value = args.id) } />
                     </Field>
                     <FormActions>
                       <Button label="Register" onClick={ () => model.validate() } disabled={ !model.valid || !model.interacted } />
                     </FormActions>
                     { (!model.valid) && <FormSummary title="Validation errors:" messages={ model.summary } /> }
                   </Form>
                `}
          </PrettyPrint>
          <SubHeader>Result</SubHeader>
          <DemoForm />
        </DemoSection>
      </DemoPage>
    );
  }
}

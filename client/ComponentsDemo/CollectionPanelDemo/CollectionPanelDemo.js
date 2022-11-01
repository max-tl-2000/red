/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { t } from 'i18next';
import CollectionPanel from 'custom-components/CollectionPanel/CollectionPanel';
import { DemoSection, DemoPage, SubHeader, PrettyPrint, MDBlock, PropertiesTable } from '../DemoElements';
import DemoCollectionViewModel from './DemoCollectionViewModel';
import DemoForm from './Demo/DemoForm';
import { createDemoFormModel } from './Demo/DemoFormModel';
import DemoCard from './Demo/DemoCard';

const items = [
  { id: 1, firstName: 'Scooby', lastName: 'dias' },
  { id: 2, firstName: 'Argos', lastName: 'buon' },
  { id: 3, firstName: 'Garfield', lastName: 'day' },
  { id: 4, firstName: 'Grumpy cat', lastName: 'bon' },
  { id: 5, firstName: 'Hannibal', lastName: 'giorno' },
];

const properties = [
  ['entityName', 'string', '', 'set the name of the form'],
  ['FormComponent', 'component', '', 'set the form component which will be use to add and edit items.'],
  ['EntityComponent', 'component', '', 'set the entity component which will be use render each item of the list'],
  [
    'contextMenuActions',
    'object array',
    '',
    'set the list of menu options. Each menu action requires an **action name**, a **label**, a **handler** function (with access to the selected item) and a **divider** (which is a boolean)',
  ],
  [
    'contextMenuDefaults',
    'bool',
    'false',
    'if set to true the component will display 2 options **Edit** and **Remove** which will be handled by the collectionViewModel',
  ],
  [
    'collectionViewModel',
    'class viewmodel',
    '',
    'this class will implement the **CRUD** operations and items will be showed at the top of the Form. Also it requires a viewmodel.',
  ],
  [
    'createFormModel',
    'Function',
    '',
    `
   the object need to implement the following interface \`IFormModel\`
   \`\`\`
   interface IFormModel {
     initialState: Object, // state for each field defined on the model.
     validators: Object // set the validators for the fields defined on the model.
   }
   \`\`\`
   `,
  ],
  ['useRevealingPanel', 'bool (optional)', 'false', 'if set to true the component will display the form component as the Revealing panel'],
  ['lblBtnAdd', 'string (optional)', 'Add {entityName}', 'set the text for the **Add button**'],
  ['lblBtnEdit', 'string (optional)', 'Edit {entityName}', 'set the text for the **Edit button** and **Edit dialog title**'],
  ['lblBtnRemove', 'string (optional)', 'Remove {entityName}', 'set the text for the **Remove dialog button**'],
  ['lblBtnSave', 'string (optional)', 'Save', 'set the text for the **Save button**'],
  ['lblBtnCancel', 'string (optional)', 'Cancel', 'set the text for the **Cancel button**.'],
  ['noItemsLabel', 'string (optional)', 'No {entityName} were added', 'set the text for the **no items label**'],
  ['initialData', 'Object (optional)', '', 'Set the initial data for the form component.'],
  ['hideEditAction', 'bool (optional)', 'false', 'Set to **true** to hide the **Edit** action.'],
  ['hideRemoveAction', 'bool (optional)', 'false', 'Set to **true** to hide the **Remove** action.'],
];

@observer
export default class CollectionPanelDemo extends Component {
  constructor(props) {
    super(props);
    this.state = {
      viewModel: new DemoCollectionViewModel(items),
      viewModelReveal: new DemoCollectionViewModel(items),
    };
  }

  render() {
    const { viewModel } = this.state;
    const { viewModelReveal } = this.state;

    const contextMenuActions = [
      {
        action: 'moveToGuarantor',
        label: t('MOVE_TO_GUARANTOR'),
        handler: item => {
          console.log(`this function will display the firstname property: ${item.firstname}`);
        },
        divider: true,
      },
      {
        action: 'mergeWithOtherEntity',
        label: t('MERGE_WITH_OTHER_ENTITY'),
        handler: item => {
          console.log(`this function will display the lastname property: ${item.lastname}`);
        },
        divider: false,
      },
    ];

    return (
      <DemoPage title="CollectionPanel">
        <DemoSection title="What is the Collection Panel component?">
          <MDBlock>{`
                 A \`CollectionPanel\` component can be used to wrap other generic component.

                 The benefits from using it are:
                 - **TODO forms** can be implemented easily.
                 - The child component will manage its own logic (form validation) while parent component will handle the CRUD logic exposed by the child collection view model.
               `}</MDBlock>
          <PropertiesTable data={properties} />
          <SubHeader>CollectionPanel component</SubHeader>
          <PrettyPrint>
            {`
                  <CollectionPanel entityName="Demo item"
                                   FormComponent={ DemoForm }
                                   EntityComponent={ DemoCard }
                                   contextMenuActions={ contextMenuActions }
                                   contextMenuDefaults={ true }
                                   collectionViewModel={ viewModel }
                                   createFormModel={ createDemoFormModel }
                  />
                `}
          </PrettyPrint>

          <SubHeader>
            <MDBlock>{`
                  CollectionPanel component with optional properties:\`lblBtnAdd\`, \`lblBtnEdit\`, \`lblBtnRemove\`, \`lblBtnSave\`, \`useRevealingPanel\`, \`noItemsLabel\`
                  `}</MDBlock>
          </SubHeader>
          <PrettyPrint>
            {`
                  import { CollectionPanel } from 'components';
                  import DemoCollectionViewModel from './DemoCollectionViewModel';
                  import DemoForm from './Demo/DemoForm';
                  import { createDemoFormModel } from './Demo/DemoFormModel';
                  import DemoCard from './Demo/DemoCard';

                  const contextMenuActions = [{
                    action: 'moveToGuarantor',
                    label: t('MOVE_TO_GUARANTOR'),
                    handler: (item) => { console.log('this is just a demo function'); },
                    divider: true,
                  }, {
                    action: 'mergeWithOtherEntity',
                    label: t('MERGE_WITH_OTHER_ENTITY'),
                    handler: (item) => { console.log('this is just another demo function!!!'); },
                    divider: false,
                  }];

                  <CollectionPanel entityName="Demo item"
                                   FormComponent={ DemoForm }
                                   EntityComponent={ DemoCard }
                                   contextMenuActions={ contextMenuActions }
                                   contextMenuDefaults={ true }
                                   collectionViewModel={ viewModel }
                                   createFormModel={ createDemoFormModel }
                  />
                `}
          </PrettyPrint>

          <SubHeader>Result</SubHeader>
          <CollectionPanel
            entityName="Demo item"
            FormComponent={DemoForm}
            EntityComponent={DemoCard}
            contextMenuActions={contextMenuActions}
            contextMenuDefaults={true}
            collectionViewModel={viewModel}
            createFormModel={createDemoFormModel}
          />
        </DemoSection>
        <DemoSection>
          <SubHeader>Using the useRevealingPanel property</SubHeader>
          <PrettyPrint>
            {`
                 <CollectionPanel entityName="Demo item"
                                  FormComponent={ DemoForm }
                                  EntityComponent={ DemoCard }
                                  contextMenuActions={ contextMenuActions }
                                  contextMenuDefaults={ true }
                                  collectionViewModel={ viewModelReveal }
                                  createFormModel={ createDemoFormModel }
                                  useRevealingPanel={ true }
                                  lblBtnAdd="Add"
                                  lblBtnEdit="Edit"
                                  lblBtnSave="Done"
                                  noItemsLabel="There is no items in your list"
                  />
               `}
          </PrettyPrint>
          <SubHeader>
            <MDBlock>{`
                   CollectionPanel component using the properties: \`useRevealingPanel\`, \`lblBtnAdd\`, \`lblBtnEdit\`, \`lblBtnSave\`, \`noItemsLabel\`
                   `}</MDBlock>
          </SubHeader>
          <SubHeader>Result</SubHeader>
          <CollectionPanel
            entityName="Demo item"
            FormComponent={DemoForm}
            EntityComponent={DemoCard}
            contextMenuActions={contextMenuActions}
            contextMenuDefaults={true}
            collectionViewModel={viewModelReveal}
            createFormModel={createDemoFormModel}
            useRevealingPanel={true}
            lblBtnAdd="Add item"
            lblBtnEdit="Edit item"
            lblBtnSave="Done"
            noItemsLabel="There is no items in your list"
          />
        </DemoSection>
      </DemoPage>
    );
  }
}

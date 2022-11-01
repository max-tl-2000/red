/*
 * Copyright (c) 2022 Reva Technology Inc., all rights reserved.
 * Unauthorized copying of this file, via any medium is strictly prohibited
 * Licensed under the Elastic License 2.0; you may not use this file except
 * in compliance with the Elastic License 2.0.
 */

import React from 'react';
import { Chip } from 'components';
import { DemoPage, PropertiesTable, DemoSection, MDBlock, SubHeader, PrettyPrint } from '../DemoElements';

const api = [
  ['text', 'String', '', 'The content of the Chip'],
  ['deletable', 'Boolean', '', 'Whether the Chip can be removed or not'],
  ['userName', 'String', '', 'The userName we display in the Avatar part of the Chip'],
  ['onRemove', 'Function', '', 'An event that will fire whenever the close button is clicked'],
  ['selected', 'Boolean', '', 'Whether the Chip is selected or not'],
  ['error', 'Boolean', '', 'Whether the Chip has invalid value'],
];

const ChipDemo = () => (
  <DemoPage title="Chip">
    <PropertiesTable data={api} />
    <DemoSection title="Basic chip">
      <MDBlock>
        {`
        The basic chip is a simple text container
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-1" />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-1" />
    </DemoSection>
    <DemoSection title="Deletable chip">
      <MDBlock>
        {`
        The deletable chip has the close icon, and clicking it will call the \`onRemove\` method
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-2" deletable onRemove={ () => console.log('Removing chip') } />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-2" deletable onRemove={() => console.log('Removing chip')} />
    </DemoSection>
    <DemoSection title="Avatar chip">
      <MDBlock>
        {`
        This chip receives an \`userName\` prop and displays the corresponding avatar
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-3" userName="Tony Stark" />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-3" userName="Tony Stark" />
    </DemoSection>
    <DemoSection title="Avatar deletable chip">
      <MDBlock>
        {`
        This chip displays the corresponding avatar and is also removable
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-4" userName="Steven Rogers" deletable />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-4" userName="Steven Rogers" deletable />
    </DemoSection>
    <DemoSection title="Selected chip">
      <MDBlock>
        {`
        This chip displays the selected state of a chip
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-5" selected />
        <Chip text="Model unit-6" deletable selected />
        <Chip text="Model unit-7" userName="Thor Odinson" selected />
        <Chip text="Model unit-8" userName="Sam Wilson" deletable selected />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-5" selected />
      <Chip text="Model unit-6" deletable selected />
      <Chip text="Model unit-7" userName="Thor Odinson" selected />
      <Chip text="Model unit-8" userName="Sam Wilson" deletable selected />
    </DemoSection>
    <DemoSection title="Chip text truncation">
      <MDBlock>
        {`
        The chip have a maximum width set, and the text is trimmed in order to comply
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-9 with some very long text here, ellipsis should take care of this" deletable />
        <Chip text="Model unit-10 with some very long text here, ellipsis should take care of this" userName="Bruce Banner" />
        <Chip text="Model unit-11 with some very long text here, ellipsis should take care of this" userName="Clint Barton" deletable />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-9 with some very long text here, ellipsis should take care of this" deletable />
      <Chip text="Model unit-10 with some very long text here, ellipsis should take care of this" userName="Bruce Banner" />
      <Chip text="Model unit-11 with some very long text here, ellipsis should take care of this" username="Clint Barton" deletable />
    </DemoSection>
    <DemoSection title="Error chip">
      <MDBlock>
        {`
        The chip displays value with error
        `}
      </MDBlock>
      <PrettyPrint className="javascript">
        {`
        <Chip text="Model unit-12" error />
        <Chip text="Model unit-13" error deletable />
        `}
      </PrettyPrint>
      <SubHeader>Result</SubHeader>
      <Chip text="Model unit-12" error />
      <Chip text="Model unit-13" error deletable />
    </DemoSection>
  </DemoPage>
);

export default ChipDemo;

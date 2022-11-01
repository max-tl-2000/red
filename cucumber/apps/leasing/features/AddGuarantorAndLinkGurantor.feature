@AddGuarantorAndLinkToResident
Feature: Adding to Guarantor to party detail story: CPM-9351
In order to validate 'Application screening is on hold - Guarantor not linked' and 'Missing resident link' warning, and also 'Link resident' to Guarantor
As a Leasing Agent

Scenario: Add Guarantor and verify the alert of 'Guarantor not linked' and 'Missing resident link'
  Given User is in manage party for guest "Harold Smith"
  And Clicks on 'ADD GUARANTOR' button
  And User types "Johan Does" in field "#txtLegalName"
  And Clicks "btnAddEmail" button
  And User types preprocessed value "__testEmail(qatest+johandoes@reva.tech)" in field "#txtNewEmail"
  And Clicks "btnVerifyEmailAddress" button
  When Clicks "btnCreatePerson" button
  Then "Missing resident link" alert should appear below of guarantor name
  When The user close manage party
  And The user goes to 'Guarantors' section of the party details
  Then "Missing resident link" alert should appear below of guarantor name
  When The user goes to 'Applications and Quotes' section
  Then A hold warning with text "Application screening is on hold - Guarantor not linked Learn more" should be shown

# Link resident
  When User goes to manage party
  And Clicks on "Harold Smith" avatar
  And Clicks on 'Link guarantor' link
  And Clicks "selectGuarantor" dropdown
  And Select guarantor "Johan Does"
  And Clicks 'DONE' button
  And The user close manage party
  And The user goes to 'Applications and Quotes' section
  Then The user validates "Application screening is on hold - Guarantor not linked Learn more" is missing
  And The user goes to 'Guarantors' section of the party details
  Then The user validates 'Missing resident link' is missing

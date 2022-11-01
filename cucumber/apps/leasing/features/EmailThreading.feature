@EmailThreading
Feature: EmailThreading
         Cucumber tests to verify that emails appear in the correct threads.

Background:
  Given   'Login' page is opened
  When    User types his email "bill@reva.tech"
  And     Types his password "red&reva#"
  And     Clicks on 'SignIn' button
  Then    'Dashboard' page should be displayed
  When    Clicks "btnCreateParty" button
  And     Select "Walk-in" from first contact channel dropdown
  And     Clicks "submitAssignedProperty" button
  And     User types "John Doe" in field "#txtLegalName"
  Then    Clicks "btnAddEmail" button
  And     User types preprocessed value "__checkIfLocal(qatest+johndoe@reva.tech)" in field "#txtNewEmail"
  And     Clicks "btnVerifyEmailAddress" button
  And     Clicks "btnCreatePerson" button
  And     Select ButtonBar "#bedroomsBar" values to "FOUR_PLUS_BEDS"
  And     Check "Yes" to the combined monthly income question
  And     Select "1 - 2 months" from move in time dropdown
  And     Select "Employee" from lease type dropdown
  And     Clicks "btnSaveAndContinue" button
  And     Just wait for "2" seconds

@Ignore
Scenario: Reply appears in the same thread
  When    User clicks new email button
  Then    The email flyout should open
  When    User types in field "emailSubject" : "Test email threading"
  And     User types in field "emailBody" : "aaaaaaa"
  And     Clicks "sendEmail" button
  Then    The email with subject "Test email threading" is delivered to the guest
  Then    The communication section should contain "1" email threads
  And     The communication section should contain an email with the subject "Test email threading"
  When    The guest replies to the email with "reply text"
  Then    The communication section should contain "1" email threads
  And     The communication section should contain an email with the subject "reply to email (2)"

@Ignore
Scenario: New email appears in a new thread
  When    User clicks new email button
  Then    The email flyout should open
  When    User types in field "emailSubject" : "Test email threading"
  And     User types in field "emailBody" : "aaaaaaa"
  And     Clicks "sendEmail" button
  Then    The email with subject "Test email threading" is delivered to the guest
  Then    The communication section should contain "1" email threads
  And     The communication section should contain an email with the subject "Test email threading"
  When    The guest sends an email with subject "new message" and body "email body text"
  Then    The communication section should contain "2" email threads
  And     The communication section should contain an email with the subject "new message"

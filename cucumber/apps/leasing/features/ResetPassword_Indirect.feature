@ResetPassword_Indirect @Regression @Integration @Sanity @Smoke
Feature: Reset Password from Login page
    CPM-7: MVP - As an user I should be able to sign into an account

@Positive
Scenario: CPM-213: Login with wrong password N times
  Given User attempted to log in "6" times with incorrect password
  When   A alert message 'WE LOCKED YOUR ACCOUNT' is displayed
  And   User clicks on 'RESET MY PASSWORD' button
  Then  'I DON'T KNOW MY PASSWORD' card is shown expanded

@Positive @SkipTenantRefresh
Scenario: CPM-213: Verify if user is redirected to Login page just after click on Done button
  Given 'NeedHelp' page is opened
  When  User goes to 'I DON'T KNOW MY PASSWORD' card
  And   User types his email address "qatest+reset@reva.tech"
  And   Clicks on 'CONTINUE' button
  Then  A confirmation message EMAIL SENT should be displayed
  And   'Done' button appears on 'I DON'T KNOW MY PASSWORD' card
  When  User clicks on 'DONE' button
  Then  System should display the 'Login' page

@Positive @SkipTenantRefresh
Scenario: CPM-213: Validate wrong email address in question card "I don't know my password"
  Given 'NeedHelp' page is opened
  When  User goes to 'I DON'T KNOW MY PASSWORD' card
  And   User types his email address "invalid@.io"
  And   Clicks on 'CONTINUE' button
  Then  A validation message 'WRONG EMAIL' should be displayed

@Login @Regression @Integration @Sanity @Smoke
Feature: Sign In
         CPM-8: As an existing user, I should be able to sign into my account.
         The login management has to take care of forgot password, link in an invite email triggers the registration (this is for employees)

Background:
  Given   'Login' page is opened

@Positive @Core
Scenario: CPM-8: User logs in using valid credentials
  When   User types his email "bill@reva.tech"
  And    Types his password "red&reva#"
  And    Clicks on 'SignIn' button
  Then   'Dashboard' page should be displayed
  And    Clicks on 'Logout' button

@Positive @SkipTenantRefresh
Scenario: CPM-8: User logs in using invalid Email
  When   User types his email "wronguser@"
  And    Types his password "admin"
  And    Clicks on 'SignIn' button
  Then   Error 'INVALID_EMAIL' message should be displayed on 'Login' page

@Positive @SkipTenantRefresh
Scenario: CPM-8: User logs in using invalid password
  When   User types his email "admin@reva.tech"
  And    Types his password "YYYY"
  And    Clicks on 'SignIn' button
  Then   Error 'EMAIL_AND_PASSWORD_MISMATCH' message should be displayed

@Negative @SkipTenantRefresh
Scenario: CPM-172:  No validation message when login using an invalid account
          Result: A validation message should be displayed on screen and the user shouldn't able to do login
  When   User types his email "wronguser@reva.tech"
  And    Types his password "wrongpass"
  And    Clicks on 'SignIn' button
  Then   Error 'EMAIL_AND_PASSWORD_MISMATCH' message should be displayed

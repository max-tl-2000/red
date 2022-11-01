@Ignore @ResetPassword_direct @Regression @Integration @Sanity @Smoke @Positive
Feature: Reset Password from NeedHelp page
         CPM-7: MVP - As an user I should be able to sign into an account
         - User requests for a new password from NeedHelp option
         - User goes to check his email account to continue reset password
         - User complete reset password form
         - User validates his new password

@Positive
Scenario: CPM-10: Reset password request by Need Help option
  # User requests for a new password from NeedHelp option
  Given The "user1" already had received an invitation to the application to register its account using the following information:
  | email                     | pwd         | firstName | preferredName |
  | qatest+reset@reva.tech | qatestcrm+  |	qa        | test				  |
  And 'NeedHelp' page is opened
  When  User clicks on 'I DON'T KNOW MY PASSWORD' option
  And   User types his email address "qatest+reset@reva.tech"
  And   Clicks on 'CONTINUE' button
  Then  The system should display the following message 'EMAIL SENT'
  When  The user clicks on 'DONE' button
  Then  The system displays the 'Login' page
  # User goes to check his email account to continue reset password
  Given The user has been entered on in his gmail with a received 'RESET PASSWORD' link
  When  He clicked the 'RESET PASSWORD' link
  Then  The reset password page should be displayed
  # User complete reset password form
  When  User types his new password "test"
  And   Clicks on 'RESET MY PASSWORD' button
  Then  Dashboard page is displayed automatically
  # User validates his new password
  When  The user clicks on 'Logout' button
  Then  The system returns the 'Login' page
  When User enters his email and new password "test"
  And  Click on SIGN In button
  Then  Dashboard page is displayed

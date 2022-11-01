@ForceLogout @Regression @Integration @Sanity @Smoke
Feature: Force Logout
        CPM-9509 - Automatic logout while on prospect page does not redirect to login route
        This feature tests that when the users are force logout they are correctly sent back to the the login page

@Positive @Core
Scenario: CPM-9509 - Automatic logout while on prospect page does not redirect to login route
  Given The 'party prospect details' page is already opened with a guest "Paul Morgan":
  And   System forces users to logout
  Then  Log out is successful

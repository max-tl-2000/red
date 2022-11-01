@Redirect
Feature: Redirect after login
Cucumber test to check the user is redirected to the url that failed the auth check.

Background:
  Given   User logs out if needed

Scenario: Attempt to enter search
  Given   "Search" page is open
  And     'Login' page should be displayed
  And     User do login as "bill@reva.tech" and password "red&reva#"
  Then    page "Search" should be displayed

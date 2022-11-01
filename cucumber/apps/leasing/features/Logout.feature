@Logout @Regression @Integration @Sanity @Smoke
Feature: Sign out
        CPM-8: As an existing user, I should be able to sign out into my account.
        The login management has to take care of forgot password, link in an invite email triggers the registration (this is for employees)

@Positive @Core
Scenario: CPM-8: User log out the system
  Given  User is already logged in as a sales agent:
    | email                     | password  |
    | bill@reva.tech         | red&reva#     |
  And    'Dashboard' page should be displayed
  When   Clicks on 'Logout' button
  Then   Log out is successful

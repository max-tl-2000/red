@Availability
Feature: Availability

Scenario: User should be listed as available after logging in
  Given  User is already logged in as a sales agent:
    | email                     | password  |
    | bill@reva.tech         | red&reva#     |
  And    'Dashboard' page should be displayed
  Then    The 'Employee Card' for the logged in user should display the status "available"

@Positive @SkipTenantRefresh
Scenario: The avatar badge for availability should change when a user changes the availability
  When   User toggles the 'Availability' switch
  Then   The 'Employee Card' for the logged in user should display the status "not-available"

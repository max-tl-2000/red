@Ignore @ScheduleAppointment_Edit @Regression @Integration @Sanity @Smoke
Feature: Edit an existing appointment
         CPM-140: As a sales agent, I want to edit or remove an appointment

Background:
  Given   A 'party prospect details' page is opened with one appointment in it
  And     The appointment has no Units or Notes
  And     User clicked on 'Edit' button in the 'appointment' card

@TODO
Scenario: CPM-643: Edit appointment - Edit appointment dialog is displayed
  Given   The 'Edit appointment' dialog window should be displayed
  Then    'Edit appointment' dialog should contains the 'guest' chip
  And     The appointment day should be displayed in 'calendar'
  And     In 'calendar' the time slot for current appointment should be selected
  And     The logged in sales agent should be selected

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog filter and add units
  Given   The 'Edit appointment' dialog window should be displayed
  When    User types three letters in 'Units shorthand or address' field with match in db
  Then    The 'suggestions' window with matching units should be displayed
  And     The 'units' in 'suggestions' window should contain the input letters
  When    The user clicks on a 'unit' from 'suggestions' window
  Then    Selected 'unit' chip should be displayed in the 'Units shorthand or address' field
  When    Clicks on 'done' button in 'appointment' dialog
  Then    The 'appointment' card should contain the 'unit' chip

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog filter and add guest
  When    User types three letters in 'guests' field with match in db
  And     Clicks on a 'guest' from 'suggestions' window
  Then    Selected 'guest' chip should be displayed in the 'guests' field
  When    Clicks on 'done' button in appointment dialog
  Then    The 'appointment' card should contain the new guest

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog change time slot
  When    User Selects a new time slot
  And     Clicks on 'done' button in 'appointment' dialog
  Then    The 'appointment' card should contain the new time

@TODO
Scenario: CPM-643: Edit appointment - In Edit dialog add notes
  When    User types the text 'New meeting' in the Note field
  And     Clicks done button in appointment dialog
  Then    The appointment card should contain Note 'New meeting'

@TODO
Scenario: CPM-575: Edit appointment - Mark as complete of ongoing appointment
  Given   The Appointment started time has past
  When    User clicks drop down menu in 'Appointment' card
  And     Clicks on 'MARK AS COMPLETE' button
  Then    The appointment should be displayed fade out

@TODO
Scenario: CPM-575: Edit appointment - Mark as complete of future appointment
  Given   The Appointment started in future time
  When    User clicks drop down menu in 'Appointment' card
  Then    The on 'MARK AS COMPLETE' button should be displayed

# md_genfromsql.py
# 	script takes input of SQL file containing sequence of SQL instructions, and inserts them sequentially into MD files
#   Assumes that each complete SQL instruction is terminated by ";", and reads multiple lines until it finds a line termined as such
#
# Usage:
#   python md_genfromsql.py <input_sql_md_file.sql> <md_schema_name> <job_group> <job_name> <APPEND | REPLACE | DELETE> <job_sequence>
#   where
#       input_sql_md_file - input SQL file
#       md_schema_name - schema where METADATA tables are stored - this is assumed to be in one shared place for all RED instances
#			as of now, assumed d5f86cf0-4b7f-4a10-9d2b-f400ccecdbcf
#       job_group - insert instructions into specific job group to be processed with other groups of similar behavior
#           for example:  ETL instructions for creating new datamart objects should be in RESTARTMART
#       job_name - group collection of instructions into a specific job name (e.g. L4_LOAD)
#       <APPEND | REPLACE | DELETE>
#           - REPLACE (most common) - replace all instructions for a specific JOB with the new ones that are being processed
#           - APPEND -- concatenate these newly processed instructions ontop of existing metadata for like named JOBGROUP
#           - DELETE -- just remove instructions for certain job group, don't insert new ones
#
# NOTES:
#   - MD processor assumes that instructions, jobs and job groups will need to be run in a specific sequence order... but only automatically inserts sequence numbers
#      in for instructions - sequence numbers for jobs are specified in the parameters and job groups need to be manually manipulated in the metadata if special ordering is required
#   - TODO:  each time new metadata is inserted, "updated_at" attribute should be updated on md_job table -- not done yet
#   - TODO:  APPEND doesn't properly add sequence numbers that are after the existing instructons, just restarts from 1

import sys
import json
import psycopg2
import os

db_host = os.getenv('DATABASE_HOST', "coredb")
cloud_env = os.getenv('CLOUD_ENV', "dev")
core_db = 'reva_test' if (len(sys.argv) > 7 and sys.argv[7] == 'test') else 'reva_core'
mart_db = 'reva_mart_test' if (len(sys.argv) > 7 and sys.argv[7] == 'test') else os.getenv('DATABASE', "reva_mart")
core_user = 'revauser'
mart_user = 'revamartuser'
core_password = os.getenv('DATABASE_PASSWORD', "{your-default-database-password}")
mart_password = os.getenv('DATABASE_MARTPASSWORD', "{your-default-mart-database-password}")
host = 'localhost' if (len(sys.argv) > 7 and sys.argv[7] == 'test') else db_host + "." + cloud_env + ".env.reva.tech"

# make sure appopriate input / output parameters are passed in
if (len(sys.argv) != 7 and not (sys.argv[5].upper() == "APPEND" or sys.argv[5].upper() == "REPLACE" or sys.argv[5].upper() == "DELETE")):
  print("Usage: python md_genfromsql.py <input_sql_md_file.sql> <md_schema_name> <job_group> <job_name> <APPEND | REPLACE | DELETE> <job_sequence>")
  exit()

cmd_line = {"SQL_FILE": sys.argv[1], "MD_SCHEMA": sys.argv[
    2], "JOBGROUP": sys.argv[3], "JOBNAME": sys.argv[4], "OPERATOR": sys.argv[5], "JOBSEQUENCE": sys.argv[6]}

# connect to MD database
try:
  conn_string = "dbname='%s' user='%s' host='%s' password='%s'" % (core_db, core_user, host, core_password)
  conn = psycopg2.connect(conn_string)

except:
  print("Error Connecting to : psycopg2.connect(\"dbname='reva_core' user='xxx' host='coredb.dev.env.reva.tech' password='xxx'\")")
  exit()

# check to see if jobGroupName already exists - if it does, reuse id,
# otherwise add it
md_query = "SELECT \"id\" FROM \"%s\".\"%s\".\"md_jobGroup\" WHERE \"jobGroupName\"='%s'" % (
    core_db, cmd_line["MD_SCHEMA"], cmd_line["JOBGROUP"])
jobGroupId = "0"
try:
  cur = conn.cursor()
  cur.execute(md_query)
  # print "Running [%s]" % (md_query)

  jobRow = cur.fetchone()
  if not jobRow == None:
    jobGroupId = jobRow[0]

except psycopg2.Error as e:
  print("Error Connecting to Metadata: [%s] [%s-%s] " %
        (md_query, e.pgcode, e.pgerror))
  exit()

if jobGroupId == "0":
  md_query = "insert into \"%s\".\"%s\".\"md_jobGroup\" ( \"jobGroupName\") VALUES ('%s')" % (
      core_db, cmd_line["MD_SCHEMA"], cmd_line["JOBGROUP"])
  print("JobGroup not found - Running [%s]" % (md_query))
  try:
    cur.execute(md_query)
    conn.commit()
  except psycopg2.Error as e:
    print("Error Connecting to Metadata: [%s] [%s-%s] " %
          (md_query, e.pgcode, e.pgerror))
    exit()

  md_query = "SELECT \"id\" FROM \"%s\".\"%s\".\"md_jobGroup\" WHERE \"jobGroupName\"='%s'" % (
      core_db, cmd_line["MD_SCHEMA"], cmd_line["JOBGROUP"])
  try:
    cur.execute(md_query)

    print("Running [%s]" % (md_query))
    if cur != "None":
      jobRow = cur.fetchone()
      if not jobRow == None:
        jobGroupId = jobRow[0]
    else:
      print("jobName not found: [%s]" % (cmd_line["JOBNAME"]))

  except psycopg2.Error as e:
    print("Error Connecting to Metadata: [%s] [%s-%s] " %
          (md_query, e.pgcode, e.pgerror))
    exit()

# check to see if jobName already exists - if it does, reuse id
jobId = "0"
md_query = "SELECT \"id\" FROM \"%s\".\"%s\".\"md_job\" WHERE \"jobName\"='%s' AND \"jobGroupId\"=%s" % (
    core_db, cmd_line["MD_SCHEMA"], cmd_line["JOBNAME"], jobGroupId)

try:
  cur = conn.cursor()
  cur.execute(md_query)
  # print "Running [%s]" % (md_query)

  jobRow = cur.fetchone()
  if not jobRow == None:
    jobId = jobRow[0]

except psycopg2.Error as e:
  print("Error Connecting to Metadata: [%s] [%s-%s] " %
        (md_query, e.pgcode, e.pgerror))
  exit()

if jobId == "0":
  md_iquery = "insert into \"%s\".\"%s\".\"md_job\" (\"jobGroupId\", \"jobName\", \"sequenceNumber\") VALUES ( %s, '%s', %s)" % (
      core_db, cmd_line["MD_SCHEMA"], jobGroupId, cmd_line["JOBNAME"], cmd_line["JOBSEQUENCE"])
  print("Running [%s]" % (md_iquery))
  try:
    cur.execute(md_iquery)
    conn.commit()
  except psycopg2.Error as e:
    print("Error Connecting to Metadata: [%s] [%s-%s] " %
          (md_iquery, e.pgcode, e.pgerror))
    exit()

  try:
    cur.execute(md_query)

    "Running [%s]" % (md_query)
    if cur != "None":
      jobRow = cur.fetchone()
      if not jobRow == None:
        jobId = jobRow[0]
    else:
      print("jobName not found: [%s]" % (cmd_line["JOBNAME"]))

  except psycopg2.Error as e:
    print("Error Connecting to Metadata: [%s] [%s-%s] " %
          (md_query, e.pgcode, e.pgerror))
    exit()

if (cmd_line["OPERATOR"].upper() == "REPLACE" or cmd_line["OPERATOR"].upper() == "DELETE"):
  md_query = "delete from \"%s\".\"%s\".\"md_instruction\" where \"jobId\"=%s" % (
      core_db, cmd_line["MD_SCHEMA"], jobId)
  # print "Running [%s]" % (md_query)
  try:
    cur.execute(md_query)
    conn.commit()
    # print "Old MD for %s:%s removed" % (cmd_line["JOBGROUP"],
    # cmd_line["JOBNAME"])

  except psycopg2.Error as e:
    print("Error Connecting to Metadata: [%s] [%s-%s] " %
          (md_query, e.pgcode, e.pgerror))
    exit()

if (cmd_line["OPERATOR"].upper() != "DELETE"):
  oMdFile = open(sys.argv[1], "r")

  print("Processing %s" % (cmd_line["SQL_FILE"]))
  instruction = ""
  instruction_count = 0
  for inline in oMdFile:
    line = inline.rstrip()
    if line != "" and line.lstrip()[:2] != "/*":
      instruction += line
      if line[-1:] == ";":
        instruction_count += 1
        md_query = "insert into \"database\".\"{0}\".\"md_instruction\" (\"jobId\", \"sequenceNumber\", \"instruction\", \"instructionType\", \"isEnabled\") VALUES ( %s, %s, %s, %s, %s)".format(
            (cmd_line["MD_SCHEMA"]))

        try:
          md_query = md_query.replace("database", core_db)
          instruction = instruction.replace("${", "%{")
          instruction = instruction.replace("}$", "}%")

          cur.execute(md_query, (jobId, instruction_count,
                                 instruction, "SQL", "TRUE"))
        except psycopg2.Error as e:
          print(
              "Error Connecting to Metadata: [%s] [%s-%s] " % (md_query, e.pgcode, e.pgerror))
          exit()

        instruction = ""
      else:
        instruction += "\n"

  # if last instruction in file was not semi-colon terminated, then commit
  # it as well
  if (instruction != ""):
    # print "tacking on one last instruction [%s]" % (instruction)
    # raw_input("Waiting for acknowledgement....")

    instruction_count += 1
    try:
      instruction = instruction.replace("${", "%{")
      instruction = instruction.replace("}$", "}%")

      cur.execute(md_query, (jobId, instruction_count,
                             instruction, "SQL", "TRUE"))
    except psycopg2.Error as e:
      print(
          "Error Connecting to Metadata: [%s] [%s-%s] " % (md_query, e.pgcode, e.pgerror))
      exit()

  conn.commit()

  cmd_line = {"SQL_FILE": sys.argv[1], "MD_SCHEMA": sys.argv[
      2], "JOBGROUP": sys.argv[3], "JOBNAME": sys.argv[4], "OPERATOR": sys.argv[5]}
  print("SQL File %s Processed:" % (cmd_line["SQL_FILE"]))
  if (instruction_count > 0):
    print()
    print("\tAdded %i instructions for Job Group %s Job  %s" %
          (instruction_count, cmd_line["JOBGROUP"], cmd_line["JOBNAME"]))
  else:
    print("\tNo Metadata Instructions found in %s" % (cmd_line["SQL_FILE"]))

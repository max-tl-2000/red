# reddm_runjobgroup.py
#	reads encoded metadata for jobgroups and jobs, executes them to faciliate RED Datamart ETL.
#
# Usage:
#   "python reddm_runjobgroup.py <MD_schema> <src_tenant_name> <jobgroupname> [<jobname>]
#   where
#		MD_schema - location schema of MD tables, typically shared between many data mart tenants -- should be very few metadata table copies
#			As of today, assumed --> d5f86cf0-4b7f-4a10-9d2b-f400ccecdbcf
#		src_tenant_name - which of the tenant source systems are we processing -- tenant will be looked up in the md_tenantvariable table, and all of the
#			context variables will be processed from there.
#		jobgroupname - which job group are we processing (e.g. RESTARTMART or LOADMART)
#       jobname -- OPTIONALLY choose specific job to run (usually run all jobs with in a job group sequentially, but can just run one if we need to
#
# Intended Usage:
#   Presently, metadata is organized into 2 job groups:  RESTARTMART and LOADMART
#   	RESTARTMART is used to create a new datamart from scratch, or reset an existing one
#       LOADMART is to be used to incrementally reload data from the source system, and recalculate the associated star schema
#   - When new tenants need to be provisioned, we will want to have a script that creates the associated datamart schemas, sets the tenant variables to point
#   	at those new locations, and runs RESTARTMART for that tenant.
#   - On a nightly basis, we will want to run LOADMART for all tenants, to get them their latest information.   And for tenants that need data refreshes more frequently than that,
#     LOADMART could be run whenever needed.   Or, optionally, if only certain subset of the datamart needs to be refreshed more frequently, those tables can be specifically isolated
#     into their own job groups.

# NOTES:
#   - Metadata is processsed sequentially, as determined by JobGroup.SequenceNum, Job.SequenceNum, Instruction.SequenceNum
#		- However, only instruction.SequenceNum is automatically populated -- the other sequence numbers need to be manually set in the metadata
#   - TODO -- add processing for tenant groups;  presently only does processing on individual tenants at a time
#		This will be important for processing all tenants at the same time.
#   - TODO -- presently, only SQL instructions are supported.  Design is intended to support other InstructionTypes, including
#   	SCRIPT to run an external script for process
#  		JOB - to run another job within a job
# 		JOBGROUP -- to run another job group within a JOB
#

import sys
import json
import psycopg2
import datetime
import os

db_host = os.getenv('DATABASE_HOST', "coredb")
cloud_env = os.getenv('CLOUD_ENV', "dev")
core_db = 'reva_test' if (len(sys.argv) >= 5  and sys.argv[4] == 'test') else 'reva_core'
mart_db = 'reva_mart_test' if (len(sys.argv) >= 5 and sys.argv[4] == 'test') else os.getenv('DATABASE', "reva_mart")
core_user = 'revauser'
mart_user = 'revamartuser'
core_password = os.getenv('DATABASE_PASSWORD', "{your-default-database-password}")
mart_password = os.getenv('DATABASE_MARTPASSWORD', "{your-default-mart-database-password}")
host = 'localhost' if (len(sys.argv) >= 5  and sys.argv[4] == 'test') else db_host + "." + cloud_env + ".env.reva.tech"

def expand_tenantvar(tenant_vars, in_instruction):

  out_instruction = in_instruction
  for var in tenant_vars:
    # replace $( pattern variables, which is what DBAnalyzer uses
    out_instruction = out_instruction.replace(var, tenant_vars[var])
    # replace %( pattern variables, which is PSQL spec
    out_instruction = out_instruction.replace(
        "%{" + var + "}%", tenant_vars[var])

  return out_instruction


def millis_interval(start, end):
  """start and end are datetime instances"""
  diff = end - start
  millis = diff.days * 24 * 60 * 60 * 1000
  millis += diff.seconds * 1000
  millis += diff.microseconds / 1000
  return millis

# make sure appopriate input / output parameters are passed in
if len(sys.argv) < 4 or len(sys.argv) > 5:
  print(
      "Usage: python reddm_runjobgroup.py <MD_schema> <src_tenant_name> <jobgroupname> [<jobname>]")
  exit()

cmd_line = {"MD_SCHEMA": sys.argv[
    1], "SRC_TENANT": sys.argv[2], "JOBGROUP": sys.argv[3]}
if len(sys.argv) == 6:
  cmd_line["JOBNAME"] = sys.argv[5]
else:
  cmd_line["JOBNAME"] = None

# connect to data directionary for given MD schema
try:
  conn_string = "dbname='%s' user='%s' host='%s' password='%s'" % (core_db, core_user, host, core_password)
  md_conn = psycopg2.connect(conn_string)
  md_cur = md_conn.cursor()

except psycopg2.Error as e:
  print("Error Connecting to Metadata: [%s-%s] " % (e.pgcode, e.pgerror))
  exit()

# populate tenant context variable list for provide tenant
md_query = "SELECT \"name\", \"value\" FROM \"%s\".\"%s\".\"md_tenantVariable\"  WHERE \"tenantName\" = '%s' ;" % (
    core_db, cmd_line["MD_SCHEMA"], cmd_line["SRC_TENANT"])
try:
  md_cur.execute(md_query)

except psycopg2.Error as e:
  print("Error Connecting to Metadata: [%s] [%s-%s] " %
        (md_query, e.pgcode, e.pgerror))
  exit()

tenantvar = {}
for var in md_cur:
  tenantvar[var[0]] = var[1]

# for particular jobgroup, grab all of the instructions in order
md_lines = None
if cmd_line["JOBNAME"] != None:
  md_query = "select jg.\"jobGroupName\", jg.\"sequenceNumber\" as \"jobGroupSequence\", j.\"jobName\", j.\"sequenceNumber\" as \"jobSequence\", i.\"sequenceNumber\" as \"instSequence\", i.\"instruction\"  from \"database\".\"%s\".\"md_jobGroup\" jg, \"database\".\"%s\".\"md_job\" j, \"database\".\"%s\".\"md_instruction\" i WHERE i.\"jobId\"=j.\"id\" AND j.\"jobGroupId\"=jg.\"id\" AND jg.\"jobGroupName\"='%s' AND j.\"jobName\"='%s' ORDER BY 2,4,5;" % (cmd_line[
                                                                                                                                                                                                                                                                                                                                                                                                                                                                           "MD_SCHEMA"], cmd_line["MD_SCHEMA"], cmd_line["MD_SCHEMA"], cmd_line["JOBGROUP"], cmd_line["JOBNAME"])
else:
  md_query = "select jg.\"jobGroupName\", jg.\"sequenceNumber\" as \"jobGroupSequence\", j.\"jobName\", j.\"sequenceNumber\" as \"jobSequence\", i.\"sequenceNumber\" as \"instSequence\", i.\"instruction\"  from \"database\".\"%s\".\"md_jobGroup\" jg, \"database\".\"%s\".\"md_job\" j, \"database\".\"%s\".\"md_instruction\" i WHERE i.\"jobId\"=j.\"id\" AND j.\"jobGroupId\"=jg.\"id\" AND jg.\"jobGroupName\"='%s'ORDER BY 2,4,5;" % (cmd_line[
                                                                                                                                                                                                                                                                                                                                                                                                                                                   "MD_SCHEMA"], cmd_line["MD_SCHEMA"], cmd_line["MD_SCHEMA"], cmd_line["JOBGROUP"])

try:
  md_query = md_query.replace("database", core_db)
  md_cur.execute(md_query)
  md_lines = md_cur.fetchall()

except psycopg2.Error as e:
  print("Error Reading Instructions: [%s] [%s-%s] " %
        (md_query, e.pgcode, e.pgerror))
  exit()

err_count = 0
inst_count = 0
start_time = datetime.datetime.now()

md_conn.close()

# for all retrieved instructions, execute them
if not md_lines == None:
  try:
    conn_string = "dbname='%s' user='%s' host='%s' password='%s'" % (mart_db, mart_user, host, mart_password)
    md_conn_mart = psycopg2.connect(conn_string)
    md_cur_mart = md_conn_mart.cursor()

  except psycopg2.Error as e:
    print("Error Connecting to Mart: [%s-%s] " % (e.pgcode, e.pgerror))
    exit()

  print("Processing Tenant %s:" % (cmd_line["SRC_TENANT"]))
  for var in tenantvar:
    print("\t%s = %s" % (var, tenantvar[var]))

  for line in md_lines:
    instruction = line[5]

    exp_instruction = expand_tenantvar(tenantvar, instruction)
    err_code = None
    err_string = ""

    # for particular jobgroup, grab all of the instructions in order
    dt_sql_start = datetime.datetime.now()
    try:
      md_cur_mart.execute(exp_instruction)
      md_conn_mart.commit()

    except psycopg2.Error as e:
      err_code = e.pgcode
      err_string = e.pgerror.strip()
      md_conn_mart.rollback()

    dt_sql_end = datetime.datetime.now()

    log_instruction = exp_instruction.replace("\n", " ")
    duration_ms = millis_interval(dt_sql_start, dt_sql_end)
    print("Run [%s-%s-%i] [%s] [%s] %0ims %s Err: %s %s" % (line[0], line[2], line[4],
                                                            dt_sql_start, dt_sql_end, duration_ms, log_instruction[:80], err_code, err_string))
    if err_code != None:
      err_count += 1
      # raw_input("Error - Hit enter to continue")

    inst_count += 1

  print("Metadata Processed:")
  print("\tInstructions Executed: %i" % inst_count)
  print("\tErrors Encountered: %i" % err_count)
  duration_ms = millis_interval(start_time, datetime.datetime.now())
  print("\tTotal Duration: %i ms" % duration_ms)

else:
  print("No Metadata Found: [%s] [%s-%s] " % (md_query, e.pgcode, e.pgerror))

md_conn_mart.close()

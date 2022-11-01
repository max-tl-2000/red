#!/bin/sh

set -e

# move into red directory
cd "$(cd "$(dirname "$0")"; pwd)"

# Usage: python md_genfromsql.py <input_sql_md_file.sql> <md_schema_name> <job_group> <job_name> <APPEND | REPLACE | DELETE>
python md_genfromsql.py ../ETL_SQL_Source/L3_drop.sql analytics RESTARTMART L1_DROP replace 1 $1
python md_genfromsql.py ../ETL_SQL_Source/L3_DDL.sql analytics RESTARTMART L1_DDL replace 10 $1

# REDDM_L1_JDBC.PY:  Parses through data dictionary for specified RED schema, and generated 3 SQL output files to support normalized
# datamart integration.   L1 represents "Level 1 Normalized", which is just a historical copy of all of the operational data for a schema, mimicing
# the source system data model, identical -- but with a couple of datamart centric changes.
#
# Usage: python reddm_l1_jdbc.py <schema_name> <output_L1_DROP.sql> <output_L1_DDL.sql> <output_L1_LOAD.sql>
# Example: python reddm_l1_jdbc.py 6081d13f-85fb-436a-a5b6-53bd89ffeb42 L1_DROP.sql L1_DDL.sql L1_LOAD.sql
#
# It creates 3 output SQL files:
#    - L1_DROP.SQL -- the SQL used to drop all of the normalized tables - Only intended to be used to reload / restart datamart from scratch
#    - L1_DDL.SQL -- the SQL used to create anew all of the L1 Normalized tables - Only intended to be used to reload / restart datamart from scratch
#    - L1_LOAD.SQL -- use DB LINK to link back to source schema, potentially from another source - Intended to incrementally load data from source system
#
# NOTE:
#    - to do:  add support for detection of compound keys on source tables.... script assumes that the first column listed in the source table is usually the PK

import csv
import sys
import json
import psycopg2
import os

db_host = os.getenv('DATABASE_HOST', "coredb")
cloud_env = os.getenv('CLOUD_ENV', "dev")
core_db = 'reva_core'
mart_db = 'reva_mart'
core_user = 'revauser'
mart_user = 'revamartuser'
core_password = os.getenv('DATABASE_PASSWORD', "{your-default-database-password}")
mart_password = os.getenv('DATABASE_MARTPASSWORD', "{your-default-mart-database-password}")
host = db_host + "." + cloud_env + ".env.reva.tech"
# on the local env this will look like this: coredb.mircea.env.reva.tech
# for it to work add this line to /etc/hosts file on local machine
# 127.0.0.1 coredb.{ your CLOUD_ENV var }.env.reva.tech localhost


def find_inkey ( dm_table ):

	# look for the first column named either "id", "uuid", or "name"
	for column in dm_table:
		col_name = column['column_name']
		if col_name=="id" or col_name=="uuid" or col_name=="name":
			return col_name

	return ""

def make_outkeyname (table_name, inkey_name ):
	# for DM purposes, put key first -- and rename it to a distinct name
	entity_name = table_name.lower()
	if entity_name[-1:]=="s" and not entity_name[-2:]=="ss":
		entity_name = entity_name[:-1]
	if inkey_name=="name":
		outkey_name = entity_name+"Name"
	else:
		outkey_name = entity_name+"Id"

	return outkey_name

def gen_dropsql ( oDropFile, dm_table ):

	table_name = dm_table[0]['table_name']
	print("DROP TABLE \"${dstNormDB}$\".\"${dstNormSchema}$\".\"n_%s\";" % (table_name), file=oDropFile)

	return

def gen_ddlsql ( oDDLfile, dm_table, inkey_name ):

	table_name = dm_table[0]['table_name']
	print("CREATE TABLE \"${dstNormDB}$\".\"${dstNormSchema}$\".\"n_%s\" (" % (table_name), file=oDDLfile)

	# for DM purposes, put key first -- and rename it to a distinct name
	outkey_name = make_outkeyname(table_name, inkey_name)

	for column in dm_table:
		# derive output column name
		col_name = column['column_name']
		if col_name==inkey_name:
			col_name = outkey_name
			pk = "PRIMARY KEY"
		else:
			pk = ""

		# derive appropriate DDL type name
		type = column['udt_name']
		if type=="varchar":
			type = "varchar({})".format( column['character_maximum_length'] )

		if column['is_nullable']=='NO':
			nn = "NOT NULL"
		else:
			nn = ""

		# emit column details, unless is one of the special handled columns
		if column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\"%s\"\t%s\t%s %s," % (col_name, type, nn, pk), file=oDDLfile)

	# for DM purposes, put operation transaction timestamps at the end
	print("\t\"created_at\"	timestamptz,", file=oDDLfile)
	print("\t\"updated_at\"	timestamptz", file=oDDLfile)
	print(");\n", file=oDDLfile)

	return

def gen_loadsql ( oL1file, dm_table, inkey_name ):

	table_name = dm_table[0]['table_name']
	outkey_name=make_outkeyname(table_name, inkey_name)

	print("DROP TABLE IF EXISTS \"${tmpNormDB}$\".\"${tmpNormSchema}$\".\"t_%s\";" % (table_name), file=oL1file)
	print("CREATE TABLE \"${tmpNormDB}$\".\"${tmpNormSchema}$\".\"t_%s\" (" % (table_name), file=oL1file)

	for column in dm_table:
		# derive output column name
		col_name = column['column_name']
		if col_name==inkey_name:
			pk = "PRIMARY KEY"
		else:
			pk = ""

		# derive appropriate DDL type name
		type = column['udt_name']
		if type=="varchar":
			type = "varchar({})".format( column['character_maximum_length'] )

		if column['is_nullable']=='NO':
			nn = "NOT NULL"
		else:
			nn = ""

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\"%s\"\t%s\t%s\t%s, " % (col_name, type, nn, pk), file=oL1file)

	# for DM purposes, put operation transaction timestamps at the end
	print("\t\"created_at\"	timestamptz,", file=oL1file)
	print("\t\"updated_at\"	timestamptz", file=oL1file)
	print(");\n", file=oL1file)

	print("INSERT INTO \"${tmpNormDB}$\".\"${tmpNormSchema}$\".\"t_%s\" (" % (table_name), file=oL1file)
	for column in dm_table:

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\"%s\", " % (column['column_name']), file=oL1file)

	print("\t\"created_at\",", file=oL1file)
	print("\t\"updated_at\"", file=oL1file)
	print(")\n", file=oL1file)

	print("SELECT * FROM public.dblink('${srcDB}$',", file=oL1file)
	print("\t'SELECT", file=oL1file)
	for column in dm_table:

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\t\"%s\", " % (column['column_name']), file=oL1file)

	print("\t\t\"created_at\",", file=oL1file)
	print("\t\t\"updated_at\"", file=oL1file)
	print("", file=oL1file)
	print("\tFROM \"${srcDB}$\".\"${srcSchema}$\".\"%s\"" % (table_name), file=oL1file)
	print("\tWHERE \"updated_at\"> ''' ||  (select COALESCE(max(\"updated_at\"), '-infinity') FROM \"${dstNormDB}$\".\"${dstNormSchema}$\".\"n_%s\") || ''''" % (table_name), file=oL1file)

	print("\n) AS (", file=oL1file)

	for column in dm_table:

		# derive appropriate DDL type name
		type = column['udt_name']
		if type=="varchar":
			type = "varchar({})".format( column['character_maximum_length'] )

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\"%s\"\t%s, " % (column['column_name'], type), file=oL1file)

	# for DM purposes, put operation transaction timestamps at the end
	print("\t\"created_at\"	timestamptz,", file=oL1file)
	print("\t\"updated_at\"	timestamptz", file=oL1file)

	print(");\n", file=oL1file)

	print("INSERT INTO \"${dstNormDB}$\".\"${dstNormSchema}$\".\"n_%s\" (" % (table_name), file=oL1file)
	for column in dm_table:

		# derive output column name
		col_name = column['column_name']
		if col_name==inkey_name:
			col_name = outkey_name

		# emit column details, unless is one of the special handled columns
		if  col_name!="created_at" and col_name!="updated_at":
			print("\t\"%s\", " % (col_name), file=oL1file)

	print("\t\"created_at\",", file=oL1file)
	print("\t\"updated_at\"", file=oL1file)
	print(")", file=oL1file)

	print("SELECT	", file=oL1file)
	for column in dm_table:

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\"%s\", " % (column['column_name']), file=oL1file)

	print("\t\"created_at\",", file=oL1file)
	print("\t\"updated_at\"", file=oL1file)
	print("FROM \t\"${tmpNormDB}$\".\"${tmpNormSchema}$\".\"t_%s\"" % (table_name), file=oL1file)

	print("ON CONFLICT (\"%s\")" % (outkey_name), file=oL1file)
	print("\tDO UPDATE", file=oL1file)
	print("\tSET", file=oL1file)

	for column in dm_table:

		# emit column details, unless is one of the special handled columns
		if  column['column_name']!=inkey_name and column['column_name']!="created_at" and column['column_name']!="updated_at":
			print("\t\t\"%s\" = EXCLUDED.\"%s\"," % (column['column_name'], column['column_name']), file=oL1file)

	print("\t\t\"created_at\" = EXCLUDED.\"created_at\",", file=oL1file)
	print("\t\t\"updated_at\" = EXCLUDED.\"updated_at\"", file=oL1file)

	print(";", file=oL1file)


	return



# make sure appopriate input / output parameters are passed in
if len(sys.argv)!=5:
	print("Usage: python reddm_l1_jdbc.py <source_schema_name> <output_drop_n.sql> <output_ddl.sql> <output_L1_SQL.sql>")
	exit()

# connect to data directionary for given schema
try:
  conn_string = "dbname='%s' user='%s' host='%s' password='%s'" % (core_db, core_user, host, core_password)
  conn = psycopg2.connect(conn_string)

except:
	print("Error Connecting to : psycopg2.connect(\"dbname='reva_core' user='xxx' host='coredb.dev.env.reva.tech' password='xxx'\")")
	exit()

dd_query = "SELECT table_catalog, table_schema, table_name, column_name, ordinal_position, is_nullable, data_type, character_maximum_length, udt_name FROM information_schema.columns WHERE table_schema = '%s' order by 1,2,3,5;" % ( sys.argv[1] )

try:
	cur = conn.cursor()
	cur.execute(dd_query)
except:
	print("Error Connecting to Data Dictionary: [%s]" % (dd_queryy))
	exit()

print("Analyzing Data Directionary for reva_core schema: ", sys.argv[1])
reader = cur.fetchall()

oDropFile  = open(sys.argv[2], "w")
oDDLfile  = open(sys.argv[3], "w")
oL1file  = open(sys.argv[4], "w")

rownum = 0
tablerownum = 0
tablecount = 0
skipcount = 0
myrow = []
mytable = []

print("SELECT public.dblink_connect('${srcDB}$', 'dbname=${srcDB}$ port=5432 host=${srcServer}$ user=${srcUser}$ password=${srcPassword}$');\n", file=oL1file)

# Save header row, to extract metadata names later
header = [ "table_catalog",	"table_schema",	"table_name", "column_name", "ordinal_position", "is_nullable", "data_type", "character_maximum_length", "udt_name" ]

for row in reader:

	myrow = {header[0] : row[0], header[1] : row[1], header[2] : row[2], header[3]: row[3], header[4]: row[4], header[5]: row[5], header[6]: row[6], header[7]: row[7], header[8]: row[8]}

	if tablerownum==0 or myrow['table_name']==mytable[0]['table_name']:
		mytable.append(myrow)
		tablerownum += 1

	else:
		# we've run into the next table on the list...  mytable now contains all of the columns in the last table.
		inkey_name = find_inkey(mytable)

		# the following skip list are tables that don't follow the assumed operational table pattern for some reason
		# each of these are skipped, not loaded into L1 automatically -- and if they are important, must be added into the L1_DDL/LOAD_MANUAL.SQL for manual processing there
		# note -- support for tables with compound PK's will fix most of the remaining tables on this list.
		skiplist = ("knex_migrations", "knex_migrations_lock", "TeamProperties",  "Associated_Fee", "ResetTokens")
		if not mytable[0]['table_name'] in skiplist:
			gen_dropsql (oDropFile, mytable)
			gen_ddlsql (oDDLfile, mytable, inkey_name)
			gen_loadsql (oL1file, mytable, inkey_name)
		else:
			skipcount += 1

		# reset the table index for the next one
		mytable=[ myrow ]
		tablerownum = 1
		tablecount += 1

	rownum += 1

print("SELECT public.dblink_disconnect('${srcDB}$');\n", file=oL1file)

print("\tTables Read: %d" % (tablecount))
print("\tTables Skipped: %d" % (skipcount))
print("\tOutput files written:  %s %s %s" % (sys.argv[2], sys.argv[3], sys.argv[4]))

cur.close()
conn.close()

oDropFile.close()
oDDLfile.close()
oL1file.close()

import sqlite3,json,sys
con=sqlite3.connect(sys.argv[1]);con.row_factory=sqlite3.Row;con.execute('PRAGMA foreign_keys=ON')
q=json.load(sys.stdin)
def execute(item):
 before=con.total_changes;cur=con.execute(item['sql'],item.get('args',[]));rows=[dict(row) for row in cur.fetchall()]
 return {'results':rows,'meta':{'changes':con.total_changes-before}}
try:
 if isinstance(q,list):
  con.execute('BEGIN');result=[execute(item) for item in q]
 else:result=execute(q)
 con.commit();print(json.dumps(result))
except:con.rollback();raise
finally:con.close()

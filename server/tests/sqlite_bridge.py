import sqlite3,json,sys
con=sqlite3.connect(sys.argv[1]);con.row_factory=sqlite3.Row
q=json.load(sys.stdin)
try:
 before=con.total_changes
 cur=con.execute(q['sql'],q.get('args',[]))
 rows=[dict(row) for row in cur.fetchall()]
 con.commit()
 print(json.dumps({'results':rows,'meta':{'changes':con.total_changes-before}}))
finally:con.close()

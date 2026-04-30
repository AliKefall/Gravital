package db

import "database/sql"

func (q *Queries) RawDB() *sql.DB {
	db, _ := q.db.(*sql.DB)
	return db
}

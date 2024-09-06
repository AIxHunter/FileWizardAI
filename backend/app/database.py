import sqlite3


class SQLiteDB:
    def __init__(self):
        self.conn = sqlite3.connect('FileWizardAi.db')
        self.cursor = self.conn.cursor()
        create_table_query = "CREATE TABLE IF NOT EXISTS files_summary (file_path TEXT PRIMARY KEY,file_hash TEXT NOT NULL,summary TEXT)"
        self.cursor.execute(create_table_query)
        self.conn.commit()

    def select(self, table_name, where_clause=None):
        sql = f"SELECT * FROM {table_name}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        self.cursor.execute(sql)
        return self.cursor.fetchall()

    def is_file_exist(self, file_path, file_hash):
        self.cursor.execute("SELECT * FROM files_summary WHERE file_path = ? AND file_hash = ?", (file_path, file_hash))
        file = self.cursor.fetchone()
        return bool(file)

    def insert_file_summary(self, file_path, file_hash, summary):
        c = self.conn.cursor()
        c.execute("SELECT * FROM files_summary WHERE file_path=?", (file_path,))
        user_exists = c.fetchone()

        if user_exists:
            c.execute("UPDATE files_summary SET file_hash=?, summary=? WHERE file_path=?",
                      (file_hash, summary, file_path))
        else:
            c.execute("INSERT INTO files_summary (file_path, file_hash, summary) VALUES (?, ?, ?)",
                      (file_path, file_hash, summary))
        self.conn.commit()

    def get_file_summary(self, file_path):
        self.cursor.execute("SELECT summary FROM files_summary WHERE file_path = ?", (file_path,))
        result = self.cursor.fetchone()
        return result[0] if result else None

    def drop_table(self):
        self.cursor.execute("DROP TABLE IF EXISTS files_summary")
        self.conn.commit()

    def get_all_files(self):
        self.cursor.execute("SELECT file_path FROM files_summary")
        results = self.cursor.fetchall()
        files_path = [row[0] for row in results]
        return files_path

    def update_file(self, old_file_path, new_file_path, new_hash):
        self.cursor.execute("UPDATE files_summary SET file_path = ?, file_hash = ? WHERE file_path = ?",
                            (new_file_path, new_hash, old_file_path))
        self.conn.commit()

    def delete_records(self, file_paths):
        placeholders = ",".join("?" * len(file_paths))
        self.cursor.execute(f"DELETE FROM files_summary WHERE file_path IN ({placeholders})", file_paths)
        self.conn.commit()

    def close(self):
        self.conn.close()

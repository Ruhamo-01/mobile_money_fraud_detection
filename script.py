import sqlite3

connect = sqlite3.connect("mobile_money_users.db")
c = connect.cursor()

c.execute("UPDATE users SET account_balance = 50000 WHERE national_id = '1199980051622070'")
connect.commit()

print("Rows updated:", c.rowcount)

c.execute("SELECT id, full_name, national_id, account_balance FROM users")
print(c.fetchall())

connect.close()
# RiftZone Store

Node.js demo shop for accounts and game items.

## Run locally

```powershell
npm install
npm start
```

Open:

```txt
http://127.0.0.1:4173/
```

## Demo admin

```txt
Username: admin
Password: admin123
```

## Deploy

This project is ready for Node hosting such as Render or Railway.

Start command:

```txt
npm start
```

The server uses `process.env.PORT`, so cloud platforms can assign the port automatically.

## PostgreSQL storage

When `DATABASE_URL` is set, the app stores users, accounts, and items in PostgreSQL.
Without `DATABASE_URL`, it falls back to local JSON files in `data/`.

On Render:

1. Create a PostgreSQL database.
2. Copy the database internal connection string.
3. Add it to the web service environment variables as:

```txt
DATABASE_URL=postgresql://...
```

4. Redeploy the web service.

On first boot with PostgreSQL, the app creates tables automatically and seeds existing JSON data if the tables are empty.

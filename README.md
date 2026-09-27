# Friends Included finance system

This is a Vercel-ready finance system for the **Wedding Guests for Hire** homework. It keeps Supabase as the source of truth; Google Sheets is a readable copy. The website includes the requested five-person demonstration selector, transaction forms, manager controls, records, and the completed Test 1 + Test 2 figures.

## Publish it

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
2. Create a Google Sheet with `Sales` and `Expenses` tabs and share it with the service-account email as an Editor.
3. Import this folder into GitHub and connect it to Vercel.
4. In Vercel, add the variables from [`.env.example`](.env.example). Never put these values in browser code or GitHub.
5. Deploy. On the first load, click **Load completed test data** to add the supplied test records to Supabase.
6. Set Telegram's webhook to `https://YOUR-VERCEL-URL/api/telegram?secret=YOUR_WEBHOOK_SECRET`, then have each recipient start the bot once.

The website runs as a self-contained demo until Supabase variables are present. In deployed mode every write goes through the same server-side business rules, whether it came from the website or Telegram.

## Telegram formats

After `/start`, a linked employee can submit either command in a private chat:

```text
/sale S01|Olivia Rose|A|One proud uncle|1000|50|30|20
/expense E01|Rented suit|Materials|120|A
```

The manager links a Telegram user ID to a fictional employee in **Manager setup**. Telegram IDs never choose their own role.

## Important deployment notes

- The `SUPABASE_SERVICE_ROLE_KEY`, Google private key, and Telegram token are server-only environment variables.
- A sale remains pending until Svetlana approves it. An expense for A or B remains awaiting allocation until she decides. Overhead is allocated immediately.
- Sheet and notification outcomes are stored separately from finance decisions. Retrying an update uses the original reference and never creates another record.

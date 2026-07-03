# PetHub Ops

An internal operations tool for five pet-store branches to submit product orders by brand, and for a central admin to view, filter, export, and delete orders. Admins also upload daily inventory snapshots so branches can reference stock while ordering.

## Tech stack

- **Frontend:** React (Vite) + plain CSS
- **Backend / Database:** Supabase (Postgres + Supabase client SDK)
- **Auth:** Custom username/password flow using Postgres RPC + `pgcrypto` bcrypt hashing
- **File parsing / export:** SheetJS (`xlsx`)

## Project structure

```
├── public/
├── src/
│   ├── components/             # Login, BranchDashboard, AdminDashboard, Toast, Modal
│   ├── contexts/               # AuthContext & SupabaseContext
│   ├── lib/                    # Constants & Supabase client factory
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   ├── schema.sql              # Tables, views, functions, RLS policies
│   └── seed.sql                # Initial branch + admin accounts
├── .env.example
└── README.md
```

## 1. Supabase setup

1. Create a new Supabase project.
2. Go to **SQL Editor → New query** and run `supabase/schema.sql`.
3. Run `supabase/seed.sql` to create the five branch accounts and the admin account.

> No Edge Functions or CLI installation is required. Login and password changes are handled by Postgres RPC functions.

### Default passwords

| Username     | Display name | Password    | Role   |
| ------------ | ------------ | ----------- | ------ |
| `admin`      | Admin        | `admin123`  | admin  |
| `zorge`      | Zorge        | `zorge123`  | branch |
| `nizami`     | Nizami       | `nizami123` | branch |
| `gencik`     | Gənclik      | `gencik123` | branch |
| `teze_bazar` | Təzə Bazar   | `teze123`   | branch |
| `malakan`    | Malakan      | `malakan123`| branch |

Change these immediately from the admin panel.

## 2. Frontend environment

```bash
cp .env.example .env
```

Fill in your Supabase URL and anon key:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Deploy to Netlify / Vercel

1. Push the repo to GitHub.
2. Import the repo on **Netlify** or **Vercel**.
3. Add the environment variables in the dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Build command: `npm run build`
5. Output directory: `dist`

No server-side runtime is needed — the frontend is a static React app that talks directly to Supabase.

## How custom auth works

1. The user submits username + password on the login page.
2. The `login` Postgres RPC verifies the password with `pgcrypto`’s `crypt()`.
3. On success it inserts a row into the `sessions` table and returns a session token (UUID) plus a safe user object.
4. The React app stores the token and sends it on every Supabase client request as `Authorization: Pethub <token>`.
5. Postgres RLS policies read that header via `current_setting('request.headers')::jsonb` and map it back to a user through the `sessions` table.

Password changes are handled by the `change_password` RPC, which verifies the caller is an admin and writes a freshly hashed value using `crypt(..., gen_salt('bf'))`.

## Inventory upload format

Upload `.xlsx`, `.xls`, or `.csv` with columns for:

- **Brand** (also accepts `Brend`)
- **Product** (also accepts `Məhsul`, `Mehsul`, `Item`)
- **Qty** (also accepts `Quantity`, `Say`, `Qalıq`, `Qaliq`, `Stock`, `Count`)

The upload fully replaces the `inventory` table with the new snapshot.

## Orders export

On the admin **Orders** tab, filters apply in real time. The **Export to Excel** button downloads the currently filtered rows with columns: Date, Branch, Brand, Order Text.

## Deleting orders

Admins can delete orders from the Orders tab. Deletion is a soft delete (`deleted_at = now()`), so data can be recovered directly from Postgres if needed.

## License

Internal use only.

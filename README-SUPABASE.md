# Static Portfolio (Supabase Edition)

A single-page portfolio that reads/writes data to Supabase (Auth + Database + Storage).  
Public visitors can view content; authenticated users can edit inline.

## Setup
1. Create a Supabase project.
2. Run `setup.sql` in the SQL editor (tables, RLS, policies).
3. Create a public Storage bucket called `project-images`.
4. Open `script.js` and set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

## Use
- Open `index.html` (via a static host or `npx serve`/VSCode Live Server).
- Click **Admin** → sign in with your Supabase email + password.
  - If the account doesn't exist, it will be created automatically.
- Edit hero/about text and projects; changes save to Supabase.
- Upload project images (stored in Supabase Storage) or paste an image URL.

## Notes
- This is client-only. For multi-user or role-based admin, create additional RLS policies.
- Consider restricting writes to specific users by checking `auth.uid()` in policies.
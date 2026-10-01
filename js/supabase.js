/* =========================================================
   BA PROJECT
   File: supabase.js

   Purpose:
   Creates the Supabase client used throughout the BA frontend.

   Used by:
   - auth.js
   - profile.js
   - edit-profile.js
   - Future BA frontend modules

   Security Notes:
   - This file contains ONLY the Supabase Publishable Key.
   - Never place the service_role key here.
   - Never place private API keys here.
   - Database security must be enforced with Supabase RLS.
========================================================= */


/* =========================
   SUPABASE CONFIGURATION
========================= */

const SUPABASE_URL =
    "https://grrrhfcnogtkbhivryki.supabase.co";


const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_X4YBNZi2SB6P9MF63WQl2A_wFaberYs";



/* =========================
   CHECK SUPABASE SDK
========================= */

/*
   The Supabase JavaScript library must be loaded
   in the HTML before this file.

   Example:

   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
   <script src="./js/supabase.js"></script>
*/

if (
    typeof window.supabase === "undefined"
) {

    throw new Error(
        "BA: Supabase SDK was not loaded."
    );

}



/* =========================
   CREATE SUPABASE CLIENT
========================= */

window.baSupabase =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );



/* =========================
   DEVELOPMENT CHECK
========================= */

/*
   Keep this simple message during development.

   Do NOT print:
   - user sessions
   - access tokens
   - passwords
   - secret API keys
   - private user data

   This log can be removed before production.
*/

console.log(
    "BA: Supabase client initialized."
);
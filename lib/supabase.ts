import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if(!url || !serviceKey){
    throw new Error ('Missing Supabase environment variables');
}

/**
 * Server-side Supabase client using the service-role key.
 * Never import this from a Client Component — the service key must stay on the server.
 */
export const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false }
});
// Configure as credenciais do projeto Supabase abaixo.
// Use somente a chave anon/public no navegador; nunca exponha a service_role.
const SUPABASE_URL = "hhttps://uodfmqddomlrwcupxhev.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZGZtcWRkb21scndjdXB4aGV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNTQ1MDgsImV4cCI6MjEwNjgzMDUwOH0.duALvVJLr5oSH6rCDpElu8QbDbREU5spI_5cfmatsJw";

let clientPromise;

export function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith("https://")
    && !SUPABASE_URL.includes("SEU-PROJETO")
    && SUPABASE_ANON_KEY.length > 20
    && !SUPABASE_ANON_KEY.includes("SUA_SUPABASE_ANON_KEY");
}

async function getClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Configure SUPABASE_URL e SUPABASE_ANON_KEY em supabaseClient.js.");
  }
  if (!clientPromise) {
    clientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch((error) => {
        clientPromise = undefined;
        throw new Error(`Não foi possível carregar o cliente Supabase: ${error.message}`);
      });
  }
  return clientPromise;
}

async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}

export async function listRows(table) {
  const client = await getClient();
  return unwrap(client.from(table).select("*").order("created_at", { ascending: false }));
}

export async function insertRow(table, values) {
  const client = await getClient();
  return unwrap(client.from(table).insert(values).select().single());
}

export async function updateRow(table, id, values) {
  const client = await getClient();
  return unwrap(client.from(table).update(values).eq("id", id).select().single());
}

export async function listVehicles() { return listRows("veiculos"); }
export async function addVehicle(values) { return insertRow("veiculos", values); }
export async function updateVehicle(id, values) { return updateRow("veiculos", id, values); }

export async function listDrivers() { return listRows("motoristas"); }
export async function addDriver(values) { return insertRow("motoristas", values); }
export async function updateDriver(id, values) { return updateRow("motoristas", id, values); }

export async function listMaintenance() { return listRows("manutencoes"); }
export async function addMaintenance(values) { return insertRow("manutencoes", values); }
export async function updateMaintenance(id, values) { return updateRow("manutencoes", id, values); }

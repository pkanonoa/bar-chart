import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: chartData, error: chartError } = await supabase.from('charts').select('*').limit(1);
  console.log('Chart keys:', chartData && chartData.length > 0 ? Object.keys(chartData[0]) : chartError || 'No charts');

  const { data: folderData, error: folderError } = await supabase.from('folders').select('*').limit(1);
  console.log('Folder keys:', folderData && folderData.length > 0 ? Object.keys(folderData[0]) : folderError || 'No folders');
}

main();

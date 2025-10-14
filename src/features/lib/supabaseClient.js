// Shim/bridge zodat bestaande imports als "../../lib/supabaseClient" blijven werken
// Plaats dit bestand op: src/features/lib/supabaseClient.js
// Zorg dat de 'echte' client bestaat op: src/lib/supabaseClient.js

export { supabase } from '../../lib/supabaseClient.js';

// Sommige codebases gebruiken per ongeluk een default export; vang dat hier op:
import { supabase as _supabase } from '../../lib/supabaseClient.js';
export default _supabase;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY en mobile/.env');
}

// Durante la exportación web estática no hay navegador ni almacenamiento.
const canPersist = Platform.OS !== 'web' || typeof window !== 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    storage: canPersist ? AsyncStorage : undefined,
    persistSession: canPersist,
    autoRefreshToken: canPersist,
    // En la web, el enlace del correo («entrar sin contraseña») trae la sesión en la dirección.
    detectSessionInUrl: Platform.OS === 'web' && typeof window !== 'undefined',
  },
});

export const MEDIA_BUCKET = 'media';
export const AVATAR_BUCKET = 'avatars';

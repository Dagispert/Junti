import { Send, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { useStore } from '@/data/store';
import { supabase } from '@/lib/supabase';
import { relative } from '@/lib/time';

import { Icon } from './icon';
import { Avatar } from './ui';

type Comentario = { id: string; user_id: string; text: string; created_at: string };

/**
 * Los comentarios de un minijuego (el karaoke, el cuento…): lo que piensa
 * cada uno cuando ya está terminado. Llegan al momento a los demás.
 */
export function ComentariosJuego({
  proposalId,
  colorTexto,
  colorSuave,
  colorFondo,
}: {
  proposalId: string;
  /** colores para encajar en la tarjeta de cada juego (por defecto, los del tema) */
  colorTexto?: string;
  colorSuave?: string;
  colorFondo?: string;
}) {
  const theme = useTheme();
  const { me, user } = useStore();
  const texto = colorTexto ?? theme.text;
  const suave = colorSuave ?? theme.textSecondary;
  const fondo = colorFondo ?? theme.soft;
  const [lista, setLista] = useState<Comentario[]>([]);
  const [borrador, setBorrador] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      supabase
        .from('juego_comentarios')
        .select('id, user_id, text, created_at')
        .eq('proposal_id', proposalId)
        .is('deleted_at', null)
        .order('created_at')
        .then(({ data }) => vivo && setLista((data ?? []) as Comentario[]));
    cargar();
    const canal = supabase
      .channel(`juego-comentarios-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'juego_comentarios',
          filter: `proposal_id=eq.${proposalId}`,
        },
        () => cargar(),
      )
      .subscribe();
    return () => {
      vivo = false;
      supabase.removeChannel(canal);
    };
  }, [proposalId]);

  const enviar = async () => {
    const t = borrador.trim();
    if (!t) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from('juego_comentarios')
      .insert({ proposal_id: proposalId, text: t.slice(0, 1000) })
      .select('id, user_id, text, created_at')
      .single();
    if (!error && data) {
      setLista((l) => (l.some((c) => c.id === data.id) ? l : [...l, data as Comentario]));
      setBorrador('');
    }
    setEnviando(false);
  };

  const borrar = async (id: string) => {
    setLista((l) => l.filter((c) => c.id !== id));
    await supabase
      .from('juego_comentarios')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
  };

  return (
    <View style={{ gap: 8 }}>
      {lista.map((c) => (
        <View key={c.id} style={styles.fila}>
          <Avatar userId={c.user_id} size={24} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: texto, fontSize: 14, lineHeight: 19 }}>
              <Text style={{ fontWeight: '700' }}>
                {c.user_id === me ? 'Tú' : user(c.user_id).name.split(' ')[0]}{' '}
              </Text>
              {c.text}
            </Text>
            <Text style={{ color: suave, fontSize: 11 }}>{relative(Date.parse(c.created_at))}</Text>
          </View>
          {c.user_id === me && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Borrar mi comentario"
              hitSlop={8}
              onPress={() => borrar(c.id)}>
              <Icon icon={Trash2} size={14} color={suave} />
            </Pressable>
          )}
        </View>
      ))}
      <View style={[styles.caja, { backgroundColor: fondo }]}>
        <TextInput
          value={borrador}
          onChangeText={setBorrador}
          placeholder={lista.length ? 'Añadir un comentario…' : '¿Qué os ha parecido?'}
          placeholderTextColor={suave}
          onSubmitEditing={enviar}
          returnKeyType="send"
          maxLength={1000}
          style={[styles.input, { color: texto }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar el comentario"
          disabled={enviando || !borrador.trim()}
          onPress={enviar}
          style={{ opacity: borrador.trim() ? 1 : 0.4, padding: 6 }}>
          <Icon icon={Send} size={18} color={texto} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  caja: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 40,
  },
  input: { flex: 1, fontSize: 15, paddingVertical: 8, outlineStyle: 'none' } as never,
});

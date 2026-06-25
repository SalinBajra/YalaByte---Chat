import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function toChatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Team member',
    email: user.email || ''
  };
}

export async function upsertChatProfile(user) {
  if (!supabase || !user?.id) return null;
  const { data, error } = await supabase
    .from('chat_profiles')
    .upsert({
      id: user.id,
      full_name: user.name,
      email: user.email.toLowerCase(),
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fetchTeamMessages() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('team_chat_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function createTeamMessage(body, user) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('team_chat_messages')
    .insert({
      body: body.trim(),
      author_id: user.id,
      author_name: user.name,
      author_email: user.email
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function subscribeTeamMessages(onMessage) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('team-chat-messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'team_chat_messages' },
      (payload) => onMessage(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchWebsiteChatConversations() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('website_chat_conversations')
    .select('*,messages:website_chat_messages(*)')
    .order('last_activity_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWebsiteChatReply(conversationId, body, user) {
  if (!supabase) return null;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('website_chat_messages')
    .insert({
      conversation_id: conversationId,
      author_type: 'team',
      author_id: user.id,
      author_name: user.name,
      author_email: user.email,
      body: body.trim(),
      created_at: now
    })
    .select()
    .single();
  if (error) throw error;

  const { error: updateError } = await supabase
    .from('website_chat_conversations')
    .update({
      status: 'pending',
      assigned_to: user.id,
      assigned_to_name: user.name,
      updated_at: now,
      last_activity_at: now
    })
    .eq('id', conversationId);
  if (updateError) throw updateError;
  return data;
}

export function subscribeWebsiteChats(onChange) {
  if (!supabase) return () => {};
  const channel = supabase
    .channel('website-chat-for-team-inbox')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'website_chat_conversations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'website_chat_messages' }, onChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

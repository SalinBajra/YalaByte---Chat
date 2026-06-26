import { useEffect, useMemo, useState } from 'react';
import {
  convertWebsiteChatToLead,
  createDirectMessage,
  createTeamMessage,
  createWebsiteChatReply,
  fetchChatProfiles,
  fetchDirectMessages,
  fetchTeamMessages,
  fetchWebsiteChatConversations,
  isSupabaseConfigured,
  subscribeChatProfiles,
  subscribeDirectMessages,
  subscribeTeamMessages,
  subscribeWebsiteChats,
  supabase,
  toChatUser,
  updateWebsiteChatConversation,
  upsertChatProfile
} from './supabase';

const ALLOWED_EMAIL_DOMAIN = 'yalabyte.com';
const SESSION_KEY = 'yalabyte-chat-session';
const ACCOUNTS_KEY = 'yalabyte-chat-accounts';
const TEAM_MESSAGES_KEY = 'yalabyte-chat-team-messages';
const defaultAssignmentOptions = ['Unassigned'];
const statuses = ['Open', 'Pending', 'Resolved'];
const channels = ['All', 'Website', 'Messenger', 'WhatsApp', 'Email'];

const seedConversations = [
  {
    id: 'conv-1004',
    customer: 'Aarav Sharma',
    company: 'Everest Retail',
    email: 'aarav@everestretail.com',
    phone: '+977 980-1122334',
    channel: 'Website',
    subject: 'Need ecommerce maintenance plan',
    status: 'Open',
    priority: 'High',
    assignee: 'Salin',
    lastSeen: '4 min ago',
    waitTime: '8m',
    source: 'Pricing page',
    location: 'Kathmandu, NP',
    labels: ['Sales lead', 'Website care'],
    revenue: 'Rs 85,000',
    sentiment: 'Warm',
    messages: [
      { id: 'm1', type: 'customer', author: 'Aarav Sharma', time: '10:28 AM', body: 'Hi, we need monthly website maintenance for our ecommerce site. Do you offer emergency support too?' },
      { id: 'm2', type: 'agent', author: 'Salin', time: '10:31 AM', body: 'Yes, we can cover updates, monitoring, small fixes, and urgent incident support. How many monthly changes do you usually need?' },
      { id: 'm3', type: 'customer', author: 'Aarav Sharma', time: '10:35 AM', body: 'Usually 8 to 12. We also need someone to check plugin updates and checkout errors.' }
    ],
    notes: [
      'Potential maintenance client. Ask about current stack and monthly traffic.',
      'Mention handoff from CRM once package is confirmed.'
    ],
    events: ['Visited pricing page twice', 'Opened chat from /services/website-maintenance']
  },
  {
    id: 'conv-1003',
    customer: 'Mina Gurung',
    company: 'Himal Dental Care',
    email: 'mina@himaldental.com',
    phone: '+977 981-4455667',
    channel: 'WhatsApp',
    subject: 'Appointment form is not sending email',
    status: 'Pending',
    priority: 'Medium',
    assignee: 'Anish',
    lastSeen: '21 min ago',
    waitTime: '34m',
    source: 'Client portal',
    location: 'Pokhara, NP',
    labels: ['Bug', 'Existing client'],
    revenue: 'Rs 18,000',
    sentiment: 'Neutral',
    messages: [
      { id: 'm1', type: 'customer', author: 'Mina Gurung', time: '9:42 AM', body: 'The website appointment form stopped sending email to reception. Patients say submission is successful though.' },
      { id: 'm2', type: 'agent', author: 'Anish', time: '9:51 AM', body: 'Thanks Mina. We are checking the mail logs and form settings now. I will update you shortly.' },
      { id: 'm3', type: 'note', author: 'Anish', time: '9:57 AM', body: 'Likely SMTP password expired. Need hosting panel access from client.' }
    ],
    notes: ['Ask for SMTP/hosting access if not in vault.', 'Keep pending until credentials arrive.'],
    events: ['Client created support ticket', 'SLA response met']
  },
  {
    id: 'conv-1002',
    customer: 'Nabin KC',
    company: 'Trailhouse Nepal',
    email: 'hello@trailhouse.com.np',
    phone: '+977 984-6677889',
    channel: 'Email',
    subject: 'Can you redesign our trekking package pages?',
    status: 'Open',
    priority: 'High',
    assignee: 'Unassigned',
    lastSeen: '1 hr ago',
    waitTime: '1h 12m',
    source: 'Inbound email',
    location: 'Lalitpur, NP',
    labels: ['New lead', 'Design'],
    revenue: 'Rs 120,000',
    sentiment: 'Warm',
    messages: [
      { id: 'm1', type: 'customer', author: 'Nabin KC', time: '8:55 AM', body: 'We want to redesign our trekking package pages before autumn bookings. Can your team help with UX and SEO?' },
      { id: 'm2', type: 'customer', author: 'Nabin KC', time: '9:07 AM', body: 'We can share references and current analytics if needed.' }
    ],
    notes: ['Good fit for CRM conversion. Assign owner and schedule discovery call.'],
    events: ['Email imported', 'No owner assigned']
  },
  {
    id: 'conv-1001',
    customer: 'Ritika Thapa',
    company: 'Studio R',
    email: 'ritika@studior.com',
    phone: '+977 986-1100220',
    channel: 'Messenger',
    subject: 'Invoice copy and payment confirmation',
    status: 'Resolved',
    priority: 'Low',
    assignee: 'Prabin',
    lastSeen: 'Yesterday',
    waitTime: 'Done',
    source: 'Facebook page',
    location: 'Bhaktapur, NP',
    labels: ['Finance', 'Invoice'],
    revenue: 'Rs 42,000',
    sentiment: 'Happy',
    messages: [
      { id: 'm1', type: 'customer', author: 'Ritika Thapa', time: 'Yesterday', body: 'Can you send the invoice copy again? I paid the remaining balance today.' },
      { id: 'm2', type: 'agent', author: 'Prabin', time: 'Yesterday', body: 'Received, thank you. I sent the invoice copy and marked it paid in finance.' }
    ],
    notes: ['Payment confirmed in finance app.'],
    events: ['Invoice shared', 'Conversation resolved']
  }
];

const quickReplies = [
  'Thanks for reaching out. I am checking this now and will update you shortly.',
  'Could you share your website URL and any screenshots that show the issue?',
  'That sounds like a good fit for our team. Can we schedule a quick discovery call?'
];

const seedTeamMessages = [];

const toneClass = {
  Open: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  Resolved: 'bg-slate-100 text-slate-600 border-slate-200',
  High: 'bg-rose-50 text-rose-700 border-rose-100',
  Medium: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  Low: 'bg-slate-100 text-slate-600 border-slate-200'
};

function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

function initials(name) {
  return (name || 'YB').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function isAllowedTeamEmail(email) {
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

function createId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fieldClass() {
  return 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-cyanbrand-500 focus:ring-4 focus:ring-cyanbrand-100';
}

function readLocalAccounts() {
  try {
    const accounts = JSON.parse(window.localStorage.getItem(ACCOUNTS_KEY) || '[]');
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

function readLocalSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function saveLocalSession(session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readLocalTeamMessages() {
  try {
    const messages = JSON.parse(window.localStorage.getItem(TEAM_MESSAGES_KEY) || 'null');
    return Array.isArray(messages) ? messages.filter((message) => !String(message.id || '').startsWith('team-')) : seedTeamMessages;
  } catch {
    return seedTeamMessages;
  }
}

function displayTime(value) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function relativeTime(value) {
  if (!value) return 'Now';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff) || diff < 60000) return 'Now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return 'Earlier';
}

function profileName(profile) {
  return profile?.full_name || profile?.name || profile?.email?.split('@')[0] || 'Team member';
}

function isOnlineProfile(profile) {
  if (!profile?.last_seen_at) return false;
  const lastSeen = new Date(profile.last_seen_at).getTime();
  return Number.isFinite(lastSeen) && Date.now() - lastSeen < 1000 * 60 * 2;
}

function mapWebsiteConversation(item) {
  const messages = [...(item.messages || [])].sort((left, right) => new Date(left.created_at) - new Date(right.created_at));
  return {
    id: `website-${item.id}`,
    dbId: item.id,
    sourceType: 'website-chat',
    customer: item.customer_name,
    company: item.customer_company || 'Website visitor',
    email: item.customer_email,
    phone: item.customer_phone || '',
    convertedLeadId: item.converted_lead_id || '',
    convertedAt: item.converted_at || '',
    endedAt: item.ended_at || '',
    endedBy: item.ended_by || '',
    endReason: item.end_reason || '',
    channel: 'Website',
    subject: item.subject || 'Website chat',
    status: item.status === 'resolved' ? 'Resolved' : item.status === 'pending' ? 'Pending' : 'Open',
    priority: item.priority === 'high' ? 'High' : item.priority === 'low' ? 'Low' : 'Medium',
    assignee: item.assigned_to_name || 'Unassigned',
    lastSeen: relativeTime(item.last_activity_at || item.updated_at || item.created_at),
    waitTime: relativeTime(item.created_at),
    source: item.source_path || 'Website chat',
    location: 'Website',
    labels: ['Website chat'],
    revenue: 'New inquiry',
    sentiment: 'New',
    messages: messages.map((message) => ({
      id: message.id,
      type: message.author_type === 'team' ? 'agent' : 'customer',
      author: message.author_name,
      time: displayTime(message.created_at),
      body: message.body
    })),
    notes: [
      'Client started this conversation from the website chat widget.',
      item.ended_at ? `Conversation ended by ${item.ended_by || 'team'} at ${displayTime(item.ended_at)}.` : '',
      item.converted_lead_id ? `Converted to CRM lead ${item.converted_lead_id}.` : 'Convert to CRM once the opportunity is qualified.'
    ].filter(Boolean),
    events: [`Source: ${item.source_path || 'Website'}`]
  };
}

function Icon({ name }) {
  const paths = {
    inbox: 'M4 5h16v10h-4l-2 4h-4l-2-4H4V5Z',
    chat: 'M5 6h14v9H9l-4 4V6Z',
    search: 'm20 20-4.2-4.2M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z',
    send: 'M4 12 20 5l-5 15-3-6-8-2Z',
    note: 'M6 4h10l2 2v14H6V4Zm10 0v4h4',
    clock: 'M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    user: 'M16 19a4 4 0 0 0-8 0m4-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    tag: 'M4 5h8l8 8-7 7-8-8V5Zm4 4h.01',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
    check: 'm5 13 4 4L19 7',
    filter: 'M4 6h16M7 12h10m-7 6h4',
    logout: 'M15 17l5-5-5-5m5 5H9m2 8H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6',
    people: 'M17 19a4 4 0 0 0-8 0m4-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm5 8a3.5 3.5 0 0 0-2.5-3.35M6.5 15.65A3.5 3.5 0 0 0 4 19',
    spark: 'M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3Zm6 11 1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1 1-2.6Z'
  };

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

function Brand({ compact = false, inverted = false }) {
  return (
    <div className="flex items-center gap-3">
      <img className={cx('rounded-xl object-cover shadow-sm', compact ? 'h-11 w-11' : 'h-10 w-10')} src="/favicon.png" alt="YalaByte" />
      {!compact ? (
        <div className="min-w-0">
          <p className={cx('truncate text-lg font-extrabold tracking-tight', inverted ? 'text-white' : 'text-ink')}>Yala<span className="text-cyanbrand-400">Byte</span></p>
          <p className={cx('text-[10px] font-bold uppercase tracking-[0.2em]', inverted ? 'text-slate-400' : 'text-slate-500')}>ChatByte</p>
        </div>
      ) : null}
    </div>
  );
}

function Sidebar({ activeView, setActiveView, currentUser, onSignOut }) {
  const nav = [
    ['Inbox', 'inbox'],
    ['Team Chat', 'people']
  ];

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-row items-center gap-2 border-b border-white/10 bg-navy-950 px-3 py-3 text-white lg:w-[104px] lg:flex-col lg:border-b-0 lg:border-r lg:px-3 lg:py-4">
      <div className="mr-auto lg:mx-0 lg:mb-5">
        <div className="hidden lg:block"><Brand compact inverted /></div>
        <div className="lg:hidden"><Brand inverted /></div>
      </div>
      <nav className="flex gap-1 lg:w-full lg:flex-col lg:gap-2">
        {nav.map(([label, icon]) => (
          <button
            key={label}
            className={cx(
              'flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-slate-400 transition hover:bg-white/10 hover:text-white lg:h-auto lg:w-full lg:flex-col lg:py-3',
              activeView === label && 'bg-cyanbrand-500 text-navy-950 shadow-lg shadow-cyanbrand-500/20 hover:bg-cyanbrand-400 hover:text-navy-950'
            )}
            onClick={() => setActiveView(label)}
            title={label}
            type="button"
          >
            <Icon name={icon} />
            <span className="hidden text-[10px] font-extrabold uppercase tracking-[0.08em] lg:block">{label === 'Team Chat' ? 'Team' : 'Inbox'}</span>
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:mt-auto lg:flex-col">
        <span className="hidden min-w-0 text-right lg:grid lg:h-11 lg:w-11 lg:place-items-center lg:rounded-xl lg:bg-white/10 lg:text-xs lg:font-extrabold lg:text-cyanbrand-400" title={currentUser?.email}>
          {initials(currentUser?.name)}
        </span>
        <button className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white" onClick={onSignOut} title="Sign out" type="button">
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}

function Metric({ label, value, icon }) {
  return (
    <div className="flex min-w-[132px] items-center gap-3 border-r border-slate-200 px-4 py-3 last:border-r-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-700">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="truncate text-lg font-extrabold tracking-tight text-ink">{value}</p>
      </div>
    </div>
  );
}

function ConversationList({ conversations, activeId, setActiveId }) {
  if (!conversations.length) {
    return (
      <div className="grid min-h-[320px] place-items-center p-6 text-center">
        <div className="max-w-[240px]">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-700">
            <Icon name="inbox" />
          </span>
          <p className="mt-4 font-extrabold text-ink">No conversations yet</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">New website chats will arrive here in realtime.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-y-auto">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          className={cx(
            'group block w-full border-b border-slate-100 px-4 py-4 text-left transition hover:bg-slate-50',
            activeId === conversation.id && 'bg-cyan-50/80 shadow-[inset_3px_0_0_#13c8de] hover:bg-cyan-50'
          )}
          onClick={() => setActiveId(conversation.id)}
          type="button"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-navy-950 text-xs font-extrabold text-cyanbrand-400 shadow-sm transition group-hover:scale-[1.02]">
              {initials(conversation.customer)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-extrabold text-ink">{conversation.customer}</span>
                <span className="shrink-0 text-xs font-semibold text-slate-400">{conversation.lastSeen}</span>
              </span>
              <span className="mt-1 block truncate text-sm font-semibold text-slate-700">{conversation.subject}</span>
              <span className="mt-1 block truncate text-xs font-semibold text-slate-400">{conversation.company} · {conversation.assignee}</span>
              <span className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600">{conversation.channel}</span>
                <span className={cx('rounded-full border px-2 py-1 text-[11px] font-bold', toneClass[conversation.status])}>{conversation.status}</span>
                <span className={cx('rounded-full border px-2 py-1 text-[11px] font-bold', toneClass[conversation.priority])}>{conversation.priority}</span>
              </span>
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function EmptyInbox({ setActiveView }) {
  return (
    <section className="flex min-h-0 flex-1 items-center justify-center bg-slate-50 px-6 py-10">
      <div className="max-w-md text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-navy-950 text-cyanbrand-400 shadow-card">
          <Icon name="spark" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">Ready for the first customer chat</h1>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          Website conversations will show here as soon as visitors start chatting. Your team can assign, reply, resolve, and convert qualified chats into CRM leads.
        </p>
        <button
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-navy-800"
          onClick={() => setActiveView('Team Chat')}
          type="button"
        >
          <Icon name="people" />
          Open team room
        </button>
      </div>
    </section>
  );
}

function LoginGate({ onUnlock }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    if (!isAllowedTeamEmail(normalizedEmail)) {
      setError('Access denied. Only @yalabyte.com team accounts can use ChatByte.');
      return;
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for the password.');
      return;
    }

    if (!supabase) {
      const accounts = readLocalAccounts();
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Add your name to create the account.');
          return;
        }
        if (accounts.some((account) => account.email === normalizedEmail)) {
          setError('This email already has a chat account.');
          return;
        }
        const account = { id: createId('user'), name: name.trim(), email: normalizedEmail, password };
        window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([account, ...accounts]));
        const session = { id: account.id, name: account.name, email: account.email };
        saveLocalSession(session);
        onUnlock(session);
        return;
      }

      const account = accounts.find((item) => item.email === normalizedEmail && item.password === password);
      if (!account) {
        setError('No matching chat account found.');
        return;
      }
      const session = { id: account.id, name: account.name, email: account.email };
      saveLocalSession(session);
      onUnlock(session);
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Add your name to create the account.');
          return;
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (signUpError) throw signUpError;
        if (data.session) onUnlock(toChatUser(data.user));
        else setMessage('Account created. Check your YalaByte inbox to confirm your email, then sign in.');
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });
      if (signInError) throw signInError;
      onUnlock(toChatUser(data.user));
    } catch (authError) {
      setError(authError.message || 'Unable to authenticate. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell min-h-screen px-5 py-8 text-white sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-white/10 bg-white shadow-soft lg:grid-cols-[1.05fr_0.95fr]">
          <section className="relative hidden overflow-hidden bg-navy-950 p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="relative">
              <Brand inverted />
              <p className="mt-16 inline-flex rounded-full border border-cyanbrand-500/25 bg-cyanbrand-500/10 px-3 py-1.5 text-xs font-bold text-cyanbrand-400">
                Private support workspace
              </p>
              <h1 className="mt-5 max-w-md text-4xl font-extrabold leading-tight tracking-tight text-white">Support, sales, and team chat in one calm inbox.</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">Restricted access for YalaByte team members. Customer conversations stay separate from internal team discussion.</p>
            </div>
            <div className="relative mt-12 grid gap-3">
              {['YalaByte email only', 'Shared team chat', 'Customer conversation inbox'].map((item) => (
                <div className="flex items-center gap-3 text-sm font-semibold text-slate-200" key={item}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyanbrand-500/15 text-xs text-cyanbrand-400">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </section>

          <form className="p-7 text-slate-950 sm:p-10" onSubmit={handleSubmit}>
            <div className="lg:hidden"><Brand /></div>
            <div className="mt-8 lg:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">Secure access</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use your company email to continue to the ChatByte workspace.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 rounded-md bg-slate-100 p-1">
              {['signin', 'signup'].map((item) => (
                <button
                  className={cx('rounded px-3 py-2 text-sm font-bold', mode === item ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500')}
                  key={item}
                  onClick={() => {
                    setMode(item);
                    setError('');
                    setMessage('');
                  }}
                  type="button"
                >
                  {item === 'signin' ? 'Sign in' : 'Create'}
                </button>
              ))}
            </div>
            {mode === 'signup' ? (
              <label className="mt-5 block text-sm font-semibold text-slate-900">
                Name
                <input className={fieldClass()} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
              </label>
            ) : null}
            <label className="mt-6 block text-sm font-semibold text-slate-900">
              YalaByte email
              <input
                autoComplete="email"
                autoFocus
                className={fieldClass()}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@yalabyte.com"
                type="email"
                value={email}
              />
            </label>
            <label className="mt-5 block text-sm font-semibold text-slate-900">
              Password
              <input
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className={fieldClass()}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            {error ? (
              <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3" role="alert">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-red-700">Access rejected</p>
                <p className="mt-1 text-sm font-medium leading-5 text-red-700">{error}</p>
              </div>
            ) : null}
            {message ? <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">{message}</p> : null}
            <button disabled={busy} className="mt-5 w-full rounded-lg bg-cyanbrand-500 px-4 py-3 text-sm font-bold text-navy-950 shadow-sm transition hover:-translate-y-0.5 hover:bg-cyanbrand-400 hover:shadow-md disabled:cursor-wait disabled:opacity-60">
              {busy ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
            <p className="mt-5 text-center text-xs leading-5 text-slate-400">Restricted to authorized <span className="font-bold text-slate-600">@yalabyte.com</span> accounts.</p>
          </form>
        </div>
      </div>
    </main>
  );
}

function Thread({ conversation, convertingLeadId, currentUser, onAssignToMe, onConvertLead, onPending, onResolve, onSend, onNote, draft, setDraft, mode, setMode }) {
  const canConvert = conversation.sourceType === 'website-chat' && !conversation.convertedLeadId;
  const assignedToCurrentUser = currentUser?.name && conversation.assignee === currentUser.name;
  const isResolved = conversation.status === 'Resolved';

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-navy-950 text-sm font-extrabold text-cyanbrand-400 shadow-sm">
              {initials(conversation.customer)}
            </span>
            <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-ink sm:text-xl">{conversation.subject}</h1>
              <span className={cx('rounded-full border px-2.5 py-1 text-xs font-extrabold', toneClass[conversation.status])}>{conversation.status}</span>
            </div>
              <p className="mt-1 text-sm font-semibold text-slate-600">{conversation.customer}</p>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{conversation.company} · {conversation.channel} · {conversation.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={cx(
                'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-extrabold transition',
                assignedToCurrentUser
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              )}
              onClick={onAssignToMe}
              type="button"
            >
              <Icon name="user" />
              {assignedToCurrentUser ? 'Assigned to me' : 'Assign to me'}
            </button>
            {conversation.sourceType === 'website-chat' ? (
              conversation.convertedLeadId ? (
                <span className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700">
                  CRM lead
                </span>
              ) : (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-950 px-3 text-xs font-extrabold text-white transition hover:bg-navy-800 disabled:cursor-wait disabled:opacity-60"
                  disabled={!canConvert || convertingLeadId === conversation.id}
                  onClick={() => onConvertLead(conversation)}
                  type="button"
                >
                  <Icon name="bolt" />
                  {convertingLeadId === conversation.id ? 'Converting' : 'Convert lead'}
                </button>
              )
            ) : null}
            <button
              className={cx(
                'grid h-10 w-10 place-items-center rounded-xl border transition',
                conversation.status === 'Pending'
                  ? 'border-amber-100 bg-amber-50 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
              onClick={onPending}
              title="Mark pending"
              type="button"
            >
              <Icon name="clock" />
            </button>
            <button
              className={cx(
                'grid h-10 w-10 place-items-center rounded-xl transition',
                conversation.status === 'Resolved'
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'bg-cyanbrand-500 text-navy-950 hover:bg-cyanbrand-400'
              )}
              onClick={onResolve}
              title={conversation.status === 'Resolved' ? 'Resolved' : 'Resolve'}
              type="button"
            >
              <Icon name="check" />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc,#eef6f9)] px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
        {conversation.messages.map((message) => (
          <div key={message.id} className={cx('flex', message.type === 'agent' && 'justify-end', message.type === 'note' && 'justify-center')}>
            <article
              className={cx(
                'max-w-[78%] rounded-2xl border px-4 py-3 shadow-sm',
                message.type === 'customer' && 'rounded-tl-md border-slate-200 bg-white text-slate-800',
                message.type === 'agent' && 'rounded-tr-md border-cyan-100 bg-cyan-50 text-ink',
                message.type === 'note' && 'max-w-[92%] border-amber-100 bg-amber-50 text-amber-900'
              )}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold">
                {message.type === 'note' ? <Icon name="note" /> : null}
                <span>{message.type === 'note' ? 'Internal note' : message.author}</span>
                <span className="font-semibold text-slate-400">{message.time}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6">{message.body}</p>
            </article>
          </div>
        ))}
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white p-4">
        {isResolved ? (
          <div className="mb-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            This chat is resolved and closed for the client. Reopen it from the status menu before replying again.
          </div>
        ) : null}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {['Reply', 'Note'].map((item) => (
              <button
                key={item}
                className={cx('rounded-lg px-3 py-1.5 text-xs font-extrabold transition', mode === item ? 'bg-white text-ink shadow-sm' : 'text-slate-500 hover:text-ink')}
                onClick={() => setMode(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button key={reply} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50" onClick={() => setDraft(reply)} type="button">
                {reply.split('.')[0]}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
          <textarea
            className="min-h-24 w-full resize-none border-0 text-sm leading-6 text-ink outline-none placeholder:text-slate-400"
            disabled={isResolved && mode === 'Reply'}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={isResolved && mode === 'Reply' ? 'Reopen this chat before replying...' : mode === 'Reply' ? 'Reply to the customer...' : 'Add an internal note...'}
            value={draft}
          />
          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500" title="Insert tag">
                <Icon name="tag" />
              </span>
              {mode === 'Reply' ? 'Customer will receive this message' : 'Only the team can see this note'}
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!draft.trim() || (isResolved && mode === 'Reply')}
              onClick={mode === 'Reply' ? onSend : onNote}
              type="button"
            >
              <Icon name="send" />
              Send
            </button>
          </div>
        </div>
      </footer>
    </section>
  );
}

function DetailPanel({ assignmentOptions, conversation, convertingLeadId, currentUser, onConvertLead, updateConversation }) {
  const assignedToCurrentUser = currentUser?.name && conversation.assignee === currentUser.name;

  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-slate-200 bg-white xl:flex xl:min-h-0 xl:flex-col">
      <div className="border-b border-slate-200 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-navy-950 text-sm font-extrabold text-cyanbrand-400">{initials(conversation.customer)}</span>
          <div className="min-w-0">
            <p className="truncate text-base font-extrabold text-ink">{conversation.customer}</p>
            <p className="truncate text-sm text-slate-500">{conversation.company}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Value</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{conversation.revenue}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">SLA</p>
            <p className="mt-1 text-sm font-extrabold text-ink">{conversation.waitTime}</p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Assignment</p>
          <button
            className={cx(
              'mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-extrabold transition',
              assignedToCurrentUser
                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            )}
            onClick={() => updateConversation(conversation.id, { assignee: currentUser?.name || conversation.assignee })}
            type="button"
          >
            <Icon name="user" />
            {assignedToCurrentUser ? 'Assigned to me' : 'Assign to me'}
          </button>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-ink"
            onChange={(event) => updateConversation(conversation.id, { assignee: event.target.value })}
            value={conversation.assignee}
          >
            {assignmentOptions.map((member) => <option key={member}>{member}</option>)}
          </select>
          <select
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-ink"
            onChange={(event) => updateConversation(conversation.id, { status: event.target.value })}
            value={conversation.status}
          >
            {statuses.map((status) => <option key={status}>{status}</option>)}
          </select>
        </section>

        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Contact</p>
          <div className="mt-2 space-y-2 text-sm">
            <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700">{conversation.email}</p>
            <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700">{conversation.phone || 'No phone added'}</p>
            <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700">{conversation.company || 'No company added'}</p>
            <p className="truncate rounded-xl bg-slate-50 px-3 py-2 font-semibold text-slate-700">{conversation.location}</p>
          </div>
        </section>

        {conversation.sourceType === 'website-chat' ? (
          <section>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">CRM</p>
            {conversation.convertedLeadId ? (
              <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                <p className="text-sm font-extrabold text-emerald-800">Converted lead</p>
                <p className="mt-1 truncate text-xs font-semibold text-emerald-700">{conversation.convertedLeadId}</p>
              </div>
            ) : (
              <button
                className="mt-2 w-full rounded-xl bg-navy-950 px-3 py-2.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-navy-800 disabled:cursor-wait disabled:opacity-60"
                disabled={convertingLeadId === conversation.id}
                onClick={() => onConvertLead(conversation)}
                type="button"
              >
                {convertingLeadId === conversation.id ? 'Converting...' : 'Convert to CRM lead'}
              </button>
            )}
            <p className="mt-2 text-xs leading-5 text-slate-500">Use this after the chat becomes a real opportunity.</p>
          </section>
        ) : null}

        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Labels</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {conversation.labels.map((label) => (
              <span key={label} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{label}</span>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Notes</p>
          <div className="mt-2 space-y-2">
            {conversation.notes.map((note) => (
              <p key={note} className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900">{note}</p>
            ))}
          </div>
        </section>

        <section>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Activity</p>
          <div className="mt-3 space-y-3">
            {conversation.events.map((event) => (
              <div key={event} className="flex gap-2 text-sm text-slate-600">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyanbrand-500" />
                <span>{event}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}

function TeamChat({
  currentUser,
  directMessages,
  draft,
  error,
  messages,
  onSend,
  selectedTeamChat,
  setDraft,
  setSelectedTeamChat,
  teamProfiles
}) {
  const selectedProfile = selectedTeamChat === 'room' ? null : teamProfiles.find((profile) => profile.id === selectedTeamChat);
  const visibleMessages = selectedProfile
    ? directMessages.filter((message) => (
        (message.sender_id === currentUser?.id && message.recipient_id === selectedProfile.id)
        || (message.sender_id === selectedProfile.id && message.recipient_id === currentUser?.id)
      ))
    : messages;
  const onlineCount = teamProfiles.filter(isOnlineProfile).length;
  const title = selectedProfile ? profileName(selectedProfile) : 'Team room';
  const subtitle = selectedProfile
    ? `${isOnlineProfile(selectedProfile) ? 'Online now' : `Last seen ${relativeTime(selectedProfile.last_seen_at)}`} · Private team chat`
    : 'Shared internal room for the whole YalaByte team';

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-white lg:flex-row">
      <aside className="flex h-[34vh] shrink-0 flex-col border-b border-slate-200 bg-white lg:h-auto lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-700">Internal team only</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight text-ink">Team chat</h1>
          <p className="mt-1 text-sm text-slate-500">Clients never see this area.</p>
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-bold text-slate-500">{onlineCount} online</span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-700">
              {isSupabaseConfigured ? 'Realtime' : 'Local demo'}
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <button
            className={cx(
              'mb-2 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50',
              selectedTeamChat === 'room' && 'bg-cyan-50 shadow-[inset_3px_0_0_#13c8de] hover:bg-cyan-50'
            )}
            onClick={() => setSelectedTeamChat('room')}
            type="button"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-950 text-xs font-extrabold text-cyanbrand-400">
              <Icon name="people" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-ink">Team room</span>
              <span className="block truncate text-xs font-semibold text-slate-500">Everyone internal</span>
            </span>
          </button>

          {teamProfiles.map((profile) => {
            const online = isOnlineProfile(profile);
            return (
              <button
                className={cx(
                  'flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50',
                  selectedTeamChat === profile.id && 'bg-cyan-50 shadow-[inset_3px_0_0_#13c8de] hover:bg-cyan-50'
                )}
                key={profile.id}
                onClick={() => setSelectedTeamChat(profile.id)}
                type="button"
              >
                <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy-950 text-xs font-extrabold text-cyanbrand-400">
                  {initials(profileName(profile))}
                  <span className={cx('absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white', online ? 'bg-emerald-500' : 'bg-slate-300')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-ink">{profileName(profile)}</span>
                  <span className="block truncate text-xs font-semibold text-slate-500">{online ? 'Online' : `Seen ${relativeTime(profile.last_seen_at)}`}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight text-ink">{title}</h1>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            {selectedProfile ? (
              <span className={cx('rounded-full border px-3 py-1.5 text-xs font-extrabold', isOnlineProfile(selectedProfile) ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500')}>
                {isOnlineProfile(selectedProfile) ? 'Online' : 'Offline'}
              </span>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fafc,#eef6f9)] px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-4xl space-y-4">
            {visibleMessages.length ? visibleMessages.map((message) => {
              const own = selectedProfile
                ? message.sender_id === currentUser?.id
                : message.author_id === currentUser?.id || message.author_email === currentUser?.email;
              const author = selectedProfile
                ? (own ? currentUser?.name : profileName(selectedProfile))
                : message.author_name;
              return (
                <div className={cx('flex', own && 'justify-end')} key={message.id}>
                  <article className={cx('max-w-[82%] rounded-2xl border px-4 py-3 shadow-sm', own ? 'border-cyan-100 bg-cyan-50 text-ink' : 'border-slate-200 bg-white text-slate-800')}>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold">
                      <span>{author}</span>
                      <span className="font-semibold text-slate-400">{displayTime(message.created_at)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">{message.body}</p>
                  </article>
                </div>
              );
            }) : (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-50 text-cyan-700">
                  <Icon name={selectedProfile ? 'chat' : 'people'} />
                </span>
                <p className="mt-4 font-extrabold text-ink">No messages yet</p>
                <p className="mt-1 text-sm text-slate-500">Start the conversation from the box below.</p>
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-white p-4">
          <div className="mx-auto max-w-4xl">
            {error ? <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p> : null}
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
              <textarea
                className="min-h-20 w-full resize-none border-0 text-sm leading-6 text-ink outline-none placeholder:text-slate-400"
                onChange={(event) => setDraft(event.target.value)}
                placeholder={selectedProfile ? `Message ${profileName(selectedProfile)}...` : 'Message the YalaByte team...'}
                value={draft}
              />
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-400">Signed in as {currentUser?.email}</p>
                <button
                  className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!draft.trim() || (selectedTeamChat !== 'room' && !selectedProfile)}
                  onClick={onSend}
                  type="button"
                >
                  <Icon name="send" />
                  Send
                </button>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}

export default function ChatApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeView, setActiveView] = useState('Inbox');
  const [conversations, setConversations] = useState([]);
  const [websiteConversations, setWebsiteConversations] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Open');
  const [channel, setChannel] = useState('All');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('Reply');
  const [teamMessages, setTeamMessages] = useState(readLocalTeamMessages);
  const [teamProfiles, setTeamProfiles] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [selectedTeamChat, setSelectedTeamChat] = useState('room');
  const [teamDraft, setTeamDraft] = useState('');
  const [teamChatError, setTeamChatError] = useState('');
  const [websiteChatError, setWebsiteChatError] = useState('');
  const [convertingLeadId, setConvertingLeadId] = useState('');

  useEffect(() => {
    if (!supabase) {
      setCurrentUser(readLocalSession());
      setAuthReady(true);
      return undefined;
    }

    const acceptSession = (session) => {
      const user = toChatUser(session?.user);
      if (user && !isAllowedTeamEmail(user.email)) {
        setCurrentUser(null);
        supabase.auth.signOut();
      } else {
        setCurrentUser(user);
      }
      setAuthReady(true);
    };

    supabase.auth.getSession().then(({ data }) => acceptSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => acceptSession(session));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return undefined;
    if (!supabase) {
      window.localStorage.setItem(TEAM_MESSAGES_KEY, JSON.stringify(teamMessages));
      return undefined;
    }

    let active = true;
    const refreshProfiles = () => {
      fetchChatProfiles()
        .then((profiles) => {
          if (active) setTeamProfiles(profiles.filter((profile) => profile.id !== currentUser.id));
        })
        .catch((error) => {
          if (active) setTeamChatError(`Team list could not load: ${error.message}`);
        });
    };

    upsertChatProfile(currentUser)
      .then(() => fetchTeamMessages())
      .then((messages) => {
        if (active) setTeamMessages(messages.length ? messages : seedTeamMessages);
      })
      .catch((error) => {
        if (active) setTeamChatError(`Team chat database needs setup: ${error.message}`);
      });

    refreshProfiles();
    fetchDirectMessages(currentUser.id)
      .then((messages) => {
        if (active) setDirectMessages(messages);
      })
      .catch((error) => {
        if (active) setTeamChatError(`Direct messages could not load: ${error.message}`);
      });

    const heartbeat = window.setInterval(() => {
      upsertChatProfile(currentUser).catch(() => {});
    }, 30000);

    const unsubscribeTeamMessages = subscribeTeamMessages((message) => {
      setTeamMessages((items) => (
        items.some((item) => item.id === message.id) ? items : [...items, message]
      ));
    });
    const unsubscribeProfiles = subscribeChatProfiles(refreshProfiles);
    const unsubscribeDirectMessages = subscribeDirectMessages(currentUser.id, (message) => {
      setDirectMessages((items) => (
        items.some((item) => item.id === message.id) ? items : [...items, message]
      ));
    });

    return () => {
      active = false;
      window.clearInterval(heartbeat);
      unsubscribeTeamMessages();
      unsubscribeProfiles();
      unsubscribeDirectMessages();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!supabase) window.localStorage.setItem(TEAM_MESSAGES_KEY, JSON.stringify(teamMessages));
  }, [teamMessages]);

  useEffect(() => {
    if (!currentUser || !supabase) {
      setWebsiteConversations([]);
      return undefined;
    }

    let active = true;
    const loadWebsiteChats = () => {
      fetchWebsiteChatConversations()
        .then((items) => {
          if (active) {
            setWebsiteConversations(items.map(mapWebsiteConversation));
            setWebsiteChatError('');
          }
        })
        .catch((error) => {
          if (active) setWebsiteChatError(`Website chats could not load: ${error.message}`);
        });
    };

    loadWebsiteChats();
    const unsubscribe = subscribeWebsiteChats(loadWebsiteChats);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentUser?.id]);

  const inboxConversations = useMemo(() => {
    const websiteIds = new Set(websiteConversations.map((conversation) => conversation.id));
    return [
      ...websiteConversations,
      ...conversations.filter((conversation) => !websiteIds.has(conversation.id))
    ];
  }, [conversations, websiteConversations]);

  const assignmentOptions = useMemo(() => {
    const names = [
      ...defaultAssignmentOptions,
      currentUser?.name,
      ...teamProfiles.map(profileName),
      ...inboxConversations.map((conversation) => conversation.assignee)
    ];
    return names.filter((name, index) => name && names.indexOf(name) === index);
  }, [currentUser?.name, inboxConversations, teamProfiles]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return inboxConversations.filter((conversation) => {
      const matchesStatus = status === 'All' || conversation.status === status;
      const matchesChannel = channel === 'All' || conversation.channel === channel;
      const text = `${conversation.customer} ${conversation.company} ${conversation.subject} ${conversation.email}`.toLowerCase();
      return matchesStatus && matchesChannel && (!search || text.includes(search));
    });
  }, [channel, inboxConversations, query, status]);

  const activeConversation = inboxConversations.find((conversation) => conversation.id === activeId) || filtered[0] || inboxConversations[0];

  function patchConversationInView(id, changes) {
    setConversations((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    setWebsiteConversations((items) => items.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }

  async function updateConversation(id, changes) {
    const conversation = inboxConversations.find((item) => item.id === id);
    if (!conversation) return;
    const previous = conversation;
    patchConversationInView(id, changes);

    if (conversation.sourceType !== 'website-chat' || !supabase) return;

    const payload = {};
    if (changes.status) payload.status = changes.status.toLowerCase();
    if (changes.assignee) payload.assigned_to_name = changes.assignee === 'Unassigned' ? '' : changes.assignee;

    try {
      await updateWebsiteChatConversation(conversation.dbId, payload, currentUser);
    } catch (error) {
      patchConversationInView(id, previous);
      setTeamChatError(`Conversation update was not saved: ${error.message}`);
    }
  }

  function resolveConversation() {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, { status: 'Resolved' });
  }

  function pendingConversation() {
    if (!activeConversation) return;
    updateConversation(activeConversation.id, { status: 'Pending' });
  }

  function assignActiveConversationToMe() {
    if (!activeConversation || !currentUser?.name) return;
    updateConversation(activeConversation.id, { assignee: currentUser.name });
  }

  async function convertConversationToLead(conversation) {
    if (!conversation?.dbId || conversation.convertedLeadId || !supabase) return;
    setConvertingLeadId(conversation.id);
    setWebsiteChatError('');
    try {
      const lead = await convertWebsiteChatToLead(conversation.dbId);
      const leadId = lead?.id || `lead-chat-${conversation.dbId}`;
      patchConversationInView(conversation.id, {
        convertedLeadId: leadId,
        convertedAt: new Date().toISOString(),
        labels: Array.from(new Set([...(conversation.labels || []), 'CRM lead'])),
        notes: Array.from(new Set([...(conversation.notes || []), `Converted to CRM lead ${leadId}.`]))
      });
    } catch (error) {
      setWebsiteChatError(`Lead conversion failed: ${error.message}`);
    } finally {
      setConvertingLeadId('');
    }
  }

  async function addMessage(type) {
    if (!draft.trim()) return;
    const body = draft.trim();
    if (type === 'agent' && activeConversation?.sourceType === 'website-chat' && supabase) {
      setDraft('');
      try {
        await createWebsiteChatReply(activeConversation.dbId, body, currentUser);
      } catch (error) {
        setTeamChatError(`Reply was not saved: ${error.message}`);
        setDraft(body);
      }
      return;
    }

    const message = {
      id: `m-${Date.now()}`,
      type,
      author: type === 'note' ? 'Team note' : 'YalaByte Team',
      time: 'Now',
      body
    };
    setConversations((items) => items.map((item) => (
      item.id === activeConversation.id
        ? { ...item, messages: [...item.messages, message], lastSeen: 'Now', status: type === 'agent' ? 'Pending' : item.status }
        : item
    )));
    setDraft('');
  }

  async function sendTeamMessage() {
    if (!teamDraft.trim() || !currentUser) return;
    const body = teamDraft.trim();
    setTeamDraft('');
    setTeamChatError('');
    const selectedProfile = selectedTeamChat === 'room'
      ? null
      : teamProfiles.find((profile) => profile.id === selectedTeamChat);

    if (!supabase) {
      setTeamMessages((items) => [
        ...items,
        {
          id: createId('team'),
          author_id: currentUser.id,
          author_name: currentUser.name,
          author_email: currentUser.email,
          body,
          created_at: new Date().toISOString()
        }
      ]);
      return;
    }

    try {
      if (selectedProfile) {
        const message = await createDirectMessage(body, currentUser, selectedProfile);
        setDirectMessages((items) => (
          items.some((item) => item.id === message.id) ? items : [...items, message]
        ));
        return;
      }

      const message = await createTeamMessage(body, currentUser);
      setTeamMessages((items) => (
        items.some((item) => item.id === message.id) ? items : [...items, message]
      ));
    } catch (error) {
      setTeamChatError(`Message was not saved: ${error.message}`);
      setTeamDraft(body);
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }

  const openCount = inboxConversations.filter((conversation) => conversation.status === 'Open').length;
  const pendingCount = inboxConversations.filter((conversation) => conversation.status === 'Pending').length;
  const unassignedCount = inboxConversations.filter((conversation) => conversation.assignee === 'Unassigned').length;

  if (!authReady) {
    return (
      <main className="login-shell flex min-h-screen items-center justify-center px-5 text-white">
        <div className="text-center">
          <Brand inverted />
          <p className="mt-6 text-sm font-semibold text-slate-300">Checking secure access...</p>
        </div>
      </main>
    );
  }

  if (!currentUser) {
    return <LoginGate onUnlock={setCurrentUser} />;
  }

  return (
    <main className="chat-shell flex min-h-screen flex-col text-ink lg:flex-row">
      <Sidebar activeView={activeView} currentUser={currentUser} onSignOut={signOut} setActiveView={setActiveView} />

      <section className="flex min-h-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-cyan-700">{activeView}</p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{activeView === 'Team Chat' ? 'Internal team chat' : 'Customer conversations'}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{activeView === 'Team Chat' ? 'Coordinate privately with the YalaByte team.' : 'Reply, assign, resolve, and convert website chats.'}</p>
            </div>
            <div className={cx('overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm', activeView === 'Team Chat' ? 'hidden lg:flex' : 'flex')}>
              <Metric label="Open" value={openCount} icon="chat" />
              <Metric label="Pending" value={pendingCount} icon="clock" />
              <Metric label="Unassigned" value={unassignedCount} icon="user" />
            </div>
          </div>
        </header>

        {activeView === 'Team Chat' ? (
          <div className="flex min-h-0 flex-1 overflow-hidden border-t border-white/80 bg-white/70">
            <TeamChat
              currentUser={currentUser}
              directMessages={directMessages}
              draft={teamDraft}
              error={teamChatError}
              messages={teamMessages}
              onSend={sendTeamMessage}
              selectedTeamChat={selectedTeamChat}
              setDraft={setTeamDraft}
              setSelectedTeamChat={setSelectedTeamChat}
              teamProfiles={teamProfiles}
            />
          </div>
        ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-white/80 bg-white/70 lg:flex-row">
          <aside className="flex h-[42vh] shrink-0 flex-col border-b border-slate-200 bg-white lg:h-auto lg:w-[380px] lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-4">
              {websiteChatError ? (
                <p className="mb-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                  {websiteChatError}
                </p>
              ) : null}
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <Icon name="search" />
                <input
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-ink outline-none placeholder:text-slate-400"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search conversations"
                  value={query}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                  <Icon name="filter" />
                  <select className="min-w-0 flex-1 border-0 bg-transparent outline-none" onChange={(event) => setStatus(event.target.value)} value={status}>
                    {['All', ...statuses].map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <select className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none" onChange={(event) => setChannel(event.target.value)} value={channel}>
                  {channels.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <ConversationList conversations={filtered} activeId={activeConversation?.id} setActiveId={setActiveId} />
          </aside>

          {activeConversation ? (
            <>
              <Thread
                conversation={activeConversation}
                convertingLeadId={convertingLeadId}
                currentUser={currentUser}
                draft={draft}
                mode={mode}
                onAssignToMe={assignActiveConversationToMe}
                onConvertLead={convertConversationToLead}
                onNote={() => addMessage('note')}
                onPending={pendingConversation}
                onResolve={resolveConversation}
                onSend={() => addMessage('agent')}
                setDraft={setDraft}
                setMode={setMode}
              />
              <DetailPanel
                assignmentOptions={assignmentOptions}
                conversation={activeConversation}
                convertingLeadId={convertingLeadId}
                currentUser={currentUser}
                onConvertLead={convertConversationToLead}
                updateConversation={updateConversation}
              />
            </>
          ) : (
            <EmptyInbox setActiveView={setActiveView} />
          )}
        </div>
        )}
      </section>
    </main>
  );
}

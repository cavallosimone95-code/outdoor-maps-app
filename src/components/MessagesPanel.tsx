import React, { useEffect, useMemo, useState } from 'react';
import { getCurrentUser, canDevelop } from '../services/authService';
import { addGlobalMessage, addUserMessage, getUserNotifications, markAsRead, deleteNotification } from '../services/notificationService';
import { getApprovedUsers, getDevelopers, User } from '../services/authService';

export default function MessagesPanel() {
  const currentUser = getCurrentUser();
  const [notifications, setNotifications] = useState(() => getUserNotifications(currentUser?.id));
  const [audience, setAudience] = useState<'all' | 'user'>('all');
  const [targetUser, setTargetUser] = useState<string>('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  const isDeveloper = canDevelop(currentUser);

  console.log('[MessagesPanel] currentUser:', currentUser);
  console.log('[MessagesPanel] isDeveloper:', isDeveloper);

  useEffect(() => {
    setNotifications(getUserNotifications(currentUser?.id));
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isDeveloper) return;
    const approved = getApprovedUsers();
    const devs = getDevelopers();
    setUsers([...approved, ...devs]);
  }, [isDeveloper]);

  const handlePublish = () => {
    if (!isDeveloper) return;
    if (!title.trim() || !message.trim()) {
      alert('Inserisci titolo e messaggio');
      return;
    }

    if (audience === 'all') {
      addGlobalMessage(title.trim(), message.trim(), currentUser?.id);
    } else {
      if (!targetUser) {
        alert('Seleziona un utente destinatario');
        return;
      }
      addUserMessage(targetUser, title.trim(), message.trim(), currentUser?.id);
    }

    // Reset form and reload list
    setTitle('');
    setMessage('');
    setTargetUser('');
    setNotifications(getUserNotifications(currentUser?.id));
    try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
    alert('Messaggio pubblicato');
  };

  const handleMarkRead = (id: string) => {
    if (!currentUser) return;
    markAsRead(id, currentUser.id);
    setNotifications(getUserNotifications(currentUser.id));
    try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
  };

  const handleDelete = (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo messaggio?')) return;
    deleteNotification(id);
    setNotifications(getUserNotifications(currentUser?.id));
    try { window.dispatchEvent(new CustomEvent('notifications:updated')); } catch {}
  };

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>🔔 Messaggi & Notifiche</h2>

      {isDeveloper && (
        <div style={{ marginBottom: 20, padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, background: '#fafafa' }}>
          <h3 style={{ marginTop: 0, color: '#000' }}>✍️ Pubblica comunicazione</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#000', fontWeight: 500 }}>
              <input type="radio" checked={audience === 'all'} onChange={() => setAudience('all')} />
              Tutti
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#000', fontWeight: 500 }}>
              <input type="radio" checked={audience === 'user'} onChange={() => setAudience('user')} />
              Utente specifico
            </label>
            {audience === 'user' && (
              <select 
                value={targetUser} 
                onChange={(e) => setTargetUser(e.target.value)} 
                style={{ 
                  minWidth: 200, 
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '2px solid #999',
                  fontSize: '15px',
                  background: '#fff',
                  color: '#000',
                  fontWeight: 500
                }}
              >
                <option value="">Seleziona utente…</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.username})</option>
                ))}
              </select>
            )}
          </div>
          <input
            type="text"
            placeholder="Titolo"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="message-input"
            style={{ 
              width: '100%', 
              padding: 10, 
              marginBottom: 8, 
              borderRadius: 6, 
              border: '2px solid #999',
              boxSizing: 'border-box',
              fontSize: '15px',
              background: '#fff',
              color: '#000',
              fontWeight: 500
            }}
          />
          <textarea
            placeholder="Messaggio"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="message-textarea"
            rows={3}
            style={{ 
              width: '100%', 
              padding: 10, 
              marginBottom: 8, 
              borderRadius: 6, 
              border: '2px solid #999',
              boxSizing: 'border-box',
              fontSize: '15px',
              resize: 'vertical',
              background: '#fff',
              color: '#000',
              fontWeight: 500,
              fontFamily: 'inherit'
            }}
          />
          <button onClick={handlePublish} className="btn-submit">📣 Pubblica</button>
        </div>
      )}

      {notifications.length === 0 ? (
        <p style={{ color: '#777' }}>Nessun messaggio al momento.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notifications.map(n => {
            const fromTeam = n.type === 'global';
            const isRead = currentUser && (n.readByUserIds || []).includes(currentUser.id);
            return (
              <div key={n.id} style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#222' }}>
                      {n.type === 'global' ? '🌍' : '👤'} {n.title}
                    </div>
                    {fromTeam && (
                      <div style={{ fontSize: 12, color: '#667eea', fontWeight: 600, marginTop: 2 }}>
                        Da: Singletrack Team
                      </div>
                    )}
                    <div style={{ marginTop: 4, color: '#222', whiteSpace: 'pre-wrap' }}>{n.message}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>
                      {new Date(n.createdAt).toLocaleString('it-IT')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch' }}>
                    {currentUser && !isRead && (
                      <button onClick={() => handleMarkRead(n.id)} className="btn-submit" style={{ padding: '6px 10px', fontSize: '13px' }}>
                        ✓ Letto
                      </button>
                    )}
                    <button onClick={() => handleDelete(n.id)} className="btn-cancel" style={{ padding: '6px 10px', fontSize: '13px', color: '#000' }}>
                      🗑️ Elimina
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PeerUser, ChatMessage } from './types';
import { listenRoomMessages, sendMessage } from './firestore';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';

type Params = {
  roomId: string;
  me: { id: string; name: string; color: string };
  awareness: any; // y-protocols/awareness instance
};

const TYPING_TIMEOUT = 2000;

export function useChatChannel({ roomId, me, awareness }: Params) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<PeerUser[]>([]);
  const typingTimer = useRef<any>(null);

  // Listen to Firestore messages (regular chat messages)
  useEffect(() => {
    if (!roomId) return;
    return listenRoomMessages(roomId, setMessages);
  }, [roomId]);

  // Listen to AI summaries and inject them as system messages
  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, 'ops_collab_summaries'),
      where('roomId', '==', roomId),
      orderBy('ts', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      const systemMsgs: ChatMessage[] = [];

      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data() as any;
          const ts = data.ts instanceof Timestamp ? data.ts.toMillis() : Date.now();

          systemMsgs.push({
            id: `sys:${change.doc.id}`,
            roomId,
            userId: 'ai-agent',
            userName: 'AI Summary',
            userColor: '#6366f1', // Indigo color for AI
            text: data.summary,
            createdAt: ts,
            system: true, // Custom field to identify system messages
          } as any);
        }
      });

      // Append system messages to the chat
      if (systemMsgs.length > 0) {
        setMessages((prev) => {
          // Merge and sort by timestamp
          const merged = [...prev, ...systemMsgs];
          return merged.sort((a, b) => a.createdAt - b.createdAt);
        });
      }
    });

    return () => unsub();
  }, [roomId]);

  // Set local user state in awareness
  useEffect(() => {
    if (!awareness) return;
    const state = awareness.getLocalState() || {};
    awareness.setLocalState({
      ...state,
      user: {
        id: me.id,
        name: me.name,
        color: me.color,
        isTyping: false,
        lastSeen: Date.now(),
      },
    });
  }, [awareness, me.id, me.name, me.color]);

  // Receive peers from awareness
  useEffect(() => {
    if (!awareness) return;

    const onChange = () => {
      const states = awareness.getStates(); // Map
      const list: PeerUser[] = [];
      states.forEach((value: any) => {
        if (value?.user?.id && value.user.id !== me.id) {
          list.push({
            id: value.user.id,
            name: value.user.name,
            color: value.user.color,
            isTyping: !!value.user.isTyping,
            lastSeen: value.user.lastSeen || Date.now(),
          });
        }
      });
      setPeers(list);
    };

    awareness.on('change', onChange);
    onChange(); // Initial load

    return () => awareness.off('change', onChange);
  }, [awareness, me.id]);

  // Mark typing (throttled)
  const markTyping = useCallback(() => {
    if (!awareness) return;

    const st = awareness.getLocalState() || {};
    if (!st.user) return;

    awareness.setLocalState({
      ...st,
      user: { ...st.user, isTyping: true, lastSeen: Date.now() },
    });

    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      const s2 = awareness.getLocalState() || {};
      if (!s2.user) return;
      awareness.setLocalState({
        ...s2,
        user: { ...s2.user, isTyping: false, lastSeen: Date.now() },
      });
    }, TYPING_TIMEOUT);
  }, [awareness]);

  // Send message to Firestore
  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      await sendMessage({
        roomId,
        userId: me.id,
        userName: me.name,
        userColor: me.color,
        text: trimmed,
      });
    },
    [roomId, me.id, me.name, me.color]
  );

  const peersOnline = useMemo(() => peers.length, [peers]);

  return { messages, peers, peersOnline, markTyping, send };
}

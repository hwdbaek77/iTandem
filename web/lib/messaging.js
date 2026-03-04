/**
 * Firestore messaging helpers for iTandem.
 * Conversation IDs are deterministic: sort([uid1, uid2]).join("_")
 * so two users always share exactly one conversation document.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

export function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export async function findUserByEmail(db, email) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

export async function getOrCreateConversation(db, myUid, otherUid, myName, otherName) {
  const convId = getConversationId(myUid, otherUid);
  const convRef = doc(db, "conversations", convId);
  const convSnap = await getDoc(convRef);

  if (!convSnap.exists()) {
    await setDoc(convRef, {
      participants: [myUid, otherUid],
      participantNames: { [myUid]: myName, [otherUid]: otherName },
      lastMessage: "",
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  }

  return convId;
}

export async function sendMessage(db, convId, senderId, senderName, text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  await addDoc(collection(db, "conversations", convId, "messages"), {
    senderId,
    senderName,
    text: trimmed,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "conversations", convId), {
    lastMessage: trimmed.length > 60 ? trimmed.substring(0, 60) + "…" : trimmed,
    lastMessageAt: serverTimestamp(),
  });
}

/** Returns an unsubscribe function. Calls callback with sorted conversation array. */
export function subscribeToConversations(db, uid, callback) {
  const q = query(
    collection(db, "conversations"),
    where("participants", "array-contains", uid)
  );
  return onSnapshot(q, (snap) => {
    const convs = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aT = a.lastMessageAt?.toMillis?.() ?? 0;
        const bT = b.lastMessageAt?.toMillis?.() ?? 0;
        return bT - aT;
      });
    callback(convs);
  });
}

/** Returns an unsubscribe function. Calls callback with ordered messages array. */
export function subscribeToMessages(db, convId, callback) {
  const q = query(
    collection(db, "conversations", convId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

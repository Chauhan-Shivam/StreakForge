import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Firebase SDKs
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

// --- React Icons ---
import {
  Flame, Trophy, Check, Trash2, List, ArrowUp, ArrowDown, Calendar, Plus,
  ShieldAlert, LogOut, User, Users, LayoutDashboard, Edit3, UserX, XCircle, X,
  ChevronDown, ChevronUp // Added for collapsible panel
} from 'lucide-react';

// --- 1. CONFIGURATION ---

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- 2. HELPER FUNCTIONS ---

const getISODateString = (date) => {
  return date.toISOString().split('T')[0];
};

const calculateStreaks = (dateStrings) => {
  if (dateStrings.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }
  const sortedDates = [...new Set(dateStrings)].sort();
  const today = new Date();
  const todayStr = getISODateString(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = getISODateString(yesterday);

  let currentStreak = 0, maxStreak = 0, tempStreak = 0;
  let lastDateStr = sortedDates[sortedDates.length - 1];
  
  if (lastDateStr === todayStr || lastDateStr === yesterdayStr) {
    currentStreak = 1;
    let lastDate = new Date(lastDateStr);
    for (let i = sortedDates.length - 2; i >= 0; i--) {
      const currentDateStr = sortedDates[i];
      const currentDate = new Date(currentDateStr);
      const diffTime = lastDate.getTime() - currentDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) currentStreak++;
      else break;
      lastDate = currentDate;
    }
  }
  if (lastDateStr !== todayStr && lastDateStr !== yesterdayStr) {
    currentStreak = 0;
  }

  tempStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) tempStreak = 1;
    else {
      const lastDate = new Date(sortedDates[i-1]);
      const currentDate = new Date(sortedDates[i]);
      const diffTime = currentDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 1) tempStreak++;
      else tempStreak = 1;
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;
  }
  if (currentStreak > maxStreak) maxStreak = currentStreak;
  return { currentStreak, maxStreak };
};

const updateProfileMaxStreak = async (userId) => {
    try {
        const habitsSnapshot = await db.collection("users").doc(userId).collection("habits").get();
        const maxStreaks = habitsSnapshot.docs.map(d => d.data().maxStreak || 0);
        const highestMaxStreak = Math.max(0, ...maxStreaks);
        
        await db.collection("profiles").doc(userId).update({
            highestMaxStreak: highestMaxStreak
        });
    } catch (e) {
        console.error("Error updating profile max streak: ", e);
    }
};

const showNotification = (title, body) => {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/logo.png'
        });
    }
};

// --- 3. REUSABLE COMPONENTS ---

function LoadingSpinner({ fullScreen = false }) {
  const className = fullScreen 
    ? "flex items-center justify-center min-h-screen bg-gray-900"
    : "flex items-center justify-center";
  return (
    <div className={className}>
      <svg className="animate-spin h-10 w-10 text-orange-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
      <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
      <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.552-3.108-11.303-7.521l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
      <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.088,5.571l6.19,5.238C39.956,35.973,44,30.606,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
    </svg>
  );
}

// --- 4. AUTHENTICATION COMPONENTS ---

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      const result = await auth.signInWithPopup(provider);
      const user = result.user;
      const profileDoc = db.collection("profiles").doc(user.uid);
      const docSnap = await profileDoc.get();
      
      if (!docSnap.exists) {
        await profileDoc.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date(),
          highestMaxStreak: 0, 
          reminderTime: null,
          remindersEnabled: false // --- NEW: For notification toggle
        });
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await user.updateProfile({ displayName });
        await db.collection("profiles").doc(user.uid).set({
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${displayName}`,
          createdAt: new Date(),
          highestMaxStreak: 0,
          reminderTime: null,
          remindersEnabled: false // --- NEW: For notification toggle
        });
      }
    } catch (error) {
      console.error("Error with email auth:", error);
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <h1 className="text-4xl font-bold text-center text-white mb-6">StreakForge</h1>
        <div className="flex mb-6 border-b border-gray-700">
          <button
            onClick={() => setIsLogin(true)}
            className={`w-1/2 py-3 text-center font-semibold ${isLogin ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`w-1/2 py-3 text-center font-semibold ${!isLogin ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400'}`}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4 flex items-center">
            <ShieldAlert className="w-5 h-5 mr-3" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isLogin && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:border-orange-500"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:border-orange-500"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-black border border-gray-700 rounded-lg focus:border-orange-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600 disabled:bg-gray-600 transition-all"
          >
            {loading ? <LoadingSpinner /> : (isLogin ? 'Sign In' : 'Register')}
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="mx-4 text-gray-500">OR</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="flex items-center justify-center w-full px-6 py-3 bg-gray-200 text-gray-800 border border-gray-300 rounded-lg shadow-sm font-medium hover:bg-gray-300 transition-all"
        >
          <GoogleIcon />
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// --- 5. MAIN APPLICATION PAGES ---

function DashboardPage({ userId, habits, completions }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [reorder, setReorder] = useState(false);
  
  const todayStr = getISODateString(new Date());

  const addHabit = async (e) => {
    e.preventDefault();
    if(!newHabit.trim()) return;
    try {
        await db.collection('users').doc(userId).collection('habits').add({
            name: newHabit,
            currentStreak: 0,
            maxStreak: 0,
            order: habits.length,
            createdAt: new Date()
        });
        setNewHabit('');
        setShowAdd(false);
    } catch (error) {
        console.error("Error adding habit: ", error);
    }
  };

  const toggle = async (habitId) => {
    const dateStr = todayStr;
    const completionQuery = db.collection('users').doc(userId).collection('completion')
        .where('habitId', '==', habitId)
        .where('date', '==', dateStr);
    
    try {
        const querySnapshot = await completionQuery.get();
        if (querySnapshot.empty) {
            await db.collection('users').doc(userId).collection('completion').add({
                habitId,
                date: dateStr,
            });
        } else {
            await querySnapshot.docs[0].ref.delete();
        }
        
        const allCompletionsSnapshot = await db.collection('users').doc(userId).collection('completion')
            .where('habitId', '==', habitId).get();
        const allCompletionDates = allCompletionsSnapshot.docs.map(d => d.data().date);
        const { currentStreak, maxStreak } = calculateStreaks(allCompletionDates);
        
        await db.collection('users').doc(userId).collection('habits').doc(habitId).update({
            currentStreak,
            maxStreak
        });
        
        await updateProfileMaxStreak(userId);

    } catch (error) {
        console.error("Error toggling habit: ", error);
    }
  };
  
  const deleteHabit = async (id) => {
      if(!confirm('Delete this habit?')) return;
      try {
          await db.collection('users').doc(userId).collection('habits').doc(id).delete();
          
          const q = db.collection('users').doc(userId).collection('completion').where('habitId', '==', id);
          const querySnapshot = await q.get();
          const deletePromises = [];
          querySnapshot.forEach((docSnap) => {
              deletePromises.push(docSnap.ref.delete());
          });
          await Promise.all(deletePromises);
          
          await updateProfileMaxStreak(userId);

      } catch (error) {
          console.error("Error deleting habit: ", error);
      }
  };

  const move = (index, dir) => {
      console.warn("Move functionality is local-only for this demo.");
  };

  const activeCount = habits.filter(h => h.currentStreak > 0).length;

  return (
    <div className="pb-24 md:pb-6">
        <div className="p-4 flex justify-between items-center bg-gray-900/90 backdrop-blur sticky top-0 z-10 border-b border-white/10">
            <div className="flex items-center gap-2">
                <div className="bg-orange-500 p-1.5 rounded">
                    <Flame className="text-white w-5 h-5" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">StreakForge</h1>
            </div>
            <button onClick={() => setReorder(!reorder)} className={`p-2 rounded-full ${reorder ? 'bg-orange-600' : 'bg-gray-800'}`}>
                {reorder ? <Check className="w-5 h-5 text-white" /> : <List className="w-5 h-5 text-white" />}
            </button>
        </div>

        <div className="max-w-md mx-auto">
            {!reorder && (
                <div className="p-4">
                    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border border-white/10 shadow-lg relative overflow-hidden">
                        <div className="absolute -right-5 -top-5 text-white/5">
                            <Flame style={{width:120, height:120}} />
                        </div>
                        <div className="relative z-10">
                            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Active Streaks</div>
                            <div className="text-4xl font-black">{activeCount} <span className="text-lg text-gray-500 font-normal">/ {habits.length}</span></div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 p-4 space-y-3">
                {habits.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>No habits yet. Add one!</p>
                    </div>
                )}
                {habits.map((h, i) => {
                    const isDone = completions.some(c => c.habitId === h.id && c.date === todayStr);
                    
                    return (
                        <div key={h.id} className={`p-4 rounded-xl flex items-center gap-4 transition-all ${isDone ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-gray-800 border border-transparent'} ${reorder ? 'border-dashed border-gray-600' : ''}`}>
                            
                            {reorder ? (
                                <div className="flex flex-col gap-2">
                                    <button onClick={() => move(i, 'up')} disabled={true} className="opacity-50 hover:opacity-100 disabled:opacity-10"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => move(i, 'down')} disabled={true} className="opacity-50 hover:opacity-100 disabled:opacity-10"><ArrowDown className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <button onClick={() => toggle(h.id)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-gray-700 text-gray-500'}`}>
                                    {isDone ? <Check className="w-6 h-6 stroke-[3]" /> : <div className="w-3 h-3 bg-gray-600 rounded-full"></div>}
                                </button>
                            )}
                            
                            <div className="flex-1 min-w-0">
                                <h3 className={`font-medium text-lg truncate ${isDone ? 'text-gray-500 line-through' : ''}`}>{h.name}</h3>
                                {!reorder && (
                                    <div className="flex gap-3 mt-1 text-xs">
                                        <span className={`flex items-center ${h.currentStreak > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                                            <Flame className="w-3 h-3 mr-1" /> {h.currentStreak}
                                        </span>
                                        <span className="text-gray-600 flex items-center">
                                            <Trophy className="w-3 h-3 mr-1" /> {h.maxStreak}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {!reorder && (
                                <button onClick={() => deleteHabit(h.id)} className="p-2 text-gray-600 hover:text-red-400">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {!reorder && (
            <button 
                onClick={() => setShowAdd(true)} 
                className="absolute bottom-24 right-6 w-14 h-14 bg-orange-500 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-orange-600 transition-transform active:scale-90 z-20
                           md:bottom-6"
            >
                <Plus className="w-8 h-8" />
            </button>
        )}

        {showAdd && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center pb-20 md:pb-0" onClick={() => setShowAdd(false)}>
                <div className="bg-gray-900 w-full max-w-md rounded-t-3xl p-6 border-t border-gray-800" onClick={e => e.stopPropagation()}>
                    <h2 className="text-xl font-bold mb-4">New Habit</h2>
                    <form onSubmit={addHabit}>
                        <input autoFocus value={newHabit} onChange={e => setNewHabit(e.target.value)} placeholder="What do you want to track?" className="w-full bg-black border border-gray-800 rounded-xl p-4 text-lg mb-4 focus:border-orange-500" />
                        <button disabled={!newHabit.trim()} className="w-full bg-orange-500 py-4 rounded-xl font-bold text-lg disabled:opacity-50">Create</button>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
}

function FriendsPage({ userId, handleEndFriendship }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  const fetchFriendData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const sentQuery = db.collection("friendRequests").where('senderId', '==', userId).where('status', '==', 'accepted');
      const recvQuery = db.collection("friendRequests").where('receiverId', '==', userId).where('status', '==', 'accepted');
      
      const [sentSnap, recvSnap] = await Promise.all([sentQuery.get(), recvQuery.get()]);
      
      const friends = [];
      sentSnap.forEach(doc => friends.push({ uid: doc.data().receiverId, requestId: doc.id }));
      recvSnap.forEach(doc => friends.push({ uid: doc.data().senderId, requestId: doc.id }));
      
      const allUsers = [...friends, { uid: userId, requestId: null }];
      
      let leaderboardData = [];
      for (const user of allUsers) {
          const userProfileSnap = await db.collection("profiles").doc(user.uid).get();
          if (!userProfileSnap.exists) continue;
          
          const userProfile = userProfileSnap.data();
          const highestMax = userProfile.highestMaxStreak || 0;
          
          leaderboardData.push({ 
              ...userProfile, 
              highestMaxStreak: highestMax,
              requestId: user.requestId
          });
      }
      
      leaderboardData.sort((a, b) => b.highestMaxStreak - a.highestMaxStreak);
      setLeaderboard(leaderboardData);

    } catch (e) {
      console.error("Error fetching friend data: ", e);
      setError("Could not load friend data.");
    }
    setLoading(false);
  }, [userId]);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoadingRequests(true);
    
    const receivedQuery = db.collection("friendRequests")
      .where('receiverId', '==', userId)
      .where('status', '==', 'pending');
      
    const sentQuery = db.collection("friendRequests")
      .where('senderId', '==', userId)
      .where('status', '==', 'pending');

    const getProfilesForRequests = async (snapshot, idField) => {
        const requests = [];
        for (const doc of snapshot.docs) {
            const request = doc.data();
            const profileSnap = await db.collection("profiles").doc(request[idField]).get();
            if (profileSnap.exists) {
                requests.push({
                    requestId: doc.id,
                    ...profileSnap.data()
                });
            }
        }
        return requests;
    };

    try {
        const [receivedSnap, sentSnap] = await Promise.all([
            receivedQuery.get(),
            sentQuery.get()
        ]);
        
        const received = await getProfilesForRequests(receivedSnap, 'senderId');
        const sent = await getProfilesForRequests(sentSnap, 'receiverId');
        
        setReceivedRequests(received);
        setSentRequests(sent);

    } catch (e) {
      console.error("Error fetching requests:", e);
      setError("Could not load friend requests.");
    }
    setLoadingRequests(false);
  }, [userId]);

  useEffect(() => {
    fetchFriendData();
    fetchRequests();
  }, [fetchFriendData, fetchRequests]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    if (!friendEmail.trim()) return;
    setError(null);
    setMessage(null);
    
    try {
      const q = db.collection("profiles").where('email', '==', friendEmail.trim());
      const querySnapshot = await q.get();
      
      if (querySnapshot.empty) throw new Error("User not found.");
      const friendProfile = querySnapshot.docs[0].data();
      if (friendProfile.uid === userId) throw new Error("You can't add yourself.");
      
      const existingReqQuery1 = db.collection("friendRequests")
          .where('senderId', '==', userId)
          .where('receiverId', '==', friendProfile.uid);
      const existingReqQuery2 = db.collection("friendRequests")
          .where('senderId', '==', friendProfile.uid)
          .where('receiverId', '==', userId);

      const [existingSnap1, existingSnap2] = await Promise.all([existingReqQuery1.get(), existingReqQuery2.get()]);

      if (!existingSnap1.empty || !existingSnap2.empty) throw new Error("You are already friends or a request is pending.");

      await db.collection("friendRequests").add({
          senderId: userId,
          receiverId: friendProfile.uid,
          status: "pending",
          createdAt: new Date()
      });
      
      setMessage("Friend request sent!");
      setFriendEmail('');
      fetchRequests(); 
    } catch (e) {
      console.error("Error adding friend:", e);
      setError(e.message);
    }
  };

  const handleAcceptRequest = async (requestId) => {
      try {
          await db.collection("friendRequests").doc(requestId).update({
              status: "accepted"
          });
          
          fetchRequests(); 
          fetchFriendData(); 
      } catch (e) {
          console.error("Error accepting request:", e);
          setError("Failed to accept request.");
      }
  };

  const handleEndFriendshipProxy = async (requestId, actionType) => {
      await handleEndFriendship(requestId, actionType);
      fetchRequests();
      fetchFriendData();
  };

  return (
    <div className="p-4 pb-24 space-y-6 md:pb-6 md:max-w-2xl md:mx-auto">
      <h1 className="text-3xl font-bold text-white">Friends</h1>
      
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-3">Add Friend</h2>
        <form onSubmit={handleAddFriend} className="flex gap-2">
          <input
            type="email"
            value={friendEmail}
            onChange={(e) => setFriendEmail(e.target.value)}
            placeholder="Friend's email"
            className="flex-grow px-4 py-2 bg-black border border-gray-700 rounded-lg focus:border-orange-500"
          />
          <button type="submit" className="px-4 py-2 bg-orange-500 text-white font-semibold rounded-lg shadow-md hover:bg-orange-600">
            Add
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        {message && <p className="text-green-400 text-sm mt-2">{message}</p>}
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4">Friend Requests</h2>
        {loadingRequests ? <LoadingSpinner /> : (
            <div className="space-y-4">
                {receivedRequests.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-400">Received</h3>
                        {receivedRequests.map(user => (
                            <div key={user.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />
                                <span className="flex-grow font-semibold">{user.displayName}</span>
                                <button onClick={() => handleEndFriendshipProxy(user.requestId, 'Decline')} className="p-2 text-gray-500 hover:text-red-500"><X className="w-5 h-5" /></button>
                                <button onClick={() => handleAcceptRequest(user.requestId)} className="p-2 text-gray-500 hover:text-green-500"><Check className="w-5 h-5" /></button>
                            </div>
                        ))}
                    </div>
                )}
                {sentRequests.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-400">Sent</h3>
                        {sentRequests.map(user => (
                            <div key={user.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full object-cover" />
                                <span className="flex-grow font-semibold">{user.displayName}</span>
                                <button onClick={() => handleEndFriendshipProxy(user.requestId, 'Cancel')} className="p-2 text-gray-500 hover:text-red-500">
                                    <XCircle className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {receivedRequests.length === 0 && sentRequests.length === 0 && (
                    <p className="text-gray-500 text-sm">No pending friend requests.</p>
                )}
            </div>
        )}
      </div>

      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          Leaderboard (Highest Streak)
        </h2>
        {loading ? (
          <LoadingSpinner />
        ) : leaderboard.length === 0 ? (
          <p className="text-gray-500">No data yet. Add habits and friends!</p>
        ) : (
          <ul className="space-y-3">
            {leaderboard.map((user, index) => (
              <li key={user.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                <span className="font-bold text-lg w-6">
                  {index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : `${index + 1}`))}
                </span>
                <img 
                  src={user.photoURL} 
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-grow">
                  <p className={`font-semibold ${user.uid === userId ? 'text-orange-400' : 'text-white'}`}>
                    {user.displayName} {user.uid === userId && '(You)'}
                  </p>
                </div>
                <span className="font-bold text-lg text-orange-400">
                  {user.highestMaxStreak} 🏆
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- UPDATED PROFILE PAGE ---
function ProfilePage({ profile, userId, handleEndFriendship, notifPermission, setNotifPermission }) {
    const [friendList, setFriendList] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(true);

    const [showEdit, setShowEdit] = useState(false);
    const [newDisplayName, setNewDisplayName] = useState(profile ? profile.displayName : '');
    const [newImage, setNewImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    // --- NEW: Collapsible state ---
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [reminderTime, setReminderTime] = useState(profile?.reminderTime || '');

    const fetchFriendProfiles = useCallback(async () => {
        if (!userId) return;
        setLoadingFriends(true);
        
        const sentQuery = db.collection("friendRequests").where('senderId', '==', userId).where('status', '==', 'accepted');
        const recvQuery = db.collection("friendRequests").where('receiverId', '==', userId).where('status', '==', 'accepted');
        
        const [sentSnap, recvSnap] = await Promise.all([sentQuery.get(), recvQuery.get()]);
        
        const friends = [];
        sentSnap.forEach(doc => friends.push({ uid: doc.data().receiverId, requestId: doc.id }));
        recvSnap.forEach(doc => friends.push({ uid: doc.data().senderId, requestId: doc.id }));

        if (friends.length === 0) {
             setLoadingFriends(false);
             setFriendList([]);
             return;
        }

        const friendProfiles = [];
        for (const friend of friends) {
            const docSnap = await db.collection("profiles").doc(friend.uid).get();
            if (docSnap.exists) {
                friendProfiles.push({
                    ...docSnap.data(),
                    requestId: friend.requestId
                });
            }
        }
        setFriendList(friendProfiles);
        setLoadingFriends(false);
    }, [userId]);
    
    useEffect(() => {
        fetchFriendProfiles();
    }, [fetchFriendProfiles]);

    useEffect(() => {
      if (profile) {
        setReminderTime(profile.reminderTime || '');
        setNewDisplayName(profile.displayName);
      }
    }, [profile]);
    
    const handleSignOut = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    const handleRemoveFriendProxy = async (requestId, actionType) => {
        await handleEndFriendship(requestId, actionType);
        fetchFriendProfiles();
    };
    
    const handleFileChange = (e) => {
        if (e.target.files[0]) {
            setNewImage(e.target.files[0]);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setUploading(true);
        setError(null);
        
        let newPhotoURL = null;
        
        try {
            if (newImage) {
                const storageRef = storage.ref(`profile_pictures/${userId}`);
                const uploadTask = await storageRef.put(newImage);
                newPhotoURL = await uploadTask.ref.getDownloadURL();
            }
            
            const updatedData = {};
            if (newDisplayName.trim() && newDisplayName !== profile.displayName) {
                updatedData.displayName = newDisplayName.trim();
            }
            if (newPhotoURL) {
                updatedData.photoURL = newPhotoURL;
            }

            if (Object.keys(updatedData).length > 0) {
                await db.collection("profiles").doc(userId).update(updatedData);
            }
            
            setUploading(false);
            setShowEdit(false);
            setNewImage(null);
        } catch (err) {
            console.error("Error updating profile: ", err);
            setError(err.message);
            setUploading(false);
        }
    };

    // --- UPDATED: Uses prop ---
    const requestNotifPermission = async () => {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission); // Set state in parent
        if (permission === 'granted') {
            showNotification('Notifications Enabled!', 'You will now receive reminders from StreakForge.');
        }
    };

    // --- NEW: Handle Toggle ---
    const handleToggleReminders = async (e) => {
        const enabled = e.target.checked;
        try {
            await db.collection("profiles").doc(userId).update({
                remindersEnabled: enabled
            });
        } catch (err) {
            console.error("Error toggling reminders: ", err);
            alert("Could not update setting.");
        }
    };

    const handleSaveReminder = async () => {
        try {
            await db.collection("profiles").doc(userId).update({
                reminderTime: reminderTime || null
            });
            alert("Reminder time saved!");
        } catch (err) {
            console.error("Error saving reminder: ", err);
            alert("Could not save reminder time.");
        }
    };

    if (!profile) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="p-4 max-w-lg mx-auto pb-24 space-y-6 md:pb-6">
            <h1 className="text-3xl font-bold text-white mb-6 text-center">Profile</h1>
            
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center border border-gray-700">
                <img 
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="w-32 h-32 rounded-full mb-4 ring-4 ring-orange-500/50 object-cover"
                />
                <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
                <p className="text-gray-400 text-lg mb-6">{profile.email}</p>
                
                <button
                    onClick={() => {
                        setShowEdit(true);
                        setNewDisplayName(profile.displayName);
                        setNewImage(null);
                        setError(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 text-white font-semibold rounded-lg shadow-md hover:bg-gray-600 transition-all mb-3"
                >
                    <Edit3 className="w-5 h-5" />
                    Edit Profile
                </button>
                
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
            
            {/* --- NEW: Collapsible Notification Settings --- */}
            <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden">
                <button 
                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                    className="w-full p-6 flex justify-between items-center"
                >
                    <h2 className="text-xl font-bold">Notifications</h2>
                    {isNotifOpen ? <ChevronUp /> : <ChevronDown />}
                </button>
                
                {isNotifOpen && (
                    <div className="p-6 border-t border-gray-700">
                        {notifPermission === 'default' && (
                            <button 
                                onClick={requestNotifPermission}
                                className="w-full bg-blue-500 py-3 rounded-xl font-bold text-lg"
                            >
                                Enable Reminders
                            </button>
                        )}
                        {notifPermission === 'denied' && (
                            <p className="text-red-400">You have blocked notifications. You must enable them in your browser settings.</p>
                        )}
                        {notifPermission === 'granted' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="notif-toggle" className="text-lg font-medium text-white">Enable Reminders</label>
                                    <input 
                                        type="checkbox" 
                                        id="notif-toggle"
                                        checked={profile.remindersEnabled || false}
                                        onChange={handleToggleReminders}
                                        className="w-6 h-6 rounded text-orange-500 bg-gray-700 border-gray-600 focus:ring-orange-600"
                                    />
                                </div>

                                {profile.remindersEnabled && (
                                    <div className="space-y-3 pt-4 border-t border-gray-700">
                                        <div>
                                            <label className="text-sm font-medium text-gray-400">Daily Reminder Time</label>
                                            <input 
                                                type="time"
                                                value={reminderTime}
                                                onChange={(e) => setReminderTime(e.target.value)}
                                                className="w-full bg-black border border-gray-800 rounded-xl p-3 mt-1 focus:border-orange-500"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleSaveReminder}
                                            className="w-full bg-orange-500 py-3 rounded-xl font-bold text-lg"
                                        >
                                            Save Reminder Time
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
                <h2 className="text-xl font-bold mb-4">Your Friends</h2>
                {loadingFriends ? (
                    <LoadingSpinner />
                ) : friendList.length === 0 ? (
                    <p className="text-gray-500">You haven't added any friends yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {friendList.map((friend) => (
                            <li key={friend.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                                <img 
                                    src={friend.photoURL} 
                                    alt={friend.displayName}
                                    className="w-10 h-10 rounded-full object-cover"
                                />
                                <div className="flex-grow">
                                    <p className="font-semibold">{friend.displayName}</p>
                                </div>
                                <button 
                                    onClick={() => handleRemoveFriendProxy(friend.requestId, 'Remove')} 
                                    className="p-2 text-gray-600 hover:text-red-500"
                                    title="Remove friend"
                                >
                                    <UserX className="w-5 h-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {showEdit && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
                    <div className="bg-gray-900 w-full max-w-md rounded-2xl p-6 border border-gray-800" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">Edit Profile</h2>
                        
                        {error && (
                            <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4 flex items-center">
                                <ShieldAlert className="w-5 h-5 mr-3" />
                                <span className="text-sm">{error}</span>
                            </div>
                        )}
                        
                        <form onSubmit={handleProfileUpdate} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-400">Display Name</label>
                                <input 
                                    type="text"
                                    value={newDisplayName} 
                                    onChange={e => setNewDisplayName(e.target.value)} 
                                    className="w-full bg-black border border-gray-800 rounded-xl p-3 mt-1 focus:border-orange-500" 
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-400">Change Profile Picture</label>
                                <input 
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-500 file:text-white hover:file:bg-orange-600 mt-1"
                                />
                            </div>
                            <button 
                                type="submit"
                                disabled={uploading} 
                                className="w-full flex items-center justify-center bg-orange-500 py-3 rounded-xl font-bold text-lg disabled:opacity-50"
                            >
                                {uploading ? <LoadingSpinner /> : 'Save Changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
// --- END OF UPDATED PROFILE PAGE ---


// --- 6. MAIN APP ---

const App = () => {
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    const [profile, setProfile] = useState(null);
    const [habits, setHabits] = useState([]);
    const [completions, setCompletions] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard');

    // --- NEW: Lifted state for notifications ---
    const [notifPermission, setNotifPermission] = useState(Notification.permission);
    const [hasSentToday, setHasSentToday] = useState(false); // Prevents spam

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setUser(user);
            setIsAuthReady(true);
            if (!user) {
                setProfile(null);
                setHabits([]);
                setCompletions([]);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!isAuthReady || !user) return;

        const unsubProfile = db.collection("profiles").doc(user.uid)
            .onSnapshot((doc) => {
                if (doc.exists) setProfile(doc.data());
                else console.error("No profile found!");
            });

        const unsubHabits = db.collection("users").doc(user.uid).collection("habits")
            .orderBy("order", "asc") 
            .onSnapshot((snapshot) => {
                setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
        
        if (habits.length === 0) {
              db.collection("users").doc(user.uid).collection("habits")
                .orderBy("createdAt", "asc")
                .onSnapshot((snapshot) => {
                    setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                });
        }

        const unsubCompletions = db.collection("users").doc(user.uid).collection("completion")
            .onSnapshot((snapshot) => {
                setCompletions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });

        return () => {
            unsubProfile();
            unsubHabits();
            unsubCompletions();
        };
    }, [user, isAuthReady]);

    // --- NEW: Robust Notification Scheduler ---
    useEffect(() => {
        // Run a check every 30 seconds
        const intervalId = setInterval(() => {
            if (!profile || !profile.remindersEnabled || !profile.reminderTime || !isAuthReady || habits.length === 0 || Notification.permission !== 'granted') {
                return; 
            }
            
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            
            // Not reminder time yet, reset the "sent" flag
            if (currentTime !== profile.reminderTime) {
                setHasSentToday(false);
                return;
            }

            // It's the right time, but we already sent one
            if (hasSentToday) {
                return;
            }

            // It's time! Check if habits are done.
            const todayStr = getISODateString(new Date());
            const allDone = habits.every(h => 
                completions.some(c => c.habitId === h.id && c.date === todayStr)
            );

            if (allDone) {
                return; // All habits are done, no reminder needed
            }
            
            // --- ALL CHECKS PASSED: Send notification ---
            showNotification(
                'StreakForge Reminder', 
                "Don't forget to complete your habits and keep your streaks alive!"
            );
            setHasSentToday(true); // Mark as sent for today
            
        }, 30000); // Check every 30 seconds

        return () => clearInterval(intervalId); // Cleanup interval

    }, [profile, habits, completions, isAuthReady, hasSentToday]); // Re-run if these change
    
    
    const handleEndFriendship = async (requestId, actionType = 'Remove') => {
        if (!user) return;
        
        const confirmMessage = actionType === 'Remove'
            ? 'Are you sure you want to remove this friend?'
            : (actionType === 'Cancel' ? 'Are you sure you want to cancel this request?' : 'Decline this request?');
        
        if (!confirm(confirmMessage)) return;
        
        try {
            await db.collection("friendRequests").doc(requestId).delete();
        } catch (e) {
            console.error(`Error ${actionType.toLowerCase()}ing friend:`, e);
        }
    };


    if (!isAuthReady) {
        return <LoadingSpinner fullScreen />;
    }

    if (!user) {
        return <AuthPage />;
    }

    return (
        <div className="bg-gray-900 min-h-screen">
            <main className="flex-1 md:ml-20"> 
                <div className="max-w-md mx-auto bg-gray-900 min-h-screen flex flex-col relative border-x border-gray-800 shadow-2xl">
                    {/* --- BUG FIX: Remove global icon refreshers --- */}
                    
                    {currentView === 'dashboard' && (
                        <DashboardPage 
                            userId={user.uid}
                            habits={habits}
                            completions={completions}
                        />
                    )}
                    {currentView === 'friends' && (
                        <FriendsPage 
                            userId={user.uid} 
                            handleEndFriendship={handleEndFriendship} 
                        />
                    )}
                    {currentView === 'profile' && (
                        <ProfilePage 
                            profile={profile} 
                            userId={user.uid}
                            handleEndFriendship={handleEndFriendship} 
                            notifPermission={notifPermission}
                            setNotifPermission={setNotifPermission}
                        />
                    )}
                </div>
            </main>
            
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-gray-900 border-t border-gray-800 flex justify-around items-center z-50
                        md:top-0 md:left-0 md:h-screen md:w-20 md:flex-col md:justify-start md:border-t-0 md:border-r">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`flex flex-col items-center justify-center h-full px-4 md:h-20 md:w-full ${currentView === 'dashboard' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <LayoutDashboard className="w-6 h-6" />
                    <span className="text-xs mt-1">Dashboard</span>
                </button>
                <button
                    onClick={() => setCurrentView('friends')}
                    className={`flex flex-col items-center justify-center h-full px-4 md:h-20 md:w-full ${currentView === 'friends' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <Users className="w-6 h-6" />
                    <span className="text-xs mt-1">Friends</span>
                </button>
                <button
                    onClick={() => setCurrentView('profile')}
                    className={`flex flex-col items-center justify-center h-full px-4 md:h-20 md:w-full ${currentView === 'profile' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <User className="w-6 h-6" />
                    <span className="text-xs mt-1">Profile</span>
                </button>
            </nav>
        </div>
    );
};

export default App;

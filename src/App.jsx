import React, { useState, useEffect, useMemo, useCallback } from 'react';

// Firebase SDKs - imported from the npm package
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// --- 1. CONFIGURATION ---

// --- Firebase Initialization ---
// ✅ SECURE: Keys are loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- 2. HELPER FUNCTIONS ---

/**
 * Formats a Date object into a 'YYYY-MM-DD' string.
 */
const getISODateString = (date) => {
  return date.toISOString().split('T')[0];
};

/**
 * Calculates current and max streaks from a list of completion dates.
 */
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

  let currentStreak = 0;
  let maxStreak = 0;
  let tempStreak = 0;

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

  useEffect(() => { window.lucide.createIcons(); }, [error]);

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
          friends: [],
          createdAt: new Date()
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
          friends: [],
          createdAt: new Date()
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
        <h1 className="text-4xl font-bold text-center text-white mb-6">StreakKeeper</h1>
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
            <i data-lucide="shield-alert" className="w-5 h-5 mr-3"></i>
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

  // --- BUG FIX ---
  // Refresh icons only when list length changes, not on every toggle
  useEffect(() => { 
      window.lucide.createIcons(); 
  }, [showAdd, reorder, habits.length]);
  
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
        
        // Recalculate streaks
        const allCompletionsSnapshot = await db.collection('users').doc(userId).collection('completion')
            .where('habitId', '==', habitId).get();
        const allCompletionDates = allCompletionsSnapshot.docs.map(d => d.data().date);
        const { currentStreak, maxStreak } = calculateStreaks(allCompletionDates);
        
        await db.collection('users').doc(userId).collection('habits').doc(habitId).update({
            currentStreak,
            maxStreak
        });

    } catch (error) {
        console.error("Error toggling habit: ", error);
    }
  };
  
  const deleteHabit = async (id) => {
      if(!confirm('Delete this habit?')) return;
      try {
          await db.collection('users').doc(userId).collection('habits').doc(id).delete();
          // Also delete all completion records
          const q = db.collection('users').doc(userId).collection('completion').where('habitId', '==', id);
          const querySnapshot = await q.get();
          const deletePromises = [];
          querySnapshot.forEach((docSnap) => {
              deletePromises.push(docSnap.ref.delete());
          });
          await Promise.all(deletePromises);
      } catch (error) {
          console.error("Error deleting habit: ", error);
      }
  };

  const move = (index, dir) => {
      console.warn("Move functionality is local-only for this demo.");
  };

  const activeCount = habits.filter(h => h.currentStreak > 0).length;

  return (
    <div className="pb-24">
        {/* Header */}
        <div className="p-4 flex justify-between items-center bg-gray-900/90 backdrop-blur sticky top-0 z-10 border-b border-white/10">
            <div className="flex items-center gap-2">
                <div className="bg-orange-500 p-1.5 rounded">
                    <i data-lucide="flame" className="text-white w-5 h-5"></i>
                </div>
                <h1 className="font-bold text-lg tracking-tight">StreakKeeper</h1>
            </div>
            <button onClick={() => setReorder(!reorder)} className={`p-2 rounded-full ${reorder ? 'bg-orange-600' : 'bg-gray-800'}`}>
                <i data-lucide={reorder ? "check" : "list"} className="w-5 h-5 text-white"></i>
            </button>
        </div>

        {/* Stats */}
        {!reorder && (
            <div className="p-4">
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 border border-white/10 shadow-lg relative overflow-hidden">
                    <div className="absolute -right-5 -top-5 text-white/5">
                        <i data-lucide="flame" style={{width:120, height:120}}></i>
                    </div>
                    <div className="relative z-10">
                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">Active Streaks</div>
                        <div className="text-4xl font-black">{activeCount} <span className="text-lg text-gray-500 font-normal">/ {habits.length}</span></div>
                    </div>
                </div>
            </div>
        )}

        {/* List */}
        <div className="flex-1 p-4 space-y-3">
            {habits.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    <i data-lucide="calendar" className="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                    <p>No habits yet. Add one!</p>
                </div>
            )}
            {habits.map((h, i) => {
                const isDone = completions.some(c => c.habitId === h.id && c.date === todayStr);
                
                return (
                    <div key={h.id} className={`p-4 rounded-xl flex items-center gap-4 transition-all ${isDone ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-gray-800 border border-transparent'} ${reorder ? 'border-dashed border-gray-600' : ''}`}>
                        
                        {reorder ? (
                            <div className="flex flex-col gap-2">
                                <button onClick={() => move(i, 'up')} disabled={true} className="opacity-50 hover:opacity-100 disabled:opacity-10"><i data-lucide="arrow-up" className="w-4 h-4"></i></button>
                                <button onClick={() => move(i, 'down')} disabled={true} className="opacity-50 hover:opacity-100 disabled:opacity-10"><i data-lucide="arrow-down" className="w-4 h-4"></i></button>
                            </div>
                        ) : (
                            <button onClick={() => toggle(h.id)} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isDone ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-gray-700 text-gray-500'}`}>
                                {isDone ? <i data-lucide="check" className="w-6 h-6 stroke-[3]"></i> : <div className="w-3 h-3 bg-gray-600 rounded-full"></div>}
                            </button>
                        )}
                        
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-medium text-lg truncate ${isDone ? 'text-gray-500 line-through' : ''}`}>{h.name}</h3>
                            {!reorder && (
                                <div className="flex gap-3 mt-1 text-xs">
                                    <span className={`flex items-center ${h.currentStreak > 0 ? 'text-orange-400' : 'text-gray-500'}`}>
                                        <i data-lucide="flame" className="w-3 h-3 mr-1"></i> {h.currentStreak}
                                    </span>
                                    <span className="text-gray-600 flex items-center">
                                        <i data-lucide="trophy" className="w-3 h-3 mr-1"></i> {h.maxStreak}
                                    </span>
                                </div>
                            )}
                        </div>

                        {!reorder && (
                            <button onClick={() => deleteHabit(h.id)} className="p-2 text-gray-600 hover:text-red-400">
                                <i data-lucide="trash-2" className="w-5 h-5"></i>
                            </button>
                        )}
                    </div>
                );
            })}
        </div>

        {/* Add Button */}
        {!reorder && (
            <button onClick={() => setShowAdd(true)} className="fixed bottom-24 right-6 w-14 h-14 bg-orange-500 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-orange-600 transition-transform active:scale-90 z-50">
                <i data-lucide="plus" className="w-8 h-8"></i>
            </button>
        )}

        {/* Modal */}
        {showAdd && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={() => setShowAdd(false)}>
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

// --- THIS IS THE FULLY UPDATED FRIENDS PAGE ---
function FriendsPage({ profile, userId }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendEmail, setFriendEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);

  // --- 1. Main Leaderboard Fetcher ---
  const fetchFriendData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let friendIds = profile.friends || [];
      let allUserIds = [...friendIds, userId];
      
      let leaderboardData = [];
      for (const uid of allUserIds) {
          const userProfileSnap = await db.collection("profiles").doc(uid).get();
          if (!userProfileSnap.exists) continue;
          
          const userProfile = userProfileSnap.data();
          const habitsSnapshot = await db.collection("users").doc(uid).collection("habits").get();
          
          let totalCurrentStreak = 0;
          habitsSnapshot.forEach(doc => {
              totalCurrentStreak += (doc.data().currentStreak || 0);
          });
          
          leaderboardData.push({ ...userProfile, totalScore: totalCurrentStreak });
      }
      
      leaderboardData.sort((a, b) => b.totalScore - a.totalScore);
      setLeaderboard(leaderboardData);

    } catch (e) {
      console.error("Error fetching friend data: ", e);
      setError("Could not load friend data.");
    }
    setLoading(false);
  }, [profile, userId]);

  // --- 2. Friend Request Fetcher ---
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

  // --- 3. useEffects to run fetchers ---
  useEffect(() => {
    fetchFriendData();
  }, [fetchFriendData]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);
  
  useEffect(() => { 
      window.lucide.createIcons(); 
  }, [loading, leaderboard, loadingRequests, receivedRequests, sentRequests]);

  // --- 4. Handler Functions ---
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
      if (profile.friends.includes(friendProfile.uid)) throw new Error("Already friends.");
      
      const existingReqQuery = db.collection("friendRequests")
          .where('senderId', '==', userId)
          .where('receiverId', '==', friendProfile.uid);
      const existingReqSnap = await existingReqQuery.get();
      if (!existingReqSnap.empty) throw new Error("Request already sent.");

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

  const handleAcceptRequest = async (senderId, requestId) => {
      try {
          await db.collection("profiles").doc(userId).update({
              friends: firebase.firestore.FieldValue.arrayUnion(senderId)
          });
          await db.collection("profiles").doc(senderId).update({
              friends: firebase.firestore.FieldValue.arrayUnion(userId)
          });
          await db.collection("friendRequests").doc(requestId).update({
              status: "accepted"
          });
          
          fetchRequests(); 
          // No need to call fetchFriendData(), the profile snapshot listener in App.jsx will do it.
      } catch (e) {
          console.error("Error accepting request:", e);
          setError("Failed to accept request.");
      }
  };

  const handleDeleteRequest = async (requestId) => {
      try {
          await db.collection("friendRequests").doc(requestId).delete();
          fetchRequests();
      } catch (e) {
          console.error("Error deleting request:", e);
          setError("Failed to delete request.");
      }
  };

  const handleRemoveFriend = async (friendUid) => {
      if (!confirm('Are you sure you want to remove this friend?')) return;
      
      try {
          // Remove friend from self
          await db.collection("profiles").doc(userId).update({
              friends: firebase.firestore.FieldValue.arrayRemove(friendUid)
          });
          // Remove self from friend
          await db.collection("profiles").doc(friendUid).update({
              friends: firebase.firestore.FieldValue.arrayRemove(userId)
          });
          
          // The snapshot listener in App.jsx will automatically
          // update the profile and trigger a re-fetch of the leaderboard.
      } catch (e) {
          console.error("Error removing friend:", e);
          setError("Failed to remove friend.");
      }
  };

  // --- 5. Render JSX ---
  return (
    <div className="p-4 pb-24 space-y-6">
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
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                                <span className="flex-grow font-semibold">{user.displayName}</span>
                                <button onClick={() => handleDeleteRequest(user.requestId)} className="p-2 text-gray-500 hover:text-red-500"><i data-lucide="x" className="w-5 h-5"></i></button>
                                <button onClick={() => handleAcceptRequest(user.uid, user.requestId)} className="p-2 text-gray-500 hover:text-green-500"><i data-lucide="check" className="w-5 h-5"></i></button>
                            </div>
                        ))}
                    </div>
                )}
                {sentRequests.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-gray-400">Sent</h3>
                        {sentRequests.map(user => (
                            <div key={user.uid} className="flex items-center gap-3 p-3 rounded-lg bg-gray-900">
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                                <span className="flex-grow font-semibold">{user.displayName}</span>
                                <button onClick={() => handleDeleteRequest(user.requestId)} className="p-2 text-gray-500 hover:text-red-500">
                                    <i data-lucide="x-circle" className="w-5 h-5"></i>
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
          <i data-lucide="trophy" className="text-yellow-500"></i>
          Leaderboard (Current Streaks)
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
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-grow">
                  <p className={`font-semibold ${user.uid === userId ? 'text-orange-400' : 'text-white'}`}>
                    {user.displayName} {user.uid === userId && '(You)'}
                  </p>
                </div>
                <span className="font-bold text-lg text-orange-400">
                  {user.totalScore} 🔥
                </span>

                {user.uid !== userId && (
                    <button 
                        onClick={() => handleRemoveFriend(user.uid)} 
                        className="p-2 text-gray-600 hover:text-red-500"
                        title="Remove friend"
                    >
                        <i data-lucide="user-x" className="w-5 h-5"></i>
                    </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
// --- END OF UPDATED FRIENDS PAGE ---


function ProfilePage({ profile }) {
    useEffect(() => { window.lucide.createIcons(); }, []);
    
    const handleSignOut = async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    if (!profile) {
        return <LoadingSpinner fullScreen />;
    }

    return (
        <div className="p-4 max-w-lg mx-auto pb-24">
            <h1 className="text-3xl font-bold text-white mb-6 text-center">Profile</h1>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col items-center border border-gray-700">
                <img 
                    src={profile.photoURL}
                    alt={profile.displayName}
                    className="w-32 h-32 rounded-full mb-4 ring-4 ring-orange-500/50"
                />
                <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
                <p className="text-gray-400 text-lg mb-6">{profile.email}</p>
                
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 transition-all"
                >
                    <i data-lucide="log-out" className="w-5 h-5"></i>
                    Sign Out
                </button>
            </div>
        </div>
    );
}

// --- 6. MAIN APP ---

const App = () => {
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    // App-wide state
    const [profile, setProfile] = useState(null);
    const [habits, setHabits] = useState([]);
    const [completions, setCompletions] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard');

    // --- Auth Listener ---
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

    // --- Data Listeners ---
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
        
        // Fallback for habits if 'order' is not managed
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

    // --- Icon Refresher (BUG FIX) ---
    useEffect(() => {
        window.lucide.createIcons();
    }, [
        currentView, 
        profile, 
        isAuthReady,
        habits.length, // Only re-run when habits are added/removed
        completions.length // Only re-run when completions are added/removed
    ]);

    // --- Render Logic ---
    
    if (!isAuthReady) {
        return <LoadingSpinner fullScreen />;
    }

    if (!user) {
        return <AuthPage />;
    }

    return (
        <div className="max-w-md mx-auto bg-gray-900 min-h-screen flex flex-col relative border-x border-gray-800 shadow-2xl">
            <main className="flex-1">
                {currentView === 'dashboard' && (
                    <DashboardPage 
                        userId={user.uid}
                        habits={habits}
                        completions={completions}
                    />
                )}
                {currentView === 'friends' && <FriendsPage profile={profile} userId={user.uid} />}
                {currentView === 'profile' && <ProfilePage profile={profile} />}
            </main>
            
            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 h-20 bg-gray-900 border-t border-gray-800 flex justify-around items-center max-w-md mx-auto z-50">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`flex flex-col items-center justify-center h-full px-4 ${currentView === 'dashboard' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <i data-lucide="layout-dashboard" className="w-6 h-6"></i>
                    <span className="text-xs mt-1">Dashboard</span>
                </button>
                <button
                    onClick={() => setCurrentView('friends')}
                    className={`flex flex-col items-center justify-center h-full px-4 ${currentView === 'friends' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <i data-lucide="users" className="w-6 h-6"></i>
                    <span className="text-xs mt-1">Friends</span>
                </button>
                <button
                    onClick={() => setCurrentView('profile')}
                    className={`flex flex-col items-center justify-center h-full px-4 ${currentView === 'profile' ? 'text-orange-500' : 'text-gray-500'}`}
                >
                    <i data-lucide="user" className="w-6 h-6"></i>
                    <span className="text-xs mt-1">Profile</span>
                </button>
            </nav>
        </div>
    );
};

export default App;

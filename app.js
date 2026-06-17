// --- FIREBASE V12 MODÜLER SDK IMPORTLARI ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, remove, query, orderByChild, limitToFirst, push } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// --- FIREBASE YAPILANDIRMASI (CONFIG) ---
const firebaseConfig = {
    apiKey: "AIzaSyC3cxEzea0zLCNy2uYHezJ1XO6m0XuIfBk",
    authDomain: "xoxserver.firebaseapp.com",
    projectId: "xoxserver",
    storageBucket: "xoxserver.firebasestorage.app",
    messagingSenderId: "365961516895",
    appId: "1:365961516895:web:0f257881dfa6f8b8b148ea"
};

// Başlatıcılar
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --- OYUN DEĞİŞKENLERİ ---
let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameMode = ""; 
let isMyTurn = true;
let myRole = "X";
let gameId = null;
let gameActive = false;
let userEmail = "";
let gameStartTime = 0;
let soundEnabled = localStorage.getItem("soundEnabled") !== "false";
let roomListenerUnsubscribe = null; // Aktif dinleyiciyi kapatmak için

// --- DOM ELEMANLARI ---
const statusTxt = document.getElementById("status");
const cells = document.querySelectorAll(".cell");
const authBox = document.getElementById("auth-box");
const menuBox = document.getElementById("menu");
const gameBoardBox = document.getElementById("game-board");
const resetBtn = document.getElementById("reset-btn");

// --- GLOBAL OTURUM TAKİPÇİSİ (BUG 1 FİX) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        userEmail = user.email;
        statusTxt.innerText = `Hoş geldin, ${userEmail}`;
        authBox.classList.add("hidden");
        menuBox.classList.remove("hidden");
        document.getElementById("btn-settings-toggle").classList.remove("hidden");
        startNotificationLoop();
    } else {
        // Kullanıcı çıkış yaptıysa veya oturumu yoksa giriş ekranını göster
        authBox.classList.remove("hidden");
        menuBox.classList.add("hidden");
        gameBoardBox.classList.add("hidden");
        resetBtn.classList.add("hidden");
        document.getElementById("btn-settings-toggle").classList.add("hidden");
        statusTxt.innerText = "Giriş Yapmanız Bekleniyor...";
    }
});

// --- SES EFEKTİ SİSTEMİ (Web Audio API) ---
function playBeep(freq = 440, type = "sine") {
    if (!soundEnabled) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
        console.log("Ses çalma hatası:", e);
    }
}

// --- EVENT LISTENER'LAR ---
document.getElementById("btn-register").addEventListener("click", handleRegister);
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("btn-local").addEventListener("click", () => initGameSetting("local"));
document.getElementById("btn-ai").addEventListener("click", () => initGameSetting("ai"));
document.getElementById("btn-create-room").addEventListener("click", createOnlineRoom);
document.getElementById("btn-join-room").addEventListener("click", joinOnlineRoom);
resetBtn.addEventListener("click", returnToMenu); // Artık sayfayı yenilemiyor, menüye güvenli dönüyor.
cells.forEach(cell => cell.addEventListener("click", () => handleCellClick(cell)));

document.getElementById("btn-leaderboard-toggle").addEventListener("click", openLeaderboard);
document.getElementById("btn-close-leaderboard").addEventListener("click", () => document.getElementById("leaderboard-modal").classList.add("hidden"));
document.getElementById("btn-settings-toggle").addEventListener("click", openSettings);
document.getElementById("btn-close-settings").addEventListener("click", saveSettings);

// --- GİRİŞ VE KAYIT SİSTEMİ ---
function handleRegister() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    if(!email || !password) return alert("Lütfen alanları doldurun!");
    createUserWithEmailAndPassword(auth, email, password)
        .then(() => alert("Kayıt başarılı! Otomatik giriş yapılıyor..."))
        .catch((err) => alert("Kayıt Hatası: " + err.message));
}

function handleLogin() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    if(!email || !password) return alert("Lütfen alanları doldurun!");
    signInWithEmailAndPassword(auth, email, password)
        .catch((err) => alert("Giriş Hatası: " + err.message));
}

// --- MOD SEÇİMLERİ VE GENEL AYARLAR ---
function initGameSetting(mode) {
    gameMode = mode;
    gameActive = true;
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    isMyTurn = true;
    gameStartTime = Date.now();
    
    menuBox.classList.add("hidden");
    gameBoardBox.classList.remove("hidden");
    resetBtn.classList.remove("hidden");
    
    if (mode === "local") statusTxt.innerText = "Sıra: OYUNCU X";
    if (mode === "ai") statusTxt.innerText = "Senin Sıran (X)";
    updateUI();
}

function openSettings() {
    document.getElementById("setting-sound").checked = soundEnabled;
    document.getElementById("settings-modal").classList.remove("hidden");
}

function saveSettings() {
    soundEnabled = document.getElementById("setting-sound").checked;
    localStorage.setItem("soundEnabled", soundEnabled);
    document.getElementById("settings-modal").classList.add("hidden");
}

// --- SKOR TABLOSU (BUG 2 FİX) ---
function openLeaderboard() {
    const listContainer = document.getElementById("leaderboard-list");
    listContainer.innerHTML = "<li>Yükleniyor...</li>";
    document.getElementById("leaderboard-modal").classList.remove("hidden");

    const scoresRef = query(ref(database, "scores"), orderByChild("duration"), limitToFirst(5));
    get(scoresRef).then((snapshot) => {
        listContainer.innerHTML = "";
        if (!snapshot.exists()) {
            listContainer.innerHTML = "<li>Henüz rekor kırılmadı!</li>";
            return;
        }
        let listItems = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const cleanEmail = data.email ? data.email.split("@")[0] : "Bilinmeyen";
            listItems.push(`<li><strong>${cleanEmail}</strong>: ${data.duration} saniye</li>`);
        });
        listContainer.innerHTML = listItems.join("");
    }).catch(err => {
        console.log("Skor tablosu hatası:", err);
        listContainer.innerHTML = "<li>Skorlar yüklenemedi.</li>";
    });
}

function saveScore(duration) {
    if(!userEmail) return;
    const scoresRef = ref(database, "scores");
    const newScoreRef = push(scoresRef);
    set(newScoreRef, {
        email: userEmail,
        duration: duration
    });
}

// --- PIN KODLU ONLINE ODA MANTIĞI (BUG 3 & 4 FİX) ---
function createOnlineRoom() {
    const pin = document.getElementById("room-pin").value;
    if (pin.length !== 6 || isNaN(pin)) {
        alert("Lütfen 6 haneli sayısal bir şifre girin!");
        return;
    }

    // Üzerine yazma hatasını engellemek için önce odayı kontrol et
    get(ref(database, `rooms/${pin}`)).then((snapshot) => {
        if (snapshot.exists() && snapshot.val().status !== "finished") {
            alert("Bu oda kodu zaten kullanımda! Lütfen başka bir kod girin.");
            return;
        }

        gameMode = "online"; gameId = pin; myRole = "X"; isMyTurn = true;

        set(ref(database, `rooms/${gameId}`), {
            status: "waiting",
            player1: userEmail,
            player2: "",
            board: ["", "", "", "", "", "", "", "", ""],
            turn: "X"
        }).then(() => {
            statusTxt.innerText = `${gameId} nolu oda kuruldu. Rakip bekleniyor...`;
            menuBox.classList.add("hidden");
            resetBtn.classList.remove("hidden");
            listenToRoom();
        });
    });
}

function joinOnlineRoom() {
    const pin = document.getElementById("room-pin").value;
    if (pin.length !== 6 || isNaN(pin)) { 
        alert("Lütfen 6 haneli geçerli bir şifre girin!"); 
        return; 
    }
    gameId = pin; myRole = "O"; isMyTurn = false;

    get(ref(database, `rooms/${gameId}`)).then((snapshot) => {
        if (!snapshot.exists()) { alert("Oda bulunamadı!"); return; }
        const roomData = snapshot.val();
        if (roomData.status !== "waiting") { alert("Oda zaten dolu veya oyun bitmiş!"); return; }

        update(ref(database, `rooms/${gameId}`), { 
            status: "playing", 
            player2: userEmail 
        }).then(() => {
            gameMode = "online";
            menuBox.classList.add("hidden");
            resetBtn.classList.remove("hidden");
            listenToRoom();
        });
    });
}

function listenToRoom() {
    if (roomListenerUnsubscribe) roomListenerUnsubscribe(); // Eski dinleyici varsa temizle

    const roomRef = ref(database, `rooms/${gameId}`);
    roomListenerUnsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // Maç başladıysa
        if (data.status === "playing") {
            if (!gameActive) {
                gameStartTime = Date.now(); 
            }
            gameBoardBox.classList.remove("hidden");
            board = data.board;
            updateUI();
            
            if (checkWin()) return;

            if (data.turn === myRole) {
                isMyTurn = true;
                statusTxt.innerText = `Senin Sıran (${myRole})`;
            } else {
                isMyTurn = false;
                statusTxt.innerText = "Rakibin Hamlesi Bekleniyor...";
            }
            gameActive = true;
        }
        
        // Diğer oyuncu kazandıysa ve durumu Firebase'de bitirdiyse (Senkronizasyon)
        if (data.status === "finished") {
            board = data.board;
            updateUI();
            gameActive = false;
            if (data.winner === myRole) {
                // Zaten localde tetiklenmiştir
            } else if (data.winner === "DRAW") {
                statusTxt.innerText = "BERABERE!";
            } else {
                playBeep(220, "sawtooth");
                statusTxt.innerText = `KAYBETTİN! Kazanan: ${data.winner}`;
            }
        }
    });
}

// --- OYUN MANTIĞI VE HAMLE KONTROLLERI ---
function handleCellClick(cell) {
    const index = cell.getAttribute("data-index");
    if (board[index] !== "" || !gameActive || !isMyTurn) return;

    playBeep(523, "sine"); 

    if (gameMode === "local") {
        board[index] = currentPlayer;
        updateUI();
        if (checkWin()) return;
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusTxt.innerText = `Sıra: OYUNCU ${currentPlayer}`;
    } 
    else if (gameMode === "ai") {
        board[index] = "X"; 
        updateUI();
        if (checkWin()) return;
        isMyTurn = false; 
        statusTxt.innerText = "Yapay Zeka Düşünüyor...";
        setTimeout(aiMove, 500);
    } 
    else if (gameMode === "online") {
        board[index] = myRole; 
        updateUI();
        isMyTurn = false;
        
        // Hamleyi gönder ve sırayı diğer oyuncuya devret
        const nextTurn = myRole === "X" ? "O" : "X";
        update(ref(database, `rooms/${gameId}`), {
            board: board,
            turn: nextTurn
        });
        checkWin();
    }
}

function aiMove() {
    let emptyCells = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (emptyCells.length > 0 && gameActive) {
        let randomIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[randomIdx] = "O";
        playBeep(392, "sine"); 
        updateUI();
        if (!checkWin()) { 
            isMyTurn = true; 
            statusTxt.innerText = "Senin Sıran (X)"; 
        }
    }
}

function updateUI() {
    cells.forEach((cell, idx) => { 
        cell.innerText = board[idx]; 
        cell.className = `cell ${board[idx]}`; 
    });
}

function checkWin() {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8], 
        [0,3,6], [1,4,7], [2,5,8], 
        [0,4,8], [2,4,6]           
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            gameActive = false;
            if (gameMode === "online") {
                const durationInSeconds = Math.round((Date.now() - gameStartTime) / 1000);
                // Maçı veri tabanında bitir (Diğer oyuncuya bilgi aktarımı)
                update(ref(database, `rooms/${gameId}`), {
                    status: "finished",
                    winner: board[a],
                    board: board
                });

                if (board[a] === myRole) {
                    playBeep(880, "triangle"); 
                    statusTxt.innerText = `KAZANDIN! (${durationInSeconds} Saniye)`;
                    saveScore(durationInSeconds); 
                }
            } else {
                playBeep(659, "triangle");
                statusTxt.innerText = `OYUNCU ${board[a]} KAZANDI!`;
            }
            return true;
        }
    }

    if (!board.includes("")) { 
        gameActive = false; 
        statusTxt.innerText = "BERABERE!"; 
        if (gameMode === "online") {
            update(ref(database, `rooms/${gameId}`), {
                status: "finished",
                winner: "DRAW",
                board: board
            });
        }
        return true; 
    }
    return false;
}

// --- MENÜYE GÜVENLİ DÖNÜŞ (BUG 1 KÖKTEN ÇÖZÜM) ---
function returnToMenu() {
    // Sayfayı yenilemeden tüm oyun statelerini ve UI sınıflarını temizle
    gameActive = false;
    board = ["", "", "", "", "", "", "", "", ""];
    
    if (gameMode === "online" && gameId && myRole === "X") { 
        // Eğer odayı kuran kişiysek ve çıkıyorsak odayı temizle
        remove(ref(database, `rooms/${gameId}`)); 
    }
    
    if (roomListenerUnsubscribe) {
        roomListenerUnsubscribe();
        roomListenerUnsubscribe = null;
    }

    gameId = null;
    gameMode = "";
    
    // UI Değişimi
    gameBoardBox.classList.add("hidden");
    resetBtn.classList.add("hidden");
    menuBox.classList.remove("hidden");
    statusTxt.innerText = `Hoş geldin, ${userEmail}`;
}

// --- PWA BİLDİRİMLERİ ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log("PWA Service Worker Aktif."))
        .catch(err => console.log("SW Kayıt Hatası:", err));
}

function startNotificationLoop() {
    if ('Notification' in window) {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
                navigator.serviceWorker.ready.then((registration) => {
                    if (registration.active) {
                        registration.active.postMessage({ type: 'SCHEDULE_NOTIFICATIONS' });
                    }
                });
            }
        });
    }
}


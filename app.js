// --- FIREBASE V12 MODÜLER SDK IMPORTLARI ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
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
let gameStartTime = 0; // Kronometre başlangıcı

// Tarayıcı hafızasından ses ayarını çek (Yoksa varsayılan olarak true yap)
let soundEnabled = localStorage.getItem("soundEnabled") !== "false";

// --- DOM ELEMANLARI ---
const statusTxt = document.getElementById("status");
const cells = document.querySelectorAll(".cell");

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

// --- EVENT LISTENER'LAR (BUTON BAĞLANTI AYARLARI) ---
document.getElementById("btn-register").addEventListener("click", handleRegister);
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("btn-local").addEventListener("click", () => initGameSetting("local"));
document.getElementById("btn-ai").addEventListener("click", () => initGameSetting("ai"));
document.getElementById("btn-create-room").addEventListener("click", createOnlineRoom);
document.getElementById("btn-join-room").addEventListener("click", joinOnlineRoom);
document.getElementById("reset-btn").addEventListener("click", resetGame);
cells.forEach(cell => cell.addEventListener("click", () => handleCellClick(cell)));

// Modal Pencereleri Tetikleyicileri
document.getElementById("btn-leaderboard-toggle").addEventListener("click", openLeaderboard);
document.getElementById("btn-close-leaderboard").addEventListener("click", () => document.getElementById("leaderboard-modal").classList.add("hidden"));
document.getElementById("btn-settings-toggle").addEventListener("click", openSettings);
document.getElementById("btn-close-settings").addEventListener("click", saveSettings);

// --- 1. KISIM: GİRİŞ VE KAYIT SİSTEMİ ---
function handleRegister() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert("Kayıt başarılı! Giriş yapılıyor...");
            loginSuccess(userCredential.user);
        }).catch((err) => alert("Kayıt Hatası: " + err.message));
}

function handleLogin() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            loginSuccess(userCredential.user);
        }).catch((err) => alert("Giriş Hatası: " + err.message));
}

function loginSuccess(user) {
    userEmail = user.email;
    statusTxt.innerText = `Hoş geldin, ${userEmail}`;
    document.getElementById("auth-box").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
    document.getElementById("btn-settings-toggle").classList.remove("hidden");
    
    // PWA Bildirim Döngüsünü başlat
    startNotificationLoop();
}

// --- 2. KISIM: MOD SEÇİMLERİ VE GENEL AYARLAR ---
function initGameSetting(mode) {
    gameMode = mode;
    gameActive = true;
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    isMyTurn = true;
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game-board").classList.remove("hidden");
    document.getElementById("reset-btn").classList.remove("hidden");
    
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

// --- 3. KISIM: SKOR TABLOSU (LEADERBOARD) ---
function openLeaderboard() {
    const listContainer = document.getElementById("leaderboard-list");
    listContainer.innerHTML = "Yükleniyor...";
    document.getElementById("leaderboard-modal").classList.remove("hidden");

    // "duration" alanına göre en düşük saniyeli ilk 5 rekoru getirir
    const scoresRef = query(ref(database, "scores"), orderByChild("duration"), limitToFirst(5));
    get(scoresRef).then((snapshot) => {
        listContainer.innerHTML = "";
        if (!snapshot.exists()) {
            listContainer.innerHTML = "Henüz rekor kırılmadı!";
            return;
        }
        let listItems = [];
        snapshot.forEach((childSnapshot) => {
            const data = childSnapshot.val();
            const cleanEmail = data.email.split("@")[0]; // E-postanın ön ekini al
            listItems.push(`<li><strong>${cleanEmail}</strong>: ${data.duration} saniye</li>`);
        });
        listContainer.innerHTML = listItems.join("");
    }).catch(err => console.log("Skor tablosu hatası:", err));
}

function saveScore(duration) {
    const scoresRef = ref(database, "scores");
    const newScoreRef = push(scoresRef);
    set(newScoreRef, {
        email: userEmail,
        duration: duration
    });
}

// --- 4. KISIM: PIN KODLU ONLINE ODA MANTIĞI ---
function createOnlineRoom() {
    const pin = document.getElementById("room-pin").value;
    if (pin.length !== 6 || isNaN(pin)) {
        alert("Lütfen 6 haneli sayısal bir şifre girin!");
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
        document.getElementById("menu").classList.add("hidden");
        document.getElementById("reset-btn").classList.remove("hidden");
        listenToRoom();
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
        if (roomData.status !== "waiting") { alert("Oda zaten dolu!"); return; }

        update(ref(database, `rooms/${gameId}`), { 
            status: "playing", 
            player2: userEmail 
        }).then(() => {
            gameMode = "online";
            document.getElementById("menu").classList.add("hidden");
            document.getElementById("reset-btn").classList.remove("hidden");
            listenToRoom();
        });
    });
}

function listenToRoom() {
    onValue(ref(database, `rooms/${gameId}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        if (data.status === "playing") {
            if (!gameActive) {
                gameStartTime = Date.now(); // Tahta aktifleştiği an sayacı başlat
            }
            document.getElementById("game-board").classList.remove("hidden");
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
    });
}

// --- 5. KISIM: OYUN MANTIĞI VE HAMLE KONTROLLERİ ---
function handleCellClick(cell) {
    const index = cell.getAttribute("data-index");
    if (board[index] !== "" || !gameActive || !isMyTurn) return;

    playBeep(523, "sine"); // Oyuncu hamle tık sesi (Do notası)

    if (gameMode === "local") {
        board[index] = currentPlayer;
        if (checkWin()) return;
        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusTxt.innerText = `Sıra: OYUNCU ${currentPlayer}`;
        updateUI();
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
        set(ref(database, `rooms/${gameId}/board`), board);
        set(ref(database, `rooms/${gameId}/turn`), myRole === "X" ? "O" : "X");
        checkWin();
    }
}

function aiMove() {
    let emptyCells = board.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
    if (emptyCells.length > 0 && gameActive) {
        let randomIdx = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        board[randomIdx] = "O";
        playBeep(392, "sine"); // Yapay zeka hamle tık sesi (Sol notası)
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
        [0,1,2], [3,4,5], [6,7,8], // Yataylar
        [0,3,6], [1,4,7], [2,5,8], // Dikeyler
        [0,4,8], [2,4,6]           // Çaprazlar
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            gameActive = false;
            if (gameMode === "online") {
                if (board[a] === myRole) {
                    playBeep(880, "triangle"); // Kazanma jingle'ı
                    const durationInSeconds = Math.round((Date.now() - gameStartTime) / 1000);
                    statusTxt.innerText = `KAZANDIN! (${durationInSeconds} Saniye)`;
                    saveScore(durationInSeconds); // Skoru veri tabanına yaz
                } else {
                    playBeep(220, "sawtooth"); // Kaybetme kalın sesi
                    statusTxt.innerText = "KAYBETTİN!";
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
        return true; 
    }
    return false;
}

function resetGame() {
    if (gameMode === "online" && gameId) { 
        remove(ref(database, `rooms/${gameId}`)); 
    }
    location.reload();
}

// --- 6. KISIM: PWA VE ZAMANLANMIŞ BİLDİRİMLER ---
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
                        // sw.js dosyasına 4 saat aralıklı 6 bildirimi planlaması emrini gönderir
                        registration.active.postMessage({ type: 'SCHEDULE_NOTIFICATIONS' });
                    }
                });
            }
        });
    }
}

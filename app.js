// Firebase v12 Modüler SDK Importları
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, remove } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// Ekrandan aldığımız tam Firebase v12 Config bilgilerin
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

// Oyun Değişkenleri
let board = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameMode = ""; 
let isMyTurn = true;
let myRole = "X";
let gameId = null;
let gameActive = false;
let userEmail = "";

// DOM Elemanları
const statusTxt = document.getElementById("status");
const cells = document.querySelectorAll(".cell");

// Event Listener'lar (Buton Bağlantıları)
document.getElementById("btn-register").addEventListener("click", handleRegister);
document.getElementById("btn-login").addEventListener("click", handleLogin);
document.getElementById("btn-local").addEventListener("click", () => initGameSetting("local"));
document.getElementById("btn-ai").addEventListener("click", () => initGameSetting("ai"));
document.getElementById("btn-create-room").addEventListener("click", createOnlineRoom);
document.getElementById("btn-join-room").addEventListener("click", joinOnlineRoom);
document.getElementById("reset-btn").addEventListener("click", resetGame);
cells.forEach(cell => cell.addEventListener("click", () => handleCellClick(cell)));

// --- GİRİŞ / KAYIT İŞLEMLERİ ---
function handleRegister() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert("Kayıt başarılı! Giriş yapılıyor...");
            loginSuccess(userCredential.user);
        }).catch((err) => alert("Hata: " + err.message));
}

function handleLogin() {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            loginSuccess(userCredential.user);
        }).catch((err) => alert("Hata: " + err.message));
}

function loginSuccess(user) {
    userEmail = user.email;
    statusTxt.innerText = `Hoş geldin, ${userEmail}`;
    document.getElementById("auth-box").classList.add("hidden");
    document.getElementById("menu").classList.remove("hidden");
}

// --- MOD AYARLARI ---
function initGameSetting(mode) {
    gameMode = mode;
    gameActive = true;
    board = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    isMyTurn = true;
    document.getElementById("menu").classList.add("hidden");
    document.getElementById("game-board").classList.remove("hidden");
    document.getElementById("reset-btn").classList.remove("hidden");
    
    if(mode === "local") statusTxt.innerText = "Sıra: OYUNCU X";
    if(mode === "ai") statusTxt.innerText = "Senin Sıran (X)";
    updateUI();
}

// --- 6 HANELİ PIN KODLU ODA SİSTEMİ ---
function createOnlineRoom() {
    const pin = document.getElementById("room-pin").value;
    if (pin.length !== 6 || isNaN(pin)) {
        alert("Lütfen 6 haneli sayısal bir şifre girin!");
        return;
    }

    gameMode = "online";
    gameId = pin; 
    myRole = "X";
    isMyTurn = true;

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

    gameId = pin;
    myRole = "O";
    isMyTurn = false;

    get(ref(database, `rooms/${gameId}`)).then((snapshot) => {
        if (!snapshot.exists()) {
            alert("Böyle bir oda bulunamadı ya da şifre yanlış!");
            return;
        }
        const roomData = snapshot.val();
        if (roomData.status !== "waiting") {
            alert("Bu oda zaten dolu!");
            return;
        }

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

// --- HAMLE KONTROLLERİ ---
function handleCellClick(cell) {
    const index = cell.getAttribute("data-index");
    if (board[index] !== "" || !gameActive || !isMyTurn) return;

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
            statusTxt.innerText = gameMode === "online" ? (board[a] === myRole ? "KAZANDIN!" : "KAYBETTİN!") : `OYUNCU ${board[a]} KAZANDI!`;
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


// ==================== KONFİGÜRASYON ====================
const CONFIG = {
    ADMIN_NAME: 'admin',
    ADMIN_HASH: '147258', // 'admin123' için örnek
    ACCESS_CODES: [
        '147258',
        // Diğer kodlar buraya eklenebilir
    ],
    DB_NAME: 'ZaferPartisiDB',
    DB_VERSION: 3,
    ITEMS_PER_PAGE: 10,
    SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 gün
    ENCRYPTION_KEY: 'zafer-partisi-gizli-anahtar-2026'
};

// ==================== GLOBAL STATE ====================
const state = {
    currentUser: null,
    isAdmin: false,
    useBiometric: false,
    members: [],
    currentPage: 1,
    editingId: null,
    db: null,
    map: null,
    mapMarkers: [],
    swRegistration: null,
    videoEnded: false
};

// ==================== KRYPTOGRAFİ ====================
const Crypto = {
    async sha256(message) {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async encrypt(text, password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const key = await this.getKey(password);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv);
        combined.set(new Uint8Array(encrypted), iv.length);
        return btoa(String.fromCharCode(...combined));
    },

    async decrypt(encryptedData, password) {
        try {
            const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const iv = data.slice(0, 12);
            const encrypted = data.slice(12);
            const key = await this.getKey(password);
            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encrypted
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error('Decryption error:', e);
            return null;
        }
    },

    async getKey(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            { 
                name: 'PBKDF2', 
                salt: encoder.encode('zafer-salt'), 
                iterations: 100000, 
                hash: 'SHA-256' 
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
};

// ==================== BİYOMETRİK KİMLİK DOĞRULAMA ====================
const BiometricAuth = {
    isSupported() {
        return window.PublicKeyCredential !== undefined;
    },

    async register() {
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: challenge,
                    rp: { name: 'Zafer Partisi', id: window.location.hostname },
                    user: {
                        id: new Uint8Array(16),
                        name: state.currentUser.fullName,
                        displayName: state.currentUser.fullName
                    },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    },
                    timeout: 60000,
                    attestation: 'direct'
                }
            });

            const credentialId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
            await DB.put('biometric', { 
                id: 'credential', 
                data: credentialId,
                user: state.currentUser.fullName,
                timestamp: Date.now()
            });
            return true;
        } catch (err) {
            console.error('Biometric registration error:', err);
            return false;
        }
    },

    async authenticate() {
        try {
            const stored = await DB.get('biometric', 'credential');
            if (!stored) return false;

            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: challenge,
                    allowCredentials: [{
                        id: Uint8Array.from(atob(stored.data), c => c.charCodeAt(0)),
                        type: 'public-key',
                        transports: ['internal']
                    }],
                    userVerification: 'required',
                    timeout: 60000
                }
            });

            return !!assertion;
        } catch (err) {
            console.error('Biometric auth error:', err);
            return false;
        }
    }
};

// ==================== VERİTABANI (IndexedDB) ====================
const DB = {
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                state.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('members')) {
                    const store = db.createObjectStore('members', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                
                if (!db.objectStoreNames.contains('biometric')) {
                    db.createObjectStore('biometric', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('mapTiles')) {
                    db.createObjectStore('mapTiles', { keyPath: 'url' });
                }
            };
        });
    },

    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const tx = state.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = state.db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const request = key ? store.get(key) : store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const tx = state.db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};

// ==================== SERVICE WORKER & PUSH NOTIFICATION ====================
const SW_CODE = `
const CACHE_NAME = 'zafer-v3';
const TILE_CACHE = 'map-tiles-v1';

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => 
            cache.addAll(['/', '/index.html', '/style.css', '/app.js'])
        )
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(names => 
            Promise.all(names.filter(n => n !== CACHE_NAME && n !== TILE_CACHE).map(n => caches.delete(n)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    
    if (url.hostname.includes('tile.openstreetmap.org')) {
        e.respondWith(
            caches.open(TILE_CACHE).then(cache => 
                cache.match(e.request).then(response => {
                    if (response) return response;
                    return fetch(e.request).then(fetchResponse => {
                        cache.put(e.request, fetchResponse.clone());
                        return fetchResponse;
                    }).catch(() => new Response('', {status: 503}));
                })
            )
        );
        return;
    }
    
    e.respondWith(
        caches.match(e.request).then(response => 
            response || fetch(e.request).catch(() => new Response('Offline', {status: 503}))
        )
    );
});

self.addEventListener('push', e => {
    const data = e.data.json();
    e.waitUntil(
        self.registration.showNotification('Zafer Partisi', {
            body: data.body,
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            badge: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            vibrate: [200, 100, 200],
            data: data.data || {},
            actions: [
                {action: 'open', title: 'Aç'},
                {action: 'close', title: 'Kapat'}
            ]
        })
    );
});

self.addEventListener('notificationclick', e => {
    e.notification.close();
    if (e.action === 'open' || !e.action) {
        e.waitUntil(clients.openWindow(e.notification.data.url || '/'));
    }
});

self.addEventListener('sync', e => {
    if (e.tag === 'sync-members') {
        e.waitUntil(syncMembers());
    }
});

async function syncMembers() {
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({type: 'SYNC_COMPLETE'}));
}
`;

async function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
        const blob = new Blob([SW_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        state.swRegistration = await navigator.serviceWorker.register(url);
        
        if ('PushManager' in window) {
            const permission = await Notification.requestPermission();
            console.log('Push permission:', permission);
        }
    } catch (err) {
        console.error('SW registration failed:', err);
    }
}

async function sendPushNotification(title, body, data = {}) {
    if (state.swRegistration && Notification.permission === 'granted') {
        await state.swRegistration.showNotification(title, {
            body,
            icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            badge: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            vibrate: [200, 100, 200],
            data
        });
    }
}

// ==================== UI FONKSİYONLARI ====================
function showLoader(show = true) {
    document.getElementById('loader').style.display = show ? 'flex' : 'none';
}

function showToast(message, icon = '📡') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-icon').textContent = icon;
    document.getElementById('toast-msg').textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateOfflineStatus() {
    const bar = document.getElementById('offline-bar');
    if (navigator.onLine) {
        bar.classList.remove('show');
        showToast('İnternet bağlantısı sağlandı', '🌐');
        if (state.swRegistration && 'sync' in state.swRegistration) {
            state.swRegistration.sync.register('sync-members');
        }
    } else {
        bar.classList.add('show');
        showToast('Çevrimdışı mod aktif', '⚠️');
    }
}

// ==================== VIDEO YÖNETİMİ ====================
function initVideo() {
    const video = document.getElementById('splash-video');
    const splash = document.getElementById('splash-screen');
    let hasEnded = false;
    
    const endVideo = () => {
        if (hasEnded) return;
        hasEnded = true;
        state.videoEnded = true;
        splash.classList.add('hidden');
        setTimeout(() => {
            splash.style.display = 'none';
            navigateTo('login');
        }, 800);
    };
    
    // Video bitiş olayları
    video.addEventListener('ended', endVideo);
    video.addEventListener('error', () => {
        console.log('Video error, skipping...');
        endVideo();
    });
    
    // iOS için timeupdate kontrolü
    video.addEventListener('timeupdate', () => {
        if (video.duration && video.currentTime >= video.duration - 0.5) {
            endVideo();
        }
    });
    
    // Metadata yüklenemezse
    video.addEventListener('stalled', () => {
        setTimeout(endVideo, 1000);
    });
    
    // Zorunlu timeout (10 saniye)
    setTimeout(endVideo, 10000);
}

function forceSkipVideo() {
    if (!state.videoEnded) {
        const video = document.getElementById('splash-video');
        video.pause();
        video.dispatchEvent(new Event('ended'));
    }
}

// ==================== NAVİGASYON ====================
function navigateTo(screenId) {
    // Önce tüm ekranları gizle
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
    // Hedef ekranı göster
    const target = document.getElementById(screenId + '-screen');
    if (target) {
        target.classList.add('active');
        
        // Ekran spesifik işlemler
        if (screenId === 'list') {
            loadMembers();
        } else if (screenId === 'map') {
            setTimeout(initMap, 100);
        }
    }
    
    // URL'i güncelle (SEO için)
    history.pushState({screen: screenId}, '', '#' + screenId);
}

// ==================== KULLANICI İŞLEMLERİ ====================
async function handleLogin() {
    const firstName = document.getElementById('input-firstname').value.trim();
    const lastName = document.getElementById('input-lastname').value.trim();
    const code = document.getElementById('input-code').value.trim();
    
    if (!firstName || !lastName || !code) {
        showToast('Tüm alanları doldurun', '⚠️');
        return;
    }
    
    showLoader(true);
    
    try {
        const codeHash = await Crypto.sha256(code);
        const isValid = CONFIG.ACCESS_CODES.includes(codeHash);
        
        if (!isValid) {
            showToast('Geçersiz erişim kodu', '❌');
            showLoader(false);
            return;
        }
        
        const fullName = firstName + ' ' + lastName;
        const isAdmin = fullName === CONFIG.ADMIN_NAME && codeHash === CONFIG.ADMIN_HASH;
        
        // Biyometrik doğrulama (Admin için zorunlu)
        if (state.useBiometric || isAdmin) {
            const bioSuccess = await BiometricAuth.authenticate();
            if (!bioSuccess && isAdmin) {
                showToast('Admin girişi için biyometrik gerekli', '👆');
                showLoader(false);
                return;
            }
        }
        
        state.currentUser = { firstName, lastName, fullName };
        state.isAdmin = isAdmin;
        
        // Session'ı şifrele ve kaydet
        const sessionData = await Crypto.encrypt(
            JSON.stringify({
                user: state.currentUser,
                isAdmin: isAdmin,
                timestamp: Date.now()
            }),
            code
        );
        localStorage.setItem('session', sessionData);
        
        // Admin için biyometrik kayıt (ilk kez)
        if (isAdmin && BiometricAuth.isSupported()) {
            const hasBio = await DB.get('biometric', 'credential');
            if (!hasBio) {
                await BiometricAuth.register();
            }
        }
        
        // Kullanıcı adını göster
        document.getElementById('user-display').textContent = `Hoş geldin, ${fullName}`;
        
        showLoader(false);
        navigateTo('main');
        
        if (isAdmin) {
            document.getElementById('btn-add').classList.add('visible');
            document.getElementById('update-badge').classList.add('show');
            sendPushNotification('Giriş Başarılı', `${fullName} olarak giriş yapıldı`);
        }
        
    } catch (err) {
        console.error('Login error:', err);
        showToast('Giriş yapılırken hata oluştu', '❌');
        showLoader(false);
    }
}

async function toggleBiometric() {
    const btn = document.getElementById('btn-bio');
    
    if (state.useBiometric) {
        state.useBiometric = false;
        btn.classList.remove('active');
        btn.querySelector('.bio-text').textContent = 'Biyometrik Doğrulama ile Giriş';
    } else {
        if (BiometricAuth.isSupported()) {
            state.useBiometric = true;
            btn.classList.add('active');
            btn.querySelector('.bio-text').textContent = 'Biyometrik Aktif';
            showToast('Biyometrik doğrulama etkinleştirildi', '✓');
        } else {
            showToast('Cihazınız desteklemiyor', '⚠️');
        }
    }
}

// ==================== TEMA YÖNETİMİ ====================
function toggleSettings() {
    document.getElementById('theme-panel').classList.toggle('show');
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme === 'default' ? '' : theme);
    localStorage.setItem('theme', theme);
    
    document.querySelectorAll('.theme-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    setTimeout(() => {
        document.getElementById('theme-panel').classList.remove('show');
    }, 200);
}

function showNotifications() {
    document.getElementById('update-badge').classList.remove('show');
    showToast('Yeni bildirimler kontrol ediliyor...', '🔔');
}

// ==================== ÜYE YÖNETİMİ (CRUD) ====================
async function loadMembers() {
    state.members = await DB.get('members') || [];
    renderMembers();
}

function renderMembers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filtered = state.members.filter(m => 
        m.name.toLowerCase().includes(searchTerm) || 
        m.description.toLowerCase().includes(searchTerm)
    );
    
    const start = (state.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, end);
    
    const container = document.getElementById('members-list');
    container.innerHTML = '';
    
    pageItems.forEach(member => {
        const card = createMemberCard(member);
        container.appendChild(card);
    });
    
    // Pagination bilgisi
    const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE) || 1;
    document.getElementById('page-info').textContent = `${state.currentPage} / ${totalPages}`;
    
    const buttons = document.querySelectorAll('.page-btn');
    buttons[0].disabled = state.currentPage === 1;
    buttons[1].disabled = state.currentPage >= totalPages;
}

function createMemberCard(member) {
    const div = document.createElement('div');
    div.className = 'member-card';
    
    const defaultAvatar = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" font-size="40" text-anchor="middle" dy=".3em">👤</text></svg>';
    
    let socialHtml = '';
    if (member.x) socialHtml += `<div class="social-btn" onclick="window.open('${member.x}', '_blank')">𝕏</div>`;
    if (member.ig) socialHtml += `<div class="social-btn" onclick="window.open('${member.ig}', '_blank')">📷</div>`;
    if (member.li) socialHtml += `<div class="social-btn" onclick="window.open('${member.li}', '_blank')">💼</div>`;
    if (member.web) socialHtml += `<div class="social-btn" onclick="window.open('${member.web}', '_blank')">🌐</div>`;
    
    div.innerHTML = `
        <div class="member-avatar">
            <img src="${member.photo || defaultAvatar}" onerror="this.src='${defaultAvatar}'" alt="${member.name}">
        </div>
        <div class="member-details">
            <div class="member-name">${escapeHtml(member.name)}</div>
            <div class="member-role">${escapeHtml(member.description)}</div>
            <div class="member-socials">${socialHtml}</div>
        </div>
        ${state.isAdmin ? `<button class="edit-btn" onclick="editMember(${member.id})">✏️</button>` : ''}
    `;
    
    return div;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function changePage(delta) {
    state.currentPage += delta;
    renderMembers();
}

// ==================== MODAL İŞLEMLERİ ====================
function openModal() {
    state.editingId = null;
    document.getElementById('modal-title').textContent = 'Yeni Üye Ekle';
    document.getElementById('btn-delete').style.display = 'none';
    
    // Form temizle
    ['m-photo', 'm-name', 'm-desc', 'm-lat', 'm-lng', 'm-x', 'm-ig', 'm-li', 'm-web'].forEach(id => {
        document.getElementById(id).value = '';
    });
    
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

async function editMember(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;
    
    state.editingId = id;
    document.getElementById('modal-title').textContent = 'Üye Düzenle';
    document.getElementById('btn-delete').style.display = 'block';
    
    document.getElementById('m-photo').value = member.photo || '';
    document.getElementById('m-name').value = member.name;
    document.getElementById('m-desc').value = member.description;
    document.getElementById('m-lat').value = member.lat || '';
    document.getElementById('m-lng').value = member.lng || '';
    document.getElementById('m-x').value = member.x || '';
    document.getElementById('m-ig').value = member.ig || '';
    document.getElementById('m-li').value = member.li || '';
    document.getElementById('m-web').value = member.web || '';
    
    document.getElementById('modal').classList.add('show');
}

async function saveMember() {
    const name = document.getElementById('m-name').value.trim();
    if (!name) {
        showToast('Ad Soyad zorunludur', '⚠️');
        return;
    }
    
    const memberData = {
        photo: document.getElementById('m-photo').value.trim() || null,
        name: name,
        description: document.getElementById('m-desc').value.trim(),
        lat: parseFloat(document.getElementById('m-lat').value) || null,
        lng: parseFloat(document.getElementById('m-lng').value) || null,
        x: document.getElementById('m-x').value.trim(),
        ig: document.getElementById('m-ig').value.trim(),
        li: document.getElementById('m-li').value.trim(),
        web: document.getElementById('m-web').value.trim(),
        updatedAt: Date.now()
    };
    
    if (state.editingId) {
        memberData.id = state.editingId;
    }
    
    await DB.put('members', memberData);
    
    if (!state.editingId) {
        sendPushNotification('Yeni Üye', `${name} sisteme eklendi`);
    }
    
    closeModal();
    loadMembers();
    if (state.map) plotMarkers();
}

async function deleteMember() {
    if (!state.editingId || !confirm('Bu üyeyi silmek istediğinize emin misiniz?')) return;
    
    await DB.delete('members', state.editingId);
    closeModal();
    loadMembers();
    if (state.map) plotMarkers();
    showToast('Üye silindi', '🗑️');
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        showToast('Cihazınız konum desteklemiyor', '⚠️');
        return;
    }
    
    try {
        showToast('Konum alınıyor...', '📍');
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            });
        });
        
        document.getElementById('m-lat').value = position.coords.latitude.toFixed(6);
        document.getElementById('m-lng').value = position.coords.longitude.toFixed(6);
        showToast('Konum alındı', '✓');
    } catch (err) {
        showToast('Konum alınamadı: ' + err.message, '❌');
    }
}

// ==================== HARİTA ====================
function initMap() {
    if (state.map) {
        state.map.invalidateSize();
        plotMarkers();
        return;
    }
    
    state.map = L.map('map').setView([39.9334, 32.8597], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        crossOrigin: true
    }).addTo(state.map);
    
    plotMarkers();
}

function plotMarkers() {
    state.mapMarkers.forEach(m => state.map.removeLayer(m));
    state.mapMarkers = [];
    
    state.members.forEach(member => {
        if (member.lat && member.lng) {
            const marker = L.marker([member.lat, member.lng])
                .addTo(state.map)
                .bindPopup(`
                    <b style="color:var(--accent);font-size:16px">${member.name}</b><br>
                    ${member.description}<br>
                    <button onclick="window.open('${member.web || '#'}', '_blank')" 
                        style="margin-top:8px;padding:6px 12px;background:#003366;color:white;border:none;border-radius:6px;cursor:pointer">
                        Profil
                    </button>
                `);
            state.mapMarkers.push(marker);
        }
    });
}

function refreshMap() {
    if (state.map) {
        state.map.invalidateSize();
        plotMarkers();
        showToast('Harita güncellendi', '🗺️');
    }
}

// ==================== GÜVENLİK ====================
(function initSecurity() {
    // DevTools algılama
    const threshold = 160;
    setInterval(() => {
        const widthDiff = window.outerWidth - window.innerWidth > threshold;
        const heightDiff = window.outerHeight - window.innerHeight > threshold;
        
        if (widthDiff || heightDiff) {
            document.getElementById('security-block').style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            document.getElementById('security-block').style.display = 'none';
            document.body.style.overflow = '';
        }
    }, 500);
    
    // Debugger engelleme
    setInterval(() => {
        const start = new Date();
        debugger;
        const end = new Date();
        if (end - start > 100) {
            window.location.href = 'about:blank';
        }
    }, 100);
    
    // Sağ tık menüsü (opsiyonel)
    // document.addEventListener('contextmenu', e => e.preventDefault());
})();

// ==================== BAŞLATMA ====================
async function init() {
    // Kayıtlı temayı uygula
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme && savedTheme !== 'default') {
        document.body.setAttribute('data-theme', savedTheme);
    }
    
    // Veritabanını başlat
    await DB.init();
    
    // Service Worker'ı başlat
    await initServiceWorker();
    
    // Ağ durumunu izle
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
    
    // Video başlat
    initVideo();
    
    // Back button desteği
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.screen) {
            navigateTo(e.state.screen);
        }
    });
}

// Başlat
init();

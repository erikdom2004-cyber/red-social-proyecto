document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    let currentChatId = 'global-chat';
    let currentUser = { id: null, name: '', avatar: '', bio: '¡Usando SocialApp!', presenceStatus: 'Disponible', friends: [] };

    const authModal = document.getElementById('auth-modal');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const btnShowLogin = document.getElementById('btn-show-login');
    const btnShowRegister = document.getElementById('btn-show-register');
    const appLayout = document.getElementById('app-layout');
    const conversationsList = document.getElementById('conversations-list');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    function showLoading(text) {
        if (loadingText && loadingOverlay) {
            loadingText.textContent = text || 'Cargando...';
            loadingOverlay.style.display = 'flex';
        }
    }

    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    // AUTO-LOGIN LOCALSTORAGE
    const savedUser = localStorage.getItem('socialapp_saved_user');
    if (savedUser) {
        showLoading('Iniciando sesión guardada...');
        const parsed = JSON.parse(savedUser);
        socket.emit('login', { username: parsed.username, password: parsed.password });
    }

    if (btnShowLogin && btnShowRegister) {
        btnShowLogin.addEventListener('click', () => {
            btnShowLogin.classList.add('active');
            btnShowRegister.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        });

        btnShowRegister.addEventListener('click', () => {
            btnShowRegister.classList.add('active');
            btnShowLogin.classList.remove('active');
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        });
    }

    // LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading('Autenticando usuario...');
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value.trim();

            socket.emit('login', { username, password });
        });
    }

    // REGISTRO
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading('Creando nueva cuenta...');
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();

            socket.emit('register', { username, password });
        });
    }

    socket.on('authSuccess', (user) => {
        hideLoading();
        currentUser.id = user._id;
        currentUser.name = user.username;
        currentUser.avatar = user.avatar;
        currentUser.bio = user.bio || "¡Usando SocialApp!";
        currentUser.presenceStatus = user.presenceStatus || "Disponible";
        currentUser.friends = user.friends || [];

        const passElem = document.getElementById('login-password') || document.getElementById('reg-password');
        const pass = passElem ? passElem.value : '123';
        if (pass) {
            localStorage.setItem('socialapp_saved_user', JSON.stringify({ username: user.username, password: pass }));
        }

        updateMyProfileUI();

        if (authModal) authModal.style.display = 'none';
        if (appLayout) appLayout.style.display = 'flex';

        currentUser.friends.forEach(friendName => {
            addFriendCardToUI(friendName, `https://api.dicebear.com/7.x/bottts/svg?seed=${friendName}`);
        });

        socket.emit('loadInitialData');
        selectChat('global-chat', 'Sala Global', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop');
    });

    socket.on('authError', (msg) => {
        hideLoading();
        alert(msg);
    });

    function updateMyProfileUI() {
        const myAvatar = document.getElementById('my-avatar-img');
        if (myAvatar) myAvatar.src = currentUser.avatar;

        const prevAvatar = document.getElementById('profile-edit-avatar-preview');
        if (prevAvatar) prevAvatar.src = currentUser.avatar;

        const nameDisp = document.getElementById('profile-edit-name-display');
        if (nameDisp) nameDisp.textContent = currentUser.name;

        const bioDisp = document.getElementById('profile-edit-bio-display');
        if (bioDisp) bioDisp.textContent = currentUser.bio;

        const statusDisp = document.getElementById('profile-edit-status-display');
        if (statusDisp) statusDisp.textContent = currentUser.presenceStatus;

        const avatarInput = document.getElementById('edit-profile-avatar-url');
        if (avatarInput) avatarInput.value = currentUser.avatar;

        const bioInput = document.getElementById('edit-profile-bio-input');
        if (bioInput) bioInput.value = currentUser.bio;

        const statusSelect = document.getElementById('edit-profile-status-select');
        if (statusSelect) statusSelect.value = currentUser.presenceStatus;
    }

    // EDITAR PERFIL
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading('Guardando perfil...');

            const newAvatar = document.getElementById('edit-profile-avatar-url').value.trim();
            const newBio = document.getElementById('edit-profile-bio-input').value.trim();
            const newStatus = document.getElementById('edit-profile-status-select').value;

            currentUser.avatar = newAvatar;
            currentUser.bio = newBio;
            currentUser.presenceStatus = newStatus;

            socket.emit('updateProfile', {
                username: currentUser.name,
                avatar: newAvatar,
                bio: newBio,
                presenceStatus: newStatus
            });
        });
    }

    socket.on('profileUpdated', (data) => {
        hideLoading();
        if (data.username === currentUser.name) {
            updateMyProfileUI();
            alert('¡Tu perfil ha sido actualizado!');
        }

        const cards = document.querySelectorAll(`[data-chat-name="${data.username}"]`);
        cards.forEach(card => {
            const img = card.querySelector('img');
            if (img) img.src = data.avatar;
            card.dataset.chatAvatar = data.avatar;
        });

        const activeTitle = document.getElementById('active-chat-title');
        if (activeTitle && activeTitle.textContent === data.username) {
            const activeAvatar = document.getElementById('active-chat-avatar');
            if (activeAvatar) activeAvatar.src = data.avatar;
            const activeStatus = document.getElementById('active-chat-status');
            if (activeStatus) activeStatus.textContent = data.presenceStatus;
        }
    });

    // LOGOUT
    function performLogout() {
        localStorage.removeItem('socialapp_saved_user');
        currentUser = { id: null, name: '', avatar: '', bio: 'Disponible', presenceStatus: 'Disponible', friends: [] };
        if (appLayout) appLayout.style.display = 'none';
        if (authModal) authModal.style.display = 'flex';
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', performLogout);

    const logoutBtnProf = document.getElementById('logout-btn-profile');
    if (logoutBtnProf) logoutBtnProf.addEventListener('click', performLogout);

    // BUSCADOR EN TIEMPO REAL
    const searchInput = document.getElementById('search-chats-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            document.querySelectorAll('.chat-card').forEach(card => {
                const name = card.dataset.chatName ? card.dataset.chatName.toLowerCase() : '';
                card.style.display = name.includes(query) ? 'flex' : 'none';
            });
        });
    }

    // AGREGAR CONTACTO
    const addFriendModal = document.getElementById('add-friend-modal');
    const openAddBtn = document.getElementById('open-add-modal-btn');
    const closeAddBtn = document.getElementById('close-add-modal-btn');

    if (openAddBtn) openAddBtn.addEventListener('click', () => addFriendModal.style.display = 'flex');
    if (closeAddBtn) closeAddBtn.addEventListener('click', () => addFriendModal.style.display = 'none');

    const addFriendForm = document.getElementById('add-friend-form');
    if (addFriendForm) {
        addFriendForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const friendUsername = document.getElementById('add-friend-input').value.trim();
            if (friendUsername === currentUser.name) return alert('No puedes agregarte a ti mismo');

            showLoading('Buscando contacto...');
            socket.emit('addFriend', { myUsername: currentUser.name, friendUsername: friendUsername });
        });
    }

    socket.on('friendAddedSuccess', (friendUser) => {
        hideLoading();
        if (addFriendModal) addFriendModal.style.display = 'none';
        const addInput = document.getElementById('add-friend-input');
        if (addInput) addInput.value = '';
        addFriendCardToUI(friendUser.username, friendUser.avatar);
        
        const privateChatId = getPrivateChatId(currentUser.name, friendUser.username);
        selectChat(privateChatId, friendUser.username, friendUser.avatar);
    });

    socket.on('friendAddedError', (msg) => {
        hideLoading();
        alert(msg);
    });

    function getPrivateChatId(user1, user2) {
        return [user1, user2].sort().join('--');
    }

    function addFriendCardToUI(friendName, avatarUrl) {
        const privateChatId = getPrivateChatId(currentUser.name, friendName);
        if (document.querySelector(`[data-chat-id="${privateChatId}"]`)) return;

        const card = document.createElement('div');
        card.classList.add('chat-card');
        card.dataset.chatId = privateChatId;
        card.dataset.chatName = friendName;
        card.dataset.chatAvatar = avatarUrl;

        card.innerHTML = `
            <div class="avatar-wrapper">
                <img src="${avatarUrl}">
                <span class="status-badge online"></span>
            </div>
            <div class="chat-info">
                <div class="chat-title">
                    <h4>${friendName}</h4>
                    <span class="time">Privado</span>
                </div>
                <p class="last-message">Haz clic para chatear</p>
            </div>
        `;

        if (conversationsList) conversationsList.appendChild(card);
    }

    if (conversationsList) {
        conversationsList.addEventListener('click', (e) => {
            const card = e.target.closest('.chat-card');
            if (card) {
                document.querySelectorAll('.chat-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                const chatId = card.dataset.chatId;
                const chatName = card.dataset.chatName;
                const chatAvatar = card.dataset.chatAvatar;

                selectChat(chatId, chatName, chatAvatar);
            }
        });
    }

    function selectChat(chatId, chatName, chatAvatar) {
        currentChatId = chatId;
        const title = document.getElementById('active-chat-title');
        if (title) title.textContent = chatName;

        const avatar = document.getElementById('active-chat-avatar');
        if (avatar) avatar.src = chatAvatar;

        socket.emit('joinChat', currentChatId);
    }

    // PESTAÑAS (SPA)
    const navTabs = document.querySelectorAll('.nav-tab:not(.logout-nav-btn)');
    const tabContents = document.querySelectorAll('.tab-content');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            navTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetElem = document.getElementById(targetTab);
            if (targetElem) targetElem.classList.add('active');
        });
    });

    // MENSAJES Y NOTIFICACIÓN
    function playNotificationSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch (e) {}
    }

    socket.on('loadHistory', (messages) => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="date-divider"><span>Inicio del Chat</span></div>';
            messages.forEach(msg => renderMessage(msg));
        }
    });

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const micBtn = document.getElementById('mic-btn');
    const sendBtn = document.getElementById('send-btn');
    const attachBtn = document.getElementById('attach-btn');
    const attachmentsMenu = document.getElementById('attachments-menu');
    const fileInputHidden = document.getElementById('file-input-hidden');
    const activeChatStatus = document.getElementById('active-chat-status');

    let currentReplyData = null;

    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (messageInput.value.trim() !== '') {
                if (micBtn) micBtn.style.display = 'none';
                if (sendBtn) sendBtn.style.display = 'flex';
                socket.emit('typing', { chatId: currentChatId, userName: currentUser.name, isTyping: true });
            } else {
                if (micBtn) micBtn.style.display = 'flex';
                if (sendBtn) sendBtn.style.display = 'none';
                socket.emit('typing', { chatId: currentChatId, userName: currentUser.name, isTyping: false });
            }
        });
    }

    socket.on('userTyping', (data) => {
        if (activeChatStatus && data.chatId === currentChatId) {
            activeChatStatus.textContent = data.isTyping ? `${data.userName} está escribiendo...` : 'En línea';
        }
    });

    if (attachBtn) {
        attachBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (attachmentsMenu) {
                attachmentsMenu.style.display = attachmentsMenu.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    document.addEventListener('click', () => {
        if (attachmentsMenu) attachmentsMenu.style.display = 'none';
    });

    const attachImgBtn = document.getElementById('attach-image-btn');
    if (attachImgBtn && fileInputHidden) {
        attachImgBtn.addEventListener('click', () => fileInputHidden.click());
    }

    if (fileInputHidden) {
        fileInputHidden.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    socket.emit('sendMessage', {
                        chatId: currentChatId, senderId: currentUser.id, senderName: currentUser.name,
                        type: 'image', content: evt.target.result
                    });
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // AUDIO
    const recordingBar = document.getElementById('recording-bar');
    const mainInputArea = document.getElementById('main-input-area');
    const cancelRecBtn = document.getElementById('cancel-rec-btn');
    const sendRecBtn = document.getElementById('send-rec-btn');
    const recordingTimer = document.getElementById('recording-timer');
    let mediaRecorder, audioChunks = [], recInterval, secondsRecorded = 0;

    if (micBtn) {
        micBtn.addEventListener('click', async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];
                mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
                mediaRecorder.start();

                if (mainInputArea) mainInputArea.style.display = 'none';
                if (recordingBar) recordingBar.style.display = 'flex';
                secondsRecorded = 0;
                if (recordingTimer) recordingTimer.textContent = '0:00';

                recInterval = setInterval(() => {
                    secondsRecorded++;
                    const mins = Math.floor(secondsRecorded / 60);
                    const secs = secondsRecorded % 60;
                    if (recordingTimer) recordingTimer.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                }, 1000);
            } catch (err) {
                alert('Autoriza el micrófono para grabar');
            }
        });
    }

    if (cancelRecBtn) {
        cancelRecBtn.addEventListener('click', () => {
            clearInterval(recInterval);
            if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
            if (recordingBar) recordingBar.style.display = 'none';
            if (mainInputArea) mainInputArea.style.display = 'block';
        });
    }

    if (sendRecBtn) {
        sendRecBtn.addEventListener('click', () => {
            clearInterval(recInterval);
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        socket.emit('sendMessage', {
                            chatId: currentChatId, senderId: currentUser.id, senderName: currentUser.name,
                            type: 'audio', content: reader.result
                        });
                    };
                };
                mediaRecorder.stop();
            }
            if (recordingBar) recordingBar.style.display = 'none';
            if (mainInputArea) mainInputArea.style.display = 'block';
        });
    }

    if (chatForm) {
        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = messageInput.value.trim();
            if (text !== '') {
                socket.emit('sendMessage', {
                    chatId: currentChatId, senderId: currentUser.id, senderName: currentUser.name,
                    type: 'text', content: text, replyTo: currentReplyData
                });
                messageInput.value = '';
                if (micBtn) micBtn.style.display = 'flex';
                if (sendBtn) sendBtn.style.display = 'none';
                currentReplyData = null;
                const replyBar = document.getElementById('reply-preview-bar');
                if (replyBar) replyBar.style.display = 'none';
            }
        });
    }

    // CITAR, REACCIONAR Y ELIMINAR
    document.addEventListener('click', (e) => {
        const replyBtn = e.target.closest('.reply-btn');
        if (replyBtn) {
            const bubble = replyBtn.closest('.message-bubble');
            const wrapper = bubble.closest('.message-wrapper');
            const author = wrapper.dataset.author;
            const text = bubble.querySelector('p') ? bubble.querySelector('p').textContent : '[Adjunto]';

            currentReplyData = { author, text };
            const replyName = document.getElementById('reply-to-name');
            if (replyName) replyName.textContent = `Respondiendo a ${author}`;
            const replyText = document.getElementById('reply-to-text');
            if (replyText) replyText.textContent = text;
            const replyBar = document.getElementById('reply-preview-bar');
            if (replyBar) replyBar.style.display = 'flex';
            if (messageInput) messageInput.focus();
        }

        const reactBtn = e.target.closest('.react-btn');
        if (reactBtn) {
            const wrapper = reactBtn.closest('.message-wrapper');
            const msgId = wrapper.dataset.msgId;
            socket.emit('addReaction', { chatId: currentChatId, msgId, emoji: '❤️', userName: currentUser.name });
        }

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const wrapper = deleteBtn.closest('.message-wrapper');
            const msgId = wrapper.dataset.msgId;
            socket.emit('deleteMessage', { chatId: currentChatId, msgId });
        }
    });

    const closeReplyBtn = document.getElementById('close-reply-btn');
    if (closeReplyBtn) {
        closeReplyBtn.addEventListener('click', () => {
            const replyBar = document.getElementById('reply-preview-bar');
            if (replyBar) replyBar.style.display = 'none';
            currentReplyData = null;
        });
    }

    // RECEPCIÓN DE MENSAJES (SÚPER FLUIDA)
    socket.on('receiveMessage', (msg) => {
        // 1. Crear tarjeta lateral si es un mensaje privado y aún no existe en pantalla
        if (msg.chatId !== 'global-chat') {
            const privateChatCard = document.querySelector(`[data-chat-id="${msg.chatId}"]`);
            if (!privateChatCard) {
                const otherUser = msg.senderName === currentUser.name 
                    ? msg.chatId.split('--').find(u => u !== currentUser.name) 
                    : msg.senderName;

                if (otherUser) {
                    addFriendCardToUI(otherUser, `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser}`);
                }
            }

            // Actualizar vista previa del texto en la barra lateral
            const cardToUpdate = document.querySelector(`[data-chat-id="${msg.chatId}"]`);
            if (cardToUpdate) {
                const lastMsgElem = cardToUpdate.querySelector('.last-message');
                if (lastMsgElem) {
                    lastMsgElem.textContent = msg.type === 'text' ? msg.content : `[${msg.type.toUpperCase()}]`;
                }
            }
        }

        // 2. Si es para el chat que tengo seleccionado, dibujarlo inmediatamente
        if (msg.chatId === currentChatId) {
            renderMessage(msg);
            if (msg.senderName !== currentUser.name) playNotificationSound();
        } else {
            // Si es para otro chat privado, solo suena la notificación de fondo
            if (msg.senderName !== currentUser.name) playNotificationSound();
        }
    });

    socket.on('messageDeleted', (data) => {
        const wrapper = document.querySelector(`[data-msg-id="${data.msgId}"]`);
        if (wrapper) {
            const bubble = wrapper.querySelector('.message-bubble');
            if (bubble) {
                bubble.classList.add('deleted');
                bubble.innerHTML = `<p><i class="ph ph-prohibit"></i> Este mensaje fue eliminado</p>`;
            }
        }
    });

    socket.on('messageReacted', (data) => {
        const wrapper = document.querySelector(`[data-msg-id="${data.msgId}"]`);
        if (wrapper) {
            let reactionBox = wrapper.querySelector('.reactions-container');
            if (!reactionBox) {
                reactionBox = document.createElement('div');
                reactionBox.classList.add('reactions-container');
                const bubble = wrapper.querySelector('.message-bubble');
                if (bubble) bubble.appendChild(reactionBox);
            }
            reactionBox.innerHTML = `<span class="reaction-tag">${data.emoji} 1</span>`;
        }
    });

    function renderMessage(msg) {
        if (!messagesContainer) return;

        const isOutgoing = msg.senderId === currentUser.id || msg.senderName === currentUser.name;
        const wrapper = document.createElement('div');
        wrapper.classList.add('message-wrapper', isOutgoing ? 'outgoing' : 'incoming');
        wrapper.dataset.msgId = msg._id;
        wrapper.dataset.author = msg.senderName;

        let deleteActionHTML = isOutgoing ? `<button class="action-btn delete-btn" title="Eliminar para todos"><i class="ph ph-trash"></i></button>` : '';

        if (msg.isDeleted) {
            wrapper.innerHTML = `
                <div class="message-bubble deleted">
                    <p><i class="ph ph-prohibit"></i> Este mensaje fue eliminado</p>
                </div>
            `;
            messagesContainer.appendChild(wrapper);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            return;
        }

        let quotedHTML = msg.replyTo ? `
            <div class="quoted-message">
                <span class="quoted-author">${msg.replyTo.author}</span>
                <p class="quoted-text">${escapeHTML(msg.replyTo.text)}</p>
            </div>
        ` : '';

        let contentHTML = '';
        if (msg.type === 'text') {
            contentHTML = `<p>${escapeHTML(msg.content)}</p>`;
        } else if (msg.type === 'image') {
            contentHTML = `<img src="${msg.content}" style="max-width:220px; border-radius:10px; margin-bottom:5px;">`;
        } else if (msg.type === 'audio') {
            contentHTML = `<audio controls src="${msg.content}" style="outline:none; height:36px; width:220px;"></audio>`;
        }

        let reactionsHTML = (msg.reactions && msg.reactions.length > 0) ? `
            <div class="reactions-container">
                <span class="reaction-tag">${msg.reactions[0].emoji} ${msg.reactions.length}</span>
            </div>
        ` : '';

        wrapper.innerHTML = `
            <div class="message-bubble">
                <div class="message-actions-menu">
                    <button class="action-btn reply-btn" title="Responder"><i class="ph ph-arrow-u-up-left"></i></button>
                    <button class="action-btn react-btn" title="Reaccionar"><i class="ph ph-smiley"></i></button>
                    ${deleteActionHTML}
                </div>
                <small style="font-size:10px; color:#a5b4fc; display:block; margin-bottom:2px;">${msg.senderName}</small>
                ${quotedHTML}
                ${contentHTML}
                <div class="msg-meta">
                    <span>${new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                ${reactionsHTML}
            </div>
        `;

        messagesContainer.appendChild(wrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ESTADOS Y LLAMADAS
    const storyForm = document.getElementById('story-form');
    if (storyForm) {
        storyForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const textInput = document.getElementById('story-text-input');
            const text = textInput ? textInput.value.trim() : '';
            if (text !== '') {
                socket.emit('addStory', { userName: currentUser.name, userAvatar: currentUser.avatar, text: text });
                if (textInput) textInput.value = '';
            }
        });
    }

    socket.on('loadStories', (stories) => {
        const feed = document.getElementById('stories-feed-list');
        if (feed) {
            feed.innerHTML = '<h3>Estados Recientes</h3>';
            stories.forEach(s => renderStory(s));
        }
    });

    socket.on('newStory', (s) => renderStory(s));

    function renderStory(story) {
        const feed = document.getElementById('stories-feed-list');
        if (!feed) return;

        const item = document.createElement('div');
        item.classList.add('story-card-item');
        item.innerHTML = `
            <img src="${story.userAvatar}">
            <div>
                <h4>${story.userName}</h4>
                <p style="font-size:12px; color:#9ca3af;">${new Date(story.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
        `;

        item.addEventListener('click', () => {
            const avatar = document.getElementById('story-view-avatar');
            if (avatar) avatar.src = story.userAvatar;
            const author = document.getElementById('story-view-author');
            if (author) author.textContent = story.userName;
            const time = document.getElementById('story-view-time');
            if (time) time.textContent = `Publicado a las ${new Date(story.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
            const text = document.getElementById('story-view-text');
            if (text) text.textContent = story.text;
            const modal = document.getElementById('story-viewer-modal');
            if (modal) modal.style.display = 'flex';
        });

        feed.appendChild(item);
    }

    const closeStoryModal = document.getElementById('close-story-modal');
    if (closeStoryModal) {
        closeStoryModal.addEventListener('click', () => {
            const modal = document.getElementById('story-viewer-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    // LLAMADAS
    const callBtn = document.getElementById('make-call-btn');
    if (callBtn) {
        callBtn.addEventListener('click', () => {
            socket.emit('makeCall', { caller: currentUser.name, type: 'Llamada de Voz' });
            alert('Llamada iniciada...');
        });
    }

    const videoBtn = document.getElementById('make-video-btn');
    if (videoBtn) {
        videoBtn.addEventListener('click', () => {
            socket.emit('makeCall', { caller: currentUser.name, type: 'Videollamada' });
            alert('Videollamada iniciada...');
        });
    }

    socket.on('loadCalls', (calls) => {
        const history = document.getElementById('calls-history-list');
        if (history) {
            history.innerHTML = '';
            calls.forEach(c => renderCall(c));
        }
    });

    socket.on('callLogged', (call) => renderCall(call));

    function renderCall(call) {
        const history = document.getElementById('calls-history-list');
        if (!history) return;

        const card = document.createElement('div');
        card.classList.add('call-log-card');
        card.innerHTML = `
            <div class="call-log-info">
                <h4><i class="ph ph-phone-incoming" style="color:#10b981;"></i> ${call.caller}</h4>
                <p>${call.type} - ${new Date(call.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
            </div>
            <i class="ph ph-check-circle" style="color:#6366f1;"></i>
        `;
        history.prepend(card);
    }

    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
    }
});
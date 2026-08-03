document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    
    let currentChatId = 'global-chat';
    let currentUser = { id: null, name: '', email: '', avatar: '', description: '¡Usando SocialApp!', friends: [] };

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

    // REGISTRO CON CORREO
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading('Creando nueva cuenta...');
            const username = document.getElementById('reg-username').value.trim();
            const emailElem = document.getElementById('reg-email');
            const email = emailElem ? emailElem.value.trim() : `${username}@socialapp.com`;
            const password = document.getElementById('reg-password').value.trim();

            socket.emit('register', { username, email, password });
        });
    }

    socket.on('authSuccess', (user) => {
        hideLoading();
        currentUser.id = user._id;
        currentUser.name = user.username;
        currentUser.email = user.email || '';
        currentUser.avatar = user.avatar;
        currentUser.description = user.description || "¡Usando SocialApp!";
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
        
        selectChat(
            'global-chat', 
            'Comunidad Global 🌐', 
            'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=150&auto=format&fit=crop'
        );
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

        const descDisp = document.getElementById('profile-edit-desc-display');
        if (descDisp) descDisp.textContent = currentUser.description;

        const emailDisp = document.getElementById('profile-edit-email-display');
        if (emailDisp) emailDisp.value = currentUser.email;

        const avatarInput = document.getElementById('edit-profile-avatar-url');
        if (avatarInput) avatarInput.value = currentUser.avatar;

        const descInput = document.getElementById('edit-profile-desc-input');
        if (descInput) descInput.value = currentUser.description;
    }

    // EDITAR PERFIL
    const editProfileForm = document.getElementById('edit-profile-form');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showLoading('Guardando perfil...');

            const newAvatar = document.getElementById('edit-profile-avatar-url').value.trim();
            const newDesc = document.getElementById('edit-profile-desc-input').value.trim();

            currentUser.avatar = newAvatar;
            currentUser.description = newDesc;

            socket.emit('updateProfile', {
                username: currentUser.name,
                avatar: newAvatar,
                description: newDesc
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
        }
    });

    // LOGOUT
    function performLogout() {
        localStorage.removeItem('socialapp_saved_user');
        currentUser = { id: null, name: '', email: '', avatar: '', description: 'Disponible', friends: [] };
        if (appLayout) appLayout.style.display = 'none';
        if (authModal) authModal.style.display = 'flex';
    }

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
            if (friendUsername.toLowerCase() === currentUser.name.toLowerCase()) return alert('No puedes agregarte a ti mismo');

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
        return [user1.toLowerCase(), user2.toLowerCase()].sort().join('--');
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

        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.innerHTML = '<div class="date-divider"><span>Cargando mensajes...</span></div>';
        }

        const activeCard = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (activeCard) {
            const badge = activeCard.querySelector('.unread-badge');
            if (badge) badge.remove();
        }

        socket.emit('joinChat', currentChatId);
    }

    // PESTAÑAS (SPA)
    const navTabs = document.querySelectorAll('.nav-tab');
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
            messagesContainer.innerHTML = '<div class="date-divider"><span>¡Bienvenido al chat!</span></div>';
            messages.forEach(msg => renderMessage(msg));
        }
    });

    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const activeChatStatus = document.getElementById('active-chat-status');

    let currentReplyData = null;

    if (messageInput) {
        messageInput.addEventListener('input', () => {
            if (messageInput.value.trim() !== '') {
                socket.emit('typing', { chatId: currentChatId, userName: currentUser.name, isTyping: true });
            } else {
                socket.emit('typing', { chatId: currentChatId, userName: currentUser.name, isTyping: false });
            }
        });
    }

    socket.on('userTyping', (data) => {
        if (activeChatStatus && data.chatId === currentChatId) {
            activeChatStatus.textContent = data.isTyping ? `${data.userName} está escribiendo...` : 'En línea';
        }
    });

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
            const text = bubble.querySelector('p') ? bubble.querySelector('p').textContent : '';

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

    // RECEPCIÓN DE MENSAJES
    socket.on('receiveMessage', (msg) => {
        if (msg.chatId !== 'global-chat') {
            let privateChatCard = document.querySelector(`[data-chat-id="${msg.chatId}"]`);
            if (!privateChatCard) {
                const otherUser = msg.senderName.toLowerCase() === currentUser.name.toLowerCase()
                    ? msg.chatId.split('--').find(u => u.toLowerCase() !== currentUser.name.toLowerCase()) 
                    : msg.senderName;

                if (otherUser) {
                    addFriendCardToUI(otherUser, `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser}`);
                    privateChatCard = document.querySelector(`[data-chat-id="${msg.chatId}"]`);
                }
            }

            if (privateChatCard) {
                const lastMsgElem = privateChatCard.querySelector('.last-message');
                if (lastMsgElem) {
                    lastMsgElem.textContent = `${msg.senderName}: ${msg.content}`;
                }
            }
        }

        if (msg.chatId === currentChatId) {
            renderMessage(msg);
            if (msg.senderName !== currentUser.name) playNotificationSound();
        } else {
            if (msg.senderName !== currentUser.name) {
                playNotificationSound();

                const card = document.querySelector(`[data-chat-id="${msg.chatId}"]`);
                if (card) {
                    let badge = card.querySelector('.unread-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.classList.add('unread-badge');
                        badge.style.backgroundColor = '#ef4444';
                        badge.style.color = '#ffffff';
                        badge.style.fontSize = '10px';
                        badge.style.padding = '2px 6px';
                        badge.style.borderRadius = '10px';
                        badge.style.marginLeft = 'auto';
                        badge.textContent = 'Nuevo';
                        const titleDiv = card.querySelector('.chat-title');
                        if (titleDiv) titleDiv.appendChild(badge);
                    }
                }
            }
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

        const isOutgoing = msg.senderId === currentUser.id || msg.senderName.toLowerCase() === currentUser.name.toLowerCase();
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
            <div class="quoted-message" style="background:rgba(0,0,0,0.2); padding:4px 8px; border-left:2px solid #fff; border-radius:4px; margin-bottom:4px;">
                <span class="quoted-author" style="font-size:10px; font-weight:bold;">${msg.replyTo.author}</span>
                <p class="quoted-text" style="font-size:11px;">${escapeHTML(msg.replyTo.text)}</p>
            </div>
        ` : '';

        let contentHTML = `<p>${escapeHTML(msg.content)}</p>`;

        let reactionsHTML = (msg.reactions && msg.reactions.length > 0) ? `
            <div class="reactions-container" style="margin-top:2px;">
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

    // PUBLICACIONES
    const postForm = document.getElementById('post-form');
    if (postForm) {
        postForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('post-title-input');
            const contentInput = document.getElementById('post-content-input');
            
            const title = titleInput ? titleInput.value.trim() : '';
            const content = contentInput ? contentInput.value.trim() : '';

            if (title !== '' && content !== '') {
                socket.emit('addPost', {
                    userName: currentUser.name,
                    userAvatar: currentUser.avatar,
                    title: title,
                    content: content
                });
                titleInput.value = '';
                contentInput.value = '';
            }
        });
    }

    socket.on('loadPosts', (posts) => {
        const feed = document.getElementById('posts-feed-list');
        if (feed) {
            feed.innerHTML = '';
            posts.forEach(p => renderPost(p));
        }
    });

    socket.on('newPost', (post) => renderPost(post));

    function renderPost(post) {
        const feed = document.getElementById('posts-feed-list');
        if (!feed) return;

        const item = document.createElement('div');
        item.classList.add('post-card');
        item.innerHTML = `
            <div class="post-header">
                <img src="${post.userAvatar}">
                <div>
                    <h4 style="color:#f8fafc; font-size:1rem;">${post.userName}</h4>
                    <span style="font-size:0.75rem; color:#94a3b8;">${new Date(post.createdAt).toLocaleString([], {dateStyle:'short', timeStyle:'short'})}</span>
                </div>
            </div>
            <h3 style="color:#818cf8; font-size:1.1rem; margin-bottom:0.5rem;">${escapeHTML(post.title)}</h3>
            <p style="color:#e2e8f0; font-size:0.95rem; line-height:1.4;">${escapeHTML(post.content)}</p>
        `;

        feed.prepend(item);
    }

    // ESTADOS
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
            feed.innerHTML = '';
            stories.forEach(s => renderStory(s));
        }
    });

    socket.on('newStory', (s) => renderStory(s));

    function renderStory(story) {
        const feed = document.getElementById('stories-feed-list');
        if (!feed) return;

        const item = document.createElement('div');
        item.classList.add('post-card');
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div class="post-header">
                <img src="${story.userAvatar}">
                <div>
                    <h4>${story.userName}</h4>
                    <span style="font-size:0.75rem; color:#94a3b8;">Publicado a las ${new Date(story.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
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

        feed.prepend(item);
    }

    const closeStoryModal = document.getElementById('close-story-modal');
    if (closeStoryModal) {
        closeStoryModal.addEventListener('click', () => {
            const modal = document.getElementById('story-viewer-modal');
            if (modal) modal.style.display = 'none';
        });
    }

    function escapeHTML(str) {
        return str ? str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)) : '';
    }
});
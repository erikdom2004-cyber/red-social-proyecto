const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/socialapp_db";

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 MongoDB Conectado'))
    .catch(err => console.log('⚠️ Error de conexión a MongoDB:', err.message));

// ESQUEMAS
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=default" },
    bio: { type: String, default: "¡Hola! Estoy usando SocialApp." },
    presenceStatus: { type: String, default: "Disponible" },
    friends: { type: Array, default: [] }
});

const MessageSchema = new mongoose.Schema({
    chatId: String,
    senderId: String,
    senderName: String,
    type: { type: String, default: 'text' },
    content: String,
    replyTo: Object,
    reactions: { type: Array, default: [] },
    isDeleted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const StorySchema = new mongoose.Schema({
    userName: String,
    userAvatar: String,
    text: String,
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});

const CallSchema = new mongoose.Schema({
    caller: String,
    type: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Story = mongoose.model('Story', StorySchema);
const Call = mongoose.model('Call', CallSchema);

io.on('connection', (socket) => {

    // REGISTRO
    socket.on('register', async (data) => {
        try {
            const existingUser = await User.findOne({ username: data.username });
            if (existingUser) return socket.emit('authError', 'El nombre de usuario ya está ocupado.');

            const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`;

            const newUser = await User.create({
                username: data.username,
                password: data.password,
                avatar: defaultAvatar,
                friends: []
            });

            socket.emit('authSuccess', newUser);
        } catch (err) {
            socket.emit('authSuccess', { 
                _id: 'temp-' + Date.now(), 
                username: data.username, 
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`, 
                bio: "Disponible", 
                presenceStatus: "Disponible",
                friends: [] 
            });
        }
    });

    // LOGIN
    socket.on('login', async (data) => {
        try {
            const user = await User.findOne({ username: data.username });
            if (!user) return socket.emit('authError', 'El usuario no existe.');
            if (user.password !== data.password) return socket.emit('authError', 'Contraseña incorrecta.');

            socket.emit('authSuccess', user);
        } catch (err) {
            socket.emit('authSuccess', { 
                _id: 'temp-' + Date.now(), 
                username: data.username, 
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`, 
                bio: "Disponible",
                presenceStatus: "Disponible",
                friends: [] 
            });
        }
    });

    // EDITAR PERFIL Y TRANSMITIR A TODOS
    socket.on('updateProfile', async (data) => {
        try {
            const updatedUser = await User.findOneAndUpdate(
                { username: data.username },
                { avatar: data.avatar, bio: data.bio, presenceStatus: data.presenceStatus },
                { new: true }
            );
            io.emit('profileUpdated', updatedUser || data);
        } catch (e) {
            io.emit('profileUpdated', data);
        }
    });

    // CHATS, MENSAJES Y AMIGOS
    socket.on('joinChat', async (chatId) => {
        socket.join(chatId);
        try {
            const messages = await Message.find({ chatId }).sort({ createdAt: 1 }).limit(100);
            socket.emit('loadHistory', messages);
        } catch (err) {}
    });

    socket.on('loadInitialData', async () => {
        try {
            const stories = await Story.find().sort({ createdAt: -1 });
            socket.emit('loadStories', stories);

            const calls = await Call.find().sort({ createdAt: -1 }).limit(30);
            socket.emit('loadCalls', calls);
        } catch (e) {}
    });

    socket.on('addFriend', async (data) => {
        const { myUsername, friendUsername } = data;
        try {
            let friendUser = await User.findOne({ username: friendUsername });
            if (!friendUser) {
                friendUser = await User.create({
                    username: friendUsername,
                    password: '123',
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${friendUsername}`,
                    bio: "Contacto en SocialApp",
                    presenceStatus: "Disponible"
                });
            }

            await User.findOneAndUpdate(
                { username: myUsername },
                { $addToSet: { friends: friendUsername } }
            );

            socket.emit('friendAddedSuccess', friendUser);
        } catch (err) {
            socket.emit('friendAddedError', 'Error al agregar usuario');
        }
    });

    socket.on('sendMessage', async (data) => {
        let savedMsg = { ...data, _id: 'msg-' + Date.now(), createdAt: new Date() };
        try { savedMsg = await Message.create(data); } catch (e) {}
        io.to(data.chatId).emit('receiveMessage', savedMsg);
    });

    socket.on('deleteMessage', async (data) => {
        try {
            await Message.findByIdAndUpdate(data.msgId, { content: 'Este mensaje fue eliminado', isDeleted: true });
        } catch (e) {}
        io.to(data.chatId).emit('messageDeleted', { msgId: data.msgId });
    });

    socket.on('addReaction', async (data) => {
        try {
            await Message.findByIdAndUpdate(data.msgId, { $push: { reactions: { emoji: data.emoji, user: data.userName } } });
        } catch (e) {}
        io.to(data.chatId).emit('messageReacted', data);
    });

    socket.on('typing', (data) => {
        socket.to(data.chatId).emit('userTyping', data);
    });

    socket.on('addStory', async (storyData) => {
        let savedStory = { ...storyData, _id: 'story-' + Date.now(), createdAt: new Date() };
        try { savedStory = await Story.create(storyData); } catch (e) {}
        io.emit('newStory', savedStory);
    });

    socket.on('makeCall', async (callData) => {
        let savedCall = { ...callData, _id: 'call-' + Date.now(), createdAt: new Date() };
        try { savedCall = await Call.create(callData); } catch (e) {}
        io.emit('callLogged', savedCall);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SERVIDOR COMPLETO EN PUERTO: ${PORT}`);
});
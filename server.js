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
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "https://api.dicebear.com/7.x/bottts/svg?seed=default" },
    description: { type: String, default: "¡Hola! Estoy usando SocialApp." },
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

const PostSchema = new mongoose.Schema({
    userName: String,
    userAvatar: String,
    title: String,
    content: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);
const Story = mongoose.model('Story', StorySchema);
const Post = mongoose.model('Post', PostSchema);

io.on('connection', (socket) => {

    // REGISTRO CON EMAIL
    socket.on('register', async (data) => {
        try {
            const existingUser = await User.findOne({ 
                $or: [{ username: data.username }, { email: data.email }] 
            });

            if (existingUser) {
                if (existingUser.username === data.username) {
                    return socket.emit('authError', 'El nombre de usuario ya está ocupado.');
                }
                if (existingUser.email === data.email) {
                    return socket.emit('authError', 'El correo electrónico ya está registrado.');
                }
            }

            const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`;

            const newUser = await User.create({
                username: data.username,
                email: data.email,
                password: data.password,
                avatar: defaultAvatar,
                friends: []
            });

            socket.emit('authSuccess', newUser);
        } catch (err) {
            socket.emit('authSuccess', { 
                _id: 'temp-' + Date.now(), 
                username: data.username, 
                email: data.email,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`, 
                description: "Disponible",
                friends: [] 
            });
        }
    });

    // LOGIN CON USUARIO O CORREO
    socket.on('login', async (data) => {
        try {
            const user = await User.findOne({ 
                $or: [{ username: data.username }, { email: data.username }] 
            });

            if (!user) return socket.emit('authError', 'El usuario o correo no existe.');
            if (user.password !== data.password) return socket.emit('authError', 'Contraseña incorrecta.');

            socket.emit('authSuccess', user);
        } catch (err) {
            socket.emit('authSuccess', { 
                _id: 'temp-' + Date.now(), 
                username: data.username, 
                email: data.username,
                avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username}`, 
                description: "Disponible",
                friends: [] 
            });
        }
    });

    // EDITAR PERFIL Y DESCRIPCIÓN
    socket.on('updateProfile', async (data) => {
        try {
            const updatedUser = await User.findOneAndUpdate(
                { username: data.username },
                { avatar: data.avatar, description: data.description },
                { new: true }
            );
            io.emit('profileUpdated', updatedUser || data);
        } catch (e) {
            io.emit('profileUpdated', data);
        }
    });

    // CHATS Y DATOS INICIALES
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

            const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
            socket.emit('loadPosts', posts);
        } catch (e) {}
    });

    socket.on('addFriend', async (data) => {
        const { myUsername, friendUsername } = data;
        try {
            let friendUser = await User.findOne({ username: friendUsername });
            if (!friendUser) {
                friendUser = await User.create({
                    username: friendUsername,
                    email: `${friendUsername}@socialapp.com`,
                    password: '123',
                    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${friendUsername}`,
                    description: "Contacto en SocialApp"
                });
            }

            await User.findOneAndUpdate(
                { username: myUsername },
                { $addToSet: { friends: friendUsername } }
            );
            await User.findOneAndUpdate(
                { username: friendUsername },
                { $addToSet: { friends: myUsername } }
            );

            socket.emit('friendAddedSuccess', friendUser);
        } catch (err) {
            socket.emit('friendAddedError', 'Error al agregar usuario');
        }
    });

    // TRANSMISIÓN DE MENSAJES
    socket.on('sendMessage', async (data) => {
        let savedMsg = { ...data, _id: 'msg-' + Date.now(), createdAt: new Date() };
        try { savedMsg = await Message.create(data); } catch (e) {}
        io.emit('receiveMessage', savedMsg);
    });

    // ELIMINAR MENSAJE
    socket.on('deleteMessage', async (data) => {
        try {
            await Message.findByIdAndUpdate(data.msgId, { content: 'Este mensaje fue eliminado', isDeleted: true });
        } catch (e) {}
        io.emit('messageDeleted', { msgId: data.msgId, chatId: data.chatId });
    });

    // REACCIONES
    socket.on('addReaction', async (data) => {
        try {
            await Message.findByIdAndUpdate(data.msgId, { $push: { reactions: { emoji: data.emoji, user: data.userName } } });
        } catch (e) {}
        io.emit('messageReacted', data);
    });

    // ESCRIBIENDO...
    socket.on('typing', (data) => {
        socket.broadcast.emit('userTyping', data);
    });

    // ESTADOS
    socket.on('addStory', async (storyData) => {
        let savedStory = { ...storyData, _id: 'story-' + Date.now(), createdAt: new Date() };
        try { savedStory = await Story.create(storyData); } catch (e) {}
        io.emit('newStory', savedStory);
    });

    // PUBLICACIONES
    socket.on('addPost', async (postData) => {
        let savedPost = { ...postData, _id: 'post-' + Date.now(), createdAt: new Date() };
        try { savedPost = await Post.create(postData); } catch (e) {}
        io.emit('newPost', savedPost);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 SERVIDOR COMPLETO EN PUERTO: ${PORT}`);
});
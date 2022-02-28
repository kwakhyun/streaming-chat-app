import http from "http";
import SocketIO from "socket.io"; // Admin UI 사용을 위해 import 방식 변경
import { Server } from "socket.io"; // 변경된 import 방식
import { instrument } from "@socket.io/admin-ui"; // 추가된 import
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app);
const wsServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    },
});

instrument(wsServer, {
    auth: false
});

function publicRooms() {
    //const sids = wsServer.sockets.adapter.sids;
    //const rooms = wsServer.sockets.adapter.rooms;
    const {
        sockets: {
            adapter: { sids, rooms },
        },
    } = wsServer;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if (sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countUser(roomName) {
    return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", socket => {
    // socket["nickname"] = "Anon";
    wsServer.sockets.emit("room_change", publicRooms());

    socket.onAny((event) => {
        console.log(`Socket Event : ${event}`);
    });

    socket.on("join_chat", (roomName, showRoom) => {
        socket.join(roomName);
        showRoom(countUser(roomName));
        socket.to(roomName).emit("enterUser", socket.nickname, countUser(roomName));
        wsServer.sockets.emit("room_change", publicRooms());
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach((room) => {
            socket.to(room).emit("exitUser", socket.nickname, countUser(room) - 1);
        });
    });

    socket.on("disconnect", () => {
        wsServer.sockets.emit("room_change", publicRooms());
    });

    socket.on("send_msg", (msg, roomTitle, me) => {
        socket.to(roomTitle).emit("send_msg", `${socket.nickname} : ${msg}`);
        me();
    });

    socket.on("nickname", (nickname) => {
        socket["nickname"] = nickname
    });

    // webRTC
    socket.on("join_room", (rtcRoomName) => {
        socket.join(rtcRoomName);
        socket.to(rtcRoomName).emit("welcome");
    });

    socket.on("offer", (offer, rtcRoomName) => {
        socket.to(rtcRoomName).emit("offer", offer);
    });

    socket.on("answer", (answer, rtcRoomName) => {
        socket.to(rtcRoomName).emit("answer", answer);
    });

    socket.on("ice", (ice, rtcRoomName) => {
        socket.to(rtcRoomName).emit("ice", ice);
    });
});

httpServer.listen(3000, handleListen);

// npm run dev

// npm i -g localtunnel
// npx localtunnel --port 3000
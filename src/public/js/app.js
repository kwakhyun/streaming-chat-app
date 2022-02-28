const socket = io();

const nameInputDiv = document.querySelector("#nameInputDiv");
const nameForm = nameInputDiv.querySelector("#nameForm");
const messageInputDiv = document.querySelector("#messageInputDiv");

messageInputDiv.hidden = true;

let roomTitle;

function joinMessage(message) {
    const ul = messageInputDiv.querySelector("ul");
    const li = document.createElement("li");
    li.innerText = message;
    ul.appendChild(li);
}

function handleMessageSubmit(event) {
    event.preventDefault();
    const input = messageInputDiv.querySelector("#msgForm input");
    const value = input.value;
    socket.emit("send_msg", input.value, roomTitle, () => {
        joinMessage(`나 : ${value}`);
    });
    input.value = "";
}

function showRoom(countUser) {
    nameInputDiv.hidden = true;
    rtcRoom.hidden = true;
    messageInputDiv.hidden = false;
    const h3 = messageInputDiv.querySelector("h3");
    h3.innerText = `${roomTitle} 채팅방입니다. ${countUser}명 접속 중`;
    const msgForm = messageInputDiv.querySelector("#msgForm");
    msgForm.addEventListener("submit", handleMessageSubmit);
}

function handleRoomSubmit(event) {
    event.preventDefault();
    const uName = nameInputDiv.querySelector("#uName");
    const rName = nameInputDiv.querySelector("#rName");
    socket.emit("nickname", uName.value);
    socket.emit("join_chat", rName.value, showRoom);
    roomTitle = rName.value;
    rName.value = "";
}

nameForm.addEventListener("submit", handleRoomSubmit);

socket.on("enterUser", (user, countUser) => {
    const h3 = messageInputDiv.querySelector("h3");
    h3.innerText = `${roomTitle} 채팅방입니다. ${countUser}명 접속 중`;
    joinMessage(`${user}님이 입장했습니다.`);
});

socket.on("exitUser", (user, countUser) => {
    const h3 = messageInputDiv.querySelector("h3");
    h3.innerText = `${roomTitle} 채팅방입니다. ${countUser}명 접속 중`;
    joinMessage(`${user}님이 퇴장했습니다.`);
});

socket.on("send_msg", joinMessage);

socket.on("room_change", (rooms) => {
    const roomList = nameInputDiv.querySelector("ul");
    roomList.innerHTML = "";
    if (rooms.length === 0) {
        return;
    }
    rooms.forEach(room => {
        const li = document.createElement("li");
        li.innerText = room;
        roomList.append(li);
    });
});
// SocketIO chat end

// RTC start
const myFace = document.querySelector("#myFace");
const muteBtn = document.querySelector("#mute");
const cameraBtn = document.querySelector("#camera");
const cameraSelect = document.querySelector("#cameraSelect");
const call = document.querySelector("#call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let rtcRoomName;
let myPeerConnection;
let myDataChannel;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach((camera) => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label === camera.label){
                option.selected = true;
            }
            cameraSelect.appendChild(option);
        });
    } catch (error) {
        console.log(error);
    }
}

// Windows에서는 하나의 브라우저에서만 카메라에 액세스할 수 있다
async function getMedia(deviceId) {
    const initialConstraints = {
        audio: true,
        video: { facingMode: "user" }
    }
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } }
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
            deviceId ? cameraConstraints : initialConstraints
        );
        myFace.srcObject = myStream;
        if (!deviceId) {
            await getCameras();
        }
    } catch (error) {
        console.log(error);
    }
}

function handleMute() {
    myStream.getAudioTracks().forEach((track) => {
        (track.enabled = !track.enabled)
    });
    if (!muted) {
        muteBtn.innerText = "🔊 ON";
        muted = true;
    } else {
        muteBtn.innerText = "🔊 OFF";
        muted = false;
    }
}

function handleCamera() {
    myStream.getVideoTracks().forEach((track) => {
        (track.enabled = !track.enabled)
    });
    if (!cameraOff) {
        cameraBtn.innerText = "🎥 ON";
        cameraOff = true;
    } else {
        cameraBtn.innerText = "🎥 OFF";
        cameraOff = false;
    }
}

async function handleCameraChange() {
    await getMedia(cameraSelect.value);
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0];
        const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === "video");
        videoSender.replaceTrack(videoTrack);
    }
}

muteBtn.addEventListener("click", handleMute);
cameraBtn.addEventListener("click", handleCamera);
cameraSelect.addEventListener("input", handleCameraChange);

// RTC Form
const rtcRoom = document.querySelector("#rtcRoom");
const rtcRoomForm = rtcRoom.querySelector("form");

async function initMedia() {
    nameInputDiv.hidden = true;
    rtcRoom.hidden = true;
    call.hidden = false;
    await getMedia();
    makeConnection();
}

async function handleRtcRoom(event) {
    event.preventDefault();
    const input = rtcRoomForm.querySelector("input");
    await initMedia();
    socket.emit("join_room", input.value);
    rtcRoomName = input.value;
    input.value = "";
}

rtcRoomForm.addEventListener("submit", handleRtcRoom);

// Socket code
socket.on("welcome", async () => {
    // myDataChannel = myPeerConnection.createDataChannel("chat");
    // myDataChannel.addEventListener("message", console.log);
    const offer = await myPeerConnection.createOffer();
    myPeerConnection.setLocalDescription(offer);
    socket.emit("offer", offer, rtcRoomName);
    console.log("sent offer");
}); // Peer A

socket.on("offer", async (offer) => {
    // myPeerConnection.addEventListener( "datachannel", (event) => {
    //     myDataChannel = event.channel;
    //     myDataChannel.addEventListener("message", console.log);
    // });
    console.log("received offer");
    myPeerConnection.setRemoteDescription(offer);
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer);
    socket.emit("answer", answer, rtcRoomName);
    console.log("sent answer");
}); // Peer B

socket.on("answer", (answer) => {
    console.log("received answer");
    myPeerConnection.setRemoteDescription(answer);
}); // Peer A

socket.on("ice", (ice) => {
    console.log("received candidate");
    myPeerConnection.addIceCandidate(ice);
});

socket.on("ice",)

// RTC code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ],
            },
        ],
    });
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream);
    myStream.getTracks().forEach((track) => {
        myPeerConnection.addTrack(track, myStream)
    });
}

function handleIce(data) {
    console.log("sent candidate");
    socket.emit("ice", data.candidate, rtcRoomName);
}

function handleAddStream(data) {
    const peerVideo = document.querySelector("#peerVideo");
    peerVideo.srcObject = data.stream;
}